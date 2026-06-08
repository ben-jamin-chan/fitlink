import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'

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
import type { AVPlaybackStatus } from 'expo-av'
import { useTranslation } from 'react-i18next'

import { borderRadius, colors, spacing, typography } from '@/constants/theme'

interface VoiceMessageBubbleProps {
  audioUrl: string
  duration: number
  isOwnMessage: boolean
}

const WAVEFORM_BARS = [
  8,
  16,
  24,
  12,
  20,
  28,
  16,
  10,
  22,
  18,
  14,
  26,
  8,
  20,
  24,
] as const

type WaveformBarHeight = (typeof WAVEFORM_BARS)[number]

const WAVEFORM_HEIGHT = spacing.xl
const WAVEFORM_BAR_WIDTH = spacing.xs - 1
const WAVEFORM_BAR_GAP = spacing.xs / 2
const WAVEFORM_WIDTH =
  WAVEFORM_BARS.length * WAVEFORM_BAR_WIDTH +
  (WAVEFORM_BARS.length - 1) * WAVEFORM_BAR_GAP
const PLAY_BUTTON_SIZE = spacing.xl
const PLAY_ICON_SIZE = typography.sizes.md + spacing.xs
const VOICE_BUBBLE_MAX_WIDTH = spacing.xxxl * 4
const MIN_PLAYBACK_SECONDS = 1

const formatDuration = (seconds: number): string => {
  const safeSeconds = Math.max(0, seconds)
  const minutes = Math.floor(safeSeconds / 60)
  const remainingSeconds = safeSeconds % 60

  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
}

const getPlaybackDuration = (duration: number): number =>
  Math.max(MIN_PLAYBACK_SECONDS, duration)

const getWaveformBarHeightStyle = (
  height: WaveformBarHeight
): ViewStyle => {
  switch (height) {
    case 8:
      return styles.waveformBarHeight8
    case 10:
      return styles.waveformBarHeight10
    case 12:
      return styles.waveformBarHeight12
    case 14:
      return styles.waveformBarHeight14
    case 16:
      return styles.waveformBarHeight16
    case 18:
      return styles.waveformBarHeight18
    case 20:
      return styles.waveformBarHeight20
    case 22:
      return styles.waveformBarHeight22
    case 24:
      return styles.waveformBarHeight24
    case 26:
      return styles.waveformBarHeight26
    case 28:
      return styles.waveformBarHeight28
  }
}

