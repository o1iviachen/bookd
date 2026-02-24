import React from 'react';
import { View, Text, Pressable, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { Match } from '../../types/match';
import { formatMatchDate } from '../../utils/formatDate';
import { getTeamColor } from '../../utils/teamColors';

interface MatchPosterCardCrestProps {
  match: Match;
  onPress?: () => void;
  width?: number;
}

export function MatchPosterCardCrest({ match, onPress, width: widthProp }: MatchPosterCardCrestProps) {
  const { theme } = useTheme();
  const { spacing } = theme;
  const { width: screenWidth } = useWindowDimensions();

  const CARD_WIDTH = widthProp || (screenWidth - spacing.md * 3) / 2.5;
  const CARD_HEIGHT = CARD_WIDTH * 1.5;
  const CREST_SIZE = CARD_WIDTH * 0.32;

  const homeColor = getTeamColor(match.homeTeam.id, match.homeTeam.name);
  const awayColor = getTeamColor(match.awayTeam.id, match.awayTeam.name);

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
      {/* Split diagonal gradient: home color top-left, away color bottom-right */}
      <LinearGradient
        colors={[homeColor, awayColor]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ flex: 1 }}
      >
        {/* Team crests - side by side in the upper portion */}
        <View
          style={{
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            paddingHorizontal: spacing.sm,
            paddingBottom: CARD_HEIGHT * 0.1,
            gap: CARD_WIDTH * 0.06,
          }}
        >
          {/* Home crest */}
          <Image
            source={{ uri: match.homeTeam.crest }}
            style={{
              width: CREST_SIZE,
              height: CREST_SIZE,
            }}
            contentFit="contain"
          />

          {/* Away crest */}
          <Image
            source={{ uri: match.awayTeam.crest }}
            style={{
              width: CREST_SIZE,
              height: CREST_SIZE,
            }}
            contentFit="contain"
          />
        </View>

        {/* Dark overlay for text readability at bottom */}
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.5)', 'rgba(0,0,0,0.92)']}
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: '50%',
            justifyContent: 'flex-end',
            padding: spacing.sm + 2,
          }}
        >
          {/* Score */}
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

          {/* LIVE badge */}
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

        {/* Upcoming lock badge */}
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

        {/* Tiny competition emblem in top-left corner */}
        <View
          style={{
            position: 'absolute',
            top: spacing.sm,
            left: spacing.sm,
            backgroundColor: 'rgba(255,255,255,0.85)',
            borderRadius: 4,
            padding: 2,
          }}
        >
          <Image
            source={{ uri: match.competition.emblem }}
            style={{
              width: CARD_WIDTH * 0.14,
              height: CARD_WIDTH * 0.14,
            }}
            contentFit="contain"
          />
        </View>
      </LinearGradient>
    </Pressable>
  );
}
