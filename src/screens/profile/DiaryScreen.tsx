import React, { useMemo } from 'react';
import { View, Text, SectionList, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useQueries } from '@tanstack/react-query';
import { format } from 'date-fns';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { useReviewsForUser } from '../../hooks/useReviews';
import { useUserProfile } from '../../hooks/useUser';
import { getMatchById } from '../../services/matchService';
import { TeamLogo } from '../../components/match/TeamLogo';
import { StarRating } from '../../components/ui/StarRating';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { Review } from '../../types/review';
import { Match } from '../../types/match';

export function DiaryScreen({ navigation }: any) {
  const { theme } = useTheme();
  const { colors, spacing, typography, borderRadius } = theme;
  const { user } = useAuth();
  const { data: reviews, isLoading } = useReviewsForUser(user?.uid || '');
  const { data: profile } = useUserProfile(user?.uid || '');

  // Fetch match data for all reviewed matches
  const matchIds = useMemo(
    () => [...new Set((reviews || []).map((r) => r.matchId))],
    [reviews]
  );

  const matchQueries = useQueries({
    queries: matchIds.map((id) => ({
      queryKey: ['match', id],
      queryFn: () => getMatchById(id),
      staleTime: 5 * 60 * 1000,
      enabled: matchIds.length > 0,
    })),
  });

  const matchMap = useMemo(() => {
    const map = new Map<number, Match>();
    matchQueries.forEach((q) => {
      if (q.data) map.set(q.data.id, q.data);
    });
    return map;
  }, [matchQueries]);

  // Group reviews by month
  const sections = useMemo(() => {
    if (!reviews) return [];

    const grouped = new Map<string, Review[]>();
    const sorted = [...reviews].sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
    );

    for (const review of sorted) {
      const key = format(review.createdAt, 'MMMM yyyy');
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push(review);
    }

    return Array.from(grouped.entries()).map(([title, data]) => ({
      title,
      data,
    }));
  }, [reviews]);

  if (isLoading) return <LoadingSpinner />;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      {/* Header */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.sm,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        }}
      >
        <Pressable onPress={() => navigation.goBack()} hitSlop={8}>
          <Ionicons name="arrow-back" size={22} color={colors.foreground} />
        </Pressable>
        <Text
          style={{
            ...typography.bodyBold,
            color: colors.foreground,
            flex: 1,
            textAlign: 'center',
            fontSize: 17,
          }}
        >
          Diary
        </Text>
        <View style={{ width: 22 }} />
      </View>

      {sections.length === 0 ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl }}>
          <Ionicons name="book-outline" size={48} color={colors.textSecondary} />
          <Text style={{ ...typography.h4, color: colors.foreground, marginTop: spacing.md }}>
            No entries yet
          </Text>
          <Text style={{ ...typography.body, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.xs }}>
            Start logging matches to build your diary
          </Text>
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingBottom: spacing.xxl }}
          renderSectionHeader={({ section }) => (
            <View
              style={{
                backgroundColor: colors.background,
                paddingHorizontal: spacing.md,
                paddingTop: spacing.lg,
                paddingBottom: spacing.xs,
              }}
            >
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: '700',
                  color: colors.textSecondary,
                  textTransform: 'uppercase',
                  letterSpacing: 1,
                }}
              >
                {section.title}
              </Text>
            </View>
          )}
          renderItem={({ item: review }) => {
            const match = matchMap.get(review.matchId);
            const isLiked = profile?.likedMatchIds?.includes(review.matchId) || false;
            return (
              <DiaryEntry
                review={review}
                match={match || null}
                isLiked={isLiked}
                colors={colors}
                spacing={spacing}
                typography={typography}
                borderRadius={borderRadius}
                onPress={() =>
                  navigation.navigate('ReviewDetail', { reviewId: review.id })
                }
                onMatchPress={() =>
                  match && navigation.navigate('MatchDetail', { matchId: match.id })
                }
              />
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

function DiaryEntry({
  review,
  match,
  isLiked,
  colors,
  spacing,
  typography,
  borderRadius,
  onPress,
  onMatchPress,
}: {
  review: Review;
  match: Match | null;
  isLiked: boolean;
  colors: any;
  spacing: any;
  typography: any;
  borderRadius: any;
  onPress: () => void;
  onMatchPress: () => void;
}) {
  const dayNum = format(review.createdAt, 'd');
  const dayName = format(review.createdAt, 'EEE');
  const isFinished = match?.status === 'FINISHED';
  const hasText = review.text.trim().length > 0;

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
          <Pressable onPress={onMatchPress}>
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
          </Pressable>
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
          <StarRating rating={review.rating} size={12} />
          {isLiked && (
            <Ionicons name="heart" size={12} color="#ef4444" />
          )}
          {hasText && (
            <Ionicons name="reorder-three" size={14} color={colors.textSecondary} />
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
