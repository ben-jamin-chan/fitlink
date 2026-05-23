import * as Notifications from 'expo-notifications'
import { doc, updateDoc } from 'firebase/firestore'
import { Platform } from 'react-native'

import { db } from '@/services/firebase/config'

import { colors } from '@/constants/theme'

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
})

export async function registerForPushNotifications(): Promise<boolean>
export async function registerForPushNotifications(
  userId: string
): Promise<string | null>
export async function registerForPushNotifications(
  userId?: string
): Promise<boolean | string | null> {
  const isDevice = await isPhysicalDevice()

  if (!isDevice) {
    console.warn('[Notifications] Push notifications require a physical device.')
    return userId === undefined ? false : null
  }

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: colors.primary,
    })
  }

  const existingPermissions = await Notifications.getPermissionsAsync()
  let finalStatus = existingPermissions.status

  if (finalStatus !== 'granted') {
    const requestedPermissions = await Notifications.requestPermissionsAsync()
    finalStatus = requestedPermissions.status
  }

  if (finalStatus !== 'granted') {
    return userId === undefined ? false : null
  }

  if (userId === undefined) {
    return true
  }

  const tokenData = await Notifications.getExpoPushTokenAsync()
  const token = tokenData.data

  await updateDoc(doc(db, 'users', userId), {
    expoPushToken: token,
  })

  return token
}

export const unregisterPushNotifications = async (
  userId: string
): Promise<void> => {
  await updateDoc(doc(db, 'users', userId), {
    expoPushToken: null,
  })
}

const isPhysicalDevice = async (): Promise<boolean> => {
  const Constants = await import('expo-constants')

  return Constants.default.isDevice === true
}
