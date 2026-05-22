import React, { useEffect, useState } from 'react'

import {
  Alert,
  Linking,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  ToastAndroid,
  TouchableOpacity,
  View,
} from 'react-native'
import type { ColorValue } from 'react-native'

import AsyncStorage from '@react-native-async-storage/async-storage'
import { Ionicons } from '@expo/vector-icons'
import { useNavigation } from '@react-navigation/native'
import type { StackNavigationProp } from '@react-navigation/stack'
import Constants from 'expo-constants'
import { LinearGradient } from 'expo-linear-gradient'
import { useTranslation } from 'react-i18next'
import { SafeAreaView } from 'react-native-safe-area-context'

import { useAuthStore } from '@/store/authStore'
import { useProfileStore } from '@/store/profileStore'

import { SettingsRow } from '@/components/settings/SettingsRow'
import { SettingsSection } from '@/components/settings/SettingsSection'
import { Button } from '@/components/ui/Button'
import { MultiSelect } from '@/components/ui/MultiSelect'
import { Slider } from '@/components/ui/Slider'

import type { SettingsStackParamList } from '@/app/navigation/MainTabNavigator'
import { registerForPushNotifications } from '@/services/notifications'
import { mapFirebaseError } from '@/utils/errorUtils'
import type { LookingFor } from '@/types/user'

import { borderRadius, colors, spacing, typography } from '@/constants/theme'

type SettingsNavigationProp = StackNavigationProp<
  SettingsStackParamList,
  'Settings'
>

type DiscoveryModal = 'ageRange' | 'distance' | 'genderPref' | 'lookingFor'
type LanguageCode = 'en' | 'ms' | 'zh' | 'ta'
type ToastType = 'success' | 'error' | 'info'

interface NotificationPrefs {
  pushEnabled: boolean
  newMatches: boolean
  newMessages: boolean
}

interface SelectOption<TValue extends string> {
  label: string
  value: TValue
}

interface LanguageOption {
  code: LanguageCode
  labelKey: string
  flag: string
}

const NOTIFICATION_PREFS_KEY = '@fitlink/notificationPrefs'
const APP_STORE_URL = 'https://apps.apple.com/app/fitlink'
const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=fitlink'
const MIN_AGE = 18
const MAX_AGE = 60
const MIN_DISTANCE_KM = 5
const MAX_DISTANCE_KM = 100
const DEFAULT_AGE_MAX = 35
const DEFAULT_DISTANCE_KM = 50
const PREMIUM_GRADIENT_COLORS: [ColorValue, ColorValue] = [
  colors.primary,
  colors.secondary,
]
const DEFAULT_NOTIFICATION_PREFS: NotificationPrefs = {
  pushEnabled: false,
  newMatches: true,
  newMessages: true,
}
const LANGUAGE_OPTIONS: LanguageOption[] = [
  { code: 'en', labelKey: 'settings.languages.en', flag: '🇬🇧' },
  { code: 'ms', labelKey: 'settings.languages.ms', flag: '🇲🇾' },
  { code: 'zh', labelKey: 'settings.languages.zh', flag: '🇨🇳' },
  { code: 'ta', labelKey: 'settings.languages.ta', flag: '🇮🇳' },
]

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null
}

const isNotificationPrefs = (value: unknown): value is NotificationPrefs => {
  return (
    isRecord(value) &&
    typeof value.pushEnabled === 'boolean' &&
    typeof value.newMatches === 'boolean' &&
    typeof value.newMessages === 'boolean'
  )
}

const normalizeLanguageCode = (
  language: string | undefined
): LanguageCode => {
  if (language === 'my' || language === 'ms') {
    return 'ms'
  }

  if (language === 'zh' || language === 'ta' || language === 'en') {
    return language
  }

  return 'en'
}

const labelsToValues = <TValue extends string>(
  labels: string[],
  options: SelectOption<TValue>[]
): TValue[] =>
  labels
    .map((label: string): TValue | undefined => {
      return options.find((option) => option.label === label)?.value
    })
    .filter((value: TValue | undefined): value is TValue => {
      return value !== undefined
    })

