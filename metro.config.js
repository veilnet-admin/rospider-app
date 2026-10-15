const { getDefaultConfig } = require('expo/metro-config')
const { withTamagui } = require('@tamagui/cli/metro')

module.exports = withTamagui(getDefaultConfig(__dirname), {
  components: ['tamagui'],
  config: './tamagui.config.ts',
})