import React, { useEffect, useState } from 'react'

import {
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'

import { Ionicons } from '@expo/vector-icons'
import appleAuth from '@invertase/react-native-apple-authentication'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { useNavigation } from '@react-navigation/native'
import type { StackNavigationProp } from '@react-navigation/stack'
import * as Google from 'expo-auth-session/providers/google'
import * as WebBrowser from 'expo-web-browser'
import {
  EmailAuthProvider,
  GoogleAuthProvider,
  OAuthProvider,
  PhoneAuthProvider,
  reauthenticateWithCredential,
  signOut as firebaseSignOut,
} from 'firebase/auth'
import { httpsCallable } from 'firebase/functions'
import { useTranslation } from 'react-i18next'
import { SafeAreaView } from 'react-native-safe-area-context'

import { useAuthStore } from '@/store/authStore'
import { useChatStore } from '@/store/chatStore'
import { useDiscoveryStore } from '@/store/discoveryStore'
import { useMatchStore } from '@/store/matchStore'
import { useProfileStore } from '@/store/profileStore'

import { LoadingOverlay } from '@/components/ui/LoadingOverlay'

import type { SettingsStackParamList } from '@/app/navigation/MainTabNavigator'
import type { RootStackParamList } from '@/app/navigation/RootNavigator'
import { sendOTP } from '@/services/firebase/auth'
import { auth, functions } from '@/services/firebase/config'

import { borderRadius, colors, spacing, typography } from '@/constants/theme'

WebBrowser.maybeCompleteAuthSession()

type DeleteAccountNavigationProp = StackNavigationProp<
  SettingsStackParamList,
  'DeleteAccount'
>

type ReAuthMethod = 'phone' | 'google' | 'apple' | 'email' | 'unknown'

interface DeleteAccountResult {
  success: boolean
}

interface GoogleClientIds {
  clientId?: string
  iosClientId?: string
  androidClientId?: string
}

const CONFIRMATION_TEXT = 'DELETE'
const OTP_CODE_LENGTH = 6
const DELETE_ACCOUNT_CALLABLE = 'deleteAccount'
const PHONE_PROVIDER_ID = 'phone'
const GOOGLE_PROVIDER_ID = 'google.com'
const APPLE_PROVIDER_ID = 'apple.com'
const EMAIL_PROVIDER_ID = 'password'

const getEnvValue = (value: string | undefined): string | undefined => {
  if (value === undefined || value.trim().length === 0) {
    return undefined
  }

  return value
}

const googleClientIds: GoogleClientIds = {
  clientId: getEnvValue(process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_EXPO),
  iosClientId: getEnvValue(process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_IOS),
  androidClientId: getEnvValue(process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_ANDROID),
}

const isGoogleAuthConfigured = (clientIds: GoogleClientIds): boolean => {
  const platformClientId = Platform.select({
    ios: clientIds.iosClientId,
    android: clientIds.androidClientId,
    default: clientIds.clientId,
  })

  return platformClientId !== undefined
}

const userHasProvider = (providerId: string): boolean => {
  const user = auth.currentUser

  if (user === null) {
    return false
  }

  return user.providerData.some((provider): boolean => {
    return provider.providerId === providerId
  })
}

const getReAuthMethod = (): ReAuthMethod => {
  const user = auth.currentUser

  if (user === null) {
    return 'unknown'
  }

  if (user.phoneNumber !== null && userHasProvider(PHONE_PROVIDER_ID)) {
    return 'phone'
  }

  if (userHasProvider(GOOGLE_PROVIDER_ID)) {
    return 'google'
  }

  if (userHasProvider(APPLE_PROVIDER_ID)) {
    return 'apple'
  }

  if (user.email !== null && userHasProvider(EMAIL_PROVIDER_ID)) {
    return 'email'
  }

  return 'unknown'
}

export default function DeleteAccountScreen(): React.JSX.Element {
  const { t } = useTranslation()
  const navigation = useNavigation<DeleteAccountNavigationProp>()
  const setAuthUser = useAuthStore((state) => state.setUser)
  const setHasCompletedOnboarding = useAuthStore(
    (state) => state.setHasCompletedOnboarding
  )
  const setBiometricVerified = useAuthStore(
    (state) => state.setBiometricVerified
  )
  const clearAuthError = useAuthStore((state) => state.clearError)
  const resetProfile = useProfileStore((state) => state.reset)
  const resetDiscovery = useDiscoveryStore((state) => state.reset)
  const clearMatches = useMatchStore((state) => state.unsubscribeFromMatches)
  const closeChat = useChatStore((state) => state.closeChat)
  const [reAuthMethod] = useState<ReAuthMethod>(getReAuthMethod)
  const [reAuthComplete, setReAuthComplete] = useState(false)
  const [phoneOtp, setPhoneOtp] = useState('')
  const [phoneVerificationId, setPhoneVerificationId] = useState<string | null>(
    null
  )
  const [otpSent, setOtpSent] = useState(false)
  const [emailPassword, setEmailPassword] = useState('')
  const [confirmText, setConfirmText] = useState('')
  const [reAuthLoading, setReAuthLoading] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)

  const [googleRequest, googleResponse, promptGoogleReAuth] =
    Google.useAuthRequest({
      clientId: googleClientIds.clientId,
      iosClientId: googleClientIds.iosClientId,
      androidClientId: googleClientIds.androidClientId,
    })

  useEffect((): void => {
    if (reAuthMethod !== 'google') {
      return
    }

    if (googleResponse?.type === 'success') {
      const idToken =
        googleResponse.authentication?.idToken ??
        googleResponse.params.id_token

      if (idToken === undefined || idToken.length === 0) {
        setReAuthLoading(false)
        Alert.alert(
          t('deleteAccount.reAuth.errorTitle'),
          t('deleteAccount.reAuth.googleError')
        )
        return
      }

      void handleGoogleToken(idToken)
      return
    }

    if (
      googleResponse?.type === 'error' ||
      googleResponse?.type === 'dismiss' ||
      googleResponse?.type === 'cancel'
    ) {
      setReAuthLoading(false)
    }
  }, [googleResponse, reAuthMethod, t])

  const deleteEnabled = reAuthComplete && confirmText === CONFIRMATION_TEXT

  const handleBack = (): void => {
    navigation.goBack()
  }

  const showReAuthError = (messageKey: string): void => {
    Alert.alert(t('deleteAccount.reAuth.errorTitle'), t(messageKey))
  }

  const handleSendOtp = async (): Promise<void> => {
    const currentUser = auth.currentUser

    if (
      currentUser?.phoneNumber === null ||
      currentUser?.phoneNumber === undefined
    ) {
      showReAuthError('deleteAccount.reAuth.sendOtpError')
      return
    }

    setReAuthLoading(true)

    try {
      const confirmation = await sendOTP(currentUser.phoneNumber)
      setPhoneVerificationId(confirmation.verificationId)
      setOtpSent(true)
    } catch {
      showReAuthError('deleteAccount.reAuth.sendOtpError')
    } finally {
      setReAuthLoading(false)
    }
  }

  const handleVerifyOtp = async (): Promise<void> => {
    const currentUser = auth.currentUser

    if (
      currentUser === null ||
      phoneVerificationId === null ||
      phoneOtp.length < OTP_CODE_LENGTH
    ) {
      return
    }

    setReAuthLoading(true)

    try {
      const credential = PhoneAuthProvider.credential(
        phoneVerificationId,
        phoneOtp
      )
      await reauthenticateWithCredential(currentUser, credential)
      setReAuthComplete(true)
    } catch {
      showReAuthError('deleteAccount.reAuth.invalidOtp')
    } finally {
      setReAuthLoading(false)
    }
  }

  const handleGoogleToken = async (idToken: string): Promise<void> => {
    const currentUser = auth.currentUser

    if (currentUser === null) {
      setReAuthLoading(false)
      showReAuthError('deleteAccount.reAuth.googleError')
      return
    }

    try {
      const credential = GoogleAuthProvider.credential(idToken)
      await reauthenticateWithCredential(currentUser, credential)
      setReAuthComplete(true)
    } catch {
      showReAuthError('deleteAccount.reAuth.googleError')
    } finally {
      setReAuthLoading(false)
    }
  }

  const handleGoogleReAuth = (): void => {
    if (!isGoogleAuthConfigured(googleClientIds) || googleRequest === null) {
      showReAuthError('deleteAccount.reAuth.googleUnavailable')
      return
    }

    setReAuthLoading(true)
    void promptGoogleReAuth().catch((): void => {
      setReAuthLoading(false)
      showReAuthError('deleteAccount.reAuth.googleError')
    })
  }

  const handleAppleReAuth = async (): Promise<void> => {
    const currentUser = auth.currentUser

    if (
      Platform.OS !== 'ios' ||
      !appleAuth.isSupported ||
      currentUser === null
    ) {
      showReAuthError('deleteAccount.reAuth.appleError')
      return
    }

    setReAuthLoading(true)

    try {
      const appleResponse = await appleAuth.performRequest({
        requestedOperation: appleAuth.Operation.LOGIN,
        requestedScopes: [appleAuth.Scope.EMAIL, appleAuth.Scope.FULL_NAME],
      })
      const { identityToken, nonce } = appleResponse

      if (identityToken === null || nonce.length === 0) {
        showReAuthError('deleteAccount.reAuth.appleError')
        return
      }

      const provider = new OAuthProvider(APPLE_PROVIDER_ID)
      const credential = provider.credential({
        idToken: identityToken,
        rawNonce: nonce,
      })
      await reauthenticateWithCredential(currentUser, credential)
      setReAuthComplete(true)
    } catch {
      showReAuthError('deleteAccount.reAuth.appleError')
    } finally {
      setReAuthLoading(false)
    }
  }

  const handleEmailReAuth = async (): Promise<void> => {
    const currentUser = auth.currentUser

    if (
      currentUser === null ||
      currentUser.email === null ||
      emailPassword.length === 0
    ) {
      return
    }

    setReAuthLoading(true)

    try {
      const credential = EmailAuthProvider.credential(
        currentUser.email,
        emailPassword
      )
      await reauthenticateWithCredential(currentUser, credential)
      setReAuthComplete(true)
    } catch {
      showReAuthError('deleteAccount.reAuth.wrongPassword')
    } finally {
      setReAuthLoading(false)
    }
  }

  const clearClientState = async (currentUserId: string): Promise<void> => {
    resetProfile()
    resetDiscovery()
    clearMatches()
    await closeChat(currentUserId)
    setAuthUser(null)
    setHasCompletedOnboarding(false)
    setBiometricVerified(false)
    clearAuthError()
    await firebaseSignOut(auth)
    await AsyncStorage.clear()
  }

  const resetToAuthStack = (): void => {
    const tabNavigation = navigation.getParent()
    const rootNavigation =
      tabNavigation?.getParent<StackNavigationProp<RootStackParamList>>()

    rootNavigation?.reset({
      index: 0,
      routes: [{ name: 'Auth' }],
    })
  }

  const handleConfirmedDelete = async (): Promise<void> => {
    const currentUserId = auth.currentUser?.uid

    if (currentUserId === undefined) {
      Alert.alert(
        t('deleteAccount.error.title'),
        t('deleteAccount.error.message')
      )
      return
    }

    setDeleteLoading(true)

    try {
      const deleteAccount = httpsCallable<
        Record<string, never>,
        DeleteAccountResult
      >(functions, DELETE_ACCOUNT_CALLABLE)
      const result = await deleteAccount({})

      if (!result.data.success) {
        throw new Error(DELETE_ACCOUNT_CALLABLE)
      }

      await clearClientState(currentUserId)
      resetToAuthStack()
    } catch {
      setDeleteLoading(false)
      Alert.alert(
        t('deleteAccount.error.title'),
        t('deleteAccount.error.message')
      )
    }
  }

  const handleDeletePress = (): void => {
    Alert.alert(
      t('deleteAccount.finalConfirm.title'),
      t('deleteAccount.finalConfirm.message'),
      [
        {
          text: t('common.cancel'),
          style: 'cancel',
        },
        {
          text: t('deleteAccount.finalConfirm.deleteButton'),
          style: 'destructive',
          onPress: (): void => {
            void handleConfirmedDelete()
          },
        },
      ]
    )
  }

  const renderPhoneReAuth = (): React.JSX.Element => (
    <View style={styles.reAuthContent}>
      <Text style={styles.sectionBody}>
        {t('deleteAccount.reAuth.phoneLabel')}
      </Text>
      {!otpSent ? (
        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={(): void => {
            void handleSendOtp()
          }}
          disabled={reAuthLoading}
          activeOpacity={0.8}
        >
          <Text style={styles.secondaryButtonText}>
            {t('deleteAccount.reAuth.sendOtp')}
          </Text>
        </TouchableOpacity>
      ) : (
        <View style={styles.inputGroup}>
          <TextInput
            style={styles.input}
            value={phoneOtp}
            onChangeText={setPhoneOtp}
            keyboardType="number-pad"
            maxLength={OTP_CODE_LENGTH}
            placeholder={t('deleteAccount.reAuth.otpPlaceholder')}
            placeholderTextColor={colors.gray[400]}
            textContentType="oneTimeCode"
          />
          <TouchableOpacity
            style={[
              styles.secondaryButton,
              phoneOtp.length < OTP_CODE_LENGTH && styles.buttonDisabled,
            ]}
            onPress={(): void => {
              void handleVerifyOtp()
            }}
            disabled={reAuthLoading || phoneOtp.length < OTP_CODE_LENGTH}
            activeOpacity={0.8}
          >
            <Text style={styles.secondaryButtonText}>
              {t('deleteAccount.reAuth.verifyOtp')}
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  )

  const renderGoogleReAuth = (): React.JSX.Element => (
    <View style={styles.reAuthContent}>
      <Text style={styles.sectionBody}>
        {t('deleteAccount.reAuth.googleLabel')}
      </Text>
      <TouchableOpacity
        style={[
          styles.secondaryButton,
          (!isGoogleAuthConfigured(googleClientIds) || googleRequest === null) &&
            styles.buttonDisabled,
        ]}
        onPress={handleGoogleReAuth}
        disabled={
          reAuthLoading ||
          !isGoogleAuthConfigured(googleClientIds) ||
          googleRequest === null
        }
        activeOpacity={0.8}
      >
        <Text style={styles.secondaryButtonText}>
          {t('deleteAccount.reAuth.googleButton')}
        </Text>
      </TouchableOpacity>
    </View>
  )

  const renderAppleReAuth = (): React.JSX.Element => (
    <View style={styles.reAuthContent}>
      <Text style={styles.sectionBody}>
        {t('deleteAccount.reAuth.appleLabel')}
      </Text>
      <TouchableOpacity
        style={[
          styles.secondaryButton,
          Platform.OS !== 'ios' && styles.buttonDisabled,
        ]}
        onPress={(): void => {
          void handleAppleReAuth()
        }}
        disabled={reAuthLoading || Platform.OS !== 'ios'}
        activeOpacity={0.8}
      >
        <Text style={styles.secondaryButtonText}>
          {t('deleteAccount.reAuth.appleButton')}
        </Text>
      </TouchableOpacity>
    </View>
  )

  const renderEmailReAuth = (): React.JSX.Element => (
    <View style={styles.reAuthContent}>
      <Text style={styles.sectionBody}>
        {t('deleteAccount.reAuth.emailLabel')}
      </Text>
      <View style={styles.inputGroup}>
        <TextInput
          style={styles.input}
          value={emailPassword}
          onChangeText={setEmailPassword}
          secureTextEntry
          placeholder={t('deleteAccount.reAuth.passwordPlaceholder')}
          placeholderTextColor={colors.gray[400]}
          autoCapitalize="none"
          textContentType="password"
        />
        <TouchableOpacity
          style={[
            styles.secondaryButton,
            emailPassword.length === 0 && styles.buttonDisabled,
          ]}
          onPress={(): void => {
            void handleEmailReAuth()
          }}
          disabled={reAuthLoading || emailPassword.length === 0}
          activeOpacity={0.8}
        >
          <Text style={styles.secondaryButtonText}>
            {t('deleteAccount.reAuth.confirmPassword')}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  )

  const renderReAuthSection = (): React.JSX.Element => {
    if (reAuthComplete) {
      return (
        <View style={styles.reAuthComplete}>
          <Ionicons
            name="checkmark-circle"
            size={spacing.lg}
            color={colors.primary}
          />
          <Text style={styles.reAuthCompleteText}>
            {t('deleteAccount.reAuth.verified')}
          </Text>
        </View>
      )
    }

    if (reAuthMethod === 'phone') {
      return renderPhoneReAuth()
    }

    if (reAuthMethod === 'google') {
      return renderGoogleReAuth()
    }

    if (reAuthMethod === 'apple') {
      return renderAppleReAuth()
    }

    if (reAuthMethod === 'email') {
      return renderEmailReAuth()
    }

    return (
      <View style={styles.reAuthContent}>
        <Text style={styles.sectionBody}>
          {t('deleteAccount.reAuth.unknownProvider')}
        </Text>
      </View>
    )
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <LoadingOverlay
        visible={reAuthLoading || deleteLoading}
        message={
          deleteLoading
            ? t('deleteAccount.loading.deleting')
            : t('deleteAccount.loading.verifying')
        }
      />

      <View style={styles.header}>
        <TouchableOpacity
          style={styles.headerButton}
          onPress={handleBack}
          activeOpacity={0.75}
          accessibilityLabel={t('common.back')}
        >
          <Ionicons
            name="chevron-back"
            size={spacing.xl}
            color={colors.gray[900]}
          />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.warningIcon}>
          <Ionicons
            name="warning-outline"
            size={spacing.xxxl}
            color={colors.danger}
          />
        </View>

        <Text style={styles.title}>{t('deleteAccount.screenTitle')}</Text>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            {t('deleteAccount.whatWillBeDeleted.title')}
          </Text>
          <View style={styles.bulletList}>
            <View style={styles.bulletRow}>
              <View style={styles.bulletDot} />
              <Text style={styles.bulletText}>
                {t('deleteAccount.whatWillBeDeleted.profile')}
              </Text>
            </View>
            <View style={styles.bulletRow}>
              <View style={styles.bulletDot} />
              <Text style={styles.bulletText}>
                {t('deleteAccount.whatWillBeDeleted.matches')}
              </Text>
            </View>
            <View style={styles.bulletRow}>
              <View style={styles.bulletDot} />
              <Text style={styles.bulletText}>
                {t('deleteAccount.whatWillBeDeleted.subscription')}
              </Text>
            </View>
            <View style={styles.bulletRow}>
              <View style={styles.bulletDot} />
              <Text style={styles.bulletText}>
                {t('deleteAccount.whatWillBeDeleted.activityData')}
              </Text>
            </View>
            <View style={styles.bulletRow}>
              <View style={styles.bulletDot} />
              <Text style={styles.bulletText}>
                {t('deleteAccount.whatWillBeDeleted.cannotRecover')}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            {t('deleteAccount.reAuth.title')}
          </Text>
          <Text style={styles.sectionBody}>
            {t('deleteAccount.reAuth.description')}
          </Text>
          {renderReAuthSection()}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            {t('deleteAccount.confirm.title')}
          </Text>
          <Text style={styles.sectionBody}>
            {t('deleteAccount.confirm.typeInstruction')}
          </Text>
          <TextInput
            style={[
              styles.input,
              !reAuthComplete && styles.inputDisabled,
            ]}
            value={confirmText}
            onChangeText={setConfirmText}
            autoCapitalize="characters"
            autoCorrect={false}
            placeholder={t('deleteAccount.confirm.placeholder')}
            placeholderTextColor={colors.gray[400]}
            editable={reAuthComplete && !deleteLoading}
          />

          <TouchableOpacity
            style={[
              styles.deleteButton,
              (!deleteEnabled || deleteLoading) && styles.buttonDisabled,
            ]}
            onPress={handleDeletePress}
            disabled={!deleteEnabled || deleteLoading}
            activeOpacity={0.8}
          >
            <Text style={styles.deleteButtonText}>
              {t('deleteAccount.confirm.deleteButton')}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    minHeight: spacing.xxl,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  headerButton: {
    alignItems: 'center',
    height: spacing.xl,
    justifyContent: 'center',
    width: spacing.xl,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  warningIcon: {
    alignItems: 'center',
    marginBottom: spacing.lg,
    marginTop: spacing.md,
  },
  title: {
    color: colors.gray[900],
    fontSize: typography.sizes.xxl,
    fontWeight: typography.weights.bold,
    marginBottom: spacing.xl,
    textAlign: 'center',
  },
  section: {
    marginBottom: spacing.xl,
  },
  sectionTitle: {
    color: colors.gray[900],
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.semibold,
    marginBottom: spacing.sm,
  },
  sectionBody: {
    color: colors.gray[700],
    fontSize: typography.sizes.md,
    lineHeight: typography.sizes.md * typography.lineHeights.normal,
    marginBottom: spacing.md,
  },
  bulletList: {
    backgroundColor: colors.surface,
    borderColor: colors.gray[200],
    borderRadius: borderRadius.md,
    borderWidth: StyleSheet.hairlineWidth,
    gap: spacing.md,
    padding: spacing.md,
  },
  bulletRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  bulletDot: {
    backgroundColor: colors.danger,
    borderRadius: borderRadius.full,
    height: spacing.xs,
    marginTop: spacing.sm,
    width: spacing.xs,
  },
  bulletText: {
    color: colors.gray[800],
    flex: 1,
    fontSize: typography.sizes.md,
    lineHeight: typography.sizes.md * typography.lineHeights.normal,
  },
  reAuthContent: {
    backgroundColor: colors.surface,
    borderColor: colors.gray[200],
    borderRadius: borderRadius.md,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.md,
  },
  reAuthComplete: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.primary,
    borderRadius: borderRadius.md,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.md,
  },
  reAuthCompleteText: {
    color: colors.gray[900],
    flex: 1,
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
  },
  inputGroup: {
    gap: spacing.sm,
  },
  input: {
    backgroundColor: colors.surface,
    borderColor: colors.gray[300],
    borderRadius: borderRadius.md,
    borderWidth: StyleSheet.hairlineWidth,
    color: colors.gray[900],
    fontSize: typography.sizes.md,
    minHeight: spacing.xxl + spacing.xs,
    paddingHorizontal: spacing.md,
  },
  inputDisabled: {
    backgroundColor: colors.gray[100],
    color: colors.gray[500],
  },
  secondaryButton: {
    alignItems: 'center',
    backgroundColor: colors.gray[100],
    borderRadius: borderRadius.md,
    minHeight: spacing.xxl + spacing.xs,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  secondaryButtonText: {
    color: colors.gray[900],
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
  },
  deleteButton: {
    alignItems: 'center',
    backgroundColor: colors.danger,
    borderRadius: borderRadius.md,
    justifyContent: 'center',
    marginTop: spacing.lg,
    minHeight: spacing.xxl + spacing.xs,
    paddingHorizontal: spacing.lg,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  deleteButtonText: {
    color: colors.white,
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
  },
})
