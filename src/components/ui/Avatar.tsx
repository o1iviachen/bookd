import React, { useState } from 'react';
import { View, Text } from 'react-native';
import { Image } from 'expo-image';
import { useTheme } from '../../context/ThemeContext';

interface AvatarProps {
  uri: string | null;
  name?: string;
  size?: number;
}

export function Avatar({ uri, name, size = 40 }: AvatarProps) {
  const { theme } = useTheme();
  const [failed, setFailed] = useState(false);

  if (uri && !failed) {
    return (
      <Image
        source={{ uri }}
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: theme.colors.accent,
        }}
        contentFit="cover"
        onError={() => setFailed(true)}
      />
    );
  }

  const initials = name
    ? name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : '?';

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: theme.colors.primary,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text
        style={{
          color: '#ffffff',
          fontSize: size * 0.4,
          fontWeight: '600',
        }}
      >
        {initials}
      </Text>
    </View>
  );
}
