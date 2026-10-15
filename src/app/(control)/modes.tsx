import { useEffect, useState } from "react";
import { Text, View, XStack, YStack } from "tamagui";

import { PrimaryButton, SecondaryButton } from "@/components/Buttons";
import { MjpegView } from "@/components/MjpegView";
import { Muted, Panel, PanelTitle } from "@/components/Panel";
import { ValueSlider } from "@/components/ValueSlider";
import { useThrottled } from "@/hooks/useThrottled";
import type { LidarBehavior, ModeId } from "@/ros/robot";
import { useRos } from "@/ros/RosProvider";

type Mode = {
  id: ModeId;
  name: string;
  description: string;
  kind: "color" | "lidar" | "plain" | "trajectory";
  feed?: string;
  hint?: string;
};

const MODES: Mode[] = [
  { id: "line", name: "Line following", description: "Follows a colored line on the floor", kind: "color", feed: "/line_following/image_result", hint: "Tap the line to set its color" },
  { id: "kick", name: "Intelligent kick", description: "Walks up to a colored ball and kicks it", kind: "color", feed: "/intelligent_kick/image_result", hint: "Tap the ball to set its color" },
  { id: "lidar", name: "LiDAR", description: "Avoids, follows or guards with the LD19", kind: "lidar" },
  { id: "balance", name: "Self-balancing", description: "Keeps the body level as the ground tilts", kind: "plain", hint: "Tilt the surface under the robot. The body stays level." },
  { id: "gesture", name: "Hand gesture", description: "Reacts to hand gestures at the camera", kind: "plain", hint: "Show a hand gesture to the depth camera." },
  { id: "trajectory", name: "Hand trajectory", description: "Walks the path your hand draws", kind: "trajectory", feed: "/hand_trajectory/image_result" },
];

const LIDAR_BEHAVIORS: { value: LidarBehavior; label: string; caption: string }[] = [
  { value: 1, label: "Avoid", caption: "Walks and steers around obstacles" },
  { value: 2, label: "Follow", caption: "Keeps its distance behind the nearest object" },
  { value: 3, label: "Guard", caption: "Stays put and turns to face what approaches" },
];

