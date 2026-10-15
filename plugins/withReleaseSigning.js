// Signs Android release builds with the keystore described in
// credentials/android-release.properties, so `pnpm build:apk`
// produces an installable, properly signed APK from the generated project.
const { withAppBuildGradle } = require('expo/config-plugins')

const MARKER = '// @rospider-release-signing'

const LOADER = `${MARKER}
def rospiderSigning = new Properties()
def rospiderSigningFile = rootProject.file('../credentials/android-release.properties')
if (rospiderSigningFile.exists()) {
    rospiderSigningFile.withInputStream { rospiderSigning.load(it) }
}

`

const RELEASE_CONFIG = `
        release {
            if (rospiderSigningFile.exists()) {
                storeFile rootProject.file('../' + rospiderSigning['storeFile'])
                storePassword rospiderSigning['storePassword']
                keyAlias rospiderSigning['keyAlias']
                keyPassword rospiderSigning['keyPassword']
            }
        }`

function addReleaseSigning(gradle) {
  if (gradle.includes(MARKER)) return gradle

  const androidBlock = /\nandroid \{/
  const debugConfig = /(signingConfigs \{\s*\n\s*debug \{[^}]*\})/
  const releaseUsesDebug = /(buildTypes \{[\s\S]*?release \{[\s\S]*?)signingConfig signingConfigs\.debug/

  if (!androidBlock.test(gradle) || !debugConfig.test(gradle) || !releaseUsesDebug.test(gradle)) {
    throw new Error('withReleaseSigning: android/app/build.gradle no longer matches the expected template')
  }

  return gradle
    .replace(androidBlock, `\n${LOADER}android {`)
    .replace(debugConfig, `$1${RELEASE_CONFIG}`)
    .replace(releaseUsesDebug, '$1signingConfig signingConfigs.release')
}

module.exports = function withReleaseSigning(config) {
  return withAppBuildGradle(config, (mod) => {
    mod.modResults.contents = addReleaseSigning(mod.modResults.contents)
    return mod
  })
}
