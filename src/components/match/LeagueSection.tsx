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
  matches: Match[];
  onMatchPress?: (matchId: number) => void;
  defaultExpanded?: boolean;
}

export function LeagueSection({
  leagueName,
  leagueEmblem,
  matches,
  onMatchPress,
  defaultExpanded = true,
}: LeagueSectionProps) {
  const { theme } = useTheme();
  const { colors, spacing, typography, borderRadius } = theme;
  const [expanded, setExpanded] = useState(defaultExpanded);

  return (
    <View style={{ marginBottom: spacing.sm }}>
      <Pressable
        onPress={() => setExpanded(!expanded)}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingVertical: spacing.sm + 2,
          paddingHorizontal: spacing.md,
        }}
      >
        {/* Green indicator bar for followed leagues */}
        <View
          style={{
            width: 3,
            height: 20,
            backgroundColor: colors.primary,
            borderRadius: 2,
            marginRight: spacing.sm,
          }}
        />
        {leagueEmblem && <TeamLogo uri={leagueEmblem} size={20} />}
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
        <Text style={{ ...typography.caption, color: colors.textSecondary, marginRight: spacing.xs }}>
          {matches.length}
        </Text>
        <Ionicons
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={16}
          color={colors.textSecondary}
        />
      </Pressable>

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
