import React from 'react';
import { View, ActivityIndicator } from 'react-native';
import { useTheme } from '../../context/ThemeContext';

interface LoadingSpinnerProps {
  size?: 'small' | 'large';
  fullScreen?: boolean;
}

export function LoadingSpinner({ size = 'large', fullScreen = true }: LoadingSpinnerProps) {
  const { theme, isDark } = useTheme();
  const spinnerColor = isDark ? '#ffffff' : theme.colors.foreground;

  if (!fullScreen) {
    return <ActivityIndicator size={size} color={spinnerColor} />;
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
      <ActivityIndicator size={size} color={spinnerColor} />
    </View>
  );
}
