import { animations } from '@tamagui/config/animations-reanimated'
import { createSystemFont, createV6Config, withTailwindTypeScale } from '@tamagui/config/v6-base'
import { createTamagui } from 'tamagui'
import { themes, tokens } from './themes'

const v6 = createV6Config({ themes, colorTokens: tokens.color })

export const tamaguiConfig = createTamagui({
  ...v6,
  fonts: {
    ...v6.fonts,
    // telemetry readouts
    mono: withTailwindTypeScale(createSystemFont({ family: 'monospace' })),
  },
  animations,
})

export default tamaguiConfig

export type Conf = typeof tamaguiConfig

declare module 'tamagui' {
  interface TamaguiCustomConfig extends Conf { }
}
