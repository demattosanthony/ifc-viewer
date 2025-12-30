import type { Computer, ComputerConfig, ComputerProvider } from "./types";

/**
 * Create a computer instance from any provider
 *
 * @example
 * ```ts
 * import { createComputer } from '@ifc-viewer/compute';
 * import { local } from '@ifc-viewer/compute/providers/local';
 *
 * const computer = await createComputer({
 *   provider: local({ baseDirectory: '/workspace', cleanup: true }),
 * });
 * ```
 */
export async function createComputer({
  provider,
  config,
}: {
  provider: ComputerProvider;
  config?: ComputerConfig;
}): Promise<Computer> {
  return await provider.create(config);
}
