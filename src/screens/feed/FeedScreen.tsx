import React, { useState, useMemo } from 'react';
import { View, Text, ScrollView, Pressable, RefreshControl, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { subDays } from 'date-fns';
import { useQueries } from '@tanstack/react-query';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { useUserProfile } from '../../hooks/useUser';
import { useMatchesRange } from '../../hooks/useMatches';
import { useRecentReviews } from '../../hooks/useReviews';
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

export function FeedScreen() {
  const { theme, isDark } = useTheme();
  const { colors, spacing, typography, borderRadius } = theme;
  const navigation = useNavigation<Nav>();
  const { user } = useAuth();
  const { data: profile } = useUserProfile(user?.uid || '');
  const [activeTab, setActiveTab] = useState<(typeof TABS)[number]>('Matches');

  const today = new Date();
  const weekAgo = subDays(today, 7);
  const { data: matches, isLoading: matchesLoading, refetch, isRefetching } = useMatchesRange(weekAgo, today);
  const { data: reviews, isLoading: reviewsLoading } = useRecentReviews();
  const { data: recentLists, isLoading: listsLoading } = useRecentLists();

  const followedLeagues = profile?.followedLeagues || [];

  // Filter matches to only followed leagues
  const followedMatches = useMemo(() => {
    if (!matches || followedLeagues.length === 0) return matches || [];
    return matches.filter((m) => followedLeagues.includes(m.competition.code));
  }, [matches, followedLeagues]);

  // Popular this week — finished matches from followed leagues
  const popularMatches = followedMatches
    .filter((m) => m.status === 'FINISHED')
    .slice(0, 8);

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

  const renderSectionHeader = (title: string) => (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, marginBottom: spacing.sm }}>
      <Text style={{ ...typography.h4, color: colors.foreground }}>{title}</Text>
      <Pressable style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
        <Text style={{ ...typography.caption, color: colors.primary }}>More</Text>
        <Ionicons name="chevron-forward" size={14} color={colors.primary} />
      </Pressable>
    </View>
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
          {TABS.map((tab) => (
            <Pressable
              key={tab}
              onPress={() => setActiveTab(tab)}
              style={{
                flex: 1,
                paddingVertical: spacing.sm,
                borderRadius: borderRadius.xl - 2,
                backgroundColor: activeTab === tab ? colors.card : 'transparent',
                alignItems: 'center',
              }}
            >
              <Text
                style={{
                  ...typography.caption,
                  fontWeight: activeTab === tab ? '600' : '400',
                  color: activeTab === tab ? colors.foreground : colors.textSecondary,
                }}
              >
                {tab}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <ScrollView indicatorStyle={isDark ? 'white' : 'default'}
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingTop: spacing.sm, paddingBottom: 0 }}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.foreground} colors={[colors.foreground]} />}
      >
        {activeTab === 'Matches' && (
          matchesLoading ? (
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
                            {hasText && (
                              <Ionicons name="reorder-three" size={10} color={colors.textSecondary} />
                            )}
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
                              <Ionicons name="reorder-three" size={10} color={colors.textSecondary} style={{ marginLeft: 1 }} />
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
                Array.from(grouped.entries()).map(([league, leagueMatches], index) => (
                  <View
                    key={league}
                    style={{
                      backgroundColor: index % 2 === 0 ? `${colors.accent}40` : 'transparent',
                      paddingVertical: spacing.md,
                    }}
                  >
                    <LeagueCarousel
                      title={league}
                      matches={leagueMatches.slice(0, 10)}
                      onMatchPress={(id) => navigation.navigate('MatchDetail', { matchId: id })}
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
          )
        )}

        {activeTab === 'Reviews' && (() => {
          const friendsOnly = (reviews || []).filter((r) => r.userId !== user?.uid);
          return (
            <View style={{ paddingHorizontal: spacing.md }}>
              <Text style={{ ...typography.h4, color: colors.foreground, marginTop: spacing.md, marginBottom: spacing.md }}>
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
                friendsOnly.map((review) => (
                  <ReviewCard
                    key={review.id}
                    review={review}
                    onPress={() => navigation.navigate('ReviewDetail', { reviewId: review.id })}
                  />
                ))
              )}
            </View>
          );
        })()}

        {activeTab === 'Lists' && (
          <View style={{ paddingHorizontal: spacing.md }}>
            <Text style={{ ...typography.h4, color: colors.foreground, marginTop: spacing.md, marginBottom: spacing.md }}>
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
                />
              ))
            )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
