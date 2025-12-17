import * as OBC from "@thatopen/components";

// ============================================================================
// Common Types
// ============================================================================

/** Represents a loaded IFC model */
export interface LoadedModel {
  id: string;
  name: string;
}

/** Element data from IFC model */
export interface ElementData {
  [key: string]: any;
}

// ============================================================================
// Config Types
// ============================================================================

/** Scene configuration */
export interface SceneConfig {
  backgroundColor?: string;
}

/** Feature toggles */
export interface FeaturesConfig {
  grid?: boolean;
  stats?: boolean;
  gizmo?: boolean;
}

/** Highlighter appearance and behavior */
export interface HighlighterConfig {
  selectColor?: number;
  selectOpacity?: number;
  selectTransparent?: boolean;
  zoomToSelection?: boolean;
}

/** Hoverer appearance and behavior */
export interface HovererConfig {
  color?: number;
  opacity?: number;
  transparent?: boolean;
  depthTest?: boolean;
  animation?: boolean;
  duration?: number;
}

// ============================================================================
// Event Types
// ============================================================================

/** Event payload when elements are selected */
export interface ElementSelectedEvent {
  modelIdMap: Record<string, Set<number>>;
}

/** Event payload when elements are hovered */
export interface ElementHoveredEvent {
  modelIdMap: Record<string, Set<number>>;
}

/** Event handlers configuration */
export interface ViewerEventHandlers {
  onElementSelected?: (event: ElementSelectedEvent) => void;
  onElementHovered?: (event: ElementHoveredEvent) => void;
}

// ============================================================================
// Callback Types
// ============================================================================

export type ModelLoadedCallback = (model: LoadedModel) => void;
export type ModelUnloadedCallback = (modelId: string) => void;
export type ProgressCallback = (progress: number) => void;
export type SelectionCallback = (data: OBC.ModelIdMap) => void;
export type ClearCallback = () => void;
