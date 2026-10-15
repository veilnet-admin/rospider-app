import { useState } from 'react'
import { WebView, type WebViewMessageEvent } from 'react-native-webview'
import { Button, Text, View, YStack } from 'tamagui'

type Props = {
  url: string
  // normalized image coordinates of a tap, 0..1
  onTap?: (x: number, y: number) => void
}

// web_video_server streams multipart MJPEG, which an <img> in a WebView renders natively
export function MjpegView({ url, onTap }: Props) {
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)

  const html = `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1">
<style>html,body{margin:0;height:100%;background:#050608;overflow:hidden}body{display:flex;align-items:center;justify-content:center}img{max-width:100%;max-height:100%;object-fit:contain}</style>
</head><body><img id="v" src="${url}">
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
