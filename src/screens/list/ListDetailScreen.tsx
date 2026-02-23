import React, { useState, useMemo } from 'react';
import { View, Text, ScrollView, Pressable, Alert, Modal, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useQueries } from '@tanstack/react-query';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { useList, useDeleteList } from '../../hooks/useLists';
import { getMatchById } from '../../services/matchService';
import { MatchPosterCard } from '../../components/match/MatchPosterCard';
import { MatchFilters, MatchFilterState, applyMatchFilters } from '../../components/match/MatchFilters';
import { Select } from '../../components/ui/Select';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { formatRelativeTime } from '../../utils/formatDate';
import { Match } from '../../types/match';

const NUM_COLUMNS = 3;

type SortBy = 'list' | 'date' | 'competition';
const SORT_OPTIONS: { value: SortBy; label: string }[] = [
  { value: 'list', label: 'List Order' },
  { value: 'date', label: 'Date' },
  { value: 'competition', label: 'Competition' },
];

export function ListDetailScreen({ route, navigation }: any) {
  const { theme, isDark } = useTheme();
  const { colors, spacing, typography, borderRadius } = theme;
  const { width: screenWidth } = useWindowDimensions();
  const { listId } = route.params;

  const GAP = spacing.sm;
  const HORIZONTAL_PADDING = spacing.md;
  const CARD_WIDTH = (screenWidth - HORIZONTAL_PADDING * 2 - GAP * (NUM_COLUMNS - 1)) / NUM_COLUMNS;
  const { user } = useAuth();
  const { data: list, isLoading } = useList(listId);
  const deleteListMutation = useDeleteList();
  const [sortBy, setSortBy] = useState<SortBy>('list');
  const [showMenu, setShowMenu] = useState(false);
  const [filters, setFilters] = useState<MatchFilterState>({ league: 'all', team: 'all', season: 'all' });

  const isOwner = user?.uid === list?.userId;

  // Fetch match data for all matchIds
  const matchQueries = useQueries({
    queries: (list?.matchIds || []).map((id) => ({
      queryKey: ['match', id],
      queryFn: () => getMatchById(id),
      staleTime: 5 * 60 * 1000,
      enabled: !!list,
    })),
  });

  const matchMap = useMemo(() => {
    const map = new Map<number, Match>();
    matchQueries.forEach((q) => {
      if (q.data) map.set(q.data.id, q.data);
    });
    return map;
  }, [matchQueries]);

  // Build ordered matches array preserving list order
  const matches = useMemo(() => {
    return (list?.matchIds || [])
      .map((id) => matchMap.get(id))
      .filter((m): m is Match => m !== undefined);
  }, [list?.matchIds, matchMap]);

  // Apply filters and sorting
  const hasActiveFilters = filters.league !== 'all' || filters.team !== 'all' || filters.season !== 'all';
  const displayMatches = useMemo(() => {
    let result = applyMatchFilters(matches, filters);

    if (sortBy === 'date') {
      result = [...result].sort((a, b) => new Date(b.kickoff).getTime() - new Date(a.kickoff).getTime());
    } else if (sortBy === 'competition') {
      result = [...result].sort((a, b) => a.competition.name.localeCompare(b.competition.name));
    }

    return result;
  }, [matches, filters, sortBy]);

  if (isLoading || !list) return <LoadingSpinner />;

  const handleEdit = () => {
    setShowMenu(false);
    navigation.navigate('EditList', { listId: list.id });
  };

  const handleDelete = () => {
    setShowMenu(false);
    Alert.alert(
      'Delete List',
      'Are you sure you want to delete this list? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteListMutation.mutateAsync(list.id);
              navigation.goBack();
            } catch {
              Alert.alert('Error', 'Failed to delete list.');
            }
          },
        },
      ]
    );
  };

  const showRankedControls = list.ranked && sortBy === 'list' && !hasActiveFilters;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border }}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={8}>
          <Ionicons name="arrow-back" size={22} color={colors.foreground} />
        </Pressable>
        <Text style={{ ...typography.bodyBold, color: colors.foreground, flex: 1, textAlign: 'center', fontSize: 16 }}>
          List
        </Text>
        {isOwner ? (
          <Pressable onPress={() => setShowMenu(true)} hitSlop={8}>
            <Ionicons name="ellipsis-horizontal" size={22} color={colors.foreground} />
          </Pressable>
        ) : (
          <View style={{ width: 22 }} />
        )}
      </View>

      {/* Three-dot action menu */}
      <Modal
        visible={showMenu}
        transparent
        animationType="fade"
        onRequestClose={() => setShowMenu(false)}
      >
        <Pressable
          onPress={() => setShowMenu(false)}
          style={{ flex: 1, backgroundColor: colors.overlay, justifyContent: 'center', alignItems: 'center', padding: spacing.xl }}
        >
          <Pressable
            onPress={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: 280,
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
            <Pressable
              onPress={handleEdit}
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.sm,
                paddingHorizontal: spacing.md,
                paddingVertical: spacing.md,
                backgroundColor: pressed ? colors.muted : 'transparent',
                borderBottomWidth: 1,
                borderBottomColor: colors.border,
              })}
            >
              <Ionicons name="create-outline" size={20} color={colors.foreground} />
              <Text style={{ ...typography.body, color: colors.foreground }}>Edit list</Text>
            </Pressable>
            <Pressable
              onPress={handleDelete}
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.sm,
                paddingHorizontal: spacing.md,
                paddingVertical: spacing.md,
                backgroundColor: pressed ? colors.muted : 'transparent',
              })}
            >
              <Ionicons name="trash-outline" size={20} color="#ef4444" />
              <Text style={{ ...typography.body, color: '#ef4444' }}>Delete list</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      <ScrollView
        indicatorStyle={isDark ? 'white' : 'default'}
        contentContainerStyle={{ paddingBottom: 100 }}
      >
        {/* List metadata */}
        <View style={{ paddingHorizontal: spacing.md, paddingTop: spacing.md }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <Text style={{ ...typography.h2, color: colors.foreground, flex: 1 }}>{list.name}</Text>
            {list.ranked && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.primaryLight, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, borderRadius: borderRadius.full }}>
                <Ionicons name="trophy-outline" size={12} color={colors.primary} />
                <Text style={{ ...typography.small, color: colors.primary, fontWeight: '600' }}>Ranked</Text>
              </View>
            )}
          </View>
          <Text style={{ ...typography.caption, color: colors.textSecondary, marginTop: spacing.xs }}>
            by {list.username} &middot; {formatRelativeTime(list.createdAt)}
          </Text>
          {list.description ? (
            <Text style={{ ...typography.body, color: colors.textSecondary, marginTop: spacing.sm }}>
              {list.description}
            </Text>
          ) : null}
          <Text style={{ ...typography.bodyBold, color: colors.foreground, marginTop: spacing.md }}>
            {list.matchIds.length} {list.matchIds.length === 1 ? 'match' : 'matches'}
          </Text>
        </View>

        {/* Filters */}
        {matches.length > 0 && (
          <>
            <MatchFilters
              filters={filters}
              onFiltersChange={setFilters}
              minLogs={0}
              onMinLogsChange={() => {}}
              matches={matches}
              showMinLogs={false}
            />

            {/* Sort + count row */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, paddingVertical: spacing.sm }}>
              <Text style={{ ...typography.caption, color: colors.textSecondary }}>
                {displayMatches.length} {displayMatches.length === 1 ? 'match' : 'matches'}
              </Text>
              <View style={{ width: 160 }}>
                <Select
                  value={sortBy}
                  onValueChange={(v) => setSortBy(v as SortBy)}
                  title="Sort By"
                  options={SORT_OPTIONS}
                />
              </View>
            </View>
          </>
        )}

        {/* Match grid */}
        {matches.length === 0 ? (
          <View style={{ alignItems: 'center', paddingTop: spacing.xxl, paddingHorizontal: spacing.xl }}>
            <Ionicons name="list-outline" size={48} color={colors.textSecondary} />
            <Text style={{ ...typography.h4, color: colors.foreground, marginTop: spacing.md }}>
              No matches yet
            </Text>
            <Text style={{ ...typography.body, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.xs }}>
              Add matches to your list
            </Text>
          </View>
        ) : (
          <View style={{ paddingHorizontal: HORIZONTAL_PADDING, marginTop: spacing.sm }}>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: GAP }}>
              {displayMatches.map((match) => {
                const listIndex = list.matchIds.indexOf(match.id);
                return (
                  <Pressable
                    key={match.id}
                    onPress={() => navigation.navigate('MatchDetail', { matchId: match.id })}
                  >
                    <MatchPosterCard
                      match={match}
                      width={CARD_WIDTH}
                    />
                    {/* Rank badge for ranked lists */}
                    {showRankedControls && (
                      <View style={{
                        position: 'absolute',
                        top: 4,
                        right: 4,
                        backgroundColor: 'rgba(0,0,0,0.7)',
                        borderRadius: 10,
                        minWidth: 20,
                        height: 20,
                        alignItems: 'center',
                        justifyContent: 'center',
                        paddingHorizontal: 5,
                      }}>
                        <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>
                          {listIndex + 1}
                        </Text>
                      </View>
                    )}
                  </Pressable>
                );
              })}
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