const valuesToLabels = <TValue extends string>(
  values: TValue[],
  options: SelectOption<TValue>[]
): string[] =>
  values
    .map((value: TValue): string | undefined => {
      return options.find((option) => option.value === value)?.label
    })
    .filter((label: string | undefined): label is string => {
      return label !== undefined
    })

const showSettingsToast = (message: string, type: ToastType): void => {
  if (Platform.OS === 'android') {
    ToastAndroid.show(
      message,
      type === 'error' ? ToastAndroid.LONG : ToastAndroid.SHORT
    )
    return
  }

  Alert.alert(message)
}

export default function SettingsScreen(): React.JSX.Element {
  const { t, i18n } = useTranslation()
  const navigation = useNavigation<SettingsNavigationProp>()
  const user = useAuthStore((state) => state.user)
  const logout = useAuthStore((state) => state.logout)
  const profile = useProfileStore((state) => state.profile)
  const updateProfile = useProfileStore((state) => state.updateProfile)
  const [activeModal, setActiveModal] = useState<DiscoveryModal | null>(null)
  const [isLanguageModalVisible, setIsLanguageModalVisible] = useState(false)
  const [notificationPrefs, setNotificationPrefs] =
    useState<NotificationPrefs>(DEFAULT_NOTIFICATION_PREFS)
  const [ageMinDraft, setAgeMinDraft] = useState(MIN_AGE)
  const [ageMaxDraft, setAgeMaxDraft] = useState(DEFAULT_AGE_MAX)
  const [distanceDraft, setDistanceDraft] = useState(DEFAULT_DISTANCE_KM)
  const [genderDraft, setGenderDraft] = useState<string[]>([])
  const [lookingForDraft, setLookingForDraft] = useState<LookingFor[]>([])

  const lookingForOptions: SelectOption<LookingFor>[] = [
    {
      label: t('onboarding.step6.lookingForOptions.friends'),
      value: 'friends',
    },
    {
      label: t('onboarding.step6.lookingForOptions.workoutPartners'),
      value: 'workout_partners',
    },
    {
      label: t('onboarding.step6.lookingForOptions.dating'),
      value: 'dating',
    },
  ]
  const genderPreferenceOptions: SelectOption<string>[] = [
    {
      label: t('onboarding.step6.genderPreferenceOptions.men'),
      value: 'male',
    },
    {
      label: t('onboarding.step6.genderPreferenceOptions.women'),
      value: 'female',
    },
    {
      label: t('onboarding.step6.genderPreferenceOptions.everyone'),
      value: 'everyone',
    },
  ]

  useEffect((): (() => void) => {
    let isMounted = true

    const loadNotificationPrefs = async (): Promise<void> => {
      try {
        const storedPrefs = await AsyncStorage.getItem(NOTIFICATION_PREFS_KEY)

        if (storedPrefs === null) {
          return
        }

        const parsedPrefs: unknown = JSON.parse(storedPrefs)

        if (isMounted && isNotificationPrefs(parsedPrefs)) {
          setNotificationPrefs(parsedPrefs)
        }
      } catch {
        if (isMounted) {
          showSettingsToast(t('errors.generic'), 'error')
        }
      }
    }

    void loadNotificationPrefs()

    return (): void => {
      isMounted = false
    }
  }, [t])

  const persistProfileUpdate = (
    partial: Parameters<typeof updateProfile>[0],
    successMessage?: string
  ): void => {
    void updateProfile(partial)
      .then((): void => {
        const profileError = useProfileStore.getState().error

        if (profileError !== null) {
          showSettingsToast(t(profileError), 'error')
          return
        }

        if (successMessage !== undefined) {
          showSettingsToast(successMessage, 'success')
        }
      })
      .catch((error: unknown): void => {
        showSettingsToast(t(mapFirebaseError(error)), 'error')
      })
  }

  const persistNotificationPrefs = (nextPrefs: NotificationPrefs): void => {
    setNotificationPrefs(nextPrefs)

    void AsyncStorage.setItem(
      NOTIFICATION_PREFS_KEY,
      JSON.stringify(nextPrefs)
    ).catch((): void => {
      showSettingsToast(t('errors.generic'), 'error')
    })
  }

  const openExternalUrl = (url: string): void => {
    void Linking.openURL(url).catch((): void => {
      showSettingsToast(t('errors.generic'), 'error')
    })
  }

  const openDeviceSettings = (): void => {
    void Linking.openSettings().catch((): void => {
      showSettingsToast(t('errors.generic'), 'error')
    })
  }

  const formatListValue = (labels: string[]): string => {
    return labels.length > 0
      ? labels.join(t('settings.listSeparator'))
      : t('profile.notSpecified')
  }

  const handleLogoutConfirm = (): void => {
    Alert.alert(
      t('settings.account.logoutTitle'),
      t('settings.account.logoutConfirm'),
      [
        {
          text: t('common.cancel'),
          style: 'cancel',
        },
        {
          text: t('settings.account.logout'),
          style: 'destructive',
          onPress: (): void => {
            void logout().then((): void => {
              const authError = useAuthStore.getState().error

              if (authError !== null) {
                showSettingsToast(t(authError), 'error')
              }
            })
          },
        },
      ]
    )
  }

  const handlePauseToggle = (isPaused: boolean): void => {
    persistProfileUpdate(
      { paused: isPaused },
      isPaused
        ? t('settings.discovery.pausedOn')
        : t('settings.discovery.pausedOff')
    )
  }

  const handleShowMeToggle = (isVisible: boolean): void => {
    if (isVisible) {
      handlePauseToggle(false)
      return
    }

    Alert.alert(
      t('settings.privacy.showMe'),
      t('settings.discovery.pausedOn'),
      [
        {
          text: t('common.cancel'),
          style: 'cancel',
        },
        {
          text: t('settings.discovery.pause'),
          style: 'destructive',
          onPress: (): void => {
            handlePauseToggle(true)
          },
        },
      ]
    )
  }

  const handlePushToggle = (isEnabled: boolean): void => {
    if (!isEnabled) {
      persistNotificationPrefs({
        ...notificationPrefs,
        pushEnabled: false,
      })
      return
    }

    void enablePushNotifications()
  }

  const enablePushNotifications = async (): Promise<void> => {
    try {
      const granted = await registerForPushNotifications()

      if (!granted) {
        persistNotificationPrefs({
          ...notificationPrefs,
          pushEnabled: false,
        })
        Alert.alert(
          t('settings.notifications.title'),
          t('settings.notifications.permissionDenied'),
          [
            {
              text: t('common.cancel'),
              style: 'cancel',
            },
            {
              text: t('settings.notifications.openSettings'),
              onPress: openDeviceSettings,
            },
          ]
        )
        return
      }

      persistNotificationPrefs({
        ...notificationPrefs,
        pushEnabled: true,
      })
    } catch {
      showSettingsToast(t('errors.generic'), 'error')
    }
  }

  const handleNotificationChildToggle = (
    key: 'newMatches' | 'newMessages',
    isEnabled: boolean
  ): void => {
    persistNotificationPrefs({
      ...notificationPrefs,
      [key]: isEnabled,
    })
  }

  const handleOpenDiscoveryModal = (modal: DiscoveryModal): void => {
    if (profile === null) {
      return
    }

    setAgeMinDraft(profile.preferences.ageRange.min)
    setAgeMaxDraft(profile.preferences.ageRange.max)
    setDistanceDraft(profile.preferences.distanceKm)
    setGenderDraft(profile.preferences.genders)
    setLookingForDraft(profile.lookingFor)
    setActiveModal(modal)
  }

  const handleAgeMinChange = (value: number): void => {
    setAgeMinDraft(Math.min(value, ageMaxDraft - 1))
  }

  const handleAgeMaxChange = (value: number): void => {
    setAgeMaxDraft(Math.max(value, ageMinDraft + 1))
  }

  const handleDiscoveryDone = (): void => {
    if (profile === null || activeModal === null) {
      setActiveModal(null)
      return
    }

    if (activeModal === 'ageRange') {
      persistProfileUpdate({
        preferences: {
          ...profile.preferences,
          ageRange: { min: ageMinDraft, max: ageMaxDraft },
        },
      })
    }

    if (activeModal === 'distance') {
      persistProfileUpdate({
        preferences: {
          ...profile.preferences,
          distanceKm: distanceDraft,
        },
      })
    }

    if (activeModal === 'genderPref') {
      persistProfileUpdate({
        preferences: {
          ...profile.preferences,
          genders: genderDraft,
        },
      })
    }

    if (activeModal === 'lookingFor') {
      persistProfileUpdate({ lookingFor: lookingForDraft })
    }

    setActiveModal(null)
  }

  const handleLanguageSelect = (code: LanguageCode): void => {
    void i18n.changeLanguage(code)
    persistProfileUpdate({ language: code })
    setIsLanguageModalVisible(false)
  }

  const handleBlockedUsers = (): void => {
    Alert.alert(t('settings.privacy.blockedUsers'), t('settings.privacy.noBlocked'))
  }

  const handleUpgradePress = (): void => {
    Alert.alert(
      t('settings.subscription.title'),
      t('settings.subscription.comingSoon')
    )
  }

  const handleManageSubscription = (): void => {
    Alert.alert(
      t('settings.subscription.title'),
      t('settings.subscription.comingSoon')
    )
  }

  const handleDeleteAccount = (): void => {
    Alert.alert(
      t('settings.danger.deleteTitle'),
      t('settings.danger.deleteMessage'),
      [
        {
          text: t('common.cancel'),
          style: 'cancel',
        },
        {
          text: t('settings.danger.deleteAccount'),
          style: 'destructive',
          onPress: (): void => {
            navigation.navigate('DeleteAccount')
          },
        },
      ]
    )
  }

  const getActiveModalTitle = (): string => {
    if (activeModal === 'ageRange') {
      return t('settings.discovery.ageRange')
    }

    if (activeModal === 'distance') {
      return t('settings.discovery.distance')
    }

    if (activeModal === 'genderPref') {
      return t('settings.discovery.genderPref')
    }

    if (activeModal === 'lookingFor') {
      return t('settings.discovery.lookingFor')
    }

    return ''
  }

  const renderDiscoveryModalContent = (): React.JSX.Element | null => {
    if (activeModal === 'ageRange') {
      return (
        <View style={styles.modalControl}>
          <Text style={styles.rangeValue}>
            {t('settings.discovery.ageRangeValue', {
              min: ageMinDraft,
              max: ageMaxDraft,
            })}
          </Text>
          <Slider
            label={t('onboarding.step6.ageMin')}
            min={MIN_AGE}
            max={MAX_AGE}
            value={ageMinDraft}
            onChange={handleAgeMinChange}
            formatLabel={(value: number): string => String(value)}
          />
          <Slider
            label={t('onboarding.step6.ageMax')}
            min={MIN_AGE}
            max={MAX_AGE}
            value={ageMaxDraft}
            onChange={handleAgeMaxChange}
            formatLabel={(value: number): string => String(value)}
          />
        </View>
      )
    }

    if (activeModal === 'distance') {
      return (
        <View style={styles.modalControl}>
          <Slider
            label={t('settings.discovery.distance')}
            min={MIN_DISTANCE_KM}
            max={MAX_DISTANCE_KM}
            value={distanceDraft}
            onChange={setDistanceDraft}
            formatLabel={(value: number): string =>
              t('settings.discovery.km', { value })
            }
          />
        </View>
      )
    }

    if (activeModal === 'genderPref') {
      return (
        <View style={styles.modalControl}>
          <MultiSelect
            options={genderPreferenceOptions.map(
              (option: SelectOption<string>): string => option.label
            )}
            selected={valuesToLabels(genderDraft, genderPreferenceOptions)}
            onChange={(labels: string[]): void => {
              setGenderDraft(labelsToValues(labels, genderPreferenceOptions))
            }}
            min={1}
          />
        </View>
      )
    }

    if (activeModal === 'lookingFor') {
      return (
        <View style={styles.modalControl}>
          <MultiSelect
            options={lookingForOptions.map(
              (option: SelectOption<LookingFor>): string => option.label
            )}
            selected={valuesToLabels(lookingForDraft, lookingForOptions)}
            onChange={(labels: string[]): void => {
              setLookingForDraft(labelsToValues(labels, lookingForOptions))
            }}
            min={1}
          />
        </View>
      )
    }

    return null
  }

  if (profile === null) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>{t('common.loading')}</Text>
        </View>
      </SafeAreaView>
    )
  }

  const isPaused = profile.paused
  const phoneNumber = user?.phoneNumber ?? t('settings.account.noPhone')
  const email = user?.email ?? t('settings.account.noEmail')
  const currentLanguageCode = normalizeLanguageCode(
    profile.language !== '' ? profile.language : i18n.language
  )
  const currentLanguageOption =
    LANGUAGE_OPTIONS.find(
      (option: LanguageOption): boolean =>
        option.code === currentLanguageCode
    ) ?? LANGUAGE_OPTIONS[0]
  const currentLanguageLabel = t(currentLanguageOption.labelKey)
  const genderValue = formatListValue(
    valuesToLabels(profile.preferences.genders, genderPreferenceOptions)
  )
  const lookingForValue = formatListValue(
    valuesToLabels(profile.lookingFor, lookingForOptions)
  )
  const subscriptionTier = profile.subscription.tier
  const renewalDate =
    profile.subscription.expiresAt !== undefined
      ? profile.subscription.expiresAt.toDate().toLocaleDateString()
      : t('profile.notSpecified')
  const appVersion = Constants.expoConfig?.version ?? '1.0.0'

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.screenTitle}>{t('settings.title')}</Text>

        <SettingsSection title={t('settings.account.title')}>
          <SettingsRow
            label={t('settings.account.phone')}
            variant="info"
            value={phoneNumber}
            icon="call-outline"
          />
          <SettingsRow
            label={t('settings.account.email')}
            variant="info"
            value={email}
            icon="mail-outline"
          />
          <SettingsRow
            label={t('settings.account.language')}
            value={currentLanguageLabel}
            icon="language-outline"
            onPress={(): void => {
              setIsLanguageModalVisible(true)
            }}
          />
          <SettingsRow
            label={t('settings.account.logout')}
            variant="destructive"
            icon="log-out-outline"
            iconColor={colors.danger}
            onPress={handleLogoutConfirm}
            isLast={true}
          />
        </SettingsSection>

        <SettingsSection title={t('settings.discovery.title')}>
          <SettingsRow
            label={t('settings.discovery.pause')}
            variant="toggle"
            isEnabled={isPaused}
            onToggle={handlePauseToggle}
            icon="pause-circle-outline"
          />
          <SettingsRow
            label={t('settings.discovery.ageRange')}
            value={t('settings.discovery.ageRangeValue', {
              min: profile.preferences.ageRange.min,
              max: profile.preferences.ageRange.max,
            })}
            icon="calendar-outline"
            onPress={(): void => {
              handleOpenDiscoveryModal('ageRange')
            }}
          />
          <SettingsRow
            label={t('settings.discovery.distance')}
            value={t('settings.discovery.km', {
              value: profile.preferences.distanceKm,
            })}
            icon="location-outline"
            onPress={(): void => {
              handleOpenDiscoveryModal('distance')
            }}
          />
          <SettingsRow
            label={t('settings.discovery.genderPref')}
            value={genderValue}
            icon="people-outline"
            onPress={(): void => {
              handleOpenDiscoveryModal('genderPref')
            }}
          />
          <SettingsRow
            label={t('settings.discovery.lookingFor')}
            value={lookingForValue}
            icon="heart-outline"
            onPress={(): void => {
              handleOpenDiscoveryModal('lookingFor')
            }}
            isLast={true}
          />
        </SettingsSection>

        <SettingsSection title={t('settings.notifications.title')}>
          <SettingsRow
            label={t('settings.notifications.push')}
            variant="toggle"
            isEnabled={notificationPrefs.pushEnabled}
            onToggle={handlePushToggle}
            icon="notifications-outline"
            isLast={!notificationPrefs.pushEnabled}
          />
          {notificationPrefs.pushEnabled && (
            <>
              <SettingsRow
                label={t('settings.notifications.matches')}
                variant="toggle"
                isEnabled={notificationPrefs.newMatches}
                onToggle={(isEnabled: boolean): void => {
                  handleNotificationChildToggle('newMatches', isEnabled)
                }}
                icon="heart-circle-outline"
              />
              <SettingsRow
                label={t('settings.notifications.messages')}
                variant="toggle"
                isEnabled={notificationPrefs.newMessages}
                onToggle={(isEnabled: boolean): void => {
                  handleNotificationChildToggle('newMessages', isEnabled)
                }}
                icon="chatbubble-outline"
                isLast={true}
              />
            </>
          )}
        </SettingsSection>

        <SettingsSection title={t('settings.privacy.title')}>
          <SettingsRow
            label={t('settings.privacy.showMe')}
            variant="toggle"
            isEnabled={!isPaused}
            onToggle={handleShowMeToggle}
            icon="eye-outline"
          />
          <SettingsRow
            label={t('settings.privacy.blockedUsers')}
            value={t('settings.privacy.blockedCount', { count: 0 })}
            icon="ban-outline"
            onPress={handleBlockedUsers}
            isLast={true}
          />
        </SettingsSection>

        {subscriptionTier === 'premium' ? (
          <SettingsSection title={t('settings.subscription.title')}>
            <SettingsRow
              label={t('settings.subscription.plan')}
              variant="info"
              value={t('settings.subscription.planPremium')}
              icon="diamond-outline"
            />
            <SettingsRow
              label={t('settings.subscription.renews')}
              variant="info"
              value={renewalDate}
              icon="calendar-clear-outline"
            />
            <SettingsRow
              label={t('settings.subscription.manage')}
              icon="card-outline"
              onPress={handleManageSubscription}
              isLast={true}
            />
          </SettingsSection>
        ) : (
          <SettingsSection title={t('settings.subscription.title')}>
            <LinearGradient
              colors={PREMIUM_GRADIENT_COLORS}
              style={styles.premiumBanner}
            >
              <Text style={styles.premiumTitle}>
                {t('settings.subscription.upgrade')}
              </Text>
              <Text style={styles.premiumSubtitle}>
                {t('settings.subscription.upgradeSubtitle')}
              </Text>
              <View style={styles.benefitList}>
                <View style={styles.benefitRow}>
                  <Ionicons
                    name="checkmark-circle"
                    size={spacing.lg}
                    color={colors.white}
                  />
                  <Text style={styles.benefitText}>
                    {t('settings.subscription.benefit1')}
                  </Text>
                </View>
                <View style={styles.benefitRow}>
                  <Ionicons
                    name="checkmark-circle"
                    size={spacing.lg}
                    color={colors.white}
                  />
                  <Text style={styles.benefitText}>
                    {t('settings.subscription.benefit2')}
                  </Text>
                </View>
                <View style={styles.benefitRow}>
                  <Ionicons
                    name="checkmark-circle"
                    size={spacing.lg}
                    color={colors.white}
                  />
                  <Text style={styles.benefitText}>
                    {t('settings.subscription.benefit3')}
                  </Text>
                </View>
              </View>
              <Button
                label={t('settings.subscription.upgradeButton')}
                onPress={handleUpgradePress}
              />
            </LinearGradient>
          </SettingsSection>
        )}

        <SettingsSection title={t('settings.support.title')}>
          <SettingsRow
            label={t('settings.support.helpCentre')}
            icon="help-circle-outline"
            onPress={(): void => {
              openExternalUrl('https://help.fitlink.app')
            }}
          />
          <SettingsRow
            label={t('settings.support.contactUs')}
            icon="mail-open-outline"
            onPress={(): void => {
              openExternalUrl(
                'mailto:support@fitlink.app?subject=Support%20Request'
              )
            }}
          />
          <SettingsRow
            label={t('settings.support.rate')}
            icon="star-outline"
            onPress={(): void => {
              openExternalUrl(
                Platform.OS === 'ios' ? APP_STORE_URL : PLAY_STORE_URL
              )
            }}
          />
          <SettingsRow
            label={t('settings.support.terms')}
            icon="document-text-outline"
            onPress={(): void => {
              openExternalUrl('https://fitlink.app/terms')
            }}
          />
          <SettingsRow
            label={t('settings.support.privacy')}
            icon="shield-checkmark-outline"
            onPress={(): void => {
              openExternalUrl('https://fitlink.app/privacy')
            }}
          />
          <SettingsRow
            label={t('settings.support.version')}
            variant="info"
            value={appVersion}
            icon="information-circle-outline"
            isLast={true}
          />
        </SettingsSection>

        <SettingsSection title={t('settings.danger.title')} danger={true}>
          <SettingsRow
            label={t('settings.danger.deleteAccount')}
            variant="destructive"
            icon="trash-outline"
            iconColor={colors.danger}
            onPress={handleDeleteAccount}
            isLast={true}
          />
        </SettingsSection>
      </ScrollView>

      <Modal
        transparent={true}
        animationType="slide"
        visible={activeModal !== null}
        onRequestClose={(): void => {
          setActiveModal(null)
        }}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>{getActiveModalTitle()}</Text>
            {renderDiscoveryModalContent()}
            <Button
              label={t('settings.discovery.done')}
              onPress={handleDiscoveryDone}
            />
          </View>
        </View>
      </Modal>

      <Modal
        transparent={true}
        animationType="slide"
        visible={isLanguageModalVisible}
        onRequestClose={(): void => {
          setIsLanguageModalVisible(false)
        }}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>
              {t('settings.account.language')}
            </Text>
            <View style={styles.languageList}>
              {LANGUAGE_OPTIONS.map((option: LanguageOption) => {
                const isSelected = option.code === currentLanguageCode

                return (
                  <TouchableOpacity
                    key={option.code}
                    style={styles.languageRow}
                    onPress={(): void => {
                      handleLanguageSelect(option.code)
                    }}
                    activeOpacity={0.75}
                  >
                    <Text style={styles.languageFlag}>{option.flag}</Text>
                    <Text style={styles.languageLabel}>
                      {t(option.labelKey)}
                    </Text>
                    {isSelected && (
                      <Ionicons
                        name="checkmark"
                        size={spacing.lg}
                        color={colors.primary}
                      />
                    )}
                  </TouchableOpacity>
                )
              })}
            </View>
            <Button
              label={t('common.cancel')}
              onPress={(): void => {
                setIsLanguageModalVisible(false)
              }}
              variant="outline"
            />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xxl,
  },
  screenTitle: {
    color: colors.gray[900],
    fontSize: typography.sizes.xxl,
    fontWeight: typography.weights.bold,
    marginBottom: spacing.lg,
    marginTop: spacing.md,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  loadingText: {
    color: colors.gray[600],
    fontSize: typography.sizes.md,
  },
  premiumBanner: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  premiumTitle: {
    color: colors.white,
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
  },
  premiumSubtitle: {
    color: colors.white,
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.medium,
  },
  benefitList: {
    gap: spacing.sm,
  },
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  benefitText: {
    color: colors.white,
    flex: 1,
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: borderRadius.lg,
    borderTopRightRadius: borderRadius.lg,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
    paddingTop: spacing.lg,
    gap: spacing.md,
  },
  modalTitle: {
    color: colors.gray[900],
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
  },
  modalControl: {
    paddingVertical: spacing.sm,
  },
  rangeValue: {
    color: colors.primary,
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  languageList: {
    borderColor: colors.gray[200],
    borderRadius: borderRadius.md,
    borderWidth: 1,
    overflow: 'hidden',
  },
  languageRow: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomColor: colors.gray[200],
    borderBottomWidth: 1,
  },
  languageFlag: {
    fontSize: typography.sizes.xl,
  },
  languageLabel: {
    color: colors.gray[900],
    flex: 1,
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.medium,
  },
})
