import React, { useEffect } from 'react'

import { StyleSheet, Text, View } from 'react-native'

import { createStackNavigator } from '@react-navigation/stack'
import { useTranslation } from 'react-i18next'

import { useOnboardingStore } from '@/store/onboardingStore'

import { ProgressDots } from '@/components/ui/ProgressDots'

import Step1Screen from '@/app/onboarding/Step1Screen'
import Step2Screen from '@/app/onboarding/Step2Screen'
import Step3Screen from '@/app/onboarding/Step3Screen'
import { Step4Screen } from '@/app/onboarding/Step4Screen'
import Step5Screen from '@/app/onboarding/Step5Screen'

import { colors, spacing, typography } from '@/constants/theme'

export type OnboardingStackParamList = {
  Step1: undefined
  Step2: undefined
  Step3: undefined
  Step4: undefined
  Step5: undefined
  Step6: undefined
}

type OnboardingRouteName = keyof OnboardingStackParamList

const Stack = createStackNavigator<OnboardingStackParamList>()

const TOTAL_STEPS = 6

interface OnboardingHeaderProps {
  step: number
}

export const OnboardingHeader = ({
  step,
}: OnboardingHeaderProps): React.JSX.Element => {
  const { t } = useTranslation()

  return (
    <View style={styles.header}>
      <Text style={styles.stepLabel}>
        {t('onboarding.step', { current: step, total: TOTAL_STEPS })}
      </Text>
      <ProgressDots totalSteps={TOTAL_STEPS} currentStep={step} />
    </View>
  )
}

interface StepPlaceholderProps {
  step: number
}

const StepPlaceholder = ({ step }: StepPlaceholderProps): React.JSX.Element => {
  const { t } = useTranslation()
  const setCurrentStep = useOnboardingStore((state) => state.setCurrentStep)

  useEffect((): void => {
    setCurrentStep(step)
  }, [setCurrentStep, step])

  return (
    <View style={styles.placeholder}>
      <OnboardingHeader step={step} />
      <View style={styles.placeholderContent}>
        <Text style={styles.placeholderText}>
          {t('onboarding.step', { current: step, total: TOTAL_STEPS })}
        </Text>
      </View>
    </View>
  )
}

const Step6Screen = (): React.JSX.Element => <StepPlaceholder step={6} />

const getInitialRouteName = (step: number): OnboardingRouteName => {
  switch (step) {
    case 2:
      return 'Step2'
    case 3:
      return 'Step3'
    case 4:
      return 'Step4'
    case 5:
      return 'Step5'
    case 6:
      return 'Step6'
    default:
      return 'Step1'
  }
}

export const OnboardingNavigator = (): React.JSX.Element => {
  const currentStep = useOnboardingStore((state) => state.currentStep)

  return (
    <Stack.Navigator
      initialRouteName={getInitialRouteName(currentStep)}
      screenOptions={screenOptions}
    >
      <Stack.Screen name="Step1" component={Step1Screen} />
      <Stack.Screen name="Step2" component={Step2Screen} />
      <Stack.Screen name="Step3" component={Step3Screen} />
      <Stack.Screen name="Step4" component={Step4Screen} />
      <Stack.Screen name="Step5" component={Step5Screen} />
      <Stack.Screen name="Step6" component={Step6Screen} />
    </Stack.Navigator>
  )
}

const screenOptions = {
  headerShown: false,
  cardStyle: {
    backgroundColor: colors.background,
  },
  animationEnabled: true,
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
    backgroundColor: colors.background,
    gap: spacing.md,
  },
  stepLabel: {
    fontSize: typography.sizes.sm,
    color: colors.gray[500],
    textAlign: 'center',
  },
  placeholder: {
    flex: 1,
    backgroundColor: colors.background,
  },
  placeholderContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    fontSize: typography.sizes.lg,
    color: colors.gray[400],
  },
})
