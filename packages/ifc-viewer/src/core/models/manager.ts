import * as OBC from "@thatopen/components";
import * as WEBIFC from "web-ifc";
import type { FragmentsModel, IfcImporter } from "@thatopen/fragments";
import type {
  LoadedModel,
  ElementData,
  ModelLoadedCallback,
  ModelUnloadedCallback,
  ProgressCallback,
} from "../../types";

export class ModelManager {
  private components: OBC.Components;
  private world: OBC.World;
  private camera: OBC.OrthoPerspectiveCamera;
  private workerUrl: string;
  private fragmentsInitialized = false;
  private onModelLoaded?: ModelLoadedCallback;
  private onModelUnloaded?: ModelUnloadedCallback;

  constructor(
    components: OBC.Components,
    world: OBC.World,
    camera: OBC.OrthoPerspectiveCamera,
    workerUrl: string,
    callbacks?: {
      onModelLoaded?: ModelLoadedCallback;
      onModelUnloaded?: ModelUnloadedCallback;
    }
  ) {
    this.components = components;
    this.world = world;
    this.camera = camera;
    this.workerUrl = workerUrl;
    this.onModelLoaded = callbacks?.onModelLoaded;
    this.onModelUnloaded = callbacks?.onModelUnloaded;
  }

  getModel(modelId: string): FragmentsModel | null {
    const fragments = this.components.get(OBC.FragmentsManager);
    return fragments.list.get(modelId) ?? null;
  }

  getAllModels(): Map<string, FragmentsModel> {
    const fragments = this.components.get(OBC.FragmentsManager);
    return new Map(fragments.list);
  }

  async getElement(
    modelId: string,
    elementId: number
  ): Promise<ElementData | null> {
    const model = this.getModel(modelId);
    if (!model) return null;

    try {
      const item = model.getItem(elementId);
      const data = await item.getData();
      return data || null;
    } catch (error) {
      console.error(
        `Failed to get element ${elementId} from model ${modelId}:`,
        error
      );
      return null;
    }
  }

  async loadModel(
    buffer: ArrayBuffer,
    name: string,
    onProgress?: ProgressCallback
  ): Promise<void> {
    const ifcLoader = this.components.get(OBC.IfcLoader);
    const fragments = this.components.get(OBC.FragmentsManager);

    const handleModelLoaded = ({ value: model }: { value: FragmentsModel }) => {
      model.useCamera(this.camera.three);
      this.world.scene.three.add(model.object);
      fragments.core.update(true);

      this.onModelLoaded?.({ id: model.modelId, name });
    };

    const importerHandler = (importer: IfcImporter) => {
      const excludedCats = [
        WEBIFC.IFCTENDONANCHOR,
        WEBIFC.IFCREINFORCINGBAR,
        WEBIFC.IFCREINFORCINGELEMENT,
        WEBIFC.IFCSPACE,
      ];
      excludedCats.forEach((cat) => importer.classes.elements.delete(cat));
    };

    try {
      await ifcLoader.setup({
        autoSetWasm: false,
        wasm: {
          path: "https://unpkg.com/web-ifc@0.0.72/",
          absolute: true,
        },
      });

      ifcLoader.onIfcImporterInitialized.add(importerHandler);

      if (!this.fragmentsInitialized) {
        fragments.init(this.workerUrl);
        this.fragmentsInitialized = true;

        this.world.camera?.controls?.addEventListener("rest", () =>
          fragments.core.update(true)
        );
      }

      fragments.list.onItemSet.add(handleModelLoaded);

      const data = new Uint8Array(buffer);
      await ifcLoader.load(data, false, name, {
        processData: { progressCallback: onProgress },
      });

      this.camera.fitToItems();
    } finally {
      fragments.list.onItemSet.remove(handleModelLoaded);
      ifcLoader.onIfcImporterInitialized.remove(importerHandler);
    }
  }

  async unloadModel(modelId: string): Promise<void> {
    try {
      const fragments = this.components.get(OBC.FragmentsManager);
      const model = fragments.list.get(modelId);

      if (!model) {
        console.warn(`Model ${modelId} not found`);
        return;
      }

      this.world.scene.three.remove(model.object);
      model.dispose();
      fragments.list.delete(modelId);

      if (this.fragmentsInitialized) {
        fragments.core.update(true);
      }

      this.onModelUnloaded?.(modelId);
    } catch (error) {
      console.warn(`Error unloading model ${modelId}:`, error);
    }
  }

  async unloadAllModels(): Promise<void> {
    const fragments = this.components.get(OBC.FragmentsManager);
    const modelIds = Array.from(fragments.list.keys());

    for (const modelId of modelIds) {
      await this.unloadModel(modelId);
    }
  }

  dispose(): void {
    const fragments = this.components.get(OBC.FragmentsManager);

    for (const [, model] of fragments.list) {
      this.world.scene.three.remove(model.object);
      model.dispose();
    }

    fragments.list.clear();
    this.fragmentsInitialized = false;
  }
}
