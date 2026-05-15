import React, { useEffect, useState } from 'react'

import { ScrollView, StyleSheet, Text, View } from 'react-native'

import { useNavigation } from '@react-navigation/native'
import type { StackNavigationProp } from '@react-navigation/stack'
import { useTranslation } from 'react-i18next'

import { useOnboardingStore } from '@/store/onboardingStore'
import type { OnboardingDraft } from '@/store/onboardingStore'

import { Button } from '@/components/ui/Button'
import { MultiSelect } from '@/components/ui/MultiSelect'
import { SingleSelect } from '@/components/ui/SingleSelect'

import {
  OnboardingHeader,
  type OnboardingStackParamList,
} from '@/app/onboarding/OnboardingNavigator'
import type { DrinkingStatus, SmokingStatus } from '@/types/user'

import { colors, spacing, typography } from '@/constants/theme'

type Step4NavigationProp = StackNavigationProp<OnboardingStackParamList, 'Step4'>

const STEP = 4
const MAX_GOALS = 5

export const Step4Screen = (): React.JSX.Element => {
  const { t } = useTranslation()
  const navigation = useNavigation<Step4NavigationProp>()
  const { draft, updateDraft, setCurrentStep } = useOnboardingStore()

  const dietOptions = [
    t('onboarding.step4.diet.options.noPreference'),
    t('onboarding.step4.diet.options.vegetarian'),
    t('onboarding.step4.diet.options.vegan'),
    t('onboarding.step4.diet.options.pescatarian'),
    t('onboarding.step4.diet.options.keto'),
    t('onboarding.step4.diet.options.halal'),
    t('onboarding.step4.diet.options.paleo'),
    t('onboarding.step4.diet.options.glutenFree'),
  ]
  const goalOptions = [
    t('onboarding.step4.goals.options.weightLoss'),
    t('onboarding.step4.goals.options.muscleGain'),
    t('onboarding.step4.goals.options.maintenance'),
    t('onboarding.step4.goals.options.athleticPerformance'),
    t('onboarding.step4.goals.options.generalHealth'),
    t('onboarding.step4.goals.options.flexibility'),
    t('onboarding.step4.goals.options.endurance'),
  ]
  const smokingOptions = [
    t('onboarding.step4.smoking.options.no'),
    t('onboarding.step4.smoking.options.occasionally'),
    t('onboarding.step4.smoking.options.yes'),
  ]
  const drinkingOptions = [
    t('onboarding.step4.drinking.options.no'),
    t('onboarding.step4.drinking.options.socially'),
    t('onboarding.step4.drinking.options.yes'),
  ]

  const smokingMap: Record<string, SmokingStatus> = {
    [t('onboarding.step4.smoking.options.no')]: 'no',
    [t('onboarding.step4.smoking.options.occasionally')]: 'occasionally',
    [t('onboarding.step4.smoking.options.yes')]: 'yes',
  }
  const smokingReverseMap: Record<SmokingStatus, string> = {
    no: t('onboarding.step4.smoking.options.no'),
    occasionally: t('onboarding.step4.smoking.options.occasionally'),
    yes: t('onboarding.step4.smoking.options.yes'),
  }
  const drinkingMap: Record<string, DrinkingStatus> = {
    [t('onboarding.step4.drinking.options.no')]: 'no',
    [t('onboarding.step4.drinking.options.socially')]: 'socially',
    [t('onboarding.step4.drinking.options.yes')]: 'yes',
  }
  const drinkingReverseMap: Record<DrinkingStatus, string> = {
    no: t('onboarding.step4.drinking.options.no'),
    socially: t('onboarding.step4.drinking.options.socially'),
    yes: t('onboarding.step4.drinking.options.yes'),
  }

  const [diet, setDiet] = useState<string | null>(
    draft.dietaryPreference ?? null
  )
  const [goals, setGoals] = useState<string[]>(draft.fitnessGoals ?? [])
  const [smoking, setSmoking] = useState<string | null>(
    draft.smoking !== undefined ? smokingReverseMap[draft.smoking] : null
  )
  const [drinking, setDrinking] = useState<string | null>(
    draft.drinking !== undefined ? drinkingReverseMap[draft.drinking] : null
  )

  const isValid =
    diet !== null &&
    goals.length >= 1 &&
    smoking !== null &&
    drinking !== null

  const goalsCounterText =
    goals.length === 0
      ? t('onboarding.step4.goals.counterEmpty', { max: MAX_GOALS })
      : t('onboarding.step4.goals.counter', {
          selected: goals.length,
          max: MAX_GOALS,
        })

  useEffect((): void => {
    setCurrentStep(STEP)
  }, [setCurrentStep])

  const saveDraft = (): void => {
    const partialDraft: Partial<OnboardingDraft> = {
      fitnessGoals: goals,
    }

    if (diet !== null) {
      partialDraft.dietaryPreference = diet
    }

    if (smoking !== null) {
      partialDraft.smoking = smokingMap[smoking]
    }

    if (drinking !== null) {
      partialDraft.drinking = drinkingMap[drinking]
    }

    updateDraft(partialDraft)
  }

  const handleBack = (): void => {
    saveDraft()
    setCurrentStep(3)
    navigation.navigate('Step3')
  }

  const handleNext = (): void => {
    if (diet === null || smoking === null || drinking === null) {
      return
    }

    saveDraft()
    setCurrentStep(5)
    navigation.navigate('Step5')
  }

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <OnboardingHeader step={STEP} />

        <View style={styles.content}>
          <Text style={styles.title}>{t('onboarding.step4.title')}</Text>

          <Text style={styles.sectionLabel}>
            {t('onboarding.step4.diet.label')}
          </Text>
          <SingleSelect
            options={dietOptions}
            selected={diet}
            onChange={setDiet}
          />

          <Text style={styles.sectionLabel}>
            {t('onboarding.step4.goals.label')}
          </Text>
          <MultiSelect
            options={goalOptions}
            selected={goals}
            onChange={setGoals}
            min={1}
            max={MAX_GOALS}
          />
          <Text style={styles.counter}>{goalsCounterText}</Text>

          <Text style={styles.sectionLabel}>
            {t('onboarding.step4.smoking.label')}
          </Text>
          <SingleSelect
            options={smokingOptions}
            selected={smoking}
            onChange={setSmoking}
          />

          <Text style={styles.sectionLabel}>
            {t('onboarding.step4.drinking.label')}
          </Text>
          <SingleSelect
            options={drinkingOptions}
            selected={drinking}
            onChange={setDrinking}
          />
        </View>
      </ScrollView>

      <View style={styles.buttonRow}>
        <View style={styles.backButton}>
          <Button
            label={t('common.back')}
            onPress={handleBack}
            variant="ghost"
          />
        </View>
        <View style={styles.nextButton}>
          <Button
            label={t('common.next')}
            onPress={handleNext}
            disabled={!isValid}
          />
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: spacing.xxl,
  },
  content: {
    paddingHorizontal: spacing.lg,
  },
  title: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.gray[800],
    marginTop: spacing.md,
    marginBottom: spacing.lg,
  },
  sectionLabel: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
    color: colors.gray[800],
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  counter: {
    fontSize: typography.sizes.sm,
    color: colors.gray[600],
    marginTop: spacing.xs,
    marginBottom: spacing.sm,
  },
  buttonRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.gray[200],
    backgroundColor: colors.background,
    gap: spacing.sm,
  },
  backButton: {
    flex: 1,
  },
  nextButton: {
    flex: 2,
  },
})
