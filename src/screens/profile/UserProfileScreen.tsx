import React, { useCallback } from 'react';
import { View, Text, ScrollView, Pressable, Linking, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useQueries, useQueryClient } from '@tanstack/react-query';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { useUserProfile, useFollowUser, useUnfollowUser } from '../../hooks/useUser';
import { useReviewsForUser, useLikedReviews } from '../../hooks/useReviews';
import { useListsForUser, useLikedLists } from '../../hooks/useLists';
import { getMatchById } from '../../services/matchService';
import { Avatar } from '../../components/ui/Avatar';
import { TeamLogo } from '../../components/match/TeamLogo';
import { MatchPosterCard } from '../../components/match/MatchPosterCard';
import { StarRating } from '../../components/ui/StarRating';
import { Button } from '../../components/ui/Button';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { ScreenHeader } from '../../components/ui/ScreenHeader';
import { RatingChart } from '../../components/profile/RatingChart';
import { POPULAR_TEAMS } from '../../utils/constants';
import { Match } from '../../types/match';

export function UserProfileScreen({ route, navigation }: any) {
  const { theme, isDark } = useTheme();
  const { colors, spacing, typography, borderRadius } = theme;
  const { userId } = route.params;
  const { user: currentUser } = useAuth();
  const { width: screenWidth } = useWindowDimensions();
  const { data: profile, isLoading } = useUserProfile(userId);
  const { data: currentProfile } = useUserProfile(currentUser?.uid || '');
  const { data: reviews } = useReviewsForUser(userId);
  const { data: lists } = useListsForUser(userId);
  const { data: likedReviews } = useLikedReviews(userId);
  const { data: likedLists } = useLikedLists(userId);
  const queryClient = useQueryClient();
  const followMutation = useFollowUser();
  const unfollowMutation = useUnfollowUser();

  const isOwnProfile = currentUser?.uid === userId;
  const isFollowing = currentProfile?.following?.includes(userId) || false;

  // Favourite matches
  const favoriteMatchIds = profile?.favoriteMatchIds || [];
  const favoriteMatchQueries = useQueries({
    queries: favoriteMatchIds.map((id: number) => ({
      queryKey: ['match', id],
      queryFn: () => getMatchById(id),
      staleTime: 5 * 60 * 1000,
      enabled: favoriteMatchIds.length > 0,
    })),
  });
  const favoriteMatches = favoriteMatchQueries
    .filter((q) => q.data != null)
    .map((q) => q.data as Match);

  // Recent activity — one card per match, deduped
  const seenMatchIds = new Set<number>();
  const recentReviews = (reviews || [])
    .filter((r) => {
      const id = Number(r.matchId);
      if (seenMatchIds.has(id)) return false;
      seenMatchIds.add(id);
      return true;
    })
    .slice(0, 4);
  const recentMatchIds = [...new Set(recentReviews.map((r) => r.matchId))];
  const recentMatchQueries = useQueries({
    queries: recentMatchIds.map((id) => ({
      queryKey: ['match', id],
      queryFn: () => getMatchById(id),
      staleTime: 5 * 60 * 1000,
      enabled: recentMatchIds.length > 0,
    })),
  });
  const recentMatchMap = new Map<number, Match>();
  recentMatchQueries.forEach((q) => {
    if (q.data) recentMatchMap.set(Number(q.data.id), q.data);
  });

  const GAP = spacing.sm;
  const HORIZONTAL_PADDING = spacing.md;
  const NUM_COLUMNS = 3;
  const CARD_WIDTH = (screenWidth - HORIZONTAL_PADDING * 2 - GAP * (NUM_COLUMNS - 1)) / NUM_COLUMNS;

  const handleMatchPress = useCallback((matchId: number) => {
    const allUserReviews = reviews || [];
    const userReviewsForMatch = allUserReviews.filter((r) => Number(r.matchId) === Number(matchId));
    if (userReviewsForMatch.length === 1) {
      navigation.navigate('ReviewDetail', { reviewId: userReviewsForMatch[0].id });
    } else if (userReviewsForMatch.length > 1) {
      navigation.navigate('UserMatchReviews', { matchId, userId, username: profile?.username || '' });
    } else {
      navigation.navigate('MatchDetail', { matchId });
    }
  }, [reviews, navigation, userId, profile]);

  const handleFollowToggle = async () => {
    if (!currentUser || followMutation.isPending || unfollowMutation.isPending) return;

    // Wait for any in-flight refetches to finish cancelling so they can't
    // overwrite the cache updates below
    await queryClient.cancelQueries({ queryKey: ['user', currentUser.uid] });
    await queryClient.cancelQueries({ queryKey: ['user', userId] });

    if (isFollowing) {
      // Update both caches — button, counts, and all derived state update together
      queryClient.setQueryData(['user', currentUser.uid], (old: any) => {
        if (!old) return old;
        return { ...old, following: (old.following || []).filter((id: string) => id !== userId) };
      });
      queryClient.setQueryData(['user', userId], (old: any) => {
        if (!old) return old;
        return { ...old, followers: (old.followers || []).filter((id: string) => id !== currentUser.uid) };
      });
      unfollowMutation.mutate({ currentUserId: currentUser.uid, targetUserId: userId });
    } else {
      queryClient.setQueryData(['user', currentUser.uid], (old: any) => {
        if (!old) return old;
        return { ...old, following: [...new Set([...(old.following || []), userId])] };
      });
      queryClient.setQueryData(['user', userId], (old: any) => {
        if (!old) return old;
        return { ...old, followers: [...new Set([...(old.followers || []), currentUser.uid])] };
      });
      followMutation.mutate({
        currentUserId: currentUser.uid,
        targetUserId: userId,
        senderInfo: { username: currentProfile?.username || 'Someone', avatar: currentProfile?.avatar || null },
      });
    }
  };

  if (isLoading || !profile) return <LoadingSpinner />;

  // Team crests
  const followedTeamCrests = (profile?.followedTeamIds || []).map((id: string) => {
    const team = POPULAR_TEAMS.find((t) => t.id === id);
    return team ? { id: team.id, name: team.name, crest: team.crest } : null;
  }).filter(Boolean) as { id: string; name: string; crest: string }[];

  const navLinks: { label: string; count: number | string; icon: keyof typeof Ionicons.glyphMap; screen: string }[] = [
    { label: 'Matches', count: `${new Set((reviews || []).map((r) => r.matchId)).size} this year`, icon: 'football-outline', screen: 'Games' },
    { label: 'Diary', count: reviews?.length || 0, icon: 'book-outline', screen: 'Diary' },
    { label: 'Reviews', count: (reviews || []).filter((r) => r.text?.trim().length > 0).length, icon: 'reorder-three-outline', screen: 'Reviews' },
    { label: 'Lists', count: lists?.length || 0, icon: 'list-outline', screen: 'MyLists' },
    { label: 'Likes', count: (profile?.likedMatchIds?.length || 0) + (likedReviews?.length || 0) + (likedLists?.length || 0), icon: 'heart-outline', screen: 'Likes' },
    { label: 'Tags', count: new Set((reviews || []).flatMap((r) => r.tags)).size, icon: 'pricetag-outline', screen: 'Tags' },
  ];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      <ScreenHeader title={profile.username} onBack={() => navigation.goBack()} />

      <ScrollView indicatorStyle={isDark ? 'white' : 'default'} contentContainerStyle={{ paddingBottom: 60 }}>
        {/* Avatar + name */}
        <View style={{ alignItems: 'center', paddingTop: spacing.lg, paddingHorizontal: spacing.md }}>
          <Avatar uri={profile.avatar} name={profile.displayName} size={96} />
          <Text style={{ ...typography.h3, color: colors.foreground, marginTop: spacing.sm }}>
            {profile.displayName}
          </Text>
          <Text style={{ ...typography.caption, color: colors.textSecondary }}>
            @{profile.username}
          </Text>
        </View>

        {/* Favourite team badges */}
        {followedTeamCrests.length > 0 && (
          <View style={{ flexDirection: 'row', justifyContent: 'center', gap: spacing.sm, marginTop: spacing.sm }}>
            {followedTeamCrests.map((club) => (
              <Pressable
                key={club.id}
                onPress={() => navigation.navigate('TeamDetail', { teamId: Number(club.id), teamName: club.name, teamCrest: club.crest })}
              >
                <TeamLogo uri={club.crest} size={28} />
              </Pressable>
            ))}
          </View>
        )}

        {/* Bio */}
        {profile.bio ? (
          <Text style={{ ...typography.body, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.sm, paddingHorizontal: spacing.xl }}>
            {profile.bio}
          </Text>
        ) : null}

        {/* Location & Website */}
        {(profile.location || profile.website) && (
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: spacing.xs, gap: spacing.sm, maxWidth: 280, alignSelf: 'center' }}>
            {profile.location ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                <Ionicons name="location-outline" size={14} color={colors.textSecondary} />
                <Text style={{ fontSize: 14, color: colors.textSecondary }}>{profile.location}</Text>
              </View>
            ) : null}
            {profile.location && profile.website ? (
              <Text style={{ fontSize: 14, color: colors.textSecondary }}>·</Text>
            ) : null}
            {profile.website ? (
              <Pressable
                onPress={() => {
                  const url = profile.website.startsWith('http') ? profile.website : `https://${profile.website}`;
                  Linking.openURL(url);
                }}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 4, flexShrink: 1, minWidth: 0 }}
              >
                <Ionicons name="link-outline" size={14} color={colors.primary} style={{ flexShrink: 0 }} />
                <Text numberOfLines={1} style={{ fontSize: 14, color: colors.primary, flexShrink: 1 }}>
                  {profile.website.replace(/^https?:\/\//, '').replace(/\/$/, '')}
                </Text>
              </Pressable>
            ) : null}
          </View>
        )}

        {/* Follow button */}
        {!isOwnProfile && (
          <View style={{ alignItems: 'center', marginTop: spacing.md }}>
            <Button
              title={isFollowing ? 'Following' : 'Follow'}
              onPress={handleFollowToggle}
              variant={isFollowing ? 'outline' : 'primary'}
              size="sm"
              loading={followMutation.isPending || unfollowMutation.isPending}
            />
          </View>
        )}

        {/* Stats row — Instagram-style */}
        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: spacing.xxl, marginTop: spacing.sm, paddingVertical: spacing.sm }}>
          <Pressable onPress={() => navigation.navigate('FollowList', { userIds: profile.following || [], title: 'Following' })} style={{ alignItems: 'center' }}>
            <Text style={{ ...typography.h4, color: colors.foreground }}>{profile.following?.length || 0}</Text>
            <Text style={{ ...typography.small, color: colors.textSecondary }}>Following</Text>
          </Pressable>
          <Pressable onPress={() => navigation.navigate('FollowList', { userIds: profile.followers || [], title: 'Followers' })} style={{ alignItems: 'center' }}>
            <Text style={{ ...typography.h4, color: colors.foreground }}>{profile.followers?.length || 0}</Text>
            <Text style={{ ...typography.small, color: colors.textSecondary }}>Followers</Text>
          </Pressable>
        </View>

        {/* Favourite Matches */}
        {favoriteMatches.length > 0 && (
          <View style={{ marginTop: spacing.md, paddingHorizontal: HORIZONTAL_PADDING, paddingVertical: spacing.md, backgroundColor: `${colors.accent}30`, borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.border }}>
            <Text style={{ fontSize: 11, fontWeight: '600', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 1, marginBottom: spacing.sm }}>
              Favourite Matches
            </Text>
            {favoriteMatchQueries.some((q) => q.isLoading) ? (
              <View style={{ paddingVertical: spacing.lg, alignItems: 'center' }}>
                <LoadingSpinner fullScreen={false} />
              </View>
            ) : (
              <View style={{ flexDirection: 'row', gap: GAP }}>
                {favoriteMatches.map((match) => (
                  <MatchPosterCard
                    key={match.id}
                    match={match}
                    onPress={() => handleMatchPress(match.id)}
                    width={CARD_WIDTH}
                  />
                ))}
              </View>
            )}
          </View>
        )}

        {/* Recent Activity */}
        {recentReviews.length > 0 && (
          <View style={{ paddingHorizontal: HORIZONTAL_PADDING, paddingVertical: spacing.md, backgroundColor: `${colors.accent}30`, borderColor: colors.border }}>
            <Text style={{ fontSize: 11, fontWeight: '600', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 1, marginBottom: spacing.sm }}>
              Recent Activity
            </Text>
            {recentMatchQueries.some((q) => q.isLoading) && recentMatchMap.size === 0 ? (
              <View style={{ paddingVertical: spacing.lg, alignItems: 'center' }}>
                <LoadingSpinner fullScreen={false} />
              </View>
            ) : (
              <View style={{ flexDirection: 'row', gap: GAP }}>
                {recentReviews.map((review) => {
                  const match = recentMatchMap.get(Number(review.matchId));
                  const hasText = review.text.trim().length > 0;
                  const hasMedia = review.media && review.media.length > 0;
                  const reviewCount = (reviews || []).filter((r) => Number(r.matchId) === Number(review.matchId)).length;
                  const isLog = review.rating === 0 && !review.text?.trim() && !review.tags?.length && !review.media?.length;
                  const handlePress = () => reviewCount > 1
                    ? navigation.navigate('UserMatchReviews', { matchId: Number(review.matchId), userId, username: profile?.username || '' })
                    : isLog
                      ? navigation.navigate('MatchDetail', { matchId: Number(review.matchId) })
                      : navigation.navigate('ReviewDetail', { reviewId: review.id });
                  return match ? (
                    <View key={review.id} style={{ width: CARD_WIDTH }}>
                      <MatchPosterCard
                        match={match}
                        onPress={handlePress}
                        width={CARD_WIDTH}
                      />
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 4 }}>
                        {review.rating > 0 && <StarRating rating={review.rating} size={10} />}
                        {hasText && (
                          <Ionicons name="reorder-three-outline" size={12} color={colors.textSecondary} style={{ marginLeft: 1 }} />
                        )}
                        {hasMedia && (
                          <Ionicons name="image-outline" size={10} color={colors.textSecondary} style={{ marginLeft: 1 }} />
                        )}
                      </View>
                    </View>
                  ) : null;
                })}
              </View>
            )}
          </View>
        )}

        {/* Rating distribution */}
        {reviews && reviews.length > 0 && <RatingChart reviews={reviews} />}

        {/* Navigation links */}
        <View style={{ marginTop: spacing.md, paddingHorizontal: spacing.md }}>
          <View style={{ backgroundColor: colors.card, borderRadius: borderRadius.md, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' }}>
            {navLinks.map((link, i) => (
              <Pressable
                key={link.label}
                onPress={() => navigation.navigate(link.screen, { userId })}
                style={({ pressed }) => ({
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingVertical: spacing.md,
                  paddingHorizontal: spacing.md,
                  borderTopWidth: i > 0 ? 1 : 0,
                  borderTopColor: colors.border,
                  backgroundColor: pressed ? colors.accent : 'transparent',
                })}
              >
                <Text style={{ ...typography.body, color: colors.foreground }}>{link.label}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
                  <Text style={{ ...typography.caption, color: colors.textSecondary }}>{link.count}</Text>
                  <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
                </View>
              </Pressable>
            ))}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
