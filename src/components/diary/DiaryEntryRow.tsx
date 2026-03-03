import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { useTheme } from '../../context/ThemeContext';
import { TeamLogo } from '../match/TeamLogo';
import { StarRating } from '../ui/StarRating';
import { Review } from '../../types/review';
import { Match } from '../../types/match';

interface DiaryEntryRowProps {
  review: Review;
  match: Match | null;
  isLiked: boolean;
  onPress: () => void;
}

export function DiaryEntryRow({ review, match, isLiked, onPress }: DiaryEntryRowProps) {
  const { theme } = useTheme();
  const { colors, spacing, typography } = theme;

  const dayNum = format(review.createdAt, 'd');
  const dayName = format(review.createdAt, 'EEE');
  const isFinished = match?.status === 'FINISHED';
  const hasText = review.text.trim().length > 0;
  const hasMedia = review.media && review.media.length > 0;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: 'row',
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm + 2,
        backgroundColor: pressed ? colors.accent : 'transparent',
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
      })}
    >
      {/* Date column */}
      <View style={{ width: 40, alignItems: 'center', paddingTop: 2 }}>
        <Text style={{ fontSize: 20, fontWeight: '700', color: colors.foreground }}>
          {dayNum}
        </Text>
        <Text style={{ fontSize: 10, fontWeight: '600', color: colors.textSecondary, textTransform: 'uppercase' }}>
          {dayName}
        </Text>
      </View>

      {/* Match info */}
      <View style={{ flex: 1, marginLeft: spacing.sm }}>
        {match ? (
          <View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <TeamLogo uri={match.homeTeam.crest} size={18} />
              <Text
                style={{
                  ...typography.bodyBold,
                  color: colors.foreground,
                  fontSize: 14,
                }}
                numberOfLines={1}
              >
                {match.homeTeam.shortName}{' '}
                {isFinished
                  ? `${match.homeScore} - ${match.awayScore}`
                  : 'vs'}{' '}
                {match.awayTeam.shortName}
              </Text>
              <TeamLogo uri={match.awayTeam.crest} size={18} />
            </View>
            <Text
              style={{ ...typography.small, color: colors.textSecondary, marginTop: 2 }}
              numberOfLines={1}
            >
              {match.competition.name}
              {match.venue ? ` · ${match.venue}` : ''}
            </Text>
          </View>
        ) : (
          <Text
            style={{ ...typography.bodyBold, color: colors.foreground, fontSize: 14 }}
            numberOfLines={1}
          >
            {review.matchLabel || `Match #${review.matchId}`}
          </Text>
        )}

        {/* Rating + like + review indicators */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
          {review.rating > 0 && <StarRating rating={review.rating} size={12} />}
          {isLiked && (
            <Ionicons name="heart" size={12} color="#ef4444" />
          )}
          {hasText && (
            <Ionicons name="reorder-three-outline" size={14} color={colors.textSecondary} />
          )}
          {hasMedia && (
            <Ionicons name="image-outline" size={12} color={colors.textSecondary} />
          )}
        </View>
      </View>

      <Ionicons
        name="chevron-forward"
        size={16}
        color={colors.textSecondary}
        style={{ alignSelf: 'center', marginLeft: spacing.xs }}
      />
    </Pressable>
  );
}
