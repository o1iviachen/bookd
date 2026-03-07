import React, { useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { CompactMatchRow } from './CompactMatchRow';
import { Match } from '../../types/match';
import { TeamLogo } from './TeamLogo';

interface LeagueSectionProps {
  leagueName: string;
  leagueEmblem?: string;
  leagueCode?: string;
  matches: Match[];
  onMatchPress?: (matchId: number) => void;
  onLeaguePress?: () => void;
  defaultExpanded?: boolean;
}

export function LeagueSection({
  leagueName,
  leagueEmblem,
  leagueCode,
  matches,
  onMatchPress,
  onLeaguePress,
  defaultExpanded = true,
}: LeagueSectionProps) {
  const { theme } = useTheme();
  const { colors, spacing, typography, borderRadius } = theme;
  const [expanded, setExpanded] = useState(defaultExpanded);

  return (
    <View style={{ marginBottom: spacing.sm }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingVertical: spacing.sm + 2,
          paddingHorizontal: spacing.md,
        }}
      >
        <Pressable
          onPress={onLeaguePress}
          style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}
          disabled={!onLeaguePress}
        >
          {leagueEmblem && (
            <View style={{ backgroundColor: '#fff', borderRadius: 6, padding: 3 }}>
              <TeamLogo uri={leagueEmblem} size={20} />
            </View>
          )}
          <Text
            style={{
              ...typography.bodyBold,
              color: colors.foreground,
              flex: 1,
              marginLeft: leagueEmblem ? spacing.sm : 0,
            }}
          >
            {leagueName}
          </Text>
        </Pressable>
        <Text style={{ ...typography.caption, color: colors.textSecondary, marginRight: spacing.xs }}>
          {matches.length}
        </Text>
        <Pressable onPress={() => setExpanded(!expanded)} hitSlop={12}>
          <Ionicons
            name={expanded ? 'chevron-up' : 'chevron-down'}
            size={16}
            color={colors.textSecondary}
          />
        </Pressable>
      </View>

      {expanded && (
        <View
          style={{
            backgroundColor: colors.card,
            borderRadius: borderRadius.md,
            marginHorizontal: spacing.md,
            borderWidth: 1,
            borderColor: colors.border,
            overflow: 'hidden',
          }}
        >
          {matches.map((match, index) => (
            <View key={match.id}>
              {index > 0 && (
                <View
                  style={{
                    height: 1,
                    backgroundColor: colors.border,
                    marginHorizontal: spacing.md,
                  }}
                />
              )}
              <CompactMatchRow
                match={match}
                onPress={() => onMatchPress?.(match.id)}
              />
            </View>
          ))}
        </View>
      )}
    </View>
  );
}
