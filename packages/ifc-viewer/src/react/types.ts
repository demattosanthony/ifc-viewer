import * as OBC from "@thatopen/components";
import type {
  LoadedModel,
  ElementData,
  HighlighterConfig,
  HovererConfig,
  ViewerEventHandlers,
  ElementSelectedEvent,
  ElementHoveredEvent,
} from "../types";

// Re-export shared types for convenience
export type {
  LoadedModel,
  ElementData,
  HighlighterConfig,
  HovererConfig,
  ViewerEventHandlers,
  ElementSelectedEvent,
  ElementHoveredEvent,
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
}

export interface ViewerContextValue extends ViewerState, ViewerActions {
  components: OBC.Components | null;
  fragmentsManager: OBC.FragmentsManager | null;
}

export interface ViewerProviderProps {
  children: React.ReactNode;
  config?: ViewerConfig;
  workerUrl: string;
}

export interface ViewerConfig {
  backgroundColor?: string;
  gridEnabled?: boolean;
  statsEnabled?: boolean;
  showGizmo?: boolean;
  highlighter?: HighlighterConfig | false;
  hoverer?: HovererConfig | false;
  events?: ViewerEventHandlers;
}

export interface ViewerProps {
  onReady?: () => void;
  onError?: (error: Error) => void;
  onElementSelected?: (event: ElementSelectedEvent) => void;
  onElementHovered?: (event: ElementHoveredEvent) => void;
}
