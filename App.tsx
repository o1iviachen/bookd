import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as Notifications from 'expo-notifications';
import { ThemeProvider, useTheme } from './src/context/ThemeContext';
import { AuthProvider } from './src/context/AuthContext';
import { RootNavigator } from './src/navigation/RootNavigator';
import { navigationRef } from './src/navigation/navigationRef';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000,
      retry: 2,
    },
  },
});

function AppContent() {
  const { isDark } = useTheme();

  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as Record<string, any>;
      if (!navigationRef.isReady()) return;

      const { type, senderId, reviewId, listId } = data;

      if (type === 'follow' && senderId) {
        (navigationRef as any).navigate('ActivityTab', {
          screen: 'UserProfile',
          params: { userId: senderId },
        });
      } else if ((type === 'review_like' || type === 'comment' || type === 'comment_like') && reviewId) {
        (navigationRef as any).navigate('ActivityTab', {
          screen: 'ReviewDetail',
          params: { reviewId },
        });
      } else if ((type === 'list_like' || type === 'list_comment') && listId) {
        (navigationRef as any).navigate('ActivityTab', {
          screen: 'ListDetail',
          params: { listId },
        });
      } else {
        (navigationRef as any).navigate('ActivityTab', { screen: 'Activity' });
      }
    });

    return () => subscription.remove();
  }, []);

  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <RootNavigator />
    </>
  );
}

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: '#14181c' }}>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <AuthProvider>
            <AppContent />
          </AuthProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}
