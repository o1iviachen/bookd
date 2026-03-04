import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../../context/ThemeContext';
import { usePersonDetail } from '../../hooks/usePeople';
import { decodeHtmlEntities } from '../../utils/formatName';

const REFEREE_MOTM_ID = -1;

interface MOTMBadgeProps {
  playerId: number;
  playerName?: string;
  size?: 'sm' | 'md';
}

export function MOTMBadge({ playerId, playerName, size = 'sm' }: MOTMBadgeProps) {
  const { theme } = useTheme();
  const { colors, spacing, borderRadius } = theme;
  const isReferee = playerId === REFEREE_MOTM_ID;
  const navigation = useNavigation<any>();

  const photoSize = size === 'md' ? 32 : 26;

  // Referee: show name, not clickable, no Firestore lookup
  if (isReferee) {
    const displayName = decodeHtmlEntities(playerName || '') || 'Referee';
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
          <Ionicons name="flag" size={photoSize * 0.5} color={colors.textSecondary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 9, fontWeight: '700', color: '#F59E0B', textTransform: 'uppercase', letterSpacing: 0.8 }}>
            Man of the Match
          </Text>
          <Text style={{ fontSize: size === 'md' ? 14 : 13, fontWeight: '600', color: colors.foreground }} numberOfLines={1}>
            {displayName}
          </Text>
        </View>
      </View>
    );
  }

  // Regular player — use the PlayerBadge sub-component to keep hooks unconditional
  return <PlayerMOTMBadge playerId={playerId} playerName={playerName} size={size} />;
}

function PlayerMOTMBadge({ playerId, playerName, size = 'sm' }: { playerId: number; playerName?: string; size?: 'sm' | 'md' }) {
  const { theme } = useTheme();
  const { colors, spacing, borderRadius } = theme;
  const { data: player } = usePersonDetail(playerId);
  const navigation = useNavigation<any>();

  const photoSize = size === 'md' ? 32 : 26;
  const rawName = player?.name && player.name !== 'Unknown Player' ? player.name : playerName || 'Unknown';
  const displayName = decodeHtmlEntities(rawName);

  if (!player) return null;

  return (
    <Pressable
      onPress={() => navigation.navigate('PersonDetail', { personId: playerId, personName: displayName, role: 'player' })}
      style={({ pressed }) => ({
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
        opacity: pressed ? 0.7 : 1,
      })}
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
          {displayName}
        </Text>
      </View>
    </Pressable>
  );
}
