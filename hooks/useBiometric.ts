import { useCallback } from 'react'

import AsyncStorage from '@react-native-async-storage/async-storage'
import * as LocalAuthentication from 'expo-local-authentication'

const BIOMETRIC_ENABLED_KEY = 'biometric_enabled'
const BIOMETRIC_PROMPT_SHOWN_KEY = 'biometric_prompt_shown'

export interface BiometricSupportResult {
  isSupported: boolean
  isEnrolled: boolean
  biometricType: LocalAuthentication.AuthenticationType[]
}

export interface BiometricAuthResult {
  success: boolean
  error?: string
}

export const checkBiometricSupport =
  async (): Promise<BiometricSupportResult> => {
    const isSupported = await LocalAuthentication.hasHardwareAsync()

    if (!isSupported) {
      return { isSupported: false, isEnrolled: false, biometricType: [] }
    }

    const isEnrolled = await LocalAuthentication.isEnrolledAsync()
    const biometricType =
      await LocalAuthentication.supportedAuthenticationTypesAsync()

    return { isSupported, isEnrolled, biometricType }
  }

export const getBiometricEnabled = async (): Promise<boolean> => {
  const value = await AsyncStorage.getItem(BIOMETRIC_ENABLED_KEY)

  return value === 'true'
}

export const setBiometricEnabled = async (
  enabled: boolean
): Promise<void> => {
  await AsyncStorage.setItem(BIOMETRIC_ENABLED_KEY, enabled ? 'true' : 'false')
}

export const getBiometricPromptShown = async (): Promise<boolean> => {
  const value = await AsyncStorage.getItem(BIOMETRIC_PROMPT_SHOWN_KEY)

  return value === 'true'
}

export const markBiometricPromptShown = async (): Promise<void> => {
  await AsyncStorage.setItem(BIOMETRIC_PROMPT_SHOWN_KEY, 'true')
}

export const authenticateWithBiometric = async (
  promptMessage: string,
  cancelLabel: string
): Promise<BiometricAuthResult> => {
  try {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage,
      cancelLabel,
      disableDeviceFallback: true,
      fallbackLabel: '',
    })

    if (result.success) {
      return { success: true }
    }

    return {
      success: false,
      error: result.error ?? 'unknown',
    }
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : 'Authentication error'

    return { success: false, error: message }
  }
}

export const useBiometric = (): {
  checkSupport: () => Promise<BiometricSupportResult>
  getEnabled: () => Promise<boolean>
  setEnabled: (enabled: boolean) => Promise<void>
  authenticate: (
    promptMessage: string,
    cancelLabel: string
  ) => Promise<BiometricAuthResult>
} => {
  const checkSupport = useCallback(checkBiometricSupport, [])
  const getEnabled = useCallback(getBiometricEnabled, [])
  const setEnabled = useCallback(setBiometricEnabled, [])
  const authenticate = useCallback(authenticateWithBiometric, [])

  return { checkSupport, getEnabled, setEnabled, authenticate }
}
