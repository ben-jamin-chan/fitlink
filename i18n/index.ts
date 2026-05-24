import { getLocales } from 'expo-localization'
import i18n from 'i18next'
import type { InitOptions } from 'i18next'
import { initReactI18next } from 'react-i18next'

import en from '@/i18n/en.json'
import my from '@/i18n/my.json'
import ta from '@/i18n/ta.json'
import zh from '@/i18n/zh.json'

const deviceLocale = getLocales()[0]?.languageCode ?? 'en'

const supportedLanguages = ['en', 'ms', 'my', 'zh', 'ta']
const detectedLanguage = supportedLanguages.includes(deviceLocale)
  ? deviceLocale
  : 'en'

// i18next v26 types only expose JSON compatibility v4, but this project
// intentionally keeps v3 compatibility for React Native translation files.
const i18nInitOptions = {
  resources: {
    en: { translation: en },
    ms: { translation: my },
    my: { translation: my },
    zh: { translation: zh },
    ta: { translation: ta },
  },
  lng: detectedLanguage,
  fallbackLng: 'en',
  initImmediate: false,
  interpolation: {
    escapeValue: false,
  },
  react: {
    useSuspense: false,
  },
  compatibilityJSON: 'v3',
} as unknown as InitOptions

void i18n.use(initReactI18next).init(i18nInitOptions)

export default i18n
