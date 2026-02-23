import React, { useState, useMemo } from 'react';
import { View, Text, FlatList, Pressable, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useQueries } from '@tanstack/react-query';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { useUserProfile } from '../../hooks/useUser';
import { useReviewsForUser, useAvgRatings } from '../../hooks/useReviews';
import { getMatchById } from '../../services/matchService';
import { MatchPosterCard } from '../../components/match/MatchPosterCard';
import { MatchFilters, MatchFilterState, applyMatchFilters } from '../../components/match/MatchFilters';
import { Select } from '../../components/ui/Select';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { Match } from '../../types/match';

type SortKey = 'recent_liked' | 'recent_played' | 'rating_high' | 'rating_low' | 'avg_rating_high' | 'avg_rating_low' | 'popular';

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: 'recent_liked', label: 'Recently Liked' },
  { value: 'recent_played', label: 'Recently Played' },
  { value: 'rating_high', label: 'Your Rating (High)' },
  { value: 'rating_low', label: 'Your Rating (Low)' },
  { value: 'avg_rating_high', label: 'Avg Rating (High)' },
  { value: 'avg_rating_low', label: 'Avg Rating (Low)' },
  { value: 'popular', label: 'Most Reviewed' },
];

interface LikedEntry {
  matchId: number;
  match: Match;
  userRating: number;
  avgPublicRating: number;
  reviewCount: number;
  likedIndex: number;
}

export function LikesScreen({ navigation }: any) {
  const { theme } = useTheme();
  const { colors, spacing, typography } = theme;
  const { user } = useAuth();
  const { width: screenWidth } = useWindowDimensions();
  const { data: profile, isLoading: profileLoading } = useUserProfile(user?.uid || '');
  const { data: reviews } = useReviewsForUser(user?.uid || '');

  const likedMatchIds = useMemo(() => profile?.likedMatchIds || [], [profile]);
  const { data: avgRatingsMap } = useAvgRatings(likedMatchIds);

  const [sort, setSort] = useState<SortKey>('recent_liked');
  const [filters, setFilters] = useState<MatchFilterState>({ league: 'all', team: 'all', season: 'all' });

  const GAP = spacing.sm;
  const HORIZONTAL_PADDING = spacing.md;
  const NUM_COLUMNS = 3;
  const CARD_WIDTH = (screenWidth - HORIZONTAL_PADDING * 2 - GAP * (NUM_COLUMNS - 1)) / NUM_COLUMNS;

  // Fetch match data
  const matchQueries = useQueries({
    queries: likedMatchIds.map((id) => ({
      queryKey: ['match', id],
      queryFn: () => getMatchById(id),
      staleTime: 5 * 60 * 1000,
      enabled: likedMatchIds.length > 0,
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

  // Build user rating map from reviews
  const userRatingMap = useMemo(() => {
    const map = new Map<number, { avgRating: number; count: number }>();
    if (!reviews) return map;
    const grouped = new Map<number, number[]>();
    for (const r of reviews) {
      const ratings = grouped.get(r.matchId) || [];
      ratings.push(r.rating);
      grouped.set(r.matchId, ratings);
    }
    grouped.forEach((ratings, matchId) => {
      map.set(matchId, {
        avgRating: ratings.reduce((a, b) => a + b, 0) / ratings.length,
        count: ratings.length,
      });
    });
    return map;
  }, [reviews]);

  const entries: LikedEntry[] = useMemo(() => {
    return likedMatchIds
      .map((id, index) => {
        const match = matchMap.get(id);
        if (!match) return null;
        const userInfo = userRatingMap.get(id);
        return {
          matchId: id,
          match,
          userRating: userInfo?.avgRating || 0,
          avgPublicRating: avgRatingsMap?.get(id) || 0,
          reviewCount: userInfo?.count || 0,
          likedIndex: index,
        };
      })
      .filter(Boolean) as LikedEntry[];
  }, [likedMatchIds, matchMap, avgRatingsMap, userRatingMap]);

  const filtered = useMemo(() => {
    const filteredMatches = applyMatchFilters(allMatches, filters);
    const filteredIds = new Set(filteredMatches.map((m) => m.id));
    let result = entries.filter((e) => filteredIds.has(e.matchId));

    switch (sort) {
      case 'recent_liked':
        result.sort((a, b) => b.likedIndex - a.likedIndex);
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

  const isLoading = profileLoading || matchQueries.some((q) => q.isLoading);
  if (isLoading && entries.length === 0) return <LoadingSpinner />;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border }}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={8}>
          <Ionicons name="arrow-back" size={22} color={colors.foreground} />
        </Pressable>
        <Text style={{ ...typography.bodyBold, color: colors.foreground, flex: 1, textAlign: 'center', fontSize: 17 }}>
          Likes
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
          <Ionicons name="heart-outline" size={48} color={colors.textSecondary} />
          <Text style={{ ...typography.h4, color: colors.foreground, marginTop: spacing.md }}>
            {likedMatchIds.length === 0 ? 'No liked matches yet' : 'No matches found'}
          </Text>
          <Text style={{ ...typography.body, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.xs }}>
            {likedMatchIds.length === 0 ? 'Like matches to build your collection' : 'Try adjusting your filters'}
          </Text>
        </View>
      ) : (
        <FlatList
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
