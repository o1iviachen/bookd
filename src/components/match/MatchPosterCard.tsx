import React from 'react';
import { View, Text, Pressable, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../context/ThemeContext';
import { Match } from '../../types/match';
import { formatMatchDate } from '../../utils/formatDate';
import { getTeamColor } from '../../utils/teamColors';
import { PulsingDot } from '../ui/PulsingDot';

interface MatchPosterCardProps {
  match: Match;
  onPress?: () => void;
  width?: number;
  compact?: boolean;
  selected?: boolean;
}

export const MatchPosterCard = React.memo(function MatchPosterCard({ match, onPress, width: widthProp, compact, selected }: MatchPosterCardProps) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const { spacing } = theme;
  const { width: screenWidth } = useWindowDimensions();

  const CARD_WIDTH = widthProp || (screenWidth - spacing.md * 3) / 2.5;
  const CARD_HEIGHT = CARD_WIDTH * 1.5;

  const homeColor = getTeamColor(match.homeTeam.id, match.homeTeam.name);
  const awayColor = getTeamColor(match.awayTeam.id, match.awayTeam.name);

  const isFinished = match.status === 'FINISHED';
  const isLive = match.status === 'IN_PLAY' || match.status === 'PAUSED';
  const isUpcoming = !isFinished && !isLive;
  const isHT = match.statusShort === 'HT';
  const isBT = match.statusShort === 'BT';

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
        borderWidth: selected ? 1.5 : 0,
        borderColor: selected ? '#00e054' : 'transparent',
      })}
    >
      {/* Team kit color gradient background */}
      <LinearGradient
        colors={[homeColor, awayColor]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ flex: 1 }}
      >
        {/* Team crests */}
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: compact ? 0 : CARD_HEIGHT * 0.12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: CARD_WIDTH * 0.08 }}>
            <Image
              source={{ uri: match.homeTeam.crest }}
              style={{
                width: CARD_WIDTH * 0.32,
                height: CARD_WIDTH * 0.32,
              }}
              contentFit="contain"
              transition={200}
            />
            <Image
              source={{ uri: match.awayTeam.crest }}
              style={{
                width: CARD_WIDTH * 0.32,
                height: CARD_WIDTH * 0.32,
              }}
              contentFit="contain"
              transition={200}
            />
          </View>
        </View>

        {/* Dark overlay for score readability */}
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.4)', 'rgba(0,0,0,0.9)']}
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: compact ? '40%' : '55%',
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
                marginBottom: compact ? 0 : 2,
              }}
            >
              {match.homeScore} - {match.awayScore}
            </Text>
          ) : null}

          {/* LIVE / HT / BT badge */}
          {isLive && (
            <View
              style={{
                alignSelf: 'center',
                flexDirection: 'row',
                alignItems: 'center',
                gap: 4,
                backgroundColor: '#00e054',
                paddingHorizontal: 6,
                paddingVertical: 2,
                borderRadius: 3,
                marginBottom: 4,
              }}
            >
              {isHT || isBT ? (
                <Text style={{ fontSize: 9, fontWeight: '800', color: '#14181c' }}>
                  {isHT ? t('common.halfTime') : t('common.breakTime')}
                </Text>
              ) : (
                <>
                  <PulsingDot size={5} color="#14181c" />
                  <Text style={{ fontSize: 9, fontWeight: '800', color: '#14181c' }}>
                    {match.elapsed != null ? `${match.elapsed}'` : ''}
                  </Text>
                </>
              )}
            </View>
          )}

          {/* Team names — hidden in compact mode */}
          {!compact && (
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
          )}

          {/* Competition + date — hidden in compact mode */}
          {!compact && (
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
          )}
        </LinearGradient>

        {/* Competition emblem — top-left badge */}
        <View
          style={{
            position: 'absolute',
            top: spacing.sm,
            left: spacing.sm,
            backgroundColor: 'rgba(255,255,255,0.85)',
            borderRadius: 10,
            padding: 4,
          }}
        >
          <Image
            source={{ uri: match.competition.emblem }}
            style={{ width: CARD_WIDTH * 0.14, height: CARD_WIDTH * 0.14 }}
            contentFit="contain"
          />
        </View>

        {/* Discussion count badge — top-right (live matches) */}
        {isLive && (match.discussionCount ?? 0) > 0 && (
          <View
            style={{
              position: 'absolute',
              top: spacing.sm,
              right: spacing.sm,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 2,
              backgroundColor: 'rgba(0,0,0,0.6)',
              borderRadius: 8,
              paddingHorizontal: 5,
              paddingVertical: 3,
            }}
          >
            <Ionicons name="chatbubble" size={9} color="rgba(255,255,255,0.8)" />
            <Text style={{ fontSize: 8, fontWeight: '700', color: 'rgba(255,255,255,0.8)' }}>
              {match.discussionCount}
            </Text>
          </View>
        )}

        {/* Log count badge — top-right */}
        {!isLive && (match.reviewCount ?? 0) > 0 && (
          <View
            style={{
              position: 'absolute',
              top: spacing.sm,
              right: spacing.sm,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 2,
              backgroundColor: 'rgba(0,0,0,0.6)',
              borderRadius: 8,
              paddingHorizontal: 5,
              paddingVertical: 3,
            }}
          >
            <Ionicons name="eye" size={9} color="rgba(255,255,255,0.8)" />
            <Text style={{ fontSize: 8, fontWeight: '700', color: 'rgba(255,255,255,0.8)' }}>
              {match.reviewCount}
            </Text>
          </View>
        )}

        {/* Upcoming match lock badge */}
        {isUpcoming && (match.reviewCount ?? 0) === 0 && (
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
      </LinearGradient>
    </Pressable>
  );
});
