import React, { useMemo } from 'react';
import { View, Text, Modal, Pressable, ScrollView, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { TeamLogo } from '../match/TeamLogo';
import { lastName, shortName } from '../../utils/formatName';
import {
  MatchPlayer,
  MatchDetail,
  MatchGoal,
  MatchBooking,
  MatchSubstitution,
} from '../../services/footballApi';

// ── Helpers (mirrored from MatchDetailScreen) ──────────────────────────────

function parseFormation(formation: string): number[] {
  return formation.split('-').map(Number).filter((n) => !isNaN(n) && n > 0);
}

function assignPlayersToRows(players: MatchPlayer[], formation: number[]): MatchPlayer[][] {
  const rows: MatchPlayer[][] = [];
  rows.push([players[0]]);
  let idx = 1;
  for (const count of formation) {
    rows.push(players.slice(idx, idx + count));
    idx += count;
  }
  return rows;
}

function buildPlayerEvents(
  goals: MatchGoal[],
  bookings: MatchBooking[],
  substitutions: MatchSubstitution[],
) {
  const map = new Map<number, { goals: number; ownGoals: number; yellowCard: boolean; redCard: boolean; subbedOutMin: number | null }>();
  const getOrCreate = (id: number) => {
    if (!map.has(id)) map.set(id, { goals: 0, ownGoals: 0, yellowCard: false, redCard: false, subbedOutMin: null });
    return map.get(id)!;
  };
  for (const g of goals) {
    if (g.detail === 'Own Goal') getOrCreate(g.scorer.id).ownGoals++;
    else getOrCreate(g.scorer.id).goals++;
  }
  for (const b of bookings) {
    const entry = getOrCreate(b.player.id);
    if (b.card === 'YELLOW') entry.yellowCard = true;
    else if (b.card === 'RED' || b.card === 'YELLOW_RED') entry.redCard = true;
  }
  for (const s of substitutions) {
    const entry = getOrCreate(s.playerOut.id);
    if (entry.subbedOutMin === null) entry.subbedOutMin = s.minute;
  }
  return map;
}

// ── Pitch player dot ────────────────────────────────────────────────────────

const DOT_SIZE = 36;
const TOUCH_WIDTH = 56;

function PitchDot({
  player, x, y, teamColor, events, isSelected, onPress,
}: {
  player: MatchPlayer;
  x: number; y: number;
  teamColor: string;
  events: { goals: number; ownGoals: number; yellowCard: boolean; redCard: boolean; subbedOutMin: number | null } | undefined;
  isSelected: boolean;
  onPress: () => void;
}) {
  const displayName = lastName(player.name);
  return (
    <Pressable
      onPress={onPress}
      style={{
        position: 'absolute',
        left: x - TOUCH_WIDTH / 2,
        top: y - DOT_SIZE / 2,
        alignItems: 'center',
        width: TOUCH_WIDTH,
      }}
    >
      <View style={{ width: DOT_SIZE, height: DOT_SIZE }}>
        <View style={{
          width: DOT_SIZE,
          height: DOT_SIZE,
          borderRadius: DOT_SIZE / 2,
          backgroundColor: isSelected ? 'rgba(245,158,11,0.85)' : teamColor,
          alignItems: 'center',
          justifyContent: 'center',
          borderWidth: 2,
          borderColor: isSelected ? '#f59e0b' : 'rgba(255,255,255,0.5)',
        }}>
          <Text style={{ fontSize: 13, fontWeight: '800', color: '#fff' }}>
            {player.shirtNumber ?? ''}
          </Text>
        </View>
        {events?.goals > 0 && (
          <View style={{ position: 'absolute', top: -1, left: -1 }}>
            <Text style={{ fontSize: 11 }}>⚽</Text>
          </View>
        )}
        {events?.ownGoals > 0 && (
          <View style={{ position: 'absolute', top: -2, left: -2, width: 16, height: 16, borderRadius: 8, backgroundColor: 'rgba(239,68,68,0.45)', alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontSize: 11 }}>⚽</Text>
          </View>
        )}
        {events?.yellowCard && (
          <View style={{ position: 'absolute', bottom: -1, left: -1, width: 7, height: 10, backgroundColor: '#facc15', borderRadius: 1, borderWidth: 0.5, borderColor: 'rgba(0,0,0,0.3)' }} />
        )}
        {events?.redCard && (
          <View style={{ position: 'absolute', bottom: -1, left: -1, width: 7, height: 10, backgroundColor: '#ef4444', borderRadius: 1, borderWidth: 0.5, borderColor: 'rgba(0,0,0,0.3)' }} />
        )}
        {isSelected && (
          <View style={{ position: 'absolute', bottom: -4, right: -4 }}>
            <Text style={{ fontSize: 12 }}>⭐</Text>
          </View>
        )}
      </View>
      <Text style={{ fontSize: 9, fontWeight: '700', color: '#fff', textAlign: 'center', marginTop: 2, textShadowColor: 'rgba(0,0,0,0.9)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 }} numberOfLines={1}>
        {displayName}
      </Text>
    </Pressable>
  );
}

// ── Main component ──────────────────────────────────────────────────────────

interface MOTMPickerModalProps {
  visible: boolean;
  onClose: () => void;
  matchDetail: MatchDetail;
  homeTeamName: string;
  awayTeamName: string;
  homeTeamCrest: string;
  awayTeamCrest: string;
  selectedPlayerId: number | null;
  onSelect: (playerId: number | null) => void;
}

export function MOTMPickerModal({
  visible,
  onClose,
  matchDetail,
  homeTeamName,
  awayTeamName,
  homeTeamCrest,
  awayTeamCrest,
  selectedPlayerId,
  onSelect,
}: MOTMPickerModalProps) {
  const { theme } = useTheme();
  const { colors, spacing, typography, borderRadius } = theme;
  const { width: screenWidth } = useWindowDimensions();

  // Pitch dimensions (fits inside the modal card with small horizontal padding)
  const pitchWidth = screenWidth - spacing.md * 4;
  const pitchHeight = pitchWidth * 1.7;
  const halfHeight = pitchHeight / 2;

  const homeFormation = matchDetail.homeFormation ? parseFormation(matchDetail.homeFormation) : [];
  const awayFormation = matchDetail.awayFormation ? parseFormation(matchDetail.awayFormation) : [];

  const playerEvents = useMemo(() =>
    buildPlayerEvents(matchDetail.goals, matchDetail.bookings, matchDetail.substitutions),
    [matchDetail.goals, matchDetail.bookings, matchDetail.substitutions],
  );

  const homeRows = homeFormation.length > 0 ? assignPlayersToRows(matchDetail.homeLineup, homeFormation) : [];
  const awayRows = awayFormation.length > 0 ? assignPlayersToRows(matchDetail.awayLineup, awayFormation) : [];

  // Substitutes who actually came on
  const subInIds = useMemo(() =>
    new Set(matchDetail.substitutions.map((s) => s.playerIn.id)),
    [matchDetail.substitutions],
  );
  const homeSubs = matchDetail.homeBench.filter((p) => subInIds.has(p.id));
  const awaySubs = matchDetail.awayBench.filter((p) => subInIds.has(p.id));
  const hasSubs = homeSubs.length > 0 || awaySubs.length > 0;

  // Pitch layout helpers
  const padX = 24;
  const topPad = pitchHeight * 0.07;
  const bottomPad = pitchHeight * 0.08;
  const centerPad = 40;
  const lineColor = 'rgba(255,255,255,0.25)';
  const penaltyBoxWidth = pitchWidth * 0.55;
  const penaltyBoxHeight = pitchHeight * 0.11;
  const goalBoxWidth = pitchWidth * 0.28;
  const goalBoxHeight = pitchHeight * 0.045;
  const circleSize = pitchWidth * 0.22;

  const getPlayerPos = (
    rowIndex: number, playerIndexInRow: number, playersInRow: number,
    totalRows: number, isHome: boolean,
  ) => {
    const usableWidth = pitchWidth - padX * 2;
    const x = padX + (usableWidth / (playersInRow + 1)) * (playerIndexInRow + 1);
    if (isHome) {
      const yStart = topPad;
      const yEnd = halfHeight - centerPad;
      const step = totalRows > 1 ? (yEnd - yStart) / (totalRows - 1) : 0;
      return { x, y: yStart + step * rowIndex };
    } else {
      const yStart = pitchHeight - bottomPad;
      const yEnd = halfHeight + centerPad;
      const step = totalRows > 1 ? (yStart - yEnd) / (totalRows - 1) : 0;
      return { x, y: yStart - step * rowIndex };
    }
  };

  const handleSelect = (playerId: number) => {
    onSelect(selectedPlayerId === playerId ? null : playerId);
    onClose();
  };

  const renderSubRow = (player: MatchPlayer) => {
    const isSelected = selectedPlayerId === player.id;
    const sub = matchDetail.substitutions.find((s) => s.playerIn.id === player.id);
    return (
      <Pressable
        key={player.id}
        onPress={() => handleSelect(player.id)}
        style={({ pressed }) => ({
          flexDirection: 'row',
          alignItems: 'center',
          paddingVertical: spacing.sm,
          paddingHorizontal: spacing.md,
          backgroundColor: isSelected ? `${colors.primary}22` : pressed ? colors.muted : 'transparent',
        })}
      >
        {player.shirtNumber !== null && (
          <Text style={{ width: 24, textAlign: 'center', ...typography.caption, color: colors.textSecondary, marginRight: spacing.sm }}>
            {player.shirtNumber}
          </Text>
        )}
        {isSelected && <Text style={{ fontSize: 13, marginRight: 4 }}>⭐</Text>}
        <Text style={{ ...typography.body, color: isSelected ? '#f59e0b' : colors.foreground, flex: 1, fontSize: 14, fontWeight: isSelected ? '700' : '400' }} numberOfLines={1}>
          {shortName(player.name)}
        </Text>
        {sub && (
          <Text style={{ fontSize: 11, color: colors.textSecondary }}>↑ {sub.minute}'</Text>
        )}
        {isSelected && (
          <Ionicons name="checkmark" size={16} color={colors.primary} style={{ marginLeft: 6 }} />
        )}
      </Pressable>
    );
  };

  const renderSubSection = (players: MatchPlayer[], teamName: string, crest: string) => {
    if (players.length === 0) return null;
    return (
      <View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.xs, backgroundColor: colors.muted }}>
          <TeamLogo uri={crest} size={14} />
          <Text style={{ ...typography.caption, color: colors.textSecondary, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 }}>
            {teamName}
          </Text>
        </View>
        {players.map(renderSubRow)}
      </View>
    );
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        onPress={onClose}
        style={{ flex: 1, backgroundColor: colors.overlay, justifyContent: 'center', alignItems: 'center', padding: spacing.md }}
      >
        <Pressable
          onPress={(e) => e.stopPropagation()}
          style={{
            width: '100%',
            maxHeight: '90%',
            backgroundColor: colors.card,
            borderRadius: borderRadius.lg,
            overflow: 'hidden',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: 0.3,
            shadowRadius: 16,
            elevation: 12,
          }}
        >
          {/* Header */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border }}>
            <Text style={{ ...typography.h4, color: colors.foreground }}>Man of the Match</Text>
            <Pressable onPress={onClose} hitSlop={8}>
              <Ionicons name="close" size={22} color={colors.textSecondary} />
            </Pressable>
          </View>

          <ScrollView bounces={false} showsVerticalScrollIndicator={false}>
            {/* Formation pitch */}
            {homeRows.length > 0 && awayRows.length > 0 ? (
              <View style={{ alignItems: 'center', paddingVertical: spacing.md }}>
                <View style={{ width: pitchWidth, height: pitchHeight, borderRadius: 12, overflow: 'hidden', backgroundColor: '#1b7340' }}>
                  {/* Pitch markings */}
                  <View style={{ position: 'absolute', top: halfHeight, left: 0, right: 0, height: 1, backgroundColor: lineColor }} />
                  <View style={{ position: 'absolute', top: halfHeight - circleSize / 2, left: pitchWidth / 2 - circleSize / 2, width: circleSize, height: circleSize, borderRadius: circleSize / 2, borderWidth: 1, borderColor: lineColor }} />
                  <View style={{ position: 'absolute', top: halfHeight - 3, left: pitchWidth / 2 - 3, width: 6, height: 6, borderRadius: 3, backgroundColor: lineColor }} />
                  <View style={{ position: 'absolute', top: 0, left: (pitchWidth - penaltyBoxWidth) / 2, width: penaltyBoxWidth, height: penaltyBoxHeight, borderWidth: 1, borderTopWidth: 0, borderColor: lineColor }} />
                  <View style={{ position: 'absolute', top: 0, left: (pitchWidth - goalBoxWidth) / 2, width: goalBoxWidth, height: goalBoxHeight, borderWidth: 1, borderTopWidth: 0, borderColor: lineColor }} />
                  <View style={{ position: 'absolute', bottom: 0, left: (pitchWidth - penaltyBoxWidth) / 2, width: penaltyBoxWidth, height: penaltyBoxHeight, borderWidth: 1, borderBottomWidth: 0, borderColor: lineColor }} />
                  <View style={{ position: 'absolute', bottom: 0, left: (pitchWidth - goalBoxWidth) / 2, width: goalBoxWidth, height: goalBoxHeight, borderWidth: 1, borderBottomWidth: 0, borderColor: lineColor }} />
                  <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderWidth: 2, borderColor: lineColor, borderRadius: 12 }} />

                  {/* Team logos */}
                  <View style={{ position: 'absolute', top: 10, left: 12 }}>
                    <TeamLogo uri={homeTeamCrest} size={22} />
                  </View>
                  <View style={{ position: 'absolute', bottom: 10, right: 12 }}>
                    <TeamLogo uri={awayTeamCrest} size={22} />
                  </View>

                  {/* Home players */}
                  {homeRows.map((row, rowIdx) =>
                    row.map((player, pIdx) => {
                      const pos = getPlayerPos(rowIdx, pIdx, row.length, homeRows.length, true);
                      return (
                        <PitchDot
                          key={`h-${player.id}`}
                          player={player}
                          x={pos.x}
                          y={pos.y}
                          teamColor="rgba(20,20,30,0.65)"
                          events={playerEvents.get(player.id)}
                          isSelected={selectedPlayerId === player.id}
                          onPress={() => handleSelect(player.id)}
                        />
                      );
                    })
                  )}

                  {/* Away players */}
                  {awayRows.map((row, rowIdx) =>
                    row.map((player, pIdx) => {
                      const pos = getPlayerPos(rowIdx, pIdx, row.length, awayRows.length, false);
                      return (
                        <PitchDot
                          key={`a-${player.id}`}
                          player={player}
                          x={pos.x}
                          y={pos.y}
                          teamColor="rgba(255,255,255,0.2)"
                          events={playerEvents.get(player.id)}
                          isSelected={selectedPlayerId === player.id}
                          onPress={() => handleSelect(player.id)}
                        />
                      );
                    })
                  )}
                </View>
              </View>
            ) : null}

            {/* Substitutes who came on */}
            {hasSubs && (
              <View style={{ borderTopWidth: 1, borderTopColor: colors.border }}>
                <View style={{ paddingHorizontal: spacing.md, paddingTop: spacing.sm, paddingBottom: spacing.xs }}>
                  <Text style={{ fontSize: 11, fontWeight: '600', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 1 }}>
                    Substitutes
                  </Text>
                </View>
                {renderSubSection(homeSubs, homeTeamName, homeTeamCrest)}
                {renderSubSection(awaySubs, awayTeamName, awayTeamCrest)}
              </View>
            )}

            <View style={{ height: spacing.md }} />
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
