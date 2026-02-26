import React, { useCallback } from 'react';
import { View, Text, ScrollView, Pressable, Linking, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { useQueries } from '@tanstack/react-query';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { useUserProfile } from '../../hooks/useUser';
import { useReviewsForUser } from '../../hooks/useReviews';
import { useListsForUser } from '../../hooks/useLists';
import { getMatchById } from '../../services/matchService';
import { Avatar } from '../../components/ui/Avatar';
import { TeamLogo } from '../../components/match/TeamLogo';
import { MatchPosterCard } from '../../components/match/MatchPosterCard';
import { StarRating } from '../../components/ui/StarRating';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { RatingChart } from '../../components/profile/RatingChart';
import { ProfileStackParamList } from '../../types/navigation';
import { POPULAR_TEAMS } from '../../utils/constants';
import { Match } from '../../types/match';

type Nav = NativeStackNavigationProp<ProfileStackParamList, 'Profile'>;

export function ProfileScreen() {
  const { theme, isDark } = useTheme();
  const { colors, spacing, typography, borderRadius } = theme;
  const navigation = useNavigation<Nav>();
  const { user } = useAuth();
  const { width: screenWidth } = useWindowDimensions();
  const { data: profile, isLoading } = useUserProfile(user?.uid || '');
  const { data: reviews } = useReviewsForUser(user?.uid || '');
  const { data: lists } = useListsForUser(user?.uid || '');

  const favoriteMatchIds = profile?.favoriteMatchIds || [];
  const favoriteMatchQueries = useQueries({
    queries: favoriteMatchIds.map((id) => ({
      queryKey: ['match', id],
      queryFn: () => getMatchById(id),
      staleTime: 5 * 60 * 1000,
      enabled: favoriteMatchIds.length > 0,
    })),
  });
  const favoriteMatches = favoriteMatchQueries
    .filter((q) => q.data != null)
    .map((q) => q.data as Match);

  // Recent activity: fetch match data for the user's most recent reviews
  const recentReviews = (reviews || []).slice(0, 3);
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
    if (q.data) recentMatchMap.set(q.data.id, q.data);
  });

  const GAP = spacing.sm;
  const HORIZONTAL_PADDING = spacing.md;
  const NUM_COLUMNS = 3;
  const CARD_WIDTH = (screenWidth - HORIZONTAL_PADDING * 2 - GAP * (NUM_COLUMNS - 1)) / NUM_COLUMNS;

  // Navigate based on how many reviews the user has for a match
  const handleMatchPress = useCallback((matchId: number) => {
    const allUserReviews = reviews || [];
    const userReviewsForMatch = allUserReviews.filter((r) => r.matchId === matchId);
    if (userReviewsForMatch.length === 1) {
      navigation.navigate('ReviewDetail', { reviewId: userReviewsForMatch[0].id });
    } else if (userReviewsForMatch.length > 1) {
      navigation.navigate('MatchDetail', { matchId });
    } else {
      navigation.navigate('MatchDetail', { matchId });
    }
  }, [reviews, navigation]);

  if (isLoading) return <LoadingSpinner />;

  // Get crests for followed teams
  const followedTeamCrests = (profile?.followedTeamIds || []).map((id) => {
    const team = POPULAR_TEAMS.find((t) => t.id === id);
    return team ? { id: team.id, name: team.name, crest: team.crest } : null;
  }).filter(Boolean) as { id: string; name: string; crest: string }[];

  const navLinks: { label: string; count: number | string; icon: keyof typeof Ionicons.glyphMap }[] = [
    { label: 'Games', count: `${reviews?.length || 0} this year`, icon: 'football-outline' },
    { label: 'Diary', count: reviews?.length || 0, icon: 'book-outline' },
    { label: 'Reviews', count: reviews?.length || 0, icon: 'reorder-three-outline' },
    { label: 'Lists', count: lists?.length || 0, icon: 'list-outline' },
    { label: 'Likes', count: profile?.likedMatchIds?.length || 0, icon: 'heart-outline' },
    { label: 'Tags', count: new Set((reviews || []).flatMap((r) => r.tags)).size, icon: 'pricetag-outline' },
  ];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      {/* Header bar */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border }}>
        <View style={{ width: 32 }} />
        <Text style={{ ...typography.bodyBold, color: colors.foreground, fontSize: 17 }}>
          {profile?.username || 'Profile'}
        </Text>
        <Pressable onPress={() => navigation.navigate('Settings')}>
          <Ionicons name="settings-outline" size={22} color={colors.foreground} />
        </Pressable>
      </View>

      <ScrollView indicatorStyle={isDark ? 'white' : 'default'} contentContainerStyle={{ paddingBottom: spacing.md }}>
        {/* Avatar + name */}
        <View style={{ alignItems: 'center', paddingTop: spacing.lg, paddingHorizontal: spacing.md }}>
          <Avatar uri={profile?.avatar || null} name={profile?.displayName || 'User'} size={96} />
          <Text style={{ ...typography.h3, color: colors.foreground, marginTop: spacing.sm }}>
            {profile?.displayName || 'User'}
          </Text>
          <Text style={{ ...typography.caption, color: colors.textSecondary }}>
            @{profile?.username || 'username'}
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
        {profile?.bio ? (
          <Text style={{ ...typography.body, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.sm, paddingHorizontal: spacing.xl }}>
            {profile.bio}
          </Text>
        ) : null}

        {/* Location & Website */}
        {(profile?.location || profile?.website) && (
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: spacing.xs, gap: spacing.sm, maxWidth: 280, alignSelf: 'center' }}>
            {profile?.location ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                <Ionicons name="location-outline" size={14} color={colors.textSecondary} />
                <Text style={{ fontSize: 14, color: colors.textSecondary }}>{profile.location}</Text>
              </View>
            ) : null}
            {profile?.location && profile?.website ? (
              <Text style={{ fontSize: 14, color: colors.textSecondary }}>·</Text>
            ) : null}
            {profile?.website ? (
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

        {/* Stats row — Instagram-style */}
        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: spacing.xxl, marginTop: spacing.sm, paddingVertical: spacing.sm }}>
          <Pressable onPress={() => navigation.navigate('FollowList', { userIds: profile?.following || [], title: 'Following' })} style={{ alignItems: 'center' }}>
            <Text style={{ ...typography.h4, color: colors.foreground }}>{profile?.following?.length || 0}</Text>
            <Text style={{ ...typography.small, color: colors.textSecondary }}>Following</Text>
          </Pressable>
          <Pressable onPress={() => navigation.navigate('FollowList', { userIds: profile?.followers || [], title: 'Followers' })} style={{ alignItems: 'center' }}>
            <Text style={{ ...typography.h4, color: colors.foreground }}>{profile?.followers?.length || 0}</Text>
            <Text style={{ ...typography.small, color: colors.textSecondary }}>Followers</Text>
          </Pressable>
        </View>

        {/* Favourite Matches */}
        <View style={{ marginTop: spacing.md, paddingHorizontal: HORIZONTAL_PADDING, paddingVertical: spacing.md, backgroundColor: `${colors.accent}30`, borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.border }}>
          <Text style={{ fontSize: 11, fontWeight: '600', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 1, marginBottom: spacing.sm }}>
            Favourite Matches
          </Text>
          {favoriteMatchIds.length > 0 && favoriteMatchQueries.some((q) => q.isLoading) ? (
            <View style={{ paddingVertical: spacing.lg, alignItems: 'center' }}>
              <LoadingSpinner fullScreen={false} />
            </View>
          ) : favoriteMatches.length > 0 ? (
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
          ) : (
            <Pressable
              onPress={() => navigation.navigate('FavouriteMatches')}
              style={{
                width: CARD_WIDTH,
                height: CARD_WIDTH * 1.5,
                borderRadius: 4,
                borderWidth: 2,
                borderStyle: 'dashed',
                borderColor: colors.border,
                alignItems: 'center',
                justifyContent: 'center',
                gap: spacing.xs,
              }}
            >
              <Ionicons name="add" size={22} color={colors.textSecondary} />
              <Text style={{ ...typography.caption, color: colors.textSecondary, fontSize: 9 }}>
                Add favourites
              </Text>
            </Pressable>
          )}
        </View>

        {/* Recent Activity */}
        {recentReviews.length > 0 && (
          <View style={{ paddingHorizontal: HORIZONTAL_PADDING, paddingVertical: spacing.md, backgroundColor: `${colors.accent}30`, borderBottomWidth: 1, borderColor: colors.border }}>
            <Pressable onPress={() => navigation.navigate('Diary')} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm }}>
              <Text style={{ fontSize: 11, fontWeight: '600', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 1 }}>
                Recent Activity
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                <Text style={{ ...typography.caption, color: colors.primary }}>More</Text>
                <Ionicons name="chevron-forward" size={14} color={colors.primary} />
              </View>
            </Pressable>
            {recentMatchQueries.some((q) => q.isLoading) && recentMatchMap.size === 0 ? (
              <View style={{ paddingVertical: spacing.lg, alignItems: 'center' }}>
                <LoadingSpinner fullScreen={false} />
              </View>
            ) : (
            <View style={{ flexDirection: 'row', gap: GAP }}>
              {recentReviews.map((review) => {
                const match = recentMatchMap.get(review.matchId);
                const isLiked = profile?.likedMatchIds?.some((id) => String(id) === String(review.matchId)) || false;
                const hasText = review.text.trim().length > 0;
                return match ? (
                  <View key={review.id} style={{ width: CARD_WIDTH }}>
                    <MatchPosterCard
                      match={match}
                      onPress={() => navigation.navigate('ReviewDetail', { reviewId: review.id })}
                      width={CARD_WIDTH}
                    />
                    {/* Rating, heart, review indicator — left aligned */}
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 5 }}>
                      <StarRating rating={review.rating} size={9} />
                      {isLiked && (
                        <Ionicons name="heart" size={9} color="#ef4444" />
                      )}
                      {hasText && (
                        <Ionicons name="reorder-three-outline" size={10} color={colors.textSecondary} />
                      )}
                    </View>
                  </View>
                ) : (
                  <Pressable
                    key={review.id}
                    onPress={() => navigation.navigate('ReviewDetail', { reviewId: review.id })}
                    style={{
                      width: CARD_WIDTH,
                      height: CARD_WIDTH * 1.5,
                      backgroundColor: colors.card,
                      borderRadius: 4,
                      borderWidth: 1,
                      borderColor: colors.border,
                      justifyContent: 'flex-end',
                      padding: 6,
                    }}
                  >
                    <Text style={{ fontSize: 9, fontWeight: '600', color: colors.foreground }} numberOfLines={2}>
                      {review.matchLabel || `Match #${review.matchId}`}
                    </Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2, marginTop: 2 }}>
                      <StarRating rating={review.rating} size={8} />
                      {isLiked && (
                        <Ionicons name="heart" size={8} color="#ef4444" style={{ marginLeft: 1 }} />
                      )}
                      {hasText && (
                        <Ionicons name="reorder-three-outline" size={10} color={colors.textSecondary} style={{ marginLeft: 1 }} />
                      )}
                    </View>
                  </Pressable>
                );
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
                onPress={() => {
                  if (link.label === 'Games') navigation.navigate('Games');
                  else if (link.label === 'Diary') navigation.navigate('Diary');
                  else if (link.label === 'Reviews') navigation.navigate('Reviews');
                  else if (link.label === 'Lists') navigation.navigate('MyLists');
                  else if (link.label === 'Likes') navigation.navigate('Likes');
                  else if (link.label === 'Tags') navigation.navigate('Tags');
                }}
                style={({ pressed }) => ({
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingVertical: spacing.md,
                  paddingHorizontal: spacing.md,
                  backgroundColor: pressed ? colors.accent : 'transparent',
                  borderTopWidth: i > 0 ? 1 : 0,
                  borderTopColor: colors.border,
                })}
              >
                <Text style={{ ...typography.body, color: colors.foreground }}>{link.label}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                  <Text style={{ ...typography.caption, color: colors.textSecondary }}>{link.count}</Text>
                  <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
                </View>
              </Pressable>
            ))}
          </View>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}
