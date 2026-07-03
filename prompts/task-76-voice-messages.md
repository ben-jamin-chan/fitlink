# CODEX PROMPT — Task 76: Voice Message Recording & Playback

@CONVENTIONS.md @ARCHITECT.md

---

## Context

Phase 3B begins here. Tasks 70–75 (Phase 3A) are fully complete. The current confirmed
state from CHANGELOG.md:

- `store/chatStore.ts` — `openChat`, `closeChat`, `sendMessage`, `sendImage`, `onTypingStart`,
  `markAsRead`, `flushOfflineQueue` all implemented. `sendVoiceMessage` does **not** yet exist.
- `services/firebase/realtime.ts` — `subscribeToMessages`, `sendTextMessage`, `sendImageMessage`,
  `markMessagesAsRead`, `setTypingStatus`, `subscribeToTyping`, `registerPresence`, `setOffline`,
  `subscribeToPresence` all implemented. RTDB message schema already supports `type: 'voice'`
  (per ARCHITECT.md `types/message.ts` `MessageType = 'text' | 'image' | 'voice'`).
  `sendVoiceMessage` does **not** yet exist.
- `services/firebase/storage.ts` — `uploadProfilePhoto`, `uploadAllProfilePhotos`,
  `deleteProfilePhoto`, `uploadVerificationSelfie` all implemented. `uploadVoiceMessage`
  does **not** yet exist.
- `components/chat/ChatInput.tsx` — mic button already rendered in the input row. It currently
  has no `onMicPress` handler; it is a visual stub awaiting this task.
- `app/chat/ChatScreen.tsx` — renders `MessageBubble` for `type: 'text'` and `type: 'image'`.
  No branch for `type: 'voice'` exists yet.
- `components/chat/MessageBubble.tsx` — `type: 'text'` and `type: 'image'` variants exist.
  No `type: 'voice'` branch exists yet.
- `types/message.ts` — `MessageType` union already includes `'voice'`.
- `i18n/en.json` — `chat.*` namespace exists. The following keys do **not** yet exist and
  must be added: `chat.voice.hold`, `chat.voice.slideCancel`, `chat.voice.send`,
  `chat.voice.cancel`, `chat.voice.heard`, `chat.voice.lastMessage`.
- `components/ui/MultiSelect.tsx`, `components/ui/SingleSelect.tsx` — exist; not relevant here.
- `store/matchStore.ts` — `matches` state; provides `matchId` to ChatScreen via navigation params.
- `constants/theme.ts` — re-exports `colors`, `spacing`, `typography`; use exclusively.
- `components/ui/LoadingOverlay.tsx` — exists; use for any full-screen blocking wait if needed.

**expo-av is not yet installed.** The very first step in this task is:
```bash
npx expo install expo-av
```
Do this before writing any code.

**Architectural boundary — Reanimated vs core Animated:**
`VoiceMessageRecorder` uses `Gesture.LongPress()` and `Gesture.Pan()` composed with
`Gesture.Simultaneous()` — this is RNGH v2 and requires `Animated` from React Native core
for the pulsing ring (no gesture interaction on the animation itself). Do **not** use
Reanimated's `useAnimatedStyle` or `withSpring` for the pulsing ring; React Native core
`Animated.loop` + `Animated.timing` is correct and sufficient. The rest of the codebase
uses Reanimated 3 for gesture-driven animations; the pulsing ring is display-only.

**Architectural boundary — audio session:**
`Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true })` must
be called before starting any recording and `Audio.setAudioModeAsync({ allowsRecordingIOS: false })`
must be called on `VoiceMessageRecorder` unmount. Both `Audio.Recording` and `Audio.Sound`
instances must be unloaded in `useEffect` cleanup. Never leave an active audio session open
after unmount.

**Architectural boundary — recording format:**
Use `Audio.RecordingOptionsPresets.HIGH_QUALITY` — it handles `.m4a` on iOS and `.3gp`
on Android without requiring manual format config.

**Architectural boundary — no new Cloud Functions:**
This task is entirely client-side + Storage upload. `sendVoiceMessage` in
`services/firebase/realtime.ts` writes to RTDB directly (same pattern as `sendImageMessage`).
No new Cloud Function is required for Task 76.

---

## Task 76 — Voice Message Recording & Playback

**Files to create:**
- `components/chat/VoiceMessageRecorder.tsx`
- `components/chat/VoiceMessageBubble.tsx`

**Files to modify:**
- `services/firebase/storage.ts` — add `uploadVoiceMessage()`
- `services/firebase/realtime.ts` — add `sendVoiceMessage()`
- `store/chatStore.ts` — add `sendVoiceMessage()` action
- `components/chat/ChatInput.tsx` — wire mic button to `isRecording` toggle
- `app/chat/ChatScreen.tsx` — render `VoiceMessageBubble` for `type === 'voice'`; overlay
  `VoiceMessageRecorder` when `isRecording` is true
- `i18n/en.json`, `i18n/my.json`, `i18n/zh.json`, `i18n/ta.json` — add `chat.voice.*` keys

---

### Install step (run before any code changes)

```bash
npx expo install expo-av
```

---

### `components/chat/VoiceMessageRecorder.tsx`

> Hold-to-record component rendered as a full-width overlay above `ChatInput` when the mic
> button is pressed. Manages the entire recording lifecycle: audio session setup, recording,
> preview (before send), and cancel. Uses RNGH v2 `Gesture.Simultaneous(LongPress, Pan)` for
> hold-to-record + slide-to-cancel. Pulsing animation uses React Native core `Animated`.
> Calls `onSend(localUri, durationSeconds)` when the user confirms send, or `onCancel()`
> when cancelled. This component is responsible for all audio session teardown on unmount —
> the parent (`ChatScreen`) never touches `Audio` directly.

