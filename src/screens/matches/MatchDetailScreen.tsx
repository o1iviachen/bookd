import React, { useState, useMemo, useRef, useCallback } from 'react';
import { View, Text, Pressable, Share, ScrollView } from 'react-native';
import PagerView from 'react-native-pager-view';
import { Select } from '../../components/ui/Select';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useQueries } from '@tanstack/react-query';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { useMatch, useMatchDetail } from '../../hooks/useMatches';
import { useReviewsForMatch } from '../../hooks/useReviews';
import { useCommentsForReview } from '../../hooks/useComments';
import { useUserProfile } from '../../hooks/useUser';
import { getUserProfile } from '../../services/firestore/users';
import { useListsForMatch } from '../../hooks/useLists';
import { TeamLogo } from '../../components/match/TeamLogo';
import { Avatar } from '../../components/ui/Avatar';
import { StarRating } from '../../components/ui/StarRating';
import { ReviewCard } from '../../components/review/ReviewCard';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { AddToListModal } from '../../components/list/AddToListModal';
import { ActionMenu } from '../../components/ui/ActionMenu';
import { RatingChart } from '../../components/profile/RatingChart';
import { formatFullDate, formatMatchTime } from '../../utils/formatDate';
import { getStadiumImageUrl } from '../../utils/stadiumImages';
import { MatchesStackParamList } from '../../types/navigation';
import { MatchDetail, MatchPlayer } from '../../services/footballApi';
import { User } from '../../types/user';

type MatchTab = 'reviews' | 'lineup' | 'info';

type Props = NativeStackScreenProps<MatchesStackParamList, 'MatchDetail'>;

const FALLBACK_STADIUM = 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d2/London_Wembley.jpg/1280px-London_Wembley.jpg';

