import React, { useCallback, useRef, useMemo } from 'react';
import { View, Text, ScrollView, Pressable, Linking, useWindowDimensions, Animated, Share, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { useQueries } from '@tanstack/react-query';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { useUserProfile } from '../../hooks/useUser';
import { useReviewsForUser, useLikedReviews } from '../../hooks/useReviews';
import { useListsForUser, useLikedLists } from '../../hooks/useLists';
import { getMatchById } from '../../services/matchService';
import { Avatar } from '../../components/ui/Avatar';
import { TeamLogo } from '../../components/match/TeamLogo';
import { MatchPosterCard } from '../../components/match/MatchPosterCard';
import { StarRating } from '../../components/ui/StarRating';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { RatingChart } from '../../components/profile/RatingChart';
import { ProfileStackParamList } from '../../types/navigation';
import { POPULAR_TEAMS } from '../../utils/constants';
import { nationalityFlag } from '../../utils/flagEmoji';
import { TranslateButton } from '../../components/ui/TranslateButton';
import { useTranslation } from 'react-i18next';
import { Match } from '../../types/match';

type Nav = NativeStackNavigationProp<ProfileStackParamList, 'Profile'>;

export function ProfileScreen() {
  const { t } = useTranslation();
  const { theme, isDark } = useTheme();
  const { colors, spacing, typography, borderRadius } = theme;
  const navigation = useNavigation<Nav>();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  const headerHeight = Math.round(screenWidth * 0.5);
  const { data: profile, isLoading } = useUserProfile(user?.uid || '');
  const scrollY = useRef(new Animated.Value(0)).current;
  const handleScroll = useMemo(
    () => Animated.event(
      [{ nativeEvent: { contentOffset: { y: scrollY } } }],
      { useNativeDriver: true },
    ),
    [scrollY],
  );
  const { data: reviews } = useReviewsForUser(user?.uid || '');
  const { data: lists } = useListsForUser(user?.uid || '');
  const { data: likedReviews } = useLikedReviews(user?.uid || '');
  const { data: likedLists } = useLikedLists(user?.uid || '');

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

  // Recent activity: one card per unique match (most recent review per match), up to 3
  const seenMatchIds = new Set<number>();
  const recentReviews = (reviews || []).filter((r) => {
    if (seenMatchIds.has(r.matchId)) return false;
    seenMatchIds.add(r.matchId);
    return true;
  }).slice(0, 3);
  const recentMatchIds = recentReviews.map((r) => r.matchId);
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
    const userReviewsForMatch = allUserReviews.filter((r) => Number(r.matchId) === Number(matchId));
    if (userReviewsForMatch.length === 1) {
      navigation.navigate('ReviewDetail', { reviewId: userReviewsForMatch[0].id });
    } else if (userReviewsForMatch.length > 1) {
      navigation.navigate('UserMatchReviews', { matchId, userId: user?.uid || '', username: profile?.username || '' });
    } else {
      navigation.navigate('MatchDetail', { matchId });
    }
  }, [reviews, navigation, user, profile]);

  if (isLoading) return <LoadingSpinner />;

  // Get crests for favourite teams (clubs the user supports, not just following)
  const followedTeamCrests = (profile?.favoriteTeams || []).map((id) => {
    const team = POPULAR_TEAMS.find((t) => t.id === id);
    return team ? { id: team.id, name: team.name, crest: team.crest } : null;
  }).filter(Boolean) as { id: string; name: string; crest: string }[];

  const navLinks: { label: string; count: number | string; icon: keyof typeof Ionicons.glyphMap; screen: string }[] = [
    { label: t('common.matches'), count: `${new Set((reviews || []).map((r) => r.matchId)).size} ${t('profile.thisYear')}`, icon: 'football-outline', screen: 'Games' },
    { label: t('common.diary'), count: reviews?.length || 0, icon: 'book-outline', screen: 'Diary' },
    { label: t('common.reviews'), count: (reviews || []).filter((r) => r.text?.trim().length > 0).length, icon: 'reorder-three-outline', screen: 'Reviews' },
    { label: t('common.lists'), count: lists?.length || 0, icon: 'list-outline', screen: 'MyLists' },
    { label: t('common.likes'), count: (profile?.likedMatchIds?.length || 0) + (likedReviews?.length || 0) + (likedLists?.length || 0), icon: 'heart-outline', screen: 'Likes' },
    { label: t('common.tags'), count: new Set((reviews || []).flatMap((r) => r.tags)).size, icon: 'pricetag-outline', screen: 'Tags' },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Floating buttons */}
      <Animated.View style={{ position: 'absolute', top: insets.top + spacing.xs, left: spacing.md, right: spacing.md, zIndex: 10, flexDirection: 'row', justifyContent: 'space-between', opacity: scrollY.interpolate({ inputRange: [0, 80], outputRange: [1, 0], extrapolate: 'clamp' }), pointerEvents: 'box-none' }}>
        <Pressable
          onPress={() => {
            const url = `https://bookd-app.com/profile/${user?.uid}`;
            const text = `Check out @${profile?.username} on Bookd!`;
            Share.share(Platform.OS === 'ios' ? { message: text, url } : { message: `${text}\n${url}` });
          }}
          style={{ backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: borderRadius.full, padding: spacing.sm }}
        >
          <Ionicons name="share-social-outline" size={20} color="#fff" />
        </Pressable>
        <Pressable
          onPress={() => navigation.navigate('Settings')}
          style={{ backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: borderRadius.full, padding: spacing.sm }}
        >
          <Ionicons name="settings-outline" size={20} color="#fff" />
        </Pressable>
      </Animated.View>

      <Animated.ScrollView showsVerticalScrollIndicator={false} indicatorStyle={isDark ? 'white' : 'default'} contentContainerStyle={{ paddingBottom: spacing.md }} onScroll={handleScroll} scrollEventThrottle={16} bounces>
        {/* Header image or spacer */}
        {profile?.headerImage ? (
          <View style={{ height: headerHeight, overflow: 'visible' }}>
            <Animated.View
              pointerEvents="none"
              style={{
                position: 'absolute', top: 0, left: 0, right: 0, height: headerHeight,
                transform: [
                  { translateY: scrollY.interpolate({ inputRange: [-headerHeight, 0], outputRange: [-headerHeight / 2, 0], extrapolateRight: 'clamp' }) },
                  { scale: scrollY.interpolate({ inputRange: [-headerHeight, 0], outputRange: [2, 1], extrapolateRight: 'clamp' }) },
                ],
              }}
            >
              <Image source={{ uri: profile.headerImage }} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} contentFit="cover" />
              <LinearGradient
                colors={['rgba(0,0,0,0.4)', 'transparent']}
                style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 80 }}
              />
              <LinearGradient
                colors={['transparent', colors.background]}
                style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 80 }}
              />
            </Animated.View>
          </View>
        ) : (
          <View style={{ height: insets.top + 100 }} />
        )}
        {/* Avatar + name */}
        <View style={{ alignItems: 'center', marginTop: -48, paddingHorizontal: spacing.md }}>
          <Avatar uri={profile?.avatar || null} name={profile?.displayName || 'User'} size={96} />
          <Text style={{ ...typography.h3, color: colors.foreground, marginTop: spacing.sm }}>
            {profile?.displayName || 'User'}
          </Text>
          <Text style={{ ...typography.caption, color: colors.textSecondary }}>
            @{profile?.username || 'username'}
          </Text>
        </View>

        {/* Favourite team & country badges */}
        {(followedTeamCrests.length > 0 || profile?.favoriteCountry) && (
          <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm }}>
            {followedTeamCrests.map((club) => (
              <Pressable
                key={club.id}
                onPress={() => navigation.navigate('TeamDetail', { teamId: Number(club.id), teamName: club.name, teamCrest: club.crest })}
              >
                <TeamLogo uri={club.crest} size={28} />
              </Pressable>
            ))}
            {profile?.favoriteCountry && (
              <Text style={{ fontSize: 22 }}>{nationalityFlag(profile.favoriteCountry)}</Text>
            )}
          </View>
        )}

        {/* Bio */}
        {profile?.bio ? (
          <View style={{ marginTop: spacing.sm, paddingHorizontal: spacing.xl, alignItems: 'center' }}>
            <Text style={{ ...typography.body, color: colors.textSecondary, textAlign: 'center' }}>
              {profile.bio}
            </Text>
            <TranslateButton text={profile.bio} contentLanguage={profile.preferredLanguage} />
          </View>
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
        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: spacing.xxl, marginTop: spacing.sm, paddingTop: spacing.sm, paddingBottom: profile?.headerImage ? spacing.sm : spacing.lg }}>
          <Pressable onPress={() => navigation.navigate('FollowList', { userIds: profile?.following || [], title: t('common.following') })} style={{ alignItems: 'center' }}>
            <Text style={{ ...typography.h4, color: colors.foreground }}>{profile?.following?.length || 0}</Text>
            <Text style={{ ...typography.small, color: colors.textSecondary }}>{t('common.following')}</Text>
          </Pressable>
          <Pressable onPress={() => navigation.navigate('FollowList', { userIds: profile?.followers || [], title: t('common.followers') })} style={{ alignItems: 'center' }}>
            <Text style={{ ...typography.h4, color: colors.foreground }}>{profile?.followers?.length || 0}</Text>
            <Text style={{ ...typography.small, color: colors.textSecondary }}>{t('common.followers')}</Text>
          </Pressable>
        </View>

        {/* Favourite Matches */}
        <View style={{ marginTop: spacing.md, paddingHorizontal: HORIZONTAL_PADDING, paddingVertical: spacing.md, backgroundColor: `${colors.accent}30`, borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.border }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm }}>
            <Text style={{ fontSize: 11, fontWeight: '600', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 1 }}>
              {t('profile.favouriteMatches')}
            </Text>
          </View>
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
                {t('profile.addFavourites')}
              </Text>
            </Pressable>
          )}
        </View>

        {/* Recent Activity */}
        {recentReviews.length > 0 && (
          <View style={{ paddingHorizontal: HORIZONTAL_PADDING, paddingVertical: spacing.md, backgroundColor: `${colors.accent}30`, borderColor: colors.border }}>
            <Pressable onPress={() => navigation.navigate('Diary', {})} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm }}>
              <Text style={{ fontSize: 11, fontWeight: '600', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 1 }}>
                {t('profile.recentActivity')}
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                <Text style={{ ...typography.caption, color: colors.primary }}>{t('common.more')}</Text>
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
                const hasMedia = review.media && review.media.length > 0;
                const reviewCount = (reviews || []).filter((r) => Number(r.matchId) === Number(review.matchId)).length;
                const isLog = review.rating === 0 && !review.text?.trim() && !review.tags?.length && !review.media?.length;
                const handlePress = () => isLog
                    ? navigation.navigate('MatchDetail', { matchId: Number(review.matchId) })
                    : navigation.navigate('ReviewDetail', { reviewId: review.id });
                return match ? (
                  <View key={review.id} style={{ width: CARD_WIDTH }}>
                    <MatchPosterCard
                      match={match}
                      onPress={handlePress}
                      width={CARD_WIDTH}
                    />
                    {/* Rating, heart, review indicator — left aligned */}
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 5 }}>
                      {review.rating > 0 && <StarRating rating={review.rating} size={9} />}
                      {isLiked && (
                        <Ionicons name="heart" size={9} color="#ef4444" />
                      )}
                      {hasText && (
                        <Ionicons name="reorder-three-outline" size={10} color={colors.textSecondary} />
                      )}
                      {hasMedia && (
                        <Ionicons name="image-outline" size={9} color={colors.textSecondary} />
                      )}
                    </View>
                  </View>
                ) : (
                  <Pressable
                    key={review.id}
                    onPress={handlePress}
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
                      {review.rating > 0 && <StarRating rating={review.rating} size={8} />}
                      {isLiked && (
                        <Ionicons name="heart" size={8} color="#ef4444" style={{ marginLeft: 1 }} />
                      )}
                      {hasText && (
                        <Ionicons name="reorder-three-outline" size={10} color={colors.textSecondary} style={{ marginLeft: 1 }} />
                      )}
                      {hasMedia && (
                        <Ionicons name="image-outline" size={8} color={colors.textSecondary} style={{ marginLeft: 1 }} />
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
                onPress={() => navigation.navigate(link.screen as any, {})}
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

      </Animated.ScrollView>
    </View>
  );
}