```typescript
import React, { useCallback, useEffect, useRef, useState } from 'react'
import {
  Animated,
  Text,
  TouchableOpacity,
  View,
  StyleSheet,
  ViewStyle,
  TextStyle,
} from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import { runOnJS } from 'react-native-reanimated'
import { Audio } from 'expo-av'
import { Ionicons } from '@expo/vector-icons'
import { useTranslation } from 'react-i18next'

import { colors, spacing, typography } from '@/constants/theme'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface VoiceMessageRecorderProps {
  onSend: (localUri: string, durationSeconds: number) => void
  onCancel: () => void
}

type RecorderPhase = 'idle' | 'recording' | 'preview'

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const VoiceMessageRecorder = ({
  onSend,
  onCancel,
}: VoiceMessageRecorderProps): React.JSX.Element => {
  const { t } = useTranslation()

  // Phase state machine: idle → recording → preview (or back to idle on cancel)
  const [phase, setPhase] = useState<RecorderPhase>('idle')
  const [durationSeconds, setDurationSeconds] = useState<number>(0)
  const [previewUri, setPreviewUri] = useState<string | null>(null)
  const [isCancelled, setIsCancelled] = useState<boolean>(false)

  // Refs — kept stable across renders, do not trigger re-renders
  const recordingRef = useRef<Audio.Recording | null>(null)
  const durationTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const maxDurationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const slideXRef = useRef<number>(0)

  // Pulsing animation — React Native core Animated (no gesture interaction on this)
  const pulseAnim = useRef(new Animated.Value(1)).current

  // ---------------------------------------------------------------------------
  // Audio session setup / teardown
  // ---------------------------------------------------------------------------

  useEffect(() => {
    // Set audio mode to allow recording when the component mounts.
    // This is intentional: the user has already pressed the mic button to open this
    // overlay, so requesting recording mode immediately is correct.
    Audio.setAudioModeAsync({
      allowsRecordingIOS: true,
      playsInSilentModeIOS: true,
    }).catch(() => {
      // Silently handled — if mode fails, startAsync will also fail with a clear error
    })

    return () => {
      // Always restore audio mode and release the recording on unmount
      stopDurationTimer()
      clearMaxDurationTimer()
      Animated.timing(pulseAnim, { toValue: 1, duration: 0, useNativeDriver: true }).start()

      if (recordingRef.current) {
        recordingRef.current.stopAndUnloadAsync().catch(() => {})
        recordingRef.current = null
      }

      Audio.setAudioModeAsync({ allowsRecordingIOS: false }).catch(() => {})
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ---------------------------------------------------------------------------
  // Duration timer helpers
  // ---------------------------------------------------------------------------

  const startDurationTimer = useCallback((): void => {
    setDurationSeconds(0)
    durationTimerRef.current = setInterval(() => {
      setDurationSeconds((prev) => prev + 1)
    }, 1000)
  }, [])

  const stopDurationTimer = useCallback((): void => {
    if (durationTimerRef.current !== null) {
      clearInterval(durationTimerRef.current)
      durationTimerRef.current = null
    }
  }, [])

  const clearMaxDurationTimer = useCallback((): void => {
    if (maxDurationTimerRef.current !== null) {
      clearTimeout(maxDurationTimerRef.current)
      maxDurationTimerRef.current = null
    }
  }, [])

  // ---------------------------------------------------------------------------
  // Pulsing ring animation
  // ---------------------------------------------------------------------------

  const startPulse = useCallback((): void => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.25,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
      ])
    ).start()
  }, [pulseAnim])

  const stopPulse = useCallback((): void => {
    pulseAnim.stopAnimation()
    pulseAnim.setValue(1)
  }, [pulseAnim])

  // ---------------------------------------------------------------------------
  // Recording lifecycle
  // ---------------------------------------------------------------------------

  const startRecording = useCallback(async (): Promise<void> => {
    try {
      const { status } = await Audio.requestPermissionsAsync()
      if (status !== 'granted') {
        onCancel()
        return
      }

      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      )
      recordingRef.current = recording
      setIsCancelled(false)
      setPhase('recording')
      startDurationTimer()
      startPulse()

      // Auto-stop at 60 seconds
      maxDurationTimerRef.current = setTimeout(() => {
        stopRecordingAndPreview()
      }, 60_000)
    } catch {
      onCancel()
    }
  }, [onCancel, startDurationTimer, startPulse]) // stopRecordingAndPreview defined below

  const stopRecordingAndPreview = useCallback(async (): Promise<void> => {
    clearMaxDurationTimer()
    stopDurationTimer()
    stopPulse()

    const rec = recordingRef.current
    if (!rec) {
      onCancel()
      return
    }

    try {
      await rec.stopAndUnloadAsync()
      const uri = rec.getURI()
      recordingRef.current = null

      if (uri && !isCancelled) {
        setPreviewUri(uri)
        setPhase('preview')
      } else {
        onCancel()
      }
    } catch {
      recordingRef.current = null
      onCancel()
    }
  }, [clearMaxDurationTimer, stopDurationTimer, stopPulse, isCancelled, onCancel])

  const cancelRecording = useCallback(async (): Promise<void> => {
    setIsCancelled(true)
    clearMaxDurationTimer()
    stopDurationTimer()
    stopPulse()

    const rec = recordingRef.current
    if (rec) {
      try {
        await rec.stopAndUnloadAsync()
      } catch {
        // Swallow — we are discarding this recording
      }
      recordingRef.current = null
    }
    onCancel()
  }, [clearMaxDurationTimer, stopDurationTimer, stopPulse, onCancel])

  // ---------------------------------------------------------------------------
  // Gesture: LongPress + Pan (Simultaneous)
  // Press to start recording; slide left > 80px to cancel; release to preview.
  // ---------------------------------------------------------------------------

  const handleGestureStart = useCallback((): void => {
    slideXRef.current = 0
    startRecording()
  }, [startRecording])

  const handleGestureUpdate = useCallback((translationX: number): void => {
    slideXRef.current = translationX
  }, [])

  const handleGestureEnd = useCallback((): void => {
    if (slideXRef.current < -80) {
      cancelRecording()
    } else {
      stopRecordingAndPreview()
    }
  }, [cancelRecording, stopRecordingAndPreview])

  const longPressGesture = Gesture.LongPress().minDuration(200).onStart(() => {
    runOnJS(handleGestureStart)()
  })

  const panGesture = Gesture.Pan()
    .onUpdate((e) => {
      runOnJS(handleGestureUpdate)(e.translationX)
    })
    .onEnd(() => {
      runOnJS(handleGestureEnd)()
    })

  const composedGesture = Gesture.Simultaneous(longPressGesture, panGesture)

  // ---------------------------------------------------------------------------
  // Send / cancel from preview
  // ---------------------------------------------------------------------------

  const handleSend = useCallback((): void => {
    if (previewUri !== null) {
      onSend(previewUri, durationSeconds)
    }
  }, [previewUri, durationSeconds, onSend])

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  const formatDuration = (seconds: number): string => {
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  if (phase === 'preview') {
    return (
      <View style={styles.previewContainer}>
        <Text style={styles.previewDuration}>{formatDuration(durationSeconds)}</Text>
        <View style={styles.previewActions}>
          <TouchableOpacity style={styles.cancelButton} onPress={onCancel}>
            <Ionicons name="trash-outline" size={22} color={colors.danger} />
            <Text style={styles.cancelLabel}>{t('chat.voice.cancel')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.sendButton} onPress={handleSend}>
            <Ionicons name="send" size={22} color={colors.white} />
            <Text style={styles.sendLabel}>{t('chat.voice.send')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    )
  }

  // Idle or recording phase — show the hold-to-record control
  return (
    <View style={styles.container}>
      <Text style={styles.hint}>
        {phase === 'recording'
          ? `${formatDuration(durationSeconds)} — ${t('chat.voice.slideCancel')}`
          : t('chat.voice.hold')}
      </Text>
      <GestureDetector gesture={composedGesture}>
        <View style={styles.micButtonWrapper}>
          <Animated.View
            style={[
              styles.pulseRing,
              { transform: [{ scale: pulseAnim }] },
              phase !== 'recording' && styles.pulseRingHidden,
            ]}
          />
          <View
            style={[
              styles.micButton,
              phase === 'recording' && styles.micButtonActive,
            ]}
          >
            <Ionicons
              name="mic"
              size={28}
              color={phase === 'recording' ? colors.white : colors.primary}
            />
          </View>
        </View>
      </GestureDetector>
    </View>
  )
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const MIC_BUTTON_SIZE = 64
const PULSE_RING_SIZE = MIC_BUTTON_SIZE + 24

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.gray[200],
  } as ViewStyle,
  hint: {
    fontSize: typography.sizes.sm,
    color: colors.gray[600],
    marginBottom: spacing.sm,
    textAlign: 'center',
  } as TextStyle,
  micButtonWrapper: {
    width: PULSE_RING_SIZE,
    height: PULSE_RING_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  } as ViewStyle,
  pulseRing: {
    position: 'absolute',
    width: PULSE_RING_SIZE,
    height: PULSE_RING_SIZE,
    borderRadius: PULSE_RING_SIZE / 2,
    backgroundColor: colors.primary,
    opacity: 0.2,
  } as ViewStyle,
  pulseRingHidden: {
    opacity: 0,
  } as ViewStyle,
  micButton: {
    width: MIC_BUTTON_SIZE,
    height: MIC_BUTTON_SIZE,
    borderRadius: MIC_BUTTON_SIZE / 2,
    backgroundColor: colors.gray[100],
    alignItems: 'center',
    justifyContent: 'center',
  } as ViewStyle,
  micButtonActive: {
    backgroundColor: colors.primary,
  } as ViewStyle,
  // Preview phase
  previewContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.gray[200],
  } as ViewStyle,
  previewDuration: {
    fontSize: typography.sizes.md,
    color: colors.gray[800],
    fontWeight: String(typography.weights.medium) as TextStyle['fontWeight'],
  } as TextStyle,
  previewActions: {
    flexDirection: 'row',
    gap: spacing.md,
  } as ViewStyle,
  cancelButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  } as ViewStyle,
  cancelLabel: {
    fontSize: typography.sizes.sm,
    color: colors.danger,
  } as TextStyle,
  sendButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.primary,
    borderRadius: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  } as ViewStyle,
  sendLabel: {
    fontSize: typography.sizes.sm,
    color: colors.white,
    fontWeight: String(typography.weights.medium) as TextStyle['fontWeight'],
  } as TextStyle,
})
```

