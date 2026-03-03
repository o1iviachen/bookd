import React, { useState, useMemo, useCallback } from 'react';
import { View, Text, FlatList, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQueries } from '@tanstack/react-query';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { useReviewsForUser, useAvgRatings } from '../../hooks/useReviews';
import { useUserProfile } from '../../hooks/useUser';
import { getMatchById } from '../../services/matchService';
import { MatchPosterCard } from '../../components/match/MatchPosterCard';
import { MatchFilters, MatchFilterState, applyMatchFilters } from '../../components/match/MatchFilters';
import { Select } from '../../components/ui/Select';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { ScreenHeader } from '../../components/ui/ScreenHeader';
import { EmptyState } from '../../components/ui/EmptyState';
import { Review } from '../../types/review';
import { Match } from '../../types/match';

type SortKey = 'recent_logged' | 'recent_played' | 'rating_high' | 'rating_low' | 'avg_rating_high' | 'avg_rating_low' | 'popular';

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: 'recent_logged', label: 'Recently Logged' },
  { value: 'recent_played', label: 'Recently Played' },
  { value: 'rating_high', label: 'Your Rating (High)' },
  { value: 'rating_low', label: 'Your Rating (Low)' },
  { value: 'avg_rating_high', label: 'Average Rating (High)' },
  { value: 'avg_rating_low', label: 'Average Rating (Low)' },
  { value: 'popular', label: 'Most Reviewed' },
];

interface MatchEntry {
  matchId: number;
  match: Match;
  userRating: number;
  avgPublicRating: number;
  reviewCount: number;
  latestReviewDate: Date;
  reviewId: string;
  totalReviews: number;
}

export function GamesScreen({ route, navigation }: any) {
  const { theme, isDark } = useTheme();
  const { colors, spacing, typography } = theme;
  const { user } = useAuth();
  const targetUserId = route.params?.userId || user?.uid || '';
  const { width: screenWidth } = useWindowDimensions();
  const { data: targetProfile } = useUserProfile(targetUserId);
  const { data: reviews, isLoading } = useReviewsForUser(targetUserId);

  // Unique match IDs from reviews (declared early for useAvgRatings)
  const matchIds = useMemo(
    () => [...new Set((reviews || []).map((r) => r.matchId))],
    [reviews]
  );
  const { data: avgRatingsMap } = useAvgRatings(matchIds);

  const [sort, setSort] = useState<SortKey>('recent_logged');
  const [filters, setFilters] = useState<MatchFilterState>({ league: 'all', team: 'all', season: 'all' });

  const GAP = spacing.sm;
  const HORIZONTAL_PADDING = spacing.md;
  const NUM_COLUMNS = 3;
  const CARD_WIDTH = (screenWidth - HORIZONTAL_PADDING * 2 - GAP * (NUM_COLUMNS - 1)) / NUM_COLUMNS;

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

  // All matches as flat array (for MatchFilters to derive filter options)
  const allMatches = useMemo(
    () => Array.from(matchMap.values()),
    [matchMap]
  );

  // Build grouped entries: one per match, with aggregated review data
  const entries: MatchEntry[] = useMemo(() => {
    if (!reviews) return [];
    const grouped = new Map<number, { reviews: Review[]; match: Match }>();

    for (const r of reviews) {
      const match = matchMap.get(r.matchId);
      if (!match) continue;
      if (!grouped.has(r.matchId)) {
        grouped.set(r.matchId, { reviews: [], match });
      }
      grouped.get(r.matchId)!.reviews.push(r);
    }

    return Array.from(grouped.values()).map(({ reviews: rs, match }) => {
      const latest = rs.reduce((a, b) => (a.createdAt > b.createdAt ? a : b));
      const avgUserRating = rs.reduce((sum, r) => sum + r.rating, 0) / rs.length;
      return {
        matchId: match.id,
        match,
        userRating: avgUserRating,
        avgPublicRating: avgRatingsMap?.get(match.id) || 0,
        reviewCount: rs.length,
        latestReviewDate: latest.createdAt,
        reviewId: rs.length === 1 ? rs[0].id : '',
        totalReviews: rs.length,
      };
    });
  }, [reviews, matchMap, avgRatingsMap]);

  // Apply shared MatchFilters + sort
  const filtered = useMemo(() => {
    // Use the shared applyMatchFilters on the match objects first
    const filteredMatches = applyMatchFilters(allMatches, filters);
    const filteredIds = new Set(filteredMatches.map((m) => m.id));

    let result = entries.filter((e) => filteredIds.has(e.matchId));

    // Sort
    switch (sort) {
      case 'recent_logged':
        result.sort((a, b) => b.latestReviewDate.getTime() - a.latestReviewDate.getTime());
        break;
      case 'recent_played':
        result.sort((a, b) => new Date(b.match.kickoff).getTime() - new Date(a.match.kickoff).getTime());
        break;
      case 'rating_high':
        result.sort((a, b) => b.userRating - a.userRating);
        break;
      case 'rating_low':
        result.sort((a, b) => a.userRating - b.userRating);
        break;
      case 'avg_rating_high':
        result.sort((a, b) => b.avgPublicRating - a.avgPublicRating);
        break;
      case 'avg_rating_low':
        result.sort((a, b) => a.avgPublicRating - b.avgPublicRating);
        break;
      case 'popular':
        result.sort((a, b) => b.reviewCount - a.reviewCount);
        break;
    }

    return result;
  }, [entries, allMatches, filters, sort]);

  const handleMatchPress = useCallback((entry: MatchEntry) => {
    navigation.navigate('MatchDetail', { matchId: entry.matchId });
  }, [navigation]);

  if (isLoading) return <LoadingSpinner />;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      <ScreenHeader title="Games" onBack={() => navigation.goBack()} />

      {/* Filters — same component as browse screens */}
      <MatchFilters
        filters={filters}
        onFiltersChange={setFilters}
        matches={allMatches}
        showMinLogs={false}
      />

      {/* Sort + count row */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, paddingVertical: spacing.sm }}>
        <Text style={{ ...typography.caption, color: colors.textSecondary }}>
          {filtered.length} {filtered.length === 1 ? 'game' : 'games'}
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

      {/* Grid */}
      {filtered.length === 0 ? (
        <EmptyState
          icon="football-outline"
          title={entries.length === 0 ? 'No games logged yet' : 'No matches found'}
          subtitle={entries.length === 0 ? 'Start reviewing matches to build your collection' : 'Try adjusting your filters'}
        />
      ) : (
        <FlatList indicatorStyle={isDark ? 'white' : 'default'}
          data={filtered}
          keyExtractor={(item) => String(item.matchId)}
          numColumns={NUM_COLUMNS}
          contentContainerStyle={{ padding: HORIZONTAL_PADDING, gap: GAP }}
          columnWrapperStyle={{ gap: GAP }}
          renderItem={({ item }) => (
            <MatchPosterCard
              match={item.match}
              onPress={() => handleMatchPress(item)}
              width={CARD_WIDTH}
            />
          )}
        />
      )}
    </SafeAreaView>
  );
}
