import React from 'react';
import { View, Text, FlatList, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQueries } from '@tanstack/react-query';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { useUserProfile, useUnblockUser } from '../../hooks/useUser';
import { getUserProfile } from '../../services/firestore/users';
import { Avatar } from '../../components/ui/Avatar';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { ScreenHeader } from '../../components/ui/ScreenHeader';
import { EmptyState } from '../../components/ui/EmptyState';
import { Button } from '../../components/ui/Button';
import { useTranslation } from 'react-i18next';

export function BlockedUsersScreen({ navigation }: any) {
  const { t } = useTranslation();
  const { theme, isDark } = useTheme();
  const { colors, spacing, typography } = theme;
  const { user } = useAuth();
  const { data: currentProfile } = useUserProfile(user?.uid || '');
  const unblockMutation = useUnblockUser();

  const blockedIds = currentProfile?.blockedUsers || [];

  const userQueries = useQueries({
    queries: blockedIds.map((id) => ({
      queryKey: ['user', id],
      queryFn: () => getUserProfile(id),
      staleTime: 60 * 1000,
      enabled: blockedIds.length > 0,
    })),
  });

  const users = userQueries
    .filter((q) => q.data != null)
    .map((q) => q.data!);

  const isLoading = userQueries.some((q) => q.isLoading);

  if (isLoading && users.length === 0) return <LoadingSpinner />;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      <ScreenHeader title={t('block.blockedUsers')} onBack={() => navigation.goBack()} />

      {users.length === 0 ? (
        <EmptyState
          icon="ban-outline"
          title={t('block.emptyState')}
          subtitle=""
        />
      ) : (
        <FlatList
          showsVerticalScrollIndicator={false}
          indicatorStyle={isDark ? 'white' : 'default'}
          data={users}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingVertical: spacing.xs }}
          renderItem={({ item }) => (
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingHorizontal: spacing.md,
                paddingVertical: spacing.sm + 2,
              }}
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
              <Button
                title={t('block.unblockUser')}
                onPress={() => user && unblockMutation.mutate({ currentUserId: user.uid, targetUserId: item.id })}
                variant="outline"
                size="sm"
                loading={unblockMutation.isPending}
              />
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}
