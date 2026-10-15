import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from "expo-router";
import { useColorScheme } from "react-native";
import { TamaguiProvider } from "tamagui";

import { tamaguiConfig } from "../../tamagui.config";

export default function RootLayout() {
  // useColorScheme can return "unspecified", which is not a theme name
  const theme = useColorScheme() === "dark" ? "dark" : "light";

  return (
    <TamaguiProvider config={tamaguiConfig} defaultTheme={theme}>
      <ThemeProvider value={theme === "dark" ? DarkTheme : DefaultTheme}>
        <Stack />
      </ThemeProvider>
    </TamaguiProvider>
  );
}
