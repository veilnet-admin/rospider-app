import { useState } from 'react'
import { WebView, type WebViewMessageEvent } from 'react-native-webview'
import { Button, Text, View, YStack } from 'tamagui'

type Props = {
  url: string
  // normalized image coordinates of a tap, 0..1
  onTap?: (x: number, y: number) => void
  // 'depth' recolors a mono16 depth stream (see DEPTH_FILTER)
  colorize?: 'depth'
}

// web_video_server squeezes mono16 depth (mm) into 8 bits by about /256, so a
// room-scale scene arrives as levels 0-15: near black. This filter stretches
// each level into one 256 mm band and colors it: black is no reading, red is
// near, blue is about 3.75 m. It works on the rendered stream, so the
// cross-origin image never needs to be read.
export const DEPTH_BAND_MM = 256
export const DEPTH_COLORS = [
  '#7a0403', '#b31e05', '#db3a0b', '#f2650f', '#fb8f22', '#f6b734', '#e2d838', '#b6f13a',
  '#7efc54', '#42f293', '#1fd8c4', '#28b5ec', '#3f8bf8', '#4660d9', '#3e3891',
]
const DEPTH_FILTER = `<svg width="0" height="0" style="position:absolute"><filter id="depth" color-interpolation-filters="sRGB">
<feComponentTransfer><feFuncR type="linear" slope="16"/><feFuncG type="linear" slope="16"/><feFuncB type="linear" slope="16"/></feComponentTransfer>
<feComponentTransfer>
<feFuncR type="discrete" tableValues="0 0.478 0.702 0.859 0.949 0.984 0.965 0.886 0.714 0.494 0.259 0.122 0.157 0.247 0.275 0.243"/>
<feFuncG type="discrete" tableValues="0 0.016 0.118 0.227 0.396 0.561 0.718 0.847 0.945 0.988 0.949 0.847 0.71 0.545 0.376 0.22"/>
<feFuncB type="discrete" tableValues="0 0.012 0.02 0.043 0.059 0.133 0.204 0.22 0.227 0.329 0.576 0.769 0.925 0.973 0.851 0.569"/>
</feComponentTransfer></filter></svg>`

// web_video_server streams multipart MJPEG, which an <img> in a WebView renders natively
export function MjpegView({ url, onTap, colorize }: Props) {
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)

  const html = `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1">
<style>html,body{margin:0;height:100%;background:#050608;overflow:hidden}body{display:flex;align-items:center;justify-content:center}img{max-width:100%;max-height:100%;object-fit:contain}</style>
</head><body>${colorize === 'depth' ? DEPTH_FILTER : ''}<img id="v" src="${url}"${colorize === 'depth' ? ' style="filter:url(#depth)"' : ''}>
<script>
var v=document.getElementById('v');
v.addEventListener('click',function(e){var r=v.getBoundingClientRect();window.ReactNativeWebView.postMessage(JSON.stringify({x:(e.clientX-r.left)/r.width,y:(e.clientY-r.top)/r.height}))});
v.onerror=function(){window.ReactNativeWebView.postMessage(JSON.stringify({error:true}))};
</script></body></html>`

  const onMessage = (event: WebViewMessageEvent) => {
    let data: { x?: number; y?: number; error?: boolean }
    try {
      data = JSON.parse(event.nativeEvent.data)
    } catch {
      return
    }
    if (data.error) setFailed(true)
    else if (onTap && data.x !== undefined && data.y !== undefined) onTap(data.x, data.y)
  }

  if (failed) {
    return (
      <YStack flex={1} items="center" justify="center" gap="3" bg="video">
        <Text fontSize="base" color="white" opacity={0.75}>
          No video from the robot
        </Text>
        <Button
          size="sm"
          onPress={() => {
            setFailed(false)
            setAttempt((n) => n + 1)
          }}
        >
          Retry
        </Button>
      </YStack>
    )
  }

  return (
    <View flex={1} bg="video">
      <WebView
        key={`${url}#${attempt}`}
        source={{ html }}
        originWhitelist={['*']}
        mixedContentMode="always"
        scrollEnabled={false}
        overScrollMode="never"
        style={{ flex: 1, backgroundColor: 'transparent' }}
        onMessage={onMessage}
      />
    </View>
  )
}
