import React, { useCallback, useState } from 'react'

import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import type { TextStyle, ViewStyle } from 'react-native'

import { Ionicons } from '@expo/vector-icons'
import type { StackNavigationProp } from '@react-navigation/stack'
import { getFunctions, httpsCallable } from 'firebase/functions'
import type { HttpsCallable } from 'firebase/functions'
import { useTranslation } from 'react-i18next'

import { useProfileStore } from '@/store/profileStore'

import { SelfieCameraView } from '@/components/profile/SelfieCameraView'
import { Button } from '@/components/ui/Button'
import { LoadingOverlay } from '@/components/ui/LoadingOverlay'

import { uploadVerificationSelfie } from '@/services/firebase/storage'

import type { RootStackParamList } from '@/app/navigation/RootNavigator'

import { colors, spacing, typography } from '@/constants/theme'
import { compressImage } from '@/utils/imageUtils'

type PhotoVerificationNavProp = StackNavigationProp<
  RootStackParamList,
  'PhotoVerification'
>

interface PhotoVerificationScreenProps {
  navigation: PhotoVerificationNavProp
}

type VerificationStep = 'instructions' | 'camera' | 'result'

interface VerificationResult {
  verified: boolean
  reason?: string
}

interface VerifyProfilePhotoRequest {
  selfiePath: string
}

interface InstructionTip {
  icon: keyof typeof Ionicons.glyphMap
  i18nKey: string
}

const MAX_ATTEMPTS = 3
const RESULT_ICON_SIZE = spacing.xxxl + spacing.sm
const RESULT_CIRCLE_SIZE = spacing.xxxl + spacing.xxl + spacing.sm
const INSTRUCTION_ICON_CIRCLE_SIZE = spacing.xxxl + spacing.xl
const CALLABLE_REGION = 'asia-southeast1'
const DAILY_LIMIT_ERROR_CODE = 'functions/resource-exhausted'

const REASON_KEY_MAP: Record<string, string> = {
  no_face_detected: 'verification.result.reason.noFaceDetected',
  low_confidence: 'verification.result.reason.lowConfidence',
  multiple_faces: 'verification.result.reason.multipleFaces',
  multiple_faces_detected: 'verification.result.reason.multipleFaces',
  profile_photo_missing: 'verification.result.reason.profilePhotoMissing',
  no_profile_photo: 'verification.result.reason.profilePhotoMissing',
  no_face_in_profile_photo:
    'verification.result.reason.profilePhotoFaceMissing',
  face_mismatch: 'verification.result.reason.faceMismatch',
  unsafe_content: 'verification.result.reason.unsafeContent',
  inappropriate_content: 'verification.result.reason.unsafeContent',
  daily_limit_reached: 'verification.result.reason.dailyLimitReached',
}

const INSTRUCTION_TIPS: InstructionTip[] = [
  {
    icon: 'sunny-outline',
    i18nKey: 'verification.instructions.tip.lighting',
  },
  {
    icon: 'eye-outline',
    i18nKey: 'verification.instructions.tip.face',
  },
  {
    icon: 'glasses-outline',
    i18nKey: 'verification.instructions.tip.noGlasses',
  },
  {
    icon: 'person-outline',
    i18nKey: 'verification.instructions.tip.solo',
  },
]

const reasonToI18nKey = (reason: string | undefined): string => {
  if (reason === undefined) {
    return 'verification.result.reason.generic'
  }

  return REASON_KEY_MAP[reason] ?? 'verification.result.reason.generic'
}

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null
}

const isDailyLimitError = (error: unknown): boolean => {
  if (!isRecord(error) || typeof error.code !== 'string') {
    return false
  }

  return (
    error.code === DAILY_LIMIT_ERROR_CODE || error.code === 'resource-exhausted'
  )
}

const getVerifyProfilePhotoFn = (): HttpsCallable<
  VerifyProfilePhotoRequest,
  VerificationResult
> =>
  httpsCallable<VerifyProfilePhotoRequest, VerificationResult>(
    getFunctions(undefined, CALLABLE_REGION),
    'verifyProfilePhoto'
  )

