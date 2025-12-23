"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { File, Copy, Check } from "lucide-react";
import { codeToHtml } from "shiki";
import { getLanguageFromPath, getFileName } from "./types";

interface FilePreviewProps {
  path: string;
  content: string;
  isStreaming: boolean;
}

// Syntax highlighted code block
function CodeBlock({
  code,
  language,
  isStreaming,
}: {
  code: string;
  language: string;
  isStreaming: boolean;
}) {
  const [highlightedHtml, setHighlightedHtml] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function highlight() {
      if (!code) {
        setHighlightedHtml("");
        return;
      }

      try {
        const html = await codeToHtml(code, {
          lang: language,
          theme: "github-dark",
        });
        if (!cancelled) {
          setHighlightedHtml(html);
        }
      } catch {
        if (!cancelled) {
          setHighlightedHtml(null);
        }
      }
    }

    highlight();
    return () => {
      cancelled = true;
    };
  }, [code, language]);

  return (
    <div className="max-h-80 overflow-auto text-[13px] leading-relaxed">
      {highlightedHtml ? (
        <div
          className="[&>pre]:m-0 [&>pre]:bg-transparent [&>pre]:p-3 [&_code]:bg-transparent"
          dangerouslySetInnerHTML={{ __html: highlightedHtml }}
        />
      ) : (
        <pre className="m-0 bg-transparent p-3">
          <code className="text-foreground/80">{code}</code>
        </pre>
      )}
      {isStreaming && (
        <span className="inline-block h-4 w-0.5 animate-pulse bg-blue-500" />
      )}
    </div>
  );
}

export function FilePreview({ path, content, isStreaming }: FilePreviewProps) {
  const [copied, setCopied] = useState(false);
  const language = useMemo(() => getLanguageFromPath(path), [path]);
  const fileName = useMemo(() => getFileName(path), [path]);

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [content]);

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border bg-secondary/50 px-3 py-1.5">
        <div className="flex items-center gap-2">
          <File className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="font-mono text-xs text-foreground">{fileName}</span>
          <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
            {language}
          </span>
        </div>
        <button
          onClick={handleCopy}
          className="rounded p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          title="Copy code"
        >
          {copied ? (
            <Check className="h-3.5 w-3.5 text-green-500" />
          ) : (
            <Copy className="h-3.5 w-3.5" />
          )}
        </button>
      </div>
      {/* Code */}
      <CodeBlock code={content} language={language} isStreaming={isStreaming} />
    </div>
  );
}
