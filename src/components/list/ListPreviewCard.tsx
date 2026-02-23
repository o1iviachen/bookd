import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { useQueries } from '@tanstack/react-query';
import { useTheme } from '../../context/ThemeContext';
import { getMatchById } from '../../services/matchService';
import { MatchPosterCard } from '../match/MatchPosterCard';
import { MatchList } from '../../types/list';
import { Match } from '../../types/match';

const PREVIEW_COUNT = 5;
const POSTER_WIDTH = 70;
const POSTER_OVERLAP = 20;

interface ListPreviewCardProps {
  list: MatchList;
  onPress?: () => void;
}

export function ListPreviewCard({ list, onPress }: ListPreviewCardProps) {
  const { theme } = useTheme();
  const { colors, spacing, typography } = theme;

  // Fetch first few matches for poster previews
  const previewIds = list.matchIds.slice(0, PREVIEW_COUNT);
  const matchQueries = useQueries({
    queries: previewIds.map((id) => ({
      queryKey: ['match', id],
      queryFn: () => getMatchById(id),
      staleTime: 5 * 60 * 1000,
      enabled: previewIds.length > 0,
    })),
  });

  const previewMatches: Match[] = matchQueries
    .map((q) => q.data)
    .filter((m): m is Match => m !== undefined);

  const stackWidth = previewMatches.length > 0
    ? POSTER_WIDTH + (previewMatches.length - 1) * (POSTER_WIDTH - POSTER_OVERLAP)
    : 0;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        paddingVertical: spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
        opacity: pressed && onPress ? 0.9 : 1,
      })}
    >
      {/* Text info */}
      <Text style={{ ...typography.bodyBold, color: colors.foreground, fontSize: 16 }} numberOfLines={1}>
        {list.name}
      </Text>
      {list.description ? (
        <Text style={{ ...typography.body, color: colors.textSecondary, marginTop: 2 }} numberOfLines={1}>
          {list.description}
        </Text>
      ) : null}
      <Text style={{ ...typography.small, color: colors.textSecondary, marginTop: 4 }}>
        {list.username} · {list.matchIds.length} {list.matchIds.length === 1 ? 'match' : 'matches'}
      </Text>

      {/* Overlapping poster stack (no text overlay) */}
      {previewMatches.length > 0 && (
        <View style={{ height: POSTER_WIDTH * 1.5, width: stackWidth, marginTop: spacing.sm }}>
          {previewMatches.map((match, index) => (
            <View
              key={match.id}
              style={{
                position: 'absolute',
                left: index * (POSTER_WIDTH - POSTER_OVERLAP),
                zIndex: PREVIEW_COUNT - index,
              }}
            >
              <MatchPosterCard
                match={match}
                width={POSTER_WIDTH}
                hideOverlay
              />
            </View>
          ))}
        </View>
      )}
    </Pressable>
  );
}