export const VoiceMessageBubble = ({
  audioUrl,
  duration,
  isOwnMessage,
}: VoiceMessageBubbleProps): React.JSX.Element => {
  const { t } = useTranslation()
  const [isPlaying, setIsPlaying] = useState<boolean>(false)
  const [isHeard, setIsHeard] = useState<boolean>(false)
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0)

  const progressAnim = useRef(new Animated.Value(0)).current
  const progressAnimRef = useRef<Animated.CompositeAnimation | null>(null)
  const soundRef = useRef<Audio.Sound | null>(null)
  const isMountedRef = useRef<boolean>(true)

  const progressWidthStyle = useMemo(
    () => ({
      width: progressAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [0, WAVEFORM_WIDTH],
      }),
    }),
    [progressAnim]
  )

  const startProgressAnimation = useCallback(
    (fromFraction: number): void => {
      const clampedFraction = Math.min(Math.max(fromFraction, 0), 1)
      const remainingMs =
        (1 - clampedFraction) * getPlaybackDuration(duration) * 1000

      progressAnimRef.current?.stop()
      progressAnim.setValue(clampedFraction)

      if (remainingMs <= 0) {
        return
      }

      progressAnimRef.current = Animated.timing(progressAnim, {
        toValue: 1,
        duration: remainingMs,
        useNativeDriver: false,
      })
      progressAnimRef.current.start()
    },
    [duration, progressAnim]
  )

  const onPlaybackStatusUpdate = useCallback(
    (status: AVPlaybackStatus): void => {
      if (!status.isLoaded || !isMountedRef.current) {
        return
      }

      const nextElapsedSeconds = Math.floor(status.positionMillis / 1000)
      setElapsedSeconds(nextElapsedSeconds)

      if (!status.didJustFinish) {
        return
      }

      setIsPlaying(false)
      setIsHeard(true)
      setElapsedSeconds(0)
      progressAnimRef.current?.stop()
      progressAnim.setValue(0)

      soundRef.current?.unloadAsync().catch((): void => undefined)
      soundRef.current = null
    },
    [progressAnim]
  )

  const pausePlayback = useCallback(async (): Promise<void> => {
    try {
      await soundRef.current?.pauseAsync()
      progressAnimRef.current?.stop()
      setIsPlaying(false)
    } catch {
      setIsPlaying(false)
    }
  }, [])

  const loadAndPlay = useCallback(async (): Promise<void> => {
    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
      })

      if (soundRef.current !== null) {
        await soundRef.current.playAsync()
        startProgressAnimation(
          elapsedSeconds / getPlaybackDuration(duration)
        )
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
  }, [
    audioUrl,
    duration,
    elapsedSeconds,
    onPlaybackStatusUpdate,
    startProgressAnimation,
  ])

  const handleToggle = useCallback((): void => {
    if (isPlaying) {
      void pausePlayback()
      return
    }

    void loadAndPlay()
  }, [isPlaying, loadAndPlay, pausePlayback])

  useEffect(() => {
    isMountedRef.current = true

    return (): void => {
      isMountedRef.current = false
      progressAnimRef.current?.stop()

      if (soundRef.current !== null) {
        soundRef.current.unloadAsync().catch((): void => undefined)
        soundRef.current = null
      }
    }
  }, [])

  const displayDuration =
    isPlaying || elapsedSeconds > 0
      ? formatDuration(elapsedSeconds)
      : formatDuration(duration)
  const inactiveWaveformStyle = isOwnMessage
    ? styles.waveformBarMineInactive
    : styles.waveformBarTheirsInactive
  const activeWaveformStyle = isHeard
    ? styles.waveformBarHeard
    : isOwnMessage
      ? styles.waveformBarMineActive
      : styles.waveformBarTheirsActive
  const iconColor = isOwnMessage ? colors.white : colors.primary
  const playButtonLabel = isPlaying
    ? t('chat.voice.pause')
    : t('chat.voice.play')

  return (
    <View style={[styles.row, isOwnMessage ? styles.rowMine : styles.rowTheirs]}>
      <View
        style={[
          styles.bubble,
          isOwnMessage ? styles.bubbleMine : styles.bubbleTheirs,
        ]}
      >
        <TouchableOpacity
          style={styles.playButton}
          onPress={handleToggle}
          activeOpacity={0.75}
          accessibilityLabel={playButtonLabel}
        >
          <Ionicons
            name={isPlaying ? 'pause' : 'play'}
            size={PLAY_ICON_SIZE}
            color={iconColor}
          />
        </TouchableOpacity>

        <View style={styles.waveformContainer}>
          {WAVEFORM_BARS.map(
            (height: WaveformBarHeight, index: number): React.JSX.Element => (
              <View
                key={`${height}-${index}`}
                style={[
                  styles.waveformBar,
                  getWaveformBarHeightStyle(height),
                  inactiveWaveformStyle,
                ]}
              />
            )
          )}
          <Animated.View
            style={[styles.waveformActiveMask, progressWidthStyle]}
            pointerEvents="none"
          >
            <View style={styles.waveformActiveInner}>
              {WAVEFORM_BARS.map(
                (
                  height: WaveformBarHeight,
                  index: number
                ): React.JSX.Element => (
                  <View
                    key={`${height}-${index}`}
                    style={[
                      styles.waveformBar,
                      getWaveformBarHeightStyle(height),
                      activeWaveformStyle,
                    ]}
                  />
                )
              )}
            </View>
          </Animated.View>
        </View>

        <Text
          style={[
            styles.duration,
            isOwnMessage ? styles.durationMine : styles.durationTheirs,
          ]}
        >
          {displayDuration}
        </Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  bubble: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    maxWidth: VOICE_BUBBLE_MAX_WIDTH,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
  } satisfies ViewStyle,
  bubbleMine: {
    backgroundColor: colors.primary,
    borderBottomLeftRadius: borderRadius.lg,
    borderBottomRightRadius: borderRadius.sm,
    borderTopLeftRadius: borderRadius.lg,
    borderTopRightRadius: borderRadius.lg,
  } satisfies ViewStyle,
  bubbleTheirs: {
    backgroundColor: colors.gray[100],
    borderBottomLeftRadius: borderRadius.sm,
    borderBottomRightRadius: borderRadius.lg,
    borderTopLeftRadius: borderRadius.lg,
    borderTopRightRadius: borderRadius.lg,
  } satisfies ViewStyle,
  duration: {
    fontSize: typography.sizes.xs,
    minWidth: spacing.xl,
    textAlign: 'right',
  } satisfies TextStyle,
  durationMine: {
    color: colors.white,
  } satisfies TextStyle,
  durationTheirs: {
    color: colors.gray[800],
  } satisfies TextStyle,
  playButton: {
    alignItems: 'center',
    height: PLAY_BUTTON_SIZE,
    justifyContent: 'center',
    width: PLAY_BUTTON_SIZE,
  } satisfies ViewStyle,
  row: {
    marginVertical: spacing.xs,
    paddingHorizontal: spacing.md,
  } satisfies ViewStyle,
  rowMine: {
    alignItems: 'flex-end',
  } satisfies ViewStyle,
  rowTheirs: {
    alignItems: 'flex-start',
  } satisfies ViewStyle,
  waveformActiveInner: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: WAVEFORM_BAR_GAP,
    height: WAVEFORM_HEIGHT,
    width: WAVEFORM_WIDTH,
  } satisfies ViewStyle,
  waveformActiveMask: {
    height: WAVEFORM_HEIGHT,
    left: 0,
    overflow: 'hidden',
    position: 'absolute',
    top: 0,
  } satisfies ViewStyle,
  waveformBar: {
    alignSelf: 'center',
    borderRadius: borderRadius.full,
    width: WAVEFORM_BAR_WIDTH,
  } satisfies ViewStyle,
  waveformBarHeard: {
    backgroundColor: colors.secondary,
  } satisfies ViewStyle,
  waveformBarHeight8: {
    height: 8,
  } satisfies ViewStyle,
  waveformBarHeight10: {
    height: 10,
  } satisfies ViewStyle,
  waveformBarHeight12: {
    height: 12,
  } satisfies ViewStyle,
  waveformBarHeight14: {
    height: 14,
  } satisfies ViewStyle,
  waveformBarHeight16: {
    height: 16,
  } satisfies ViewStyle,
  waveformBarHeight18: {
    height: 18,
  } satisfies ViewStyle,
  waveformBarHeight20: {
    height: 20,
  } satisfies ViewStyle,
  waveformBarHeight22: {
    height: 22,
  } satisfies ViewStyle,
  waveformBarHeight24: {
    height: 24,
  } satisfies ViewStyle,
  waveformBarHeight26: {
    height: 26,
  } satisfies ViewStyle,
  waveformBarHeight28: {
    height: 28,
  } satisfies ViewStyle,
  waveformBarMineActive: {
    backgroundColor: colors.white,
  } satisfies ViewStyle,
  waveformBarMineInactive: {
    backgroundColor: colors.gray[200],
  } satisfies ViewStyle,
  waveformBarTheirsActive: {
    backgroundColor: colors.primary,
  } satisfies ViewStyle,
  waveformBarTheirsInactive: {
    backgroundColor: colors.gray[400],
  } satisfies ViewStyle,
  waveformContainer: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: WAVEFORM_BAR_GAP,
    height: WAVEFORM_HEIGHT,
    overflow: 'hidden',
    position: 'relative',
    width: WAVEFORM_WIDTH,
  } satisfies ViewStyle,
})
