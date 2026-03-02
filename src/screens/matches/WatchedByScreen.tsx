import React, { useState, useMemo, useRef, useCallback } from 'react';
import { View, Text, FlatList, Pressable } from 'react-native';
import PagerView from 'react-native-pager-view';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useQueries } from '@tanstack/react-query';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { useUserProfile } from '../../hooks/useUser';
import { useReviewsForMatch } from '../../hooks/useReviews';
import { getUserProfile } from '../../services/firestore/users';
import { Avatar } from '../../components/ui/Avatar';
import { StarRating } from '../../components/ui/StarRating';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { ScreenHeader } from '../../components/ui/ScreenHeader';
import { SegmentedControl } from '../../components/ui/SegmentedControl';
import { EmptyState } from '../../components/ui/EmptyState';
import { Review } from '../../types/review';
import { User } from '../../types/user';

const TABS = ['Everyone', 'Friends'] as const;

interface WatcherEntry {
  userId: string;
  profile: User;
  rating: number;
  hasText: boolean;
  hasMedia: boolean;
  likedMatch: boolean;
  username: string;
  reviewCount: number;
  singleReviewId: string | null;
}

export function WatchedByScreen({ route, navigation }: any) {
  const { theme, isDark } = useTheme();
  const { colors, spacing, typography } = theme;
  const { matchId, initialTab } = route.params;
  const { user } = useAuth();
  const { data: myProfile } = useUserProfile(user?.uid || '');
  const { data: reviews, isLoading: reviewsLoading } = useReviewsForMatch(matchId);

  const initialIndex = initialTab === 'friends' ? 1 : 0;
  const [activeTabIndex, setActiveTabIndex] = useState(initialIndex);
  const pagerRef = useRef<PagerView>(null);

  const handleTabPress = useCallback((index: number) => {
    setActiveTabIndex(index);
    pagerRef.current?.setPage(index);
  }, []);

  const handlePageSelected = useCallback((e: any) => {
    setActiveTabIndex(e.nativeEvent.position);
  }, []);


  // Get unique user IDs from reviews (deduplicate - use latest review per user, track all for hasText)
  const { userLatestMap, userAllMap } = useMemo(() => {
    const latestMap = new Map<string, Review>();
    const allMap = new Map<string, Review[]>();
    if (!reviews) return { userLatestMap: latestMap, userAllMap: allMap };
    const sorted = [...reviews].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    for (const r of sorted) {
      if (!latestMap.has(r.userId)) latestMap.set(r.userId, r);
      if (!allMap.has(r.userId)) allMap.set(r.userId, []);
      allMap.get(r.userId)!.push(r);
    }
    return { userLatestMap: latestMap, userAllMap: allMap };
  }, [reviews]);

  const uniqueUserIds = useMemo(() => Array.from(userLatestMap.keys()), [userLatestMap]);

  // Fetch profiles for all watchers
  const profileQueries = useQueries({
    queries: uniqueUserIds.map((uid) => ({
      queryKey: ['user', uid],
      queryFn: () => getUserProfile(uid),
      staleTime: 2 * 60 * 1000,
      enabled: uniqueUserIds.length > 0,
    })),
  });

  const watchers: WatcherEntry[] = useMemo(() => {
    const entries: WatcherEntry[] = [];
    profileQueries.forEach((q) => {
      if (!q.data) return;
      const profile = q.data;
      const latestReview = userLatestMap.get(profile.id);
      if (!latestReview) return;
      const allUserReviews = userAllMap.get(profile.id) || [];
      const hasAnyText = allUserReviews.some((r) => (r.text?.trim().length || 0) > 0);
      const hasAnyMedia = allUserReviews.some((r) => r.media && r.media.length > 0);
      entries.push({
        userId: profile.id,
        profile,
        rating: latestReview.rating,
        hasText: hasAnyText,
        hasMedia: hasAnyMedia,
        likedMatch: profile.likedMatchIds?.some((id) => String(id) === String(matchId)) || false,
        username: profile.displayName || profile.username,
        reviewCount: allUserReviews.length,
        singleReviewId: allUserReviews.length === 1 ? allUserReviews[0].id : null,
      });
    });
    return entries;
  }, [profileQueries, userLatestMap, userAllMap, matchId]);

  const following = myProfile?.following || [];

  const isLoading = reviewsLoading || profileQueries.some((q) => q.isLoading);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      <ScreenHeader title="Watched by" onBack={() => navigation.goBack()} />

      {/* Segmented control */}
      <View style={{ paddingHorizontal: spacing.md, paddingTop: spacing.sm, paddingBottom: spacing.sm }}>
        <SegmentedControl tabs={TABS} activeTab={TABS[activeTabIndex]} onTabChange={(tab) => handleTabPress(TABS.indexOf(tab))} />
      </View>

      <PagerView
        ref={pagerRef}
        style={{ flex: 1 }}
        initialPage={initialIndex}
        onPageSelected={handlePageSelected}
      >
        {TABS.map((tab, tabIdx) => {
          const tabWatchers = tabIdx === 1
            ? watchers.filter((w) => following.includes(w.userId))
            : watchers;

          return (
            <View key={tab} style={{ flex: 1 }}>
              {isLoading && watchers.length === 0 ? (
                <View style={{ flex: 1, justifyContent: 'center' }}><LoadingSpinner fullScreen={false} /></View>
              ) : tabWatchers.length === 0 ? (
                <EmptyState
                  icon="people-outline"
                  title={tabIdx === 1 ? 'No friends have watched yet' : 'No one has watched yet'}
                />
              ) : (
                <FlatList
                  indicatorStyle={isDark ? 'white' : 'default'}
                  data={tabWatchers}
                  keyExtractor={(item) => item.userId}
                  contentContainerStyle={{ paddingBottom: spacing.xl }}
                  renderItem={({ item }) => {
                    const handlePress = () => {
                      if (item.singleReviewId) {
                        navigation.navigate('ReviewDetail', { reviewId: item.singleReviewId });
                      } else {
                        navigation.navigate('UserMatchReviews', { matchId, userId: item.userId, username: item.username });
                      }
                    };

                    return (
                      <Pressable
                        onPress={handlePress}
                        style={({ pressed }) => ({
                          flexDirection: 'row',
                          alignItems: 'center',
                          paddingHorizontal: spacing.md,
                          paddingVertical: spacing.sm + 2,
                          backgroundColor: pressed ? colors.muted : 'transparent',
                        })}
                      >
                        <Avatar uri={item.profile.avatar} name={item.profile.displayName || item.profile.username} size={44} />
                        <View style={{ flex: 1, marginLeft: spacing.sm }}>
                          <Text style={{ ...typography.bodyBold, color: colors.foreground, fontSize: 15 }} numberOfLines={1}>
                            {item.profile.displayName || item.profile.username}
                          </Text>
                          <Text style={{ ...typography.caption, color: colors.textSecondary, marginTop: 1 }} numberOfLines={1}>
                            @{item.profile.username}
                          </Text>
                        </View>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                          {item.rating > 0 && (
                            <StarRating rating={item.rating} size={12} />
                          )}
                          {item.likedMatch && (
                            <Ionicons name="heart" size={14} color="#ef4444" />
                          )}
                          {item.hasText && (
                            <Ionicons name="reorder-three-outline" size={14} color={colors.textSecondary} />
                          )}
                          {item.hasMedia && (
                            <Ionicons name="image-outline" size={13} color={colors.textSecondary} />
                          )}
                        </View>
                      </Pressable>
                    );
                  }}
                />
              )}
            </View>
          );
        })}
      </PagerView>
    </SafeAreaView>
  );
}
