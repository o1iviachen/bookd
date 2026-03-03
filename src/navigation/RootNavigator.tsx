import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import * as Linking from 'expo-linking';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { AuthStack } from './AuthStack';
import { OnboardingStack } from './OnboardingStack';
import { MainTabs } from './MainTabs';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { navigationRef } from './navigationRef';

const prefix = Linking.createURL('/');

const linking = {
  prefixes: [prefix, 'bookd://'],
  config: {
    screens: {
      Main: {
        screens: {
          FeedTab: {
            screens: {
              MatchDetail: {
                path: 'match/:matchId',
                parse: { matchId: Number },
              },
              ReviewDetail: 'review/:reviewId',
              ListDetail: 'list/:listId',
            },
          },
        },
      },
    },
  },
};

export function RootNavigator() {
  const { user, loading, needsOnboarding } = useAuth();
  const { theme, isDark } = useTheme();

  if (loading) {
    return <LoadingSpinner />;
  }

  const getContent = () => {
    if (!user) return <AuthStack />;
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
