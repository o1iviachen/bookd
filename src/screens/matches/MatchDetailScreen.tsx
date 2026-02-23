import React, { useState, useMemo, useRef } from 'react';
import { View, Text, Pressable, Share, Modal, Animated } from 'react-native';
import { Select } from '../../components/ui/Select';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { useMatch } from '../../hooks/useMatches';
import { useReviewsForMatch } from '../../hooks/useReviews';
import { useCommentsForReview } from '../../hooks/useComments';
import { useUserProfile } from '../../hooks/useUser';
import { useListsForMatch } from '../../hooks/useLists';
import { TeamLogo } from '../../components/match/TeamLogo';
import { ReviewCard } from '../../components/review/ReviewCard';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { AddToListModal } from '../../components/list/AddToListModal';
import { formatFullDate, formatMatchTime } from '../../utils/formatDate';
import { getStadiumImageUrl } from '../../utils/stadiumImages';
import { MatchesStackParamList } from '../../types/navigation';

type Props = NativeStackScreenProps<MatchesStackParamList, 'MatchDetail'>;

const FALLBACK_STADIUM = 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d2/London_Wembley.jpg/1280px-London_Wembley.jpg';

export function MatchDetailScreen({ route, navigation }: Props) {
  const { theme, isDark } = useTheme();
  const { colors, spacing, typography, borderRadius } = theme;
  const { user } = useAuth();
  const { matchId } = route.params;
  const [showListModal, setShowListModal] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const scrollY = useRef(new Animated.Value(0)).current;

  const { data: match, isLoading } = useMatch(matchId);
  const { data: reviews } = useReviewsForMatch(matchId);
  const { data: profile } = useUserProfile(user?.uid || '');
  const { data: matchLists } = useListsForMatch(matchId);

  if (isLoading || !match) {
    return <LoadingSpinner />;
  }

  const isFinished = match.status === 'FINISHED';
  const isLive = match.status === 'IN_PLAY' || match.status === 'PAUSED';

  const userReviews = reviews?.filter((r) => r.userId === user?.uid) || [];
  const hasReview = userReviews.length > 0;

  const avgRating = reviews && reviews.length > 0
    ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length)
    : 0;

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
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      <Animated.ScrollView
        indicatorStyle={isDark ? 'white' : 'default'}
        contentContainerStyle={{ paddingBottom: 100 }}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: true }
        )}
        scrollEventThrottle={16}
      >
        {/* Hero area with stadium background */}
        <View style={{ height: 320, backgroundColor: '#1a1f25', overflow: 'visible' }}>
          {/* Stretchy stadium image — expands when pulling down */}
          <Animated.View
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: 320,
              transform: [
                {
                  translateY: scrollY.interpolate({
                    inputRange: [-320, 0],
                    outputRange: [-160, 0],
                    extrapolateRight: 'clamp',
                  }),
                },
                {
                  scale: scrollY.interpolate({
                    inputRange: [-320, 0],
                    outputRange: [2, 1],
                    extrapolateRight: 'clamp',
                  }),
                },
              ],
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
          </Animated.View>

          {/* Back button overlay */}
          <Pressable
            onPress={() => navigation.goBack()}
            style={{
              position: 'absolute',
              top: spacing.md,
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
              top: spacing.md,
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
              alignItems: 'center',
              justifyContent: 'center',
              gap: spacing.xxl,
              paddingTop: spacing.xl,
            }}
          >
            <TeamLogo uri={match.homeTeam.crest} size={80} />
            <TeamLogo uri={match.awayTeam.crest} size={80} />
          </View>

          {/* Gradient overlay at bottom of hero */}
          <LinearGradient
            colors={['transparent', `${colors.background}cc`, colors.background]}
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              height: 160,
              justifyContent: 'flex-end',
              alignItems: 'center',
              paddingBottom: spacing.md,
            }}
          >
            {/* Score */}
            {(isFinished || isLive) ? (
              <>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
                  <Text style={{ ...typography.bodyBold, color: colors.foreground, fontSize: 16 }}>
                    {match.homeTeam.shortName}
                  </Text>
                  <Text style={{ fontSize: 40, fontWeight: '700', color: colors.primary }}>
                    {match.homeScore} - {match.awayScore}
                  </Text>
                  <Text style={{ ...typography.bodyBold, color: colors.foreground, fontSize: 16 }}>
                    {match.awayTeam.shortName}
                  </Text>
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
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
                  <Text style={{ ...typography.bodyBold, color: colors.foreground }}>
                    {match.homeTeam.shortName}
                  </Text>
                  <Text style={{ ...typography.h2, color: colors.textSecondary }}>vs</Text>
                  <Text style={{ ...typography.bodyBold, color: colors.foreground }}>
                    {match.awayTeam.shortName}
                  </Text>
                </View>
                <Text style={{ ...typography.caption, color: colors.textSecondary, marginTop: 4 }}>
                  {formatMatchTime(match.kickoff)}
                </Text>
              </>
            )}
          </LinearGradient>
        </View>

        {/* Competition + date */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs, paddingVertical: spacing.sm }}>
          <View style={{ backgroundColor: '#fff', borderRadius: 4, padding: 2 }}>
            <TeamLogo uri={match.competition.emblem} size={16} />
          </View>
          <Text style={{ ...typography.caption, color: colors.textSecondary }}>
            {match.competition.name} · {formatFullDate(match.kickoff)}
          </Text>
        </View>

        {/* Stats row */}
        {isFinished && reviews && reviews.length > 0 && (
          <View style={{ flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.md, marginTop: spacing.sm }}>
            <View style={{ flex: 1, backgroundColor: colors.primary, borderRadius: borderRadius.md, padding: spacing.md, alignItems: 'center' }}>
              <Text style={{ fontSize: 24, fontWeight: '700', color: '#14181c' }}>{reviews.length}</Text>
              <Text style={{ fontSize: 11, color: '#14181c', fontWeight: '500' }}>Watched</Text>
            </View>
            <View style={{ flex: 1, backgroundColor: colors.muted, borderRadius: borderRadius.md, padding: spacing.md, alignItems: 'center' }}>
              <Text style={{ fontSize: 24, fontWeight: '700', color: colors.foreground }}>{reviews.length}</Text>
              <Text style={{ fontSize: 11, color: colors.textSecondary }}>Reviews</Text>
            </View>
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
          <RatingBarChart reviews={reviews} colors={colors} spacing={spacing} typography={typography} borderRadius={borderRadius} avgRating={avgRating} />
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


        {/* Reviews section — only show for finished matches */}
        {isFinished && (
          <ReviewsSection reviews={reviews || []} userId={user?.uid} profile={profile} colors={colors} spacing={spacing} typography={typography} borderRadius={borderRadius} navigation={navigation} />
        )}
      </Animated.ScrollView>

      {/* Three-dot menu */}
      <Modal visible={showMenu} transparent animationType="fade" onRequestClose={() => setShowMenu(false)}>
        <Pressable
          onPress={() => setShowMenu(false)}
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: spacing.xl }}
        >
          <Pressable
            onPress={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: 280,
              backgroundColor: colors.card,
              borderRadius: borderRadius.lg,
              overflow: 'hidden',
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 8 },
              shadowOpacity: 0.3,
              shadowRadius: 16,
              elevation: 12,
            }}
          >
            <Pressable
              onPress={() => { setShowMenu(false); setShowListModal(true); }}
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.sm,
                paddingHorizontal: spacing.md,
                paddingVertical: spacing.md,
                backgroundColor: pressed ? colors.muted : 'transparent',
                borderBottomWidth: 1,
                borderBottomColor: colors.border,
              })}
            >
              <Ionicons name="list-outline" size={20} color={colors.foreground} />
              <Text style={{ ...typography.body, color: colors.foreground }}>Add to list</Text>
            </Pressable>
            <Pressable
              onPress={() => { setShowMenu(false); handleShare(); }}
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.sm,
                paddingHorizontal: spacing.md,
                paddingVertical: spacing.md,
                backgroundColor: pressed ? colors.muted : 'transparent',
              })}
            >
              <Ionicons name="share-outline" size={20} color={colors.foreground} />
              <Text style={{ ...typography.body, color: colors.foreground }}>Share</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Add to List Modal */}
      <AddToListModal
        visible={showListModal}
        onClose={() => setShowListModal(false)}
        matchId={matchId}
      />
    </SafeAreaView>
  );
}

