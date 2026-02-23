import React from 'react';
import { View, Text, FlatList, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useQueries } from '@tanstack/react-query';
import { useTheme } from '../../context/ThemeContext';
import { getUserProfile } from '../../services/firestore/users';
import { Avatar } from '../../components/ui/Avatar';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';

export function FollowListScreen({ route, navigation }: any) {
  const { userIds, title } = route.params as { userIds: string[]; title: string };
  const { theme, isDark } = useTheme();
  const { colors, spacing, typography, borderRadius } = theme;

  const userQueries = useQueries({
    queries: userIds.map((id) => ({
      queryKey: ['user', id],
      queryFn: () => getUserProfile(id),
      staleTime: 60 * 1000,
      enabled: userIds.length > 0,
    })),
  });

  const users = userQueries
    .filter((q) => q.data != null)
    .map((q) => q.data!);

  const isLoading = userQueries.some((q) => q.isLoading);

  if (isLoading && users.length === 0) return <LoadingSpinner />;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border }}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={8}>
          <Ionicons name="arrow-back" size={22} color={colors.foreground} />
        </Pressable>
        <Text style={{ ...typography.bodyBold, color: colors.foreground, flex: 1, textAlign: 'center', fontSize: 17 }}>
          {title}
        </Text>
        <View style={{ width: 22 }} />
      </View>

      {users.length === 0 ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl }}>
          <Ionicons name="people-outline" size={48} color={colors.textSecondary} />
          <Text style={{ ...typography.h4, color: colors.foreground, marginTop: spacing.md }}>
            {title === 'Following' ? 'Not following anyone yet' : 'No followers yet'}
          </Text>
          <Text style={{ ...typography.body, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.xs }}>
            {title === 'Following' ? 'Find people to follow in Search' : 'Share your profile to get followers'}
          </Text>
        </View>
      ) : (
        <FlatList indicatorStyle={isDark ? 'white' : 'default'}
          data={users}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingVertical: spacing.xs }}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => navigation.navigate('UserProfile', { userId: item.id })}
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                paddingHorizontal: spacing.md,
                paddingVertical: spacing.sm + 2,
                backgroundColor: pressed ? colors.accent : 'transparent',
              })}
            >
              <Avatar uri={item.avatar} name={item.displayName} size={44} />
              <View style={{ marginLeft: spacing.sm, flex: 1 }}>
                <Text style={{ ...typography.bodyBold, color: colors.foreground }}>
                  {item.displayName}
                </Text>
                <Text style={{ ...typography.caption, color: colors.textSecondary }}>
                  @{item.username}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
            </Pressable>
          )}
        />
      )}
    </SafeAreaView>
  );
}
