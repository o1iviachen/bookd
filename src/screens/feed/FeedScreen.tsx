import React, { useState, useMemo, useRef, useCallback } from 'react';
import { View, Text, ScrollView, Pressable, RefreshControl, FlatList } from 'react-native';
import PagerView from 'react-native-pager-view';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { subDays } from 'date-fns';
import { useQueries, useQueryClient } from '@tanstack/react-query';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { useUserProfile } from '../../hooks/useUser';
import { useMatchesRange } from '../../hooks/useMatches';
import { useRecentReviews, usePopularMatchIdsThisWeek } from '../../hooks/useReviews';
import { useRecentLists } from '../../hooks/useLists';
import { ListPreviewCard } from '../../components/list/ListPreviewCard';
import { groupMatchesByCompetition, getMatchById } from '../../services/matchService';
import { MatchPosterCard } from '../../components/match/MatchPosterCard';
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

// Stable date references — only changes when the date string changes
const todayKey = new Date().toISOString().split('T')[0];

export function FeedScreen() {
  const { theme, isDark } = useTheme();
  const { colors, spacing, typography, borderRadius } = theme;
  const navigation = useNavigation<Nav>();
  const { user } = useAuth();
  const { data: profile } = useUserProfile(user?.uid || '');
  const [activeTabIndex, setActiveTabIndex] = useState(0);
  const activeTab = TABS[activeTabIndex];
  const pagerRef = useRef<PagerView>(null);
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);

  const handleTabPress = useCallback((index: number) => {
    setActiveTabIndex(index);
    pagerRef.current?.setPage(index);
  }, []);

  const handlePageScroll = useCallback((e: any) => {
    const { position, offset } = e.nativeEvent;
    setActiveTabIndex(Math.round(position + offset));
  }, []);

  const today = useMemo(() => new Date(), [todayKey]);
  const weekAgo = useMemo(() => subDays(today, 7), [today]);
  const { data: matches, isLoading: matchesLoading } = useMatchesRange(weekAgo, today);
  const { data: reviews, isLoading: reviewsLoading } = useRecentReviews();
  const { data: recentLists, isLoading: listsLoading } = useRecentLists();
  const { data: popularMatchIds } = usePopularMatchIdsThisWeek();

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['matches', 'range'] }),
      queryClient.invalidateQueries({ queryKey: ['reviews', 'recent'] }),
      queryClient.invalidateQueries({ queryKey: ['reviews', 'popularThisWeek'] }),
      queryClient.invalidateQueries({ queryKey: ['lists', 'recent'] }),
    ]);
    setRefreshing(false);
  };

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
          bookd
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
                {tab}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <PagerView
        ref={pagerRef}
        style={{ flex: 1 }}
        initialPage={0}
        onPageScroll={handlePageScroll}
      >
        {/* ─── Matches Page ─── */}
        <View key="matches" style={{ flex: 1 }}>
          <ScrollView indicatorStyle={isDark ? 'white' : 'default'}
            style={{ flex: 1 }}
            nestedScrollEnabled
            contentContainerStyle={{ paddingTop: spacing.sm, paddingBottom: 0 }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#fff" colors={['#fff']} />}
          >
            {matchesLoading && !matches ? (
              <View style={{ marginTop: spacing.xxl }}><LoadingSpinner fullScreen={false} /></View>
            ) : (
              <>
                {/* Popular this week */}
                <View style={{ paddingTop: spacing.sm, paddingBottom: spacing.sm }}>
                  {renderSectionHeader('Popular this week')}
                  {popularMatches.length > 0 ? (
                    <FlatList
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
                      No popular matches this week
                    </Text>
                  )}
                </View>

                {/* New from friends */}
                <View style={{ paddingTop: spacing.sm, paddingBottom: spacing.sm }}>
                  {renderSectionHeader('New from friends')}
                  {friendReviews.length > 0 ? (
                    <FlatList
                      horizontal
                      data={friendReviews}
                      keyExtractor={(item) => item.id}
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={{ paddingHorizontal: spacing.md, gap: spacing.sm + 4 }}
                      renderItem={({ item }) => {
                        const match = friendMatchMap.get(item.matchId);
                        const isLiked = profile?.likedMatchIds?.some((id) => String(id) === String(item.matchId)) || false;
                        const hasText = item.text?.trim().length > 0;
                        return match ? (
                          <View>
                            <MatchPosterCard
                              match={match}
                              onPress={() => navigation.navigate('ReviewDetail', { reviewId: item.id })}
                            />
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 5 }}>
                              <Avatar uri={item.userAvatar} name={item.username} size={18} />
                              <StarRating rating={item.rating} size={9} />
                              {isLiked && (
                                <Ionicons name="heart" size={9} color="#ef4444" />
                              )}
                              {item.isSpoiler ? (
                                <View style={{ backgroundColor: '#f59e0b', paddingHorizontal: 4, paddingVertical: 1, borderRadius: 3 }}>
                                  <Text style={{ fontSize: 7, fontWeight: '700', color: '#000' }}>SPOILER</Text>
                                </View>
                              ) : hasText ? (
                                <Ionicons name="reorder-three-outline" size={10} color={colors.textSecondary} />
                              ) : null}
                            </View>
                          </View>
                        ) : (
                          <Pressable
                            onPress={() => navigation.navigate('ReviewDetail', { reviewId: item.id })}
                            style={{
                              width: 120,
                              height: 180,
                              backgroundColor: colors.card,
                              borderRadius: 4,
                              borderWidth: 1,
                              borderColor: colors.border,
                              justifyContent: 'flex-end',
                              padding: 6,
                            }}
                          >
                            <Text style={{ fontSize: 9, fontWeight: '600', color: colors.foreground }} numberOfLines={2}>
                              {item.matchLabel || `Match #${item.matchId}`}
                            </Text>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 2 }}>
                              <Avatar uri={item.userAvatar} name={item.username} size={14} />
                              <StarRating rating={item.rating} size={8} />
                              {isLiked && (
                                <Ionicons name="heart" size={8} color="#ef4444" style={{ marginLeft: 1 }} />
                              )}
                              {hasText && (
                                <Ionicons name="reorder-three-outline" size={10} color={colors.textSecondary} style={{ marginLeft: 1 }} />
                              )}
                            </View>
                          </Pressable>
                        );
                      }}
                    />
                  ) : (
                    <Text style={{ ...typography.caption, color: colors.textSecondary, paddingHorizontal: spacing.md }}>
                      Follow friends to see their activity
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
                      Follow leagues to see matches here
                    </Text>
                  </View>
                )}
              </>
            )}
          </ScrollView>
        </View>

        {/* ─── Reviews Page ─── */}
        <View key="reviews" style={{ flex: 1 }}>
          <ScrollView indicatorStyle={isDark ? 'white' : 'default'}
            style={{ flex: 1 }}
            nestedScrollEnabled
            contentContainerStyle={{ paddingBottom: spacing.xl }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#fff" colors={['#fff']} />}
          >
            {(() => {
              const friendsOnly = (reviews || []).filter((r) => r.userId !== user?.uid);
              return (
                <View>
                  <Text style={{ ...typography.h4, color: colors.foreground, marginTop: spacing.sm, marginBottom: spacing.sm, paddingHorizontal: spacing.md }}>
                    New from friends
                  </Text>
                  {reviewsLoading ? (
                    <View style={{ marginTop: spacing.xxl }}><LoadingSpinner fullScreen={false} /></View>
                  ) : friendsOnly.length === 0 ? (
                    <View style={{ alignItems: 'center', marginTop: spacing.xxl, paddingHorizontal: spacing.xl }}>
                      <Ionicons name="chatbubbles-outline" size={48} color={colors.textSecondary} />
                      <Text style={{ ...typography.body, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.md }}>
                        Follow friends to see their reviews here
                      </Text>
                    </View>
                  ) : (
                    friendsOnly.map((review, i) => (
                      <ReviewCard
                        key={review.id}
                        review={review}
                        onPress={() => navigation.navigate('ReviewDetail', { reviewId: review.id })}
                        isLast={i === friendsOnly.length - 1}
                      />
                    ))
                  )}
                </View>
              );
            })()}
          </ScrollView>
        </View>

        {/* ─── Lists Page ─── */}
        <View key="lists" style={{ flex: 1 }}>
          <ScrollView indicatorStyle={isDark ? 'white' : 'default'}
            style={{ flex: 1 }}
            nestedScrollEnabled
            contentContainerStyle={{ paddingBottom: spacing.xl }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#fff" colors={['#fff']} />}
          >
            <View>
              <Text style={{ ...typography.h4, color: colors.foreground, marginTop: spacing.sm, marginBottom: spacing.sm, paddingHorizontal: spacing.md }}>
                Popular lists
              </Text>
              {listsLoading ? (
                <View style={{ marginTop: spacing.xxl }}><LoadingSpinner fullScreen={false} /></View>
              ) : !recentLists || recentLists.length === 0 ? (
                <View style={{ alignItems: 'center', marginTop: spacing.xxl, paddingHorizontal: spacing.xl }}>
                  <Ionicons name="list-outline" size={48} color={colors.textSecondary} />
                  <Text style={{ ...typography.body, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.md }}>
                    No lists yet. Create one from your profile!
                  </Text>
                </View>
              ) : (
                recentLists.map((list) => (
                  <ListPreviewCard
                    key={list.id}
                    list={list}
                    onPress={() => navigation.navigate('ListDetail', { listId: list.id })}
                    onMatchPress={(matchId) => navigation.navigate('MatchDetail', { matchId })}
                  />
                ))
              )}
            </View>
          </ScrollView>
        </View>
      </PagerView>
    </SafeAreaView>
  );
}
