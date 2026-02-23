import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { useUserProfile } from '../../hooks/useUser';
import { updateUserProfile } from '../../services/firestore/users';
import { TeamLogo } from '../../components/match/TeamLogo';
import { FOLLOWABLE_LEAGUES } from '../../utils/constants';
import { useQueryClient } from '@tanstack/react-query';

export function FavouriteLeaguesScreen() {
  const { theme } = useTheme();
  const { colors, spacing, typography, borderRadius } = theme;
  const navigation = useNavigation();
  const { user } = useAuth();
  const { data: profile } = useUserProfile(user?.uid || '');
  const queryClient = useQueryClient();

  const [selected, setSelected] = useState<string[]>([]);

  useEffect(() => {
    if (profile?.followedLeagues) {
      setSelected(profile.followedLeagues);
    }
  }, [profile?.followedLeagues]);

  const toggle = (leagueId: string) => {
    setSelected((prev) =>
      prev.includes(leagueId) ? prev.filter((id) => id !== leagueId) : [...prev, leagueId]
    );
  };

  const save = async () => {
    if (!user) return;
    await updateUserProfile(user.uid, { followedLeagues: selected });
    queryClient.invalidateQueries({ queryKey: ['user', user.uid] });
    navigation.goBack();
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border }}>
        <Pressable onPress={() => navigation.goBack()} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Ionicons name="chevron-back" size={22} color={colors.primary} />
          <Text style={{ color: colors.primary, fontSize: 16 }}>Back</Text>
        </Pressable>
        <Text style={{ ...typography.bodyBold, color: colors.foreground, fontSize: 17 }}>Favourite Leagues</Text>
        <Pressable onPress={save}>
          <Text style={{ color: colors.primary, fontSize: 16, fontWeight: '600' }}>Save</Text>
        </Pressable>
      </View>

      <Text style={{ ...typography.caption, color: colors.textSecondary, paddingHorizontal: spacing.md, paddingTop: spacing.md, paddingBottom: spacing.sm }}>
        Matches from selected leagues will appear on your feed.
      </Text>

      <ScrollView contentContainerStyle={{ paddingBottom: 100 }}>
        <View style={{ paddingHorizontal: spacing.md }}>
          <View style={{ backgroundColor: colors.card, borderRadius: borderRadius.md, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' }}>
            {FOLLOWABLE_LEAGUES.map((league, i) => {
              const isSelected = selected.includes(league.id);
              return (
                <Pressable
                  key={league.id}
                  onPress={() => toggle(league.id)}
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
                    <View style={{ backgroundColor: '#fff', borderRadius: 8, padding: 4 }}>
                      <TeamLogo uri={league.emblem} size={28} />
                    </View>
                    <View>
                      <Text style={{ ...typography.body, color: colors.foreground }}>{league.name}</Text>
                      <Text style={{ ...typography.small, color: colors.textSecondary }}>{league.country}</Text>
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
      </ScrollView>
    </SafeAreaView>
  );
}
