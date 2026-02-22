import React from 'react';
import { View, Text, FlatList, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { MatchPosterCard } from '../match/MatchPosterCard';
import { Match } from '../../types/match';

interface LeagueCarouselProps {
  title: string;
  matches: Match[];
  onMatchPress?: (matchId: number) => void;
}

export function LeagueCarousel({ title, matches, onMatchPress }: LeagueCarouselProps) {
  const { theme } = useTheme();
  const { colors, spacing, typography } = theme;

  if (matches.length === 0) return null;

  return (
    <View style={{ marginBottom: spacing.xs }}>
      {/* Section header with "More" link */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: spacing.md,
          marginBottom: spacing.sm,
        }}
      >
        <Text style={{ ...typography.h4, color: colors.foreground }}>
          {title}
        </Text>
        <Pressable style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
          <Text style={{ ...typography.caption, color: colors.primary }}>More</Text>
          <Ionicons name="chevron-forward" size={14} color={colors.primary} />
        </Pressable>
      </View>

      <FlatList
        horizontal
        data={matches}
        keyExtractor={(item) => item.id.toString()}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: spacing.md, gap: spacing.sm + 4 }}
        renderItem={({ item }) => (
          <MatchPosterCard match={item} onPress={() => onMatchPress?.(item.id)} />
        )}
      />
    </View>
  );
}
