import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import * as Linking from 'expo-linking';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { AuthStack } from './AuthStack';
import { OnboardingStack } from './OnboardingStack';
import { MainTabs } from './MainTabs';
import { navigationRef } from './navigationRef';
import { CreateUsernameScreen } from '../screens/auth/CreateUsernameScreen';

const prefix = Linking.createURL('/');

const linking = {
  prefixes: [prefix, 'bookd://', 'https://bookd-app.com'],
  config: {
    screens: {
      FeedTab: {
        screens: {
          MatchDetail: {
            path: 'match/:matchId',
            parse: { matchId: Number },
          },
          ReviewDetail: 'review/:reviewId',
          ListDetail: 'list/:listId',
          UserProfile: 'profile/:userId',
        },
      },
    },
  },
};

export function RootNavigator() {
  const { user, loading, needsOnboarding, needsUsername } = useAuth();
  const { theme, isDark } = useTheme();

  if (loading) {
    // Splash screen is still visible — render nothing
    return null;
  }

  const getContent = () => {
    if (!user) return <AuthStack />;
    if (needsUsername) return <CreateUsernameScreen />;
    if (needsOnboarding) return <OnboardingStack />;
    return <MainTabs />;
  };

  return (
    <NavigationContainer
      ref={navigationRef}
      linking={linking}
      theme={{
        dark: isDark,
        colors: {
          primary: theme.colors.primary,
          background: theme.colors.background,
          card: theme.colors.card,
          text: theme.colors.foreground,
          border: theme.colors.border,
          notification: theme.colors.primary,
        },
        fonts: {
          regular: { fontFamily: 'System', fontWeight: '400' },
          medium: { fontFamily: 'System', fontWeight: '500' },
          bold: { fontFamily: 'System', fontWeight: '700' },
          heavy: { fontFamily: 'System', fontWeight: '900' },
        },
      }}
    >
      {getContent()}
    </NavigationContainer>
  );
}
