import React, { useMemo } from 'react';
import { View, Text, Pressable, LayoutAnimation, Platform, UIManager } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}
import { useTheme } from '../../context/ThemeContext';
import { Select } from '../ui/Select';
import { SliderInput } from '../ui/SliderInput';
import { Match } from '../../types/match';

export interface MatchFilterState {
  league: string;
  team: string;
  season: string;
}

interface MatchFiltersProps {
  filters: MatchFilterState;
  onFiltersChange: (filters: MatchFilterState) => void;
  minLogs: number;
  onMinLogsChange: (value: number) => void;
  matches: Match[];
  showMinLogs?: boolean;
  showTeamFilter?: boolean;
  showSeasonFilter?: boolean;
}

const SEASONS = [
  '2025/26',
  '2024/25',
  '2023/24',
  '2022/23',
  '2021/22',
  '2020/21',
];

export function MatchFilters({
  filters,
  onFiltersChange,
  minLogs,
  onMinLogsChange,
  matches,
  showMinLogs = true,
  showTeamFilter = true,
  showSeasonFilter = true,
}: MatchFiltersProps) {
  const { theme } = useTheme();
  const { colors, spacing, borderRadius } = theme;

  const leagues = useMemo(() => {
    const map = new Map<string, string>();
    for (const m of matches) {
      map.set(m.competition.code, m.competition.name);
    }
    return Array.from(map.entries())
      .map(([code, name]) => ({ value: code, label: name }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [matches]);

  const teams = useMemo(() => {
    const set = new Set<string>();
    for (const m of matches) {
      if (filters.league === 'all' || m.competition.code === filters.league) {
        set.add(m.homeTeam.name);
        set.add(m.awayTeam.name);
      }
    }
    return Array.from(set)
      .sort()
      .map((name) => ({ value: name, label: name }));
  }, [matches, filters.league]);

  const hasActiveFilters =
    filters.league !== 'all' ||
    filters.team !== 'all' ||
    filters.season !== 'all' ||
    minLogs > 0;

  const clearAll = () => {
    LayoutAnimation.configureNext(LayoutAnimation.create(200, 'easeInEaseOut', 'opacity'));
    onFiltersChange({ league: 'all', team: 'all', season: 'all' });
    onMinLogsChange(0);
  };

  const visibleDropdowns = [true, showTeamFilter, showSeasonFilter].filter(Boolean).length;

  return (
    <View
      style={{
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm + 2,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
      }}
    >
      {/* Header */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: spacing.sm,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
          <Ionicons name="options-outline" size={16} color={colors.textSecondary} />
          <Text style={{ fontSize: 13, fontWeight: '500', color: colors.foreground }}>
            Filters
          </Text>
        </View>
        {hasActiveFilters && (
          <Pressable
            onPress={clearAll}
            hitSlop={8}
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              gap: 4,
              backgroundColor: pressed ? colors.muted : 'transparent',
              paddingHorizontal: 8,
              paddingVertical: 4,
              borderRadius: borderRadius.sm,
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <Text style={{ fontSize: 12, color: colors.textSecondary }}>Clear all</Text>
            <Ionicons name="close" size={14} color={colors.textSecondary} />
          </Pressable>
        )}
      </View>

      {/* Dropdown grid */}
      <View
        style={{
          flexDirection: 'row',
          gap: spacing.sm,
        }}
      >
        {/* League */}
        <View style={{ flex: 1 }}>
          <Select
            label="League"
            title="Select League"
            value={filters.league}
            onValueChange={(value) =>
              onFiltersChange({ ...filters, league: value, team: 'all' })
            }
            options={[{ value: 'all', label: 'All Leagues' }, ...leagues]}
          />
        </View>

        {/* Team */}
        {showTeamFilter && (
          <View style={{ flex: 1 }}>
            <Select
              label="Team"
              title="Select Team"
              value={filters.team}
              onValueChange={(value) => onFiltersChange({ ...filters, team: value })}
              options={[{ value: 'all', label: 'All Teams' }, ...teams]}
              disabled={filters.league === 'all'}
            />
          </View>
        )}

        {/* Season */}
        {showSeasonFilter && (
          <View style={{ flex: 1 }}>
            <Select
              label="Season"
              title="Select Season"
              value={filters.season}
              onValueChange={(value) => onFiltersChange({ ...filters, season: value })}
              options={[
                { value: 'all', label: 'All Seasons' },
                ...SEASONS.map((s) => ({ value: s, label: s })),
              ]}
            />
          </View>
        )}
      </View>

      {/* Minimum Logs Slider */}
      {showMinLogs && (
        <View style={{ marginTop: spacing.md }}>
          <SliderInput
            label="Minimum Logs"
            value={minLogs}
            onValueChange={onMinLogsChange}
            min={0}
            max={1000}
            step={10}
            formatValue={(v) => `${v}+ logs`}
          />
        </View>
      )}
    </View>
  );
}

export function applyMatchFilters(
  matches: Match[],
  filters: MatchFilterState
): Match[] {
  return matches.filter((m) => {
    if (filters.league !== 'all' && m.competition.code !== filters.league) return false;
    if (filters.team !== 'all') {
      if (m.homeTeam.name !== filters.team && m.awayTeam.name !== filters.team) {
        return false;
      }
    }
    if (filters.season !== 'all') {
      const kickoff = new Date(m.kickoff);
      const year = kickoff.getFullYear();
      const month = kickoff.getMonth();
      const seasonStart = month >= 7 ? year : year - 1;
      const seasonStr = `${seasonStart}/${(seasonStart + 1).toString().slice(2)}`;
      if (seasonStr !== filters.season) return false;
    }
    return true;
  });
}
