"use client";

import { useState } from "react";
import {
  CheckCircle2,
  XCircle,
  ChevronDown,
  Loader2,
  Copy,
  Check,
} from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@ifc-viewer/ui/components";
import { cn } from "@ifc-viewer/ui/lib";
import { useCopyToClipboard } from "@/hooks/use-copy-to-clipboard";

interface CommandPreviewProps {
  title?: string;
  command: string;
  output?: Record<string, unknown>;
  isStreaming: boolean;
  isComplete: boolean;
  error?: string;
}

/**
 * Clean up output for display - remove prompt lines and common noise.
 */
function cleanOutput(output: string): string {
  return output
    .split("\n")
    .filter((line) => {
      // Remove prompt lines
      if (line.includes("/workspace $") || line.includes("/workspace$")) {
        return false;
      }
      // Remove command echo with marker
      if (line.includes("<<CMD_DONE:")) {
        return false;
      }
      return true;
    })
    .join("\n")
    .trim();
}

export function CommandPreview({
  title,
  command,
  output,
  isStreaming,
  isComplete,
  error,
}: CommandPreviewProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { copied, copy } = useCopyToClipboard();

  // Extract output details
  const result = output as
    | { success?: boolean; output?: string; exitCode?: number }
    | undefined;

  const rawOutput = result?.output || "";
  const cleanedOutput = cleanOutput(rawOutput);
  const hasOutput = cleanedOutput.length > 0;

  // Use provided title or fallback to command
  const displayTitle = title || command;
  const isSuccess = isComplete && result?.success !== false;
  const isError = isComplete && (result?.success === false || error);
  const isRunning = !isComplete || isStreaming;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div
        className={cn(
          "overflow-hidden rounded-lg border transition-colors",
          isError
            ? "border-red-500/30 bg-red-500/5"
            : "border-border bg-card"
        )}
      >
        {/* Compact Header - Always visible */}
        <CollapsibleTrigger asChild>
          <button
            className={cn(
              "flex w-full items-center justify-between px-3 py-2 text-left transition-colors",
              "hover:bg-secondary/50",
              isOpen && "border-b border-border"
            )}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              {/* Status Icon */}
              {isRunning ? (
                <Loader2 className="h-4 w-4 shrink-0 animate-spin text-blue-500" />
              ) : isSuccess ? (
                <CheckCircle2 className="h-4 w-4 shrink-0 text-green-500" />
              ) : (
                <XCircle className="h-4 w-4 shrink-0 text-red-500" />
              )}

              {/* Title */}
              <span className="text-sm text-foreground truncate">
                {displayTitle}
              </span>
            </div>

            {/* Expand indicator */}
            {(hasOutput || error) && (
              <ChevronDown
                className={cn(
                  "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
                  isOpen && "rotate-180"
                )}
              />
            )}
          </button>
        </CollapsibleTrigger>

        {/* Expandable Details */}
        <CollapsibleContent>
          <div className="space-y-0">
            {/* Command (for power users) */}
            <div className="flex items-center justify-between border-b border-border/50 bg-secondary/30 px-3 py-1.5">
              <code className="font-mono text-xs text-muted-foreground truncate">
                <span className="text-green-500/70">$</span> {command}
              </code>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  copy(command);
                }}
                className="rounded p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                title="Copy command"
              >
                {copied ? (
                  <Check className="h-3 w-3 text-green-500" />
                ) : (
                  <Copy className="h-3 w-3" />
                )}
              </button>
            </div>

            {/* Output */}
            {hasOutput && (
              <div className="max-h-48 overflow-auto p-3">
                <pre className="whitespace-pre-wrap font-mono text-xs text-muted-foreground leading-relaxed">
                  {cleanedOutput}
                </pre>
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="bg-red-500/5 p-3">
                <pre className="whitespace-pre-wrap font-mono text-xs text-red-400">
                  {error}
                </pre>
              </div>
            )}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
