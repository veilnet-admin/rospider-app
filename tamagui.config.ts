import { animations } from '@tamagui/config/animations-reanimated'
import { createV6Config } from '@tamagui/config/v6-base'
import { createTamagui } from 'tamagui'
import { themes, tokens } from './themes'

export const tamaguiConfig = createTamagui({
  ...createV6Config({ themes, colorTokens: tokens.color }),
  animations,
})

export default tamaguiConfig

export type Conf = typeof tamaguiConfig

declare module 'tamagui' {
  interface TamaguiCustomConfig extends Conf { }
}
