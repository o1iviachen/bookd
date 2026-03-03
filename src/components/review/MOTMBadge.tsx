import React from 'react';
import { View, Text } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { usePersonDetail } from '../../hooks/usePeople';

interface MOTMBadgeProps {
  playerId: number;
  size?: 'sm' | 'md';
}

export function MOTMBadge({ playerId, size = 'sm' }: MOTMBadgeProps) {
  const { theme } = useTheme();
  const { colors, spacing, borderRadius } = theme;
  const { data: player } = usePersonDetail(playerId);

  if (!player) return null;

  const photoSize = size === 'md' ? 44 : 34;

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F59E0B18',
        borderRadius: borderRadius.md,
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.xs + 2,
        gap: spacing.sm,
        marginBottom: spacing.sm,
        borderWidth: 1,
        borderColor: '#F59E0B40',
      }}
    >
      <Ionicons name="trophy" size={13} color="#F59E0B" />
      {player.photo ? (
        <Image
          source={{ uri: player.photo }}
          style={{ width: photoSize, height: photoSize, borderRadius: photoSize / 2 }}
          contentFit="cover"
        />
      ) : (
        <View
          style={{
            width: photoSize,
            height: photoSize,
            borderRadius: photoSize / 2,
            backgroundColor: colors.muted,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ionicons name="person" size={photoSize * 0.5} color={colors.textSecondary} />
        </View>
      )}
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 9, fontWeight: '700', color: '#F59E0B', textTransform: 'uppercase', letterSpacing: 0.8 }}>
          Man of the Match
        </Text>
        <Text style={{ fontSize: size === 'md' ? 14 : 13, fontWeight: '600', color: colors.foreground }} numberOfLines={1}>
          {player.name}
        </Text>
      </View>
    </View>
  );
}
