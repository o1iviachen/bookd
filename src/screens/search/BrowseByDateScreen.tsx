import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { useMatchesByDate } from '../../hooks/useMatches';
import { groupMatchesByCompetition } from '../../services/footballApi';
import { DatePicker } from '../../components/match/DatePicker';
import { LeagueSection } from '../../components/match/LeagueSection';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { SearchStackParamList } from '../../types/navigation';

type Nav = NativeStackNavigationProp<SearchStackParamList, 'BrowseByDate'>;

export function BrowseByDateScreen() {
  const { theme } = useTheme();
  const { colors, spacing, typography } = theme;
  const navigation = useNavigation<Nav>();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const { data: matches, isLoading } = useMatchesByDate(selectedDate);

  const grouped = groupMatchesByCompetition(matches || []);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border }}>
        <Pressable onPress={() => navigation.goBack()} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Ionicons name="chevron-back" size={22} color={colors.primary} />
          <Text style={{ color: colors.primary, fontSize: 16 }}>Search</Text>
        </Pressable>
        <Text style={{ ...typography.bodyBold, color: colors.foreground, fontSize: 17 }}>Browse by Date</Text>
        <View style={{ width: 60 }} />
      </View>

      <View style={{ paddingHorizontal: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border }}>
        <DatePicker selectedDate={selectedDate} onDateChange={setSelectedDate} />
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 100, paddingTop: spacing.sm }}>
        {isLoading ? (
          <View style={{ marginTop: spacing.xxl }}><LoadingSpinner fullScreen={false} /></View>
        ) : grouped.size === 0 ? (
          <View style={{ alignItems: 'center', marginTop: spacing.xxl * 2 }}>
            <Ionicons name="football-outline" size={48} color={colors.textSecondary} />
            <Text style={{ ...typography.body, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.md }}>
              No matches on this date
            </Text>
          </View>
        ) : (
          Array.from(grouped.entries()).map(([league, leagueMatches]) => (
            <LeagueSection
              key={league}
              leagueName={league}
              leagueEmblem={leagueMatches[0]?.competition.emblem}
              matches={leagueMatches}
              onMatchPress={(id) => navigation.navigate('MatchDetail', { matchId: id })}
            />
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
