import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Input, Label, Text, View, XStack, YStack } from "tamagui";

import { HexapodIcon } from "@/components/icons";
import { PrimaryButton, SecondaryButton } from "@/components/Buttons";
import { Mono, PanelTitle } from "@/components/Panel";
import { usePalette } from "@/hooks/usePalette";
import { useBridgeStatus, useRos } from "@/ros/RosProvider";

type Check = { state: "pending" | "ok" | "fail"; detail: string };

const PENDING: Check = { state: "pending", detail: "" };

async function checkVideoServer(host: string, port: string): Promise<Check> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 3000);
  try {
    const res = await fetch(`http://${host}:${port}/`, { signal: controller.signal });
    const html = await res.text();
    const topics = html.split("stream?topic=").length - 1;
    return { state: "ok", detail: `${topics} image topics` };
  } catch {
    return { state: "fail", detail: "Not reachable" };
  } finally {
    clearTimeout(timer);
  }
}

export default function Connect() {
  const { accent } = usePalette();
  const status = useBridgeStatus();
  const { connection, connect, disconnect, robot } = useRos();
  const [host, setHost] = useState(connection.host);
  const [bridgePort, setBridgePort] = useState(connection.bridgePort);
  const [videoPort, setVideoPort] = useState(connection.videoPort);
  const [autoReconnect, setAutoReconnect] = useState(true);
  const [video, setVideo] = useState<Check>(PENDING);
  const [rosapi, setRosapi] = useState<Check>(PENDING);
  const [attempted, setAttempted] = useState(false);

  useEffect(() => {
    if (status !== "connected" || !attempted) return;
    let cancelled = false;
    (async () => {
      const [videoCheck, rosCheck] = await Promise.all([
        checkVideoServer(host, videoPort),
        robot
          .rosVersion()
          .then((v): Check => ({ state: "ok", detail: `ROS 2 ${v.distro[0].toUpperCase()}${v.distro.slice(1)}` }))
          .catch((): Check => ({ state: "fail", detail: "No response" })),
      ]);
      if (cancelled) return;
      setVideo(videoCheck);
      setRosapi(rosCheck);
      setTimeout(() => !cancelled && router.replace("/drive"), 700);
    })();
    return () => {
      cancelled = true;
    };
  }, [status, attempted, host, videoPort, robot]);

  const onConnect = () => {
    setVideo(PENDING);
    setRosapi(PENDING);
    setAttempted(true);
    connect({ host: host.trim(), bridgePort: bridgePort.trim(), videoPort: videoPort.trim() }, autoReconnect);
  };

  const bridgeCheck: Check =
    status === "connected"
      ? { state: "ok", detail: `ws://…:${bridgePort}` }
      : status === "disconnected" && attempted
        ? { state: "fail", detail: "Not reachable" }
        : PENDING;

  const busy = status === "connecting" || (status === "disconnected" && attempted);

  return (
    <XStack flex={1} bg="background">
      <YStack flex={1} justify="center" gap="10" px="16" py="12">
        <YStack gap="5">
          <HexapodIcon size={88} color={accent} />
          <Text fontSize="5xl" fontWeight="600" lineHeight={1.05}>
            ROSpider
          </Text>
          <Text fontSize="lg" lineHeight={1.5} maxW={520} color="color" opacity={0.78}>
            Drive and pose your hexapod from this tablet. Both must be on the same local network.
          </Text>
        </YStack>

        <YStack maxW={560}>
          <PanelTitle>What the app talks to</PanelTitle>
          <InfoRow title="rosbridge" body="Topics and services over a WebSocket: driving, poses, actions and modes." />
          <InfoRow title="Video server" body="MJPEG streams of the depth camera and of each mode’s annotated view." />
          <InfoRow title="ROS 2" body="Running on the robot’s Jetson." last />
        </YStack>
      </YStack>

      <YStack w={520} justify="center" py="10" pr="12">
        <YStack theme="level2" bg="background" borderWidth={1} borderColor="border-color" rounded="3xl" p="8" gap="5">
          <Text fontSize="2xl" fontWeight="600">
            Connect to robot
          </Text>

          <Field id="host" label="Robot address" value={host} onChange={setHost} type="url" />
          <XStack gap="4">
            <Field grow id="bridge-port" label="rosbridge port" value={bridgePort} onChange={setBridgePort} type="number" />
            <Field grow id="video-port" label="Video port" value={videoPort} onChange={setVideoPort} type="number" />
          </XStack>

          <XStack
            items="center"
            gap="3"
            minH={44}
            role="checkbox"
            aria-checked={autoReconnect}
            onPress={() => setAutoReconnect((v) => !v)}
          >
            <View
              theme={autoReconnect ? "accent" : undefined}
              w={24}
              h={24}
              rounded="md"
              borderWidth={2}
              borderColor={autoReconnect ? "accent-background" : "border-color"}
              bg={autoReconnect ? "background" : "transparent"}
              items="center"
              justify="center"
            >
              {autoReconnect ? <View w={10} h={10} rounded="xs" bg="color" /> : null}
            </View>
            <Text fontSize="base" color="color" opacity={0.85}>
              Reconnect automatically
            </Text>
          </XStack>

          {status === "connected" && !attempted ? (
            <XStack gap="3">
              <PrimaryButton flex label="Open controls" onPress={() => router.replace("/drive")} />
              <SecondaryButton label="Disconnect" onPress={disconnect} />
            </XStack>
          ) : (
            <PrimaryButton
              label={busy ? "Connecting…" : "Connect"}
              onPress={busy ? () => disconnect() : onConnect}
            />
          )}

          <YStack pt="2" borderTopWidth={1} borderColor="border-color">
            <YStack mt="3" mb="1.5">
              <PanelTitle>Checks</PanelTitle>
            </YStack>
            <CheckRow label="rosbridge reachable" check={bridgeCheck} />
            <CheckRow label="Video server reachable" check={video} />
            <CheckRow label="rosapi available" check={rosapi} />
          </YStack>
        </YStack>
      </YStack>
    </XStack>
  );
}

