import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../../context/ThemeContext';

type ToggleItem = { label: string; description: string; value: boolean; onToggle: (v: boolean) => void };

export function NotificationSettingsScreen() {
  const { theme, isDark } = useTheme();
  const { colors, spacing, typography, borderRadius } = theme;
  const navigation = useNavigation();

  const [pushEnabled, setPushEnabled] = useState(true);
  const [emailEnabled, setEmailEnabled] = useState(false);

  const [reviewLikes, setReviewLikes] = useState(true);
  const [reviewComments, setReviewComments] = useState(true);
  const [follows, setFollows] = useState(true);
  const [commentLikes, setCommentLikes] = useState(true);
  const [listLikes, setListLikes] = useState(true);
  const [listComments, setListComments] = useState(true);

  const channels: ToggleItem[] = [
    { label: 'Push Notifications', description: 'Receive push notifications on your device', value: pushEnabled, onToggle: setPushEnabled },
    { label: 'Email Notifications', description: 'Receive notifications via email', value: emailEnabled, onToggle: setEmailEnabled },
  ];

  const activityItems: ToggleItem[] = [
    { label: 'Review Likes', description: 'When someone likes your review', value: reviewLikes, onToggle: setReviewLikes },
    { label: 'Review Comments', description: 'When someone comments on your review', value: reviewComments, onToggle: setReviewComments },
    { label: 'Comment Likes', description: 'When someone likes your comment', value: commentLikes, onToggle: setCommentLikes },
    { label: 'List Likes', description: 'When someone likes your list', value: listLikes, onToggle: setListLikes },
    { label: 'List Comments', description: 'When someone comments on your list', value: listComments, onToggle: setListComments },
    { label: 'New Followers', description: 'When someone starts following you', value: follows, onToggle: setFollows },
  ];

  const renderGroup = (title: string, items: ToggleItem[]) => (
    <View style={{ marginTop: spacing.lg, paddingHorizontal: spacing.md }}>
      <Text style={{ fontSize: 11, fontWeight: '600', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 1, marginBottom: spacing.sm, marginLeft: spacing.xs }}>
        {title}
      </Text>
      <View style={{ backgroundColor: colors.card, borderRadius: borderRadius.md, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' }}>
        {items.map((item, i) => (
          <View
            key={item.label}
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
              value={item.value}
              onValueChange={item.onToggle}
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
