import React, { useState, useMemo } from 'react';
import { View, Text, ScrollView, Pressable, TextInput as RNTextInput, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { updateUserProfile } from '../../services/firestore/users';
import { TeamLogo } from '../../components/match/TeamLogo';
import { POPULAR_TEAMS } from '../../utils/constants';
import { useSearchTeams } from '../../hooks/useTeams';
import { nationalityFlag } from '../../utils/flagEmoji';

const MAX_CLUBS = 2;

const POPULAR_COUNTRIES = [
  'England', 'Spain', 'Germany', 'France', 'Italy',
  'Netherlands', 'Portugal', 'Brazil', 'Argentina',
  'Belgium', 'Scotland', 'USA', 'Mexico', 'Japan',
  'Australia', 'Turkey', 'Croatia', 'Switzerland',
  'Colombia', 'Uruguay', 'Nigeria', 'Senegal',
  'Morocco', 'South Korea', 'Denmark', 'Sweden',
  'Norway', 'Poland', 'Austria', 'Serbia',
];

export function OnboardingTeamsScreen() {
  const navigation = useNavigation<any>();
  const { theme, isDark } = useTheme();
  const { colors, spacing, typography, borderRadius } = theme;
  const { user } = useAuth();

  const [selectedClubs, setSelectedClubs] = useState<string[]>([]);
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const { data: firestoreResults, isLoading: searchLoading } = useSearchTeams(searchQuery, searchQuery.length >= 2);

  const atMaxClubs = selectedClubs.length >= MAX_CLUBS;

  const toggleClub = (teamId: string) => {
    setSelectedClubs((prev) => {
      if (prev.includes(teamId)) return prev.filter((id) => id !== teamId);
      if (prev.length >= MAX_CLUBS) return prev;
      return [...prev, teamId];
    });
  };

  const toggleCountry = (country: string) => {
    setSelectedCountry((prev) => prev === country ? null : country);
  };

  const handleNext = async () => {
    if (user && (selectedClubs.length > 0 || selectedCountry)) {
      await updateUserProfile(user.uid, {
        favoriteTeams: selectedClubs,
        followedTeamIds: selectedClubs,
        favoriteCountry: selectedCountry,
      });
    }
    navigation.navigate('OnboardingMatches');
  };

  const handleSkip = () => {
    navigation.navigate('OnboardingMatches');
  };

  const filteredPopular = useMemo(() => {
    if (!searchQuery.trim()) return POPULAR_TEAMS;
    const q = searchQuery.toLowerCase();
    return POPULAR_TEAMS.filter(
      (t) => t.name.toLowerCase().includes(q) || t.league.toLowerCase().includes(q)
    );
  }, [searchQuery]);

  const popularIds = new Set(POPULAR_TEAMS.map((t) => t.id));
  const leagues = [...new Set(filteredPopular.map((t) => t.league))];

  const extraTeams = useMemo(() => {
    if (!firestoreResults || searchQuery.length < 2) return [];
    return firestoreResults.filter((t) => !popularIds.has(String(t.id)));
  }, [firestoreResults, searchQuery, popularIds]);

  const filteredCountries = useMemo(() => {
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return POPULAR_COUNTRIES.filter((c) => c.toLowerCase().includes(q));
    }
    return POPULAR_COUNTRIES;
  }, [searchQuery]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      {/* Header */}
      <View style={{ paddingHorizontal: spacing.md, paddingVertical: spacing.md }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm }}>
          <Text style={{ ...typography.h3, color: colors.foreground }}>Pick Your Teams</Text>
          <Pressable onPress={handleSkip}>
            <Text style={{ color: colors.textSecondary, fontSize: 16 }}>Skip</Text>
          </Pressable>
        </View>
        <Text style={{ ...typography.body, color: colors.textSecondary }}>
          Choose up to {MAX_CLUBS} clubs and 1 country. You can change this later.
        </Text>
      </View>

      {/* Search bar */}
      <View style={{ paddingHorizontal: spacing.md, paddingBottom: spacing.sm }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.muted, borderRadius: borderRadius.md, paddingHorizontal: 12 }}>
          <Ionicons name="search" size={18} color={colors.textSecondary} />
          <RNTextInput
            placeholder="Search any team..."
            placeholderTextColor={colors.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="none"
            autoCorrect={false}
            textContentType="none"
            autoComplete="off"
            style={{
              flex: 1,
              paddingLeft: 10,
              paddingVertical: 10,
              color: colors.foreground,
              fontSize: 14,
            }}
          />
          {searchQuery.length > 0 && (
            <Pressable onPress={() => setSearchQuery('')}>
              <Ionicons name="close" size={18} color={colors.textSecondary} />
            </Pressable>
          )}
        </View>
      </View>

      <ScrollView indicatorStyle={isDark ? 'white' : 'default'} contentContainerStyle={{ paddingBottom: 120 }}>
        {/* Clubs section header */}
        {leagues.length > 0 && (
          <View style={{ paddingHorizontal: spacing.md, marginTop: spacing.sm, marginBottom: -spacing.sm }}>
            <Text style={{ fontSize: 11, fontWeight: '600', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 1, marginLeft: spacing.xs }}>
              Clubs ({selectedClubs.length}/{MAX_CLUBS})
            </Text>
          </View>
        )}

        {/* Popular teams grouped by league */}
        {leagues.map((league) => (
          <View key={league} style={{ marginTop: spacing.lg, paddingHorizontal: spacing.md }}>
            <Text style={{ fontSize: 11, fontWeight: '600', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 1, marginBottom: spacing.sm, marginLeft: spacing.xs }}>
              {league}
            </Text>
            <View style={{ backgroundColor: colors.card, borderRadius: borderRadius.md, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' }}>
              {filteredPopular.filter((t) => t.league === league).map((team, i) => {
                const isSelected = selectedClubs.includes(team.id);
                const isDisabled = atMaxClubs && !isSelected;
                return (
                  <Pressable
                    key={team.id}
                    onPress={() => !isDisabled && toggleClub(team.id)}
                    style={({ pressed }) => ({
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      paddingVertical: spacing.sm + 2,
                      paddingHorizontal: spacing.md,
                      backgroundColor: pressed && !isDisabled ? colors.accent : 'transparent',
                      borderTopWidth: i > 0 ? 1 : 0,
                      borderTopColor: colors.border,
                      opacity: isDisabled ? 0.35 : 1,
                    })}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                      <TeamLogo uri={team.crest} size={32} />
                      <Text style={{ ...typography.body, color: colors.foreground }}>{team.name}</Text>
                    </View>
                    <Ionicons
                      name={isSelected ? 'checkmark-circle' : 'ellipse-outline'}
                      size={24}
                      color={isSelected ? colors.primary : colors.textSecondary}
                    />
                  </Pressable>
                );
              })}
            </View>
          </View>
        ))}

        {/* Extra teams from Firestore search */}
        {extraTeams.length > 0 && (
          <View style={{ marginTop: spacing.lg, paddingHorizontal: spacing.md }}>
            <Text style={{ fontSize: 11, fontWeight: '600', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 1, marginBottom: spacing.sm, marginLeft: spacing.xs }}>
              More results
            </Text>
            <View style={{ backgroundColor: colors.card, borderRadius: borderRadius.md, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' }}>
              {extraTeams.map((team, i) => {
                const teamId = String(team.id);
                const isSelected = selectedClubs.includes(teamId);
                const isDisabled = atMaxClubs && !isSelected;
                return (
                  <Pressable
                    key={teamId}
                    onPress={() => !isDisabled && toggleClub(teamId)}
                    style={({ pressed }) => ({
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      paddingVertical: spacing.sm + 2,
                      paddingHorizontal: spacing.md,
                      backgroundColor: pressed && !isDisabled ? colors.accent : 'transparent',
                      borderTopWidth: i > 0 ? 1 : 0,
                      borderTopColor: colors.border,
                      opacity: isDisabled ? 0.35 : 1,
                    })}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                      <TeamLogo uri={team.crest} size={32} />
                      <View>
                        <Text style={{ ...typography.body, color: colors.foreground }}>{team.name}</Text>
                        {team.country ? <Text style={{ ...typography.caption, color: colors.textSecondary }}>{team.country}</Text> : null}
                      </View>
                    </View>
                    <Ionicons
                      name={isSelected ? 'checkmark-circle' : 'ellipse-outline'}
                      size={24}
                      color={isSelected ? colors.primary : colors.textSecondary}
                    />
                  </Pressable>
                );
              })}
            </View>
          </View>
        )}

        {searchLoading && searchQuery.length >= 2 && (
          <ActivityIndicator style={{ paddingVertical: spacing.md }} color={colors.primary} />
        )}

        {/* Country section */}
        {filteredCountries.length > 0 && (
          <View style={{ marginTop: spacing.lg, paddingHorizontal: spacing.md }}>
            <Text style={{ fontSize: 11, fontWeight: '600', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 1, marginBottom: spacing.sm, marginLeft: spacing.xs }}>
              Country {selectedCountry ? '(1/1)' : '(0/1)'}
            </Text>
            <View style={{ backgroundColor: colors.card, borderRadius: borderRadius.md, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' }}>
              {filteredCountries.map((country, i) => {
                const isSelected = selectedCountry === country;
                const flag = nationalityFlag(country);
                return (
                  <Pressable
                    key={country}
                    onPress={() => toggleCountry(country)}
                    style={({ pressed }) => ({
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      paddingVertical: spacing.sm + 2,
                      paddingHorizontal: spacing.md,
                      backgroundColor: pressed ? colors.accent : 'transparent',
                      borderTopWidth: i > 0 ? 1 : 0,
                      borderTopColor: colors.border,
                    })}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                      <Text style={{ fontSize: 24 }}>{flag}</Text>
                      <Text style={{ ...typography.body, color: colors.foreground }}>{country}</Text>
                    </View>
                    <Ionicons
                      name={isSelected ? 'checkmark-circle' : 'ellipse-outline'}
                      size={24}
                      color={isSelected ? colors.primary : colors.textSecondary}
                    />
                  </Pressable>
                );
              })}
            </View>
          </View>
        )}

        {leagues.length === 0 && extraTeams.length === 0 && filteredCountries.length === 0 && !searchLoading && (
          <View style={{ alignItems: 'center', marginTop: spacing.xxl * 2 }}>
            <Text style={{ ...typography.body, color: colors.textSecondary }}>No results found</Text>
          </View>
        )}
      </ScrollView>

      {/* Bottom button */}
      <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: colors.background, paddingHorizontal: spacing.md, paddingBottom: spacing.xl, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.border }}>
        <Pressable
          onPress={handleNext}
          style={{
            backgroundColor: colors.primary,
            borderRadius: borderRadius.md,
            paddingVertical: 14,
            alignItems: 'center',
          }}
        >
          <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>Next</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
