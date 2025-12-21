import { useEffect, useState, useCallback, useRef } from "react";
import { useEditor } from "@/lib/editor-context";
import { useViewer } from "ifc-viewer";
import { api } from "@/.bunbox/api-client";
import Editor from "@monaco-editor/react";

interface EditorPaneProps {
  sessionId: string;
}

function getLanguage(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase();
  const languageMap: Record<string, string> = {
    js: "javascript",
    jsx: "javascript",
    ts: "typescript",
    tsx: "typescript",
    py: "python",
    json: "json",
    html: "html",
    htm: "html",
    css: "css",
    scss: "scss",
    md: "markdown",
    xml: "xml",
    yaml: "yaml",
    yml: "yaml",
    sh: "shell",
    bash: "shell",
  };
  return languageMap[ext || ""] || "plaintext";
}

function EmptyState() {
  return (
    <div className="flex-1 flex items-center justify-center bg-[#1e1e1e] text-[#858585]">
      <div className="text-center">
        <p className="text-sm">No file open</p>
        <p className="text-xs mt-1">Select a file from the explorer</p>
      </div>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="flex-1 flex items-center justify-center bg-[#1e1e1e] text-[#858585]">
      <p className="text-sm">Loading...</p>
    </div>
  );
}

function CodeEditor({ content, filename }: { content: string; filename: string }) {
  return (
    <Editor
      height="100%"
      language={getLanguage(filename)}
      value={content}
      theme="vs-dark"
      options={{
        readOnly: true,
        minimap: { enabled: true },
        fontSize: 13,
        lineNumbers: "on",
        scrollBeyondLastLine: false,
        automaticLayout: true,
        padding: { top: 8 },
      }}
    />
  );
}

function IFCViewer({ sessionId, filePath }: { sessionId: string; filePath: string }) {
  const { loadModel, unloadAllModels, isInitialized } = useViewer();
  const loadedPathRef = useRef<string | null>(null);
  const loadingRef = useRef(false);

  useEffect(() => {
    if (!isInitialized) return;
    if (loadingRef.current) return;
    if (loadedPathRef.current === filePath) return;

    loadingRef.current = true;

    const load = async () => {
      try {
        await unloadAllModels();

        const data = await api.sessions.files.content.readFile({
          id: sessionId,
          path: filePath,
        }) as { type: string; content: string; path: string };

        let buffer: ArrayBuffer;
        if (data.type === "binary") {
          const binary = atob(data.content);
          buffer = new ArrayBuffer(binary.length);
          const view = new Uint8Array(buffer);
          for (let i = 0; i < binary.length; i++) {
            view[i] = binary.charCodeAt(i);
          }
        } else {
          const encoder = new TextEncoder();
          buffer = encoder.encode(data.content).buffer;
        }

        const filename = filePath.split("/").pop() || "model.ifc";
        await loadModel(buffer, filename);
        loadedPathRef.current = filePath;
      } catch (err) {
        console.error("Failed to load IFC:", err);
      } finally {
        loadingRef.current = false;
      }
    };

    load();
  }, [isInitialized, filePath, sessionId, loadModel, unloadAllModels]);

  return null;
}

export function EditorPane({ sessionId }: EditorPaneProps) {
  const { tabs, activeTabId, getFileContent, setFileContent } = useEditor();
  const [loading, setLoading] = useState(false);

  const activeTab = tabs.find((t) => t.id === activeTabId);

  const fetchContent = useCallback(async (path: string) => {
    if (getFileContent(path)) return;

    setLoading(true);
    try {
      const data = await api.sessions.files.content.readFile({
        id: sessionId,
        path,
      }) as { type: "text" | "binary"; content: string; path: string };
      setFileContent(path, { type: data.type, content: data.content });
    } catch (err) {
      console.error("Failed to fetch file:", err);
    } finally {
      setLoading(false);
    }
  }, [sessionId, getFileContent, setFileContent]);

  useEffect(() => {
    if (activeTab && activeTab.type === "code") {
      fetchContent(activeTab.path);
    }
  }, [activeTab, fetchContent]);

  if (!activeTab) {
    return <EmptyState />;
  }

  if (activeTab.type === "ifc") {
    return <IFCViewer sessionId={sessionId} filePath={activeTab.path} />;
  }

  const content = getFileContent(activeTab.path);

  if (loading || !content) {
    return <LoadingState />;
  }

  return <CodeEditor content={content.content} filename={activeTab.name} />;
}
