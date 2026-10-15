import { useEffect, useState } from "react";
import Svg, { Circle, G, Path, Rect, Text as SvgText } from "react-native-svg";
import { Text, XStack, YStack } from "tamagui";

import { SecondaryButton } from "@/components/Buttons";
import { Muted, Panel, PanelTitle } from "@/components/Panel";
import { Segmented } from "@/components/Segmented";
import { ValueSlider } from "@/components/ValueSlider";
import { usePalette } from "@/hooks/usePalette";
import { useThrottled } from "@/hooks/useThrottled";
import { loadRestPose } from "@/ros/armRest";
import { ARM, LIMITS, type ServoStateList } from "@/ros/robot";
import { useRos, useTopic } from "@/ros/RosProvider";

type Rotation = { roll: number; pitch: number; yaw: number };
const LEVEL: Rotation = { roll: 0, pitch: 0, yaw: 0 };

const signed = (v: number, digits: number, unit: string) => `${v > 0 ? "+" : ""}${v.toFixed(digits)}${unit}`;

export default function Pose() {
  const { robot, stopped } = useRos();
  const [rotation, setRotation] = useState<Rotation>(LEVEL);
  const [joints, setJoints] = useState<Record<number, number> | null>(null);
  const [gripper, setGripper] = useState<"open" | "closed" | null>(null);
  const servos = useTopic<ServoStateList>(
    "/controller_manager/servo_states",
    "servo_controller_msgs/msg/ServoStateList",
    1000
  );

  // start the arm sliders from where the arm actually is
  useEffect(() => {
    if (joints || !servos) return;
    const byId = new Map(servos.servo_state.map((s) => [s.id, s.position]));
    if (!ARM.joints.every((j) => byId.has(j.id))) return;
    setJoints(Object.fromEntries(ARM.joints.map((j) => [j.id, byId.get(j.id) ?? 500])));
  }, [servos, joints]);

  const sendRotation = useThrottled((r: Rotation) => robot.setBodyRotation(r.roll, r.pitch, r.yaw), 150);
  const sendJoint = useThrottled((id: number, position: number) => robot.setServos([[id, position]], 0.2), 120);

  const rotate = (key: keyof Rotation, value: number) => {
    const next = { ...rotation, [key]: value };
    setRotation(next);
    sendRotation(next);
  };

  const levelBody = () => {
    setRotation(LEVEL);
    robot.setBodyRotation(0, 0, 0);
  };

  const restArm = () => {
    const pose = loadRestPose();
    robot.setServos(pose, 1.5);
    setJoints(Object.fromEntries(pose));
  };

  const grip = (state: "open" | "closed") => {
    setGripper(state);
    robot.setServos([[ARM.gripperId, state === "open" ? ARM.gripperOpen : ARM.gripperClosed]], 0.5);
  };

  return (
    <XStack flex={1} gap="4" p="4">
      <Panel flex={1} p="5" gap="4">
        <XStack items="center" gap="3">
          <Text flex={1} fontSize="xl" fontWeight="600">
            Body
          </Text>
          <SecondaryButton size="md" label="Level" disabled={stopped} onPress={levelBody} />
          <SecondaryButton
            size="md"
            label="Default pose"
            disabled={stopped}
            onPress={() => {
              setRotation(LEVEL);
              robot.setBuiltInPose("DEFAULT_POSE");
            }}
          />
        </XStack>

        <YStack items="center" py="2" bg="color-1" borderWidth={1} borderColor="border-color" rounded="xl">
          <BodyTopView yaw={rotation.yaw} />
        </YStack>

        <YStack gap="4">
          <ValueSlider
            label="Roll"
            value={rotation.roll}
            min={-LIMITS.roll}
            max={LIMITS.roll}
            step={0.01}
            display={signed(rotation.roll, 2, " rad")}
            rangeLabels={[`−${LIMITS.roll.toFixed(2)}`, `+${LIMITS.roll.toFixed(2)}`]}
            disabled={stopped}
            onChange={(v) => rotate("roll", v)}
          />
          <ValueSlider
            label="Pitch"
            value={rotation.pitch}
            min={-LIMITS.pitch}
            max={LIMITS.pitch}
            step={0.01}
            display={signed(rotation.pitch, 2, " rad")}
            rangeLabels={[`−${LIMITS.pitch.toFixed(2)}`, `+${LIMITS.pitch.toFixed(2)}`]}
            disabled={stopped}
            onChange={(v) => rotate("pitch", v)}
          />
          <ValueSlider
            label="Yaw"
            value={rotation.yaw}
            min={-LIMITS.yaw}
            max={LIMITS.yaw}
            step={0.01}
            display={signed(rotation.yaw, 2, " rad")}
            rangeLabels={[`−${LIMITS.yaw.toFixed(2)}`, `+${LIMITS.yaw.toFixed(2)}`]}
            disabled={stopped}
            onChange={(v) => rotate("yaw", v)}
          />
        </YStack>
        <Muted>Tilts are capped at the controller’s limits and keep the feet planted.</Muted>
      </Panel>

      <Panel flex={1} p="5" gap="4">
        <XStack items="center" gap="3">
          <Text flex={1} fontSize="xl" fontWeight="600">
            Arm
          </Text>
          <SecondaryButton size="md" label="Rest arm" disabled={stopped} onPress={restArm} />
        </XStack>

        <XStack flex={1} gap="5">
          <YStack w={220} gap="4">
            <YStack gap="2">
              <PanelTitle>Gripper</PanelTitle>
              <Segmented
                value={gripper ?? "none"}
                disabled={stopped}
                onChange={(v) => grip(v as "open" | "closed")}
                options={[
                  { value: "open", label: "Open" },
                  { value: "closed", label: "Close" },
                ]}
              />
            </YStack>
            <YStack gap="2">
              <PanelTitle>Presets</PanelTitle>
              <SecondaryButton size="md" label="Wave and grip" disabled={stopped} onPress={() => robot.runAction("wave_and_grip")} />
            </YStack>
          </YStack>

          <YStack flex={1} gap="3">
            {joints ? (
              ARM.joints.map((joint) => (
                <ValueSlider
                  key={joint.id}
                  label={joint.label}
                  value={joints[joint.id]}
                  min={0}
                  max={1000}
                  step={5}
                  display={`${joints[joint.id]}`}
                  disabled={stopped}
                  onChange={(v) => {
                    setJoints({ ...joints, [joint.id]: v });
                    sendJoint(joint.id, v);
                  }}
                />
              ))
            ) : (
              <Muted>Reading the arm’s current position…</Muted>
            )}
            <Muted>Servo positions, 0–1000. Sliders start where the arm is.</Muted>
          </YStack>
        </XStack>
      </Panel>
    </XStack>
  );
}

