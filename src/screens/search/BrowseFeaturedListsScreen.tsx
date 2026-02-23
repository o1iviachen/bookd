import React from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { useRecentLists } from '../../hooks/useLists';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';

export function BrowseFeaturedListsScreen() {
  const { theme, isDark } = useTheme();
  const { colors, spacing, typography, borderRadius } = theme;
  const navigation = useNavigation();
  const { data: lists, isLoading } = useRecentLists();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border }}>
        <Pressable onPress={() => navigation.goBack()} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Ionicons name="chevron-back" size={22} color={colors.primary} />
          <Text style={{ color: colors.primary, fontSize: 16 }}>Search</Text>
        </Pressable>
        <Text style={{ ...typography.bodyBold, color: colors.foreground, fontSize: 17 }}>Featured Lists</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView indicatorStyle={isDark ? 'white' : 'default'} style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 100, paddingHorizontal: spacing.md, paddingTop: spacing.md }}>
        {isLoading ? (
          <View style={{ marginTop: spacing.xxl }}><LoadingSpinner fullScreen={false} /></View>
        ) : !lists || lists.length === 0 ? (
          <View style={{ alignItems: 'center', marginTop: spacing.xxl * 2 }}>
            <Ionicons name="list-outline" size={48} color={colors.textSecondary} />
            <Text style={{ ...typography.body, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.md }}>
              No featured lists yet
            </Text>
          </View>
        ) : (
          lists.map((list) => (
            <Pressable
              key={list.id}
              style={{
                paddingVertical: spacing.md,
                borderBottomWidth: 1,
                borderBottomColor: colors.border,
              }}
            >
              <Text style={{ ...typography.bodyBold, color: colors.foreground, fontSize: 17 }}>{list.name}</Text>
              {list.description ? (
                <Text style={{ ...typography.body, color: colors.textSecondary, marginTop: spacing.xs }} numberOfLines={2}>
                  {list.description}
                </Text>
              ) : null}
              <Text style={{ ...typography.small, color: colors.textSecondary, marginTop: spacing.xs }}>
                {list.username} · {list.matchIds.length} matches
              </Text>
            </Pressable>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
