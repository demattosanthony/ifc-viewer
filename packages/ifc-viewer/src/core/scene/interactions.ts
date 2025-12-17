import * as OBC from "@thatopen/components";
import * as OBF from "@thatopen/components-front";
import * as THREE from "three";
import type {
  HighlighterConfig,
  HovererConfig,
  SelectionCallback,
  ClearCallback,
} from "../../types";

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
): OBF.Hoverer {
  const hoverer = components.get(OBF.Hoverer);

  hoverer.world = world;
  hoverer.animation = config.animation ?? false;
  hoverer.duration = config.duration ?? 0;
  hoverer.material = new THREE.MeshBasicMaterial({
    color: config.color ?? 0x0b99ff,
    transparent: config.transparent ?? true,
    opacity: config.opacity ?? 0.5,
    depthTest: config.depthTest ?? false,
  });

  return hoverer;
}
