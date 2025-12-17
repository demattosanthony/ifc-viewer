import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  createScene,
  setupFeatures,
  setupHighlighter,
  setupHoverer,
} from "../core/scene";
import { ModelManager } from "../core/models/manager";
import type {
  ViewerProviderProps,
  ViewerState,
  ViewerContextValue,
} from "./types";
import * as OBC from "@thatopen/components";

// Create context for the viewer
const ViewerContext = createContext<ViewerContextValue | undefined>(undefined);

// Display name for React Dev Tools
ViewerContext.displayName = "ViewerContext";

/**
 * React wrapper around core functionality
 * Manages React state and lifecycle
 */
export const ViewerProvider = ({
  children,
  config,
  workerUrl,
}: ViewerProviderProps) => {
  // Core instances (refs because we don't want to re-create them on every render)
  const sceneRef = useRef<Awaited<ReturnType<typeof createScene>> | null>(null);
  const modelManagerRef = useRef<ModelManager | null>(null);
  const featuresRef = useRef<ReturnType<typeof setupFeatures> | null>(null);
  const highlighterRef = useRef<ReturnType<typeof setupHighlighter> | null>(
    null
  );

  // React state (UI updates)
  const [state, setState] = useState<ViewerState>({
    isInitialized: false,
    error: null,
    loadedModels: new Map(),
  });

  // Initialize using core functions
  const initialize = useCallback(
    async (container: HTMLElement) => {
      if (sceneRef.current) return;

      try {
        // Use core scene creation
        const scene = await createScene(container, {
          backgroundColor: config?.backgroundColor,
        });
        sceneRef.current = scene;

        // Use core features setup
        const features = setupFeatures(scene.components, scene.world, {
          grid: config?.gridEnabled,
          stats: config?.statsEnabled,
          gizmo: config?.showGizmo,
        });
        featuresRef.current = features;

        // Use core interactions setup
        if (config?.highlighter !== false) {
          const highlighter = setupHighlighter(
            scene.components,
            scene.world,
            typeof config?.highlighter === "object" ? config.highlighter : {},
            {
              onSelect: (data) => {
                config?.events?.onElementSelected?.({ modelIdMap: data });
              },
              onClear: () => {
                config?.events?.onElementSelected?.({ modelIdMap: {} });
              },
            }
          );
          highlighterRef.current = highlighter;
        }

        if (config?.hoverer !== false) {
          setupHoverer(
            scene.components,
            scene.world,
            typeof config?.hoverer === "object" ? config.hoverer : {}
          );
        }

        scene.components.init();

        // Create model manager with React state callbacks
        modelManagerRef.current = new ModelManager(
          scene.components,
          scene.world,
          scene.camera,
          workerUrl,
          {
            onModelLoaded: (model) => {
              setState((prev) => {
                const newModels = new Map(prev.loadedModels);
                newModels.set(model.id, model);
                return { ...prev, loadedModels: newModels };
              });
            },
            onModelUnloaded: (modelId) => {
              setState((prev) => {
                const newModels = new Map(prev.loadedModels);
                newModels.delete(modelId);
                return { ...prev, loadedModels: newModels };
              });
            },
          }
        );

        setState((prev) => ({ ...prev, isInitialized: true, error: null }));
      } catch (error) {
        console.error("Failed to initialize viewer:", error);
        setState((prev) => ({
          ...prev,
          error: error as Error,
        }));
      }
    },
    [config, workerUrl]
  );

  const dispose = useCallback(() => {
    highlighterRef.current?.dispose();
    featuresRef.current?.dispose();
    modelManagerRef.current?.dispose();

    if (sceneRef.current) {
      sceneRef.current.components.dispose();
    }

    sceneRef.current = null;
    modelManagerRef.current = null;
    featuresRef.current = null;
    highlighterRef.current = null;

    setState({
      isInitialized: false,
      error: null,
      loadedModels: new Map(),
    });
  }, []);

  useEffect(() => {
    return () => {
      dispose();
    };
  }, [dispose]);

  // Memoize the functions with useCallback
  const getElement = useCallback(
    (modelId: string, elementId: number) =>
      modelManagerRef.current?.getElement(modelId, elementId) ??
      Promise.resolve(null),
    []
  );

  const loadModel = useCallback(
    (
      buffer: ArrayBuffer,
      name: string,
      onProgress?: (progress: number) => void
    ) =>
      modelManagerRef.current?.loadModel(buffer, name, onProgress) ??
      Promise.resolve(),
    []
  );

  const unloadModel = useCallback(
    (modelId: string) =>
      modelManagerRef.current?.unloadModel(modelId) ?? Promise.resolve(),
    []
  );

  const unloadAllModels = useCallback(
    () => modelManagerRef.current?.unloadAllModels() ?? Promise.resolve(),
    []
  );

  // Return the value object
  const value: ViewerContextValue = {
    ...state,
    components: sceneRef.current?.components ?? null,
    fragmentsManager:
      sceneRef.current?.components?.get(OBC.FragmentsManager) ?? null,
    getElement,
    loadModel,
    unloadModel,
    unloadAllModels,
    initialize,
    dispose,
  };

  return (
    <ViewerContext.Provider value={value}>{children}</ViewerContext.Provider>
  );
};

export const useViewer = () => {
  const context = useContext(ViewerContext);
  if (!context) {
    throw new Error("useViewer must be used within a ViewerProvider");
  }
  return context;
};
