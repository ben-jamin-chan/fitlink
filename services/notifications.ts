import * as Notifications from 'expo-notifications'

export const registerForPushNotifications = async (): Promise<boolean> => {
  const existingPermissions = await Notifications.getPermissionsAsync()

  if (existingPermissions.granted) {
    return true
  }

  const requestedPermissions = await Notifications.requestPermissionsAsync()

  return requestedPermissions.granted
}