const PhotoVerificationScreen = ({
  navigation,
}: PhotoVerificationScreenProps): React.JSX.Element => {
  const { t } = useTranslation()
  const updateProfile = useProfileStore((state) => state.updateProfile)
  const [step, setStep] = useState<VerificationStep>('instructions')
  const [isProcessing, setIsProcessing] = useState(false)
  const [result, setResult] = useState<VerificationResult | null>(null)
  const [attemptCount, setAttemptCount] = useState(0)

  const handleStartCamera = useCallback((): void => {
    setStep('camera')
  }, [])

  const handleCameraRetake = useCallback((): void => {
    setStep('instructions')
  }, [])

  const handleCapture = useCallback(
    async (uri: string): Promise<void> => {
      setIsProcessing(true)

      try {
        const compressedUri = await compressImage(uri)
        const selfiePath = await uploadVerificationSelfie(compressedUri)
        const verifyProfilePhoto = getVerifyProfilePhotoFn()
        const response = await verifyProfilePhoto({ selfiePath })
        const verificationResult = response.data

        setAttemptCount((currentCount: number): number =>
          verificationResult.reason === 'daily_limit_reached'
            ? MAX_ATTEMPTS
            : currentCount + 1
        )
        setResult(verificationResult)

        if (verificationResult.verified) {
          await updateProfile({ photoVerified: true })
        }

        setStep('result')
      } catch (error: unknown) {
        const reason = isDailyLimitError(error)
          ? 'daily_limit_reached'
          : 'generic'

        setAttemptCount((currentCount: number): number =>
          reason === 'daily_limit_reached'
            ? MAX_ATTEMPTS
            : currentCount + 1
        )
        setResult({ verified: false, reason })
        setStep('result')
      } finally {
        setIsProcessing(false)
      }
    },
    [updateProfile]
  )

  const handleTryAgain = useCallback((): void => {
    if (attemptCount >= MAX_ATTEMPTS) {
      Alert.alert(
        t('verification.result.limitTitle'),
        t('verification.result.limitBody'),
        [
          {
            text: t('common.ok'),
            onPress: (): void => {
              navigation.goBack()
            },
          },
        ]
      )
      return
    }

    setResult(null)
    setStep('camera')
  }, [attemptCount, navigation, t])

  const handleDismissSuccess = useCallback((): void => {
    navigation.goBack()
  }, [navigation])

  const renderInstructions = (): React.JSX.Element => (
    <ScrollView
      contentContainerStyle={styles.instructionsContent}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.iconCircle}>
        <Ionicons
          name="shield-checkmark-outline"
          size={spacing.xxl}
          color={colors.secondary}
        />
      </View>

      <Text style={styles.instructionsTitle}>
        {t('verification.instructions.title')}
      </Text>
      <Text style={styles.instructionsSubtitle}>
        {t('verification.instructions.subtitle')}
      </Text>

      {INSTRUCTION_TIPS.map((tip: InstructionTip): React.JSX.Element => (
        <View key={tip.i18nKey} style={styles.tipRow}>
          <Ionicons
            name={tip.icon}
            size={spacing.lg}
            color={colors.primary}
            style={styles.tipIcon}
          />
          <Text style={styles.tipText}>{t(tip.i18nKey)}</Text>
        </View>
      ))}

      <View style={styles.instructionsCta}>
        <Button
          label={t('verification.instructions.startButton')}
          onPress={handleStartCamera}
          variant="primary"
        />
      </View>
    </ScrollView>
  )

  const renderCamera = (): React.JSX.Element => (
    <View style={styles.cameraContainer}>
      <SelfieCameraView
        onCapture={handleCapture}
        onRetake={handleCameraRetake}
        isProcessing={isProcessing}
      />
      <LoadingOverlay
        visible={isProcessing}
        message={t('verification.camera.processing')}
      />
    </View>
  )

  const renderResult = (): React.JSX.Element => {
    const isSuccess = result?.verified === true

    return (
      <View style={styles.resultContainer}>
        <View
          style={[
            styles.resultIconCircle,
            isSuccess ? styles.resultIconSuccess : styles.resultIconFailure,
          ]}
        >
          <Ionicons
            name={isSuccess ? 'checkmark-circle' : 'close-circle'}
            size={RESULT_ICON_SIZE}
            color={colors.white}
          />
        </View>

        <Text style={styles.resultTitle}>
          {isSuccess
            ? t('verification.result.successTitle')
            : t('verification.result.failureTitle')}
        </Text>

        <Text style={styles.resultBody}>
          {isSuccess
            ? t('verification.result.successBody')
            : t(reasonToI18nKey(result?.reason))}
        </Text>

        {!isSuccess && attemptCount < MAX_ATTEMPTS && (
          <Text style={styles.attemptCounter}>
            {t('verification.result.attemptCount', {
              current: attemptCount,
              max: MAX_ATTEMPTS,
            })}
          </Text>
        )}

        <View style={styles.resultCta}>
          {isSuccess ? (
            <Button
              label={t('verification.result.successButton')}
              onPress={handleDismissSuccess}
              variant="primary"
            />
          ) : (
            <>
              {attemptCount < MAX_ATTEMPTS && (
                <Button
                  label={t('verification.result.tryAgainButton')}
                  onPress={handleTryAgain}
                  variant="primary"
                />
              )}
              <View style={styles.resultButtonSpacer} />
              <Button
                label={t('common.cancel')}
                onPress={navigation.goBack}
                variant="outline"
              />
            </>
          )}
        </View>
      </View>
    )
  }

  return (
    <View style={styles.root}>
      {step === 'instructions' && renderInstructions()}
      {step === 'camera' && renderCamera()}
      {step === 'result' && renderResult()}
    </View>
  )
}

