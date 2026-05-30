import React, { useCallback, useRef, useState } from 'react'

import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import type { TextStyle, ViewStyle } from 'react-native'

import { Ionicons } from '@expo/vector-icons'
import { CameraView, useCameraPermissions } from 'expo-camera'
import type { CameraType } from 'expo-camera'
import { useTranslation } from 'react-i18next'

import { borderRadius, colors, spacing, typography } from '@/constants/theme'

interface SelfieCameraViewProps {
  onCapture: (uri: string) => void
  onRetake: () => void
  isProcessing: boolean
}

const FRONT_CAMERA: CameraType = 'front'
const OVAL_WIDTH = spacing.xxxl * 3 + spacing.xl - spacing.xs
const OVAL_HEIGHT = spacing.xxxl * 4 + spacing.lg
const OVAL_OFFSET = spacing.xxxl - spacing.xs
const CAPTURE_SIZE = spacing.xxxl + spacing.sm
const CAPTURE_INNER_SIZE = CAPTURE_SIZE - spacing.md
const RETAKE_SIZE = spacing.xl + spacing.md - spacing.xs
const GUIDE_BORDER_WIDTH = 3
const CAPTURE_BORDER_WIDTH = spacing.xs

export const SelfieCameraView = ({
  onCapture,
  onRetake,
  isProcessing,
}: SelfieCameraViewProps): React.JSX.Element => {
  const { t } = useTranslation()
  const [permission, requestPermission] = useCameraPermissions()
  const cameraRef = useRef<CameraView>(null)
  const [hasCaptured, setHasCaptured] = useState(false)

  const handleCapture = useCallback(async (): Promise<void> => {
    if (cameraRef.current === null || hasCaptured || isProcessing) {
      return
    }

    setHasCaptured(true)

    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.9,
        base64: false,
        skipProcessing: false,
      })

      if (photo?.uri !== undefined) {
        onCapture(photo.uri)
        return
      }

      setHasCaptured(false)
    } catch {
      setHasCaptured(false)
    }
  }, [hasCaptured, isProcessing, onCapture])

  const handleRetake = useCallback((): void => {
    setHasCaptured(false)
    onRetake()
  }, [onRetake])

  const handleRequestPermission = useCallback((): void => {
    void requestPermission()
  }, [requestPermission])

  if (permission === null) {
    return <View style={styles.container} />
  }

  if (!permission.granted) {
    return (
      <View style={styles.permissionContainer}>
        <Ionicons
          name="camera-outline"
          size={spacing.xxl}
          color={colors.gray[400]}
        />
        <Text style={styles.permissionTitle}>
          {t('verification.camera.permissionTitle')}
        </Text>
        <Text style={styles.permissionSubtitle}>
          {t('verification.camera.permissionSubtitle')}
        </Text>
        <TouchableOpacity
          style={styles.permissionButton}
          onPress={handleRequestPermission}
          activeOpacity={0.8}
        >
          <Text style={styles.permissionButtonText}>
            {t('verification.camera.grantPermission')}
          </Text>
        </TouchableOpacity>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <CameraView ref={cameraRef} style={styles.camera} facing={FRONT_CAMERA} />

      <View style={styles.overlayContainer} pointerEvents="none">
        <View style={styles.ovalGuide} />
      </View>

      <View style={styles.controls}>
        <TouchableOpacity
          style={styles.retakeButton}
          onPress={handleRetake}
          activeOpacity={0.7}
        >
          <Ionicons
            name="refresh-outline"
            size={spacing.lg}
            color={colors.white}
          />
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.captureButton,
            (hasCaptured || isProcessing) && styles.captureButtonDisabled,
          ]}
          onPress={handleCapture}
          disabled={hasCaptured || isProcessing}
          activeOpacity={0.8}
        >
          <View style={styles.captureInner} />
        </TouchableOpacity>

        <View style={styles.captureButtonSpacer} />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.black,
  } as ViewStyle,
  camera: {
    flex: 1,
  } as ViewStyle,
  overlayContainer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  } as ViewStyle,
  ovalGuide: {
    width: OVAL_WIDTH,
    height: OVAL_HEIGHT,
    borderRadius: OVAL_WIDTH / 2,
    borderWidth: GUIDE_BORDER_WIDTH,
    borderColor: colors.white,
    marginBottom: OVAL_OFFSET,
    backgroundColor: colors.transparent,
  } as ViewStyle,
  controls: {
    position: 'absolute',
    bottom: spacing.xxl,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  } as ViewStyle,
  retakeButton: {
    width: RETAKE_SIZE,
    height: RETAKE_SIZE,
    borderRadius: RETAKE_SIZE / 2,
    backgroundColor: colors.overlay,
    alignItems: 'center',
    justifyContent: 'center',
  } as ViewStyle,
  captureButton: {
    width: CAPTURE_SIZE,
    height: CAPTURE_SIZE,
    borderRadius: CAPTURE_SIZE / 2,
    borderWidth: CAPTURE_BORDER_WIDTH,
    borderColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: spacing.xl,
    backgroundColor: colors.transparent,
  } as ViewStyle,
  captureButtonDisabled: {
    opacity: 0.4,
  } as ViewStyle,
  captureInner: {
    width: CAPTURE_INNER_SIZE,
    height: CAPTURE_INNER_SIZE,
    borderRadius: CAPTURE_INNER_SIZE / 2,
    backgroundColor: colors.white,
  } as ViewStyle,
  captureButtonSpacer: {
    width: RETAKE_SIZE,
  } as ViewStyle,
  permissionContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
    padding: spacing.xl,
  } as ViewStyle,
  permissionTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.gray[800],
    marginTop: spacing.md,
    textAlign: 'center',
  } as TextStyle,
  permissionSubtitle: {
    fontSize: typography.sizes.sm,
    color: colors.gray[600],
    textAlign: 'center',
    marginTop: spacing.sm,
    lineHeight: typography.sizes.sm * typography.lineHeights.normal,
  } as TextStyle,
  permissionButton: {
    marginTop: spacing.lg,
    backgroundColor: colors.primary,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.md,
  } as ViewStyle,
  permissionButtonText: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
    color: colors.white,
  } as TextStyle,
})
