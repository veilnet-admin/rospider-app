import { useEffect, useRef, useState } from "react";
import Svg, { Path } from "react-native-svg";
import { ScrollView, Text, View, XStack, YStack } from "tamagui";

import { Mono, Muted, Panel, PanelTitle } from "@/components/Panel";
import { usePalette } from "@/hooks/usePalette";
import { useRos, useTopic } from "@/ros/RosProvider";

type Action = { id: string; name: string };

// action groups stored on the robot; dances are special-cased by move_controller
const GROUPS: { title: string; actions: Action[] }[] = [
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
    actions: [
      { id: "dance_1", name: "Dance 1" },
      { id: "dance_2", name: "Dance 2" },
      { id: "dance_3", name: "Dance 3" },
    ],
  },
];

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
    <XStack flex={1} gap="4" p="4">
      <ScrollView flex={1} contentContainerStyle={{ gap: 22, paddingBottom: 8 }}>
        {GROUPS.map((group) => (
          <YStack key={group.title} gap="2.5">
            <PanelTitle>{group.title}</PanelTitle>
            <XStack flexWrap="wrap" gap="2.5">
              {group.actions.map((action) => (
                <ActionCard
                  key={action.id}
                  action={action}
                  active={running?.id === action.id}
                  disabled={stopped}
                  onPress={() => run(action)}
                />
              ))}
            </XStack>
          </YStack>
        ))}
      </ScrollView>

      <Panel w={340} p="5" gap="4">
        <PanelTitle>Now running</PanelTitle>
        {running ? (
          <YStack gap="4">
            <YStack gap="1.5">
              <Text fontSize="3xl" fontWeight="600" lineHeight={1.15}>
                {running.name}
              </Text>
              <Mono fontSize="sm" opacity={0.68}>
                run_actionset · {running.id}
              </Mono>
            </YStack>
            <XStack theme="accent" items="center" gap="2.5" p="3" rounded="lg" bg="background">
              <View w={10} h={10} rounded="full" bg="color" />
              <Text flex={1} fontSize="sm">
                Running until the robot reports it is complete
              </Text>
            </XStack>
            <View h={56} items="center" justify="center" rounded="2xl" borderWidth={2} borderColor="stop" role="button" onPress={stop}>
              <Text fontSize="lg" fontWeight="600" color="stop-text">
                Stop action
              </Text>
            </View>
            <Muted>Stopping halts the action group and returns the robot to its init pose.</Muted>
          </YStack>
        ) : (
          <YStack gap="2" py="5">
            <Text fontSize="xl" fontWeight="600">
              Nothing running
            </Text>
            <Muted fontSize="base">Tap an action to run it. Starting a new one interrupts the current action.</Muted>
          </YStack>
        )}
        <View flex={1} />
        <YStack gap="1.5" pt="4" borderTopWidth={1} borderColor="border-color">
          <Text fontSize="sm" fontWeight="600">
            Dances wait their turn
          </Text>
          <Muted>A dance starts only after the current action has finished.</Muted>
        </YStack>
      </Panel>
    </XStack>
  );
}

function ActionCard({ action, active, disabled, onPress }: { action: Action; active: boolean; disabled: boolean; onPress: () => void }) {
  const { ink } = usePalette();
  return (
    <XStack
      theme={active ? "accent" : "level2"}
      w="23.5%"
      minH={76}
      items="center"
      gap="3"
      pl="4"
      pr="3"
      py="3"
      rounded="2xl"
      bg="background"
      borderWidth={1}
      borderColor={active ? "accent-background" : "border-color"}
      opacity={disabled ? 0.5 : 1}
      scale="press:0.98"
      role="button"
      aria-label={`Run ${action.name}`}
      onPress={disabled ? undefined : onPress}
    >
      <YStack flex={1} minW={0} gap="1">
        <Text fontSize="base" fontWeight="600">
          {action.name}
        </Text>
        <Mono fontSize="xs" opacity={0.6}>
          {action.id.startsWith("dance_") ? action.id : `${action.id}.d6a`}
        </Mono>
      </YStack>
      <View w={38} h={38} rounded="full" items="center" justify="center" bg="color-3">
        <Svg width={14} height={16} viewBox="0 0 14 16">
          <Path d="M2 1.5 L12.5 8 L2 14.5 Z" fill={ink} />
        </Svg>
      </View>
    </XStack>
  );
}