---

### `components/chat/VoiceMessageBubble.tsx`

> Renders a sent or received voice message within a chat bubble. Provides play/pause toggle,
> a static waveform bar visualisation (rows of `View`s with varying heights — no third-party
> library), a duration counter, and a "heard" colour state after full playback. Uses
> `Audio.Sound.createAsync()` from expo-av for playback. Must unload the sound on unmount
> via `useEffect` cleanup. `isOwnMessage` controls background colour (matches `MessageBubble`
> sent/received pattern). Used exclusively from `app/chat/ChatScreen.tsx`.

```typescript
import React, { useCallback, useEffect, useRef, useState } from 'react'
import {
  Animated,
  Text,
  TouchableOpacity,
  View,
  StyleSheet,
  ViewStyle,
  TextStyle,
} from 'react-native'
import { Audio, AVPlaybackStatus } from 'expo-av'
import { Ionicons } from '@expo/vector-icons'
import { useTranslation } from 'react-i18next'

import { colors, spacing, typography } from '@/constants/theme'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface VoiceMessageBubbleProps {
  audioUrl: string
  duration: number // seconds
  isOwnMessage: boolean
}

// ---------------------------------------------------------------------------
// Waveform bar heights — static, decorative visualisation
// ---------------------------------------------------------------------------

const WAVEFORM_BARS = [8, 16, 24, 12, 20, 28, 16, 10, 22, 18, 14, 26, 8, 20, 24]

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const VoiceMessageBubble = ({
  audioUrl,
  duration,
  isOwnMessage,
}: VoiceMessageBubbleProps): React.JSX.Element => {
  const { t } = useTranslation()

  const [isPlaying, setIsPlaying] = useState<boolean>(false)
  const [isHeard, setIsHeard] = useState<boolean>(false)
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0)

  // Progress: 0–1, drives waveform progress overlay width
  const progressAnim = useRef(new Animated.Value(0)).current
  const progressAnimRef = useRef<Animated.CompositeAnimation | null>(null)

  // Sound instance
  const soundRef = useRef<Audio.Sound | null>(null)

  // ---------------------------------------------------------------------------
  // Sound lifecycle
  // ---------------------------------------------------------------------------

  useEffect(() => {
    return () => {
      progressAnimRef.current?.stop()
      if (soundRef.current) {
        soundRef.current.unloadAsync().catch(() => {})
        soundRef.current = null
      }
    }
  }, [])

  const loadAndPlay = useCallback(async (): Promise<void> => {
    try {
      // Restore audio mode for playback (recording mode may have been set)
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
      })

      if (soundRef.current) {
        // Already loaded — just resume
        await soundRef.current.playAsync()
        startProgressAnimation(elapsedSeconds / duration)
        setIsPlaying(true)
        return
      }

      const { sound } = await Audio.Sound.createAsync(
        { uri: audioUrl },
        { shouldPlay: true },
        onPlaybackStatusUpdate
      )
      soundRef.current = sound
      startProgressAnimation(0)
      setIsPlaying(true)
    } catch {
      setIsPlaying(false)
    }
  }, [audioUrl, duration, elapsedSeconds]) // onPlaybackStatusUpdate, startProgressAnimation defined below

  const onPlaybackStatusUpdate = useCallback(
    (status: AVPlaybackStatus): void => {
      if (!status.isLoaded) return

      const elapsed = Math.floor((status.positionMillis ?? 0) / 1000)
      setElapsedSeconds(elapsed)

      if (status.didJustFinish) {
        setIsPlaying(false)
        setIsHeard(true)
        setElapsedSeconds(0)
        progressAnimRef.current?.stop()
        progressAnim.setValue(0)

        // Unload so next play restarts from beginning
        soundRef.current?.unloadAsync().catch(() => {})
        soundRef.current = null
      }
    },
    [progressAnim]
  )

  const pausePlayback = useCallback(async (): Promise<void> => {
    try {
      await soundRef.current?.pauseAsync()
      progressAnimRef.current?.stop()
      setIsPlaying(false)
    } catch {
      // Swallow — sound may have already been unloaded
    }
  }, [])

  // ---------------------------------------------------------------------------
  // Progress animation
  // ---------------------------------------------------------------------------

  const startProgressAnimation = useCallback(
    (fromFraction: number): void => {
      progressAnim.setValue(fromFraction)
      const remainingMs = (1 - fromFraction) * duration * 1000
      if (remainingMs <= 0) return

      progressAnimRef.current = Animated.timing(progressAnim, {
        toValue: 1,
        duration: remainingMs,
        useNativeDriver: false, // Driving layout width — cannot use native driver
      })
      progressAnimRef.current.start()
    },
    [progressAnim, duration]
  )

  // ---------------------------------------------------------------------------
  // Toggle play / pause
  // ---------------------------------------------------------------------------

  const handleToggle = useCallback((): void => {
    if (isPlaying) {
      pausePlayback()
    } else {
      loadAndPlay()
    }
  }, [isPlaying, pausePlayback, loadAndPlay])

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  const formatDuration = (seconds: number): string => {
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  const displayDuration = isPlaying || elapsedSeconds > 0
    ? formatDuration(elapsedSeconds)
    : formatDuration(duration)

  const bubbleBg = isOwnMessage ? colors.primary : colors.gray[100]
  const textColor = isOwnMessage ? colors.white : colors.gray[800]
  const iconColor = isOwnMessage ? colors.white : colors.primary
  const waveformActiveColor = isHeard
    ? colors.secondary
    : isOwnMessage
    ? colors.white
    : colors.primary
  const waveformInactiveColor = isOwnMessage
    ? 'rgba(255,255,255,0.35)'
    : colors.gray[400]

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <View style={[styles.bubble, { backgroundColor: bubbleBg }]}>
      {/* Play / Pause button */}
      <TouchableOpacity
        onPress={handleToggle}
        style={styles.playButton}
        accessibilityLabel={isPlaying ? t('chat.voice.heard') : t('chat.voice.send')}
      >
        <Ionicons
          name={isPlaying ? 'pause' : 'play'}
          size={20}
          color={iconColor}
        />
      </TouchableOpacity>

      {/* Waveform bars with progress overlay */}
      <View style={styles.waveformContainer}>
        {/* Progress overlay — width driven by Animated.Value */}
        <Animated.View
          style={[
            styles.waveformProgressOverlay,
            {
              width: progressAnim.interpolate({
                inputRange: [0, 1],
                outputRange: ['0%', '100%'],
              }),
            },
          ]}
          pointerEvents="none"
        />
        {WAVEFORM_BARS.map((height, index) => (
          <View
            key={index}
            style={[
              styles.waveformBar,
              { height, backgroundColor: waveformInactiveColor },
            ]}
          />
        ))}
        {/* Active bars rendered as absolute overlay, clipped by progress overlay */}
        <Animated.View
          style={[
            styles.waveformActiveMask,
            {
              width: progressAnim.interpolate({
                inputRange: [0, 1],
                outputRange: ['0%', '100%'],
              }),
            },
          ]}
          pointerEvents="none"
        >
          <View style={styles.waveformActiveInner}>
            {WAVEFORM_BARS.map((height, index) => (
              <View
                key={index}
                style={[
                  styles.waveformBar,
                  { height, backgroundColor: waveformActiveColor },
                ]}
              />
            ))}
          </View>
        </Animated.View>
      </View>

      {/* Duration label */}
      <Text style={[styles.duration, { color: textColor }]}>{displayDuration}</Text>
    </View>
  )
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const WAVEFORM_HEIGHT = 32
const BAR_WIDTH = 3
const BAR_GAP = 2

const styles = StyleSheet.create({
  bubble: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: spacing.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
    maxWidth: 240,
  } as ViewStyle,
  playButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  } as ViewStyle,
  waveformContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    height: WAVEFORM_HEIGHT,
    overflow: 'hidden',
    position: 'relative',
    gap: BAR_GAP,
    flex: 1,
  } as ViewStyle,
  waveformProgressOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    height: WAVEFORM_HEIGHT,
    // transparent — used only for measuring progress width
    backgroundColor: 'transparent',
  } as ViewStyle,
  waveformBar: {
    width: BAR_WIDTH,
    borderRadius: BAR_WIDTH / 2,
    alignSelf: 'center',
  } as ViewStyle,
  waveformActiveMask: {
    position: 'absolute',
    top: 0,
    left: 0,
    height: WAVEFORM_HEIGHT,
    overflow: 'hidden',
  } as ViewStyle,
  waveformActiveInner: {
    flexDirection: 'row',
    alignItems: 'center',
    height: WAVEFORM_HEIGHT,
    gap: BAR_GAP,
  } as ViewStyle,
  duration: {
    fontSize: typography.sizes.xs,
    minWidth: 32,
    textAlign: 'right',
  } as TextStyle,
})
```

