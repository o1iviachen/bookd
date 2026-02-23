import React from 'react';
import { View, Text, FlatList, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { useNotifications, useMarkNotificationRead, useMarkAllRead } from '../../hooks/useNotifications';
import { Avatar } from '../../components/ui/Avatar';
import { formatRelativeTime } from '../../utils/formatDate';
import { AppNotification } from '../../types/notification';

function getNotificationMessage(notification: AppNotification): React.ReactNode {
  const { type, senderUsername } = notification;
  switch (type) {
    case 'follow':
      return <Text><Text style={{ fontWeight: '600' }}>{senderUsername}</Text> started following you</Text>;
    case 'review_like':
      return <Text><Text style={{ fontWeight: '600' }}>{senderUsername}</Text> liked your review</Text>;
    case 'comment':
      return <Text><Text style={{ fontWeight: '600' }}>{senderUsername}</Text> commented on your review</Text>;
    case 'comment_like':
      return <Text><Text style={{ fontWeight: '600' }}>{senderUsername}</Text> liked your comment</Text>;
    default:
      return <Text><Text style={{ fontWeight: '600' }}>{senderUsername}</Text> interacted with you</Text>;
  }
}

function getNotificationIcon(type: AppNotification['type']): keyof typeof Ionicons.glyphMap {
  switch (type) {
    case 'follow':
      return 'person-add';
    case 'review_like':
    case 'comment_like':
      return 'heart';
    case 'comment':
      return 'chatbubble';
    default:
      return 'notifications';
  }
}

export function NotificationsScreen({ navigation }: any) {
  const { theme, isDark } = useTheme();
  const { colors, spacing, typography, borderRadius } = theme;
  const { user } = useAuth();
  const { data: notifications, isLoading } = useNotifications(user?.uid || '');
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllRead();

  const hasUnread = notifications?.some((n) => !n.isRead) || false;

  const handlePress = (notification: AppNotification) => {
    if (!notification.isRead) {
      markRead.mutate(notification.id);
    }

    if (notification.type === 'follow') {
      navigation.navigate('UserProfile', { userId: notification.senderId });
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
          Activity
        </Text>
        {hasUnread && (
          <Pressable onPress={handleMarkAllRead} hitSlop={8} style={{ position: 'absolute', right: spacing.md, top: spacing.md + 2 }}>
            <Ionicons name="checkmark-done" size={22} color={colors.primary} />
          </Pressable>
        )}
      </View>

      {!notifications || notifications.length === 0 ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl }}>
          <Ionicons name="notifications-outline" size={48} color={colors.textSecondary} />
          <Text style={{ ...typography.h4, color: colors.foreground, marginTop: spacing.md }}>
            No activity yet
          </Text>
          <Text style={{ ...typography.body, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.xs }}>
            When people interact with you, you'll see it here
          </Text>
        </View>
      ) : (
        <FlatList indicatorStyle={isDark ? 'white' : 'default'}
          data={notifications}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
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
                <Avatar uri={item.senderAvatar} name={item.senderUsername} size={44} />
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
                  {getNotificationMessage(item)}
                </Text>
                <Text style={{ ...typography.small, color: colors.textSecondary, marginTop: 2 }}>
                  {formatRelativeTime(item.createdAt)}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
            </Pressable>
          )}
        />
      )}
    </SafeAreaView>
  );
}
