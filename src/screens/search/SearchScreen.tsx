import React, { useState, useCallback, useRef, useEffect } from 'react';
import { View, Text, ScrollView, Pressable, TextInput as RNTextInput, LayoutAnimation, useWindowDimensions, Keyboard, NativeSyntheticEvent, NativeScrollEvent } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../../context/ThemeContext';
import { useSearchUsers } from '../../hooks/useUser';
import { useSearchMatches } from '../../hooks/useMatches';
import { useSearchTeams, useSearchPlayers } from '../../hooks/useTeams';
import { useSearchReviews } from '../../hooks/useReviews';
import { useSearchLists } from '../../hooks/useLists';
import { Avatar } from '../../components/ui/Avatar';
import { MatchPosterCard } from '../../components/match/MatchPosterCard';
import { ReviewCard } from '../../components/review/ReviewCard';
import { ListPreviewCard } from '../../components/list/ListPreviewCard';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { SearchStackParamList } from '../../types/navigation';
import { TeamLogo } from '../../components/match/TeamLogo';

const RECENT_SEARCHES_KEY = 'bookd_recent_searches';
const MAX_RECENT_SEARCHES = 10;

type Nav = NativeStackNavigationProp<SearchStackParamList, 'Search'>;
type Category = 'matches' | 'teams' | 'players' | 'members' | 'reviews' | 'lists';

const NUM_COLUMNS = 3;

