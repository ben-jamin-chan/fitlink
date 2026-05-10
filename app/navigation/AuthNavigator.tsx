import React from 'react'

import { StyleSheet, Text, View } from 'react-native'

import { createStackNavigator } from '@react-navigation/stack'

import LandingScreen from '@/app/auth/LandingScreen'
import OTPVerifyScreen from '@/app/auth/OTPVerifyScreen'
import PhoneLoginScreen from '@/app/auth/PhoneLoginScreen'

import { colors, typography } from '@/constants/theme'

export type AuthStackParamList = {
  Landing: undefined
  PhoneLogin: undefined
  OTPVerify: { phoneNumber: string }
  EmailLogin: undefined
  SignUp: undefined
}

interface PlaceholderScreenProps {
  name: string
}

const Stack = createStackNavigator<AuthStackParamList>()

export const AuthNavigator = (): React.JSX.Element => (
  <Stack.Navigator screenOptions={screenOptions}>
    <Stack.Screen name="Landing" component={LandingScreen} />
    <Stack.Screen name="PhoneLogin" component={PhoneLoginScreen} />
    <Stack.Screen name="OTPVerify" component={OTPVerifyScreen} />
    <Stack.Screen name="EmailLogin" component={EmailLoginPlaceholder} />
    <Stack.Screen name="SignUp" component={SignUpPlaceholder} />
  </Stack.Navigator>
)

const EmailLoginPlaceholder = (): React.JSX.Element => (
  <PlaceholderScreen name="Email Login" />
)

const SignUpPlaceholder = (): React.JSX.Element => (
  <PlaceholderScreen name="Sign Up" />
)

const PlaceholderScreen = ({
  name,
}: PlaceholderScreenProps): React.JSX.Element => (
  <View style={styles.container}>
    <Text style={styles.text}>{name}</Text>
  </View>
)

const screenOptions = {
  headerShown: false,
  cardStyle: {
    backgroundColor: colors.background,
  },
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  text: {
    fontSize: typography.sizes.lg,
    color: colors.gray[600],
  },
})
