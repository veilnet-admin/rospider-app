import { Redirect, Slot } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { YStack } from "tamagui";

import { NetworkPath } from "@/components/NetworkPath";
import { TopBar } from "@/components/TopBar";
import { useBridgeStatus } from "@/ros/RosProvider";

export default function ControlLayout() {
  const status = useBridgeStatus();
  // keep the network strip clear of the system gesture bar
  const { bottom } = useSafeAreaInsets();

  // control screens need a robot; the connect screen is the way in
  if (status === "idle") return <Redirect href="/" />;

  return (
    <YStack flex={1} bg="background">
      <TopBar />
      <YStack flex={1} minH={0}>
        <Slot />
      </YStack>
      <YStack pb={bottom} bg="background">
        <NetworkPath />
      </YStack>
    </YStack>
  );
}
