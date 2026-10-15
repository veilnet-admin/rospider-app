import { defaultConfig } from '@tamagui/config/v6'
import { createTamagui } from 'tamagui'
import { themes } from './themes'

export const tamaguiConfig = createTamagui({ ...defaultConfig, themes })

export default tamaguiConfig

export type Conf = typeof tamaguiConfig

declare module 'tamagui' {
  interface TamaguiCustomConfig extends Conf { }
}