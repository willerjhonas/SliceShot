/* eslint-disable react-refresh/only-export-components */
import * as React from "react"

type Theme = "dark" | "light" | "system"
type ResolvedTheme = "dark" | "light"

type ThemeProviderProps = {
    children: React.ReactNode
    defaultTheme?: Theme
    storageKey?: string
    disableTransitionOnChange?: boolean
}

type ThemeProviderState = {
    theme: Theme
    setTheme: (theme: Theme) => void
}

const COLOR_SCHEME_QUERY = "(prefers-color-scheme: dark)"
const THEME_VALUES: Theme[] = ["dark", "light", "system"]

const ThemeProviderContext = React.createContext<
    ThemeProviderState | undefined
>(undefined)

function isTheme(value: string | null): value is Theme {
    if (value === null) return false
    return THEME_VALUES.includes(value as Theme)
}

function getSystemTheme(): ResolvedTheme {
    if (window.matchMedia(COLOR_SCHEME_QUERY).matches) return "dark"
    return "light"
}

export function ThemeProvider({
    children,
    defaultTheme = "system",
    storageKey = "theme",
    disableTransitionOnChange = true,
    ...props
}: ThemeProviderProps) {
    const [theme, setThemeState] = React.useState<Theme>(() => {
        const storedTheme = localStorage.getItem(storageKey)
        if (isTheme(storedTheme)) return storedTheme
        return defaultTheme
    })

    const setTheme = React.useCallback(
        (nextTheme: Theme) => {
            localStorage.setItem(storageKey, nextTheme)
            setThemeState(nextTheme)
        },
        [storageKey]
    )

    const applyTheme = React.useCallback(
        (nextTheme: Theme) => {
            const root = document.documentElement
            const resolvedTheme = nextTheme === "system" ? getSystemTheme() : nextTheme
            root.classList.remove("light", "dark")
            root.classList.add(resolvedTheme)
        },
        []
    )

    React.useEffect(() => {
        applyTheme(theme)
        if (theme !== "system") return undefined
        const mediaQuery = window.matchMedia(COLOR_SCHEME_QUERY)
        const handleChange = () => applyTheme("system")
        mediaQuery.addEventListener("change", handleChange)
        return () => mediaQuery.removeEventListener("change", handleChange)
    }, [theme, applyTheme])

    // Custom Shortcut 'D' for Theme Toggle
    React.useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key.toLowerCase() === 'd' && !['INPUT', 'TEXTAREA'].includes((event.target as HTMLElement).tagName)) {
                setThemeState((prev) => (prev === 'dark' ? 'light' : 'dark'))
            }
        }
        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [])

    const value = React.useMemo(() => ({ theme, setTheme }), [theme, setTheme])

    return (
        <ThemeProviderContext.Provider {...props} value={value}>
            {children}
        </ThemeProviderContext.Provider>
    )
}

export const useTheme = () => {
    const context = React.useContext(ThemeProviderContext)
    if (context === undefined) throw new Error("useTheme must be used within a ThemeProvider")
    return context
}
