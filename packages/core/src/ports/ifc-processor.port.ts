/**
 * IFC Processor Port
 *
 * Interface for converting IFC (Industry Foundation Classes) files
 * to optimized fragment format for fast client-side 3D rendering.
 */

export interface IFCProcessor {
  /**
   * Convert IFC data to optimized fragment format.
   *
   * @param ifcData - Raw IFC file data as Uint8Array
   * @returns Fragment data as Uint8Array, ready to be stored
   * @throws Error if conversion fails
   */
  convert(ifcData: Uint8Array): Promise<Uint8Array>

  /**
   * Get the fragment file path for an IFC file path.
   *
   * @param ifcPath - Path to the IFC file (e.g., "models/building.ifc")
   * @returns Path to the fragment file (e.g., ".frags/building.frag")
   */
  getFragmentPath(ifcPath: string): string

  /** Current fragment format version */
  readonly version: string
}
