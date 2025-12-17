import * as OBC from "@thatopen/components";

export interface LoadedModel {
  id: string;
  name: string;
}

/**
 * Element information from IFC model
 * Contains the raw ItemData structure from @thatopen/fragments
 */
export interface ElementInfo {
  [x: string]: any;
}

export interface ViewerState {
  isInitialized: boolean;
  isLoading: boolean;
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
  ) => Promise<ElementInfo | null>;
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

export interface HighlighterConfig {
  selectColor?: number; // e.g., 0x0b99ff
  selectOpacity?: number; // e.g., 0.75
  selectTransparent?: boolean;
  zoomToSelection?: boolean;
}

export interface HovererConfig {
  color?: number; // e.g., 0x0b99ff
  opacity?: number; // e.g., 0.5
  transparent?: boolean;
  depthTest?: boolean;
  animation?: boolean;
  duration?: number; // millisecond
}

// Event payload types
export interface ElementSelectedEvent {
  modelIdMap: Record<string, Set<number>>;
}

export interface ElementHoveredEvent {
  modelIdMap: Record<string, Set<number>>;
}

// Event handler types
export interface ViewerEventHandlers {
  onElementSelected?: (event: ElementSelectedEvent) => void;
  onElementHovered?: (event: ElementHoveredEvent) => void;
}

export interface ViewerConfig {
  backgroundColor?: string;
  gridEnabled?: boolean;
  statsEnabled?: boolean;
  showGizmo?: boolean;
  highlighter?: HighlighterConfig | false; // false to disable entirely
  hoverer?: HovererConfig | false; // false to disable entirely
  events?: ViewerEventHandlers;
}

export interface ViewerProps {
  onReady?: () => void;
  onError?: (error: Error) => void;
  onElementSelected?: (event: ElementSelectedEvent) => void;
  onElementHovered?: (event: ElementHoveredEvent) => void;
}
