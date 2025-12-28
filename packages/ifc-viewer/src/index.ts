// React components and hooks
export { Viewer } from "./react/viewer";
export { ViewerProvider, useViewer } from "./react/context";
export { useViewerEvents } from "./react/hooks";

// Worker utility - re-exported for convenience
export { getFragmentsWorkerUrl } from "./worker";

// Types - re-export from react/types which includes shared types
export type {
  // Shared types
  LoadedModel,
  ElementInfo,
  InteractionConfig,
  ViewerEventHandlers,
  ElementSelectedEvent,
  ElementHoveredEvent,
  MousePosition,
  Point3D,
  // React-specific types
  ViewerConfig,
  ViewerProps,
  ViewerState,
  ViewerContextValue,
  CameraControls,
  PlanViewControls,
} from "./react/types";

// Camera types
export type { CameraMode, CameraProjection } from "./types";
export type { CameraCursor, CameraState } from "./core/camera/manager";

// Plan view types
export type { FloorPlan } from "./types";
export type { PlanViewState } from "./core/plans/manager";
