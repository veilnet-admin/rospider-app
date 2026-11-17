import Svg, { Circle, G, Line, Path, Rect, Text as SvgText } from "react-native-svg";
import { Text, View, XStack, YStack } from "tamagui";

import { SecondaryButton } from "@/components/Buttons";
import { Mono, Muted, Panel, PanelTitle } from "@/components/Panel";
import { usePalette } from "@/hooks/usePalette";
import { rollPitchYaw, yawFromQuaternion, type Imu, type LaserScan, type Odometry, type ServoStateList } from "@/ros/robot";
import { useRos, useTopic } from "@/ros/RosProvider";

type Leg = { name: string; ids: [number, number, number] };

// left legs on the left, right legs on the right, front at the top: as seen from above
const LEFT_LEGS: Leg[] = [
  { name: "LF", ids: [5, 3, 1] },
  { name: "LM", ids: [11, 9, 7] },
  { name: "LR", ids: [17, 15, 13] },
];
const RIGHT_LEGS: Leg[] = [
  { name: "RF", ids: [6, 4, 2] },
  { name: "RM", ids: [12, 10, 8] },
  { name: "RR", ids: [18, 16, 14] },
];
const ARM_SERVOS: { name: string; id: number }[] = [
  { name: "J1", id: 19 },
  { name: "J2", id: 20 },
  { name: "J3", id: 21 },
  { name: "J4", id: 22 },
  { name: "J5", id: 23 },
  { name: "Grip", id: 24 },
];
const PARTS = ["Coxa", "Femur", "Tibia"];
const SERVO_COUNT = 24;

const deg = (rad: number) => `${((rad * 180) / Math.PI).toFixed(1)}°`;

const PLOT = 460;
const CENTER = PLOT / 2;
const PX_PER_M = 52;
const MAX_RANGE_M = 4;

const DIRECTIONS = ["ahead", "front-left", "left", "rear-left", "behind", "rear-right", "right", "front-right"];

// closest valid return, with its bearing in words (laser frame: 0 ahead, positive to the left)
function nearestObstacle(scan: LaserScan | null) {
  if (!scan) return null;
  let range = Infinity;
  let angle = 0;
  for (let i = 0; i < scan.ranges.length; i++) {
    const r = scan.ranges[i];
    if (r === null || !Number.isFinite(r) || r < scan.range_min || r > scan.range_max) continue;
    if (r < range) {
      range = r;
      angle = scan.angle_min + i * scan.angle_increment;
    }
  }
  if (!Number.isFinite(range)) return null;
  const sector = ((Math.round(angle / (Math.PI / 4)) % 8) + 8) % 8;
  return { range, direction: DIRECTIONS[sector] };
}

export default function Sensors() {
  const { bridge } = useRos();
  const scan = useTopic<LaserScan>("/scan", "sensor_msgs/msg/LaserScan", 250);
  const imu = useTopic<Imu>("/imu", "sensor_msgs/msg/Imu", 200);
  const odom = useTopic<Odometry>("/odom", "nav_msgs/msg/Odometry", 250);
  const servos = useTopic<ServoStateList>("/controller_manager/servo_states", "servo_controller_msgs/msg/ServoStateList", 1000);

  const attitude = imu ? rollPitchYaw(imu.orientation) : null;
  const position = odom?.pose.pose.position;
  const heading = odom ? yawFromQuaternion(odom.pose.pose.orientation) : null;
  const servoById = new Map((servos?.servo_state ?? []).map((s) => [s.id, s]));
  const nearest = nearestObstacle(scan);

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
    <XStack flex={1} gap="5" p="6">
      <Panel w={540} p="5" gap="4" rounded="3xl">
        <SectionHeader title="LiDAR" topic="/scan · LD19" />
        <YStack flex={1} items="center" justify="center">
          <ScanPlot scan={scan} />
        </YStack>
        <XStack items="center" justify="space-between">
          <Muted>Robot faces up · rings every 1 m</Muted>
          <XStack items="baseline" gap="1.5">
            <Text fontSize="sm">Nearest</Text>
            <Mono fontSize="sm">{nearest ? `${nearest.range.toFixed(2)} m` : "—"}</Mono>
            {nearest ? <Text fontSize="sm">· {nearest.direction}</Text> : null}
          </XStack>
        </XStack>
      </Panel>

      <YStack flex={1} minW={0} gap="5">
        <XStack h={200} gap="5">
          <Panel flex={1} p="5" gap="4" rounded="3xl">
            <SectionHeader title="IMU" topic="/imu" />
            <XStack flex={1} items="center" gap="5">
              <Horizon roll={attitude?.roll ?? 0} pitch={attitude?.pitch ?? 0} />
              <YStack flex={1} gap="2">
                <Stat label="Roll" value={attitude ? deg(attitude.roll) : "—"} />
                <Stat label="Pitch" value={attitude ? deg(attitude.pitch) : "—"} />
                <Stat label="Yaw" value={attitude ? deg(attitude.yaw) : "—"} />
              </YStack>
            </XStack>
          </Panel>

          <Panel flex={1} p="5" gap="4" rounded="3xl">
            <SectionHeader title="Odometry" topic="/odom" />
            <XStack gap="3">
              <Reading label="x" value={position ? `${position.x.toFixed(2)} m` : "—"} />
              <Reading label="y" value={position ? `${position.y.toFixed(2)} m` : "—"} />
              <Reading label="Heading" value={heading !== null ? deg(heading) : "—"} />
            </XStack>
            <View flex={1} />
            <XStack>
              <SecondaryButton size="md" label="Reset origin" onPress={resetOdometry} />
            </XStack>
          </Panel>
        </XStack>

        <Panel flex={1} p="5" gap="3.5" rounded="3xl">
          <XStack items="baseline" justify="space-between">
            <Text fontSize="lg" fontWeight="600">
              Servos
            </Text>
            <XStack items="center" gap="2">
              <View w={8} h={8} rounded="full" bg={servos?.servo_state.length === SERVO_COUNT ? "accent-background" : "stop-text"} theme="accent" />
              <Text fontSize="sm" opacity={0.85}>
                {servos ? `${servos.servo_state.length} of ${SERVO_COUNT} reporting · pulse 0–1000` : "Waiting for servo states"}
              </Text>
            </XStack>
          </XStack>

          <XStack gap="3">
            <YStack flex={1} minW={0} gap="2">
              {LEFT_LEGS.map((leg) => (
                <LegCard key={leg.name} leg={leg} servoById={servoById} />
              ))}
            </YStack>
            <BodyGlyph />
            <YStack flex={1} minW={0} gap="2">
              {RIGHT_LEGS.map((leg) => (
                <LegCard key={leg.name} leg={leg} servoById={servoById} />
              ))}
            </YStack>
          </XStack>

          <YStack gap="2">
            <PanelTitle>Arm</PanelTitle>
            <XStack gap="2">
              {ARM_SERVOS.map((servo) => {
                const value = servoById.get(servo.id)?.position;
                return (
                  <XStack key={servo.id} flex={1} h={44} items="center" justify="space-between" px="3" rounded="lg" bg="color-1" borderWidth={1} borderColor="border-color">
                    <Text fontSize="sm" opacity={0.68}>
                      {servo.name}
                    </Text>
                    <Mono fontSize="base" color={value === undefined ? "stop-text" : "color"}>
                      {value ?? "—"}
                    </Mono>
                  </XStack>
                );
              })}
            </XStack>
          </YStack>
        </Panel>
      </YStack>
    </XStack>
  );
}

