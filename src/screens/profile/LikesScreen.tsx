import React, { useState, useMemo, useRef, useCallback } from 'react';
import { View, Text, FlatList, ScrollView, useWindowDimensions } from 'react-native';
import PagerView from 'react-native-pager-view';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQueries } from '@tanstack/react-query';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { useUserProfile } from '../../hooks/useUser';
import { useReviewsForUser, useAvgRatings, useLikedReviews } from '../../hooks/useReviews';
import { useLikedLists } from '../../hooks/useLists';
import { getMatchById } from '../../services/matchService';
import { MatchPosterCard } from '../../components/match/MatchPosterCard';
import { MatchFilters, MatchFilterState, applyMatchFilters } from '../../components/match/MatchFilters';
import { ReviewCard } from '../../components/review/ReviewCard';
import { ListPreviewCard } from '../../components/list/ListPreviewCard';
import { Select } from '../../components/ui/Select';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { ScreenHeader } from '../../components/ui/ScreenHeader';
import { SegmentedControl } from '../../components/ui/SegmentedControl';
import { EmptyState } from '../../components/ui/EmptyState';
import { Match } from '../../types/match';

const TABS = ['Matches', 'Reviews', 'Lists'] as const;
type Tab = (typeof TABS)[number];

type SortKey = 'recent_liked' | 'recent_played' | 'rating_high' | 'rating_low' | 'avg_rating_high' | 'avg_rating_low' | 'popular';

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: 'recent_liked', label: 'Recently Liked' },
  { value: 'recent_played', label: 'Recently Played' },
  { value: 'rating_high', label: 'Your Rating (High)' },
  { value: 'rating_low', label: 'Your Rating (Low)' },
  { value: 'avg_rating_high', label: 'Average Rating (High)' },
  { value: 'avg_rating_low', label: 'Average Rating (Low)' },
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

export function LikesScreen({ route, navigation }: any) {
  const { theme, isDark } = useTheme();
  const { colors, spacing, typography } = theme;
  const { user } = useAuth();
  const targetUserId = route.params?.userId || user?.uid || '';
  const { width: screenWidth } = useWindowDimensions();
  const { data: profile, isLoading: profileLoading } = useUserProfile(targetUserId);
  const { data: reviews } = useReviewsForUser(targetUserId);

  const [activeTabIndex, setActiveTabIndex] = useState(0);
  const pagerRef = useRef<PagerView>(null);
  const [sort, setSort] = useState<SortKey>('recent_liked');

  const handleTabPress = useCallback((index: number) => {
    setActiveTabIndex(index);
    pagerRef.current?.setPage(index);
  }, []);

  const handlePageScroll = useCallback((e: any) => {
    const { position, offset } = e.nativeEvent;
    setActiveTabIndex(Math.round(position + offset));
  }, []);
  const [filters, setFilters] = useState<MatchFilterState>({ league: 'all', team: 'all', season: 'all' });

  // ─── Matches tab data ───
  const likedMatchIds = useMemo(() => profile?.likedMatchIds || [], [profile]);
  const { data: avgRatingsMap } = useAvgRatings(likedMatchIds);

  const GAP = spacing.sm;
  const HORIZONTAL_PADDING = spacing.md;
  const NUM_COLUMNS = 3;
  const CARD_WIDTH = (screenWidth - HORIZONTAL_PADDING * 2 - GAP * (NUM_COLUMNS - 1)) / NUM_COLUMNS;

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

  // ─── Reviews tab data ───
  const { data: likedReviews, isLoading: likedReviewsLoading } = useLikedReviews(targetUserId);

  // ─── Lists tab data ───
  const { data: likedLists, isLoading: likedListsLoading } = useLikedLists(targetUserId);

  const isLoading = profileLoading || matchQueries.some((q) => q.isLoading);
  if (isLoading && entries.length === 0 && activeTabIndex === 0) return <LoadingSpinner />;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      <ScreenHeader title="Likes" onBack={() => navigation.goBack()} />

      {/* Segmented control */}
      <View style={{ paddingHorizontal: spacing.md, paddingTop: spacing.sm }}>
        <SegmentedControl tabs={TABS} activeTab={TABS[activeTabIndex]} onTabChange={(tab) => handleTabPress(TABS.indexOf(tab))} />
      </View>

      <PagerView
        ref={pagerRef}
        style={{ flex: 1 }}
        initialPage={0}
        onPageScroll={handlePageScroll}
      >
        {/* ─── Matches Page ─── */}
        <View key="matches" style={{ flex: 1 }}>
          <MatchFilters
            filters={filters}
            onFiltersChange={setFilters}
            minLogs={0}
            onMinLogsChange={() => {}}
            matches={allMatches}
            showMinLogs={false}
          />

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

          {filtered.length === 0 ? (
            <EmptyState
              icon="heart-outline"
              title={likedMatchIds.length === 0 ? 'No liked matches yet' : 'No matches found'}
              subtitle={likedMatchIds.length === 0 ? 'Like matches to build your collection' : 'Try adjusting your filters'}
            />
          ) : (
            <FlatList
              indicatorStyle={isDark ? 'white' : 'default'}
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
        </View>

        {/* ─── Reviews Page ─── */}
        <View key="reviews" style={{ flex: 1 }}>
          {likedReviewsLoading ? (
            <View style={{ flex: 1, justifyContent: 'center' }}><LoadingSpinner fullScreen={false} /></View>
          ) : !likedReviews || likedReviews.length === 0 ? (
            <EmptyState
              icon="heart-outline"
              title="No liked reviews yet"
              subtitle="Like reviews to save them here"
            />
          ) : (
            <ScrollView
              indicatorStyle={isDark ? 'white' : 'default'}
              nestedScrollEnabled
              contentContainerStyle={{ paddingBottom: spacing.xl }}
            >
              {likedReviews.map((review, i) => (
                <ReviewCard
                  key={review.id}
                  review={review}
                  onPress={() => navigation.navigate('ReviewDetail', { reviewId: review.id })}
                  isLast={i === likedReviews.length - 1}
                />
              ))}
            </ScrollView>
          )}
        </View>

        {/* ─── Lists Page ─── */}
        <View key="lists" style={{ flex: 1 }}>
          {likedListsLoading ? (
            <View style={{ flex: 1, justifyContent: 'center' }}><LoadingSpinner fullScreen={false} /></View>
          ) : !likedLists || likedLists.length === 0 ? (
            <EmptyState
              icon="heart-outline"
              title="No liked lists yet"
              subtitle="Like lists to save them here"
            />
          ) : (
            <ScrollView
              indicatorStyle={isDark ? 'white' : 'default'}
              nestedScrollEnabled
              contentContainerStyle={{ paddingBottom: spacing.xl }}
            >
              {likedLists.map((list) => (
                <ListPreviewCard
                  key={list.id}
                  list={list}
                  onPress={() => navigation.navigate('ListDetail', { listId: list.id })}
                  onMatchPress={(matchId) => navigation.navigate('MatchDetail', { matchId })}
                />
              ))}
            </ScrollView>
          )}
        </View>
      </PagerView>
    </SafeAreaView>
  );
}
