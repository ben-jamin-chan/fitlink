export const SUPPORTED_COUNTRIES = ['Malaysia', 'Singapore', 'Thailand'] as const

export type SupportedCountry = typeof SUPPORTED_COUNTRIES[number]

export const COUNTRY_TIMEZONES: Record<SupportedCountry, string> = {
  Malaysia: 'Asia/Kuala_Lumpur',
  Singapore: 'Asia/Singapore',
  Thailand: 'Asia/Bangkok',
}

export const SEA_CITIES: Record<SupportedCountry, string[]> = {
  Malaysia: [
    'Kuala Lumpur',
    'Selangor',
    'Penang',
    'Johor Bahru',
    'Ipoh',
    'Melaka',
    'Kota Kinabalu',
    'Kuching',
    'Kuantan',
    'Alor Setar',
  ],
  Singapore: ['Central', 'East', 'North', 'South', 'West'],
  Thailand: ['Bangkok', 'Chiang Mai', 'Phuket', 'Pattaya', 'Hat Yai'],
}