export function MatchDetailScreen({ route, navigation }: Props) {
  const { theme, isDark } = useTheme();
  const { colors, spacing, typography, borderRadius } = theme;
  const { user } = useAuth();
  const { matchId } = route.params;
  const [showListModal, setShowListModal] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [activeTabIndex, setActiveTabIndex] = useState(0);
  const pagerRef = useRef<PagerView>(null);
  const insets = useSafeAreaInsets();

  const MATCH_TABS: { key: MatchTab; label: string }[] = [
    { key: 'reviews', label: 'Reviews' },
    { key: 'lineup', label: 'Lineup' },
    { key: 'info', label: 'Info' },
  ];

  const handleTabPress = useCallback((index: number) => {
    setActiveTabIndex(index);
    pagerRef.current?.setPage(index);
  }, []);

  const handlePageSelected = useCallback((e: any) => {
    setActiveTabIndex(e.nativeEvent.position);
  }, []);

  const { data: match, isLoading } = useMatch(matchId);
  const { data: reviews } = useReviewsForMatch(matchId);
  const { data: profile } = useUserProfile(user?.uid || '');
  const { data: matchLists } = useListsForMatch(matchId);
  const { data: matchDetail } = useMatchDetail(matchId);

  if (isLoading || !match) {
    return <LoadingSpinner />;
  }

  const isFinished = match.status === 'FINISHED';
  const isLive = match.status === 'IN_PLAY' || match.status === 'PAUSED';

  const userReviews = reviews?.filter((r) => r.userId === user?.uid) || [];
  const hasReview = userReviews.length > 0;

  const stadiumUrl = getStadiumImageUrl(match.homeTeam.id);

  const handleShare = async () => {
    let message: string;
    if (isFinished || isLive) {
      message = `Check out ${match.homeTeam.shortName} ${match.homeScore} - ${match.awayScore} ${match.awayTeam.shortName} on bookd!`;
    } else {
      message = `Check out ${match.homeTeam.shortName} vs ${match.awayTeam.shortName} on bookd!`;
    }
    message += `\n${match.competition.name} · ${formatFullDate(match.kickoff)}`;
    try {
      await Share.share({ message });
    } catch {}
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Fixed gradient overlay behind status bar — stays pinned on scroll */}
      <LinearGradient
        colors={['rgba(0,0,0,0.6)', 'rgba(0,0,0,0.3)', 'transparent']}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: insets.top + 40,
          zIndex: 20,
        }}
        pointerEvents="none"
      />

      {/* Hero area with stadium background */}
      <View style={{ height: 320, backgroundColor: colors.background, overflow: 'visible' }}>
        <View
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: 320,
          }}
        >
          <Image
            source={{ uri: stadiumUrl || FALLBACK_STADIUM }}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
            }}
            contentFit="cover"
            transition={300}
          />
          <LinearGradient
            colors={['rgba(0,0,0,0.3)', 'rgba(0,0,0,0.5)']}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
            }}
          />
        </View>

        {/* Back button overlay */}
        <Pressable
          onPress={() => navigation.goBack()}
          style={{
            position: 'absolute',
            top: insets.top + spacing.xs,
            left: spacing.md,
            zIndex: 10,
            backgroundColor: 'rgba(0,0,0,0.5)',
            borderRadius: borderRadius.full,
            padding: spacing.sm,
          }}
        >
          <Ionicons name="arrow-back" size={20} color="#fff" />
        </Pressable>

        {/* Three-dot menu button */}
        <Pressable
          onPress={() => setShowMenu(true)}
          style={{
            position: 'absolute',
            top: insets.top + spacing.xs,
            right: spacing.md,
            zIndex: 10,
            backgroundColor: 'rgba(0,0,0,0.5)',
            borderRadius: borderRadius.full,
            padding: spacing.sm,
          }}
        >
          <Ionicons name="ellipsis-horizontal" size={20} color="#fff" />
        </Pressable>

        {/* Team crests in hero */}
        <View
          style={{
            flex: 1,
            flexDirection: 'row',
            alignItems: 'flex-end',
            justifyContent: 'center',
            gap: spacing.xxl,
            paddingBottom: 80,
            zIndex: 5,
          }}
        >
          <Pressable onPress={() => (navigation as any).navigate('TeamDetail', { teamId: match.homeTeam.id, teamName: match.homeTeam.name, teamCrest: match.homeTeam.crest })}>
            <TeamLogo uri={match.homeTeam.crest} size={80} />
          </Pressable>
          <Pressable onPress={() => (navigation as any).navigate('TeamDetail', { teamId: match.awayTeam.id, teamName: match.awayTeam.name, teamCrest: match.awayTeam.crest })}>
            <TeamLogo uri={match.awayTeam.crest} size={80} />
          </Pressable>
        </View>

        {/* Gradient overlay at bottom of hero */}
        <LinearGradient
          colors={['transparent', `${colors.background}40`, `${colors.background}99`, `${colors.background}cc`, colors.background]}
          locations={[0, 0.3, 0.55, 0.75, 1]}
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: 200,
            justifyContent: 'flex-end',
            alignItems: 'center',
            paddingBottom: spacing.xs,
          }}
        >
          {/* Score */}
          {(isFinished || isLive) ? (
            <>
              <View style={{ flexDirection: 'row', alignItems: 'center', alignSelf: 'stretch', paddingHorizontal: spacing.md }}>
                <Pressable onPress={() => (navigation as any).navigate('TeamDetail', { teamId: match.homeTeam.id, teamName: match.homeTeam.name, teamCrest: match.homeTeam.crest })} style={{ flex: 1 }}>
                  <Text style={{ ...typography.bodyBold, color: colors.foreground, fontSize: 16, textAlign: 'right' }} numberOfLines={1}>
                    {match.homeTeam.shortName}
                  </Text>
                </Pressable>
                <Text style={{ fontSize: 40, fontWeight: '700', color: colors.primary, paddingHorizontal: spacing.md }}>
                  {match.homeScore} - {match.awayScore}
                </Text>
                <Pressable onPress={() => (navigation as any).navigate('TeamDetail', { teamId: match.awayTeam.id, teamName: match.awayTeam.name, teamCrest: match.awayTeam.crest })} style={{ flex: 1 }}>
                  <Text style={{ ...typography.bodyBold, color: colors.foreground, fontSize: 16, textAlign: 'left' }} numberOfLines={1}>
                    {match.awayTeam.shortName}
                  </Text>
                </Pressable>
              </View>
              {isLive && (
                <View style={{ backgroundColor: colors.primary, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4, marginTop: 4 }}>
                  <Text style={{ fontSize: 11, fontWeight: '800', color: '#14181c' }}>LIVE</Text>
                </View>
              )}
              {isFinished && (
                <Text style={{ ...typography.caption, color: colors.textSecondary, marginTop: 4 }}>Full Time</Text>
              )}
            </>
          ) : (
            <>
              <View style={{ flexDirection: 'row', alignItems: 'center', alignSelf: 'stretch', paddingHorizontal: spacing.md }}>
                <Pressable onPress={() => (navigation as any).navigate('TeamDetail', { teamId: match.homeTeam.id, teamName: match.homeTeam.name, teamCrest: match.homeTeam.crest })} style={{ flex: 1 }}>
                  <Text style={{ ...typography.bodyBold, color: colors.foreground, textAlign: 'right' }} numberOfLines={1}>
                    {match.homeTeam.shortName}
                  </Text>
                </Pressable>
                <Text style={{ ...typography.h2, color: colors.textSecondary, paddingHorizontal: spacing.md }}>vs</Text>
                <Pressable onPress={() => (navigation as any).navigate('TeamDetail', { teamId: match.awayTeam.id, teamName: match.awayTeam.name, teamCrest: match.awayTeam.crest })} style={{ flex: 1 }}>
                  <Text style={{ ...typography.bodyBold, color: colors.foreground, textAlign: 'left' }} numberOfLines={1}>
                    {match.awayTeam.shortName}
                  </Text>
                </Pressable>
              </View>
              <Text style={{ ...typography.caption, color: colors.textSecondary, marginTop: 4 }}>
                {formatMatchTime(match.kickoff)}
              </Text>
            </>
          )}
        </LinearGradient>
      </View>

      {/* Competition + date */}
      <Pressable
        onPress={() => (navigation as any).navigate('LeagueDetail', { competitionCode: match.competition.code, competitionName: match.competition.name, competitionEmblem: match.competition.emblem })}
        style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs, paddingBottom: spacing.xs, opacity: pressed ? 0.7 : 1 })}
      >
        <View style={{ backgroundColor: '#fff', borderRadius: 4, padding: 2 }}>
          <TeamLogo uri={match.competition.emblem} size={16} />
        </View>
        <Text style={{ ...typography.caption, color: colors.textSecondary }}>
          {match.competition.name} · {formatFullDate(match.kickoff)}
        </Text>
      </Pressable>

      {/* Tab bar */}
      <View style={{ flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: colors.border }}>
        {MATCH_TABS.map((tab, i) => {
          const isActive = activeTabIndex === i;
          return (
            <Pressable
              key={tab.key}
              onPress={() => handleTabPress(i)}
              style={{
                flex: 1,
                alignItems: 'center',
                paddingVertical: spacing.sm,
                borderBottomWidth: 2,
                borderBottomColor: isActive ? colors.primary : 'transparent',
              }}
            >
              <Text style={{
                ...typography.body,
                fontWeight: isActive ? '600' : '400',
                color: isActive ? colors.foreground : colors.textSecondary,
                fontSize: 15,
              }}>
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Swipeable tab content */}
      <PagerView
        ref={pagerRef}
        style={{ flex: 1 }}
        initialPage={0}
        onPageSelected={handlePageSelected}
      >
        {/* ─── Reviews Page ─── */}
        <View key="reviews" style={{ flex: 1 }}>
          <ScrollView indicatorStyle={isDark ? 'white' : 'default'} contentContainerStyle={{ paddingBottom: 40 }} nestedScrollEnabled>
            {/* Stats row */}
            {isFinished && reviews && reviews.length > 0 && (
              <View style={{ flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.md, marginTop: spacing.sm, marginBottom: spacing.md }}>
                <Pressable
                  onPress={() => navigation.navigate('WatchedBy', { matchId })}
                  style={{ flex: 1, backgroundColor: colors.primary, borderRadius: borderRadius.md, padding: spacing.md, alignItems: 'center' }}
                >
                  <Text style={{ fontSize: 24, fontWeight: '700', color: '#14181c' }}>{reviews.length}</Text>
                  <Text style={{ fontSize: 11, color: '#14181c', fontWeight: '500' }}>Watched</Text>
                </Pressable>
                <Pressable
                  onPress={() => navigation.navigate('MatchLists', { matchId })}
                  style={{ flex: 1, backgroundColor: '#3b82f6', borderRadius: borderRadius.md, padding: spacing.md, alignItems: 'center' }}
                >
                  <Text style={{ fontSize: 24, fontWeight: '700', color: '#fff' }}>{matchLists?.length || 0}</Text>
                  <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.8)' }}>Lists</Text>
                </Pressable>
              </View>
            )}

            {/* Rating distribution bar chart */}
            {isFinished && reviews && reviews.length > 0 && (
              <RatingChart reviews={reviews} showStats />
            )}

            {/* Locked state for non-finished matches */}
            {!isFinished && (
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  backgroundColor: colors.muted,
                  borderRadius: borderRadius.md,
                  padding: spacing.md,
                  marginHorizontal: spacing.md,
                  marginTop: spacing.md,
                  gap: spacing.sm,
                }}
              >
                <Ionicons name="lock-closed" size={18} color={colors.textSecondary} />
                <Text style={{ ...typography.body, color: colors.textSecondary, flex: 1 }}>
                  {isLive ? 'Reviews unlock after full time' : 'Reviews unlock after this match is played'}
                </Text>
              </View>
            )}

            {/* Watched by friends */}
            {isFinished && reviews && reviews.length > 0 && (profile?.following?.length || 0) > 0 && (
              <WatchedByFriends
                reviews={reviews}
                matchId={matchId}
                following={profile?.following || []}
                colors={colors}
                spacing={spacing}
                typography={typography}
                navigation={navigation}
              />
            )}

            {/* Review CTA */}
            {isFinished && (
              <Pressable
                onPress={() => navigation.navigate('CreateReview', { matchId })}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  backgroundColor: colors.muted,
                  borderRadius: borderRadius.md,
                  padding: spacing.md,
                  marginHorizontal: spacing.md,
                  marginTop: spacing.md,
                  gap: spacing.md,
                }}
              >
                <View style={{ flex: 1 }}>
                  <Text style={{ ...typography.bodyBold, color: colors.foreground }}>
                    {hasReview ? 'Log again...' : 'Rate or review...'}
                  </Text>
                  <Text style={{ ...typography.small, color: colors.textSecondary }}>
                    {hasReview ? 'Add another diary entry' : 'Share your thoughts on this match'}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
              </Pressable>
            )}

            {/* Reviews section */}
            {isFinished && (
              <ReviewsSection reviews={reviews || []} userId={user?.uid} profile={profile} colors={colors} spacing={spacing} typography={typography} borderRadius={borderRadius} navigation={navigation} />
            )}
          </ScrollView>
        </View>

        {/* ─── Lineup Page ─── */}
        <View key="lineup" style={{ flex: 1 }}>
          <ScrollView indicatorStyle={isDark ? 'white' : 'default'} contentContainerStyle={{ paddingBottom: 40 }} nestedScrollEnabled>
            <LineupSection matchDetail={matchDetail || null} match={match} colors={colors} spacing={spacing} typography={typography} navigation={navigation} />
          </ScrollView>
        </View>

        {/* ─── Info Page ─── */}
        <View key="info" style={{ flex: 1 }}>
          <ScrollView indicatorStyle={isDark ? 'white' : 'default'} contentContainerStyle={{ paddingBottom: 40 }} nestedScrollEnabled>
            <InfoSection matchDetail={matchDetail || null} match={match} colors={colors} spacing={spacing} typography={typography} borderRadius={borderRadius} navigation={navigation} />
          </ScrollView>
        </View>
      </PagerView>

      {/* Three-dot menu */}
      <ActionMenu
        visible={showMenu}
        onClose={() => setShowMenu(false)}
        items={[
          { label: 'Add to list', icon: 'list-outline', onPress: () => { setShowMenu(false); setShowListModal(true); } },
          { label: 'Share', icon: 'share-outline', onPress: () => { setShowMenu(false); handleShare(); } },
        ]}
      />

      {/* Add to List Modal */}
      <AddToListModal
        visible={showListModal}
        onClose={() => setShowListModal(false)}
        matchId={matchId}
      />
    </View>
  );
}

