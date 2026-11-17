import { useEffect, useRef, useState } from "react";
import { Text, View, XStack, YStack } from "tamagui";

import { PrimaryButton, SecondaryButton } from "@/components/Buttons";
import { ArmIcon, ChevronIcon, StopIcon } from "@/components/icons";
import { Joystick } from "@/components/Joystick";
import { DEPTH_BAND_MM, DEPTH_COLORS, MjpegView } from "@/components/MjpegView";
import { ChipGroup, Glass, GLASS, GLASS_BORDER, GLASS_LIGHT, OVERLAY_INK } from "@/components/Overlay";
import { Mono, Muted, PanelTitle } from "@/components/Panel";
import { Segmented } from "@/components/Segmented";
import { useArm, type ArmStatus } from "@/hooks/useArm";
import { usePalette } from "@/hooks/usePalette";
import { LIMITS, type Gait, type Stance } from "@/ros/robot";
import { useRos } from "@/ros/RosProvider";

type Speed = "slow" | "normal" | "fast";
type Feed = "rgb" | "depth" | "ir";

const SPEED_SCALE: Record<Speed, number> = { slow: 0.25, normal: 0.5, fast: 1 };
const FEED_TOPIC: Record<Feed, string> = {
  rgb: "/depth_cam/rgb/image_raw",
  depth: "/depth_cam/depth/image_raw",
  ir: "/depth_cam/ir/image",
};
const MODE_NAME = {
  line: "Line following",
  kick: "Intelligent kick",
  lidar: "LiDAR",
  balance: "Self-balancing",
  gesture: "Hand gesture",
  trajectory: "Hand trajectory",
} as const;

// each new cmd_vel restarts the robot's step generator, so only send meaningful changes
const STEP = 0.2;
const DEADZONE = 0.15;
const MIN_INTERVAL_MS = 150;

const quantize = (v: number) => (Math.abs(v) < DEADZONE ? 0 : Math.round(v / STEP) * STEP);
const round3 = (v: number) => Math.round(v * 1000) / 1000 || 0;

type Command = { vx: number; vy: number; wz: number };
const ZERO: Command = { vx: 0, vy: 0, wz: 0 };

// overlay layout: the bottom cards and the readouts between them
const EDGE = 16;
const MOVE_CARD_W = 228;
const TURN_CARD_W = 268;
const ARM_BUTTON_H = 54;

