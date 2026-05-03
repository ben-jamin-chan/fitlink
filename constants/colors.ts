export const colors = {
  // Brand
  primary: '#4CAF50',
  secondary: '#2196F3',
  danger: '#F44336',
  warning: '#FFC107',
  info: '#9C27B0',

  // Neutrals
  white: '#FFFFFF',
  black: '#000000',
  gray: {
    100: '#F5F5F5',
    200: '#EEEEEE',
    300: '#E0E0E0',
    400: '#BDBDBD',
    500: '#9E9E9E',
    600: '#757575',
    700: '#616161',
    800: '#424242',
    900: '#212121',
  },

  // Surfaces
  background: '#FAFAFA',
  surface: '#FFFFFF',
  surfaceElevated: '#FFFFFF',

  // Overlays
  overlay: 'rgba(0, 0, 0, 0.5)',
  overlayLight: 'rgba(0, 0, 0, 0.2)',

  // Status
  online: '#4CAF50',
  offline: '#BDBDBD',

  // Transparent
  transparent: 'transparent',
} as const

export type ColorKey = keyof typeof colors