export default function Modes() {
  const { robot, activeMode, enterMode, exitMode, videoUrl, stopped } = useRos();
  const [running, setRunning] = useState(false);
  const [busy, setBusy] = useState<ModeId | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [behavior, setBehavior] = useState<LidarBehavior>(1);
  const [tolerance, setTolerance] = useState(0.5);
  const [targetRgb, setTargetRgb] = useState<string | null>(null);

  const mode = MODES.find((m) => m.id === activeMode) ?? null;

  useEffect(() => {
    if (!activeMode) setRunning(false);
    setTargetRgb(null);
  }, [activeMode]);

  const start = async (next: Mode) => {
    setBusy(next.id);
    setError(null);
    try {
      await enterMode(next.id);
      if (next.kind === "lidar") await robot.setLidarBehavior(behavior);
      else if (next.kind !== "trajectory") await robot.setModeRunning(next.id, true);
      setRunning(next.kind !== "trajectory");
    } catch (e) {
      setError(`${next.name} did not start: ${e instanceof Error ? e.message : "unknown error"}`);
    } finally {
      setBusy(null);
    }
  };

  const togglePause = async () => {
    if (!mode) return;
    const next = !running;
    try {
      if (mode.kind === "lidar") await robot.setLidarBehavior(next ? behavior : 0);
      else await robot.setModeRunning(mode.id, next);
      setRunning(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed");
    }
  };

  const pickBehavior = async (value: LidarBehavior) => {
    setBehavior(value);
    if (running) await robot.setLidarBehavior(value).catch(() => {});
  };

  const sendTolerance = useThrottled((id: "line" | "kick", value: number) => {
    robot.setColorThreshold(id, value).catch(() => {});
  }, 200);

  const pickColor = (x: number, y: number) => {
    if (!mode || mode.kind !== "color") return;
    const id = mode.id as "line" | "kick";
    robot
      .setTargetPoint(id, x, y)
      .then(() => new Promise((resolve) => setTimeout(resolve, 1200)))
      .then(() => robot.getTargetColor(id))
      .then((res) => {
        if (res.success) setTargetRgb(`rgb(${res.message})`);
      })
      .catch(() => {});
  };

  return (
    <XStack flex={1} gap="4" p="4">
      <YStack w={360} gap="2">
        {MODES.map((m) => {
          const active = m.id === activeMode;
          return (
            <XStack
              key={m.id}
              theme={active ? "accent" : "level2"}
              minH={92}
              items="center"
              gap="3"
              px="4"
              py="3.5"
              rounded="2xl"
              bg="background"
              borderWidth={1}
              borderColor={active ? "accent-background" : "border-color"}
              opacity={stopped || (busy && busy !== m.id) ? 0.5 : 1}
              role="button"
              aria-selected={active}
              onPress={stopped || busy || active ? undefined : () => start(m)}
            >
              <YStack flex={1} minW={0} gap="1">
                <Text fontSize="lg" fontWeight="600">
                  {m.name}
                </Text>
                <Muted>{m.description}</Muted>
              </YStack>
              <Text fontSize="sm" fontWeight="600" color={active && !running ? "stop-text" : "color"}>
                {busy === m.id ? "Starting…" : active ? (running ? "Running" : "Paused") : ""}
              </Text>
            </XStack>
          );
        })}
      </YStack>

      <Panel flex={1} p="5" gap="4">
        {!mode ? (
          <YStack flex={1} items="center" justify="center" gap="2.5">
            <Text fontSize="2xl" fontWeight="600">
              No mode running
            </Text>
            <Muted fontSize="base" maxW={440} text="center">
              Pick a mode on the left. Only one runs at a time, and the drive controls stay locked while it does.
            </Muted>
            {error ? (
              <Text fontSize="sm" color="stop-text" mt="2">
                {error}
              </Text>
            ) : null}
          </YStack>
        ) : (
          <>
            <XStack items="center" gap="3">
              <Text fontSize="2xl" fontWeight="600">
                {mode.name}
              </Text>
              <View theme={running ? "accent" : undefined} h={30} px="3" justify="center" rounded="full" bg={running ? "background" : "color-1"}>
                <Text fontSize="sm" fontWeight="600" color={running ? "color" : "stop-text"}>
                  {running ? "Running" : mode.kind === "trajectory" ? "Ready" : "Paused"}
                </Text>
              </View>
              <View flex={1} />
              {mode.kind !== "trajectory" ? (
                <PrimaryButton size="md" label={running ? "Pause" : "Resume"} onPress={togglePause} />
              ) : null}
              <SecondaryButton size="md" label="Exit mode" onPress={() => exitMode()} />
            </XStack>

            <XStack flex={1} minH={0} gap="5">
              <YStack flex={1} minW={0} rounded="xl" overflow="hidden" borderWidth={1} borderColor="border-color" bg="video" items="center" justify="center">
                {mode.feed ? (
                  <MjpegView url={videoUrl(mode.feed)} onTap={mode.kind === "color" ? pickColor : undefined} />
                ) : (
                  <Text theme="dark" maxW={340} p="6" fontSize="lg" lineHeight={1.5} text="center" opacity={0.85}>
                    {mode.kind === "lidar" ? "The robot is using its LiDAR. Watch the scan on the Sensors tab." : mode.hint}
                  </Text>
                )}
                {mode.kind === "color" ? (
                  <View theme="dark" position="absolute" l={12} b={12} h={36} px="3" justify="center" rounded="lg" bg="background" borderWidth={1} borderColor="border-color" pointerEvents="none">
                    <Text fontSize="sm" opacity={0.85}>
                      {mode.hint}
                    </Text>
                  </View>
                ) : null}
              </YStack>

              <YStack w={260} gap="4">
                {mode.kind === "color" ? (
                  <>
                    <YStack gap="2">
                      <PanelTitle>Target color</PanelTitle>
                      <XStack items="center" gap="3">
                        <View w={44} h={44} rounded="lg" borderWidth={2} borderColor="border-color" style={targetRgb ? { backgroundColor: targetRgb } : undefined} />
                        <Muted flex={1}>{targetRgb ? "Picked from the image" : "Tap the image to pick"}</Muted>
                      </XStack>
                    </YStack>
                    <ValueSlider
                      label="Color tolerance"
                      value={tolerance}
                      min={0}
                      max={1}
                      step={0.05}
                      display={tolerance.toFixed(2)}
                      onChange={(v) => {
                        setTolerance(v);
                        sendTolerance(mode.id as "line" | "kick", v);
                      }}
                    />
                  </>
                ) : null}

                {mode.kind === "lidar" ? (
                  <YStack gap="2">
                    <PanelTitle>Behavior</PanelTitle>
                    {LIDAR_BEHAVIORS.map((b) => {
                      const selected = b.value === behavior;
                      return (
                        <YStack
                          key={b.value}
                          theme={selected ? "accent" : undefined}
                          minH={64}
                          justify="center"
                          gap="0.5"
                          px="3.5"
                          py="2.5"
                          rounded="xl"
                          bg={selected ? "background" : "color-1"}
                          borderWidth={1}
                          borderColor={selected ? "accent-background" : "border-color"}
                          role="button"
                          aria-selected={selected}
                          onPress={() => pickBehavior(b.value)}
                        >
                          <Text fontSize="base" fontWeight="600">
                            {b.label}
                          </Text>
                          <Muted>{b.caption}</Muted>
                        </YStack>
                      );
                    })}
                  </YStack>
                ) : null}

                {mode.kind === "trajectory" ? (
                  <YStack gap="2">
                    <PrimaryButton size="md" label="Start drawing" onPress={() => robot.startTrajectory().then(() => setRunning(true)).catch(() => {})} />
                    <SecondaryButton size="md" label="Stop" onPress={() => robot.stopTrajectory().then(() => setRunning(false)).catch(() => {})} />
                  </YStack>
                ) : null}

                <View flex={1} />
                {error ? (
                  <Text fontSize="sm" color="stop-text">
                    {error}
                  </Text>
                ) : null}
                <YStack gap="1.5" pt="3.5" borderTopWidth={1} borderColor="border-color">
                  <XStack items="center" gap="2">
                    <View theme="accent" w={8} h={8} rounded="full" bg="accent-background" />
                    <Text fontSize="sm" fontWeight="600">
                      Heartbeat active
                    </Text>
                  </XStack>
                  <Muted>The app checks in every 2 s. If the tablet drops off the network, the mode exits on its own within 5 s.</Muted>
                </YStack>
              </YStack>
            </XStack>
          </>
        )}
      </Panel>
    </XStack>
  );
}
