import React, { useState, useMemo } from 'react';
import { View, Text, FlatList, Pressable, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useQueries } from '@tanstack/react-query';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { useReviewsForUser, useAvgRatings } from '../../hooks/useReviews';
import { getMatchById } from '../../services/matchService';
import { MatchPosterCard } from '../../components/match/MatchPosterCard';
import { MatchFilters, MatchFilterState, applyMatchFilters } from '../../components/match/MatchFilters';
import { Select } from '../../components/ui/Select';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { Match } from '../../types/match';
import { Review } from '../../types/review';

type SortKey = 'recent_tagged' | 'recent_played' | 'rating_high' | 'rating_low' | 'avg_rating_high' | 'avg_rating_low' | 'popular';

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: 'recent_tagged', label: 'Recently Tagged' },
  { value: 'recent_played', label: 'Recently Played' },
  { value: 'rating_high', label: 'Your Rating (High)' },
  { value: 'rating_low', label: 'Your Rating (Low)' },
  { value: 'avg_rating_high', label: 'Avg Rating (High)' },
  { value: 'avg_rating_low', label: 'Avg Rating (Low)' },
  { value: 'popular', label: 'Most Reviewed' },
];

interface TagMatchEntry {
  matchId: number;
  match: Match;
  userRating: number;
  avgPublicRating: number;
  reviewCount: number;
  latestTaggedDate: Date;
}

export function TagMatchesScreen({ route, navigation }: any) {
  const { tag } = route.params as { tag: string };
  const { theme, isDark } = useTheme();
  const { colors, spacing, typography } = theme;
  const { user } = useAuth();
  const { width: screenWidth } = useWindowDimensions();
  const { data: reviews, isLoading } = useReviewsForUser(user?.uid || '');

  // Get unique match IDs that have this tag
  const matchIds = useMemo(() => {
    if (!reviews) return [];
    const ids = new Set<number>();
    for (const r of reviews) {
      if (r.tags.includes(tag)) {
        ids.add(r.matchId);
      }
    }
    return Array.from(ids);
  }, [reviews, tag]);

  const { data: avgRatingsMap } = useAvgRatings(matchIds);

  const [sort, setSort] = useState<SortKey>('recent_tagged');
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

  const allMatches = useMemo(() => Array.from(matchMap.values()), [matchMap]);

  // Build entries: one per match, with aggregated review data for this tag
  const entries: TagMatchEntry[] = useMemo(() => {
    if (!reviews) return [];
    const grouped = new Map<number, { reviews: Review[]; match: Match }>();

    for (const r of reviews) {
      if (!r.tags.includes(tag)) continue;
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
        latestTaggedDate: latest.createdAt,
      };
    });
  }, [reviews, matchMap, avgRatingsMap, tag]);

  const filtered = useMemo(() => {
    const filteredMatches = applyMatchFilters(allMatches, filters);
    const filteredIds = new Set(filteredMatches.map((m) => m.id));

    let result = entries.filter((e) => filteredIds.has(e.matchId));

    switch (sort) {
      case 'recent_tagged':
        result.sort((a, b) => b.latestTaggedDate.getTime() - a.latestTaggedDate.getTime());
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

  const loading = isLoading || matchQueries.some((q) => q.isLoading);
  if (loading && entries.length === 0) return <LoadingSpinner />;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border }}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={8}>
          <Ionicons name="arrow-back" size={22} color={colors.foreground} />
        </Pressable>
        <Text style={{ ...typography.bodyBold, color: colors.foreground, flex: 1, textAlign: 'center', fontSize: 17 }}>
          {tag}
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
          {filtered.length} {filtered.length === 1 ? 'match' : 'matches'}
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
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl }}>
          <Ionicons name="pricetag-outline" size={48} color={colors.textSecondary} />
          <Text style={{ ...typography.h4, color: colors.foreground, marginTop: spacing.md }}>
            No matches found
          </Text>
          <Text style={{ ...typography.body, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.xs }}>
            Try adjusting your filters
          </Text>
        </View>
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
              onPress={() => navigation.navigate('MatchDetail', { matchId: item.matchId })}
              width={CARD_WIDTH}
            />
          )}
        />
      )}
    </SafeAreaView>
  );
}
