import React, { useMemo } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { subDays } from 'date-fns';
import { useTheme } from '../../context/ThemeContext';
import { useMatchesRange } from '../../hooks/useMatches';
import { CompactMatchRow } from '../../components/match/CompactMatchRow';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { SearchStackParamList } from '../../types/navigation';

type Nav = NativeStackNavigationProp<SearchStackParamList, 'BrowsePopular'>;

export function BrowsePopularScreen() {
  const { theme } = useTheme();
  const { colors, spacing, typography, borderRadius } = theme;
  const navigation = useNavigation<Nav>();

  const today = new Date();
  const weekAgo = subDays(today, 7);
  const { data: matches, isLoading } = useMatchesRange(weekAgo, today);

  const popularMatches = useMemo(() => {
    if (!matches) return [];
    return matches.filter((m) => m.status === 'FINISHED').slice(0, 30);
  }, [matches]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border }}>
        <Pressable onPress={() => navigation.goBack()} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Ionicons name="chevron-back" size={22} color={colors.primary} />
          <Text style={{ color: colors.primary, fontSize: 16 }}>Search</Text>
        </Pressable>
        <Text style={{ ...typography.bodyBold, color: colors.foreground, fontSize: 17 }}>Most Popular</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 100, paddingTop: spacing.sm }}>
        {isLoading ? (
          <View style={{ marginTop: spacing.xxl }}><LoadingSpinner fullScreen={false} /></View>
        ) : popularMatches.length === 0 ? (
          <View style={{ alignItems: 'center', marginTop: spacing.xxl * 2 }}>
            <Ionicons name="trending-up-outline" size={48} color={colors.textSecondary} />
            <Text style={{ ...typography.body, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.md }}>
              No popular matches this week
            </Text>
          </View>
        ) : (
          <View style={{ paddingHorizontal: spacing.md }}>
            <View style={{ backgroundColor: colors.card, borderRadius: borderRadius.md, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' }}>
              {popularMatches.map((match, i) => (
                <View key={match.id}>
                  {i > 0 && <View style={{ height: 1, backgroundColor: colors.border, marginHorizontal: spacing.md }} />}
                  <CompactMatchRow match={match} onPress={() => navigation.navigate('MatchDetail', { matchId: match.id })} />
                </View>
              ))}
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
