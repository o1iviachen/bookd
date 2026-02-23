import React, { useState, useMemo } from 'react';
import { View, Text, FlatList, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useQueries } from '@tanstack/react-query';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { useReviewsForUser, useAvgRatings } from '../../hooks/useReviews';
import { getMatchById } from '../../services/matchService';
import { TeamLogo } from '../../components/match/TeamLogo';
import { ReviewCard } from '../../components/review/ReviewCard';
import { MatchFilters, MatchFilterState, applyMatchFilters } from '../../components/match/MatchFilters';
import { Select } from '../../components/ui/Select';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { Review } from '../../types/review';
import { Match } from '../../types/match';

type SortKey = 'recent_reviewed' | 'recent_played' | 'rating_high' | 'rating_low' | 'avg_rating_high' | 'avg_rating_low' | 'popular_review' | 'popular_match';

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: 'recent_reviewed', label: 'Recently Reviewed' },
  { value: 'recent_played', label: 'Recently Played' },
  { value: 'rating_high', label: 'Your Rating (High)' },
  { value: 'rating_low', label: 'Your Rating (Low)' },
  { value: 'avg_rating_high', label: 'Avg Rating (High)' },
  { value: 'avg_rating_low', label: 'Avg Rating (Low)' },
  { value: 'popular_review', label: 'Most Liked Reviews' },
  { value: 'popular_match', label: 'Most Reviewed Matches' },
];

interface ReviewEntry {
  review: Review;
  match: Match | null;
  avgPublicRating: number;
  matchReviewCount: number;
}

