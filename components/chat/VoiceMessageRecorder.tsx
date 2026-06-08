import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'

import {
  Animated,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import type { TextStyle, ViewStyle } from 'react-native'

import { Ionicons } from '@expo/vector-icons'
import { Audio } from 'expo-av'
import { useTranslation } from 'react-i18next'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import { runOnJS } from 'react-native-reanimated'

import { borderRadius, colors, spacing, typography } from '@/constants/theme'

type RecorderPhase = 'idle' | 'recording' | 'preview'

interface VoiceMessageRecorderProps {
  onSend: (localUri: string, durationSeconds: number) => void
  onCancel: () => void
}

const MIC_BUTTON_SIZE = spacing.xxxl
const PULSE_RING_SIZE = MIC_BUTTON_SIZE + spacing.lg
const SLIDE_CANCEL_THRESHOLD = -80
const LONG_PRESS_MIN_DURATION_MS = 200
const MAX_RECORDING_DURATION_MS = 60_000
const TIMER_INTERVAL_MS = 1_000
const PULSE_SCALE = 1.25
const PULSE_DURATION_MS = 600
const MIN_RECORDED_SECONDS = 1
const ICON_SIZE = typography.sizes.xl + spacing.xs
const ACTION_ICON_SIZE = typography.sizes.xl - spacing.xs / 2

const formatDuration = (seconds: number): string => {
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60

  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
}

export const VoiceMessageRecorder = ({
  onSend,
  onCancel,
}: VoiceMessageRecorderProps): React.JSX.Element => {
  const { t } = useTranslation()
  const [phaseState, setPhaseState] = useState<RecorderPhase>('idle')
  const [durationSeconds, setDurationSeconds] = useState<number>(0)
  const [previewUri, setPreviewUri] = useState<string | null>(null)

  const phaseRef = useRef<RecorderPhase>('idle')
  const recordingRef = useRef<Audio.Recording | null>(null)
  const durationTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const maxDurationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const slideXRef = useRef<number>(0)
  const startedAtRef = useRef<number | null>(null)
  const cancelledRef = useRef<boolean>(false)
  const isMountedRef = useRef<boolean>(false)
  const pulseAnim = useRef(new Animated.Value(1)).current
  const pulseLoopRef = useRef<Animated.CompositeAnimation | null>(null)

  const pulseScaleStyle = useMemo(
    () => ({
      transform: [{ scale: pulseAnim }],
    }),
    [pulseAnim]
  )

  const setPhase = useCallback((nextPhase: RecorderPhase): void => {
    phaseRef.current = nextPhase
    setPhaseState(nextPhase)
  }, [])

  const clearMaxDurationTimer = useCallback((): void => {
    if (maxDurationTimerRef.current === null) {
      return
    }

    clearTimeout(maxDurationTimerRef.current)
    maxDurationTimerRef.current = null
  }, [])

  const stopDurationTimer = useCallback((): void => {
    if (durationTimerRef.current === null) {
      return
    }

    clearInterval(durationTimerRef.current)
    durationTimerRef.current = null
  }, [])

  const getElapsedSeconds = useCallback((): number => {
    if (startedAtRef.current === null) {
      return durationSeconds
    }

    return Math.max(
      MIN_RECORDED_SECONDS,
      Math.ceil((Date.now() - startedAtRef.current) / TIMER_INTERVAL_MS)
    )
  }, [durationSeconds])

  const startDurationTimer = useCallback((): void => {
    setDurationSeconds(0)
    durationTimerRef.current = setInterval((): void => {
      if (startedAtRef.current === null) {
        setDurationSeconds(0)
        return
      }

      setDurationSeconds(
        Math.floor((Date.now() - startedAtRef.current) / TIMER_INTERVAL_MS)
      )
    }, TIMER_INTERVAL_MS)
  }, [])

  const stopPulse = useCallback((): void => {
    pulseLoopRef.current?.stop()
    pulseLoopRef.current = null
    pulseAnim.stopAnimation()
    pulseAnim.setValue(1)
  }, [pulseAnim])

  const startPulse = useCallback((): void => {
    pulseLoopRef.current?.stop()
    pulseAnim.setValue(1)

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: PULSE_SCALE,
          duration: PULSE_DURATION_MS,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: PULSE_DURATION_MS,
          useNativeDriver: true,
        }),
      ])
    )

    pulseLoopRef.current = loop
    loop.start()
  }, [pulseAnim])

  const stopRecordingAndPreview = useCallback(async (): Promise<void> => {
    if (phaseRef.current !== 'recording') {
      return
    }

    clearMaxDurationTimer()
    stopDurationTimer()
    stopPulse()

    const recording = recordingRef.current
    const nextDurationSeconds = getElapsedSeconds()

    if (recording === null) {
      onCancel()
      return
    }

    try {
      await recording.stopAndUnloadAsync()
      const uri = recording.getURI()
      recordingRef.current = null
      startedAtRef.current = null

      if (uri !== null && !cancelledRef.current && isMountedRef.current) {
        setDurationSeconds(nextDurationSeconds)
        setPreviewUri(uri)
        setPhase('preview')
        return
      }

      onCancel()
    } catch {
      recordingRef.current = null
      startedAtRef.current = null
      onCancel()
    }
  }, [
    clearMaxDurationTimer,
    getElapsedSeconds,
    onCancel,
    setPhase,
    stopDurationTimer,
    stopPulse,
  ])

  const cancelRecording = useCallback(async (): Promise<void> => {
    cancelledRef.current = true
    clearMaxDurationTimer()
    stopDurationTimer()
    stopPulse()

    const recording = recordingRef.current

    if (recording !== null) {
      try {
        await recording.stopAndUnloadAsync()
      } catch {
        // The recording is being discarded, so unload failures are non-fatal.
      }
    }

    recordingRef.current = null
    startedAtRef.current = null
    setPhase('idle')
    onCancel()
  }, [clearMaxDurationTimer, onCancel, setPhase, stopDurationTimer, stopPulse])

  const startRecording = useCallback(async (): Promise<void> => {
    if (phaseRef.current === 'recording') {
      return
    }

    try {
      const { status } = await Audio.requestPermissionsAsync()

      if (status !== 'granted') {
        onCancel()
        return
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      })

      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      )

      if (!isMountedRef.current) {
        await recording.stopAndUnloadAsync()
        return
      }

      recordingRef.current = recording
      cancelledRef.current = false
      startedAtRef.current = Date.now()
      slideXRef.current = 0
      setPreviewUri(null)
      setPhase('recording')
      startDurationTimer()
      startPulse()

      maxDurationTimerRef.current = setTimeout((): void => {
        void stopRecordingAndPreview()
      }, MAX_RECORDING_DURATION_MS)
    } catch {
      onCancel()
    }
  }, [
    onCancel,
    setPhase,
    startDurationTimer,
    startPulse,
    stopRecordingAndPreview,
  ])

  const handleGestureStart = useCallback((): void => {
    slideXRef.current = 0
    void startRecording()
  }, [startRecording])

  const handleGestureUpdate = useCallback((translationX: number): void => {
    slideXRef.current = translationX
  }, [])

  const handleGestureEnd = useCallback((): void => {
    if (phaseRef.current !== 'recording') {
      return
    }

    if (slideXRef.current < SLIDE_CANCEL_THRESHOLD) {
      void cancelRecording()
      return
    }

    void stopRecordingAndPreview()
  }, [cancelRecording, stopRecordingAndPreview])

  const longPressGesture = useMemo(
    () =>
      Gesture.LongPress()
        .minDuration(LONG_PRESS_MIN_DURATION_MS)
        .onStart((): void => {
          runOnJS(handleGestureStart)()
        }),
    [handleGestureStart]
  )

  const panGesture = useMemo(
    () =>
      Gesture.Pan()
        .onUpdate((event): void => {
          runOnJS(handleGestureUpdate)(event.translationX)
        })
        .onEnd((): void => {
          runOnJS(handleGestureEnd)()
        }),
    [handleGestureEnd, handleGestureUpdate]
  )

  const composedGesture = useMemo(
    () => Gesture.Simultaneous(longPressGesture, panGesture),
    [longPressGesture, panGesture]
  )

  useEffect(() => {
    isMountedRef.current = true

    Audio.setAudioModeAsync({
      allowsRecordingIOS: true,
      playsInSilentModeIOS: true,
    }).catch((): void => undefined)

    return (): void => {
      isMountedRef.current = false
      stopDurationTimer()
      clearMaxDurationTimer()
      stopPulse()

      const recording = recordingRef.current

      if (recording !== null) {
        recording.stopAndUnloadAsync().catch((): void => undefined)
        recordingRef.current = null
      }

      Audio.setAudioModeAsync({ allowsRecordingIOS: false }).catch(
        (): void => undefined
      )
    }
  }, [clearMaxDurationTimer, stopDurationTimer, stopPulse])

  const handleSend = useCallback((): void => {
    if (previewUri === null) {
      return
    }

    onSend(previewUri, durationSeconds)
  }, [durationSeconds, onSend, previewUri])

  if (phaseState === 'preview') {
    return (
      <View style={styles.previewContainer}>
        <Text style={styles.previewDuration}>
          {formatDuration(durationSeconds)}
        </Text>
        <View style={styles.previewActions}>
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={onCancel}
            activeOpacity={0.75}
            accessibilityLabel={t('chat.voice.cancel')}
          >
            <Ionicons
              name="trash-outline"
              size={ACTION_ICON_SIZE}
              color={colors.danger}
            />
            <Text style={styles.cancelLabel}>{t('chat.voice.cancel')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.sendButton}
            onPress={handleSend}
            activeOpacity={0.78}
            accessibilityLabel={t('chat.voice.send')}
          >
            <Ionicons name="send" size={ACTION_ICON_SIZE} color={colors.white} />
            <Text style={styles.sendLabel}>{t('chat.voice.send')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <Text style={styles.hint}>
        {phaseState === 'recording'
          ? `${formatDuration(durationSeconds)} ${t('chat.voice.slideCancel')}`
          : t('chat.voice.hold')}
      </Text>
      <GestureDetector gesture={composedGesture}>
        <View style={styles.micButtonWrapper}>
          <Animated.View
            style={[
              styles.pulseRing,
              pulseScaleStyle,
              phaseState !== 'recording' && styles.pulseRingHidden,
            ]}
          />
          <View
            style={[
              styles.micButton,
              phaseState === 'recording' && styles.micButtonActive,
            ]}
          >
            <Ionicons
              name="mic"
              size={ICON_SIZE}
              color={phaseState === 'recording' ? colors.white : colors.primary}
            />
          </View>
        </View>
      </GestureDetector>
    </View>
  )
}

const styles = StyleSheet.create({
  cancelButton: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  } satisfies ViewStyle,
  cancelLabel: {
    color: colors.danger,
    fontSize: typography.sizes.sm,
  } satisfies TextStyle,
  container: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderTopColor: colors.gray[200],
    borderTopWidth: 1,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  } satisfies ViewStyle,
  hint: {
    color: colors.gray[600],
    fontSize: typography.sizes.sm,
    marginBottom: spacing.sm,
    textAlign: 'center',
  } satisfies TextStyle,
  micButton: {
    alignItems: 'center',
    backgroundColor: colors.gray[100],
    borderRadius: borderRadius.full,
    height: MIC_BUTTON_SIZE,
    justifyContent: 'center',
    width: MIC_BUTTON_SIZE,
  } satisfies ViewStyle,
  micButtonActive: {
    backgroundColor: colors.primary,
  } satisfies ViewStyle,
  micButtonWrapper: {
    alignItems: 'center',
    height: PULSE_RING_SIZE,
    justifyContent: 'center',
    width: PULSE_RING_SIZE,
  } satisfies ViewStyle,
  previewActions: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
  } satisfies ViewStyle,
  previewContainer: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderTopColor: colors.gray[200],
    borderTopWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  } satisfies ViewStyle,
  previewDuration: {
    color: colors.gray[800],
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.medium,
  } satisfies TextStyle,
  pulseRing: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.full,
    height: PULSE_RING_SIZE,
    opacity: 0.2,
    position: 'absolute',
    width: PULSE_RING_SIZE,
  } satisfies ViewStyle,
  pulseRingHidden: {
    opacity: 0,
  } satisfies ViewStyle,
  sendButton: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    flexDirection: 'row',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  } satisfies ViewStyle,
  sendLabel: {
    color: colors.white,
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
  } satisfies TextStyle,
})
