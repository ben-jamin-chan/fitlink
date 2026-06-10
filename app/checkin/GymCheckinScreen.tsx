import React, { useCallback, useEffect, useState } from 'react'

import {
  Alert,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import type { TextStyle, ViewStyle } from 'react-native'

import type { StackNavigationProp } from '@react-navigation/stack'
import * as Location from 'expo-location'
import { useTranslation } from 'react-i18next'
import { SafeAreaView } from 'react-native-safe-area-context'

import { useAuthStore } from '@/store/authStore'
import { useCheckinStore } from '@/store/checkinStore'
import { useProfileStore } from '@/store/profileStore'
import { showToast } from '@/store/toastStore'

import { ActiveCheckinBanner } from '@/components/checkin/ActiveCheckinBanner'
import { GymSearchList } from '@/components/checkin/GymSearchList'
import { LoadingOverlay } from '@/components/ui/LoadingOverlay'

import { searchNearbyGyms } from '@/services/places'

import type { ProfileStackParamList } from '@/app/navigation/MainTabNavigator'
import type { GymPlace } from '@/types/checkin'

import { colors, spacing, typography } from '@/constants/theme'

type GymCheckinNavigationProp = StackNavigationProp<
  ProfileStackParamList,
  'GymCheckin'
>

interface GymCheckinScreenProps {
  navigation: GymCheckinNavigationProp
}

interface GymCheckinScreenStyles {
  activeContainer: ViewStyle
  activeHint: TextStyle
  container: ViewStyle
  errorText: TextStyle
  searchContainer: ViewStyle
  searchInput: TextStyle
}

const SEARCH_RADIUS_METERS = 2000

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null
}

const isAlreadyCheckedInError = (error: unknown): boolean => {
  if (!isRecord(error) || typeof error.code !== 'string') {
    return false
  }

  return (
    error.code === 'functions/already-exists' ||
    error.code === 'already-exists'
  )
}

export default function GymCheckinScreen({
  navigation,
}: GymCheckinScreenProps): React.JSX.Element {
  const { t } = useTranslation()
  const userId = useAuthStore((state) => state.user?.uid)
  const profile = useProfileStore((state) => state.profile)
  const activeCheckin = useCheckinStore((state) => state.activeCheckin)
  const isLoading = useCheckinStore((state) => state.isLoading)
  const checkIn = useCheckinStore((state) => state.checkIn)
  const checkOut = useCheckinStore((state) => state.checkOut)
  const [gyms, setGyms] = useState<GymPlace[]>([])
  const [filteredGyms, setFilteredGyms] = useState<GymPlace[]>([])
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [isFetching, setIsFetching] = useState<boolean>(false)
  const [locationError, setLocationError] = useState<boolean>(false)

  const fetchNearbyGyms = useCallback(async (): Promise<void> => {
    setIsFetching(true)
    setLocationError(false)

    try {
      const permission = await Location.requestForegroundPermissionsAsync()

      if (permission.status !== Location.PermissionStatus.GRANTED) {
        setLocationError(true)
        return
      }

      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      })
      const results = await searchNearbyGyms(
        {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        },
        SEARCH_RADIUS_METERS
      )

      setGyms(results)
      setFilteredGyms(results)
    } catch {
      setLocationError(true)
      showToast(t('checkin.searchError'), 'error')
    } finally {
      setIsFetching(false)
    }
  }, [t])

  useEffect(() => {
    if (activeCheckin === null) {
      void fetchNearbyGyms()
    }
  }, [activeCheckin, fetchNearbyGyms])

  useEffect(() => {
    const trimmedQuery = searchQuery.trim().toLowerCase()

    if (trimmedQuery.length === 0) {
      setFilteredGyms(gyms)
      return
    }

    setFilteredGyms(
      gyms.filter((gym: GymPlace): boolean =>
        gym.name.toLowerCase().includes(trimmedQuery)
      )
    )
  }, [gyms, searchQuery])

  const handleCheckIn = async (gym: GymPlace): Promise<void> => {
    const city = profile?.location.city

    if (city === undefined || city.trim().length === 0) {
      showToast(t('errors.generic'), 'error')
      return
    }

    try {
      await checkIn(gym, city)
      showToast(t('checkin.success', { gymName: gym.name }), 'success')
      navigation.goBack()
    } catch (error: unknown) {
      if (isAlreadyCheckedInError(error)) {
        Alert.alert(
          t('checkin.alreadyCheckedIn'),
          t('checkin.alreadyCheckedInHint')
        )
        return
      }

      showToast(t('errors.generic'), 'error')
    }
  }

  const handleSelectGym = (gym: GymPlace): void => {
    Alert.alert(
      t('checkin.confirmTitle'),
      t('checkin.confirmMessage', { gymName: gym.name }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('checkin.checkIn'),
          onPress: (): void => {
            void handleCheckIn(gym)
          },
        },
      ]
    )
  }

  const handleCheckOut = (): void => {
    if (userId === undefined) {
      return
    }

    Alert.alert(t('checkin.checkOut'), t('checkin.confirmCheckOut'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('checkin.checkOut'),
        style: 'destructive',
        onPress: (): void => {
          void checkOut(userId)
        },
      },
    ])
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <LoadingOverlay visible={isLoading} message={t('checkin.checkingIn')} />

      {activeCheckin !== null ? (
        <View style={styles.activeContainer}>
          <ActiveCheckinBanner
            checkin={activeCheckin}
            onCheckOut={handleCheckOut}
          />
          <Text style={styles.activeHint}>
            {t('checkin.alreadyCheckedInHint')}
          </Text>
        </View>
      ) : (
        <>
          {locationError && (
            <Text style={styles.errorText}>{t('checkin.locationError')}</Text>
          )}
          <View style={styles.searchContainer}>
            <TextInput
              style={styles.searchInput}
              placeholder={t('checkin.searchPlaceholder')}
              placeholderTextColor={colors.gray[400]}
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCorrect={false}
              returnKeyType="search"
            />
          </View>
          <GymSearchList
            gyms={filteredGyms}
            onSelect={handleSelectGym}
            isLoading={isFetching}
          />
        </>
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create<GymCheckinScreenStyles>({
  activeContainer: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
  },
  activeHint: {
    color: colors.gray[600],
    fontSize: typography.sizes.sm,
    textAlign: 'center',
  },
  container: {
    backgroundColor: colors.background,
    flex: 1,
  },
  errorText: {
    color: colors.danger,
    fontSize: typography.sizes.sm,
    paddingBottom: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    textAlign: 'center',
  },
  searchContainer: {
    paddingBottom: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
  },
  searchInput: {
    backgroundColor: colors.gray[100],
    borderRadius: spacing.sm,
    color: colors.gray[800],
    fontSize: typography.sizes.md,
    paddingHorizontal: spacing.md,
    paddingVertical: Platform.OS === 'ios' ? spacing.sm : spacing.xs,
  },
})
