import React from 'react'

import { StyleSheet, Text, View } from 'react-native'

import { Ionicons } from '@expo/vector-icons'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { createStackNavigator } from '@react-navigation/stack'

import ChatScreen from '@/app/chat/ChatScreen'
import DiscoveryScreen from '@/app/discovery/DiscoveryScreen'
import MatchesScreen from '@/app/matches/MatchesScreen'

import { colors, spacing, typography } from '@/constants/theme'

export type MainTabParamList = {
  Discover: undefined
  Matches: undefined
  Profile: undefined
  Settings: undefined
}

export type MatchesStackParamList = {
  MatchesList: undefined
  Chat: { matchId: string }
}

interface PlaceholderScreenProps {
  name: string
}

const Tab = createBottomTabNavigator<MainTabParamList>()
const MatchesStack = createStackNavigator<MatchesStackParamList>()

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
    <Tab.Screen name="Profile" component={ProfilePlaceholder} />
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

const ProfilePlaceholder = (): React.JSX.Element => (
  <PlaceholderScreen name="Profile" />
)

const SettingsPlaceholder = (): React.JSX.Element => (
  <PlaceholderScreen name="Settings" />
)

const PlaceholderScreen = ({
  name,
}: PlaceholderScreenProps): React.JSX.Element => (
  <View style={styles.placeholder}>
    <Text style={styles.placeholderText}>{name}</Text>
  </View>
)

const matchesStackScreenOptions = {
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
