import React from 'react';
import { View } from 'react-native';
import { Image } from 'expo-image';
import { useTheme } from '../../context/ThemeContext';

interface TeamLogoProps {
  uri: string;
  size?: number;
}

export function TeamLogo({ uri, size = 32 }: TeamLogoProps) {
  const { theme } = useTheme();

  return (
    <Image
      source={{ uri }}
      style={{
        width: size,
        height: size,
      }}
      contentFit="contain"
      placeholder={{ uri: undefined }}
      transition={200}
    />
  );
}
