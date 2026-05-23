import { useEffect, useRef } from 'react'
import type { RefObject } from 'react'

import * as Notifications from 'expo-notifications'
import type { NavigationContainerRef } from '@react-navigation/native'
import { useTranslation } from 'react-i18next'

import { useAuthStore } from '@/store/authStore'
import { showToast } from '@/store/toastStore'

import { registerForPushNotifications } from '@/services/notifications'

import type { RootStackParamList } from '@/app/navigation/RootNavigator'

interface NotificationData {
  type: 'message' | 'match'
  matchId?: string
  senderId?: string
}

type NotificationSubscription = Notifications.EventSubscription
type NotificationContentData = Notifications.NotificationContent['data']
type RootNavigationRef = RefObject<
  NavigationContainerRef<RootStackParamList> | null
>

export const useNotifications = (
  navigationRef: RootNavigationRef
): void => {
  const { t } = useTranslation()
  const { user, isAuthenticated, hasCompletedOnboarding } = useAuthStore()

  const notificationListener = useRef<NotificationSubscription | null>(null)
  const responseListener = useRef<NotificationSubscription | null>(null)
  const registeredUserId = useRef<string | null>(null)

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
      console.warn('[Notifications] Registration failed:', error)
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
        console.warn('[Notifications] Last response lookup failed:', error)
      })
  }, [navigationRef])
}

const parseNotificationData = (
  data: NotificationContentData
): NotificationData | null => {
  if (data.type !== 'message' && data.type !== 'match') {
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
