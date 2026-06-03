import { Platform } from 'react-native'

import crashlytics from '@react-native-firebase/crashlytics'

export const logError = (
  error: Error,
  context?: Record<string, string>
): void => {
  try {
    if (context !== undefined) {
      const entries = Object.entries(context)
      for (const [key, value] of entries) {
        crashlytics().setAttribute(key, value)
      }
    }

    crashlytics().recordError(error)
  } catch {
    return undefined
  }
}

export const setUser = (uid: string): void => {
  try {
    crashlytics().setUserId(uid)
    crashlytics().setAttribute('platform', Platform.OS)
  } catch {
    return undefined
  }
}

export const log = (message: string): void => {
  try {
    crashlytics().log(message)
  } catch {
    return undefined
  }
}
