import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from "expo-router";
import { useKeepAwake } from "expo-keep-awake";
import { StatusBar } from "expo-status-bar";
import { useColorScheme } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { TamaguiProvider } from "tamagui";

import { RosProvider } from "@/ros/RosProvider";

import { tamaguiConfig } from "../../tamagui.config";

export default function RootLayout() {
  // a controller should never let the tablet sleep mid-drive
  useKeepAwake();
  // useColorScheme can return "unspecified", which is not a theme name
  const theme = useColorScheme() === "dark" ? "dark" : "light";

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <TamaguiProvider config={tamaguiConfig} defaultTheme={theme}>
        <ThemeProvider value={theme === "dark" ? DarkTheme : DefaultTheme}>
          <RosProvider>
            <StatusBar hidden />
            <Stack screenOptions={{ headerShown: false, animation: "fade" }} />
          </RosProvider>
        </ThemeProvider>
      </TamaguiProvider>
    </GestureHandlerRootView>
  );
}
