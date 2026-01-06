/**
 * ID Generation Utilities
 *
 * Centralized ID generation using UUIDv7 for time-sortable identifiers.
 * UUIDv7 embeds a timestamp prefix, providing better database index performance
 * compared to random UUIDv4 while maintaining the same format.
 */

import { uuidv7 } from "uuidv7"

/**
 * Generate a new UUIDv7 identifier.
 *
 * UUIDv7 format: `xxxxxxxx-xxxx-7xxx-yxxx-xxxxxxxxxxxx`
 * - First 48 bits: Unix timestamp in milliseconds
 * - Remaining bits: Random data with version/variant bits
 *
 * Benefits over UUIDv4:
 * - Time-sortable (chronological ordering)
 * - Better B-tree index performance
 * - Same format/length as UUIDv4 (drop-in replacement)
 */
export function generateId(): string {
  return uuidv7()
}
