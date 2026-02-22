import React from 'react';
import { View } from 'react-native';
import { useTheme } from '../../context/ThemeContext';

interface DividerProps {
  marginVertical?: number;
}

export function Divider({ marginVertical = 0 }: DividerProps) {
  const { theme } = useTheme();

  return (
    <View
      style={{
        height: 1,
        backgroundColor: theme.colors.border,
        marginVertical,
      }}
    />
  );
}
