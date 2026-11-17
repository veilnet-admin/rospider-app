import { useEffect, useRef, useState } from "react";
import { ActivityIndicator } from "react-native";
import { ScrollView, Text, View, XStack, YStack } from "tamagui";

import { InfoIcon, PlayIcon, SquareStopIcon } from "@/components/icons";
import { Muted, PanelTitle } from "@/components/Panel";
import { usePalette } from "@/hooks/usePalette";
import { useRos, useTopic } from "@/ros/RosProvider";

type Action = { id: string; name: string };

const COLUMNS = 4;

// action groups stored on the robot; dances are special-cased by move_controller
const GROUPS: { title: string; note?: string; actions: Action[] }[] = [
  {
    title: "Stance",
    actions: [
      { id: "init_pose", name: "Init pose" },
      { id: "stand_low", name: "Stand low" },
      { id: "stand_middle", name: "Stand middle" },
      { id: "stand_high", name: "Stand high" },
    ],
  },
  {
    title: "Moves",
    actions: [
      { id: "twist", name: "Twist" },
      { id: "twist_fast", name: "Twist fast" },
      { id: "stepping", name: "Step in place" },
      { id: "clap", name: "Clap" },
      { id: "kick", name: "Kick" },
      { id: "attack", name: "Attack" },
      { id: "wave_and_grip", name: "Wave and grip" },
      { id: "climb_stairs", name: "Climb stairs" },
    ],
  },
  {
    title: "Dances",
    note: "A dance waits for the current action to finish",
    actions: [
      { id: "dance_1", name: "Dance 1" },
      { id: "dance_2", name: "Dance 2" },
      { id: "dance_3", name: "Dance 3" },
    ],
  },
];

// rows of a fixed width, padded so every tile in the grid is the same size
function rows<T>(items: T[], size: number): (T | null)[][] {
  const out: (T | null)[][] = [];
  for (let i = 0; i < items.length; i += size) {
    const row: (T | null)[] = items.slice(i, i + size);
    while (row.length < size) row.push(null);
    out.push(row);
  }
  return out;
}

export default function Actions() {
  const { robot, stopped } = useRos();
  const [running, setRunning] = useState<Action | null>(null);
  const startedAt = useRef(0);
  const complete = useTopic<{ data: boolean }>("/action_complete", "std_msgs/msg/Bool");

  useEffect(() => {
    // ignore a completion that belongs to the previous action
    if (complete?.data && running && Date.now() - startedAt.current > 500) setRunning(null);
  }, [complete, running]);

  useEffect(() => {
    if (stopped) setRunning(null);
  }, [stopped]);

  const run = (action: Action) => {
    startedAt.current = Date.now();
    setRunning(action);
    robot.runAction(action.id);
  };

  const stop = () => {
    robot.runAction("stop");
    setRunning(null);
  };

  return (
    <YStack flex={1} p="6" gap="5">
      <ScrollView flex={1} contentContainerStyle={{ gap: 20 }}>
        {GROUPS.map((group) => (
          <YStack key={group.title} gap="2.5">
            <XStack items="center" justify="space-between">
              <PanelTitle>{group.title}</PanelTitle>
              {group.note ? <Muted>{group.note}</Muted> : null}
            </XStack>
            {rows(group.actions, COLUMNS).map((row, i) => (
              <XStack key={i} gap="3">
                {row.map((action, j) =>
                  action ? (
                    <ActionTile
                      key={action.id}
                      action={action}
                      active={running?.id === action.id}
                      disabled={stopped}
                      onPress={() => run(action)}
                    />
                  ) : (
                    // same padding and border as a tile, or Yoga gives the tiles a wider share of the row
                    <View key={`empty-${j}`} flex={1} pl="5" pr="4" borderWidth={1} borderColor="transparent" />
                  )
                )}
              </XStack>
            ))}
          </YStack>
        ))}
      </ScrollView>

      <StatusBar running={running} onStop={stop} />
    </YStack>
  );
}

function ActionTile({ action, active, disabled, onPress }: { action: Action; active: boolean; disabled: boolean; onPress: () => void }) {
  const { accent, ink } = usePalette();
  return (
    <XStack
      theme="level2"
      flex={1}
      h={80}
      items="center"
      gap="3.5"
      pl="5"
      pr="4"
      rounded="2xl"
      bg="background"
      borderWidth={1}
      borderColor={active ? "accent-background" : "border-color"}
      opacity={disabled ? 0.5 : 1}
      scale="press:0.98"
      role="button"
      aria-label={active ? `${action.name}, running` : `Run ${action.name}`}
      onPress={disabled ? undefined : onPress}
    >
      <YStack flex={1} minW={0} gap="1">
        <Text fontSize="lg" fontWeight="600">
          {action.name}
        </Text>
        {active ? (
          <Text fontSize="sm" fontWeight="500" color={accent}>
            Running
          </Text>
        ) : null}
      </YStack>
      {active ? (
        <View theme="accent" w={44} h={44} rounded="full" items="center" justify="center" bg="background">
          <ActivityIndicator color="#ffffff" />
        </View>
      ) : (
        <View w={44} h={44} rounded="full" items="center" justify="center" bg="color-3">
          <PlayIcon size={18} color={ink} />
        </View>
      )}
    </XStack>
  );
}

function StatusBar({ running, onStop }: { running: Action | null; onStop: () => void }) {
  const { accent, ink, stop } = usePalette();

  if (!running) {
    return (
      <XStack h={88} items="center" gap="5" px="6" rounded="2xl" bg="color-1" borderWidth={1} borderColor="border-color" role="status">
        <InfoIcon size={28} color={ink} />
        <Text w={220} fontSize="xl" fontWeight="600">
          Nothing running
        </Text>
        <Muted flex={1} fontSize="base">
          Tap an action to run it. A new action interrupts the current one. Stopping returns the robot to its init pose.
        </Muted>
      </XStack>
    );
  }

  return (
    <XStack theme="level2" h={88} items="center" gap="5" pl="6" pr="4" rounded="2xl" bg="background" borderWidth={1} borderColor="accent-background" role="status">
      <ActivityIndicator size="large" color={accent} />
      <YStack w={220} gap="1">
        <PanelTitle>Now running</PanelTitle>
        <Text fontSize="xl" fontWeight="600" numberOfLines={1}>
          {running.name}
        </Text>
      </YStack>
      <Muted flex={1} fontSize="base">
        Runs until the robot reports it is done. Tapping another action interrupts it.
      </Muted>
      <XStack
        h={52}
        items="center"
        gap="2.5"
        px="5"
        rounded="xl"
        borderWidth={1}
        borderColor="stop-text"
        scale="press:0.98"
        role="button"
        aria-label="Stop action"
        onPress={onStop}
      >
        <SquareStopIcon size={18} color={stop} />
        <Text fontSize="base" fontWeight="600" color="stop-text">
          Stop action
        </Text>
      </XStack>
    </XStack>
  );
}
