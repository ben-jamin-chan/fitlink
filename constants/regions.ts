export const SUPPORTED_COUNTRIES = [
  'Malaysia',
  'Singapore',
  'Thailand',
  'Philippines',
  'Indonesia',
  'Vietnam',
] as const

export type SupportedCountry = typeof SUPPORTED_COUNTRIES[number]

export const COUNTRY_TIMEZONES: Record<SupportedCountry, string> = {
  Malaysia: 'Asia/Kuala_Lumpur',
  Singapore: 'Asia/Singapore',
  Thailand: 'Asia/Bangkok',
  Philippines: 'Asia/Manila',
  Indonesia: 'Asia/Jakarta',
  Vietnam: 'Asia/Ho_Chi_Minh',
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
  Philippines: [
    'Manila',
    'Cebu',
    'Davao',
    'Quezon City',
    'Makati',
    'Taguig',
    'Pasig',
    'Antipolo',
    'Iloilo',
    'Zamboanga',
  ],
  Indonesia: [
    'Jakarta',
    'Bali',
    'Surabaya',
    'Bandung',
    'Medan',
    'Semarang',
    'Makassar',
    'Palembang',
    'Tangerang',
    'Depok',
  ],
  Vietnam: [
    'Ho Chi Minh City',
    'Hanoi',
    'Da Nang',
    'Hai Phong',
    'Can Tho',
    'Bien Hoa',
    'Hue',
    'Nha Trang',
    'Vung Tau',
    'Quy Nhon',
  ],
}

export const COUNTRY_CURRENCIES: Record<SupportedCountry, string> = {
  Malaysia: 'MYR',
  Singapore: 'SGD',
  Thailand: 'THB',
  Philippines: 'PHP',
  Indonesia: 'IDR',
  Vietnam: 'VND',
}

export const COUNTRY_CALLING_CODES: Record<SupportedCountry, string> = {
  Malaysia: '+60',
  Singapore: '+65',
  Thailand: '+66',
  Philippines: '+63',
  Indonesia: '+62',
  Vietnam: '+84',
}