---

### `services/firebase/storage.ts` — Update

> Add `uploadVoiceMessage()` after the existing `uploadVerificationSelfie()` export.
> Do not modify any other function in this file.

```typescript
// Add this import at the top of the file alongside existing Storage imports:
import { getDownloadURL, ref as storageRef, uploadBytesResumable } from 'firebase/storage'

// Add after uploadVerificationSelfie():

/**
 * Uploads a voice message recording to Firebase Storage.
 * Storage path: chats/{matchId}/audio/{uuid}.m4a (iOS) or .3gp (Android)
 * Returns the public download URL for inclusion in the RTDB message.
 */
export const uploadVoiceMessage = async (
  matchId: string,
  localUri: string
): Promise<string> => {
  const extension = localUri.endsWith('.3gp') ? '3gp' : 'm4a'
  const uuid = `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
  const path = `chats/${matchId}/audio/${uuid}.${extension}`

  const response = await fetch(localUri)
  const blob = await response.blob()

  const fileRef = storageRef(storage, path)
  const uploadTask = uploadBytesResumable(fileRef, blob)

  return new Promise<string>((resolve, reject) => {
    uploadTask.on(
      'state_changed',
      () => {},
      (error) => reject(error),
      async () => {
        const url = await getDownloadURL(uploadTask.snapshot.ref)
        resolve(url)
      }
    )
  })
}
```

> **Note:** The `storage` export from `services/firebase/config.ts` is already imported at
> the top of `services/firebase/storage.ts`. Do not add a duplicate import.

---

### `services/firebase/realtime.ts` — Update

> Add `sendVoiceMessage()` after the existing `sendImageMessage()` export.
> Do not modify any other function in this file.

```typescript
// Add after sendImageMessage():