function InfoRow({ title, body, last }: { title: string; body: string; last?: boolean }) {
  return (
    <XStack gap="4" py="3.5" borderTopWidth={1} borderBottomWidth={last ? 1 : 0} borderColor="border-color">
      <Text w={148} fontSize="base" fontWeight="600">
        {title}
      </Text>
      <Text flex={1} fontSize="base" lineHeight={1.45} color="color" opacity={0.78}>
        {body}
      </Text>
    </XStack>
  );
}

function Field(props: { id: string; label: string; value: string; onChange: (v: string) => void; type: "url" | "number"; grow?: boolean }) {
  return (
    <YStack flex={props.grow ? 1 : undefined} gap="2">
      <Label htmlFor={props.id} fontSize="sm" fontWeight="500" color="color" opacity={0.85}>
        {props.label}
      </Label>
      <Input
        id={props.id}
        type={props.type}
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        autoCapitalize="none"
        autoCorrect={false}
        h={52}
        fontFamily="mono"
        fontSize="lg"
      />
    </YStack>
  );
}

function CheckRow({ label, check }: { label: string; check: Check }) {
  const tone = check.state === "ok" ? "accent" : undefined;
  return (
    <XStack items="center" gap="3" minH={44}>
      <View
        theme={tone}
        w={22}
        h={22}
        rounded="full"
        items="center"
        justify="center"
        bg={check.state === "ok" ? "background" : "transparent"}
        borderWidth={check.state === "ok" ? 0 : 2}
        borderColor={check.state === "fail" ? "stop-text" : "border-color"}
      >
        {check.state === "ok" ? <Text fontSize="xs" fontWeight="700">✓</Text> : null}
      </View>
      <Text flex={1} fontSize="base">
        {label}
      </Text>
      <Mono fontSize="sm" color={check.state === "fail" ? "stop-text" : "color"} opacity={check.state === "fail" ? 1 : 0.68}>
        {check.state === "pending" ? "—" : check.detail}
      </Mono>
    </XStack>
  );
}