/* ─── Watched by friends (horizontal avatar row) ─── */

function WatchedByFriends({ reviews, matchId, following, colors, spacing, typography, navigation }: {
  reviews: any[];
  matchId: number;
  following: string[];
  colors: any;
  spacing: any;
  typography: any;
  navigation: any;
}) {
  // Get friend reviews (deduplicate by userId, keep latest)
  const friendReviews = useMemo(() => {
    const map = new Map<string, any>();
    const sorted = [...reviews].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    for (const r of sorted) {
      if (following.includes(r.userId) && !map.has(r.userId)) {
        map.set(r.userId, r);
      }
    }
    return Array.from(map.values());
  }, [reviews, following]);

  // Fetch profiles for friend watchers
  const friendIds = useMemo(() => friendReviews.map((r) => r.userId), [friendReviews]);
  const profileQueries = useQueries({
    queries: friendIds.map((uid) => ({
      queryKey: ['user', uid],
      queryFn: () => getUserProfile(uid),
      staleTime: 2 * 60 * 1000,
      enabled: friendIds.length > 0,
    })),
  });

  const friendWatchers = useMemo(() => {
    const entries: { userId: string; profile: User; rating: number; hasText: boolean; likedMatch: boolean; reviewId: string }[] = [];
    profileQueries.forEach((q) => {
      if (!q.data) return;
      const p = q.data;
      const review = friendReviews.find((r) => r.userId === p.id);
      if (!review) return;
      entries.push({
        userId: p.id,
        profile: p,
        rating: review.rating,
        hasText: (review.text?.trim().length || 0) > 0,
        likedMatch: p.likedMatchIds?.some((id: number) => String(id) === String(matchId)) || false,
        reviewId: review.id,
      });
    });
    return entries;
  }, [profileQueries, friendReviews, matchId]);

  if (friendWatchers.length === 0) return null;

  return (
    <View style={{ paddingHorizontal: spacing.md, paddingVertical: spacing.md, backgroundColor: `${colors.accent}30`, borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.border }}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm }}>
        <Text style={{ fontSize: 11, fontWeight: '600', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 1 }}>
          Watched by
        </Text>
        <Pressable
          onPress={() => navigation.navigate('WatchedBy', { matchId, initialTab: 'friends' })}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}
        >
          <Text style={{ ...typography.caption, color: colors.primary }}>More</Text>
          <Ionicons name="chevron-forward" size={14} color={colors.primary} />
        </Pressable>
      </View>

      {/* Horizontal avatar scroll */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.md }}>
        {friendWatchers.map((w) => {
          const handlePress = () => {
            if (w.rating > 0) {
              navigation.navigate('ReviewDetail', { reviewId: w.reviewId });
            } else {
              navigation.navigate('UserProfile', { userId: w.userId });
            }
          };

          return (
            <Pressable key={w.userId} onPress={handlePress} style={{ alignItems: 'center', width: 64 }}>
              <View>
                <Avatar uri={w.profile.avatar} name={w.profile.username} size={52} />
                {/* Badge icons */}
                <View style={{ position: 'absolute', top: -2, right: -2, flexDirection: 'row', gap: 1 }}>
                  {w.hasText && (
                    <View style={{ backgroundColor: colors.card, borderRadius: 8, padding: 2 }}>
                      <Ionicons name="reorder-three-outline" size={10} color={colors.textSecondary} />
                    </View>
                  )}
                </View>
              </View>
              {w.rating > 0 && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2, marginTop: 4 }}>
                  <StarRating rating={w.rating} size={8} />
                  {w.likedMatch && <Ionicons name="heart" size={8} color="#ef4444" />}
                </View>
              )}
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

type ReviewFilter = 'everyone' | 'friends' | 'you';
type ReviewSort = 'recent' | 'popular' | 'highest' | 'lowest';

function ReviewCardWithComments({ review, onPress }: { review: any; onPress: () => void }) {
  const { data: comments } = useCommentsForReview(review.id);
  const commentCount = comments?.length || 0;
  return <ReviewCard review={review} onPress={onPress} commentCount={commentCount} />;
}

function ReviewsSection({ reviews, userId, profile, colors, spacing, typography, borderRadius, navigation }: any) {
  const [filter, setFilter] = useState<ReviewFilter>('everyone');
  const [sort, setSort] = useState<ReviewSort>('popular');

  const filteredReviews = useMemo(() => {
    // Only show reviews that have written text
    let filtered = [...reviews].filter((r: any) => r.text?.trim().length > 0);

    if (filter === 'friends' && profile?.following?.length) {
      filtered = filtered.filter((r: any) => profile.following.includes(r.userId));
    } else if (filter === 'you' && userId) {
      filtered = filtered.filter((r: any) => r.userId === userId);
    }

    if (sort === 'recent') {
      filtered.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    } else if (sort === 'popular') {
      filtered.sort((a: any, b: any) => ((b.upvotes || 0) - (b.downvotes || 0)) - ((a.upvotes || 0) - (a.downvotes || 0)));
    } else if (sort === 'highest') {
      filtered.sort((a: any, b: any) => b.rating - a.rating);
    } else if (sort === 'lowest') {
      filtered.sort((a: any, b: any) => a.rating - b.rating);
    }

    return filtered;
  }, [reviews, filter, sort, userId, profile?.following]);

  const filterTabs: { key: ReviewFilter; label: string }[] = [
    { key: 'everyone', label: 'Everyone' },
    { key: 'friends', label: 'Friends' },
    { key: 'you', label: 'You' },
  ];

  const sortOptions: { key: ReviewSort; label: string }[] = [
    { key: 'recent', label: 'Most Recent' },
    { key: 'popular', label: 'Most Popular' },
    { key: 'highest', label: 'Highest Rating' },
    { key: 'lowest', label: 'Lowest Rating' },
  ];

  return (
    <View style={{ marginTop: spacing.lg, paddingHorizontal: spacing.md }}>
      {/* Header */}
      <Text style={{ ...typography.h4, color: colors.foreground, marginBottom: spacing.sm }}>
        Reviews {reviews.length > 0 ? `(${reviews.length})` : ''}
      </Text>

      {/* Filter tabs + Sort dropdown row */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md }}>
        <View style={{ flexDirection: 'row', gap: spacing.xs }}>
          {filterTabs.map((tab) => (
            <Pressable
              key={tab.key}
              onPress={() => setFilter(tab.key)}
              style={{
                paddingHorizontal: spacing.sm + 2,
                paddingVertical: spacing.xs,
                borderRadius: borderRadius.full,
                backgroundColor: filter === tab.key ? colors.primary : colors.muted,
              }}
            >
              <Text style={{ fontSize: 12, fontWeight: '500', color: filter === tab.key ? '#14181c' : colors.textSecondary }}>
                {tab.label}
              </Text>
            </Pressable>
          ))}
        </View>
        <View style={{ width: 140 }}>
          <Select
            value={sort}
            onValueChange={(v) => setSort(v as ReviewSort)}
            title="Sort Reviews"
            options={sortOptions.map((o) => ({ value: o.key, label: o.label }))}
          />
        </View>
      </View>

      {/* Review list */}
      {filteredReviews.length === 0 ? (
        <View style={{ alignItems: 'center', paddingVertical: spacing.xl }}>
          <Ionicons name="chatbubbles-outline" size={36} color={colors.textSecondary} />
          <Text style={{ ...typography.body, color: colors.textSecondary, marginTop: spacing.sm }}>
            {filter === 'everyone' ? 'No reviews yet. Be the first!' : filter === 'friends' ? 'No reviews from friends yet' : 'You haven\'t logged this match yet'}
          </Text>
        </View>
      ) : (
        filteredReviews.map((review: any) => (
          <ReviewCardWithComments
            key={review.id}
            review={review}
            onPress={() => navigation.navigate('ReviewDetail', { reviewId: review.id })}
          />
        ))
      )}
    </View>
  );
}

