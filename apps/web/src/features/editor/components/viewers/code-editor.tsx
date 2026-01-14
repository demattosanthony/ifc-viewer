import { writeProjectFileMutation } from "@ifc-viewer/sdk/hooks"
import Editor, { loader, type OnMount } from "@monaco-editor/react"
import { useMutation } from "@tanstack/react-query"
import { useCallback, useEffect, useRef } from "react"
import { useEffectiveTheme } from "@/shared/hooks"
import { useEditor } from "../../context"

function getLanguage(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase()
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
  }
  return languageMap[ext || ""] || "plaintext"
}

// Define custom themes that match our globals.css color palette
loader.init().then((monaco) => {
  monaco.editor.defineTheme("ifc-light", {
    base: "vs",
    inherit: true,
    rules: [],
    colors: {
      "editor.background": "#f8f7f2",
      "editor.foreground": "#3d3d3d",
      "editorLineNumber.foreground": "#9a9a8f",
      "editorLineNumber.activeForeground": "#5a5a52",
      "editor.selectionBackground": "#d4d3c8",
      "editor.lineHighlightBackground": "#f0efe8",
      "editorCursor.foreground": "#3d3d3d",
      "editorWhitespace.foreground": "#d4d3c8",
      "editorIndentGuide.background": "#e8e7e0",
      "editorIndentGuide.activeBackground": "#d4d3c8",
      "editor.selectionHighlightBackground": "#e8e7d8",
      "editorGutter.background": "#f8f7f2",
      "minimap.background": "#f8f7f2",
    },
  })

  monaco.editor.defineTheme("ifc-dark", {
    base: "vs-dark",
    inherit: true,
    rules: [],
    colors: {
      "editor.background": "#1a1a18",
      "editor.foreground": "#e5e5e5",
      "editorLineNumber.foreground": "#5a5a52",
      "editorLineNumber.activeForeground": "#8f8f85",
      "editor.selectionBackground": "#3a3a35",
      "editor.lineHighlightBackground": "#222220",
      "editorCursor.foreground": "#fafafa",
      "editorWhitespace.foreground": "#3a3a35",
      "editorIndentGuide.background": "#2a2a26",
      "editorIndentGuide.activeBackground": "#3a3a35",
      "editor.selectionHighlightBackground": "#2a2a26",
      "editorGutter.background": "#1a1a18",
      "minimap.background": "#1a1a18",
    },
  })
})

export interface CodeEditorProps {
  projectId: string
  path: string
  tabId: string
  content: string
  filename: string
}

export function CodeEditor({ projectId, path, tabId, content, filename }: CodeEditorProps) {
  const { setTabDirty, updateFileContent, getFileContent } = useEditor()
  const originalContentRef = useRef(content)
  const saveRef = useRef<() => Promise<void> | undefined>(undefined)
  const effectiveTheme = useEffectiveTheme()

  const saveMutation = useMutation({
    ...writeProjectFileMutation(),
    onSuccess: () => {
      const currentContent = getFileContent(path)
      if (currentContent) {
        originalContentRef.current = currentContent.content
      }
      setTabDirty(tabId, false)
    },
    onError: (err) => {
      console.error("Failed to save file:", err)
    },
  })

  // Update original content when file is loaded fresh
  useEffect(() => {
    originalContentRef.current = content
  }, [content])

  // Keep save function in ref so keyboard shortcut always uses latest
  useEffect(() => {
    saveRef.current = async () => {
      const currentContent = getFileContent(path)
      if (!currentContent) return

      saveMutation.mutate({
        path: { id: projectId },
        body: { path, content: currentContent.content },
      })
    }
  }, [projectId, path, getFileContent, saveMutation])

  const handleEditorMount: OnMount = useCallback((editor, monaco) => {
    // Add Ctrl+S / Cmd+S keybinding
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      saveRef.current?.()
    })
  }, [])

  const handleChange = useCallback(
    (value: string | undefined) => {
      if (value === undefined) return
      updateFileContent(path, value)
      const isDirty = value !== originalContentRef.current
      setTabDirty(tabId, isDirty)
    },
    [path, tabId, updateFileContent, setTabDirty]
  )

  return (
    <div className="h-full relative">
      <Editor
        height="100%"
        language={getLanguage(filename)}
        value={content}
        theme={effectiveTheme === "dark" ? "ifc-dark" : "ifc-light"}
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
      {saveMutation.isPending && (
        <div className="absolute top-2 right-4 px-2 py-1 bg-primary text-primary-foreground text-xs rounded">
          Saving...
        </div>
      )}
    </div>
  )
}