export function ReviewsScreen({ navigation }: any) {
  const { theme } = useTheme();
  const { colors, spacing, typography, borderRadius } = theme;
  const { user } = useAuth();
  const { data: reviews, isLoading } = useReviewsForUser(user?.uid || '');

  const matchIds = useMemo(
    () => [...new Set((reviews || []).map((r) => r.matchId))],
    [reviews]
  );
  const { data: avgRatingsMap } = useAvgRatings(matchIds);

  const [sort, setSort] = useState<SortKey>('recent_reviewed');
  const [filters, setFilters] = useState<MatchFilterState>({ league: 'all', team: 'all', season: 'all' });

  // Fetch match data
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

  const allMatches = useMemo(() => Array.from(matchMap.values()), [matchMap]);

  // Count reviews per match for "popular match" sort
  const matchReviewCounts = useMemo(() => {
    const counts = new Map<number, number>();
    for (const r of reviews || []) {
      counts.set(r.matchId, (counts.get(r.matchId) || 0) + 1);
    }
    return counts;
  }, [reviews]);

  const entries: ReviewEntry[] = useMemo(() => {
    if (!reviews) return [];
    return reviews.map((r) => ({
      review: r,
      match: matchMap.get(r.matchId) || null,
      avgPublicRating: avgRatingsMap?.get(r.matchId) || 0,
      matchReviewCount: matchReviewCounts.get(r.matchId) || 0,
    }));
  }, [reviews, matchMap, avgRatingsMap, matchReviewCounts]);

  const filtered = useMemo(() => {
    const filteredMatches = applyMatchFilters(allMatches, filters);
    const filteredIds = new Set(filteredMatches.map((m) => m.id));

    let result = entries.filter((e) => e.match && filteredIds.has(e.review.matchId));

    switch (sort) {
      case 'recent_reviewed':
        result.sort((a, b) => new Date(b.review.createdAt).getTime() - new Date(a.review.createdAt).getTime());
        break;
      case 'recent_played':
        result.sort((a, b) => {
          const aKick = a.match ? new Date(a.match.kickoff).getTime() : 0;
          const bKick = b.match ? new Date(b.match.kickoff).getTime() : 0;
          return bKick - aKick;
        });
        break;
      case 'rating_high':
        result.sort((a, b) => b.review.rating - a.review.rating);
        break;
      case 'rating_low':
        result.sort((a, b) => a.review.rating - b.review.rating);
        break;
      case 'avg_rating_high':
        result.sort((a, b) => b.avgPublicRating - a.avgPublicRating);
        break;
      case 'avg_rating_low':
        result.sort((a, b) => a.avgPublicRating - b.avgPublicRating);
        break;
      case 'popular_review':
        result.sort((a, b) => ((b.review.upvotes || 0) - (b.review.downvotes || 0)) - ((a.review.upvotes || 0) - (a.review.downvotes || 0)));
        break;
      case 'popular_match':
        result.sort((a, b) => b.matchReviewCount - a.matchReviewCount);
        break;
    }

    return result;
  }, [entries, allMatches, filters, sort]);

  const loadingAll = isLoading || matchQueries.some((q) => q.isLoading);
  if (loadingAll && entries.length === 0) return <LoadingSpinner />;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border }}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={8}>
          <Ionicons name="arrow-back" size={22} color={colors.foreground} />
        </Pressable>
        <Text style={{ ...typography.bodyBold, color: colors.foreground, flex: 1, textAlign: 'center', fontSize: 17 }}>
          Reviews
        </Text>
        <View style={{ width: 22 }} />
      </View>

      {/* Filters */}
      <MatchFilters
        filters={filters}
        onFiltersChange={setFilters}
        minLogs={0}
        onMinLogsChange={() => {}}
        matches={allMatches}
        showMinLogs={false}
      />

      {/* Sort + count row */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, paddingVertical: spacing.sm }}>
        <Text style={{ ...typography.caption, color: colors.textSecondary }}>
          {filtered.length} {filtered.length === 1 ? 'review' : 'reviews'}
        </Text>
        <View style={{ width: 160 }}>
          <Select
            value={sort}
            onValueChange={(v) => setSort(v as SortKey)}
            title="Sort By"
            options={SORT_OPTIONS}
          />
        </View>
      </View>

      {filtered.length === 0 ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl }}>
          <Ionicons name="chatbubble-outline" size={48} color={colors.textSecondary} />
          <Text style={{ ...typography.h4, color: colors.foreground, marginTop: spacing.md }}>
            {(reviews || []).length === 0 ? 'No reviews yet' : 'No reviews found'}
          </Text>
          <Text style={{ ...typography.body, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.xs }}>
            {(reviews || []).length === 0 ? 'Start reviewing matches to see them here' : 'Try adjusting your filters'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.review.id}
          contentContainerStyle={{ paddingHorizontal: spacing.md, paddingBottom: 60 }}
          renderItem={({ item }) => (
            <View>
              {/* Match info line */}
              {item.match && (
                <Pressable
                  onPress={() => navigation.navigate('MatchDetail', { matchId: item.review.matchId })}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'flex-start',
                    gap: spacing.sm,
                    paddingTop: spacing.md,
                    paddingBottom: spacing.xs,
                  }}
                >
                  <TeamLogo uri={item.match.homeTeam.crest} size={16} />
                  <Text style={{ ...typography.caption, color: colors.foreground, fontWeight: '600' }}>
                    {item.match.homeTeam.shortName}
                  </Text>
                  <Text style={{ ...typography.caption, color: colors.textSecondary, fontWeight: '500' }}>
                    {item.match.homeScore != null ? `${item.match.homeScore} - ${item.match.awayScore}` : 'vs'}
                  </Text>
                  <Text style={{ ...typography.caption, color: colors.foreground, fontWeight: '600' }}>
                    {item.match.awayTeam.shortName}
                  </Text>
                  <TeamLogo uri={item.match.awayTeam.crest} size={16} />
                  <Text style={{ ...typography.small, color: colors.textSecondary }}>
                    · {item.match.competition.name}
                  </Text>
                </Pressable>
              )}
              <ReviewCard
                review={item.review}
                onPress={() => navigation.navigate('ReviewDetail', { reviewId: item.review.id })}
              />
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}
