import React, { useState, useMemo, useRef, useCallback } from 'react';
import { View, Text, ScrollView, Pressable, RefreshControl, FlatList, ActivityIndicator } from 'react-native';
import PagerView from 'react-native-pager-view';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { subDays } from 'date-fns';
import { useQueries, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { useUserProfile, useBlockedUsers } from '../../hooks/useUser';
import { useMatchesRange } from '../../hooks/useMatches';
import { useRecentReviewsPaginated, usePopularMatchIdsThisWeek } from '../../hooks/useReviews';
import { usePopularListsPaginated } from '../../hooks/useLists';
import { ListPreviewCard } from '../../components/list/ListPreviewCard';
import { groupMatchesByCompetition, getMatchById } from '../../services/matchService';
import { MatchPosterCard } from '../../components/match/MatchPosterCard';
import { TeamLogo } from '../../components/match/TeamLogo';
import { LeagueCarousel } from '../../components/feed/LeagueCarousel';
import { ReviewCard } from '../../components/review/ReviewCard';
import { Avatar } from '../../components/ui/Avatar';
import { StarRating } from '../../components/ui/StarRating';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { FeedStackParamList } from '../../types/navigation';
import { Match } from '../../types/match';

type Nav = NativeStackNavigationProp<FeedStackParamList, 'Feed'>;
const TABS = ['Matches', 'Reviews', 'Lists'] as const;
const TAB_INDICES = { Matches: 0, Reviews: 1, Lists: 2 } as const;

import { Review } from '../../types/review';

/** Separate component so useUserProfile hook fires per-item and triggers re-render when profile loads */
function FriendReviewCard({ item, match, onPress, colors, spacing, viewerLikedMatchIds }: {
  item: Review;
  match: Match | undefined;
  onPress: () => void;
  colors: any;
  spacing: any;
  viewerLikedMatchIds?: number[];
}) {
  const { data: authorProfile } = useUserProfile(item.userId);
  const isLiked = viewerLikedMatchIds?.some((id) => Number(id) === Number(item.matchId)) || false;
  const hasText = item.text?.trim().length > 0;
  const hasMedia = item.media && item.media.length > 0;

  if (match) {
    return (
      <View>
        <MatchPosterCard match={match} onPress={onPress} />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 5 }}>
          <Avatar uri={item.userAvatar} name={item.username} size={18} />
          {item.rating > 0 && <StarRating rating={item.rating} size={9} />}
          {isLiked && <Ionicons name="heart" size={9} color="#ef4444" />}
          {hasText && <Ionicons name="reorder-three-outline" size={10} color={colors.textSecondary} />}
          {hasMedia && <Ionicons name="image-outline" size={9} color={colors.textSecondary} />}
        </View>
      </View>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      style={{
        width: 120, height: 180, backgroundColor: colors.card,
        borderRadius: 4, borderWidth: 1, borderColor: colors.border,
        justifyContent: 'flex-end', padding: 6,
      }}
    >
      <Text style={{ fontSize: 9, fontWeight: '600', color: colors.foreground }} numberOfLines={2}>
        {item.matchLabel || `Match #${item.matchId}`}
      </Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 2 }}>
        <Avatar uri={item.userAvatar} name={item.username} size={14} />
        {item.rating > 0 && <StarRating rating={item.rating} size={8} />}
        {isLiked && <Ionicons name="heart" size={8} color="#ef4444" style={{ marginLeft: 1 }} />}
        {hasText && <Ionicons name="reorder-three-outline" size={10} color={colors.textSecondary} style={{ marginLeft: 1 }} />}
        {hasMedia && <Ionicons name="image-outline" size={8} color={colors.textSecondary} style={{ marginLeft: 1 }} />}
      </View>
    </Pressable>
  );
}

