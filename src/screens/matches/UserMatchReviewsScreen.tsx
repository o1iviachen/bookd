import React, { useMemo } from 'react';
import { View, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';
import { useMatch } from '../../hooks/useMatches';
import { useReviewsForMatch } from '../../hooks/useReviews';
import { useUserProfile } from '../../hooks/useUser';
import { DiaryEntryRow } from '../../components/diary/DiaryEntryRow';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { ScreenHeader } from '../../components/ui/ScreenHeader';
import { EmptyState } from '../../components/ui/EmptyState';

export function UserMatchReviewsScreen({ route, navigation }: any) {
  const { theme, isDark } = useTheme();
  const { colors, spacing } = theme;
  const { matchId, userId, username } = route.params as {
    matchId: number;
    userId: string;
    username: string;
  };

  const { data: match } = useMatch(matchId);
  const { data: allReviews, isLoading } = useReviewsForMatch(matchId);
  const { data: profile } = useUserProfile(userId);

  const userReviews = useMemo(() => {
    if (!allReviews) return [];
    return allReviews
      .filter((r) => r.userId === userId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }, [allReviews, userId]);

  const isLiked = profile?.likedMatchIds?.some((id: number) => String(id) === String(matchId)) || false;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      <ScreenHeader title={`${username}'s diary`} onBack={() => navigation.goBack()} />

      {isLoading ? (
        <View style={{ flex: 1, justifyContent: 'center' }}>
          <LoadingSpinner fullScreen={false} />
        </View>
      ) : userReviews.length === 0 ? (
        <EmptyState icon="book-outline" title="No entries" />
      ) : (
        <FlatList showsVerticalScrollIndicator={false}
          indicatorStyle={isDark ? 'white' : 'default'}
          data={userReviews}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingBottom: spacing.xxl }}
          renderItem={({ item: review }) => (
            <DiaryEntryRow
              review={review}
              match={match || null}
              isLiked={isLiked}
              onPress={() => navigation.navigate('ReviewDetail', { reviewId: review.id })}
            />
          )}
        />
      )}
    </SafeAreaView>
  );
}