/* ─── Lineup Section ─── */

function PlayerRow({ player, colors, spacing, typography, onPress }: { player: MatchPlayer; colors: any; spacing: any; typography: any; onPress?: () => void }) {
  return (
    <Pressable onPress={onPress} disabled={!onPress} style={({ pressed }) => ({ opacity: pressed && onPress ? 0.7 : 1 })}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.xs + 2, gap: spacing.sm }}>
        {player.shirtNumber !== null && (
          <Text style={{ width: 24, textAlign: 'center', ...typography.caption, color: colors.textSecondary }}>
            {player.shirtNumber}
          </Text>
        )}
        <Text style={{ ...typography.body, color: colors.foreground, fontSize: 14, flex: 1 }}>
          {player.name}
        </Text>
        {player.position && (
          <Text style={{ ...typography.small, color: colors.textSecondary }}>
            {player.position === 'Goalkeeper' ? 'GK' : player.position === 'Defence' ? 'DEF' : player.position === 'Midfield' ? 'MID' : player.position === 'Offence' ? 'FWD' : player.position}
          </Text>
        )}
      </View>
    </Pressable>
  );
}

function LineupSection({ matchDetail, match, colors, spacing, typography, navigation }: { matchDetail: MatchDetail | null; match: any; colors: any; spacing: any; typography: any; navigation: any }) {
  if (!matchDetail) {
    return (
      <View style={{ alignItems: 'center', paddingVertical: spacing.xxl }}>
        <LoadingSpinner fullScreen={false} />
      </View>
    );
  }

  const hasLineup = matchDetail.homeLineup.length > 0 || matchDetail.awayLineup.length > 0;

  if (!hasLineup) {
    return (
      <View style={{ alignItems: 'center', paddingVertical: spacing.xxl, paddingHorizontal: spacing.xl }}>
        <Ionicons name="people-outline" size={40} color={colors.textSecondary} />
        <Text style={{ ...typography.bodyBold, color: colors.foreground, marginTop: spacing.md }}>
          Lineups not available
        </Text>
        <Text style={{ ...typography.body, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.xs }}>
          Lineups are usually available close to kickoff
        </Text>
      </View>
    );
  }

  return (
    <View style={{ paddingHorizontal: spacing.md, paddingTop: spacing.sm }}>
      {/* Formations */}
      {(matchDetail.homeFormation || matchDetail.awayFormation) && (
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.md }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <TeamLogo uri={match.homeTeam.crest} size={20} />
            <Text style={{ ...typography.bodyBold, color: colors.foreground, fontSize: 14 }}>
              {matchDetail.homeFormation || '—'}
            </Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <Text style={{ ...typography.bodyBold, color: colors.foreground, fontSize: 14 }}>
              {matchDetail.awayFormation || '—'}
            </Text>
            <TeamLogo uri={match.awayTeam.crest} size={20} />
          </View>
        </View>
      )}

      {/* Home Starting XI */}
      <View style={{ marginBottom: spacing.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm }}>
          <TeamLogo uri={match.homeTeam.crest} size={18} />
          <Text style={{ ...typography.bodyBold, color: colors.foreground, fontSize: 14 }}>
            {match.homeTeam.shortName}
          </Text>
          <Text style={{ ...typography.caption, color: colors.textSecondary }}>Starting XI</Text>
        </View>
        {matchDetail.homeLineup.map((p) => (
          <PlayerRow key={p.id} player={p} colors={colors} spacing={spacing} typography={typography} onPress={() => navigation.navigate('PersonDetail', { personId: p.id, personName: p.name, role: 'player' })} />
        ))}
        {matchDetail.homeCoach && (
          <Pressable onPress={() => navigation.navigate('PersonDetail', { personId: matchDetail.homeCoach!.id, personName: matchDetail.homeCoach!.name, role: 'manager' })} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
            <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.xs + 2, gap: spacing.sm, marginTop: spacing.xs }}>
              <Text style={{ width: 24, textAlign: 'center', ...typography.caption, color: colors.textSecondary }}>
                <Ionicons name="person" size={12} color={colors.textSecondary} />
              </Text>
              <Text style={{ ...typography.body, color: colors.textSecondary, fontSize: 14, fontStyle: 'italic' }}>
                {matchDetail.homeCoach.name} (Coach)
              </Text>
            </View>
          </Pressable>
        )}
      </View>

      {/* Home Bench */}
      {matchDetail.homeBench.length > 0 && (
        <View style={{ marginBottom: spacing.lg }}>
          <Text style={{ ...typography.caption, color: colors.textSecondary, fontWeight: '600', marginBottom: spacing.xs }}>
            Substitutes
          </Text>
          {matchDetail.homeBench.map((p) => (
            <PlayerRow key={p.id} player={p} colors={colors} spacing={spacing} typography={typography} onPress={() => navigation.navigate('PersonDetail', { personId: p.id, personName: p.name, role: 'player' })} />
          ))}
        </View>
      )}

      <View style={{ height: 1, backgroundColor: colors.border, marginBottom: spacing.md }} />

      {/* Away Starting XI */}
      <View style={{ marginBottom: spacing.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm }}>
          <TeamLogo uri={match.awayTeam.crest} size={18} />
          <Text style={{ ...typography.bodyBold, color: colors.foreground, fontSize: 14 }}>
            {match.awayTeam.shortName}
          </Text>
          <Text style={{ ...typography.caption, color: colors.textSecondary }}>Starting XI</Text>
        </View>
        {matchDetail.awayLineup.map((p) => (
          <PlayerRow key={p.id} player={p} colors={colors} spacing={spacing} typography={typography} onPress={() => navigation.navigate('PersonDetail', { personId: p.id, personName: p.name, role: 'player' })} />
        ))}
        {matchDetail.awayCoach && (
          <Pressable onPress={() => navigation.navigate('PersonDetail', { personId: matchDetail.awayCoach!.id, personName: matchDetail.awayCoach!.name, role: 'manager' })} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
            <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.xs + 2, gap: spacing.sm, marginTop: spacing.xs }}>
              <Text style={{ width: 24, textAlign: 'center', ...typography.caption, color: colors.textSecondary }}>
                <Ionicons name="person" size={12} color={colors.textSecondary} />
              </Text>
              <Text style={{ ...typography.body, color: colors.textSecondary, fontSize: 14, fontStyle: 'italic' }}>
                {matchDetail.awayCoach.name} (Coach)
              </Text>
            </View>
          </Pressable>
        )}
      </View>

      {/* Away Bench */}
      {matchDetail.awayBench.length > 0 && (
        <View style={{ marginBottom: spacing.md }}>
          <Text style={{ ...typography.caption, color: colors.textSecondary, fontWeight: '600', marginBottom: spacing.xs }}>
            Substitutes
          </Text>
          {matchDetail.awayBench.map((p) => (
            <PlayerRow key={p.id} player={p} colors={colors} spacing={spacing} typography={typography} onPress={() => navigation.navigate('PersonDetail', { personId: p.id, personName: p.name, role: 'player' })} />
          ))}
        </View>
      )}
    </View>
  );
}

