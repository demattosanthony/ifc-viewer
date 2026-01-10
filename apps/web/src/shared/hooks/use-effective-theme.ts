import { useEffect, useState } from "react"
import { useTheme } from "@/shared/components/theme-provider"

/**
 * Resolves the effective theme (light or dark) based on theme setting.
 * Handles "system" theme by checking prefers-color-scheme and listening for changes.
 */
export function useEffectiveTheme() {
  const { theme } = useTheme()
  const [effectiveTheme, setEffectiveTheme] = useState<"light" | "dark">(() => {
    if (theme === "system") {
      return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
    }
    return theme
  })

  useEffect(() => {
    if (theme !== "system") {
      setEffectiveTheme(theme)
      return
    }

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)")
    const handleChange = (e: MediaQueryListEvent) => {
      setEffectiveTheme(e.matches ? "dark" : "light")
    }

    setEffectiveTheme(mediaQuery.matches ? "dark" : "light")
    mediaQuery.addEventListener("change", handleChange)
    return () => mediaQuery.removeEventListener("change", handleChange)
  }, [theme])

  return effectiveTheme
}
