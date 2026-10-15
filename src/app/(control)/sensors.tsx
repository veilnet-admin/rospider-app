import Svg, { Circle, G, Line, Path, Rect, Text as SvgText } from "react-native-svg";
import { Text, View, XStack, YStack } from "tamagui";

import { SecondaryButton } from "@/components/Buttons";
import { Mono, Muted, Panel } from "@/components/Panel";
import { usePalette } from "@/hooks/usePalette";
import { rollPitchYaw, yawFromQuaternion, type Imu, type LaserScan, type Odometry, type ServoStateList } from "@/ros/robot";
import { useRos, useTopic } from "@/ros/RosProvider";

const LEGS: { name: string; ids: [number, number, number] }[] = [
  { name: "LF", ids: [5, 3, 1] },
  { name: "LM", ids: [11, 9, 7] },
  { name: "LR", ids: [17, 15, 13] },
  { name: "RF", ids: [6, 4, 2] },
  { name: "RM", ids: [12, 10, 8] },
  { name: "RR", ids: [18, 16, 14] },
];
const ARM_SERVOS: { name: string; id: number }[] = [
  { name: "Joint 1", id: 19 },
  { name: "Joint 2", id: 20 },
  { name: "Joint 3", id: 21 },
  { name: "Joint 4", id: 22 },
  { name: "Joint 5", id: 23 },
  { name: "Gripper", id: 24 },
];
const PARTS = ["Coxa", "Femur", "Tibia"];

const deg = (rad: number) => `${((rad * 180) / Math.PI).toFixed(1)}°`;

export default function Sensors() {
  const { bridge } = useRos();
  const scan = useTopic<LaserScan>("/scan", "sensor_msgs/msg/LaserScan", 250);
  const imu = useTopic<Imu>("/imu", "sensor_msgs/msg/Imu", 200);
  const odom = useTopic<Odometry>("/odom", "nav_msgs/msg/Odometry", 250);
  const battery = useTopic<{ data: number }>("/ros_robot_controller/battery", "std_msgs/msg/UInt16", 2000);
  const servos = useTopic<ServoStateList>("/controller_manager/servo_states", "servo_controller_msgs/msg/ServoStateList", 1000);

  const attitude = imu ? rollPitchYaw(imu.orientation) : null;
  const position = odom?.pose.pose.position;
  const heading = odom ? yawFromQuaternion(odom.pose.pose.orientation) : null;
  const servoById = new Map((servos?.servo_state ?? []).map((s) => [s.id, s]));

  const resetOdometry = () =>
    bridge
      .callService("/set_pose", {
        pose: {
          header: { frame_id: "odom" },
          pose: { pose: { position: { x: 0, y: 0, z: 0 }, orientation: { x: 0, y: 0, z: 0, w: 1 } } },
        },
      })
      .catch(() => {});

  return (
    <XStack flex={1} gap="4" p="4">
      <Panel flex={1.25} p="5">
        <XStack items="baseline" gap="3">
          <Text flex={1} fontSize="xl" fontWeight="600">
            LiDAR
          </Text>
          <Mono fontSize="xs" opacity={0.6}>
            /scan · LD19
          </Mono>
        </XStack>
        <YStack flex={1} items="center" justify="center" bg="color-1" borderWidth={1} borderColor="border-color" rounded="xl">
          <ScanPlot scan={scan} />
        </YStack>
        <Muted>Robot faces up. Rings every meter.</Muted>
      </Panel>

      <YStack flex={2} gap="4">
        <XStack flex={1.5} gap="4">
          <Panel flex={1} p="5">
            <XStack items="baseline" gap="3">
              <Text flex={1} fontSize="xl" fontWeight="600">
                IMU
              </Text>
              <Mono fontSize="xs" opacity={0.6}>
                /imu
              </Mono>
            </XStack>
            <YStack flex={1} items="center" justify="center">
              <Horizon roll={attitude?.roll ?? 0} pitch={attitude?.pitch ?? 0} />
            </YStack>
            <XStack gap="2">
              <Stat label="Roll" value={attitude ? deg(attitude.roll) : "—"} />
              <Stat label="Pitch" value={attitude ? deg(attitude.pitch) : "—"} />
              <Stat label="Yaw" value={attitude ? deg(attitude.yaw) : "—"} />
            </XStack>
          </Panel>

          <YStack flex={1} gap="4">
            <Panel flex={1} p="5">
              <XStack items="baseline" gap="3">
                <Text flex={1} fontSize="xl" fontWeight="600">
                  Odometry
                </Text>
                <Mono fontSize="xs" opacity={0.6}>
                  /odom
                </Mono>
              </XStack>
              <XStack gap="2">
                <Stat plain label="x" value={position ? `${position.x.toFixed(2)} m` : "—"} />
                <Stat plain label="y" value={position ? `${position.y.toFixed(2)} m` : "—"} />
                <Stat plain label="Heading" value={heading !== null ? deg(heading) : "—"} />
              </XStack>
              <View flex={1} />
              <XStack>
                <SecondaryButton size="md" label="Reset origin" onPress={resetOdometry} />
              </XStack>
            </Panel>
            <Panel flex={1} p="5" gap="2">
              <XStack items="baseline" gap="3">
                <Text flex={1} fontSize="xl" fontWeight="600">
                  Battery
                </Text>
                <Mono fontSize="xs" opacity={0.6}>
                  /ros_robot_controller/battery
                </Mono>
              </XStack>
              <XStack items="baseline" gap="2">
                <Mono fontSize="4xl" fontWeight="500">
                  {battery ? battery.data : "—"}
                </Mono>
                <Mono fontSize="xl" opacity={0.68}>
                  mV
                </Mono>
              </XStack>
              <Muted>Raw reading from the controller board.</Muted>
            </Panel>
          </YStack>
        </XStack>

        <Panel flex={1} p="5" gap="3.5">
          <XStack items="baseline" gap="3">
            <Text flex={1} fontSize="xl" fontWeight="600">
              Servos
            </Text>
            <Text fontSize="sm" opacity={0.85}>
              {servos ? `${servos.servo_state.length} reporting` : "Waiting for servo states"}
            </Text>
          </XStack>
          <XStack gap="2">
            {LEGS.map((leg) => (
              <YStack key={leg.name} flex={1} gap="1.5" p="2.5" rounded="lg" bg="color-1">
                <Mono fontSize="sm" fontWeight="600">
                  {leg.name}
                </Mono>
                {leg.ids.map((id, i) => (
                  <ServoRow key={id} name={PARTS[i]} position={servoById.get(id)?.position} />
                ))}
              </YStack>
            ))}
          </XStack>
          <XStack gap="2">
            {ARM_SERVOS.map((servo) => (
              <XStack key={servo.id} flex={1} items="center" h={40} px="2.5" rounded="lg" bg="color-1">
                <ServoRow grow name={servo.name} position={servoById.get(servo.id)?.position} />
              </XStack>
            ))}
          </XStack>
        </Panel>
      </YStack>
    </XStack>
  );
}