/* ─── Info Section ─── */

function StatRow({ label, home, away, colors, spacing, typography, isPossession }: {
  label: string; home: number; away: number; colors: any; spacing: any; typography: any; isPossession?: boolean;
}) {
  const homeHigher = home > away;
  const awayHigher = away > home;

  if (isPossession) {
    const homePct = home || 50;
    const awayPct = away || 50;
    return (
      <View style={{ marginBottom: spacing.md }}>
        <Text style={{ ...typography.small, color: colors.textSecondary, textAlign: 'center', marginBottom: spacing.xs }}>
          Ball Possession
        </Text>
        <View style={{ flexDirection: 'row', gap: 2, alignItems: 'center' }}>
          <View style={{
            flex: homePct, backgroundColor: colors.primary, borderTopLeftRadius: 20, borderBottomLeftRadius: 20,
            paddingVertical: 8, paddingHorizontal: 12, alignItems: homePct > 15 ? 'flex-start' : 'center',
          }}>
            <Text style={{ fontSize: 13, fontWeight: '700', color: '#14181c' }}>{homePct}%</Text>
          </View>
          <View style={{
            flex: awayPct, backgroundColor: '#3b82f6', borderTopRightRadius: 20, borderBottomRightRadius: 20,
            paddingVertical: 8, paddingHorizontal: 12, alignItems: awayPct > 15 ? 'flex-end' : 'center',
          }}>
            <Text style={{ fontSize: 13, fontWeight: '700', color: '#fff' }}>{awayPct}%</Text>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing.sm, gap: spacing.sm }}>
      <View style={{
        minWidth: 36, alignItems: 'center',
        ...(homeHigher ? { backgroundColor: colors.primary, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 4 } : {}),
      }}>
        <Text style={{
          fontSize: 14, fontWeight: homeHigher ? '700' : '400',
          color: homeHigher ? '#14181c' : colors.foreground,
        }}>
          {home}
        </Text>
      </View>
      <Text style={{ ...typography.small, color: colors.textSecondary, flex: 1, textAlign: 'center' }}>
        {label}
      </Text>
      <View style={{
        minWidth: 36, alignItems: 'center',
        ...(awayHigher ? { backgroundColor: '#3b82f6', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 4 } : {}),
      }}>
        <Text style={{
          fontSize: 14, fontWeight: awayHigher ? '700' : '400',
          color: awayHigher ? '#fff' : colors.foreground,
        }}>
          {away}
        </Text>
      </View>
    </View>
  );
}

