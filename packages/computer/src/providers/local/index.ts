// Local provider for @bim-ide/computer
// Uses Bun native APIs for maximum performance

import type { ComputerProvider, Computer, ComputerConfig } from "../../types";
import { LocalComputer } from "./computer";

export interface LocalConfig {
  /**
   * Root directory where auto-generated workspaces are created.
   * Only used when no explicit workingDirectory is provided in ComputerConfig.
   * @default '/tmp/bim-ide'
   */
  workspaceRoot?: string;

  /**
   * Whether to cleanup the workspace on dispose
   * @default false
   */
  cleanup?: boolean;

  /**
   * Default environment variables for all processes
   */
  environment?: Record<string, string>;
}

/**
 * Create a local computer provider using Bun native APIs
 *
 * @example
 * ```ts
 * import { createComputer } from '@bim-ide/computer';
 * import { local } from '@bim-ide/computer/local';
 *
 * const computer = await createComputer({
 *   provider: local({
 *     workspaceRoot: '/tmp/my-ide',
 *     cleanup: true
 *   })
 * });
 *
 * // Write a file
 * await computer.files.write('/hello.txt', 'Hello World!');
 *
 * // Execute a command
 * const result = await computer.process.exec('cat /hello.txt');
 * console.log(result.stdout); // "Hello World!"
 *
 * // Start an interactive terminal
 * const terminal = await computer.shell.startTerminal();
 * terminal.onData(data => console.log(data));
 * await terminal.write('ls -la\n');
 *
 * // Cleanup
 * await computer.dispose();
 * ```
 */
export function local(config?: LocalConfig): ComputerProvider {
  return {
    id: "local",
    name: "Local (Bun)",

    async create(computerConfig?: ComputerConfig): Promise<Computer> {
      // Determine working directory:
      // - Use explicit workingDirectory if provided
      // - Otherwise, auto-generate under workspaceRoot
      const workspaceRoot = config?.workspaceRoot || "/tmp/bim-ide";
      const workDir =
        computerConfig?.workingDirectory ||
        `${workspaceRoot}/workspace-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

      const computer = new LocalComputer(
        workDir,
        {
          ...computerConfig,
          environment: {
            ...config?.environment,
            ...computerConfig?.environment,
          },
        },
        {
          cleanup: config?.cleanup,
        }
      );

      // Initialize (create directories, etc)
      await computer.init();

      return computer;
    },
  };
}

// Re-export types
export { LocalComputer } from "./computer";
export { LocalFileSystem } from "./filesystem";
