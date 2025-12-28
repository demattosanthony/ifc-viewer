import * as OBC from "@thatopen/components";
import type {
  LoadedModel,
  ElementData,
  InteractionConfig,
  ViewerEventHandlers,
  ElementSelectedEvent,
  ElementHoveredEvent,
  MousePosition,
  Point3D,
  CameraMode,
  CameraProjection,
  FloorPlan,
} from "../types";
import type { CameraCursor } from "../core/camera/manager";
import type { InteractionManager } from "../core/scene/interactions";

// Re-export shared types for convenience
export type {
  LoadedModel,
  ElementData,
  InteractionConfig,
  ViewerEventHandlers,
  ElementSelectedEvent,
  ElementHoveredEvent,
  MousePosition,
  Point3D,
};

// Alias for backward compatibility
export type ElementInfo = ElementData;

// ============================================================================
// React-Specific Types
// ============================================================================

export interface ViewerState {
  isInitialized: boolean;
  error: Error | null;
  loadedModels: Map<string, LoadedModel>;
}

export interface CameraControls {
  // Current state
  mode: CameraMode;
  projection: CameraProjection;
  cursor: CameraCursor;

  // Controls
  setMode: (mode: CameraMode) => void;
  setProjection: (projection: CameraProjection) => void;
  fitToItems: () => void;
}

export interface PlanViewControls {
  plans: FloorPlan[];
  activePlanId: string | null;
  open: (planId: string) => void;
  close: () => void;
}

export interface ViewerActions {
  loadModel: (
    buffer: ArrayBuffer,
    name: string,
    onProgress?: (progress: number) => void
  ) => Promise<void>;
  unloadModel: (modelId: string) => Promise<void>;
  unloadAllModels: () => Promise<void>;
  getElement: (
    modelId: string,
    elementId: number
  ) => Promise<ElementData | null>;
  initialize: (container: HTMLElement) => Promise<void>;
  dispose: () => void;
  /** Manually trigger a resize of the viewer renderer */
  resize: () => void;
}

export interface ViewerContextValue extends ViewerState, ViewerActions {
  components: OBC.Components | null;
  fragmentsManager: OBC.FragmentsManager | null;
  interactionManager: InteractionManager | null;
  camera: CameraControls | null;
  planViews: PlanViewControls | null;
}

export interface ViewerProviderProps {
  children: React.ReactNode;
  config?: ViewerConfig;
  /**
   * Optional URL to the fragments worker.
   * If not provided, the bundled worker will be used automatically.
   */
  workerUrl?: string;
}

export interface ViewerConfig {
  backgroundColor?: string;
  gridEnabled?: boolean;
  statsEnabled?: boolean;
  showGizmo?: boolean;
  /** Interaction configuration (hover + selection). Set to false to disable. */
  interaction?: InteractionConfig | false;
  events?: ViewerEventHandlers;
}

export interface ViewerProps {
  onReady?: () => void;
  onError?: (error: Error) => void;
  onElementSelected?: (event: ElementSelectedEvent) => void;
  onElementHovered?: (event: ElementHoveredEvent | null) => void;
}