/**
 * Sends a voice message to the RTDB chat.
 * Updates the Firestore match document's lastMessage and lastMessageAt fields.
 * Increments the recipient's unread count on the Firestore match document.
 * (Push notification is sent automatically by the existing onNewMessage Cloud Function.)
 */
export const sendVoiceMessage = async (
  matchId: string,
  senderId: string,
  audioUrl: string,
  durationSeconds: number
): Promise<void> => {
  const messagesRef = ref(rtdb, `chats/${matchId}/messages`)
  const newMessageRef = push(messagesRef)

  await set(newMessageRef, {
    senderId,
    text: null,
    imageUrl: null,
    audioUrl,
    durationSeconds,
    type: 'voice',
    timestamp: serverTimestamp(),
    read: false,
  })

  // Update Firestore match metadata — same pattern as sendImageMessage()
  const matchRef = doc(db, 'matches', matchId)
  const matchSnap = await getDoc(matchRef)
  if (!matchSnap.exists()) return

  const matchData = matchSnap.data()
  const users = matchData['users'] as string[]
  const recipientId = users.find((uid) => uid !== senderId) ?? ''

  await updateDoc(matchRef, {
    lastMessage: '🎤', // resolved by onNewMessage CF for push notification body
    lastMessageAt: firestoreServerTimestamp(),
    [`${recipientId}_unread`]: increment(1),
  })
}
```

> **Import check:** `ref`, `push`, `set`, `serverTimestamp` from `'firebase/database'`;
> `doc`, `getDoc`, `updateDoc`, `increment`, `serverTimestamp as firestoreServerTimestamp`
> from `'firebase/firestore'` — all should already be imported. Alias the Firestore
> `serverTimestamp` if both are in scope to avoid name collision.

---

### `store/chatStore.ts` — Update

> Add `sendVoiceMessage()` action. Do not modify any existing action.

```typescript
// Add this import at the top alongside existing service imports:
import { uploadVoiceMessage } from '@/services/firebase/storage'
import {
  sendVoiceMessage as rtdbSendVoiceMessage,
} from '@/services/firebase/realtime'

