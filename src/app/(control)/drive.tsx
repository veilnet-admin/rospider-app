import { useEffect, useRef, useState } from "react";
import { Text, View, XStack, YStack } from "tamagui";

import { PrimaryButton, SecondaryButton } from "@/components/Buttons";
import { StopIcon } from "@/components/icons";
import { Joystick } from "@/components/Joystick";
import { MjpegView } from "@/components/MjpegView";
import { Mono, Muted, Panel, PanelTitle } from "@/components/Panel";
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

export default function Drive() {
  const { robot, videoUrl, stopped, resume, activeMode, exitMode } = useRos();
  const [speed, setSpeed] = useState<Speed>("normal");
  const [gait, setGait] = useState<Gait>("tripod");
  const [stance, setStance] = useState<Stance>("middle");
  const [feed, setFeed] = useState<Feed>("rgb");
  const [command, setCommand] = useState<Command>(ZERO);
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
    robot.drive(next.vx, next.vy, next.wz);
    setCommand(next);
  };

  // leaving the screen must never leave the robot walking
  useEffect(
    () => () => {
      if (trailing.current) clearTimeout(trailing.current);
      robot.drive(0, 0, 0);
    },
    [robot]
  );

  useEffect(() => {
    if (!stopped) return;
    stick.current = { x: 0, y: 0, turn: 0 };
    lastSent.current = ZERO;
    setCommand(ZERO);
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
    <XStack flex={1} gap="4" p="4">
      <YStack w={272} gap="4">
        <Panel>
          <PanelTitle>Speed</PanelTitle>
          <Segmented
            value={speed}
            onChange={setSpeed}
            options={[
              { value: "slow", label: "Slow" },
              { value: "normal", label: "Normal" },
              { value: "fast", label: "Fast" },
            ]}
          />
        </Panel>

        <Panel gap="2.5">
          <PanelTitle>Walk</PanelTitle>
          <Text fontSize="sm" opacity={0.78}>
            Gait
          </Text>
          <Segmented
            value={gait}
            onChange={changeGait}
            disabled={locked}
            options={[
              { value: "tripod", label: "Tripod" },
              { value: "ripple", label: "Ripple" },
            ]}
          />
          <Text fontSize="sm" opacity={0.78}>
            Height
          </Text>
          <Segmented
            value={stance}
            onChange={changeStance}
            disabled={locked}
            options={[
              { value: "low", label: "Low" },
              { value: "middle", label: "Mid" },
              { value: "high", label: "High" },
            ]}
          />
        </Panel>

        <Panel flex={1} items="center" justify="flex-end" gap="2.5">
          <Joystick
            width={196}
            height={196}
            knob={68}
            axis="both"
            label="Move joystick"
            disabled={locked}
            onMove={(x, y) => {
              stick.current.x = x;
              stick.current.y = y;
              flush();
            }}
          />
          <Text fontSize="base" fontWeight="600">
            Move
          </Text>
        </Panel>
      </YStack>

      <YStack flex={1} minW={0} rounded="2xl" overflow="hidden" borderWidth={1} borderColor="border-color" bg="video">
        <MjpegView url={videoUrl(FEED_TOPIC[feed])} />

        <XStack position="absolute" t={14} l={14} r={14} items="flex-start" justify="space-between" pointerEvents="box-none">
          <View theme="dark" w={260}>
            <Segmented
              value={feed}
              onChange={setFeed}
              options={[
                { value: "rgb", label: "RGB" },
                { value: "depth", label: "Depth" },
                { value: "ir", label: "IR" },
              ]}
            />
          </View>
          <YStack items="flex-end" gap="2" pointerEvents="box-none">
            <RestChip status={arm.status} onRest={arm.rest} disabled={stopped} />
            {savedNotice ? (
              <View theme="accent" h={40} px="3.5" justify="center" rounded="lg" bg="background">
                <Text fontSize="sm" fontWeight="500">
                  Rest pose saved from the arm’s current position
                </Text>
              </View>
            ) : null}
            {activeMode ? (
              <XStack theme="dark" items="center" gap="3" h={44} pl="4" pr="1" rounded="xl" bg="background" borderWidth={1} borderColor="border-color">
                <Text fontSize="sm">{MODE_NAME[activeMode]} is driving</Text>
                <View h={36} px="3" justify="center" rounded="lg" bg="color-3" role="button" onPress={() => exitMode()}>
                  <Text fontSize="sm" fontWeight="600">
                    Exit mode
                  </Text>
                </View>
              </XStack>
            ) : null}
          </YStack>
        </XStack>

        <XStack position="absolute" b={14} l={14} r={14} items="center" gap="2" pointerEvents="none">
          <Readout label="vx" value={`${command.vx.toFixed(2)} m/s`} />
          <Readout label="vy" value={`${command.vy.toFixed(2)} m/s`} />
          <Readout label="ωz" value={`${command.wz.toFixed(2)} rad/s`} />
        </XStack>

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
      </YStack>

      <YStack w={272} gap="4">
        <Panel gap="3">
          <XStack items="center" gap="2">
            <View flex={1}>
              <PanelTitle>Arm</PanelTitle>
            </View>
            <SecondaryButton size="md" label="Save as rest" disabled={stopped || !arm.current} onPress={() => setConfirmingRest(true)} />
          </XStack>

          <RestButton status={arm.status} onRest={arm.rest} disabled={stopped} />

          <Joystick
            width={240}
            height={184}
            knob={44}
            axis="both"
            shape="square"
            label="Aim the arm"
            disabled={stopped}
            onMove={arm.setAim}
          />
          <Muted mt="-1">Drag to aim: sideways turns the arm, up and down lifts the gripper.</Muted>

          <Segmented
            value={arm.grip ?? "none"}
            disabled={stopped}
            onChange={(v) => arm.setGripper(v as "open" | "closed")}
            options={[
              { value: "open", label: "Open" },
              { value: "closed", label: "Close" },
            ]}
          />
        </Panel>

        <Panel flex={1} items="center" justify="flex-end" gap="2.5">
          <Joystick
            width={232}
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
          <Text fontSize="base" fontWeight="600">
            Turn
          </Text>
        </Panel>
      </YStack>
    </XStack>
  );
}

