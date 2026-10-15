import { useTheme } from 'tamagui'

// resolved theme colors for components that need raw values, like SVG
export function usePalette() {
  const theme = useTheme()
  const val = (key: string, fallback: string) => String(theme[key]?.val ?? fallback)
  return {
    accent: val('accent-background', '#3690F7'),
    ink: val('color', '#E7E9ED'),
    surface: val('background', '#111318'),
    stop: val('stop-text', '#FB923C'),
  }
}
