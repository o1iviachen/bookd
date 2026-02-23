import React from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { useListsForMatch } from '../../hooks/useLists';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { formatRelativeTime } from '../../utils/formatDate';

export function MatchListsScreen({ route, navigation }: any) {
  const { theme, isDark } = useTheme();
  const { colors, spacing, typography, borderRadius } = theme;
  const { matchId } = route.params;
  const { data: lists, isLoading } = useListsForMatch(matchId);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border }}>
        <Pressable onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={colors.foreground} />
        </Pressable>
        <Text style={{ ...typography.bodyBold, color: colors.foreground, flex: 1, textAlign: 'center', fontSize: 17 }}>
          Lists
        </Text>
        <View style={{ width: 24 }} />
      </View>

      {isLoading ? (
        <LoadingSpinner />
      ) : !lists || lists.length === 0 ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl }}>
          <Ionicons name="list-outline" size={48} color={colors.textSecondary} />
          <Text style={{ ...typography.body, color: colors.textSecondary, marginTop: spacing.sm, textAlign: 'center' }}>
            This match hasn't been added to any lists yet
          </Text>
        </View>
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
