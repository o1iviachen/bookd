import React from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { useMatch } from '../../hooks/useMatches';
import { useReviewsForMatch } from '../../hooks/useReviews';
import { useUserProfile, useToggleWatched, useToggleLiked } from '../../hooks/useUser';
import { TeamLogo } from '../../components/match/TeamLogo';
import { ReviewCard } from '../../components/review/ReviewCard';
import { StarRating } from '../../components/ui/StarRating';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { Button } from '../../components/ui/Button';
import { formatFullDate, formatMatchTime } from '../../utils/formatDate';
import { MatchesStackParamList } from '../../types/navigation';

type Props = NativeStackScreenProps<MatchesStackParamList, 'MatchDetail'>;

export function MatchDetailScreen({ route, navigation }: Props) {
  const { theme } = useTheme();
  const { colors, spacing, typography, borderRadius } = theme;
  const { user } = useAuth();
  const { matchId } = route.params;

  const { data: match, isLoading } = useMatch(matchId);
  const { data: reviews } = useReviewsForMatch(matchId);
  const { data: profile } = useUserProfile(user?.uid || '');
  const toggleWatched = useToggleWatched();
  const toggleLiked = useToggleLiked();

  if (isLoading || !match) {
    return <LoadingSpinner />;
  }

  const isFinished = match.status === 'FINISHED';
  const isLive = match.status === 'IN_PLAY' || match.status === 'PAUSED';

  const isWatched = profile?.watchedMatchIds?.includes(matchId) || false;
  const isLiked = profile?.likedMatchIds?.includes(matchId) || false;
  const hasReview = reviews?.some((r) => r.userId === user?.uid) || false;

  const avgRating = reviews && reviews.length > 0
    ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length)
    : 0;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 100 }}>
        {/* Hero area with gradient */}
        <View style={{ height: 320, backgroundColor: '#1a1f25' }}>
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
          <TeamLogo uri={match.competition.emblem} size={16} />
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

        {/* Action row: Eye, Heart, Star CTA */}
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
            {/* Eye */}
            <Pressable
              onPress={(e) => {
                e.stopPropagation();
                user && toggleWatched.mutate({ userId: user.uid, matchId });
              }}
              hitSlop={8}
            >
              <Ionicons
                name={isWatched ? 'eye' : 'eye-outline'}
                size={24}
                color={isWatched ? colors.primary : colors.textSecondary}
              />
            </Pressable>
            {/* Heart */}
            <Pressable
              onPress={(e) => {
                e.stopPropagation();
                user && toggleLiked.mutate({ userId: user.uid, matchId });
              }}
              hitSlop={8}
            >
              <Ionicons
                name={isLiked ? 'heart' : 'heart-outline'}
                size={24}
                color={isLiked ? '#ef4444' : colors.textSecondary}
              />
            </Pressable>
            {/* Divider */}
            <View style={{ width: 1, height: 24, backgroundColor: colors.border }} />
            {/* CTA text */}
            <View style={{ flex: 1 }}>
              <Text style={{ ...typography.bodyBold, color: colors.foreground }}>
                {hasReview ? 'Edit your review...' : 'Rate or review...'}
              </Text>
              <Text style={{ ...typography.small, color: colors.textSecondary }}>
                Share your thoughts on this match
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
          </Pressable>
        )}

        {/* Reviews section — only show for finished matches */}
        {isFinished && (
          <View style={{ marginTop: spacing.lg, paddingHorizontal: spacing.md }}>
            <Text style={{ ...typography.h4, color: colors.foreground, marginBottom: spacing.sm }}>
              Reviews {reviews && reviews.length > 0 ? `(${reviews.length})` : ''}
            </Text>
            {!reviews || reviews.length === 0 ? (
              <View style={{ alignItems: 'center', paddingVertical: spacing.xl }}>
                <Ionicons name="chatbubbles-outline" size={36} color={colors.textSecondary} />
                <Text style={{ ...typography.body, color: colors.textSecondary, marginTop: spacing.sm }}>
                  No reviews yet. Be the first!
                </Text>
              </View>
            ) : (
              reviews.map((review) => (
                <ReviewCard key={review.id} review={review} />
              ))
            )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
