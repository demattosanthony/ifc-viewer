import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import type {
  ElementInfo,
  ViewerContextValue,
  ViewerProviderProps,
  ViewerState,
} from "../types";
import * as OBC from "@thatopen/components";
import * as THREE from "three";
import Stats from "stats.js";
import { OrientationGizmo } from "../components/orientation-gizmo";
import * as OBF from "@thatopen/components-front";
import type { FragmentsModel } from "@thatopen/fragments";
import * as WEBIFC from "web-ifc";

// Create context for the viewer
const ViewerContext = createContext<ViewerContextValue | undefined>(undefined);

// Display name for React Dev Tools
ViewerContext.displayName = "ViewerContext";

// Provider component
export const ViewerProvider = ({
  children,
  config,
  workerUrl,
}: ViewerProviderProps) => {
  // Refs for OBC components (don't trigger re-renders)
  const componentsRef = useRef<OBC.Components | null>(null);
  const worldRef = useRef<OBC.World | null>(null);
  const containerRef = useRef<HTMLElement | null>(null);
  const cameraRef = useRef<OBC.OrthoPerspectiveCamera | null>(null);
  const fragmentsInitializedRef = useRef(false);

  // Store cleanup function for event handlers
  const cleanupEventsRef = useRef<(() => void) | null>(null);

  // Reactive state
  const [state, setState] = useState<ViewerState>({
    isInitialized: false,
    isLoading: false,
    error: null,
    loadedModels: new Map(),
  });

  // Initialize viewer (called by Viewer component)
  const initialize = useCallback(
    async (container: HTMLElement) => {
      if (componentsRef.current) return; // Already initialized

      try {
        containerRef.current = container;

        // Initialize OBC
        const components = new OBC.Components();
        componentsRef.current = components;

        // Create world with scene, camera, renderer
        const worlds = components.get(OBC.Worlds);
        const world = worlds.create<
          OBC.SimpleScene,
          OBC.OrthoPerspectiveCamera,
          OBC.SimpleRenderer
        >();
        worldRef.current = world;

        // Setup scene
        world.scene = new OBC.SimpleScene(components);
        world.scene.setup();

        // Setup renderer
        world.renderer = new OBC.SimpleRenderer(components, container);

        // Setup camera
        world.camera = new OBC.OrthoPerspectiveCamera(components);
        cameraRef.current = world.camera;

        // Set initial camera position
        world.camera.controls.setLookAt(15, 6, 8, 0, 0, -10, true);

        // Apply config
        if (config?.backgroundColor) {
          world.scene.three.background = new THREE.Color(
            config.backgroundColor
          );
        } else {
          world.scene.three.background = null;
        }

        // Optional: grid
        if (config?.gridEnabled) {
          const grids = components.get(OBC.Grids);
          grids.create(world);
        }

        // Optional: stats
        if (config?.statsEnabled) {
          const stats = new Stats();
          stats.showPanel(0);
          document.body.append(stats.dom);
          stats.dom.style.position = "absolute";
          stats.dom.style.top = "0px";
          stats.dom.style.left = "0px";
          stats.dom.style.zIndex = "10";
          world.renderer.onBeforeUpdate.add(() => stats.begin());
          world.renderer.onAfterUpdate.add(() => stats.end());
        }

        // Optional: orientation gizmo, show by default
        if (config?.showGizmo !== false) {
          new OrientationGizmo(components, world);
        }

        // Setup highlighter (with defaults if not disabled)
        if (config?.highlighter !== false) {
          const highlighter = components.get(OBF.Highlighter);
          const highlighterConfig = config?.highlighter || {};

          highlighter.setup({
            world,
            selectMaterialDefinition: {
              color: new THREE.Color(highlighterConfig.selectColor ?? 0x0b99ff),
              opacity: highlighterConfig.selectOpacity ?? 0.75,
              transparent: highlighterConfig.selectTransparent ?? true,
              renderedFaces: 0,
            },
          });
          highlighter.zoomToSelection =
            highlighterConfig.zoomToSelection ?? false;

          if (config?.events?.onElementSelected) {
            const selectName = highlighter.config.selectName;
            const highlightHandler = (data: OBC.ModelIdMap) =>
              config?.events?.onElementSelected?.({ modelIdMap: data });
            const clearHandler = () =>
              config?.events?.onElementSelected?.({ modelIdMap: {} });

            highlighter.events[selectName]?.onHighlight.add(highlightHandler);
            highlighter.events[selectName]?.onClear.add(clearHandler);

            // Store cleanup function
            cleanupEventsRef.current = () => {
              highlighter.events[selectName]?.onHighlight.remove(
                highlightHandler
              );
              highlighter.events[selectName]?.onClear.remove(clearHandler);
            };
          }
        }

        // Setup hoverer (with defaults if not disabled)
        if (config?.hoverer !== false) {
          const hoverer = components.get(OBF.Hoverer);
          const hovererConfig = config?.hoverer || {};

          hoverer.world = world;
          hoverer.animation = hovererConfig.animation ?? false;
          hoverer.duration = hovererConfig.duration ?? 0;
          hoverer.material = new THREE.MeshBasicMaterial({
            color: hovererConfig.color ?? 0x0b99ff,
            transparent: hovererConfig.transparent ?? true,
            opacity: hovererConfig.opacity ?? 0.5,
            depthTest: hovererConfig.depthTest ?? false,
          });
        }

        // Initialize components
        components.init();

        setState((prev) => ({
          ...prev,
          isInitialized: true,
          error: null,
        }));
      } catch (error) {
        console.error("Failed to initialize viewer:", error);
      }
    },
    [config]
  );

  // Helper to get a model
  const getModel = useCallback((modelId: string): FragmentsModel | null => {
    const fragments = componentsRef.current?.get(OBC.FragmentsManager);
    if (!fragments) return null;
    return fragments.list.get(modelId) ?? null;
  }, []);

  // Get detailed element information
  const getElement = useCallback(
    async (modelId: string, elementId: number): Promise<ElementInfo | null> => {
      const model = getModel(modelId);
      if (!model) return null;

      try {
        const item = model.getItem(elementId);
        const data = await item.getData();

        if (!data) {
          return null;
        }

        // Return raw data structure - let developers work with it directly
        return data;
      } catch (error) {
        console.error(
          `Failed to get element ${elementId} from model ${modelId}:`,
          error
        );
        return null;
      }
    },
    [getModel]
  );

  const loadModel = useCallback(
    async (
      buffer: ArrayBuffer,
      name: string,
      onProgress?: (progress: number) => void
    ) => {
      const components = componentsRef.current;
      const world = worldRef.current;
      const camera = cameraRef.current;
      if (!components || !world || !camera) {
        throw new Error("Viewer not initialized");
      }

      const ifcLoader = components.get(OBC.IfcLoader);
      const fragments = components.get(OBC.FragmentsManager);

      const handleModelLoaded = ({
        value: model,
      }: {
        value: FragmentsModel;
      }) => {
        model.useCamera(camera.three);
        world.scene.three.add(model.object);
        fragments.core.update(true);

        setState((prev) => ({
          ...prev,
          loadedModels: new Map(prev.loadedModels).set(model.modelId, {
            id: model.modelId,
            name,
          }),
        }));
      };

      try {
        await ifcLoader.setup({
          autoSetWasm: false,
          wasm: {
            path: "https://unpkg.com/web-ifc@0.0.72/",
            absolute: true,
          },
        });

        ifcLoader.onIfcImporterInitialized.add((importer) => {
          // Configure excluded categories
          const excludedCats = [
            WEBIFC.IFCTENDONANCHOR,
            WEBIFC.IFCREINFORCINGBAR,
            WEBIFC.IFCREINFORCINGELEMENT,
            WEBIFC.IFCSPACE,
          ];

          excludedCats.forEach((category) => {
            importer.classes.elements.delete(category);
          });
        });

        // Only initialize fragments once
        if (!fragmentsInitializedRef.current) {
          fragments.init(workerUrl);
          fragmentsInitializedRef.current = true;

          world.camera?.controls?.addEventListener("rest", () =>
            fragments.core.update(true)
          );
        }

        // Ensures that once the Fragments model is loaded
        // (converted from the IFC in this case),
        // it utilizes the world camera for updates
        // and is added to the scene.
        fragments.list.onItemSet.add(handleModelLoaded);

        const data = new Uint8Array(buffer);

        await ifcLoader.load(data, false, name, {
          processData: {
            progressCallback: (progress) => {
              onProgress?.(progress);
            },
          },
        });

        cameraRef.current?.fitToItems();
      } finally {
        fragments.list.onItemSet.remove(handleModelLoaded);
      }
    },
    [workerUrl]
  );

  const unloadModel = useCallback(async (modelId: string) => {
    const components = componentsRef.current;
    const world = worldRef.current;
    if (!components || !world) {
      return; // Silently return during cleanup
    }

    try {
      const fragments = components.get(OBC.FragmentsManager);
      const model = fragments.list.get(modelId);

      if (!model) {
        console.warn(`Model ${modelId} not found`);
        return;
      }

      // Remove from scene
      world.scene.three.remove(model.object);

      // Dispose model resources
      model.dispose();

      // Remove from manager
      fragments.list.delete(modelId);

      // Force update only if initialized
      if (fragmentsInitializedRef.current) {
        fragments.core.update(true);
      }

      // Update state
      setState((prev) => {
        const newModels = new Map(prev.loadedModels);
        newModels.delete(modelId);
        return { ...prev, loadedModels: newModels };
      });
    } catch (error) {
      console.warn(`Error unloading model ${modelId}:`, error);
    }
  }, []);

  const unloadAllModels = useCallback(async () => {
    if (!componentsRef.current || !worldRef.current) return;

    try {
      const fragments = componentsRef.current.get(OBC.FragmentsManager);
      for (const modelId of Array.from(fragments.list.keys())) {
        await unloadModel(modelId);
      }
    } catch (error) {
      console.warn("Error unloading all models:", error);
    }
  }, [unloadModel]);

  // Cleanup
  const dispose = useCallback(() => {
    // Clean up event handlers
    cleanupEventsRef.current?.();
    cleanupEventsRef.current = null;

    // Unload all models
    if (componentsRef.current && worldRef.current) {
      try {
        const fragments = componentsRef.current.get(OBC.FragmentsManager);
        for (const [modelId, model] of fragments.list) {
          worldRef.current.scene.three.remove(model.object);
          model.dispose();
          fragments.list.delete(modelId);
        }
      } catch (error) {
        console.warn("Error disposing models:", error);
      }
    }

    // Dispose components and reset refs
    componentsRef.current?.dispose();
    componentsRef.current = null;
    worldRef.current = null;
    cameraRef.current = null;
    fragmentsInitializedRef.current = false;

    setState({
      isInitialized: false,
      isLoading: false,
      error: null,
      loadedModels: new Map(),
    });
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      dispose();
    };
  }, [dispose]);

  const value: ViewerContextValue = {
    ...state,
    fragmentsManager: componentsRef.current?.get(OBC.FragmentsManager) ?? null,
    components: componentsRef.current,
    getElement,
    loadModel,
    unloadModel,
    unloadAllModels,
    initialize, // Internal - used by Viewer component
    dispose,
  };

  return (
    <ViewerContext.Provider value={value}>{children}</ViewerContext.Provider>
  );
};

// Custom hook to use the viewer context
export const useViewer = () => {
  const context = useContext(ViewerContext);
  if (!context) {
    throw new Error("useViewer must be used within a ViewerProvider");
  }
  return context;
};
