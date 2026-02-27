import React from 'react';
import { View, Text, ScrollView, Pressable, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { useUserProfile } from '../../hooks/useUser';
import { updateUserProfile } from '../../services/firestore/users';
import { NotificationPreferences } from '../../types/user';

type ToggleItem = { label: string; description: string; key: keyof NotificationPreferences };

export function NotificationSettingsScreen() {
  const { theme, isDark } = useTheme();
  const { colors, spacing, typography, borderRadius } = theme;
  const navigation = useNavigation();
  const { user } = useAuth();
  const { data: profile } = useUserProfile(user?.uid || '');

  const prefs: NotificationPreferences = profile?.notificationPreferences || {
    pushEnabled: true,
    emailEnabled: false,
    reviewLikes: true,
    reviewComments: true,
    commentLikes: true,
    listLikes: true,
    listComments: true,
    follows: true,
  };

  const toggle = (key: keyof NotificationPreferences, value: boolean) => {
    if (!user) return;
    updateUserProfile(user.uid, {
      notificationPreferences: { ...prefs, [key]: value },
    });
  };

  const channels: ToggleItem[] = [
    { label: 'Push Notifications', description: 'Receive push notifications on your device', key: 'pushEnabled' },
    { label: 'Email Notifications', description: 'Receive notifications via email', key: 'emailEnabled' },
  ];

  const activityItems: ToggleItem[] = [
    { label: 'Review Likes', description: 'When someone likes your review', key: 'reviewLikes' },
    { label: 'Review Comments', description: 'When someone comments on your review', key: 'reviewComments' },
    { label: 'Comment Likes', description: 'When someone likes your comment', key: 'commentLikes' },
    { label: 'List Likes', description: 'When someone likes your list', key: 'listLikes' },
    { label: 'List Comments', description: 'When someone comments on your list', key: 'listComments' },
    { label: 'New Followers', description: 'When someone starts following you', key: 'follows' },
  ];

  const renderGroup = (title: string, items: ToggleItem[]) => (
    <View style={{ marginTop: spacing.lg, paddingHorizontal: spacing.md }}>
      <Text style={{ fontSize: 11, fontWeight: '600', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 1, marginBottom: spacing.sm, marginLeft: spacing.xs }}>
        {title}
      </Text>
      <View style={{ backgroundColor: colors.card, borderRadius: borderRadius.md, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' }}>
        {items.map((item, i) => (
          <View
            key={item.key}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingVertical: spacing.md,
              paddingHorizontal: spacing.md,
              borderTopWidth: i > 0 ? 1 : 0,
              borderTopColor: colors.border,
            }}
          >
            <View style={{ flex: 1, marginRight: spacing.md }}>
              <Text style={{ ...typography.body, color: colors.foreground }}>{item.label}</Text>
              <Text style={{ ...typography.small, color: colors.textSecondary, marginTop: 2 }}>{item.description}</Text>
            </View>
            <Switch
              value={prefs[item.key]}
              onValueChange={(v) => toggle(item.key, v)}
              trackColor={{ false: colors.muted, true: colors.primary }}
              thumbColor="#fff"
            />
          </View>
        ))}
      </View>
    </View>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border }}>
        <Pressable onPress={() => navigation.goBack()} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Ionicons name="chevron-back" size={22} color={colors.primary} />
          <Text style={{ color: colors.primary, fontSize: 16 }}>Back</Text>
        </Pressable>
        <Text style={{ ...typography.bodyBold, color: colors.foreground, fontSize: 17 }}>Notifications</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView indicatorStyle={isDark ? 'white' : 'default'} contentContainerStyle={{ paddingBottom: 40 }}>
        {renderGroup('Channels', channels)}
        {renderGroup('Activity', activityItems)}
      </ScrollView>
    </SafeAreaView>
  );
}
