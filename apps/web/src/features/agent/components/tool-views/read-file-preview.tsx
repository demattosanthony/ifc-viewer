"use client";

import { useState, useMemo } from "react";
import { ChevronDown, Copy, Check } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@ifc-viewer/ui/components";
import { cn } from "@ifc-viewer/ui/lib";
import { getFileName } from "./types";
import { useCopyToClipboard } from "@/hooks/use-copy-to-clipboard";

interface ReadFilePreviewProps {
  path: string;
  result?: { success?: boolean; content?: string; error?: string };
  isStreaming: boolean;
  isComplete: boolean;
}

export function ReadFilePreview({
  path,
  result,
  isStreaming,
  isComplete,
}: ReadFilePreviewProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { copied, copy } = useCopyToClipboard();

  const fileName = useMemo(() => getFileName(path), [path]);

  const content = result?.content || "";
  const hasContent = content.length > 0;
  const isError = isComplete && result?.success === false;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div
        className={cn(
          "overflow-hidden rounded-lg border transition-colors",
          isError ? "border-red-500/30 bg-red-500/5" : "border-border bg-card"
        )}
      >
        {/* Compact Header */}
        <CollapsibleTrigger asChild>
          <button
            className={cn(
              "flex w-full items-center justify-between px-3 py-2 text-left transition-colors",
              "hover:bg-secondary/50",
              isOpen && "border-b border-border"
            )}
          >
            <span className="text-sm text-foreground truncate">
              Read {fileName}
            </span>

            {/* Expand indicator */}
            {(hasContent || isError) && (
              <ChevronDown
                className={cn(
                  "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
                  isOpen && "rotate-180"
                )}
              />
            )}
          </button>
        </CollapsibleTrigger>

        {/* Expandable Content */}
        <CollapsibleContent>
          {/* File content */}
          {hasContent && (
            <div className="relative">
              {/* Copy button */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  copy(content);
                }}
                className="absolute right-2 top-2 z-10 rounded p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                title="Copy content"
              >
                {copied ? (
                  <Check className="h-3.5 w-3.5 text-green-500" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
              </button>

              {/* Code content */}
              <div className="max-h-60 overflow-y-auto p-3 pr-10">
                <pre className="whitespace-pre-wrap break-words font-mono text-xs text-muted-foreground leading-relaxed">
                  {content}
                </pre>
              </div>
            </div>
          )}

          {/* Error */}
          {isError && result?.error && (
            <div className="bg-red-500/5 p-3">
              <pre className="whitespace-pre-wrap font-mono text-xs text-red-400">
                {result.error}
              </pre>
            </div>
          )}
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
