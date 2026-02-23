import React, { useState, useMemo } from 'react';
import { View, Text, ScrollView, Pressable, Share } from 'react-native';
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
import { useUserProfile } from '../../hooks/useUser';
import { TeamLogo } from '../../components/match/TeamLogo';
import { ReviewCard } from '../../components/review/ReviewCard';
import { StarRating } from '../../components/ui/StarRating';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { Button } from '../../components/ui/Button';
import { AddToListModal } from '../../components/list/AddToListModal';
import { formatFullDate, formatMatchTime } from '../../utils/formatDate';
import { getStadiumImageUrl } from '../../utils/stadiumImages';
import { MatchesStackParamList } from '../../types/navigation';

type Props = NativeStackScreenProps<MatchesStackParamList, 'MatchDetail'>;

const FALLBACK_STADIUM = 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d2/London_Wembley.jpg/1280px-London_Wembley.jpg';

export function MatchDetailScreen({ route, navigation }: Props) {
  const { theme } = useTheme();
  const { colors, spacing, typography, borderRadius } = theme;
  const { user } = useAuth();
  const { matchId } = route.params;
  const [showListModal, setShowListModal] = useState(false);

  const { data: match, isLoading } = useMatch(matchId);
  const { data: reviews } = useReviewsForMatch(matchId);
  const { data: profile } = useUserProfile(user?.uid || '');

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
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 100 }}>
        {/* Hero area with stadium background */}
        <View style={{ height: 320, backgroundColor: '#1a1f25' }}>
          {/* Stadium background image */}
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
          {/* Dark overlay for readability */}
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
            <View style={{ flex: 1, backgroundColor: '#3b82f6', borderRadius: borderRadius.md, padding: spacing.md, alignItems: 'center' }}>
              <Text style={{ fontSize: 24, fontWeight: '700', color: '#fff' }}>{avgRating.toFixed(1)}</Text>
              <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.8)' }}>Avg Rating</Text>
            </View>
          </View>
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

        {/* Action icons row: Add to List + Share */}
        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: spacing.lg, paddingVertical: spacing.sm, marginTop: spacing.xs }}>
          <Pressable
            onPress={() => setShowListModal(true)}
            hitSlop={8}
            style={{ alignItems: 'center', gap: 2 }}
          >
            <Ionicons name="list-outline" size={22} color={colors.textSecondary} />
            <Text style={{ fontSize: 10, color: colors.textSecondary }}>List</Text>
          </Pressable>
          <Pressable
            onPress={handleShare}
            hitSlop={8}
            style={{ alignItems: 'center', gap: 2 }}
          >
            <Ionicons name="share-outline" size={22} color={colors.textSecondary} />
            <Text style={{ fontSize: 10, color: colors.textSecondary }}>Share</Text>
          </Pressable>
        </View>

        {/* Reviews section — only show for finished matches */}
        {isFinished && (
          <ReviewsSection reviews={reviews || []} userId={user?.uid} profile={profile} colors={colors} spacing={spacing} typography={typography} borderRadius={borderRadius} />
        )}
      </ScrollView>

      {/* Add to List Modal */}
      <AddToListModal
        visible={showListModal}
        onClose={() => setShowListModal(false)}
        matchId={matchId}
      />
    </SafeAreaView>
  );
}

type ReviewFilter = 'everyone' | 'friends' | 'you';
type ReviewSort = 'recent' | 'popular' | 'highest' | 'lowest';

function ReviewsSection({ reviews, userId, profile, colors, spacing, typography, borderRadius }: any) {
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
          <ReviewCard key={review.id} review={review} />
        ))
      )}
    </View>
  );
}