export default function Drive() {
  const { robot, videoUrl, stopped, resume, activeMode, exitMode } = useRos();
  const { accent } = usePalette();
  const [speed, setSpeed] = useState<Speed>("normal");
  const [gait, setGait] = useState<Gait>("tripod");
  const [stance, setStance] = useState<Stance>("middle");
  const [feed, setFeed] = useState<Feed>("rgb");
  const [command, setCommand] = useState<Command>(ZERO);
  const [armOpen, setArmOpen] = useState(false);
  const [confirmingRest, setConfirmingRest] = useState(false);
  const [savedNotice, setSavedNotice] = useState(false);
  const arm = useArm(!stopped);

  const stick = useRef({ x: 0, y: 0, turn: 0 });
  const lastSent = useRef<Command>(ZERO);
  const lastSentAt = useRef(0);
  const trailing = useRef<ReturnType<typeof setTimeout> | null>(null);

  const locked = stopped || activeMode !== null;

  const flush = () => {
    const scale = SPEED_SCALE[speed];
    const next: Command = {
      vx: round3(quantize(stick.current.y) * LIMITS.vx * scale),
      vy: round3(-quantize(stick.current.x) * LIMITS.vy * scale),
      wz: round3(-quantize(stick.current.turn) * LIMITS.wz * scale),
    };
    const prev = lastSent.current;
    if (next.vx === prev.vx && next.vy === prev.vy && next.wz === prev.wz) return;

    const isStop = next.vx === 0 && next.vy === 0 && next.wz === 0;
    const wait = MIN_INTERVAL_MS - (Date.now() - lastSentAt.current);
    if (!isStop && wait > 0) {
      if (!trailing.current) {
        trailing.current = setTimeout(() => {
          trailing.current = null;
          flush();
        }, wait);
      }
      return;
    }
    if (trailing.current) {
      clearTimeout(trailing.current);
      trailing.current = null;
    }
    lastSent.current = next;
    lastSentAt.current = Date.now();
    if (isStop) robot.stopWalking();
    else robot.drive(next.vx, next.vy, next.wz);
    setCommand(next);
  };

  // leaving the screen must never leave the robot walking
  useEffect(
    () => () => {
      if (trailing.current) clearTimeout(trailing.current);
      robot.stopWalking();
    },
    [robot]
  );

  useEffect(() => {
    if (!stopped) return;
    stick.current = { x: 0, y: 0, turn: 0 };
    lastSent.current = ZERO;
    setCommand(ZERO);
    setArmOpen(false);
  }, [stopped]);

  useEffect(() => {
    if (!savedNotice) return;
    const timer = setTimeout(() => setSavedNotice(false), 3000);
    return () => clearTimeout(timer);
  }, [savedNotice]);

  const changeGait = (next: Gait) => {
    setGait(next);
    robot.setGaitAndStance(next, stance);
  };
  const changeStance = (next: Stance) => {
    setStance(next);
    robot.setGaitAndStance(gait, next);
  };

  return (
    <View flex={1} bg="video" overflow="hidden">
      <MjpegView url={videoUrl(FEED_TOPIC[feed])} colorize={feed === "depth" ? "depth" : undefined} />

      <XStack position="absolute" t={EDGE} l={EDGE} r={EDGE} items="flex-start" gap="2.5" zIndex={2} pointerEvents="box-none">
        <ChipGroup
          a11yLabel="Camera feed"
          value={feed}
          onChange={setFeed}
          options={[
            { value: "rgb", label: "RGB" },
            { value: "depth", label: "Depth" },
            { value: "ir", label: "IR" },
          ]}
        />
        <ChipGroup
          label="Speed"
          value={speed}
          onChange={setSpeed}
          options={[
            { value: "slow", label: "Slow" },
            { value: "normal", label: "Normal" },
            { value: "fast", label: "Fast" },
          ]}
        />
        <ChipGroup
          label="Gait"
          value={gait}
          onChange={changeGait}
          disabled={locked}
          options={[
            { value: "tripod", label: "Tripod" },
            { value: "ripple", label: "Ripple" },
          ]}
        />
        <ChipGroup
          label="Height"
          value={stance}
          onChange={changeStance}
          disabled={locked}
          options={[
            { value: "low", label: "Low" },
            { value: "middle", label: "Mid" },
            { value: "high", label: "High" },
          ]}
        />

        <View flex={1} pointerEvents="none" />

        <YStack items="flex-end" pointerEvents="box-none">
          <XStack
            theme="dark"
            h={ARM_BUTTON_H}
            items="center"
            gap="2.5"
            px="3.5"
            rounded="xl"
            bg={GLASS}
            borderWidth={1}
            borderColor={armOpen ? accent : GLASS_BORDER}
            role="button"
            aria-label="Arm controls"
            aria-expanded={armOpen}
            onPress={() => setArmOpen((open) => !open)}
          >
            <ArmIcon color={OVERLAY_INK} />
            <Text fontSize="base" fontWeight="600" color="color">
              Arm
            </Text>
            <ChevronIcon color={OVERLAY_INK} up={armOpen} />
          </XStack>
        </YStack>
      </XStack>

      {savedNotice ? (
        <XStack position="absolute" t={84} l={0} r={0} justify="center" zIndex={1} pointerEvents="none">
          <View theme="accent" h={40} px="3.5" justify="center" rounded="lg" bg="background">
            <Text fontSize="sm" fontWeight="500">
              Rest pose saved from the arm’s current position
            </Text>
          </View>
        </XStack>
      ) : null}

      <Glass position="absolute" l={EDGE} b={EDGE} w={MOVE_CARD_W} px="4" pt="3" pb="4" gap="2" items="center" rounded="2xl" bg={GLASS_LIGHT}>
        <View self="flex-start">
          <PanelTitle>Move</PanelTitle>
        </View>
        <Joystick
          overlay
          width={188}
          height={188}
          knob={64}
          axis="both"
          label="Move joystick"
          disabled={locked}
          onMove={(x, y) => {
            stick.current.x = x;
            stick.current.y = y;
            flush();
          }}
        />
      </Glass>

      <XStack
        position="absolute"
        b={EDGE}
        l={EDGE * 2 + MOVE_CARD_W}
        r={EDGE * 2 + TURN_CARD_W}
        justify="center"
        items="center"
        gap="2"
        pointerEvents="box-none"
      >
        {activeMode ? (
          <XStack theme="dark" items="center" gap="3" h={52} pl="4" pr="1.5" rounded="xl" bg={GLASS} borderWidth={1} borderColor={GLASS_BORDER}>
            <Text fontSize="sm" color="color">
              {MODE_NAME[activeMode]} is driving
            </Text>
            <View h={40} px="3" justify="center" rounded="lg" bg="color-3" role="button" onPress={() => exitMode()}>
              <Text fontSize="sm" fontWeight="600" color="color">
                Exit mode
              </Text>
            </View>
          </XStack>
        ) : (
          <>
            <Readout label="vx" value={`${command.vx.toFixed(2)} m/s`} />
            <Readout label="vy" value={`${command.vy.toFixed(2)} m/s`} />
            <Readout label="ωz" value={`${command.wz.toFixed(2)} rad/s`} />
            {feed === "depth" ? <DepthLegend /> : null}
          </>
        )}
      </XStack>

      <Glass position="absolute" r={EDGE} b={EDGE} w={TURN_CARD_W} px="4" pt="3" pb="4" gap="2" rounded="2xl" bg={GLASS_LIGHT}>
        <PanelTitle>Turn</PanelTitle>
        <Joystick
          overlay
          width={TURN_CARD_W - 32}
          height={88}
          knob={64}
          axis="x"
          label="Turn control"
          disabled={locked}
          onMove={(x) => {
            stick.current.turn = x;
            flush();
          }}
        />
      </Glass>

      {/* a child outside its parent's bounds gets no touches on Android, so the menu
          hangs off the full-screen container rather than off the Arm button's row */}
      {armOpen ? (
        <YStack
          theme="dark"
          position="absolute"
          t={EDGE + ARM_BUTTON_H + 8}
          r={EDGE}
          w={308}
          p="4"
          gap="3"
          rounded="2xl"
          bg="rgba(10, 11, 14, 0.94)"
          borderWidth={1}
          borderColor="rgba(255, 255, 255, 0.12)"
          zIndex={3}
          aria-label="Arm controls"
        >
          <XStack items="center" justify="space-between">
            <PanelTitle>Arm</PanelTitle>
            <SecondaryButton size="md" label="Save as rest" disabled={stopped || !arm.current} onPress={() => setConfirmingRest(true)} />
          </XStack>

          <RestButton status={arm.status} onRest={arm.rest} disabled={stopped} />

          <Joystick
            width={276}
            height={136}
            knob={44}
            axis="both"
            shape="square"
            label="Aim the arm"
            disabled={stopped}
            onMove={arm.setAim}
          />
          <Muted>Drag to aim: sideways turns the arm, up and down lifts the gripper.</Muted>

          <Segmented
            value={arm.grip ?? "none"}
            disabled={stopped}
            onChange={(v) => arm.setGripper(v as "open" | "closed")}
            options={[
              { value: "open", label: "Open" },
              { value: "closed", label: "Close" },
            ]}
          />
        </YStack>
      ) : null}

      {confirmingRest ? (
        <SaveRestDialog
          pose={arm.current}
          onCancel={() => setConfirmingRest(false)}
          onSave={() => {
            arm.saveCurrentAsRest();
            setConfirmingRest(false);
            setSavedNotice(true);
          }}
        />
      ) : null}

      {stopped ? <StoppedOverlay onResume={resume} /> : null}
    </View>
  );
}

