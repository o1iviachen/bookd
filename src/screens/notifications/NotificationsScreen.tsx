import React, { useMemo, useCallback, useState } from 'react';
import { View, Text, FlatList, Pressable, RefreshControl, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useQueries } from '@tanstack/react-query';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { useNotifications, useMarkNotificationRead, useMarkAllRead } from '../../hooks/useNotifications';
import { useBlockedUsers } from '../../hooks/useUser';
import { getUserProfile } from '../../services/firestore/users';
import { Avatar } from '../../components/ui/Avatar';
import { formatRelativeTime } from '../../utils/formatDate';
import { AppNotification } from '../../types/notification';
import { User } from '../../types/user';
import { useTranslation } from 'react-i18next';

function getNotificationMessage(type: AppNotification['type'], username: string, t: (key: string) => string): React.ReactNode {
  const NOTIFICATION_MESSAGES: Record<string, string> = {
    follow: t('notifications.startedFollowingYou'),
    review_like: t('notifications.likedYourReview'),
    comment: t('notifications.commentedOnYourReview'),
    comment_like: t('notifications.likedYourComment'),
    list_like: t('notifications.likedYourList'),
    list_comment: t('notifications.commentedOnYourList'),
  };
  const message = NOTIFICATION_MESSAGES[type] || 'interacted with you';
  return <Text><Text style={{ fontWeight: '600' }}>{username}</Text> {message}</Text>;
}

function getNotificationIcon(type: AppNotification['type']): keyof typeof Ionicons.glyphMap {
  switch (type) {
    case 'follow':
      return 'person-add';
    case 'review_like':
    case 'comment_like':
    case 'list_like':
      return 'heart';
    case 'comment':
    case 'list_comment':
      return 'chatbubble';
    default:
      return 'notifications';
  }
}

export function NotificationsScreen({ navigation }: any) {
  const { theme, isDark } = useTheme();
  const { colors, spacing, typography } = theme;
  const { t } = useTranslation();
  const { user } = useAuth();
  const blockedUsers = useBlockedUsers(user?.uid);
  const { data: notifications, refetch } = useNotifications(user?.uid || '', blockedUsers);
  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllRead();

  // Fetch current profiles for all unique senders
  const senderIds = useMemo(
    () => [...new Set((notifications || []).map((n) => n.senderId))],
    [notifications]
  );

  const senderQueries = useQueries({
    queries: senderIds.map((id) => ({
      queryKey: ['user', id],
      queryFn: () => getUserProfile(id),
      staleTime: 2 * 60 * 1000,
      enabled: senderIds.length > 0,
    })),
  });

  const senderMap = useMemo(() => {
    const map = new Map<string, User>();
    senderQueries.forEach((q) => {
      if (q.data) map.set(q.data.id, q.data);
    });
    return map;
  }, [senderQueries]);

  const hasUnread = notifications?.some((n) => !n.isRead) || false;

  const handlePress = (notification: AppNotification) => {
    if (!notification.isRead) {
      markRead.mutate(notification.id);
    }

    if (notification.type === 'follow') {
      navigation.navigate('UserProfile', { userId: notification.senderId });
    } else if (notification.type === 'list_like' || notification.type === 'list_comment') {
      if (notification.listId) navigation.navigate('ListDetail', { listId: notification.listId });
    } else if (notification.reviewId) {
      navigation.navigate('ReviewDetail', { reviewId: notification.reviewId });
    }
  };

  const handleMarkAllRead = () => {
    if (!user) return;
    markAllRead.mutate(user.uid);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      {/* Header */}
      <View style={{ paddingHorizontal: spacing.md, paddingTop: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border }}>
        <Text style={{ ...typography.h2, color: colors.foreground, textAlign: 'center', marginBottom: spacing.md }}>
          {t('notifications.activity')}
        </Text>
        {hasUnread && (
          <Pressable onPress={handleMarkAllRead} hitSlop={8} style={{ position: 'absolute', right: spacing.md, top: spacing.md + 2 }}>
            <Ionicons name="checkmark-done" size={22} color={colors.primary} />
          </Pressable>
        )}
      </View>

      {!notifications || notifications.length === 0 ? (
        <ScrollView showsVerticalScrollIndicator={false}
          contentContainerStyle={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        >
          <Ionicons name="notifications-outline" size={48} color={colors.textSecondary} />
          <Text style={{ ...typography.h4, color: colors.foreground, marginTop: spacing.md }}>
            {t('notifications.noActivityYet')}
          </Text>
          <Text style={{ ...typography.body, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.xs }}>
            {t('notifications.noActivityDescription')}
          </Text>
        </ScrollView>
      ) : (
        <FlatList showsVerticalScrollIndicator={false} indicatorStyle={isDark ? 'white' : 'default'}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
          data={notifications}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => {
            const sender = senderMap.get(item.senderId);
            const displayName = sender?.username || item.senderUsername;
            const displayAvatar = sender?.avatar ?? item.senderAvatar;

            return (
              <Pressable
                onPress={() => handlePress(item)}
                style={({ pressed }) => ({
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingHorizontal: spacing.md,
                  paddingVertical: spacing.sm + 4,
                  backgroundColor: !item.isRead
                    ? colors.accent
                    : pressed
                    ? colors.accent
                    : 'transparent',
                })}
              >
                <View style={{ position: 'relative' }}>
                  <Avatar uri={displayAvatar} name={displayName} size={44} />
                  <View
                    style={{
                      position: 'absolute',
                      bottom: -2,
                      right: -2,
                      width: 20,
                      height: 20,
                      borderRadius: 10,
                      backgroundColor: colors.primary,
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderWidth: 2,
                      borderColor: !item.isRead ? colors.accent : colors.background,
                    }}
                  >
                    <Ionicons name={getNotificationIcon(item.type)} size={10} color="#14181c" />
                  </View>
                </View>
                <View style={{ marginLeft: spacing.sm, flex: 1 }}>
                  <Text style={{ ...typography.body, color: colors.foreground, lineHeight: 20 }}>
                    {getNotificationMessage(item.type, displayName, t)}
                  </Text>
                  <Text style={{ ...typography.small, color: colors.textSecondary, marginTop: 2 }}>
                    {formatRelativeTime(item.createdAt)}
                  </Text>
                </View>
                {!item.isRead && (
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#00e054', marginLeft: spacing.sm }} />
                )}
              </Pressable>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}