function RestButton({ status, onRest, disabled }: { status: ArmStatus; onRest: () => void; disabled: boolean }) {
  const idle = status === "rest" || status === "moving";
  const label = status === "rest" ? "Arm at rest" : status === "moving" ? "Moving to rest…" : "Rest arm";
  return (
    <View
      theme={idle ? undefined : "accent"}
      h={56}
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

function RestChip({ status, onRest, disabled }: { status: ArmStatus; onRest: () => void; disabled: boolean }) {
  if (status === "unknown") return null;
  if (status === "out") {
    return (
      <XStack
        theme="dark"
        items="center"
        gap="2.5"
        h={52}
        pl="3.5"
        pr="5"
        rounded="xl"
        bg="background"
        borderWidth={1}
        borderColor="stop-text"
        opacity={disabled ? 0.5 : 1}
        role="button"
        aria-label="Arm in view. Rest arm"
        onPress={disabled ? undefined : onRest}
      >
        <View w={10} h={10} rounded="full" bg="stop-text" />
        <Text fontSize="base" fontWeight="600">
          Arm in view · Rest arm
        </Text>
      </XStack>
    );
  }
  return (
    <XStack theme="dark" items="center" gap="2.5" h={52} pl="3.5" pr="5" rounded="xl" bg="background" borderWidth={1} borderColor="border-color" role="status">
      <View theme="accent" w={12} h={12} rounded="full" bg={status === "rest" ? "accent-background" : "transparent"} borderWidth={2} borderColor="accent-background" />
      <Text fontSize="base" fontWeight="500" opacity={0.9}>
        {status === "rest" ? "Arm at rest · camera clear" : "Moving arm to rest…"}
      </Text>
    </XStack>
  );
}

function SaveRestDialog({ pose, onCancel, onSave }: { pose: [number, number][] | null; onCancel: () => void; onSave: () => void }) {
  return (
    <YStack theme="dark" position="absolute" t={0} l={0} r={0} b={0} items="center" justify="center" bg="background" opacity={0.97}>
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

function Readout({ label, value }: { label: string; value: string }) {
  return (
    <XStack theme="dark" items="center" gap="2" h={36} px="3" rounded="lg" bg="background" borderWidth={1} borderColor="border-color">
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
    <YStack
      theme="dark"
      position="absolute"
      t={0}
      l={0}
      r={0}
      b={0}
      items="center"
      justify="center"
      gap="3.5"
      p="6"
      bg="background"
      opacity={0.92}
      role="alert"
    >
      <StopIcon size={56} color={stop} />
      <Text fontSize="2xl" fontWeight="600">
        Motion stopped
      </Text>
      <Text maxW={380} fontSize="base" lineHeight={1.5} text="center" opacity={0.85}>
        Velocity is zeroed and any running action group is halted. The robot returns to its init pose.
      </Text>
      <PrimaryButton label="Resume control" size="md" onPress={onResume} />
    </YStack>
  );
}
