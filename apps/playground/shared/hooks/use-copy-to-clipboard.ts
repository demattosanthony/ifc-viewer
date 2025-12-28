import { useState, useCallback } from "react";

/**
 * Hook for copying text to clipboard with automatic reset
 */
export function useCopyToClipboard(resetTimeout = 2000) {
  const [copied, setCopied] = useState(false);

  const copy = useCallback(
    async (text: string) => {
      try {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), resetTimeout);
        return true;
      } catch (error) {
        console.error("Failed to copy to clipboard:", error);
        return false;
      }
    },
    [resetTimeout]
  );

  return { copied, copy };
}
