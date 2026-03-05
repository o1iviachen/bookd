import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { View, Text, FlatList, Pressable, useWindowDimensions, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQueries } from '@tanstack/react-query';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { useReviewsForUser } from '../../hooks/useReviews';
import { useRenameTag, useDeleteTag } from '../../hooks/useUser';
import { getMatchById } from '../../services/matchService';
import { ActionMenu } from '../../components/ui/ActionMenu';
import { MatchPosterCard } from '../../components/match/MatchPosterCard';
import { MatchFilters, MatchFilterState, applyMatchFilters } from '../../components/match/MatchFilters';
import { Select } from '../../components/ui/Select';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { ScreenHeader } from '../../components/ui/ScreenHeader';
import { EmptyState } from '../../components/ui/EmptyState';
import { Match } from '../../types/match';
import { Review } from '../../types/review';

const PAGE_SIZE = 30;

type SortKey = 'recent_tagged' | 'recent_played' | 'rating_high' | 'rating_low' | 'avg_rating_high' | 'avg_rating_low' | 'popular';

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: 'recent_tagged', label: 'Recently Tagged' },
  { value: 'recent_played', label: 'Recently Played' },
  { value: 'rating_high', label: 'Your Rating (High)' },
  { value: 'rating_low', label: 'Your Rating (Low)' },
  { value: 'avg_rating_high', label: 'Average Rating (High)' },
  { value: 'avg_rating_low', label: 'Average Rating (Low)' },
  { value: 'popular', label: 'Most Logged' },
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
  const { tag, userId } = route.params as { tag: string; userId?: string };
  const { theme, isDark } = useTheme();
  const { colors, spacing, typography } = theme;
  const { user } = useAuth();
  const targetUserId = userId || user?.uid || '';
  const { width: screenWidth } = useWindowDimensions();
  const { data: reviews, isLoading } = useReviewsForUser(targetUserId);
  const renameTag = useRenameTag();
  const deleteTag = useDeleteTag();
  const [showMenu, setShowMenu] = useState(false);
  const isOwnProfile = targetUserId === user?.uid;

  const handleRename = () => {
    setShowMenu(false);
    Alert.prompt('Rename Tag', `Rename "${tag}" to:`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Rename',
        onPress: (newName) => {
          const trimmed = newName?.trim();
          if (!trimmed || trimmed === tag || !user) return;
          renameTag.mutate(
            { userId: user.uid, oldTag: tag, newTag: trimmed },
            { onSuccess: () => navigation.goBack() }
          );
        },
      },
    ], 'plain-text', tag);
  };

  const handleDelete = () => {
    setShowMenu(false);
    Alert.alert('Delete Tag', `Remove "${tag}" from all your reviews?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          if (!user) return;
          deleteTag.mutate(
            { userId: user.uid, tag },
            { onSuccess: () => navigation.goBack() }
          );
        },
      },
    ]);
  };

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

  const [sort, setSort] = useState<SortKey>('recent_tagged');
  const [filters, setFilters] = useState<MatchFilterState>({ league: 'all', team: 'all', season: 'all' });
  const [displayedCount, setDisplayedCount] = useState(PAGE_SIZE);

  const GAP = spacing.md;
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
        avgPublicRating: match.avgRating || 0,
        reviewCount: rs.length,
        latestTaggedDate: latest.createdAt,
      };
    });
  }, [reviews, matchMap, tag]);

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
        result.sort((a, b) => (b.match.reviewCount || 0) - (a.match.reviewCount || 0));
        break;
    }

    return result;
  }, [entries, allMatches, filters, sort]);

  // Reset pagination when sort or filters change
  useEffect(() => {
    setDisplayedCount(PAGE_SIZE);
  }, [sort, filters]);

  const visibleEntries = useMemo(() => filtered.slice(0, displayedCount), [filtered, displayedCount]);

  const handleEndReached = useCallback(() => {
    setDisplayedCount(prev => Math.min(prev + PAGE_SIZE, filtered.length));
  }, [filtered.length]);

  const loading = isLoading || matchQueries.some((q) => q.isLoading);
  if (loading && entries.length === 0) return <LoadingSpinner />;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      <ScreenHeader
        title={tag}
        onBack={() => navigation.goBack()}
        rightElement={isOwnProfile ? (
          <Pressable onPress={() => setShowMenu(true)} hitSlop={8}>
            <Ionicons name="ellipsis-horizontal" size={22} color={colors.foreground} />
          </Pressable>
        ) : undefined}
      />

      {/* Filters */}
      <MatchFilters
        filters={filters}
        onFiltersChange={setFilters}
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
        <EmptyState
          icon="pricetag-outline"
          title="No matches found"
          subtitle="Try adjusting your filters"
        />
      ) : (
        <FlatList showsVerticalScrollIndicator={false} indicatorStyle={isDark ? 'white' : 'default'}
          data={visibleEntries}
          keyExtractor={(item) => String(item.matchId)}
          numColumns={NUM_COLUMNS}
          contentContainerStyle={{ padding: HORIZONTAL_PADDING, gap: GAP }}
          columnWrapperStyle={{ gap: GAP }}
          onEndReached={handleEndReached}
          onEndReachedThreshold={0.3}
          ListFooterComponent={visibleEntries.length < filtered.length ? (
            <ActivityIndicator style={{ paddingVertical: spacing.md }} color={colors.primary} />
          ) : null}
          renderItem={({ item }) => (
            <MatchPosterCard
              match={item.match}
              onPress={() => navigation.navigate('MatchDetail', { matchId: item.matchId })}
              width={CARD_WIDTH}
            />
          )}
        />
      )}
      <ActionMenu
        visible={showMenu}
        onClose={() => setShowMenu(false)}
        items={[
          { label: 'Rename', icon: 'pencil-outline', onPress: handleRename },
          { label: 'Delete', icon: 'trash-outline', onPress: handleDelete, destructive: true },
        ]}
      />
    </SafeAreaView>
  );
}