// Add inside the Zustand store definition, after sendImage():

sendVoiceMessage: async (localUri: string, durationSeconds: number): Promise<void> => {
  const { activeMatchId } = get()
  const uid = useAuthStore.getState().user?.uid
  if (!activeMatchId || !uid) return

  try {
    const audioUrl = await uploadVoiceMessage(activeMatchId, localUri)
    await rtdbSendVoiceMessage(activeMatchId, uid, audioUrl, durationSeconds)
  } catch {
    // Silently handled — the user can retry by re-sending
    // Crashlytics integration (Task 67) already wires error logging from stores
  }
},
```

> Do not touch `sendMessage`, `sendImage`, `openChat`, `closeChat`, `markAsRead`,
> `flushOfflineQueue`, or `onTypingStart`.

---

### `components/chat/ChatInput.tsx` — Update

> The mic button already exists visually. This update adds `onMicPress` prop support and
> wires a `isRecording` prop that disables all other input controls while recording is active.
> Do not rewrite the component — make targeted additions only.

```typescript
// 1. Update the props interface (add two new props):
interface ChatInputProps {
  onSend: (text: string) => void
  onImagePress: () => void
  onMicPress: () => void          // NEW — toggles recorder overlay in ChatScreen
  isRecording: boolean            // NEW — disables text input and image button during recording
}

