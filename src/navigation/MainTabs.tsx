import React from 'react';
import { Platform } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

import { Ionicons } from '@expo/vector-icons';
import { MainTabsParamList } from '../types/navigation';
import { FeedStack } from './FeedStack';
import { MatchesStack } from './MatchesStack';
import { SearchStack } from './SearchStack';
import { ActivityStack } from './ActivityStack';
import { ProfileStack } from './ProfileStack';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../hooks/useNotifications';

const Tab = createBottomTabNavigator<MainTabsParamList>();

const TAB_ICONS: Record<keyof MainTabsParamList, { active: keyof typeof Ionicons.glyphMap; inactive: keyof typeof Ionicons.glyphMap }> = {
  FeedTab: { active: 'home', inactive: 'home-outline' },
  MatchesTab: { active: 'calendar', inactive: 'calendar-outline' },
  SearchTab: { active: 'search', inactive: 'search-outline' },
  ActivityTab: { active: 'heart', inactive: 'heart-outline' },
  ProfileTab: { active: 'person', inactive: 'person-outline' },
};

const TAB_LABELS: Record<keyof MainTabsParamList, string> = {
  FeedTab: 'Feed',
  MatchesTab: 'Matches',
  SearchTab: 'Search',
  ActivityTab: 'Activity',
  ProfileTab: 'Profile',
};

export function MainTabs() {
  const { theme } = useTheme();
  const { colors, spacing } = theme;
  const { user } = useAuth();
  const { data: notifications } = useNotifications(user?.uid || '');
  const unreadCount = notifications?.filter((n: any) => !n.isRead).length || 0;

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.background,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          paddingTop: spacing.xs,
          paddingBottom: Platform.OS === 'ios' ? spacing.lg : spacing.sm,
          height: Platform.OS === 'ios' ? 85 : 65,
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarLabel: TAB_LABELS[route.name],
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '500' as const,
        },
        tabBarIcon: ({ focused, color }) => {
          const icons = TAB_ICONS[route.name];
          return (
            <Ionicons
              name={focused ? icons.active : icons.inactive}
              size={22}
              color={color}
            />
          );
        },
      })}
    >
      <Tab.Screen name="FeedTab" component={FeedStack} />
      <Tab.Screen name="MatchesTab" component={MatchesStack} />
      <Tab.Screen name="SearchTab" component={SearchStack} />
      <Tab.Screen
        name="ActivityTab"
        component={ActivityStack}
        options={{
          tabBarBadge: unreadCount > 0 ? (unreadCount > 9 ? '9+' : unreadCount) : undefined,
          tabBarBadgeStyle: unreadCount > 0 ? { backgroundColor: '#00e054', color: '#fff', fontSize: 10, fontWeight: '700', minWidth: 18, height: 18, lineHeight: 18 } : undefined,
        }}
      />
      <Tab.Screen name="ProfileTab" component={ProfileStack} />
    </Tab.Navigator>
  );
}