function InfoSection({ matchDetail, match, colors, spacing, typography, borderRadius, navigation }: { matchDetail: MatchDetail | null; match: any; colors: any; spacing: any; typography: any; borderRadius: any; navigation: any }) {
  if (!matchDetail) {
    return (
      <View style={{ alignItems: 'center', paddingVertical: spacing.xxl }}>
        <LoadingSpinner fullScreen={false} />
      </View>
    );
  }

  const { stats } = matchDetail;

  const infoRows: { label: string; value: string }[] = [
    { label: 'Competition', value: match.competition.name },
    { label: 'Matchday', value: match.matchday ? `${match.matchday}` : '—' },
    { label: 'Date', value: formatFullDate(match.kickoff) },
    { label: 'Kick-off', value: formatMatchTime(match.kickoff) },
    { label: 'Venue', value: match.venue || '—' },
    ...(matchDetail.attendance ? [{ label: 'Attendance', value: matchDetail.attendance.toLocaleString() }] : []),
    { label: 'Referee', value: matchDetail.referee || '—' },
  ];

  return (
    <View style={{ paddingHorizontal: spacing.md, paddingTop: spacing.sm }}>
      {/* Match Stats — always shown as template, uses real data when available */}
      <View style={{ backgroundColor: colors.card, borderRadius: borderRadius.lg, padding: spacing.md, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.lg }}>
        <Text style={{ ...typography.bodyBold, color: colors.foreground, fontSize: 15, textAlign: 'center', marginBottom: spacing.md }}>
          Match Stats
        </Text>

        {/* Team headers */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm }}>
          <Pressable onPress={() => navigation.navigate('TeamDetail', { teamId: match.homeTeam.id, teamName: match.homeTeam.name, teamCrest: match.homeTeam.crest })} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, opacity: pressed ? 0.7 : 1 })}>
            <TeamLogo uri={match.homeTeam.crest} size={18} />
            <Text style={{ ...typography.caption, color: colors.textSecondary }}>{match.homeTeam.shortName}</Text>
          </Pressable>
          <Pressable onPress={() => navigation.navigate('TeamDetail', { teamId: match.awayTeam.id, teamName: match.awayTeam.name, teamCrest: match.awayTeam.crest })} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, opacity: pressed ? 0.7 : 1 })}>
            <Text style={{ ...typography.caption, color: colors.textSecondary }}>{match.awayTeam.shortName}</Text>
            <TeamLogo uri={match.awayTeam.crest} size={18} />
          </Pressable>
        </View>

        <StatRow label="Ball Possession" home={stats?.ballPossession[0] ?? 0} away={stats?.ballPossession[1] ?? 0} colors={colors} spacing={spacing} typography={typography} isPossession />
        <StatRow label="Expected Goals (xG)" home={0} away={0} colors={colors} spacing={spacing} typography={typography} />
        <StatRow label="Total Shots" home={stats?.shots[0] ?? 0} away={stats?.shots[1] ?? 0} colors={colors} spacing={spacing} typography={typography} />
        <StatRow label="Shots on Target" home={stats?.shotsOnTarget[0] ?? 0} away={stats?.shotsOnTarget[1] ?? 0} colors={colors} spacing={spacing} typography={typography} />
        <StatRow label="Big Chances" home={0} away={0} colors={colors} spacing={spacing} typography={typography} />
        <StatRow label="Big Chances Missed" home={0} away={0} colors={colors} spacing={spacing} typography={typography} />
        <StatRow label="Corners" home={stats?.corners[0] ?? 0} away={stats?.corners[1] ?? 0} colors={colors} spacing={spacing} typography={typography} />
      </View>

      {/* Goals */}
      {matchDetail.goals.length > 0 && (
        <View style={{ marginBottom: spacing.lg }}>
          <Text style={{ ...typography.bodyBold, color: colors.foreground, fontSize: 15, marginBottom: spacing.sm }}>
            Goals
          </Text>
          {matchDetail.goals.map((goal, i) => {
            const isHome = goal.team.id === match.homeTeam.id;
            return (
              <View
                key={i}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingVertical: spacing.xs + 2,
                  gap: spacing.sm,
                }}
              >
                <View style={{ width: 30, alignItems: 'center' }}>
                  <Text style={{ fontSize: 13 }}>⚽</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Pressable onPress={() => navigation.navigate('PersonDetail', { personId: goal.scorer.id, personName: goal.scorer.name, role: 'player' })}>
                    <Text style={{ ...typography.body, color: colors.foreground, fontSize: 14 }}>
                      {goal.scorer.name}
                      <Text style={{ color: colors.textSecondary }}> {goal.minute}'</Text>
                    </Text>
                  </Pressable>
                  {goal.assist && (
                    <Pressable onPress={() => navigation.navigate('PersonDetail', { personId: goal.assist!.id, personName: goal.assist!.name, role: 'player' })}>
                      <Text style={{ ...typography.small, color: colors.textSecondary }}>
                        Assist: {goal.assist.name}
                      </Text>
                    </Pressable>
                  )}
                </View>
                <TeamLogo uri={isHome ? match.homeTeam.crest : match.awayTeam.crest} size={18} />
              </View>
            );
          })}
        </View>
      )}

      {/* Match Information */}
      <View style={{ backgroundColor: colors.card, borderRadius: borderRadius.lg, padding: spacing.md, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.lg }}>
        <Text style={{ ...typography.bodyBold, color: colors.foreground, fontSize: 15, textAlign: 'center', marginBottom: spacing.md }}>
          Match Information
        </Text>
        {infoRows.map((row) => {
          const isCompetition = row.label === 'Competition';
          const Container = isCompetition ? Pressable : View;
          const containerProps = isCompetition
            ? { onPress: () => navigation.navigate('LeagueDetail', { competitionCode: match.competition.code, competitionName: match.competition.name, competitionEmblem: match.competition.emblem }) }
            : {};
          return (
            <Container
              key={row.label}
              {...containerProps}
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                paddingVertical: spacing.sm,
                borderBottomWidth: 1,
                borderBottomColor: colors.border,
              }}
            >
              <Text style={{ ...typography.body, color: colors.textSecondary, fontSize: 14 }}>
                {row.label}
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, flex: 1, justifyContent: 'flex-end', marginLeft: spacing.md }}>
                <Text style={{ ...typography.body, color: isCompetition ? colors.primary : colors.foreground, fontSize: 14, fontWeight: '500', textAlign: 'right' }}>
                  {row.value}
                </Text>
                {isCompetition && <Ionicons name="chevron-forward" size={14} color={colors.primary} />}
              </View>
            </Container>
          );
        })}
      </View>
    </View>
  );
}
