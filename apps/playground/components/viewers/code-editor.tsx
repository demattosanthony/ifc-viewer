import { useEffect, useState, useCallback, useRef } from "react";
import { useEditor } from "@/lib/editor-context";
import { api } from "@/.bunbox/api-client";
import Editor, { type OnMount } from "@monaco-editor/react";

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

export interface CodeEditorProps {
  sessionId: string;
  path: string;
  tabId: string;
  content: string;
  filename: string;
}

export function CodeEditor({
  sessionId,
  path,
  tabId,
  content,
  filename,
}: CodeEditorProps) {
  const { setTabDirty, updateFileContent, getFileContent } = useEditor();
  const [saving, setSaving] = useState(false);
  const originalContentRef = useRef(content);
  const saveRef = useRef<() => Promise<void> | undefined>(undefined);

  // Update original content when file is loaded fresh
  useEffect(() => {
    originalContentRef.current = content;
  }, [path, content]);

  // Keep save function in ref so keyboard shortcut always uses latest
  useEffect(() => {
    saveRef.current = async () => {
      const currentContent = getFileContent(path);
      if (!currentContent) return;

      setSaving(true);
      try {
        await api.sessions.files.content.writeFile({
          id: sessionId,
          path,
          content: currentContent.content,
          encoding: "text",
        });
        originalContentRef.current = currentContent.content;
        setTabDirty(tabId, false);
      } catch (err) {
        console.error("Failed to save file:", err);
      } finally {
        setSaving(false);
      }
    };
  }, [sessionId, path, tabId, getFileContent, setTabDirty]);

  const handleEditorMount: OnMount = useCallback((editor, monaco) => {
    // Add Ctrl+S / Cmd+S keybinding
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      saveRef.current?.();
    });
  }, []);

  const handleChange = useCallback(
    (value: string | undefined) => {
      if (value === undefined) return;
      updateFileContent(path, value);
      const isDirty = value !== originalContentRef.current;
      setTabDirty(tabId, isDirty);
    },
    [path, tabId, updateFileContent, setTabDirty]
  );

  return (
    <div className="h-full relative">
      <Editor
        height="100%"
        language={getLanguage(filename)}
        value={content}
        theme="vs-dark"
        onChange={handleChange}
        onMount={handleEditorMount}
        options={{
          minimap: { enabled: true },
          fontSize: 13,
          lineNumbers: "on",
          scrollBeyondLastLine: false,
          automaticLayout: true,
          padding: { top: 8 },
        }}
      />
      {saving && (
        <div className="absolute top-2 right-4 px-2 py-1 bg-[#007acc] text-white text-xs rounded">
          Saving...
        </div>
      )}
    </div>
  );
}
