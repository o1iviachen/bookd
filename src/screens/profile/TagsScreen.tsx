import React, { useMemo } from 'react';
import { View, Text, FlatList, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { useReviewsForUser } from '../../hooks/useReviews';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { ScreenHeader } from '../../components/ui/ScreenHeader';
import { EmptyState } from '../../components/ui/EmptyState';

interface TagEntry {
  tag: string;
  count: number;
}

export function TagsScreen({ route, navigation }: any) {
  const { theme, isDark } = useTheme();
  const { colors, spacing, typography, borderRadius } = theme;
  const { user } = useAuth();
  const targetUserId = route.params?.userId || user?.uid || '';
  const { data: reviews, isLoading } = useReviewsForUser(targetUserId);

  const tags: TagEntry[] = useMemo(() => {
    if (!reviews) return [];
    const countMap = new Map<string, number>();
    for (const r of reviews) {
      for (const tag of r.tags) {
        countMap.set(tag, (countMap.get(tag) || 0) + 1);
      }
    }
    return Array.from(countMap.entries())
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count);
  }, [reviews]);

  if (isLoading) return <LoadingSpinner />;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      <ScreenHeader title="Tags" onBack={() => navigation.goBack()} />

      {tags.length === 0 ? (
        <EmptyState
          icon="pricetag-outline"
          title="No tags yet"
          subtitle="Add tags when reviewing matches"
        />
      ) : (
        <FlatList indicatorStyle={isDark ? 'white' : 'default'}
          data={tags}
          keyExtractor={(item) => item.tag}
          contentContainerStyle={{ paddingHorizontal: spacing.md, paddingVertical: spacing.sm }}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => navigation.navigate('TagMatches', { tag: item.tag, userId: targetUserId })}
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingVertical: spacing.md,
                paddingHorizontal: spacing.sm,
                backgroundColor: pressed ? colors.accent : 'transparent',
                borderBottomWidth: 1,
                borderBottomColor: colors.border,
              })}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                <View style={{
                  backgroundColor: colors.muted,
                  paddingHorizontal: spacing.sm + 2,
                  paddingVertical: spacing.xs,
                  borderRadius: borderRadius.full,
                }}>
                  <Text style={{ ...typography.body, color: colors.foreground }}>{item.tag}</Text>
                </View>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                <Text style={{ ...typography.caption, color: colors.textSecondary }}>
                  {item.count} {item.count === 1 ? 'match' : 'matches'}
                </Text>
                <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
              </View>
            </Pressable>
          )}
        />
      )}
    </SafeAreaView>
  );
}
