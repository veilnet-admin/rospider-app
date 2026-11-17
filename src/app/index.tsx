import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Input, Label, Text, View, XStack, YStack } from "tamagui";

import { PrimaryButton, SecondaryButton } from "@/components/Buttons";
import { Mono, Muted, PanelTitle } from "@/components/Panel";
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
  const status = useBridgeStatus();
  const { connection, connect, disconnect, robot } = useRos();
  const [host, setHost] = useState(connection.host);
  const [bridgePort, setBridgePort] = useState(connection.bridgePort);
  const [videoPort, setVideoPort] = useState(connection.videoPort);
  const [portsOpen, setPortsOpen] = useState(false);
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
    <YStack flex={1} items="center" justify="center" bg="background">
      <YStack theme="level2" w={480} bg="background" borderWidth={1} borderColor="border-color" rounded="3xl" p="8" gap="5">
        <Text fontSize="2xl" fontWeight="600">
          Connect to robot
        </Text>

        <Field id="host" label="Robot address" value={host} onChange={setHost} type="url" large />

        {portsOpen ? (
          <XStack gap="3">
            <Field grow id="bridge-port" label="rosbridge port" value={bridgePort} onChange={setBridgePort} type="number" />
            <Field grow id="video-port" label="Video port" value={videoPort} onChange={setVideoPort} type="number" />
          </XStack>
        ) : (
          <XStack items="center" gap="3" mt="-1.5">
            <Muted>Ports</Muted>
            <Mono flex={1} fontSize="sm" opacity={0.85}>
              rosbridge {bridgePort} · video {videoPort}
            </Mono>
            <PortsLink onPress={() => setPortsOpen(true)} />
          </XStack>
        )}

        <XStack items="center" gap="4">
          <YStack flex={1} gap="0.5">
            <Text fontSize="base" fontWeight="500">
              Reconnect automatically
            </Text>
            <Muted>Retries on its own if the Wi-Fi link drops</Muted>
          </YStack>
          <Switch checked={autoReconnect} label="Reconnect automatically" onChange={setAutoReconnect} />
        </XStack>

        {status === "connected" && !attempted ? (
          <XStack gap="3">
            <PrimaryButton flex label="Open controls" onPress={() => router.replace("/drive")} />
            <SecondaryButton label="Disconnect" onPress={disconnect} />
          </XStack>
        ) : (
          <PrimaryButton label={busy ? "Connecting…" : "Connect"} onPress={busy ? () => disconnect() : onConnect} />
        )}

        <YStack pt="4" borderTopWidth={1} borderColor="border-color">
          <YStack mb="1.5">
            <PanelTitle>Checks</PanelTitle>
          </YStack>
          <CheckRow label="rosbridge reachable" check={bridgeCheck} checking={attempted} />
          <CheckRow label="Video server reachable" check={video} checking={attempted} />
          <CheckRow label="rosapi available" check={rosapi} checking={attempted} />
        </YStack>
      </YStack>
    </YStack>
  );
}

function PortsLink({ onPress }: { onPress: () => void }) {
  const { accent } = usePalette();
  return (
    <View h={44} px="3" justify="center" rounded="lg" role="button" aria-label="Edit ports" onPress={onPress}>
      <Text fontSize="sm" fontWeight="600" color={accent}>
        Edit ports
      </Text>
    </View>
  );
}

function Switch({ checked, label, onChange }: { checked: boolean; label: string; onChange: (next: boolean) => void }) {
  return (
    <View
      theme={checked ? "accent" : undefined}
      w={56}
      h={34}
      rounded="full"
      bg={checked ? "background" : "color-3"}
      justify="center"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onPress={() => onChange(!checked)}
    >
      <View w={26} h={26} rounded="full" bg="white" ml={checked ? 26 : 4} />
    </View>
  );
}

function Field(props: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  type: "url" | "number";
  grow?: boolean;
  large?: boolean;
}) {
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
        h={props.large ? 56 : 52}
        fontFamily="mono"
        fontSize={props.large ? "xl" : "lg"}
      />
    </YStack>
  );
}

function CheckRow({ label, check, checking }: { label: string; check: Check; checking: boolean }) {
  const tone = check.state === "ok" ? "accent" : undefined;
  return (
    <XStack items="center" gap="3" minH={44}>
      <View
        theme={tone}
        w={24}
        h={24}
        rounded="full"
        items="center"
        justify="center"
        bg={check.state === "ok" ? "background" : "transparent"}
        borderWidth={check.state === "ok" ? 0 : 2}
        borderColor={check.state === "fail" ? "stop-text" : "border-color"}
      >
        {check.state === "ok" ? (
          <Text fontSize="xs" fontWeight="700" color="color">
            ✓
          </Text>
        ) : null}
      </View>
      <Text flex={1} fontSize="base">
        {label}
      </Text>
      <Mono fontSize="sm" color={check.state === "fail" ? "stop-text" : "color"} opacity={check.state === "fail" ? 1 : 0.68}>
        {check.state === "pending" ? (checking ? "Checking…" : "Not checked") : check.detail}
      </Mono>
    </XStack>
  );
}
