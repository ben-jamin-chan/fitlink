import React, { useState } from 'react'

import { ScrollView, StyleSheet, Text, View } from 'react-native'

import { useNavigation } from '@react-navigation/native'
import type { StackNavigationProp } from '@react-navigation/stack'
import { useTranslation } from 'react-i18next'

import { useOnboardingStore } from '@/store/onboardingStore'

import { PhotoGrid } from '@/components/profile/PhotoGrid'
import { Button } from '@/components/ui/Button'

import {
  OnboardingHeader,
  type OnboardingStackParamList,
} from '@/app/onboarding/OnboardingNavigator'

import { colors, MIN_PHOTOS, spacing, typography } from '@/constants/theme'

type Step2NavigationProp = StackNavigationProp<OnboardingStackParamList, 'Step2'>

const STEP = 2

export default function Step2Screen(): React.JSX.Element {
  const { t } = useTranslation()
  const navigation = useNavigation<Step2NavigationProp>()
  const { draft, updateDraft, setCurrentStep } = useOnboardingStore()

  const [photoUris, setPhotoUris] = useState<string[]>(draft.photoUris ?? [])

  const isValid = photoUris.length >= MIN_PHOTOS

  const handleNext = (): void => {
    updateDraft({ photoUris })
    setCurrentStep(3)
    navigation.navigate('Step3')
  }

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
    >
      <OnboardingHeader step={STEP} />

      <View style={styles.content}>
        <Text style={styles.title}>{t('onboarding.step2.title')}</Text>
        <Text style={styles.subtitle}>{t('onboarding.step2.subtitle')}</Text>

        <View style={styles.gridWrapper}>
          <PhotoGrid photoUris={photoUris} onPhotosChange={setPhotoUris} />
        </View>

        <Text style={styles.guidelines}>
          {t('onboarding.step2.guidelines')}
        </Text>

        <View style={styles.buttonWrapper}>
          <Button
            label={t('common.next')}
            onPress={handleNext}
            disabled={!isValid}
          />
        </View>
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  title: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.gray[900],
    marginBottom: spacing.sm,
    marginTop: spacing.md,
  },
  subtitle: {
    fontSize: typography.sizes.md,
    color: colors.gray[600],
    marginBottom: spacing.xl,
  },
  gridWrapper: {
    marginBottom: spacing.md,
  },
  guidelines: {
    fontSize: typography.sizes.sm,
    color: colors.gray[500],
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  buttonWrapper: {
    marginTop: spacing.md,
  },
})
