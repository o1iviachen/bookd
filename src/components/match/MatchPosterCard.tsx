import React from 'react';
import { View, Text, Pressable, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { TeamLogo } from './TeamLogo';
import { Match } from '../../types/match';
import { formatMatchDate } from '../../utils/formatDate';

interface MatchPosterCardProps {
  match: Match;
  onPress?: () => void;
  width?: number;
}

export function MatchPosterCard({ match, onPress, width: widthProp }: MatchPosterCardProps) {
  const { theme } = useTheme();
  const { colors, spacing, typography } = theme;
  const { width: screenWidth } = useWindowDimensions();

  const CARD_WIDTH = widthProp || (screenWidth - spacing.md * 3) / 2.5;
  const CARD_HEIGHT = CARD_WIDTH * 1.5;

  const isFinished = match.status === 'FINISHED';
  const isLive = match.status === 'IN_PLAY' || match.status === 'PAUSED';
  const isUpcoming = !isFinished && !isLive;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        width: CARD_WIDTH,
        height: CARD_HEIGHT,
        borderRadius: 4,
        overflow: 'hidden',
        opacity: pressed ? 0.9 : 1,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 6,
        elevation: 6,
      })}
    >
      {/* Dark background with team crests */}
      <View style={{ flex: 1, backgroundColor: '#1a1f25' }}>
        {/* Top area with team crests side by side */}
        <View
          style={{
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: spacing.lg,
            paddingTop: spacing.md,
          }}
        >
          <TeamLogo uri={match.homeTeam.crest} size={CARD_WIDTH * 0.28} />
          <TeamLogo uri={match.awayTeam.crest} size={CARD_WIDTH * 0.28} />
        </View>

        {/* Gradient overlay from bottom */}
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.3)', 'rgba(0,0,0,0.85)']}
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: '65%',
            justifyContent: 'flex-end',
            padding: spacing.sm + 2,
          }}
        >
          {/* Score or time */}
          {(isFinished || isLive) ? (
            <Text
              style={{
                fontSize: CARD_WIDTH * 0.16,
                fontWeight: '700',
                color: '#00e054',
                textAlign: 'center',
                marginBottom: 2,
              }}
            >
              {match.homeScore} - {match.awayScore}
            </Text>
          ) : null}

          {isLive && (
            <View
              style={{
                alignSelf: 'center',
                backgroundColor: '#00e054',
                paddingHorizontal: 6,
                paddingVertical: 1,
                borderRadius: 3,
                marginBottom: 4,
              }}
            >
              <Text style={{ fontSize: 9, fontWeight: '800', color: '#14181c' }}>LIVE</Text>
            </View>
          )}

          {/* Team names */}
          <Text
            style={{
              fontSize: 10,
              fontWeight: '600',
              color: '#ffffff',
              textAlign: 'center',
              letterSpacing: 0.3,
            }}
            numberOfLines={1}
          >
            {match.homeTeam.shortName} v {match.awayTeam.shortName}
          </Text>

          {/* Competition + date */}
          <Text
            style={{
              fontSize: 9,
              color: 'rgba(255,255,255,0.6)',
              textAlign: 'center',
              marginTop: 2,
            }}
            numberOfLines={1}
          >
            {match.competition.code} · {formatMatchDate(match.kickoff)}
          </Text>
        </LinearGradient>

        {/* Upcoming match lock badge */}
        {isUpcoming && (
          <View
            style={{
              position: 'absolute',
              top: spacing.sm,
              right: spacing.sm,
              backgroundColor: 'rgba(0,0,0,0.6)',
              borderRadius: 12,
              padding: 5,
            }}
          >
            <Ionicons name="lock-closed" size={10} color="rgba(255,255,255,0.7)" />
          </View>
        )}
      </View>
    </Pressable>
  );
}