/* ─── Rating distribution bar chart ─── */

function RatingBarChart({ reviews, colors, spacing, typography, borderRadius, avgRating }: any) {
  const [activeBar, setActiveBar] = useState<number | null>(null);

  // 10 buckets: 0.5, 1.0, 1.5, 2.0, 2.5, 3.0, 3.5, 4.0, 4.5, 5.0
  const HALF_STARS = [0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5];
  const counts = new Array(10).fill(0);
  let ratedCount = 0;
  for (const r of reviews) {
    if (r.rating > 0) {
      // Snap to nearest half star
      const snapped = Math.round(r.rating * 2) / 2;
      const idx = HALF_STARS.indexOf(snapped);
      if (idx >= 0) counts[idx]++;
      ratedCount++;
    }
  }
  const maxCount = Math.max(...counts, 1);

  return (
    <View style={{ marginHorizontal: spacing.md, marginTop: spacing.md, backgroundColor: colors.card, borderRadius: borderRadius.lg, padding: spacing.md, borderWidth: 1, borderColor: colors.border }}>
      {/* Header — swaps to held bar's stats */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md }}>
        <Text style={{ ...typography.bodyBold, color: colors.foreground, fontSize: 15 }}>Ratings</Text>
        {activeBar !== null && counts[activeBar] > 0 ? (
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={{ fontSize: 16, lineHeight: 28, fontWeight: '700', color: colors.primary, letterSpacing: -0.5 }}>
              {'★'.repeat(Math.floor(HALF_STARS[activeBar]))}{HALF_STARS[activeBar] % 1 !== 0 ? '½' : ''}
            </Text>
            <Text style={{ fontSize: 11, color: colors.textSecondary }}>{counts[activeBar]} {counts[activeBar] === 1 ? 'rating' : 'ratings'}</Text>
          </View>
        ) : (
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={{ fontSize: 22, lineHeight: 28, fontWeight: '700', color: colors.foreground }}>{avgRating.toFixed(1)}</Text>
            <Text style={{ fontSize: 11, color: colors.textSecondary }}>{ratedCount} {ratedCount === 1 ? 'rating' : 'ratings'}</Text>
          </View>
        )}
      </View>

      {/* Bars */}
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', height: 48, gap: 2 }}>
        {counts.map((count, i) => {
          const heightPct = count > 0 ? (count / maxCount) * 100 : 4;
          const isActive = activeBar === i;
          return (
            <Pressable
              key={i}
              onPressIn={() => setActiveBar(i)}
              onPressOut={() => setActiveBar(null)}
              style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-end', height: '100%' }}
            >
              <View
                style={{
                  width: '100%',
                  height: `${heightPct}%`,
                  backgroundColor: isActive ? colors.primary : count > 0 ? colors.muted : `${colors.muted}60`,
                  borderRadius: 2,
                  minHeight: 3,
                }}
              />
            </Pressable>
          );
        })}
      </View>

      {/* Star labels — show only whole numbers */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
        {HALF_STARS.map((val, i) => (
          <View key={i} style={{ flex: 1, alignItems: 'center' }}>
            {val % 1 === 0 ? (
              <Text style={{ fontSize: 9, color: colors.textSecondary }}>{val}</Text>
            ) : null}
          </View>
        ))}
      </View>
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
    let filtered = [...reviews];

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