export default PhotoVerificationScreen

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  } as ViewStyle,
  instructionsContent: {
    padding: spacing.lg,
    alignItems: 'center',
    paddingBottom: spacing.xxxl,
  } as ViewStyle,
  iconCircle: {
    width: INSTRUCTION_ICON_CIRCLE_SIZE,
    height: INSTRUCTION_ICON_CIRCLE_SIZE,
    borderRadius: INSTRUCTION_ICON_CIRCLE_SIZE / 2,
    backgroundColor: colors.gray[100],
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
    marginTop: spacing.xl,
  } as ViewStyle,
  instructionsTitle: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.gray[800],
    textAlign: 'center',
    marginBottom: spacing.sm,
  } as TextStyle,
  instructionsSubtitle: {
    fontSize: typography.sizes.md,
    color: colors.gray[600],
    textAlign: 'center',
    marginBottom: spacing.xl,
    lineHeight: typography.sizes.md * typography.lineHeights.normal,
  } as TextStyle,
  tipRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    width: '100%',
    marginBottom: spacing.md,
  } as ViewStyle,
  tipIcon: {
    marginRight: spacing.sm,
    marginTop: StyleSheet.hairlineWidth,
  } as ViewStyle,
  tipText: {
    flex: 1,
    fontSize: typography.sizes.md,
    color: colors.gray[700],
    lineHeight: typography.sizes.md * typography.lineHeights.normal,
  } as TextStyle,
  instructionsCta: {
    width: '100%',
    marginTop: spacing.xl,
  } as ViewStyle,
  cameraContainer: {
    flex: 1,
  } as ViewStyle,
  resultContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  } as ViewStyle,
  resultIconCircle: {
    width: RESULT_CIRCLE_SIZE,
    height: RESULT_CIRCLE_SIZE,
    borderRadius: RESULT_CIRCLE_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  } as ViewStyle,
  resultIconSuccess: {
    backgroundColor: colors.primary,
  } as ViewStyle,
  resultIconFailure: {
    backgroundColor: colors.danger,
  } as ViewStyle,
  resultTitle: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.gray[800],
    textAlign: 'center',
    marginBottom: spacing.sm,
  } as TextStyle,
  resultBody: {
    fontSize: typography.sizes.md,
    color: colors.gray[600],
    textAlign: 'center',
    lineHeight: typography.sizes.md * typography.lineHeights.normal,
    marginBottom: spacing.md,
  } as TextStyle,
  attemptCounter: {
    fontSize: typography.sizes.sm,
    color: colors.gray[400],
    textAlign: 'center',
    marginBottom: spacing.md,
  } as TextStyle,
  resultCta: {
    width: '100%',
    marginTop: spacing.lg,
  } as ViewStyle,
  resultButtonSpacer: {
    height: spacing.sm,
  } as ViewStyle,
})
