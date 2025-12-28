/**
 * Worker utility for fragments
 *
 * This file provides a development fallback.
 * In production builds, the actual worker code is bundled separately.
 */

let cachedWorkerUrl: string | null = null;

/**
 * Returns a Blob URL for the fragments worker.
 * The URL is cached after first creation.
 *
 * Note: In development mode without a bundled worker, this will throw.
 * Pass workerUrl prop to ViewerProvider for development use.
 */
export function getFragmentsWorkerUrl(): string {
  if (cachedWorkerUrl) {
    return cachedWorkerUrl;
  }

  // This will be replaced by the actual bundled worker in production builds.
  // During development, this error guides users to pass workerUrl manually.
  throw new Error(
    "Bundled worker not available. " +
      "In development mode, pass the workerUrl prop to ViewerProvider. " +
      "In production, the bundled worker will be used automatically."
  );
}
