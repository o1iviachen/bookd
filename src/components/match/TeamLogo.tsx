import React from 'react';
import { Image } from 'expo-image';

interface TeamLogoProps {
  uri: string;
  size?: number;
}

export function TeamLogo({ uri, size = 32 }: TeamLogoProps) {
  return (
    <Image
      source={{ uri }}
      style={{ width: size, height: size }}
      contentFit="contain"
      transition={200}
    />
  );
}
