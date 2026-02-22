import React from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { useList } from '../../hooks/useLists';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { formatRelativeTime } from '../../utils/formatDate';
import { ProfileStackParamList } from '../../types/navigation';

type Props = NativeStackScreenProps<ProfileStackParamList, 'ListDetail'>;

export function ListDetailScreen({ route, navigation }: Props) {
  const { theme } = useTheme();
  const { colors, spacing, typography, borderRadius } = theme;
  const { listId } = route.params;
  const { data: list, isLoading } = useList(listId);

  if (isLoading || !list) return <LoadingSpinner />;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', padding: spacing.md }}>
        <Pressable onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={colors.foreground} />
        </Pressable>
        <Text style={{ ...typography.h4, color: colors.foreground, flex: 1, textAlign: 'center' }}>
          List
        </Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.md }}>
        <Text style={{ ...typography.h2, color: colors.foreground }}>{list.name}</Text>
        <Text style={{ ...typography.caption, color: colors.textSecondary, marginTop: spacing.xs }}>
          by {list.username} &middot; {formatRelativeTime(list.createdAt)}
        </Text>
        {list.description ? (
          <Text style={{ ...typography.body, color: colors.textSecondary, marginTop: spacing.sm }}>
            {list.description}
          </Text>
        ) : null}

        <View style={{ marginTop: spacing.lg }}>
          <Text style={{ ...typography.bodyBold, color: colors.foreground, marginBottom: spacing.sm }}>
            {list.matchIds.length} matches
          </Text>
          {list.matchIds.map((matchId) => (
            <Pressable
              key={matchId}
              onPress={() => navigation.navigate('MatchDetail', { matchId })}
              style={{
                backgroundColor: colors.card,
                padding: spacing.md,
                borderRadius: borderRadius.md,
                marginBottom: spacing.sm,
              }}
            >
              <Text style={{ ...typography.body, color: colors.foreground }}>
                Match #{matchId}
              </Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