function RestButton({ status, onRest, disabled }: { status: ArmStatus; onRest: () => void; disabled: boolean }) {
  const idle = status === "rest" || status === "moving";
  const label = status === "rest" ? "Arm at rest" : status === "moving" ? "Moving to rest…" : "Rest arm";
  return (
    <View
      theme={idle ? undefined : "accent"}
      h={52}
      items="center"
      justify="center"
      rounded="2xl"
      bg={idle ? "color-2" : "background"}
      opacity={disabled ? 0.5 : 1}
      scale="press:0.98"
      role="button"
      aria-disabled={idle || disabled}
      onPress={idle || disabled ? undefined : onRest}
    >
      <Text fontSize="lg" fontWeight="600" color="color" opacity={idle ? 0.68 : 1}>
        {label}
      </Text>
    </View>
  );
}

function SaveRestDialog({ pose, onCancel, onSave }: { pose: [number, number][] | null; onCancel: () => void; onSave: () => void }) {
  return (
    <YStack theme="dark" position="absolute" t={0} l={0} r={0} b={0} items="center" justify="center" bg="rgba(5, 6, 8, 0.9)" zIndex={3}>
      <YStack w={420} gap="4" p="5" rounded="2xl" bg="color-2" borderWidth={1} borderColor="border-color" role="dialog" aria-label="Save rest pose">
        <Text fontSize="xl" fontWeight="600">
          Use this pose as rest?
        </Text>
        <Muted>Rest arm will return the arm here. Check the camera is clear first.</Muted>
        <XStack gap="1.5">
          {(pose ?? []).map(([id, position], i) => (
            <YStack key={id} flex={1} items="center" gap="0.5" py="2" rounded="md" bg="color-1">
              <Text fontSize="xs" opacity={0.68}>
                J{i + 1}
              </Text>
              <Mono fontSize="base">{position}</Mono>
            </YStack>
          ))}
        </XStack>
        <XStack gap="2">
          <SecondaryButton flex size="md" label="Cancel" onPress={onCancel} />
          <PrimaryButton flex size="md" label="Save" onPress={onSave} />
        </XStack>
      </YStack>
    </YStack>
  );
}

