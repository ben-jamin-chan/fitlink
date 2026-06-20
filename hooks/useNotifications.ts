import { useEffect, useRef } from 'react'
import type { RefObject } from 'react'

import { AppState } from 'react-native'
import type { AppStateStatus } from 'react-native'

import type { NavigationContainerRef } from '@react-navigation/native'
import * as Notifications from 'expo-notifications'
import { useTranslation } from 'react-i18next'

import { useAuthStore } from '@/store/authStore'
import { useMatchStore } from '@/store/matchStore'
import { showToast } from '@/store/toastStore'

import { logError } from '@/services/crashlytics'
import { registerForPushNotifications } from '@/services/notifications'

import type { RootStackParamList } from '@/app/navigation/RootNavigator'

interface NotificationData {
  type: 'message' | 'match' | 'likedMe'
  matchId?: string
  senderId?: string
}

type NotificationSubscription = Notifications.EventSubscription
type NotificationContentData = Notifications.NotificationContent['data']
type RootNavigationRef = RefObject<
  NavigationContainerRef<RootStackParamList> | null
>

const computeTotalUnread = (
  matches: ReadonlyArray<Record<string, unknown>>,
  uid: string
): number => {
  return matches.reduce((sum: number, match: Record<string, unknown>) => {
    const unread = match[`${uid}_unread`]
    return sum + (typeof unread === 'number' ? unread : 0)
  }, 0)
}

const toError = (error: unknown, fallbackMessage: string): Error => {
  return error instanceof Error ? error : new Error(fallbackMessage)
}

export const useNotifications = (
  navigationRef: RootNavigationRef
): void => {
  const { t } = useTranslation()
  const { user, isAuthenticated, hasCompletedOnboarding } = useAuthStore()
  const matches = useMatchStore((state) => state.matches)
  const isMatchesLoading = useMatchStore((state) => state.isLoading)

  const notificationListener = useRef<NotificationSubscription | null>(null)
  const responseListener = useRef<NotificationSubscription | null>(null)
  const registeredUserId = useRef<string | null>(null)
  const matchesRef = useRef(matches)
  const uidRef = useRef(user?.uid)
  const isMatchesLoadingRef = useRef(isMatchesLoading)

  useEffect(() => {
    matchesRef.current = matches
    uidRef.current = user?.uid
    isMatchesLoadingRef.current = isMatchesLoading
  }, [isMatchesLoading, matches, user?.uid])

  useEffect(() => {
    const syncBadge = (status: AppStateStatus): void => {
      if (status !== 'active') {
        return
      }

      if (uidRef.current === undefined || isMatchesLoadingRef.current) {
        return
      }

      const totalUnread = computeTotalUnread(
        matchesRef.current,
        uidRef.current
      )

      void Notifications.setBadgeCountAsync(totalUnread).catch(
        (error: unknown): void => {
          logError(toError(error, 'Badge count sync failed'), {
            action: 'notificationBadgeSync',
          })
        }
      )
    }

    const subscription = AppState.addEventListener('change', syncBadge)
    syncBadge(AppState.currentState)

    return (): void => {
      subscription.remove()
    }
  }, [])

  useEffect(() => {
    if (user?.uid === undefined || isMatchesLoading) {
      return
    }

    const totalUnread = computeTotalUnread(matches, user.uid)

    void Notifications.setBadgeCountAsync(totalUnread).catch(
      (error: unknown): void => {
        logError(toError(error, 'Badge count sync failed'), {
          action: 'notificationBadgeSyncAfterLoad',
        })
      }
    )
  }, [isMatchesLoading, matches, user?.uid])

  useEffect(() => {
    if (!isAuthenticated || !hasCompletedOnboarding || user === null) {
      registeredUserId.current = null
      return
    }

    if (registeredUserId.current === user.uid) {
      return
    }

    registeredUserId.current = user.uid

    registerForPushNotifications(user.uid).catch((error: unknown) => {
      logError(toError(error, 'Notification registration failed'), {
        action: 'notificationRegistration',
      })
    })
  }, [hasCompletedOnboarding, isAuthenticated, user])

  useEffect(() => {
    notificationListener.current =
      Notifications.addNotificationReceivedListener((notification) => {
        const data = parseNotificationData(
          notification.request.content.data
        )

        if (data === null) {
          return
        }

        const body = notification.request.content.body

        if (data.type === 'message') {
          showToast(body ?? t('notifications.newMessage'), 'info')
          return
        }

        if (data.type === 'likedMe') {
          showToast(body ?? t('notifications.likedMe.body'), 'info')
          return
        }

        showToast(body ?? t('notifications.newMatch'), 'success')
      })

    return () => {
      if (notificationListener.current !== null) {
        notificationListener.current.remove()
      }
    }
  }, [t])

  useEffect(() => {
    responseListener.current =
      Notifications.addNotificationResponseReceivedListener((response) => {
        const data = parseNotificationData(
          response.notification.request.content.data
        )

        if (data === null) {
          return
        }

        handleNotificationNavigation(navigationRef, data, 100)
      })

    return () => {
      if (responseListener.current !== null) {
        responseListener.current.remove()
      }
    }
  }, [navigationRef])

  useEffect(() => {
    Notifications.getLastNotificationResponseAsync()
      .then((response) => {
        if (response === null) {
          return
        }

        const data = parseNotificationData(
          response.notification.request.content.data
        )

        if (data === null) {
          return
        }

        handleNotificationNavigation(navigationRef, data, 500)
      })
      .catch((error: unknown) => {
        logError(toError(error, 'Notification response lookup failed'), {
          action: 'notificationResponseLookup',
        })
      })
  }, [navigationRef])
}

const parseNotificationData = (
  data: NotificationContentData
): NotificationData | null => {
  if (
    data.type !== 'message' &&
    data.type !== 'match' &&
    data.type !== 'likedMe'
  ) {
    return null
  }

  const matchId = typeof data.matchId === 'string' ? data.matchId : undefined
  const senderId =
    typeof data.senderId === 'string' ? data.senderId : undefined

  return {
    type: data.type,
    matchId,
    senderId,
  }
}

const handleNotificationNavigation = (
  navigationRef: RootNavigationRef,
  data: NotificationData,
  delayMs: number
): void => {
  if (data.type === 'message' && data.matchId !== undefined) {
    const matchId = data.matchId

    navigateToMatches(navigationRef)

    setTimeout(() => {
      navigateToChat(navigationRef, matchId)
    }, delayMs)
    return
  }

  if (data.type === 'match') {
    navigateToMatches(navigationRef)
  }
}

const navigateToMatches = (navigationRef: RootNavigationRef): void => {
  navigationRef.current?.navigate('MainTabs', {
    screen: 'Matches',
  })
}

const navigateToChat = (
  navigationRef: RootNavigationRef,
  matchId: string
): void => {
  navigationRef.current?.navigate('MainTabs', {
    screen: 'Matches',
    params: {
      screen: 'Chat',
      params: {
        matchId,
      },
    },
  })
}
