import React from 'react'

import { StyleSheet, Text, View } from 'react-native'

import { Ionicons } from '@expo/vector-icons'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import type { NavigatorScreenParams } from '@react-navigation/native'
import { createStackNavigator } from '@react-navigation/stack'
import { useTranslation } from 'react-i18next'

import ChatScreen from '@/app/chat/ChatScreen'
import DiscoveryScreen from '@/app/discovery/DiscoveryScreen'
import MatchesScreen from '@/app/matches/MatchesScreen'
import ProfileScreen from '@/app/profile/ProfileScreen'

import { colors, spacing, typography } from '@/constants/theme'

export type MatchesStackParamList = {
  MatchesList: undefined
  Chat: { matchId: string; icebreakerSuggestion?: string }
}

export type ProfileStackParamList = {
  Profile: undefined
  EditProfile: undefined
  Settings: undefined
}

export type MainTabParamList = {
  Discover: undefined
  Matches: NavigatorScreenParams<MatchesStackParamList> | undefined
  Profile: NavigatorScreenParams<ProfileStackParamList> | undefined
  Settings: undefined
}

interface PlaceholderScreenProps {
  title: string
}

const Tab = createBottomTabNavigator<MainTabParamList>()
const MatchesStack = createStackNavigator<MatchesStackParamList>()
const ProfileStack = createStackNavigator<ProfileStackParamList>()

type IoniconName = React.ComponentProps<typeof Ionicons>['name']

const TAB_ICONS: Record<
  keyof MainTabParamList,
  { active: IoniconName; inactive: IoniconName }
> = {
  Discover: { active: 'flame', inactive: 'flame-outline' },
  Matches: { active: 'heart', inactive: 'heart-outline' },
  Profile: { active: 'person', inactive: 'person-outline' },
  Settings: { active: 'settings', inactive: 'settings-outline' },
}

export const MainTabNavigator = (): React.JSX.Element => (
  <Tab.Navigator
    screenOptions={({ route }) => ({
      headerShown: false,
      tabBarActiveTintColor: colors.primary,
      tabBarInactiveTintColor: colors.gray[400],
      tabBarStyle: styles.tabBar,
      tabBarLabelStyle: styles.tabLabel,
      tabBarIcon: ({ focused, color, size }) => {
        const icons = TAB_ICONS[route.name]
        const iconName = focused ? icons.active : icons.inactive

        return <Ionicons name={iconName} size={size} color={color} />
      },
    })}
  >
    <Tab.Screen name="Discover" component={DiscoveryScreen} />
    <Tab.Screen name="Matches" component={MatchesNavigator} />
    <Tab.Screen name="Profile" component={ProfileStackNavigator} />
    <Tab.Screen name="Settings" component={SettingsPlaceholder} />
  </Tab.Navigator>
)

const MatchesNavigator = (): React.JSX.Element => (
  <MatchesStack.Navigator screenOptions={matchesStackScreenOptions}>
    <MatchesStack.Screen name="MatchesList" component={MatchesScreen} />
    <MatchesStack.Screen
      name="Chat"
      component={ChatScreen}
      options={{ headerShown: true }}
    />
  </MatchesStack.Navigator>
)

const ProfileStackNavigator = (): React.JSX.Element => (
  <ProfileStack.Navigator screenOptions={profileStackScreenOptions}>
    <ProfileStack.Screen name="Profile" component={ProfileScreen} />
    <ProfileStack.Screen
      name="EditProfile"
      component={EditProfilePlaceholder}
    />
    <ProfileStack.Screen name="Settings" component={SettingsPlaceholder} />
  </ProfileStack.Navigator>
)

const EditProfilePlaceholder = (): React.JSX.Element => {
  const { t } = useTranslation()

  return <PlaceholderScreen title={t('profile.editProfile')} />
}

const SettingsPlaceholder = (): React.JSX.Element => {
  const { t } = useTranslation()

  return <PlaceholderScreen title={t('profile.settings')} />
}

const PlaceholderScreen = ({
  title,
}: PlaceholderScreenProps): React.JSX.Element => (
  <View style={styles.placeholder}>
    <Text style={styles.placeholderText}>{title}</Text>
  </View>
)

const matchesStackScreenOptions = {
  headerShown: false,
}

const profileStackScreenOptions = {
  headerShown: false,
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: colors.surface,
    borderTopColor: colors.gray[200],
    borderTopWidth: 1,
    paddingBottom: spacing.xs,
    paddingTop: spacing.xs,
    height: spacing.xxxl - spacing.xs,
  },
  tabLabel: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.medium,
  },
  placeholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  placeholderText: {
    fontSize: typography.sizes.lg,
    color: colors.gray[600],
  },
})
