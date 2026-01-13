/**
 * Fragment Converter
 *
 * Server-side IFC to fragments conversion using @thatopen/fragments.
 * Converts IFC files to an optimized fragment format for fast client-side rendering.
 */

import { createRequire } from "node:module"
import path from "node:path"
import { IfcImporter } from "@thatopen/fragments"
import * as WEBIFC from "web-ifc"

/** Current fragment format version - update when fragment library changes */
export const FRAGMENT_VERSION = "1.0.0"

/** Categories to exclude from fragment conversion (non-visual elements) */
const EXCLUDED_CATEGORIES = [
  WEBIFC.IFCTENDONANCHOR,
  WEBIFC.IFCREINFORCINGBAR,
  WEBIFC.IFCREINFORCINGELEMENT,
  WEBIFC.IFCSPACE,
]

/**
 * Get the local path to the web-ifc WASM directory.
 * Uses require.resolve to find the package in node_modules.
 */
function getWebIfcWasmPath(): string {
  const require = createRequire(import.meta.url)
  const webIfcPkg = require.resolve("web-ifc/package.json")
  return path.dirname(webIfcPkg) + "/"
}

/**
 * Convert an IFC file to fragment format.
 *
 * @param ifcData - Raw IFC file data as Uint8Array
 * @returns Fragment data as Uint8Array, ready to be stored
 * @throws Error if conversion fails
 */
export async function convertIfcToFragments(ifcData: Uint8Array): Promise<Uint8Array> {
  const importer = new IfcImporter()

  // Configure WASM path for server-side use (local node_modules path)
  importer.wasm = {
    path: getWebIfcWasmPath(),
    absolute: true,
  }

  // Exclude non-visual categories for performance
  for (const cat of EXCLUDED_CATEGORIES) {
    importer.classes.elements.delete(cat)
  }

  // Process the IFC data - returns serialized fragment bytes directly
  // For Node.js, we provide a readCallback to read the bytes in chunks
  const fragmentBuffer = await importer.process({
    bytes: ifcData,
    readFromCallback: true,
    readCallback: (offset: number, size: number) => {
      return ifcData.subarray(offset, offset + size)
    },
  })

  return fragmentBuffer
}

/**
 * Get the fragment file path from an IFC file path.
 *
 * @param ifcPath - Path to the IFC file (e.g., "models/building.ifc")
 * @returns Path to the fragment file (e.g., ".frags/building.frag")
 */
export function getFragmentPath(ifcPath: string): string {
  // Extract filename and place in .frags folder
  const fileName = ifcPath.split("/").pop() || ifcPath
  return `.frags/${fileName.replace(/\.ifc$/i, ".frag")}`
}
