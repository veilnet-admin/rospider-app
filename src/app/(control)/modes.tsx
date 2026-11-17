import { useEffect, useState } from "react";
import { Text, View, XStack, YStack } from "tamagui";

import { PrimaryButton, SecondaryButton } from "@/components/Buttons";
import { ModeIcon, TargetIcon } from "@/components/icons";
import { MjpegView } from "@/components/MjpegView";
import { GLASS, GLASS_BORDER, OVERLAY_INK } from "@/components/Overlay";
import { Mono, Muted, Panel, PanelTitle } from "@/components/Panel";
import { ValueSlider } from "@/components/ValueSlider";
import { usePalette } from "@/hooks/usePalette";
import { useThrottled } from "@/hooks/useThrottled";
import type { LidarBehavior, ModeId } from "@/ros/robot";
import { useRos } from "@/ros/RosProvider";

type Mode = {
  id: ModeId;
  name: string;
  description: string;
  uses: string;
  kind: "color" | "lidar" | "plain" | "trajectory";
  feed?: string;
  hint?: string;
};

const MODES: Mode[] = [
  {
    id: "line",
    name: "Line following",
    description: "Follows a colored line on the floor. You pick the line’s color on the camera image.",
    uses: "Camera",
    kind: "color",
    feed: "/line_following/image_result",
    hint: "Tap the line to set its color",
  },
  {
    id: "kick",
    name: "Intelligent kick",
    description: "Walks up to a colored ball and kicks it. You pick the ball’s color on the camera image.",
    uses: "Camera",
    kind: "color",
    feed: "/intelligent_kick/image_result",
    hint: "Tap the ball to set its color",
  },
  {
    id: "lidar",
    name: "LiDAR",
    description: "Avoids obstacles, follows the nearest object or guards its spot, using the LD19.",
    uses: "LiDAR",
    kind: "lidar",
  },
  {
    id: "balance",
    name: "Self-balancing",
    description: "Keeps the body level as the ground tilts. Tilt the surface under the robot to see it work.",
    uses: "IMU",
    kind: "plain",
    hint: "Tilt the surface under the robot. The body stays level.",
  },
  {
    id: "gesture",
    name: "Hand gesture",
    description: "Reacts to hand gestures shown to the depth camera.",
    uses: "Depth camera",
    kind: "plain",
    hint: "Show a hand gesture to the depth camera.",
  },
  {
    id: "trajectory",
    name: "Hand trajectory",
    description: "Draw a path with your hand in front of the camera, and the robot walks it.",
    uses: "Camera",
    kind: "trajectory",
    feed: "/hand_trajectory/image_result",
  },
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

  if (!mode) {
    return (
      <YStack flex={1} p="6" gap="4">
        <XStack h={44} items="center" gap="4">
          <Text fontSize="xl" fontWeight="600">
            Pick a mode
          </Text>
          <Muted flex={1} fontSize="base">
            One runs at a time. Drive controls lock while it runs, and STOP ends it.
          </Muted>
          {error ? (
            <Text fontSize="sm" color="stop-text">
              {error}
            </Text>
          ) : null}
        </XStack>
        {[0, 1].map((row) => (
          <XStack key={row} flex={1} gap="4">
            {MODES.slice(row * 3, row * 3 + 3).map((m) => (
              <ModeCard key={m.id} mode={m} busy={busy === m.id} disabled={stopped || busy !== null} onStart={() => start(m)} />
            ))}
          </XStack>
        ))}
      </YStack>
    );
  }

  const statusLabel = running ? "Running" : mode.kind === "trajectory" ? "Ready" : "Paused";

  return (
    <YStack flex={1} p="6" gap="5">
      <XStack h={56} items="center" gap="3.5">
        <IconTile kind={mode.id} />
        <Text fontSize="2xl" fontWeight="600">
          {mode.name}
        </Text>
        <StatusPill label={statusLabel} active={running || mode.kind === "trajectory"} />
        <View flex={1} />
        {error ? (
          <Text maxW={360} fontSize="sm" color="stop-text" numberOfLines={2}>
            {error}
          </Text>
        ) : null}
        {mode.kind !== "trajectory" ? <SecondaryButton size="md" label={running ? "Pause" : "Resume"} onPress={togglePause} /> : null}
        <SecondaryButton size="md" label="Exit mode" onPress={() => exitMode()} />
      </XStack>

      <XStack flex={1} minH={0} gap="5">
        <YStack flex={1} minW={0} rounded="2xl" overflow="hidden" borderWidth={1} borderColor="border-color" bg="video" items="center" justify="center">
          {mode.feed ? (
            <MjpegView url={videoUrl(mode.feed)} onTap={mode.kind === "color" ? pickColor : undefined} />
          ) : (
            <Text theme="dark" maxW={360} p="6" fontSize="lg" lineHeight={27} text="center" color="color" opacity={0.85}>
              {mode.kind === "lidar" ? "The robot is using its LiDAR. Watch the scan on the Sensors tab." : mode.hint}
            </Text>
          )}
          {mode.feed ? (
            <View theme="dark" position="absolute" l={14} t={14} h={32} px="3" justify="center" rounded="lg" bg={GLASS} borderWidth={1} borderColor={GLASS_BORDER}>
              <Mono fontSize="xs" opacity={0.85}>
                {mode.feed}
              </Mono>
            </View>
          ) : null}
          {mode.kind === "color" ? (
            <XStack theme="dark" position="absolute" l={14} b={14} h={40} px="3.5" gap="2.5" items="center" rounded="lg" bg={GLASS} borderWidth={1} borderColor={GLASS_BORDER} pointerEvents="none">
              <TargetIcon color={OVERLAY_INK} />
              <Text fontSize="sm" color="color">
                {mode.hint}
              </Text>
            </XStack>
          ) : null}
        </YStack>

        <YStack w={320} gap="4">
          {mode.kind === "color" ? (
            <>
              <Panel p="5" gap="3.5">
                <PanelTitle>Target color</PanelTitle>
                <XStack items="center" gap="3.5">
                  <View
                    w={56}
                    h={56}
                    rounded="xl"
                    borderWidth={2}
                    borderColor="border-color"
                    bg="color-1"
                    style={targetRgb ? { backgroundColor: targetRgb } : undefined}
                  />
                  <YStack flex={1} gap="1">
                    <Text fontSize="base" fontWeight="500">
                      {targetRgb ? "Picked from the image" : "Not picked yet"}
                    </Text>
                    <Mono fontSize="sm" opacity={0.68}>
                      {targetRgb ?? "Tap the image to pick"}
                    </Mono>
                  </YStack>
                </XStack>
              </Panel>
              <Panel p="5">
                <ValueSlider
                  label="Color tolerance"
                  value={tolerance}
                  min={0}
                  max={1}
                  step={0.05}
                  display={tolerance.toFixed(2)}
                  rangeLabels={["0.00", "1.00"]}
                  onChange={(v) => {
                    setTolerance(v);
                    sendTolerance(mode.id as "line" | "kick", v);
                  }}
                />
              </Panel>
            </>
          ) : null}

          {mode.kind === "lidar" ? (
            <Panel p="5" gap="2.5">
              <PanelTitle>Behavior</PanelTitle>
              {LIDAR_BEHAVIORS.map((b) => {
                const selected = b.value === behavior;
                return (
                  <YStack
                    key={b.value}
                    minH={64}
                    justify="center"
                    gap="0.5"
                    px="3.5"
                    py="2.5"
                    rounded="xl"
                    bg="color-1"
                    borderWidth={selected ? 2 : 1}
                    borderColor={selected ? "accent-background" : "border-color"}
                    role="radio"
                    aria-checked={selected}
                    onPress={() => pickBehavior(b.value)}
                  >
                    <Text fontSize="base" fontWeight="600">
                      {b.label}
                    </Text>
                    <Muted>{b.caption}</Muted>
                  </YStack>
                );
              })}
            </Panel>
          ) : null}

          {mode.kind === "trajectory" ? (
            <Panel p="5" gap="3">
              <PanelTitle>Drawing</PanelTitle>
              <Muted>Start drawing, move your hand along the path in front of the camera, then stop.</Muted>
              <PrimaryButton size="md" label="Start drawing" onPress={() => robot.startTrajectory().then(() => setRunning(true)).catch(() => {})} />
              <SecondaryButton size="md" label="Stop" onPress={() => robot.stopTrajectory().then(() => setRunning(false)).catch(() => {})} />
            </Panel>
          ) : null}

          <View flex={1} />

          <YStack gap="1.5" px="5" py="4" rounded="2xl" bg="color-1" borderWidth={1} borderColor="border-color">
            <XStack items="center" gap="2.5">
              <View theme="accent" w={8} h={8} rounded="full" bg="accent-background" />
              <Text fontSize="sm" fontWeight="600">
                Heartbeat active
              </Text>
            </XStack>
            <Muted>The app checks in every 2 s. If the tablet drops off the network, the mode exits on its own within 5 s.</Muted>
          </YStack>
        </YStack>
      </XStack>
    </YStack>
  );
}