// 2. Update the component signature to destructure the new props:
export const ChatInput = ({
  onSend,
  onImagePress,
  onMicPress,
  isRecording,
}: ChatInputProps): React.JSX.Element => {

// 3. In the mic button's TouchableOpacity, replace the existing no-op onPress with:
//    onPress={onMicPress}

// 4. Disable the image picker button and text input while isRecording is true:
//    On the image picker TouchableOpacity: add `disabled={isRecording}`
//    On the TextInput: add `editable={!isRecording}`

// 5. Do not touch the send button logic, text state, or StyleSheet.
```

> The existing mic button Ionicons icon, styling, and positioning stay unchanged.

---

### `app/chat/ChatScreen.tsx` — Update

> Add `VoiceMessageRecorder` overlay and `VoiceMessageBubble` rendering.
> Make targeted additions only — do not rewrite the screen.

```typescript
// 1. Add imports at the correct position in the import block:
import { VoiceMessageRecorder } from '@/components/chat/VoiceMessageRecorder'
import { VoiceMessageBubble } from '@/components/chat/VoiceMessageBubble'

// 2. Add local state for the recorder overlay:
const [isRecording, setIsRecording] = useState<boolean>(false)

// 3. Add handlers:
const handleMicPress = useCallback((): void => {
  setIsRecording(true)
}, [])

const handleVoiceSend = useCallback(
  async (localUri: string, durationSeconds: number): Promise<void> => {
    setIsRecording(false)
    await chatStore.sendVoiceMessage(localUri, durationSeconds)
  },
  [chatStore]
)

const handleVoiceCancel = useCallback((): void => {
  setIsRecording(false)
}, [])

// 4. In the MessageBubble render section, add a branch for voice messages.
//    The existing pattern renders MessageBubble for type 'text' and 'image'.
//    Add alongside it:
//
//    if (item.type === 'voice' && item.audioUrl) {
//      return (
//        <VoiceMessageBubble
//          audioUrl={item.audioUrl}
//          duration={item.durationSeconds ?? 0}
//          isOwnMessage={item.senderId === currentUserId}
//        />
//      )
//    }

// 5. Pass the new props to ChatInput:
//    onMicPress={handleMicPress}
//    isRecording={isRecording}

// 6. Render VoiceMessageRecorder conditionally ABOVE ChatInput when isRecording is true:
//    {isRecording && (
//      <VoiceMessageRecorder
//        onSend={handleVoiceSend}
//        onCancel={handleVoiceCancel}
//      />
//    )}
//    <ChatInput ... />

// 7. Extend the RTDBMessage type handling: the RTDB message shape now includes
//    audioUrl?: string and durationSeconds?: number — update the local Message type
//    or casting in chatStore/realtime.ts if needed for TypeScript strict compliance.
//    If types/message.ts already has audioUrl and durationSeconds fields, no change needed.
//    If not, add them as optional fields:
//    audioUrl?: string
//    durationSeconds?: number

// Do not touch the existing FlatList, header, typing indicator, image message flow,
// unmatch flow, or any existing StyleSheet entries.
```

---

### `types/message.ts` — Update (if needed)

> If `audioUrl` and `durationSeconds` are not already on the `Message` interface, add them
> as optional fields. This is a non-breaking addition — existing `text` and `image` messages
> simply have `undefined` for these fields.

```typescript
// In the Message interface, add after imageUrl (or the last existing field):
audioUrl?: string
durationSeconds?: number
```

> If these fields already exist (check the file before modifying), skip this update entirely.

---

### i18n updates — all 4 language files

> Add the following keys to the `chat` namespace in `i18n/en.json`, `i18n/my.json`,
> `i18n/zh.json`, and `i18n/ta.json`. Use the English value as a placeholder in all
> non-English files.

**`i18n/en.json`** — add inside the `"chat"` object:
```json
"voice": {
  "hold": "Hold to record",
  "slideCancel": "Slide left to cancel",
  "send": "Send",
  "cancel": "Cancel",
  "heard": "Heard",
  "lastMessage": "🎤 Voice message"
}
```

**`i18n/my.json`** — same keys, English values as placeholders:
```json
"voice": {
  "hold": "Hold to record",
  "slideCancel": "Slide left to cancel",
  "send": "Send",
  "cancel": "Cancel",
  "heard": "Heard",
  "lastMessage": "🎤 Voice message"
}
```

**`i18n/zh.json`** — same keys, English values as placeholders:
```json
"voice": {
  "hold": "Hold to record",
  "slideCancel": "Slide left to cancel",
  "send": "Send",
  "cancel": "Cancel",
  "heard": "Heard",
  "lastMessage": "🎤 Voice message"
}
```

**`i18n/ta.json`** — same keys, English values as placeholders:
```json
"voice": {
  "hold": "Hold to record",
  "slideCancel": "Slide left to cancel",
  "send": "Send",
  "cancel": "Cancel",
  "heard": "Heard",
  "lastMessage": "🎤 Voice message"
}
```

---

## Important Architecture Notes for Codex

1. **Audio session must be torn down on unmount.** Both `Audio.Recording` and `Audio.Sound`
   instances must be unloaded in their respective `useEffect` cleanup functions. Never
   allow an active recording or sound instance to outlive the component. The cleanup in
   `VoiceMessageRecorder` must call `recording.stopAndUnloadAsync()` and
   `Audio.setAudioModeAsync({ allowsRecordingIOS: false })`. The cleanup in
   `VoiceMessageBubble` must call `sound.unloadAsync()`.

2. **React Native core `Animated`, not Reanimated, for the pulsing ring.** The pulsing
   ring in `VoiceMessageRecorder` is display-only — it has no gesture interaction. Use
   `Animated.loop` + `Animated.timing` from React Native core with `useNativeDriver: true`.
   Do not import Reanimated APIs for this animation.

3. **`Gesture.Simultaneous(LongPress, Pan)` is the correct gesture composition.** This
   follows the RNGH v2 pattern already established in `SwipeCard.tsx`. Never use
   `PanResponder` or the deprecated `useAnimatedGestureHandler`.

4. **`useNativeDriver: false` is required for the waveform progress animation.** The
   progress animation drives layout width (a non-transform property) on `VoiceMessageBubble`.
   Native driver cannot drive layout properties — use `useNativeDriver: false` specifically
   for the `Animated.timing` that drives `progressAnim`.

5. **`runOnJS()` is required for all JS-thread callbacks inside gesture worklets.**
   `handleGestureStart`, `handleGestureUpdate`, and `handleGestureEnd` must be wrapped in
   `runOnJS()` inside the gesture `.onStart()`, `.onUpdate()`, and `.onEnd()` callbacks.
   Never call state setters or async functions directly from a worklet.

6. **Audio format: use `Audio.RecordingOptionsPresets.HIGH_QUALITY`.** Do not manually
   configure `RecordingOptions`. The preset handles `.m4a` on iOS and `.3gp` on Android
   without additional config.

7. **`uploadVoiceMessage` uses the local URI file extension to choose the path suffix.**
   Detect `.3gp` vs `.m4a` from the URI string. Firebase Storage does not enforce the
   extension, but the correct extension makes the file playable without negotiation.

8. **`sendVoiceMessage` in `realtime.ts` must update Firestore `lastMessage` to the i18n
   key string `'🎤'` — not the translated text.** The emoji is language-neutral. The
   `onNewMessage` Cloud Function already builds the push notification body from the raw
   RTDB message; the Firestore `lastMessage` field is displayed in `MessageListItem` and
   should display the emoji consistently regardless of the recipient's language.

9. **Do not block the main thread during upload.** `uploadVoiceMessage` is called from
   `chatStore.sendVoiceMessage()` which is called from `handleVoiceSend` in `ChatScreen`.
   The recorder overlay is dismissed (`setIsRecording(false)`) before `await` — this
   ensures `VoiceMessageRecorder` unmounts and cleans up the audio session before the
   upload begins. Do not await the upload inside the recorder component.

10. **`expo-av` requires a development build for full recording capability on iOS.**
    Document in `BUILD.md` that voice messages require a development build. The component
    must not crash in Expo Go — it should show a graceful permission denial state.

---

## Acceptance Criteria

- [ ] `npx expo install expo-av` completed before any code changes
- [ ] `components/chat/VoiceMessageRecorder.tsx` created with named export `VoiceMessageRecorder`
- [ ] `VoiceMessageRecorder` uses `Gesture.Simultaneous(LongPress, Pan)` from RNGH v2
- [ ] Pulsing ring uses React Native core `Animated.loop` with `useNativeDriver: true`
- [ ] `Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true })` called on mount
- [ ] `Audio.setAudioModeAsync({ allowsRecordingIOS: false })` called in `useEffect` cleanup
- [ ] `recording.stopAndUnloadAsync()` called in `useEffect` cleanup of `VoiceMessageRecorder`
- [ ] Slide-left > 80px horizontal translation cancels the recording
- [ ] Max 60-second auto-stop is implemented via `setTimeout`
- [ ] Preview phase shows duration, Send, and Cancel (trash icon) controls
- [ ] `components/chat/VoiceMessageBubble.tsx` created with named export `VoiceMessageBubble`
- [ ] `sound.unloadAsync()` called in `useEffect` cleanup of `VoiceMessageBubble`
- [ ] `useNativeDriver: false` used for progress animation driving layout width
- [ ] Waveform bars use `WAVEFORM_BARS` static array — no third-party waveform library
- [ ] "Heard" state changes waveform colour to `colors.secondary` after full playback
- [ ] `services/firebase/storage.ts` exports `uploadVoiceMessage(matchId, localUri): Promise<string>`
- [ ] Storage path: `chats/{matchId}/audio/{uuid}.{ext}` where ext is `m4a` or `3gp`
- [ ] `services/firebase/realtime.ts` exports `sendVoiceMessage(matchId, senderId, audioUrl, durationSeconds)`
- [ ] RTDB message written with `type: 'voice'`, `audioUrl`, `durationSeconds`, `timestamp: serverTimestamp()`
- [ ] Firestore match `lastMessage` updated to `'🎤'` and `lastMessageAt` updated
- [ ] `store/chatStore.ts` exports `sendVoiceMessage(localUri, durationSeconds): Promise<void>`
- [ ] `chatStore.sendVoiceMessage` calls `uploadVoiceMessage` then `rtdbSendVoiceMessage`
- [ ] `components/chat/ChatInput.tsx` accepts `onMicPress` and `isRecording` props
- [ ] Mic button in `ChatInput` calls `onMicPress` when pressed
- [ ] Text input and image button disabled when `isRecording === true`
- [ ] `app/chat/ChatScreen.tsx` renders `VoiceMessageRecorder` above `ChatInput` when `isRecording` is true
- [ ] `app/chat/ChatScreen.tsx` renders `VoiceMessageBubble` for messages with `type === 'voice'`
- [ ] `handleVoiceSend` sets `isRecording(false)` before calling `chatStore.sendVoiceMessage`
- [ ] `types/message.ts` includes `audioUrl?: string` and `durationSeconds?: number`
- [ ] `chat.voice.*` keys added to all 4 language files (`en.json`, `my.json`, `zh.json`, `ta.json`)
- [ ] Zero inline `style={{ }}` in any new or modified file
- [ ] Zero `any` in any new or modified file
- [ ] Zero `console.log` or `console.error` in any new or modified file
- [ ] All imports use `@/` alias — no relative paths
- [ ] `npx tsc --noEmit` passes with zero errors after this task

---

## Do Not Touch

`App.tsx`, `store/authStore.ts`, `store/discoveryStore.ts`, `store/matchStore.ts`,
`store/subscriptionStore.ts`, `store/fitnessStore.ts`, `store/profileStore.ts`,
`store/onboardingStore.ts`, `store/toastStore.ts`, `services/firebase/config.ts`,
`services/firebase/auth.ts`, `services/firebase/firestore.ts`, `services/strava.ts`,
`services/stripe.ts`, `services/notifications.ts`, `hooks/useMatchFilter.ts`,
`components/matches/MatchFilterSheet.tsx`, `app/matches/MatchesScreen.tsx`,
`components/chat/MessageBubble.tsx`, `components/chat/MatchCard.tsx`,
`components/chat/MessageListItem.tsx`, `components/discovery/SwipeCard.tsx`,
`components/discovery/FullProfileModal.tsx`, `components/discovery/ActionButtons.tsx`,
`components/profile/BoostCard.tsx`, `components/settings/IncognitoToggleCard.tsx`,
`functions/src/`, `firestore.rules`, `firestore.indexes.json`, `constants/`,
`types/user.ts`, `types/event.ts`, `types/checkin.ts`, `types/subscription.ts`,
`types/fitness.ts`

---

## Commit

```
git commit -m "task-76: voice message recording and playback"
```

---

## After This Session

Update `CHANGELOG.md`:

```
## [Phase 3B — Task 76] — YYYY-MM-DD

