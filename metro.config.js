const { getDefaultConfig } = require('expo/metro-config')
const { withTamagui } = require('@tamagui/cli/metro')

// reads from tamagui.build.ts automatically
module.exports = withTamagui(getDefaultConfig(__dirname))