export function FeedScreen() {
  const { t } = useTranslation();
  const { theme, isDark } = useTheme();
  const { colors, spacing, typography, borderRadius } = theme;
  const navigation = useNavigation<Nav>();
  const { user } = useAuth();
  const { data: profile } = useUserProfile(user?.uid || '');
  const blockedUsers = useBlockedUsers(user?.uid);
  const [activeTabIndex, setActiveTabIndex] = useState(0);
  const activeTab = TABS[activeTabIndex];
  const pagerRef = useRef<PagerView>(null);
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);

  const handleTabPress = useCallback((index: number) => {
    setActiveTabIndex(index);
    pagerRef.current?.setPage(index);
  }, []);

  const handlePageSelected = useCallback((e: any) => {
    setActiveTabIndex(e.nativeEvent.position);
  }, []);

  const today = useMemo(() => new Date(), []);
  const weekAgo = useMemo(() => subDays(today, 7), [today]);
  const { data: matches, isLoading: matchesLoading } = useMatchesRange(weekAgo, today);
  const {
    data: reviewPages,
    isLoading: reviewsLoading,
    fetchNextPage: fetchNextReviewPage,
    hasNextPage: hasNextReviewPage,
    isFetchingNextPage: isFetchingNextReviewPage,
  } = useRecentReviewsPaginated(blockedUsers);
  const {
    data: listPages,
    isLoading: listsLoading,
    fetchNextPage: fetchNextListPage,
    hasNextPage: hasNextListPage,
    isFetchingNextPage: isFetchingNextListPage,
  } = usePopularListsPaginated();
  const { data: popularMatchIds } = usePopularMatchIdsThisWeek();

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['matches', 'range'] }),
      queryClient.invalidateQueries({ queryKey: ['reviews', 'recent', 'paginated'] }),
      queryClient.invalidateQueries({ queryKey: ['reviews', 'popularThisWeek'] }),
      queryClient.invalidateQueries({ queryKey: ['lists', 'popular', 'paginated'] }),
    ]);
    setRefreshing(false);
  };

  const reviews = useMemo(() =>
    reviewPages?.pages.flatMap((p) => p.reviews) || [],
    [reviewPages]
  );
  const followingSet = useMemo(() => new Set(profile?.following || []), [profile?.following]);
  const followingReviews = useMemo(() =>
    reviews.filter((r) => followingSet.has(r.userId)),
    [reviews, followingSet]
  );
  const lists = useMemo(() =>
    listPages?.pages.flatMap((p) => p.lists) || [],
    [listPages]
  );

  const followedLeagues = profile?.followedLeagues || [];

  // Filter matches to only followed leagues
  const followedMatches = useMemo(() => {
    if (!matches || followedLeagues.length === 0) return matches || [];
    return matches.filter((m) => followedLeagues.includes(m.competition.code));
  }, [matches, followedLeagues]);

  // Popular this week — fetch match data for top reviewed matchIds
  const topPopularIds = useMemo(() =>
    (popularMatchIds || []).slice(0, 8).map((p) => p.matchId),
    [popularMatchIds]
  );
  const popularMatchQueries = useQueries({
    queries: topPopularIds.map((id) => ({
      queryKey: ['match', id],
      queryFn: () => getMatchById(id),
      staleTime: 5 * 60 * 1000,
      enabled: topPopularIds.length > 0,
    })),
  });
  const popularMatches = useMemo(() => {
    // Start with reviewed matches in rank order
    const reviewed: Match[] = [];
    for (const q of popularMatchQueries) {
      if (q.data) reviewed.push(q.data);
    }
    if (reviewed.length >= 8) return reviewed.slice(0, 8);

    // Fill remaining slots with recent finished matches
    const usedIds = new Set(reviewed.map((m) => m.id));
    const filler = (matches || [])
      .filter((m) => m.status === 'FINISHED' && !usedIds.has(m.id))
      .slice(0, 8 - reviewed.length);
    return [...reviewed, ...filler];
  }, [popularMatchQueries, matches]);

  // New from friends — reviews from users the current user follows
  const friendReviews = !reviews || !profile?.following?.length
    ? []
    : reviews.filter((r) => profile.following.includes(r.userId)).slice(0, 8);

  // Fetch match data for friend reviews
  const friendMatchIds = [...new Set(friendReviews.map((r) => r.matchId))];
  const friendMatchQueries = useQueries({
    queries: friendMatchIds.map((id) => ({
      queryKey: ['match', id],
      queryFn: () => getMatchById(id),
      staleTime: 5 * 60 * 1000,
      enabled: friendMatchIds.length > 0,
    })),
  });
  const friendMatchMap = new Map<number, Match>();
  friendMatchQueries.forEach((q) => {
    if (q.data) friendMatchMap.set(q.data.id, q.data);
  });

  // Fetch match data for review tab cards
  const reviewMatchIds = useMemo(() => [...new Set(reviews.map((r) => r.matchId))], [reviews]);
  const reviewMatchQueries = useQueries({
    queries: reviewMatchIds.map((id) => ({
      queryKey: ['match', id],
      queryFn: () => getMatchById(id),
      staleTime: 5 * 60 * 1000,
      enabled: reviewMatchIds.length > 0,
    })),
  });
  const reviewMatchMap = useMemo(() => {
    const map = new Map<number, Match>();
    reviewMatchQueries.forEach((q) => {
      if (q.data) map.set(q.data.id, q.data);
    });
    return map;
  }, [reviewMatchQueries]);

  // Trending live matches — sorted by discussion count
  const trendingLiveMatches = useMemo(() => {
    if (!matches) return [];
    return matches
      .filter((m) => m.status === 'IN_PLAY' || m.status === 'PAUSED')
      .sort((a, b) => (b.discussionCount ?? 0) - (a.discussionCount ?? 0))
      .slice(0, 10);
  }, [matches]);

  // Per-league grouped (only followed leagues)
  const grouped = groupMatchesByCompetition(followedMatches);

  const renderSectionHeader = (title: string, onMore?: () => void) => (
    <Pressable
      onPress={onMore}
      disabled={!onMore}
      style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, marginBottom: spacing.sm }}
    >
      <Text style={{ fontSize: 11, fontWeight: '600', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 1 }}>
        {title}
      </Text>
      {onMore && <Ionicons name="chevron-forward" size={14} color={colors.textSecondary} />}
    </Pressable>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      {/* Sticky header */}
      <View style={{ paddingHorizontal: spacing.md, paddingTop: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border }}>
        <Text style={{ fontSize: 24, fontWeight: '700', color: colors.primary, letterSpacing: -0.5, textAlign: 'center' }}>
          bookd.
        </Text>

        {/* Pill-style tabs */}
        <View
          style={{
            flexDirection: 'row',
            marginTop: spacing.md,
            marginBottom: spacing.sm,
            backgroundColor: colors.muted,
            borderRadius: borderRadius.xl,
            padding: 3,
          }}
        >
          {TABS.map((tab, i) => (
            <Pressable
              key={tab}
              onPress={() => handleTabPress(i)}
              style={{
                flex: 1,
                paddingVertical: spacing.sm,
                borderRadius: borderRadius.xl - 2,
                backgroundColor: activeTabIndex === i ? colors.card : 'transparent',
                alignItems: 'center',
              }}
            >
              <Text
                style={{
                  ...typography.caption,
                  fontWeight: activeTabIndex === i ? '600' : '400',
                  color: activeTabIndex === i ? colors.foreground : colors.textSecondary,
                }}
              >
                {tab === 'Matches' ? t('common.matches') : tab === 'Reviews' ? t('common.reviews') : t('common.lists')}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <PagerView
        ref={pagerRef}
        style={{ flex: 1 }}
        initialPage={0}
        onPageSelected={handlePageSelected}
      >
        {/* ─── Matches Page ─── */}
        <View key="matches" style={{ flex: 1 }}>
          <ScrollView showsVerticalScrollIndicator={false} indicatorStyle={isDark ? 'white' : 'default'}
            style={{ flex: 1 }}
            nestedScrollEnabled
            contentContainerStyle={{ paddingBottom: 0 }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#fff" colors={['#fff']} />}
          >
            {matchesLoading && !matches ? (
              <View style={{ marginTop: spacing.xxl }}><LoadingSpinner fullScreen={false} /></View>
            ) : (
              <>
                {/* Trending live matches */}
                {trendingLiveMatches.length > 0 && (
                  <View style={{ backgroundColor: `${colors.accent}40`, paddingVertical: spacing.md }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, marginBottom: spacing.sm, gap: 4 }}>
                      <Ionicons name="flame" size={13} color="#ef4444" />
                      <Text style={{ fontSize: 11, fontWeight: '600', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 1 }}>
                        {t('matches.trendingLive')}
                      </Text>
                    </View>
                    <FlatList showsVerticalScrollIndicator={false}
                      horizontal
                      data={trendingLiveMatches}
                      keyExtractor={(item) => item.id.toString()}
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={{ paddingHorizontal: spacing.md, gap: spacing.sm + 4 }}
                      renderItem={({ item }) => (
                        <MatchPosterCard match={item} onPress={() => navigation.navigate('MatchDetail', { matchId: item.id })} />
                      )}
                    />
                  </View>
                )}

                {/* New from friends */}
                <View style={{ paddingVertical: spacing.md }}>
                  {renderSectionHeader(t('feed.newFromFriends'))}
                  {friendReviews.length > 0 ? (
                    <FlatList showsVerticalScrollIndicator={false}
                      horizontal
                      data={friendReviews}
                      keyExtractor={(item) => item.id}
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={{ paddingHorizontal: spacing.md, gap: spacing.sm + 4 }}
                      renderItem={({ item }) => (
                        <FriendReviewCard
                          item={item}
                          match={friendMatchMap.get(item.matchId)}
                          onPress={() => navigation.navigate('ReviewDetail', { reviewId: item.id })}
                          colors={colors}
                          spacing={spacing}
                          viewerLikedMatchIds={profile?.likedMatchIds}
                        />
                      )}
                    />
                  ) : (
                    <Text style={{ ...typography.caption, color: colors.textSecondary, paddingHorizontal: spacing.md }}>
                      {t('feed.followFriendsToSeeActivity')}
                    </Text>
                  )}
                </View>

                {/* Popular this week */}
                <View style={{ backgroundColor: `${colors.accent}40`, paddingVertical: spacing.md }}>
                  {renderSectionHeader(t('feed.popularThisWeek'))}
                  {popularMatches.length > 0 ? (
                    <FlatList showsVerticalScrollIndicator={false}
                      horizontal
                      data={popularMatches}
                      keyExtractor={(item) => item.id.toString()}
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={{ paddingHorizontal: spacing.md, gap: spacing.sm + 4 }}
                      renderItem={({ item }) => (
                        <MatchPosterCard match={item} onPress={() => navigation.navigate('MatchDetail', { matchId: item.id })} />
                      )}
                    />
                  ) : (
                    <Text style={{ ...typography.caption, color: colors.textSecondary, paddingHorizontal: spacing.md }}>
                      {t('feed.noPopularMatchesThisWeek')}
                    </Text>
                  )}
                </View>

                {/* Per-league carousels (followed leagues only) */}
                {Array.from(grouped.entries()).length > 0 ? (
                  Array.from(grouped.entries()).map(([code, leagueMatches], index) => (
                    <View
                      key={code}
                      style={{
                        backgroundColor: index % 2 === 0 ? `${colors.accent}40` : 'transparent',
                        paddingVertical: spacing.md,
                      }}
                    >
                      <LeagueCarousel
                        title={leagueMatches[0]?.competition.name || code}
                        matches={leagueMatches.slice(0, 10)}
                        onMatchPress={(id) => navigation.navigate('MatchDetail', { matchId: id })}
                        onMorePress={() => {
                          const sample = leagueMatches[0];
                          if (sample) {
                            navigation.navigate('LeagueDetail', {
                              competitionCode: sample.competition.code,
                              competitionName: sample.competition.name,
                              competitionEmblem: sample.competition.emblem,
                              initialTab: 'fixtures',
                            });
                          }
                        }}
                      />
                    </View>
                  ))
                ) : (
                  <View style={{ alignItems: 'center', paddingTop: spacing.lg, paddingHorizontal: spacing.xl }}>
                    <Ionicons name="football-outline" size={36} color={colors.textSecondary} />
                    <Text style={{ ...typography.caption, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.sm }}>
                      {t('feed.followLeaguesToSeeMatches')}
                    </Text>
                  </View>
                )}
              </>
            )}
          </ScrollView>
        </View>

        {/* ─── Reviews Page ─── */}
        <View key="reviews" style={{ flex: 1 }}>
          {reviewsLoading ? (
            <View style={{ flex: 1, justifyContent: 'center' }}><LoadingSpinner fullScreen={false} /></View>
          ) : followingReviews.length === 0 ? (
            <ScrollView showsVerticalScrollIndicator={false}
              contentContainerStyle={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: spacing.xl }}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#fff" colors={['#fff']} />}
            >
              <Ionicons name="chatbubbles-outline" size={48} color={colors.textSecondary} />
              <Text style={{ ...typography.body, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.md }}>
                {t('feed.followFriendsToSeeReviews')}
              </Text>
            </ScrollView>
          ) : (
            <FlatList showsVerticalScrollIndicator={false}
              data={followingReviews}
              keyExtractor={(item) => item.id}
              renderItem={({ item, index }) => {
                const match = reviewMatchMap.get(item.matchId);
                return (
                  <View>
                    {match && (
                      <Pressable
                        onPress={() => navigation.navigate('MatchDetail', { matchId: item.matchId })}
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          justifyContent: 'flex-start',
                          gap: spacing.sm,
                          paddingTop: spacing.md,
                          paddingBottom: spacing.xs,
                          paddingHorizontal: spacing.md,
                        }}
                      >
                        <TeamLogo uri={match.homeTeam.crest} size={16} />
                        <Text style={{ ...typography.caption, color: colors.foreground, fontWeight: '600' }}>
                          {match.homeTeam.shortName}
                        </Text>
                        <Text style={{ ...typography.caption, color: colors.textSecondary, fontWeight: '500' }}>
                          {match.homeScore != null ? `${match.homeScore} - ${match.awayScore}` : t('common.vs')}
                        </Text>
                        <Text style={{ ...typography.caption, color: colors.foreground, fontWeight: '600' }}>
                          {match.awayTeam.shortName}
                        </Text>
                        <TeamLogo uri={match.awayTeam.crest} size={16} />
                        <Text style={{ ...typography.small, color: colors.textSecondary }}>
                          · {match.competition.name}
                        </Text>
                      </Pressable>
                    )}
                    <ReviewCard
                      review={item}
                      onPress={() => navigation.navigate('ReviewDetail', { reviewId: item.id })}
                      isLast={index === followingReviews.length - 1}
                    />
                  </View>
                );
              }}
              ListHeaderComponent={
                <Text style={{ ...typography.h4, color: colors.foreground, marginTop: spacing.sm, marginBottom: spacing.sm, paddingHorizontal: spacing.md }}>
                  {t('feed.recentReviews')}
                </Text>
              }
              contentContainerStyle={{ paddingBottom: spacing.xl }}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#fff" colors={['#fff']} />}
              onEndReached={() => { if (hasNextReviewPage) fetchNextReviewPage(); }}
              onEndReachedThreshold={0.5}
              ListFooterComponent={isFetchingNextReviewPage ? (
                <ActivityIndicator style={{ paddingVertical: spacing.md }} color={colors.primary} />
              ) : null}
            />
          )}
        </View>

        {/* ─── Lists Page ─── */}
        <View key="lists" style={{ flex: 1 }}>
          {listsLoading ? (
            <View style={{ flex: 1, justifyContent: 'center' }}><LoadingSpinner fullScreen={false} /></View>
          ) : lists.length === 0 ? (
            <ScrollView showsVerticalScrollIndicator={false}
              contentContainerStyle={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: spacing.xl }}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#fff" colors={['#fff']} />}
            >
              <Ionicons name="list-outline" size={48} color={colors.textSecondary} />
              <Text style={{ ...typography.body, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.md }}>
                {t('feed.noListsYetCreate')}
              </Text>
            </ScrollView>
          ) : (
            <FlatList showsVerticalScrollIndicator={false}
              data={lists}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <ListPreviewCard
                  list={item}
                  onPress={() => navigation.navigate('ListDetail', { listId: item.id })}
                  onMatchPress={(matchId) => navigation.navigate('MatchDetail', { matchId })}
                />
              )}
              ListHeaderComponent={
                <Text style={{ ...typography.h4, color: colors.foreground, marginTop: spacing.sm, marginBottom: spacing.sm, paddingHorizontal: spacing.md }}>
                  {t('feed.popularLists')}
                </Text>
              }
              contentContainerStyle={{ paddingBottom: spacing.xl }}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#fff" colors={['#fff']} />}
              onEndReached={() => { if (hasNextListPage) fetchNextListPage(); }}
              onEndReachedThreshold={0.5}
              ListFooterComponent={isFetchingNextListPage ? (
                <ActivityIndicator style={{ paddingVertical: spacing.md }} color={colors.primary} />
              ) : null}
            />
          )}
        </View>
      </PagerView>
    </SafeAreaView>
  );
}
