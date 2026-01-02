import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { readFile } from "@ifc-viewer/sdk";
import { readFileQueryKey } from "@ifc-viewer/sdk/hooks";
import { useEditor } from "../context";
import { CodeEditor } from "./viewers/code-editor";
import { IFCViewer } from "./viewers/ifc-viewer";
import { HtmlViewer } from "./viewers/html-viewer";
import { PdfViewer } from "./viewers/pdf-viewer";

interface EditorPaneProps {
  workspaceId: string;
  onShowTerminal?: () => void;
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

export function EditorPane({ workspaceId }: EditorPaneProps) {
  const { tabs, activeTabId, getFileContent, setFileContent } = useEditor();

  const activeTab = tabs.find((t) => t.id === activeTabId);
  const shouldFetchContent =
    activeTab && activeTab.type !== "ifc" && !getFileContent(activeTab.path);

  // Query for file content (non-IFC files only)
  const contentQuery = useQuery({
    queryKey: readFileQueryKey({
      path: { id: workspaceId },
      query: { path: activeTab?.path ?? "" },
    }),
    queryFn: async () => {
      const { data } = await readFile({
        path: { id: workspaceId },
        query: { path: activeTab!.path },
      });
      return data;
    },
    enabled: !!shouldFetchContent,
    staleTime: 30000,
  });

  // Update editor context when content is fetched (only if not already cached)
  useEffect(() => {
    if (contentQuery.data && activeTab && !getFileContent(activeTab.path)) {
      setFileContent(activeTab.path, {
        // SDK generates `type: string` but API always returns "text" | "binary"
        type: contentQuery.data.type as "text" | "binary",
        content: contentQuery.data.content,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contentQuery.data]);

  if (!activeTab) {
    return <EmptyState />;
  }

  // IFC has its own loading mechanism
  if (activeTab.type === "ifc") {
    return <IFCViewer workspaceId={workspaceId} filePath={activeTab.path} />;
  }

  const content = getFileContent(activeTab.path);

  if (contentQuery.isLoading || !content) {
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
          workspaceId={workspaceId}
          path={activeTab.path}
          tabId={activeTab.id}
          content={content.content}
          filename={activeTab.name}
        />
      );
  }
}
