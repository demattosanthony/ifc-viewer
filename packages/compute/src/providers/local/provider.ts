import type { SandboxProvider, SandboxConfig, Sandbox } from "../../sandbox";
import { createLocalSandbox } from "./sandbox";

/**
 * Configuration for the local sandbox provider
 */
export interface LocalSandboxProviderConfig {
  /** Default environment variables for all sandboxes */
  defaultEnvironment?: Record<string, string>;
  /** Default URL mode for storage ('none' | 'data') */
  defaultStorageUrlMode?: "none" | "data";
}

/**
 * Provider for creating local sandboxes
 */
export class LocalSandboxProvider implements SandboxProvider {
  readonly type = "local";
  readonly name = "Local Sandbox (Bun)";

  private readonly config: LocalSandboxProviderConfig;

  constructor(config: LocalSandboxProviderConfig = {}) {
    this.config = config;
  }

  async create(sandboxConfig: SandboxConfig): Promise<Sandbox> {
    return createLocalSandbox({
      workingDirectory: sandboxConfig.workingDirectory,
      environment: {
        ...this.config.defaultEnvironment,
        ...sandboxConfig.environment,
      },
      storageUrlMode:
        sandboxConfig.storageUrlMode ?? this.config.defaultStorageUrlMode,
    });
  }
}

/**
 * Create a local sandbox provider
 *
 * @example
 * ```ts
 * const provider = localSandboxProvider();
 * const sandbox = await provider.create({
 *   workingDirectory: '/tmp/my-sandbox',
 * });
 * ```
 */
export function localSandboxProvider(
  config?: LocalSandboxProviderConfig
): LocalSandboxProvider {
  return new LocalSandboxProvider(config);
}
