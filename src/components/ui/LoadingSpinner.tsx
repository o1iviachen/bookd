import React from 'react';
import { View, ActivityIndicator } from 'react-native';
import { useTheme } from '../../context/ThemeContext';

interface LoadingSpinnerProps {
  size?: 'small' | 'large';
  fullScreen?: boolean;
}

export function LoadingSpinner({ size = 'large', fullScreen = true }: LoadingSpinnerProps) {
  const { theme } = useTheme();

  if (!fullScreen) {
    return <ActivityIndicator size={size} color={theme.colors.primary} />;
  }

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: theme.colors.background,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <ActivityIndicator size={size} color={theme.colors.primary} />
    </View>
  );
}
