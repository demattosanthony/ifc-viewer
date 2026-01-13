import { createContext, type ReactNode, useCallback, useContext, useEffect, useState } from "react"

export type AppMode = "viewer" | "editor"

interface AppModeContextValue {
  mode: AppMode
  setMode: (mode: AppMode) => void
}

const STORAGE_KEY = "ifc-viewer:app-mode"

const AppModeContext = createContext<AppModeContextValue | null>(null)

function getInitialMode(): AppMode {
  if (typeof window === "undefined") return "editor"
  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored === "viewer" || stored === "editor") {
    return stored
  }
  return "editor"
}

interface AppModeProviderProps {
  children: ReactNode
}

export function AppModeProvider({ children }: AppModeProviderProps) {
  const [mode, setModeState] = useState<AppMode>(getInitialMode)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, mode)
  }, [mode])

  const setMode = useCallback((newMode: AppMode) => {
    setModeState(newMode)
  }, [])

  return <AppModeContext.Provider value={{ mode, setMode }}>{children}</AppModeContext.Provider>
}

export function useAppMode(): AppModeContextValue {
  const context = useContext(AppModeContext)
  if (!context) {
    throw new Error("useAppMode must be used within an AppModeProvider")
  }
  return context
}