function SectionHeader({ title, topic }: { title: string; topic: string }) {
  return (
    <XStack items="baseline" justify="space-between">
      <Text fontSize="lg" fontWeight="600">
        {title}
      </Text>
      <Mono fontSize="xs" opacity={0.6}>
        {topic}
      </Mono>
    </XStack>
  );
}

function LegCard({ leg, servoById }: { leg: Leg; servoById: Map<number, { position: number }> }) {
  return (
    <YStack h={70} justify="center" gap="1" px="3.5" rounded="lg" bg="color-1" borderWidth={1} borderColor="border-color">
      <Mono fontSize="sm" fontWeight="600">
        {leg.name}
      </Mono>
      <XStack gap="2">
        {leg.ids.map((id, i) => {
          const value = servoById.get(id)?.position;
          return (
            <YStack key={id} flex={1}>
              <Text fontSize="xs" opacity={0.68}>
                {PARTS[i]}
              </Text>
              <Mono fontSize="base" color={value === undefined ? "stop-text" : "color"}>
                {value ?? "—"}
              </Mono>
            </YStack>
          );
        })}
      </XStack>
    </YStack>
  );
}

// the body between the two leg columns, front at the top
function BodyGlyph() {
  const { ink } = usePalette();
  const h = 70 * 3 + 8 * 2;
  const rows = [35, 35 + 78, 35 + 156];
  return (
    <Svg width={56} height={h} viewBox={`0 0 56 ${h}`} accessibilityLabel="Robot body, front at the top">
      <Rect x={12} y={10} width={32} height={h - 20} rx={16} fill="none" stroke={ink} strokeOpacity={0.25} strokeWidth={2} />
      <Path d="M21 28 L28 21 L35 28" fill="none" stroke={ink} strokeOpacity={0.6} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      {rows.map((y) => (
        <G key={y}>
          <Line x1={0} y1={y} x2={12} y2={y} stroke={ink} strokeOpacity={0.25} strokeWidth={2} />
          <Line x1={44} y1={y} x2={56} y2={y} stroke={ink} strokeOpacity={0.25} strokeWidth={2} />
        </G>
      ))}
    </Svg>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <XStack items="baseline" justify="space-between">
      <Text fontSize="sm" opacity={0.68}>
        {label}
      </Text>
      <Mono fontSize="lg">{value}</Mono>
    </XStack>
  );
}

function Reading({ label, value }: { label: string; value: string }) {
  return (
    <YStack flex={1} gap="1">
      <Text fontSize="sm" opacity={0.68}>
        {label}
      </Text>
      <Mono fontSize="lg">{value}</Mono>
    </YStack>
  );
}

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
      <Rect x={0} y={0} width={PLOT} height={PLOT} rx={16} fill={ink} fillOpacity={0.03} />
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
  const size = 112;
  const c = size / 2;
  const offset = Math.max(-40, Math.min(40, (pitch * 180) / Math.PI));
  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} accessibilityLabel="Attitude indicator">
      <Circle cx={c} cy={c} r={c - 2} fill={surface} stroke={ink} strokeOpacity={0.2} strokeWidth={1.5} />
      <G rotation={(-roll * 180) / Math.PI} origin={`${c}, ${c}`}>
        <Line x1={8} y1={c + offset} x2={size - 8} y2={c + offset} stroke={accent} strokeWidth={2.5} strokeLinecap="round" />
      </G>
      <Path d={`M${c - 22} ${c} L${c - 8} ${c} L${c} ${c + 7} L${c + 8} ${c} L${c + 22} ${c}`} fill="none" stroke={ink} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
