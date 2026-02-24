import React from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';
import { useListsForMatch } from '../../hooks/useLists';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { ScreenHeader } from '../../components/ui/ScreenHeader';
import { EmptyState } from '../../components/ui/EmptyState';
import { formatRelativeTime } from '../../utils/formatDate';

export function MatchListsScreen({ route, navigation }: any) {
  const { theme, isDark } = useTheme();
  const { colors, spacing, typography, borderRadius } = theme;
  const { matchId } = route.params;
  const { data: lists, isLoading } = useListsForMatch(matchId);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader title="Lists" onBack={() => navigation.goBack()} />

      {isLoading ? (
        <LoadingSpinner />
      ) : !lists || lists.length === 0 ? (
        <EmptyState
          icon="list-outline"
          title="No lists yet"
          subtitle="This match hasn't been added to any lists yet"
        />
      ) : (
        <ScrollView indicatorStyle={isDark ? 'white' : 'default'} contentContainerStyle={{ padding: spacing.md }}>
          <Text style={{ ...typography.caption, color: colors.textSecondary, marginBottom: spacing.md }}>
            {lists.length} {lists.length === 1 ? 'list' : 'lists'}
          </Text>
          {lists.map((list) => (
            <Pressable
              key={list.id}
              onPress={() => navigation.navigate('ListDetail', { listId: list.id })}
              style={({ pressed }) => ({
                backgroundColor: pressed ? colors.muted : colors.card,
                padding: spacing.md,
                borderRadius: borderRadius.md,
                marginBottom: spacing.sm,
                borderWidth: 1,
                borderColor: colors.border,
              })}
            >
              <Text style={{ ...typography.bodyBold, color: colors.foreground }}>{list.name}</Text>
              <Text style={{ ...typography.caption, color: colors.textSecondary, marginTop: 2 }}>
                by {list.username} · {list.matchIds.length} {list.matchIds.length === 1 ? 'match' : 'matches'} · {formatRelativeTime(list.createdAt)}
              </Text>
              {list.description ? (
                <Text numberOfLines={2} style={{ ...typography.small, color: colors.textSecondary, marginTop: spacing.xs }}>
                  {list.description}
                </Text>
              ) : null}
            </Pressable>
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
