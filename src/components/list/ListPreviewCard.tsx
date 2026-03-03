import React from 'react';
import { View, Text, Pressable, Share } from 'react-native';
import { useQueries } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { getMatchById } from '../../services/matchService';
import { useListComments, useListLikedBy } from '../../hooks/useLists';
import { useUserProfile } from '../../hooks/useUser';
import { MatchPosterCard } from '../match/MatchPosterCard';
import { TeamLogo } from '../match/TeamLogo';
import { MatchList } from '../../types/list';
import { Match } from '../../types/match';
import { POPULAR_TEAMS } from '../../utils/constants';

const PREVIEW_COUNT = 5;
const POSTER_WIDTH = 70;
const POSTER_GAP = 6;

interface ListPreviewCardProps {
  list: MatchList;
  onPress?: () => void;
  onMatchPress?: (matchId: number) => void;
}

export function ListPreviewCard({ list, onPress, onMatchPress }: ListPreviewCardProps) {
  const { theme } = useTheme();
  const { colors, spacing, typography } = theme;
  const { user } = useAuth();
  const { data: comments } = useListComments(list.id);
  const { data: likedBy } = useListLikedBy(list.id);
  const { data: authorProfile } = useUserProfile(list.userId);
  const commentCount = comments?.length ?? 0;
  const isLiked = !!(user && likedBy?.includes(user.uid));
  const displayName = authorProfile?.displayName || authorProfile?.username || list.username;
  const displayUsername = authorProfile?.username || list.username;
  const authorTeamCrests = (authorProfile?.favoriteTeams || []).slice(0, 3).map((id) => {
    const team = POPULAR_TEAMS.find((t) => t.id === String(id));
    return team ? { id: team.id, crest: team.crest } : null;
  }).filter(Boolean) as { id: string; crest: string }[];

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

  const handleShare = () => {
    const count = list.matchIds.length;
    Share.share({ message: `"${list.name}", a list of ${count} ${count === 1 ? 'match' : 'matches'} by @${displayUsername} on bookd:\nbookd://list/${list.id}` });
  };

  return (
    <View style={{
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    }}>
      {/* Text info — taps open the list */}
      <Pressable
        onPress={onPress}
        style={({ pressed }) => ({ opacity: pressed && onPress ? 0.7 : 1 })}
      >
        <Text style={{ ...typography.bodyBold, color: colors.foreground, fontSize: 16 }} numberOfLines={1}>
          {list.name}
        </Text>
        {list.description ? (
          <Text style={{ ...typography.body, color: colors.textSecondary, marginTop: 2 }} numberOfLines={1}>
            {list.description}
          </Text>
        ) : null}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}>
          <Text style={{ ...typography.small, color: colors.foreground, fontWeight: '600' }} numberOfLines={1}>
            {displayName}
          </Text>
          <Text style={{ ...typography.small, color: colors.textSecondary }} numberOfLines={1}>
            @{displayUsername}
          </Text>
          {authorTeamCrests.map((t) => (
            <TeamLogo key={t.id} uri={t.crest} size={14} />
          ))}
          <Text style={{ ...typography.small, color: colors.textSecondary }}>
            · {list.matchIds.length} {list.matchIds.length === 1 ? 'match' : 'matches'}
          </Text>
        </View>
      </Pressable>

      {/* Poster row — each poster taps to that match */}
      {previewMatches.length > 0 && (
        <View style={{ flexDirection: 'row', gap: POSTER_GAP, marginTop: spacing.sm }}>
          {previewMatches.map((match) => (
            <MatchPosterCard
              key={match.id}
              match={match}
              width={POSTER_WIDTH}
              compact
              onPress={onMatchPress ? () => onMatchPress(match.id) : undefined}
            />
          ))}
        </View>
      )}

      {/* Likes & comments */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.sm }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Ionicons
            name={isLiked ? 'heart' : 'heart-outline'}
            size={14}
            color={isLiked ? '#ef4444' : colors.textSecondary}
          />
          {list.likes > 0 && (
            <Text style={{ fontSize: 12, color: isLiked ? '#ef4444' : colors.textSecondary }}>{list.likes}</Text>
          )}
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Ionicons name="chatbubble-outline" size={14} color={colors.textSecondary} />
          {commentCount > 0 && (
            <Text style={{ fontSize: 12, color: colors.textSecondary }}>{commentCount}</Text>
          )}
        </View>
        <Pressable onPress={handleShare} hitSlop={8}>
          <Ionicons name="share-social-outline" size={14} color={colors.textSecondary} />
        </Pressable>
      </View>
    </View>
  );
}