function BodyTopView({ yaw }: { yaw: number }) {
  const { accent, ink: line, surface } = usePalette();
  const deg = (-yaw * 180) / Math.PI;
  return (
    <Svg width={330} height={220} viewBox="0 0 360 250" accessibilityLabel="Top view of the body with its six legs">
      <G rotation={deg} origin="180, 125">
        <Path
          d="M142 85 L100 62 L70 40 M140 125 L92 125 L56 125 M142 165 L100 188 L70 210 M218 85 L260 62 L290 40 M220 125 L268 125 L304 125 M218 165 L260 188 L290 210"
          fill="none"
          stroke={line}
          strokeOpacity={0.45}
          strokeWidth={5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <Rect x={140} y={60} width={80} height={130} rx={36} fill={surface} stroke={accent} strokeWidth={2} />
        <Path d="M170 76 L180 64 L190 76" fill="none" stroke={accent} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
        {[
          [70, 40],
          [56, 125],
          [70, 210],
          [290, 40],
          [304, 125],
          [290, 210],
        ].map(([cx, cy]) => (
          <Circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={7} fill={accent} />
        ))}
        {[
          ["LF", 52, 22],
          ["LM", 22, 129],
          ["LR", 52, 236],
          ["RF", 292, 22],
          ["RM", 318, 129],
          ["RR", 292, 236],
        ].map(([label, x, y]) => (
          <SvgText key={label} x={x} y={y} fontSize={12} fill={line} fillOpacity={0.7}>
            {label}
          </SvgText>
        ))}
      </G>
    </Svg>
  );
}