export function SearchScreen() {
  const { theme, isDark } = useTheme();
  const { colors, spacing, typography, borderRadius } = theme;
  const navigation = useNavigation<Nav>();
  const { width: screenWidth } = useWindowDimensions();
  const [queryStr, setQueryStr] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [activeCategory, setActiveCategory] = useState<Category>('matches');
  const [visibleCounts, setVisibleCounts] = useState<Record<Category, number>>({
    matches: 30, teams: 30, players: 30, members: 30, reviews: 30, lists: 30,
  });
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const recentSearchesRef = useRef<string[]>([]);
  const inputRef = useRef<RNTextInput>(null);

  // Load recent searches on mount
  useEffect(() => {
    AsyncStorage.getItem(RECENT_SEARCHES_KEY).then((val) => {
      if (val) {
        const parsed = JSON.parse(val);
        setRecentSearches(parsed);
        recentSearchesRef.current = parsed;
      }
    });
  }, []);

  // Save a search term to recents (uses ref to avoid effect dependency loops)
  const saveRecentSearch = useCallback(async (term: string) => {
    const trimmed = term.trim();
    if (trimmed.length < 2) return;
    const current = recentSearchesRef.current;
    const updated = [trimmed, ...current.filter((s) => s.toLowerCase() !== trimmed.toLowerCase())].slice(0, MAX_RECENT_SEARCHES);
    recentSearchesRef.current = updated;
    setRecentSearches(updated);
    await AsyncStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
  }, []);

  // Debounce search query by 500ms to prevent excessive queries and keep UI responsive
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(queryStr);
      if (queryStr.trim().length >= 2) saveRecentSearch(queryStr);
    }, 500);
    return () => clearTimeout(timer);
  }, [queryStr]);

  const PAGE_SIZE = 30;
  const loadingMore = useRef(false);

  const handleScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { layoutMeasurement, contentOffset, contentSize } = e.nativeEvent;
    const distanceFromBottom = contentSize.height - layoutMeasurement.height - contentOffset.y;
    if (distanceFromBottom < 300 && !loadingMore.current) {
      loadingMore.current = true;
      LayoutAnimation.configureNext(LayoutAnimation.create(300, LayoutAnimation.Types.easeInEaseOut, LayoutAnimation.Properties.opacity));
      setVisibleCounts((prev) => ({ ...prev, [activeCategory]: prev[activeCategory] + PAGE_SIZE }));
      setTimeout(() => { loadingMore.current = false; }, 800);
    }
  }, [activeCategory]);

  const GAP = spacing.sm;
  const HORIZONTAL_PADDING = spacing.md;
  const CARD_WIDTH = (screenWidth - HORIZONTAL_PADDING * 2 - GAP * (NUM_COLUMNS - 1)) / NUM_COLUMNS;

  const { data: users, isLoading: usersLoading } = useSearchUsers(debouncedQuery, activeCategory === 'members');
  const { data: matchResults, isLoading: matchesLoading, isFetching: matchesFetching } = useSearchMatches(debouncedQuery, activeCategory === 'matches');
  const { data: teamResults, isLoading: teamsLoading } = useSearchTeams(debouncedQuery, activeCategory === 'teams');
  const { data: playerResults, isLoading: playersLoading, isFetching: playersFetching } = useSearchPlayers(debouncedQuery, activeCategory === 'players');
  const { data: reviewResults, isLoading: reviewsLoading, isFetching: reviewsFetching } = useSearchReviews(debouncedQuery, activeCategory === 'reviews');
  const { data: listResults, isLoading: listsLoading, isFetching: listsFetching } = useSearchLists(debouncedQuery, activeCategory === 'lists');

  const categories: { key: Category; label: string }[] = [
    { key: 'matches', label: 'Matches' },
    { key: 'teams', label: 'Teams' },
    { key: 'players', label: 'Players and Managers' },
    { key: 'members', label: 'Members' },
    { key: 'reviews', label: 'Reviews' },
    { key: 'lists', label: 'Lists' },
  ];

  const browseLinks: { label: string; icon: keyof typeof Ionicons.glyphMap; route: keyof SearchStackParamList }[] = [
    { label: 'Date', icon: 'calendar-outline', route: 'BrowseByDate' },
    { label: 'Most popular', icon: 'trending-up-outline', route: 'BrowsePopular' },
    { label: 'Highest rated', icon: 'star-outline', route: 'BrowseHighestRated' },
    { label: 'Featured lists', icon: 'list-outline', route: 'BrowseFeaturedLists' },
  ];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      {/* Header */}
      <View style={{ paddingHorizontal: spacing.md, paddingTop: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border }}>
        <Text style={{ ...typography.h2, color: colors.foreground, textAlign: 'center', marginBottom: spacing.md }}>
          Search
        </Text>

        {/* Search input */}
        <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.muted, borderRadius: borderRadius.md, marginBottom: spacing.sm, paddingHorizontal: 12 }}>
          <Ionicons name="search" size={18} color={colors.textSecondary} />
          <RNTextInput
            placeholder="Find matches, teams, players and managers..."
            placeholderTextColor={colors.textSecondary}
            value={queryStr}
            onChangeText={(t) => { setQueryStr(t); setVisibleCounts({ matches: 30, teams: 30, players: 30, members: 30, reviews: 30, lists: 30 }); }}
            onFocus={() => { LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut); setIsSearching(true); }}
            onBlur={() => { if (!queryStr) { LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut); setIsSearching(false); } }}
            autoCapitalize="none"
            autoCorrect={false}
            style={{
              flex: 1,
              paddingLeft: 10,
              paddingVertical: 10,
              color: colors.foreground,
              fontSize: 14,
            }}
          />
          {queryStr.length > 0 && (
            <Pressable onPress={() => { LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut); setQueryStr(''); setIsSearching(false); Keyboard.dismiss(); }}>
              <Ionicons name="close" size={18} color={colors.textSecondary} />
            </Pressable>
          )}
        </View>

        {/* Category tabs */}
        {isSearching && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" style={{ marginBottom: spacing.sm }}>
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              {categories.map((cat) => (
                <Pressable
                  key={cat.key}
                  onPress={() => setActiveCategory(cat.key)}
                  style={{
                    paddingHorizontal: spacing.md,
                    paddingVertical: spacing.xs + 2,
                    borderRadius: borderRadius.full,
                    backgroundColor: activeCategory === cat.key ? colors.primary : colors.muted,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 13,
                      fontWeight: '500',
                      color: activeCategory === cat.key ? '#14181c' : colors.textSecondary,
                    }}
                  >
                    {cat.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </ScrollView>
        )}
      </View>

      <ScrollView indicatorStyle={isDark ? 'white' : 'default'} style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 0 }} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" onScroll={handleScroll} scrollEventThrottle={400}>
        {/* Default browse view */}
        {!isSearching && (
          <View style={{ paddingVertical: spacing.lg, paddingHorizontal: spacing.md }}>
            <Text style={{ ...typography.h4, color: colors.foreground, marginBottom: spacing.md }}>
              Browse By
            </Text>
            <View style={{ backgroundColor: colors.card, borderRadius: borderRadius.md, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' }}>
              {browseLinks.map((link, i) => (
                <Pressable
                  key={link.label}
                  onPress={() => navigation.navigate(link.route as any)}
                  style={({ pressed }) => ({
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    paddingVertical: spacing.md,
                    paddingHorizontal: spacing.md,
                    backgroundColor: pressed ? colors.accent : 'transparent',
                    borderTopWidth: i > 0 ? 1 : 0,
                    borderTopColor: colors.border,
                  })}
                >
                  <Text style={{ ...typography.body, color: colors.foreground }}>{link.label}</Text>
                  <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
                </Pressable>
              ))}
            </View>

            {/* Bookd section */}
            <Text style={{ ...typography.h4, color: colors.foreground, marginTop: spacing.xl, marginBottom: spacing.md }}>
              bookd
            </Text>
            <View style={{ backgroundColor: colors.card, borderRadius: borderRadius.md, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' }}>
              {[{ label: 'New here?', route: 'NewHere' as const }, { label: 'Frequent questions', route: 'FAQ' as const }].map((item, i) => (
                <Pressable
                  key={item.label}
                  onPress={() => navigation.navigate(item.route)}
                  style={({ pressed }) => ({
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    paddingVertical: spacing.md,
                    paddingHorizontal: spacing.md,
                    backgroundColor: pressed ? colors.accent : 'transparent',
                    borderTopWidth: i > 0 ? 1 : 0,
                    borderTopColor: colors.border,
                  })}
                >
                  <Text style={{ ...typography.body, color: colors.foreground }}>{item.label}</Text>
                  <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
                </Pressable>
              ))}
            </View>
          </View>
        )}

        {/* Recent searches or empty prompt */}
        {isSearching && !queryStr && (
          recentSearches.length > 0 ? (
            <View style={{ paddingTop: spacing.md }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm, paddingHorizontal: spacing.md }}>
                <Text style={{ ...typography.h4, color: colors.foreground }}>Recent Searches</Text>
                <Pressable
                  onPress={async () => {
                    setRecentSearches([]);
                    recentSearchesRef.current = [];
                    await AsyncStorage.removeItem(RECENT_SEARCHES_KEY);
                  }}
                  hitSlop={8}
                >
                  <Text style={{ ...typography.caption, color: colors.textSecondary }}>Clear All</Text>
                </Pressable>
              </View>
              {recentSearches.map((term, i) => (
                <Pressable
                  key={`${term}-${i}`}
                  onPress={() => {
                    setQueryStr(term);
                    setIsSearching(true);
                  }}
                  style={({ pressed }) => ({
                    borderBottomWidth: 1,
                    borderBottomColor: colors.border,
                    opacity: pressed ? 0.7 : 1,
                  })}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm + 2, paddingHorizontal: spacing.md }}>
                    <Ionicons name="time-outline" size={18} color={colors.textSecondary} style={{ marginRight: spacing.sm }} />
                    <Text style={{ ...typography.body, color: colors.foreground, flex: 1, fontSize: 15 }}>{term}</Text>
                    <Pressable
                      onPress={async (e) => {
                        e.stopPropagation();
                        const updated = recentSearches.filter((_, idx) => idx !== i);
                        recentSearchesRef.current = updated;
                        setRecentSearches(updated);
                        await AsyncStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
                      }}
                      hitSlop={8}
                    >
                      <Ionicons name="close" size={16} color={colors.textSecondary} />
                    </Pressable>
                  </View>
                </Pressable>
              ))}
            </View>
          ) : (
            <View style={{ alignItems: 'center', paddingTop: spacing.xxl * 2 }}>
              <Text style={{ ...typography.body, color: colors.textSecondary }}>Start typing to search...</Text>
            </View>
          )
        )}

        {/* Matches results — poster grid */}
        {isSearching && debouncedQuery.length >= 2 && activeCategory === 'matches' && (
          <View style={{ paddingHorizontal: HORIZONTAL_PADDING, paddingTop: spacing.md }}>
            {matchesLoading || matchesFetching ? (
              <View style={{ marginTop: spacing.xl }}><LoadingSpinner fullScreen={false} /></View>
            ) : !matchResults || matchResults.length === 0 ? (
              <View style={{ alignItems: 'center', paddingTop: spacing.lg, paddingHorizontal: spacing.xl }}>
                <Ionicons name="football-outline" size={32} color={colors.textSecondary} />
                <Text style={{ ...typography.body, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.sm }}>
                  No matches found
                </Text>
              </View>
            ) : (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: GAP }}>
                {matchResults.slice(0, visibleCounts.matches).map((match) => (
                  <MatchPosterCard
                    key={match.id}
                    match={match}
                    onPress={() => navigation.navigate('MatchDetail', { matchId: match.id })}
                    width={CARD_WIDTH}
                  />
                ))}
              </View>
            )}
          </View>
        )}

        {/* Teams results */}
        {isSearching && debouncedQuery.length >= 2 && activeCategory === 'teams' && (
          <View style={{ paddingTop: spacing.xs }}>
            {teamsLoading ? (
              <View style={{ marginTop: spacing.md }}><LoadingSpinner fullScreen={false} /></View>
            ) : !teamResults || teamResults.length === 0 ? (
              <View style={{ alignItems: 'center', paddingTop: spacing.lg, paddingHorizontal: spacing.xl }}>
                <Ionicons name="shield-outline" size={32} color={colors.textSecondary} />
                <Text style={{ ...typography.body, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.sm }}>
                  No teams found
                </Text>
              </View>
            ) : (
              teamResults.slice(0, visibleCounts.teams).map((team, i, arr) => (
                <Pressable
                  key={team.id}
                  onPress={() => navigation.navigate('TeamDetail', { teamId: team.id, teamName: team.name, teamCrest: team.crest })}
                  style={({ pressed }) => ({
                    borderBottomWidth: i < arr.length - 1 ? 1 : 0,
                    borderBottomColor: colors.border,
                    opacity: pressed ? 0.7 : 1,
                  })}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm + 2, paddingHorizontal: spacing.md }}>
                    <TeamLogo uri={team.crest} size={28} />
                    <Text style={{ ...typography.body, color: colors.foreground, fontSize: 15, flex: 1 }}>{team.name}</Text>
                    <Ionicons name="chevron-forward" size={14} color={colors.textSecondary} />
                  </View>
                </Pressable>
              ))
            )}
          </View>
        )}

        {/* Players and Managers results */}
        {isSearching && debouncedQuery.length >= 2 && activeCategory === 'players' && (
          <View style={{ paddingTop: spacing.xs }}>
            {playersLoading || playersFetching ? (
              <View style={{ marginTop: spacing.md }}><LoadingSpinner fullScreen={false} /></View>
            ) : !playerResults || playerResults.length === 0 ? (
              <View style={{ alignItems: 'center', paddingTop: spacing.lg, paddingHorizontal: spacing.xl }}>
                <Ionicons name="people-outline" size={32} color={colors.textSecondary} />
                <Text style={{ ...typography.body, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.sm }}>
                  No players found
                </Text>
              </View>
            ) : (
              playerResults.slice(0, visibleCounts.players).map((player, i, arr) => (
                <Pressable
                  key={player.id}
                  onPress={() => navigation.navigate('PersonDetail', { personId: player.id, personName: player.name, role: player.position === 'Coach' ? 'manager' : 'player' })}
                  style={({ pressed }) => ({
                    borderBottomWidth: i < arr.length - 1 ? 1 : 0,
                    borderBottomColor: colors.border,
                    opacity: pressed ? 0.7 : 1,
                  })}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm + 2, paddingHorizontal: spacing.md }}>
                    <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: colors.muted, alignItems: 'center', justifyContent: 'center' }}>
                      <Ionicons name={player.position === 'Coach' ? 'person' : 'football'} size={16} color={colors.textSecondary} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ ...typography.body, color: colors.foreground, fontSize: 15 }}>{player.name}</Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
                        {player.position && (
                          <Text style={{ ...typography.caption, color: colors.textSecondary }}>{player.position}</Text>
                        )}
                        {player.currentTeam && (
                          <Text style={{ ...typography.caption, color: colors.textSecondary }}>
                            {player.position ? ' · ' : ''}{player.currentTeam.name}
                          </Text>
                        )}
                      </View>
                    </View>
                    <Ionicons name="chevron-forward" size={14} color={colors.textSecondary} />
                  </View>
                </Pressable>
              ))
            )}
          </View>
        )}

        {/* Members results */}
        {isSearching && debouncedQuery.length >= 2 && activeCategory === 'members' && (
          <View style={{ paddingTop: spacing.xs }}>
            {usersLoading ? (
              <View style={{ marginTop: spacing.md }}><LoadingSpinner fullScreen={false} /></View>
            ) : !users || users.length === 0 ? (
              <View style={{ alignItems: 'center', paddingTop: spacing.lg, paddingHorizontal: spacing.xl }}>
                <Ionicons name="person-outline" size={32} color={colors.textSecondary} />
                <Text style={{ ...typography.body, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.sm }}>
                  No members found
                </Text>
              </View>
            ) : (
              users.slice(0, visibleCounts.members).map((u, i, arr) => (
                <Pressable
                  key={u.id}
                  onPress={() => navigation.navigate('UserProfile', { userId: u.id })}
                  style={{
                    borderBottomWidth: i < arr.length - 1 ? 1 : 0,
                    borderBottomColor: colors.border,
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', padding: spacing.sm, paddingHorizontal: spacing.md }}>
                    <Avatar uri={u.avatar} name={u.displayName} size={44} />
                    <View style={{ marginLeft: spacing.sm, flex: 1 }}>
                      <Text style={{ ...typography.bodyBold, color: colors.foreground }}>{u.displayName}</Text>
                      <Text style={{ ...typography.caption, color: colors.textSecondary }}>@{u.username}</Text>
                    </View>
                  </View>
                </Pressable>
              ))
            )}
          </View>
        )}

        {/* Reviews results */}
        {isSearching && debouncedQuery.length >= 2 && activeCategory === 'reviews' && (
          <View style={{ paddingTop: spacing.xs }}>
            {reviewsLoading || reviewsFetching ? (
              <View style={{ marginTop: spacing.md }}><LoadingSpinner fullScreen={false} /></View>
            ) : !reviewResults || reviewResults.length === 0 ? (
              <View style={{ alignItems: 'center', paddingTop: spacing.lg, paddingHorizontal: spacing.xl }}>
                <Ionicons name="chatbubble-outline" size={32} color={colors.textSecondary} />
                <Text style={{ ...typography.body, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.sm }}>
                  No reviews found
                </Text>
              </View>
            ) : (
              reviewResults.slice(0, visibleCounts.reviews).map((review, i, arr) => (
                <ReviewCard
                  key={review.id}
                  review={review}
                  onPress={() => navigation.navigate('ReviewDetail', { reviewId: review.id })}
                  isLast={i === arr.length - 1}
                />
              ))
            )}
          </View>
        )}

        {/* Lists results */}
        {isSearching && debouncedQuery.length >= 2 && activeCategory === 'lists' && (
          <View style={{ paddingTop: spacing.xs }}>
            {listsLoading || listsFetching ? (
              <View style={{ marginTop: spacing.md }}><LoadingSpinner fullScreen={false} /></View>
            ) : !listResults || listResults.length === 0 ? (
              <View style={{ alignItems: 'center', paddingTop: spacing.lg, paddingHorizontal: spacing.xl }}>
                <Ionicons name="list-outline" size={32} color={colors.textSecondary} />
                <Text style={{ ...typography.body, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.sm }}>
                  No lists found
                </Text>
              </View>
            ) : (
              listResults.slice(0, visibleCounts.lists).map((list) => (
                <ListPreviewCard
                  key={list.id}
                  list={list}
                  onPress={() => navigation.navigate('ListDetail', { listId: list.id })}
                  onMatchPress={(matchId) => navigation.navigate('MatchDetail', { matchId })}
                />
              ))
            )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
