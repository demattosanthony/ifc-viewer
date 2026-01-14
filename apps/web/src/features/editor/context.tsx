import { createContext, type ReactNode, useCallback, useContext, useState } from "react"
import type { FileContent, ViewerType } from "./utils/types"
import { getViewerType } from "./utils/viewer-registry"

export type { FileContent, ViewerType }

export interface Tab {
  id: string
  path: string
  name: string
  type: ViewerType
  activeViewer?: ViewerType // User-selected viewer override
  isDirty?: boolean
}

interface EditorContextValue {
  tabs: Tab[]
  activeTabId: string | null
  fileContents: Map<string, FileContent>
  openFile: (path: string) => void
  closeTab: (tabId: string) => void
  setActiveTab: (tabId: string | null) => void
  getFileContent: (path: string) => FileContent | undefined
  setFileContent: (path: string, content: FileContent) => void
  setTabDirty: (tabId: string, isDirty: boolean) => void
  updateFileContent: (path: string, content: string) => void
  setTabViewer: (tabId: string, viewerType: ViewerType) => void
}

const EditorContext = createContext<EditorContextValue | null>(null)

function getFileName(path: string): string {
  return path.split("/").pop() || path
}

function generateTabId(path: string): string {
  return `tab-${path.replace(/[^a-zA-Z0-9]/g, "-")}`
}

interface EditorProviderProps {
  children: ReactNode
  initialFile?: string
}

export function EditorProvider({ children, initialFile }: EditorProviderProps) {
  const [tabs, setTabs] = useState<Tab[]>(() => {
    if (!initialFile) return []
    const name = getFileName(initialFile)
    return [
      {
        id: generateTabId(initialFile),
        path: initialFile,
        name,
        type: getViewerType(name),
      },
    ]
  })

  const [activeTabId, setActiveTabId] = useState<string | null>(
    initialFile ? generateTabId(initialFile) : null
  )

  const [fileContents, setFileContents] = useState<Map<string, FileContent>>(new Map())

  const openFile = useCallback(
    (path: string) => {
      const existingTab = tabs.find((t) => t.path === path)

      if (existingTab) {
        setActiveTabId(existingTab.id)
        return
      }

      const name = getFileName(path)
      const newTab: Tab = {
        id: generateTabId(path),
        path,
        name,
        type: getViewerType(name),
      }

      setTabs((prev) => [...prev, newTab])
      setActiveTabId(newTab.id)
    },
    [tabs]
  )

  const closeTab = useCallback(
    (tabId: string) => {
      setTabs((prev) => {
        const idx = prev.findIndex((t) => t.id === tabId)
        const newTabs = prev.filter((t) => t.id !== tabId)

        if (activeTabId === tabId && newTabs.length > 0) {
          const newIdx = Math.min(idx, newTabs.length - 1)
          setActiveTabId(newTabs[newIdx]?.id ?? null)
        } else if (newTabs.length === 0) {
          setActiveTabId(null)
        }

        return newTabs
      })
    },
    [activeTabId]
  )

  const setActiveTab = useCallback((tabId: string | null) => {
    setActiveTabId(tabId)
  }, [])

  const getFileContent = useCallback(
    (path: string) => {
      return fileContents.get(path)
    },
    [fileContents]
  )

  const setFileContent = useCallback((path: string, content: FileContent) => {
    setFileContents((prev) => new Map(prev).set(path, content))
  }, [])

  const setTabDirty = useCallback((tabId: string, isDirty: boolean) => {
    setTabs((prev) => prev.map((tab) => (tab.id === tabId ? { ...tab, isDirty } : tab)))
  }, [])

  const setTabViewer = useCallback((tabId: string, viewerType: ViewerType) => {
    setTabs((prev) =>
      prev.map((tab) => (tab.id === tabId ? { ...tab, activeViewer: viewerType } : tab))
    )
  }, [])

  const updateFileContent = useCallback((path: string, content: string) => {
    setFileContents((prev) => {
      const existing = prev.get(path)
      if (!existing) return prev
      return new Map(prev).set(path, { ...existing, content })
    })
  }, [])

  return (
    <EditorContext.Provider
      value={{
        tabs,
        activeTabId,
        fileContents,
        openFile,
        closeTab,
        setActiveTab,
        getFileContent,
        setFileContent,
        setTabDirty,
        updateFileContent,
        setTabViewer,
      }}
    >
      {children}
    </EditorContext.Provider>
  )
}

export function useEditor() {
  const ctx = useContext(EditorContext)
  if (!ctx) throw new Error("useEditor must be used within EditorProvider")
  return ctx
}
