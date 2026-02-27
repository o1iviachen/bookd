import React from 'react';
import { View, Text, ScrollView, Pressable, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useTheme } from '../../context/ThemeContext';
import { usePersonDetail } from '../../hooks/usePeople';
import { usePersonMatches } from '../../hooks/useTeams';
import { MatchPosterCard } from '../../components/match/MatchPosterCard';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';

export function PersonDetailScreen({ route, navigation }: any) {
  const { theme, isDark } = useTheme();
  const { colors, spacing, typography, borderRadius } = theme;
  const { personId, personName, role } = route.params as {
    personId: number;
    personName: string;
    role: 'player' | 'manager';
  };
  const { width: screenWidth } = useWindowDimensions();

  const { data: person, isLoading: personLoading } = usePersonDetail(personId);

  // Fetch matches where this person appeared in the lineup/bench/coaching staff
  const { data: personMatches, isLoading: matchesLoading } = usePersonMatches(personId);

  const POSTER_GAP = spacing.sm;
  const COLUMNS = 3;
  const POSTER_WIDTH = (screenWidth - spacing.md * 2 - POSTER_GAP * (COLUMNS - 1)) / COLUMNS;

  // Already sorted by date descending from the query
  const sortedMatches = (personMatches || []).map((a) => a.match);

  const positionLabel = (pos: string | null) => {
    if (!pos) return null;
    switch (pos) {
      case 'Goalkeeper': return 'GK';
      case 'Defence': return 'DEF';
      case 'Midfield': return 'MID';
      case 'Offence': return 'FWD';
      default: return pos;
    }
  };

  const isManager = role === 'manager';
  const sectionTitle = isManager
    ? `Managed ${sortedMatches.length} ${sortedMatches.length === 1 ? 'match' : 'matches'}`
    : `Appeared in ${sortedMatches.length} ${sortedMatches.length === 1 ? 'match' : 'matches'}`;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border }}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={8}>
          <Ionicons name="arrow-back" size={22} color={colors.foreground} />
        </Pressable>
        <Text style={{ ...typography.bodyBold, color: colors.foreground, flex: 1, textAlign: 'center', fontSize: 17 }} numberOfLines={1}>
          {personName}
        </Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView style={{ flex: 1 }} indicatorStyle={isDark ? 'white' : 'default'}>
        {/* Person info */}
        <View style={{ padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border }}>
          {personLoading ? (
            <View style={{ paddingVertical: spacing.lg, alignItems: 'center' }}><LoadingSpinner fullScreen={false} /></View>
          ) : person ? (
            <View>
              <Text style={{ ...typography.h3, color: colors.foreground, marginBottom: spacing.sm }}>
                {person.name}
              </Text>

              {/* Badges row */}
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginBottom: spacing.md }}>
                {!isManager && person.position && (
                  <View style={{ backgroundColor: colors.primary, paddingHorizontal: 10, paddingVertical: 3, borderRadius: borderRadius.full }}>
                    <Text style={{ fontSize: 11, fontWeight: '700', color: '#14181c' }}>{positionLabel(person.position)}</Text>
                  </View>
                )}
                {isManager && (
                  <View style={{ backgroundColor: colors.primary, paddingHorizontal: 10, paddingVertical: 3, borderRadius: borderRadius.full }}>
                    <Text style={{ fontSize: 11, fontWeight: '700', color: '#14181c' }}>Manager</Text>
                  </View>
                )}
                {person.nationality && (
                  <View style={{ backgroundColor: colors.muted, paddingHorizontal: 10, paddingVertical: 3, borderRadius: borderRadius.full }}>
                    <Text style={{ fontSize: 11, fontWeight: '500', color: colors.foreground }}>{person.nationality}</Text>
                  </View>
                )}
                {!isManager && person.shirtNumber != null && (
                  <View style={{ backgroundColor: colors.muted, paddingHorizontal: 10, paddingVertical: 3, borderRadius: borderRadius.full }}>
                    <Text style={{ fontSize: 11, fontWeight: '500', color: colors.foreground }}>#{person.shirtNumber}</Text>
                  </View>
                )}
              </View>

              {/* Info rows */}
              <View style={{ gap: spacing.sm }}>
                {person.currentTeam && (
                  <Pressable
                    onPress={() => navigation.navigate('TeamDetail', {
                      teamId: person.currentTeam!.id,
                      teamName: person.currentTeam!.name,
                      teamCrest: person.currentTeam!.crest,
                    })}
                    style={({ pressed }) => ({
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: spacing.sm,
                      opacity: pressed ? 0.7 : 1,
                    })}
                  >
                    <Image source={{ uri: person.currentTeam.crest }} style={{ width: 24, height: 24 }} contentFit="contain" />
                    <Text style={{ ...typography.body, color: colors.foreground, flex: 1 }}>{person.currentTeam.name}</Text>
                    <Ionicons name="chevron-forward" size={14} color={colors.textSecondary} />
                  </Pressable>
                )}
                {person.dateOfBirth && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                    <Ionicons name="calendar-outline" size={16} color={colors.textSecondary} />
                    <Text style={{ ...typography.caption, color: colors.textSecondary }}>
                      Born {new Date(person.dateOfBirth).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
                    </Text>
                  </View>
                )}
              </View>
            </View>
          ) : (
            <Text style={{ ...typography.body, color: colors.textSecondary }}>Unable to load person info</Text>
          )}
        </View>

        {/* Matches section */}
        <View style={{ padding: spacing.md }}>
          {sortedMatches.length > 0 && (
            <Text style={{ fontSize: 11, fontWeight: '600', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 1, marginBottom: spacing.sm }}>
              {sectionTitle}
            </Text>
          )}

          {matchesLoading ? (
            <View style={{ paddingVertical: spacing.xxl }}><LoadingSpinner fullScreen={false} /></View>
          ) : sortedMatches.length === 0 ? (
            <View style={{ alignItems: 'center', paddingVertical: spacing.xxl }}>
              <Ionicons name="football-outline" size={48} color={colors.textSecondary} />
              <Text style={{ ...typography.body, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.md }}>
                No matches found
              </Text>
            </View>
          ) : (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: POSTER_GAP }}>
              {sortedMatches.map((match) => (
                <MatchPosterCard
                  key={match.id}
                  match={match}
                  width={POSTER_WIDTH}
                  onPress={() => navigation.navigate('MatchDetail', { matchId: match.id })}
                />
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