function ServoRow({ name, position, grow }: { name: string; position: number | undefined; grow?: boolean }) {
  const online = position !== undefined;
  return (
    <XStack flex={grow ? 1 : undefined} items="center" gap="1.5">
      <View theme={online ? "accent" : undefined} w={6} h={6} rounded="full" bg={online ? "accent-background" : "stop-text"} />
      <Text flex={1} fontSize="xs" opacity={0.85}>
        {name}
      </Text>
      <Mono fontSize="xs" opacity={0.68}>
        {online ? position : "—"}
      </Mono>
    </XStack>
  );
}

function Stat({ label, value, plain }: { label: string; value: string; plain?: boolean }) {
  return (
    <YStack flex={1} gap="0.5" p={plain ? 0 : "2.5"} rounded="lg" bg={plain ? "transparent" : "color-1"}>
      <Text fontSize="xs" opacity={0.68}>
        {label}
      </Text>
      <Mono fontSize="lg">{value}</Mono>
    </YStack>
  );
}

const PLOT = 400;
const CENTER = PLOT / 2;
const PX_PER_M = 45;
const MAX_RANGE_M = 4;

function ScanPlot({ scan }: { scan: LaserScan | null }) {
  const { accent, ink, surface } = usePalette();

  let points = "";
  if (scan) {
    scan.ranges.forEach((r, i) => {
      if (r === null || !Number.isFinite(r) || r < scan.range_min || r > MAX_RANGE_M) return;
      const a = scan.angle_min + i * scan.angle_increment;
      // laser frame: x forward, y left; screen: forward is up
      const sx = CENTER - r * Math.sin(a) * PX_PER_M;
      const sy = CENTER - r * Math.cos(a) * PX_PER_M;
      points += `M${sx.toFixed(1)} ${sy.toFixed(1)}h0.01`;
    });
  }

  return (
    <Svg width={PLOT} height={PLOT} viewBox={`0 0 ${PLOT} ${PLOT}`} accessibilityLabel="LiDAR scan around the robot, out to 4 meters">
      {[1, 2, 3, 4].map((m) => (
        <G key={m}>
          <Circle cx={CENTER} cy={CENTER} r={m * PX_PER_M} fill="none" stroke={ink} strokeOpacity={0.15} strokeWidth={1.5} />
          <SvgText x={CENTER + 6} y={CENTER - m * PX_PER_M + 14} fontSize={11} fill={ink} fillOpacity={0.6}>
            {`${m} m`}
          </SvgText>
        </G>
      ))}
      <Line x1={CENTER} y1={10} x2={CENTER} y2={PLOT - 10} stroke={ink} strokeOpacity={0.08} strokeWidth={1.5} />
      <Line x1={10} y1={CENTER} x2={PLOT - 10} y2={CENTER} stroke={ink} strokeOpacity={0.08} strokeWidth={1.5} />
      {points ? <Path d={points} stroke={accent} strokeWidth={4.5} strokeLinecap="round" fill="none" /> : null}
      <Rect x={CENTER - 8} y={CENTER - 12} width={16} height={24} rx={7} fill={surface} stroke={ink} strokeWidth={1.8} />
      <Path
        d={`M${CENTER - 5} ${CENTER - 14} L${CENTER} ${CENTER - 20} L${CENTER + 5} ${CENTER - 14}`}
        fill="none"
        stroke={ink}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {!scan ? (
        <SvgText x={CENTER} y={PLOT - 24} fontSize={13} fill={ink} fillOpacity={0.6} textAnchor="middle">
          Waiting for scan…
        </SvgText>
      ) : null}
    </Svg>
  );
}

function Horizon({ roll, pitch }: { roll: number; pitch: number }) {
  const { accent, ink, surface } = usePalette();
  const offset = Math.max(-50, Math.min(50, (pitch * 180) / Math.PI));
  return (
    <Svg width={150} height={150} viewBox="0 0 150 150" accessibilityLabel="Attitude indicator">
      <Circle cx={75} cy={75} r={70} fill={surface} stroke={ink} strokeOpacity={0.2} strokeWidth={2} />
      <G rotation={(-roll * 180) / Math.PI} origin="75, 75">
        <Line x1={12} y1={75 + offset} x2={138} y2={75 + offset} stroke={accent} strokeWidth={2} />
      </G>
      <Path d="M48 75 L64 75 L75 86 L86 75 L102 75" fill="none" stroke={ink} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
