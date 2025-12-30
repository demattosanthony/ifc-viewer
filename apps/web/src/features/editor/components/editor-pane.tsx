import { useEffect, useState, useCallback } from "react";
import { useEditor } from "../context";
import { api } from "@/lib/api";
import { CodeEditor } from "./viewers/code-editor";
import { IFCViewer } from "./viewers/ifc-viewer";
import { HtmlViewer } from "./viewers/html-viewer";
import { PdfViewer } from "./viewers/pdf-viewer";

interface EditorPaneProps {
  sessionId: string;
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

export function EditorPane({ sessionId }: EditorPaneProps) {
  const { tabs, activeTabId, getFileContent, setFileContent } = useEditor();
  const [loading, setLoading] = useState(false);

  const activeTab = tabs.find((t) => t.id === activeTabId);

  const fetchContent = useCallback(
    async (path: string) => {
      if (getFileContent(path)) return;

      setLoading(true);
      try {
        const data = (await api.sessions.files.content.readFile({
          id: sessionId,
          path,
        })) as { type: "text" | "binary"; content: string; path: string };
        setFileContent(path, { type: data.type, content: data.content });
      } catch (err) {
        console.error("Failed to fetch file:", err);
      } finally {
        setLoading(false);
      }
    },
    [sessionId, getFileContent, setFileContent]
  );

  // Fetch content for non-IFC files (IFC handles its own loading)
  useEffect(() => {
    if (activeTab && activeTab.type !== "ifc") {
      fetchContent(activeTab.path);
    }
  }, [activeTab, fetchContent]);

  if (!activeTab) {
    return <EmptyState />;
  }

  // IFC has its own loading mechanism
  if (activeTab.type === "ifc") {
    return <IFCViewer sessionId={sessionId} filePath={activeTab.path} />;
  }

  const content = getFileContent(activeTab.path);

  if (loading || !content) {
    return <LoadingState />;
  }

  // Render appropriate viewer based on tab type
  switch (activeTab.type) {
    case "html":
      return (
        <HtmlViewer
          content={content.content}
          contentType={content.type}
          filename={activeTab.name}
        />
      );

    case "pdf":
      return (
        <PdfViewer
          content={content.content}
          contentType={content.type}
          filename={activeTab.name}
        />
      );

    case "code":
    default:
      return (
        <CodeEditor
          sessionId={sessionId}
          path={activeTab.path}
          tabId={activeTab.id}
          content={content.content}
          filename={activeTab.name}
        />
      );
  }
}