### Completed

- Task 76: Voice Message Recording & Playback
- VoiceMessageRecorder: hold-to-record overlay using Gesture.Simultaneous(LongPress, Pan);
  slide-left > 80px cancels; 60-second auto-stop; preview phase with Send/Cancel controls;
  audio session setup/teardown via expo-av
- VoiceMessageBubble: play/pause toggle; static waveform bar visualisation; progress
  animation via Animated.timing (useNativeDriver: false); "heard" state on playback completion;
  isOwnMessage controls colour scheme
- uploadVoiceMessage: Storage upload to chats/{matchId}/audio/{uuid}.{ext}; returns download URL
- sendVoiceMessage (realtime.ts): RTDB write with type: 'voice', audioUrl, durationSeconds;
  Firestore lastMessage and lastMessageAt updated; recipient unread incremented
- chatStore.sendVoiceMessage: upload then RTDB send; recorder overlay dismissed before upload
- ChatInput: onMicPress and isRecording props added; text input and image button disabled
  during recording
- ChatScreen: VoiceMessageRecorder overlay rendered above ChatInput; VoiceMessageBubble
  rendered for type === 'voice' messages
- chat.voice.* i18n keys added to all 4 language files

### Files Created / Modified

- components/chat/VoiceMessageRecorder.tsx: created — named export, hold-to-record gesture,
  audio lifecycle, preview phase
- components/chat/VoiceMessageBubble.tsx: created — named export, playback controls,
  static waveform, progress animation, heard state
- services/firebase/storage.ts: uploadVoiceMessage() added
- services/firebase/realtime.ts: sendVoiceMessage() added
- store/chatStore.ts: sendVoiceMessage() action added
- components/chat/ChatInput.tsx: onMicPress and isRecording props wired
- app/chat/ChatScreen.tsx: recorder overlay and VoiceMessageBubble rendering added
- types/message.ts: audioUrl? and durationSeconds? fields added (if not already present)
- i18n/en.json, my.json, zh.json, ta.json: chat.voice.* keys added
- BUILD.md: expo-av development build requirement documented
- CHANGELOG.md: Task 76 entry added

### Architecture Decisions

- [Describe any deviations from the prompt scaffold — e.g. if audioUrl/durationSeconds
  were already on Message, note that types/message.ts was not modified]
- [Note if any import aliasing was required for serverTimestamp collision]

### Known Issues / Deferred

- Voice messages require a development build; cannot be tested in Expo Go
- Actual waveform visualisation (from audio sample data) deferred — static bar heights used

### Next Up

- Task 77: Video Profile Loop (expo-video, VideoProfilePicker, FullProfileModal video tab,
  SwipeCard 🎥 badge, no autoplay in discovery)
```

Then return to claude.ai with the updated `CHANGELOG.md` to generate the Task 77 prompt.

---

## Reasoning Level

High
