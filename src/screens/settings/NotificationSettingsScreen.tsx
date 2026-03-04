import React, { useState, useEffect } from 'react';
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

const DEFAULT_PREFS: NotificationPreferences = {
  pushEnabled: true,
  emailEnabled: false,
  reviewLikes: true,
  reviewComments: true,
  commentLikes: true,
  listLikes: true,
  listComments: true,
  follows: true,
  matchEvents: true,
};

export function NotificationSettingsScreen() {
  const { theme, isDark } = useTheme();
  const { colors, spacing, typography, borderRadius } = theme;
  const navigation = useNavigation();
  const { user } = useAuth();
  const { data: profile } = useUserProfile(user?.uid || '');

  const [prefs, setPrefs] = useState<NotificationPreferences>(DEFAULT_PREFS);

  // Sync from profile on load
  useEffect(() => {
    if (profile?.notificationPreferences) {
      setPrefs(profile.notificationPreferences);
    }
  }, [profile?.notificationPreferences]);

  const applyPrefs = (updated: NotificationPreferences) => {
    setPrefs(updated);
    if (user) updateUserProfile(user.uid, { notificationPreferences: updated });
  };

  const toggle = (key: keyof NotificationPreferences, value: boolean) => {
    applyPrefs({ ...prefs, [key]: value });
  };

  const toggleAllPush = (enabled: boolean) => {
    applyPrefs({
      ...prefs,
      pushEnabled: enabled,
      reviewLikes: enabled,
      reviewComments: enabled,
      commentLikes: enabled,
      listLikes: enabled,
      listComments: enabled,
      follows: enabled,
      matchEvents: enabled,
    });
  };

  const pushItems: ToggleItem[] = [
    { label: 'Review Likes', description: 'When someone likes your review', key: 'reviewLikes' },
    { label: 'Review Comments', description: 'When someone comments on your review', key: 'reviewComments' },
    { label: 'Comment Likes', description: 'When someone likes your comment', key: 'commentLikes' },
    { label: 'List Likes', description: 'When someone likes your list', key: 'listLikes' },
    { label: 'List Comments', description: 'When someone comments on your list', key: 'listComments' },
    { label: 'New Followers', description: 'When someone starts following you', key: 'follows' },
    { label: 'Match Events', description: 'Pre-kickoff and post-match alerts for your teams', key: 'matchEvents' },
  ];

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
        {/* Email */}
        <View style={{ marginTop: spacing.lg, paddingHorizontal: spacing.md }}>
          <Text style={{ fontSize: 11, fontWeight: '600', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 1, marginBottom: spacing.sm, marginLeft: spacing.xs }}>
            Email
          </Text>
          <View style={{ backgroundColor: colors.card, borderRadius: borderRadius.md, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing.md, paddingHorizontal: spacing.md }}>
              <View style={{ flex: 1, marginRight: spacing.md }}>
                <Text style={{ ...typography.body, color: colors.foreground }}>Email Communication</Text>
                <Text style={{ ...typography.small, color: colors.textSecondary, marginTop: 2 }}>Receive updates and announcements via email</Text>
              </View>
              <Switch
                value={prefs.emailEnabled}
                onValueChange={(v) => toggle('emailEnabled', v)}
                trackColor={{ false: colors.muted, true: colors.primary }}
                thumbColor="#fff"
              />
            </View>
          </View>
        </View>

        {/* Push Notifications */}
        <View style={{ marginTop: spacing.lg, paddingHorizontal: spacing.md }}>
          <Text style={{ fontSize: 11, fontWeight: '600', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 1, marginBottom: spacing.sm, marginLeft: spacing.xs }}>
            Push Notifications
          </Text>
          <View style={{ backgroundColor: colors.card, borderRadius: borderRadius.md, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' }}>
            {/* Master toggle */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing.md, paddingHorizontal: spacing.md }}>
              <View style={{ flex: 1, marginRight: spacing.md }}>
                <Text style={{ ...typography.body, color: colors.foreground, fontWeight: '600' }}>Allow Push Notifications</Text>
                <Text style={{ ...typography.small, color: colors.textSecondary, marginTop: 2 }}>Receive notifications on your device</Text>
              </View>
              <Switch
                value={prefs.pushEnabled}
                onValueChange={toggleAllPush}
                trackColor={{ false: colors.muted, true: colors.primary }}
                thumbColor="#fff"
              />
            </View>

            {/* Individual push items */}
            {pushItems.map((item) => (
              <View
                key={item.key}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingVertical: spacing.md,
                  paddingHorizontal: spacing.md,
                  borderTopWidth: 1,
                  borderTopColor: colors.border,
                  opacity: prefs.pushEnabled ? 1 : 0.4,
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
                  disabled={!prefs.pushEnabled}
                />
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