function IconTile({ kind }: { kind: ModeId }) {
  const { accent } = usePalette();
  return (
    <View w={48} h={48} rounded="lg" items="center" justify="center" bg="color-1" borderWidth={1} borderColor="border-color">
      <ModeIcon kind={kind} color={accent} />
    </View>
  );
}

function StatusPill({ label, active }: { label: string; active: boolean }) {
  const { accent } = usePalette();
  return (
    <XStack h={32} items="center" gap="2" px="3.5" rounded="full" borderWidth={1} borderColor={active ? accent : "stop-text"} role="status">
      <View w={8} h={8} rounded="full" bg={active ? accent : "stop-text"} />
      <Text fontSize="sm" fontWeight="600" color={active ? accent : "stop-text"}>
        {label}
      </Text>
    </XStack>
  );
}

function ModeCard({ mode, busy, disabled, onStart }: { mode: Mode; busy: boolean; disabled: boolean; onStart: () => void }) {
  return (
    <Panel flex={1} p="5" gap="3.5" rounded="3xl">
      <XStack items="center" justify="space-between">
        <IconTile kind={mode.id} />
        <XStack h={28} items="center" px="3" rounded="full" borderWidth={1} borderColor="border-color">
          <Text fontSize="xs" color="color" opacity={0.85}>
            {mode.uses}
          </Text>
        </XStack>
      </XStack>
      <YStack gap="1.5">
        <Text fontSize="xl" fontWeight="600">
          {mode.name}
        </Text>
        <Muted fontSize="base">{mode.description}</Muted>
      </YStack>
      <View flex={1} />
      <PrimaryButton size="md" label={busy ? "Starting…" : "Start"} disabled={disabled} onPress={onStart} />
    </Panel>
  );
}
