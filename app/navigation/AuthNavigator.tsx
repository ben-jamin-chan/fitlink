import React from 'react'

import { createStackNavigator } from '@react-navigation/stack'

import EmailLoginScreen from '@/app/auth/EmailLoginScreen'
import LandingScreen from '@/app/auth/LandingScreen'
import OTPVerifyScreen from '@/app/auth/OTPVerifyScreen'
import PhoneLoginScreen from '@/app/auth/PhoneLoginScreen'
import SignUpScreen from '@/app/auth/SignUpScreen'

import { colors } from '@/constants/theme'

export type AuthStackParamList = {
  Landing: undefined
  PhoneLogin: undefined
  OTPVerify: { phoneNumber: string }
  EmailLogin: undefined
  SignUp: undefined
}

const Stack = createStackNavigator<AuthStackParamList>()

export const AuthNavigator = (): React.JSX.Element => (
  <Stack.Navigator screenOptions={screenOptions}>
    <Stack.Screen name="Landing" component={LandingScreen} />
    <Stack.Screen name="PhoneLogin" component={PhoneLoginScreen} />
    <Stack.Screen name="OTPVerify" component={OTPVerifyScreen} />
    <Stack.Screen name="EmailLogin" component={EmailLoginScreen} />
    <Stack.Screen name="SignUp" component={SignUpScreen} />
  </Stack.Navigator>
)

const screenOptions = {
  headerShown: false,
  cardStyle: {
    backgroundColor: colors.background,
  },
}
