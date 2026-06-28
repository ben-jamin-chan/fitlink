import React from 'react'

import { StyleSheet, Text, View } from 'react-native'

import { Ionicons } from '@expo/vector-icons'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import type { NavigatorScreenParams } from '@react-navigation/native'
import { createStackNavigator } from '@react-navigation/stack'
import { useTranslation } from 'react-i18next'

import ChatScreen from '@/app/chat/ChatScreen'
import GymCheckinScreen from '@/app/checkin/GymCheckinScreen'
import DiscoveryScreen from '@/app/discovery/DiscoveryScreen'
import CreateEventScreen from '@/app/events/CreateEventScreen'
import EventDetailScreen from '@/app/events/EventDetailScreen'
import EventsScreen from '@/app/events/EventsScreen'
import MatchesScreen from '@/app/matches/MatchesScreen'
import EditProfileScreen from '@/app/profile/EditProfileScreen'
import ProfileScreen from '@/app/profile/ProfileScreen'
import BlockedUsersScreen from '@/app/settings/BlockedUsersScreen'
import ConnectedAppsScreen from '@/app/settings/ConnectedAppsScreen'
import DeleteAccountScreen from '@/app/settings/DeleteAccountScreen'
import SafetyCenterScreen from '@/app/settings/SafetyCenterScreen'
import SettingsScreen from '@/app/settings/SettingsScreen'

import { colors, spacing, typography } from '@/constants/theme'

export type MatchesStackParamList = {
  MatchesList: undefined
  Chat: { matchId: string; icebreakerSuggestion?: string }
}

export type ProfileStackParamList = {
  Profile: undefined
  EditProfile: undefined
  Settings: undefined
  GymCheckin: undefined
}

export type EventsStackParamList = {
  Events: undefined
  CreateEvent: undefined
  EventDetail: { eventId: string }
}

export type SettingsStackParamList = {
  Settings: undefined
  DeleteAccount: undefined
  ConnectedApps: undefined
  BlockedUsers: undefined
  SafetyCenter: undefined
}

export type MainTabParamList = {
  Discover: undefined
  Matches: NavigatorScreenParams<MatchesStackParamList> | undefined
  Events: NavigatorScreenParams<EventsStackParamList> | undefined
  Profile: NavigatorScreenParams<ProfileStackParamList> | undefined
  Settings: NavigatorScreenParams<SettingsStackParamList> | undefined
}

interface PlaceholderScreenProps {
  title: string
}

const Tab = createBottomTabNavigator<MainTabParamList>()
const MatchesStack = createStackNavigator<MatchesStackParamList>()
const EventsStack = createStackNavigator<EventsStackParamList>()
const ProfileStack = createStackNavigator<ProfileStackParamList>()
const SettingsStack = createStackNavigator<SettingsStackParamList>()

type IoniconName = React.ComponentProps<typeof Ionicons>['name']

const TAB_ICONS: Record<
  keyof MainTabParamList,
  { active: IoniconName; inactive: IoniconName }
> = {
  Discover: { active: 'flame', inactive: 'flame-outline' },
  Matches: { active: 'heart', inactive: 'heart-outline' },
  Events: { active: 'calendar', inactive: 'calendar-outline' },
  Profile: { active: 'person', inactive: 'person-outline' },
  Settings: { active: 'settings', inactive: 'settings-outline' },
}

const TAB_LABEL_KEYS: Record<keyof MainTabParamList, string> = {
  Discover: 'navigation.tabs.discover',
  Matches: 'navigation.tabs.matches',
  Events: 'navigation.tabs.events',
  Profile: 'navigation.tabs.profile',
  Settings: 'navigation.tabs.settings',
}

export const MainTabNavigator = (): React.JSX.Element => {
  const { t } = useTranslation()

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.gray[400],
        tabBarStyle: styles.tabBar,
        tabBarLabel: t(TAB_LABEL_KEYS[route.name]),
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
      <Tab.Screen name="Events" component={EventsStackNavigator} />
      <Tab.Screen name="Profile" component={ProfileStackNavigator} />
      <Tab.Screen name="Settings" component={SettingsStackNavigator} />
    </Tab.Navigator>
  )
}

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

const EventsStackNavigator = (): React.JSX.Element => (
  <EventsStack.Navigator screenOptions={eventsStackScreenOptions}>
    <EventsStack.Screen name="Events" component={EventsScreen} />
    <EventsStack.Screen name="CreateEvent" component={CreateEventScreen} />
    <EventsStack.Screen name="EventDetail" component={EventDetailScreen} />
  </EventsStack.Navigator>
)

const ProfileStackNavigator = (): React.JSX.Element => {
  const { t } = useTranslation()

  return (
    <ProfileStack.Navigator screenOptions={profileStackScreenOptions}>
      <ProfileStack.Screen name="Profile" component={ProfileScreen} />
      <ProfileStack.Screen name="EditProfile" component={EditProfileScreen} />
      <ProfileStack.Screen name="Settings" component={SettingsPlaceholder} />
      <ProfileStack.Screen
        name="GymCheckin"
        component={GymCheckinScreen}
        options={{
          headerShown: true,
          headerBackTitle: '',
          title: t('checkin.title'),
        }}
      />
    </ProfileStack.Navigator>
  )
}

const SettingsStackNavigator = (): React.JSX.Element => {
  const { t } = useTranslation()

  return (
    <SettingsStack.Navigator screenOptions={settingsStackScreenOptions}>
      <SettingsStack.Screen name="Settings" component={SettingsScreen} />
      <SettingsStack.Screen
        name="DeleteAccount"
        component={DeleteAccountScreen}
        options={{
          title: t('deleteAccount.screenTitle'),
        }}
      />
      <SettingsStack.Screen
        name="ConnectedApps"
        component={ConnectedAppsScreen}
        options={{
          headerBackTitle: '',
          headerShown: true,
          title: t('settings.connectedApps.title'),
        }}
      />
      <SettingsStack.Screen
        name="BlockedUsers"
        component={BlockedUsersScreen}
        options={{
          headerBackTitle: '',
          headerShown: true,
          title: t('settings.blocked.title'),
        }}
      />
      <SettingsStack.Screen
        name="SafetyCenter"
        component={SafetyCenterScreen}
        options={{
          headerBackTitle: '',
          headerShown: true,
          title: t('safety.screenTitle'),
        }}
      />
    </SettingsStack.Navigator>
  )
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

const eventsStackScreenOptions = {
  headerShown: false,
}

const profileStackScreenOptions = {
  headerShown: false,
}

const settingsStackScreenOptions = {
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
