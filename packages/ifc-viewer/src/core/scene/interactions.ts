import * as OBC from "@thatopen/components";
import * as OBF from "@thatopen/components-front";
import * as FRAGS from "@thatopen/fragments";
import * as THREE from "three";
import type {
  HighlighterConfig,
  HovererConfig,
  SelectionCallback,
  ClearCallback,
} from "../../types";

// ============================================================================
// InstantHoverer - Custom lightweight hover implementation
// ============================================================================

export class InstantHoverer {
  private components: OBC.Components;
  private world: OBC.World;
  private meshes: THREE.Mesh[] = [];
  private currentLocalId: number | null = null;
  private currentModelId: string | null = null;
  private enabled = true;
  private lastHoverTime = 0;
  private throttleMs: number;
  private pendingRaycast: boolean = false;

  material: THREE.Material;

  constructor(
    components: OBC.Components,
    world: OBC.World,
    config: HovererConfig = {}
  ) {
    this.components = components;
    this.world = world;
    this.throttleMs = config.throttleMs ?? 16; // ~60fps default

    this.material = new THREE.MeshBasicMaterial({
      color: config.color ?? 0x0b99ff,
      transparent: config.transparent ?? true,
      opacity: config.opacity ?? 0.5,
      depthTest: config.depthTest ?? false,
    });

    // Initialize the raycaster for this world
    this.components.get(OBC.Raycasters).get(world);

    this.setupEvents();
  }

  private setupEvents() {
    if (!this.world.renderer) {
      throw new Error("World needs a renderer!");
    }

    const container = this.world.renderer.three.domElement;
    container.addEventListener("mousemove", this.onMouseMove);
    container.addEventListener("mouseleave", this.onMouseLeave);
  }

  private onMouseMove = async () => {
    if (!this.enabled) return;

    // Throttle to prevent excessive raycasting
    const now = performance.now();
    if (now - this.lastHoverTime < this.throttleMs) return;
    this.lastHoverTime = now;

    // Prevent overlapping raycasts
    if (this.pendingRaycast) return;
    this.pendingRaycast = true;

    try {
      const casters = this.components.get(OBC.Raycasters);
      const caster = casters.get(this.world);

      const result = (await caster.castRay()) as unknown as {
        fragments: FRAGS.FragmentsModel;
        localId: number;
      } | null;

      if (!result) {
        this.clear();
        return;
      }

      const { fragments: model, localId } = result;

      // Same element - do nothing
      if (
        this.currentLocalId === localId &&
        this.currentModelId === model.modelId
      ) {
        return;
      }

      // Different element - clear old and highlight new
      this.clear();
      this.currentLocalId = localId;
      this.currentModelId = model.modelId;

      // Create highlight mesh immediately
      const modelIdMap = { [model.modelId]: new Set([localId]) };
      const mesher = this.components.get(OBF.Mesher);
      const meshesResult = await mesher.get(modelIdMap);

      for (const [, data] of meshesResult.entries()) {
        const meshList = [...data.values()].flat();
        for (const mesh of meshList) {
          mesh.material = this.material;
          this.world.scene.three.add(mesh);
          this.meshes.push(mesh);
        }
      }
    } finally {
      this.pendingRaycast = false;
    }
  };

  private onMouseLeave = () => {
    this.clear();
  };

  clear() {
    for (const mesh of this.meshes) {
      mesh.removeFromParent();
      mesh.geometry.dispose();
    }
    this.meshes = [];
    this.currentLocalId = null;
    this.currentModelId = null;
  }

  setEnabled(value: boolean) {
    this.enabled = value;
    if (!value) this.clear();
  }

  dispose() {
    this.clear();
    this.material.dispose();

    if (this.world.renderer) {
      const container = this.world.renderer.three.domElement;
      container.removeEventListener("mousemove", this.onMouseMove);
      container.removeEventListener("mouseleave", this.onMouseLeave);
    }
  }
}

export function setupHighlighter(
  components: OBC.Components,
  world: OBC.World,
  config: HighlighterConfig = {},
  callbacks?: {
    onSelect?: SelectionCallback;
    onClear?: ClearCallback;
  }
): { instance: OBF.Highlighter; dispose: () => void } {
  const highlighter = components.get(OBF.Highlighter);

  highlighter.setup({
    world,
    selectMaterialDefinition: {
      color: new THREE.Color(config.selectColor ?? 0x0b99ff),
      opacity: config.selectOpacity ?? 0.75,
      transparent: config.selectTransparent ?? true,
      renderedFaces: 0,
    },
  });

  highlighter.zoomToSelection = config.zoomToSelection ?? false;

  const cleanupFns: Array<() => void> = [];

  if (callbacks?.onSelect || callbacks?.onClear) {
    const selectName = highlighter.config.selectName;

    if (callbacks.onSelect) {
      highlighter.events[selectName]?.onHighlight.add(callbacks.onSelect);
      cleanupFns.push(() => {
        highlighter.events[selectName]?.onHighlight.remove(callbacks.onSelect!);
      });
    }

    if (callbacks.onClear) {
      highlighter.events[selectName]?.onClear.add(callbacks.onClear);
      cleanupFns.push(() => {
        highlighter.events[selectName]?.onClear.remove(callbacks.onClear!);
      });
    }
  }

  return {
    instance: highlighter,
    dispose: () => {
      cleanupFns.forEach((fn) => fn());
    },
  };
}

export function setupHoverer(
  components: OBC.Components,
  world: OBC.World,
  config: HovererConfig = {}
): InstantHoverer {
  return new InstantHoverer(components, world, config);
}
