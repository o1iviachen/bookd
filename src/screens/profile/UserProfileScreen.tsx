import React, { useCallback, useState, useRef, useMemo } from 'react';
import { View, Text, ScrollView, Pressable, Linking, useWindowDimensions, Alert, Animated, Share, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useQueries, useQueryClient } from '@tanstack/react-query';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { useUserProfile, useFollowUser, useUnfollowUser, useBlockUser, useUnblockUser, useBlockedUsers } from '../../hooks/useUser';
import { useReviewsForUser, useLikedReviews } from '../../hooks/useReviews';
import { useListsForUser, useLikedLists } from '../../hooks/useLists';
import { ActionMenu } from '../../components/ui/ActionMenu';
import { ReportModal } from '../../components/ui/ReportModal';
import { getMatchById } from '../../services/matchService';
import { Avatar } from '../../components/ui/Avatar';
import { TeamLogo } from '../../components/match/TeamLogo';
import { MatchPosterCard } from '../../components/match/MatchPosterCard';
import { StarRating } from '../../components/ui/StarRating';
import { Button } from '../../components/ui/Button';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { ScreenHeader } from '../../components/ui/ScreenHeader';
import { RatingChart } from '../../components/profile/RatingChart';
import { POPULAR_TEAMS } from '../../utils/constants';
import { nationalityFlag } from '../../utils/flagEmoji';
import { TranslateButton } from '../../components/ui/TranslateButton';
import { useTranslation } from 'react-i18next';
import { Match } from '../../types/match';

