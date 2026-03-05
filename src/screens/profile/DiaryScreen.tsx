import React, { useMemo } from 'react';
import { View, Text, SectionList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQueries } from '@tanstack/react-query';
import { format } from 'date-fns';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { useReviewsForUser } from '../../hooks/useReviews';
import { useUserProfile } from '../../hooks/useUser';
import { getMatchById } from '../../services/matchService';
import { DiaryEntryRow } from '../../components/diary/DiaryEntryRow';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { ScreenHeader } from '../../components/ui/ScreenHeader';
import { EmptyState } from '../../components/ui/EmptyState';
import { Review } from '../../types/review';
import { Match } from '../../types/match';

export function DiaryScreen({ route, navigation }: any) {
  const { theme, isDark } = useTheme();
  const { colors, spacing } = theme;
  const { user } = useAuth();
  const targetUserId = route.params?.userId || user?.uid || '';
  const { data: reviews, isLoading } = useReviewsForUser(targetUserId);
  const { data: profile } = useUserProfile(targetUserId);

  // Fetch match data for all reviewed matches
  const matchIds = useMemo(
    () => [...new Set((reviews || []).map((r) => r.matchId))],
    [reviews]
  );

  const matchQueries = useQueries({
    queries: matchIds.map((id) => ({
      queryKey: ['match', id],
      queryFn: () => getMatchById(id),
      staleTime: 5 * 60 * 1000,
      enabled: matchIds.length > 0,
    })),
  });

  const matchMap = useMemo(() => {
    const map = new Map<number, Match>();
    matchQueries.forEach((q) => {
      if (q.data) map.set(q.data.id, q.data);
    });
    return map;
  }, [matchQueries]);

  // Group reviews by month
  const sections = useMemo(() => {
    if (!reviews) return [];

    const grouped = new Map<string, Review[]>();
    const sorted = [...reviews].sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
    );

    for (const review of sorted) {
      const key = format(review.createdAt, 'MMMM yyyy');
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push(review);
    }

    return Array.from(grouped.entries()).map(([title, data]) => ({
      title,
      data,
    }));
  }, [reviews]);

  if (isLoading) return <LoadingSpinner />;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      <ScreenHeader title="Diary" onBack={() => navigation.goBack()} />

      {sections.length === 0 ? (
        <EmptyState
          icon="book-outline"
          title="No entries yet"
          subtitle="Start logging matches to build your diary"
        />
      ) : (
        <SectionList showsVerticalScrollIndicator={false}
          indicatorStyle={isDark ? 'white' : 'default'}
          sections={sections}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingBottom: spacing.xxl }}
          renderSectionHeader={({ section }) => (
            <View
              style={{
                backgroundColor: colors.background,
                paddingHorizontal: spacing.md,
                paddingTop: spacing.lg,
                paddingBottom: spacing.xs,
              }}
            >
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: '700',
                  color: colors.textSecondary,
                  textTransform: 'uppercase',
                  letterSpacing: 1,
                }}
              >
                {section.title}
              </Text>
            </View>
          )}
          renderItem={({ item: review }) => {
            const match = matchMap.get(review.matchId);
            const isLiked = profile?.likedMatchIds?.includes(review.matchId) || false;
            return (
              <DiaryEntryRow
                review={review}
                match={match || null}
                isLiked={isLiked}
                onPress={() => {
                  if (!review.text?.trim()) {
                    navigation.navigate('MatchDetail', { matchId: review.matchId });
                  } else {
                    navigation.navigate('ReviewDetail', { reviewId: review.id });
                  }
                }}
              />
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}
