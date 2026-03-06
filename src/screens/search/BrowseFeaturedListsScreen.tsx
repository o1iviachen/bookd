import React from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { useRecentLists } from '../../hooks/useLists';
import { ListPreviewCard } from '../../components/list/ListPreviewCard';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { SearchStackParamList } from '../../types/navigation';
import { useTranslation } from 'react-i18next';

type Nav = NativeStackNavigationProp<SearchStackParamList, 'BrowseFeaturedLists'>;

export function BrowseFeaturedListsScreen() {
  const { theme, isDark } = useTheme();
  const { colors, spacing, typography } = theme;
  const navigation = useNavigation<Nav>();
  const { t } = useTranslation();
  const { data: lists, isLoading } = useRecentLists();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border }}>
        <Pressable onPress={() => navigation.goBack()} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Ionicons name="chevron-back" size={22} color={colors.primary} />
          <Text style={{ color: colors.primary, fontSize: 16 }}>{t('common.search')}</Text>
        </Pressable>
        <Text style={{ ...typography.bodyBold, color: colors.foreground, fontSize: 17 }}>{t('search.featuredListsTitle')}</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} indicatorStyle={isDark ? 'white' : 'default'} style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 100 }}>
        {isLoading ? (
          <View style={{ marginTop: spacing.xxl }}><LoadingSpinner fullScreen={false} /></View>
        ) : !lists || lists.length === 0 ? (
          <View style={{ alignItems: 'center', marginTop: spacing.xxl * 2 }}>
            <Ionicons name="list-outline" size={48} color={colors.textSecondary} />
            <Text style={{ ...typography.body, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.md }}>
              {t('search.noFeaturedListsYet')}
            </Text>
          </View>
        ) : (
          lists.map((list) => (
            <ListPreviewCard
              key={list.id}
              list={list}
              onPress={() => navigation.navigate('ListDetail', { listId: list.id })}
              onMatchPress={(matchId) => navigation.navigate('MatchDetail', { matchId })}
            />
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