export function UserProfileScreen({ route, navigation }: any) {
  const { t } = useTranslation();
  const { theme, isDark } = useTheme();
  const { colors, spacing, typography, borderRadius } = theme;
  const insets = useSafeAreaInsets();
  const { userId } = route.params;
  const { user: currentUser } = useAuth();
  const { width: screenWidth } = useWindowDimensions();
  const headerHeight = Math.round(screenWidth * 0.5);
  const { data: profile, isLoading } = useUserProfile(userId);
  const { data: currentProfile } = useUserProfile(currentUser?.uid || '');
  const { data: reviews } = useReviewsForUser(userId);
  const { data: lists } = useListsForUser(userId);
  const { data: likedReviews } = useLikedReviews(userId);
  const { data: likedLists } = useLikedLists(userId);
  const queryClient = useQueryClient();
  const followMutation = useFollowUser();
  const unfollowMutation = useUnfollowUser();
  const blockMutation = useBlockUser();
  const unblockMutation = useUnblockUser();
  const [showMenu, setShowMenu] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const scrollY = useRef(new Animated.Value(0)).current;
  const handleScroll = useMemo(
    () => Animated.event(
      [{ nativeEvent: { contentOffset: { y: scrollY } } }],
      { useNativeDriver: true },
    ),
    [scrollY],
  );

  const blockedSet = useBlockedUsers(currentUser?.uid);
  const isOwnProfile = currentUser?.uid === userId;
  const isFollowing = currentProfile?.following?.includes(userId) || false;
  const isBlocked = currentProfile?.blockedUsers?.includes(userId) || false;
  const isBlockedBy = blockedSet.has(userId) && !isBlocked;
  const isBlockRelated = isBlocked || isBlockedBy;

  const handleBlock = () => {
    if (!currentUser) return;
    setShowMenu(false);
    setTimeout(() => {
      Alert.alert(
        t('block.confirmTitle', { username: profile?.username }),
        t('block.confirmMessage'),
        [
          { text: t('common.cancel'), style: 'cancel' },
          {
            text: t('block.blockUser'),
            style: 'destructive',
            onPress: () => blockMutation.mutate({ currentUserId: currentUser.uid, targetUserId: userId }),
          },
        ],
      );
    }, 300);
  };

  const handleUnblock = () => {
    if (!currentUser) return;
    unblockMutation.mutate({ currentUserId: currentUser.uid, targetUserId: userId });
  };

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

  // Blocked state — show minimal profile
  if (isBlockRelated && !isOwnProfile) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
        <ScreenHeader
          title={profile.username}
          onBack={() => navigation.goBack()}
          rightElement={isBlocked ? (
            <Pressable onPress={handleUnblock} hitSlop={8}>
              <Ionicons name="ban-outline" size={22} color={colors.error} />
            </Pressable>
          ) : undefined}
        />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xl }}>
          <Avatar uri={profile.avatar} name={profile.displayName} size={72} />
          <Text style={{ ...typography.h4, color: colors.foreground, marginTop: spacing.sm }}>
            @{profile.username}
          </Text>
          <Text style={{ ...typography.body, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.sm }}>
            {isBlocked ? t('block.blockedProfileMessage') : t('block.blockedByMessage')}
          </Text>
          {isBlocked && (
            <Button
              title={t('block.unblockUser')}
              onPress={handleUnblock}
              variant="outline"
              size="sm"
              loading={unblockMutation.isPending}
              style={{ marginTop: spacing.md }}
            />
          )}
        </View>
      </SafeAreaView>
    );
  }

  // Team crests
  const followedTeamCrests = (profile?.favoriteTeams || []).map((id: string) => {
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
      <Pressable
        onPress={() => navigation.goBack()}
        style={{ position: 'absolute', top: insets.top + spacing.xs, left: spacing.md, zIndex: 10, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: borderRadius.full, padding: spacing.sm }}
      >
        <Ionicons name="arrow-back" size={20} color="#fff" />
      </Pressable>
      {!isOwnProfile && (
        <Pressable
          onPress={() => setShowMenu(true)}
          style={{ position: 'absolute', top: insets.top + spacing.xs, right: spacing.md, zIndex: 10, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: borderRadius.full, padding: spacing.sm }}
        >
          <Ionicons name="ellipsis-horizontal" size={20} color="#fff" />
        </Pressable>
      )}
      <ActionMenu
        visible={showMenu}
        onClose={() => setShowMenu(false)}
        items={[
          {
            label: t('common.share'),
            icon: 'share-social-outline',
            onPress: () => {
              setShowMenu(false);
              const url = `https://bookd-app.com/profile/${userId}`;
              const text = `Check out @${profile.username} on Bookd!`;
              Share.share(Platform.OS === 'ios' ? { message: text, url } : { message: `${text}\n${url}` });
            },
          },
          {
            label: t('common.report'),
            icon: 'flag-outline',
            onPress: () => { setShowMenu(false); setShowReport(true); },
          },
          {
            label: isBlocked ? t('block.unblockUser') : t('block.blockUser'),
            icon: 'ban-outline',
            onPress: isBlocked ? () => { setShowMenu(false); handleUnblock(); } : handleBlock,
            destructive: !isBlocked,
          },
        ]}
      />

      <ReportModal
        visible={showReport}
        onClose={() => setShowReport(false)}
        contentType="user"
        contentId={userId}
      />

      <Animated.ScrollView showsVerticalScrollIndicator={false} indicatorStyle={isDark ? 'white' : 'default'} contentContainerStyle={{ paddingBottom: 60 }} onScroll={handleScroll} scrollEventThrottle={16} bounces>
        {/* Header image */}
        {profile.headerImage && (
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
        )}
        {/* Avatar + name */}
        <View style={{ alignItems: 'center', paddingTop: profile.headerImage ? 0 : spacing.lg, marginTop: profile.headerImage ? -48 : 0, paddingHorizontal: spacing.md }}>
          <Avatar uri={profile.avatar} name={profile.displayName} size={96} />
          <Text style={{ ...typography.h3, color: colors.foreground, marginTop: spacing.sm }}>
            {profile.displayName}
          </Text>
          <Text style={{ ...typography.caption, color: colors.textSecondary }}>
            @{profile.username}
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
        {profile.bio ? (
          <View style={{ marginTop: spacing.sm, paddingHorizontal: spacing.xl, alignItems: 'center' }}>
            <Text style={{ ...typography.body, color: colors.textSecondary, textAlign: 'center' }}>
              {profile.bio}
            </Text>
            <TranslateButton text={profile.bio} contentLanguage={profile.preferredLanguage} />
          </View>
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
              title={isFollowing ? t('common.following') : t('common.follow')}
              onPress={handleFollowToggle}
              variant={isFollowing ? 'outline' : 'primary'}
              size="sm"
              loading={followMutation.isPending || unfollowMutation.isPending}
            />
          </View>
        )}

        {/* Stats row — Instagram-style */}
        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: spacing.xxl, marginTop: spacing.sm, paddingVertical: spacing.sm }}>
          <Pressable onPress={() => navigation.navigate('FollowList', { userIds: profile.following || [], title: t('common.following') })} style={{ alignItems: 'center' }}>
            <Text style={{ ...typography.h4, color: colors.foreground }}>{profile.following?.length || 0}</Text>
            <Text style={{ ...typography.small, color: colors.textSecondary }}>{t('common.following')}</Text>
          </Pressable>
          <Pressable onPress={() => navigation.navigate('FollowList', { userIds: profile.followers || [], title: t('common.followers') })} style={{ alignItems: 'center' }}>
            <Text style={{ ...typography.h4, color: colors.foreground }}>{profile.followers?.length || 0}</Text>
            <Text style={{ ...typography.small, color: colors.textSecondary }}>{t('common.followers')}</Text>
          </Pressable>
        </View>

        {/* Favourite Matches */}
        {favoriteMatches.length > 0 && (
          <View style={{ marginTop: spacing.md, paddingHorizontal: HORIZONTAL_PADDING, paddingVertical: spacing.md, backgroundColor: `${colors.accent}30`, borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.border }}>
            <Text style={{ fontSize: 11, fontWeight: '600', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 1, marginBottom: spacing.sm }}>
              {t('profile.favouriteMatches')}
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
              {t('profile.recentActivity')}
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
      </Animated.ScrollView>
    </View>
  );
}
