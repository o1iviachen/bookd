import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../context/ThemeContext';
import { TeamLogo } from './TeamLogo';
import { Match } from '../../types/match';
import { formatMatchTime } from '../../utils/formatDate';
import { PulsingDot } from '../ui/PulsingDot';

interface CompactMatchRowProps {
  match: Match;
  onPress?: () => void;
}

export function CompactMatchRow({ match, onPress }: CompactMatchRowProps) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const { colors, spacing, typography } = theme;

  const isLive = match.status === 'IN_PLAY' || match.status === 'PAUSED';
  const isHT = match.statusShort === 'HT';
  const isBT = match.statusShort === 'BT';
  const isFinished = match.status === 'FINISHED';
  const showScore = isFinished || isLive;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: spacing.sm + 2,
        paddingHorizontal: spacing.md,
        backgroundColor: pressed ? colors.accent : 'transparent',
        borderLeftWidth: isLive ? 3 : 0,
        borderLeftColor: isLive ? '#00e054' : 'transparent',
      })}
    >
      <TeamLogo uri={match.homeTeam.crest} size={24} />
      <Text
        style={{
          ...typography.body,
          color: colors.foreground,
          flex: 1,
          marginLeft: spacing.sm,
        }}
        numberOfLines={1}
      >
        {match.homeTeam.shortName}
      </Text>

      <View style={{ alignItems: 'center', minWidth: 60 }}>
        {showScore ? (
          <Text
            style={{
              ...typography.bodyBold,
              color: isLive ? colors.primary : colors.foreground,
            }}
          >
            {match.homeScore} - {match.awayScore}
          </Text>
        ) : (
          <Text style={{ ...typography.caption, color: colors.textSecondary }}>
            {formatMatchTime(match.kickoff)}
          </Text>
        )}
        {isLive && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 1 }}>
            {isHT || isBT ? (
              <Text style={{ fontSize: 10, fontWeight: '700', color: '#00e054' }}>
                {isHT ? t('common.halfTime') : t('common.breakTime')}
              </Text>
            ) : (
              <>
                <PulsingDot />
                <Text style={{ fontSize: 10, fontWeight: '700', color: '#00e054' }}>
                  {match.elapsed != null ? `${match.elapsed}'` : ''}
                </Text>
              </>
            )}
          </View>
        )}
      </View>

      <Text
        style={{
          ...typography.body,
          color: colors.foreground,
          flex: 1,
          textAlign: 'right',
          marginRight: spacing.sm,
        }}
        numberOfLines={1}
      >
        {match.awayTeam.shortName}
      </Text>
      <TeamLogo uri={match.awayTeam.crest} size={24} />
      {!isFinished && !isLive && (
        <Ionicons name="lock-closed" size={12} color={colors.textSecondary} style={{ marginLeft: spacing.xs }} />
      )}
    </Pressable>
  );
}