function DepthLegend() {
  const near = (DEPTH_BAND_MM / 1000).toFixed(1);
  const far = ((DEPTH_BAND_MM * DEPTH_COLORS.length) / 1000).toFixed(1);
  return (
    <XStack theme="dark" items="center" gap="2" h={40} px="3" rounded="lg" bg={GLASS} borderWidth={1} borderColor={GLASS_BORDER}>
      <Mono fontSize="xs">{near} m</Mono>
      <XStack h={10} rounded="xs" overflow="hidden">
        {DEPTH_COLORS.map((color) => (
          <View key={color} w={7} h={10} style={{ backgroundColor: color }} />
        ))}
      </XStack>
      <Mono fontSize="xs">{far} m</Mono>
    </XStack>
  );
}

function Readout({ label, value }: { label: string; value: string }) {
  return (
    <XStack theme="dark" items="center" gap="2" h={40} px="3" rounded="lg" bg={GLASS} borderWidth={1} borderColor={GLASS_BORDER}>
      <Mono fontSize="sm" opacity={0.6}>
        {label}
      </Mono>
      <Mono fontSize="sm">{value}</Mono>
    </XStack>
  );
}

function StoppedOverlay({ onResume }: { onResume: () => void }) {
  const { stop } = usePalette();
  return (
    <YStack theme="dark" position="absolute" t={0} l={0} r={0} b={0} items="center" justify="center" bg="rgba(5, 6, 8, 0.86)" zIndex={4} role="alert">
      <YStack w={460} items="center" gap="3.5" p="8" rounded="3xl" bg="color-2" borderWidth={1} borderColor="border-color">
        <View w={64} h={64} rounded="full" items="center" justify="center" bg="color-1">
          <StopIcon size={32} color={stop} />
        </View>
        <Text fontSize="2xl" fontWeight="600">
          Robot stopped
        </Text>
        <Text fontSize="base" lineHeight={24} text="center" color="color" opacity={0.85}>
          Walking, actions and modes are halted. The robot settles into its init pose. Controls stay locked until you resume.
        </Text>
        <YStack self="stretch" mt="2">
          <PrimaryButton label="Resume control" onPress={onResume} />
        </YStack>
      </YStack>
    </YStack>
  );
}
