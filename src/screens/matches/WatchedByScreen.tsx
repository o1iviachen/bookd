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
  likedMatch: boolean;
  reviewId: string | null;
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

  const handlePageScroll = useCallback((e: any) => {
    const { position, offset } = e.nativeEvent;
    setActiveTabIndex(Math.round(position + offset));
  }, []);


  // Get unique user IDs from reviews (deduplicate - use latest review per user)
  const userReviewMap = useMemo(() => {
    const map = new Map<string, Review>();
    if (!reviews) return map;
    // Sort by date desc so first encountered is the latest
    const sorted = [...reviews].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    for (const r of sorted) {
      if (!map.has(r.userId)) map.set(r.userId, r);
    }
    return map;
  }, [reviews]);

  const uniqueUserIds = useMemo(() => Array.from(userReviewMap.keys()), [userReviewMap]);

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
      const review = userReviewMap.get(profile.id);
      if (!review) return;
      entries.push({
        userId: profile.id,
        profile,
        rating: review.rating,
        hasText: (review.text?.trim().length || 0) > 0,
        likedMatch: profile.likedMatchIds?.some((id) => String(id) === String(matchId)) || false,
        reviewId: review.id,
      });
    });
    return entries;
  }, [profileQueries, userReviewMap, matchId]);

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
        onPageScroll={handlePageScroll}
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
                      if (item.reviewId && item.rating > 0) {
                        navigation.navigate('ReviewDetail', { reviewId: item.reviewId });
                      } else {
                        navigation.navigate('UserProfile', { userId: item.userId });
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
