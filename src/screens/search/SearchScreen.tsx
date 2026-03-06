import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { View, Text, ScrollView, FlatList, Pressable, TextInput as RNTextInput, useWindowDimensions, Keyboard, LayoutAnimation, Platform, UIManager, ActivityIndicator } from 'react-native';
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
import { Match } from '../../types/match';
import { ReviewCard } from '../../components/review/ReviewCard';
import { ListPreviewCard } from '../../components/list/ListPreviewCard';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { SearchStackParamList } from '../../types/navigation';
import { TeamLogo } from '../../components/match/TeamLogo';
import { shortName } from '../../utils/formatName';
import { useTranslation } from 'react-i18next';

const RECENT_SEARCHES_KEY = 'bookd_recent_searches';
const MAX_RECENT_SEARCHES = 10;

type Nav = NativeStackNavigationProp<SearchStackParamList, 'Search'>;
type Category = 'matches' | 'teams' | 'players' | 'members' | 'reviews' | 'lists';

const NUM_COLUMNS = 3;

const CATEGORY_KEYS: { key: Category; i18nKey: string }[] = [
  { key: 'matches', i18nKey: 'search.matchesTab' },
  { key: 'teams', i18nKey: 'search.teamsTab' },
  { key: 'players', i18nKey: 'search.playersAndManagers' },
  { key: 'members', i18nKey: 'search.members' },
  { key: 'reviews', i18nKey: 'search.reviewsTab' },
  { key: 'lists', i18nKey: 'search.listsTab' },
];

const BROWSE_LINKS: { i18nKey: string; route: keyof SearchStackParamList }[] = [
  { i18nKey: 'search.browseByDate', route: 'BrowseByDate' },
  { i18nKey: 'search.mostPopular', route: 'BrowsePopular' },
  { i18nKey: 'search.highestRated', route: 'BrowseHighestRated' },
];

const EMPTY_ICONS: Record<Category, keyof typeof Ionicons.glyphMap> = {
  matches: 'football-outline',
  teams: 'shield-outline',
  players: 'people-outline',
  members: 'person-outline',
  reviews: 'chatbubble-outline',
  lists: 'list-outline',
};

const EMPTY_LABEL_KEYS: Record<Category, string> = {
  matches: 'common.noResultsFound',
  teams: 'common.noResultsFound',
  players: 'common.noResultsFound',
  members: 'common.noResultsFound',
  reviews: 'common.noResultsFound',
  lists: 'common.noResultsFound',
};

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const LAYOUT_ANIM = LayoutAnimation.create(
  200,
  LayoutAnimation.Types.easeInEaseOut,
  LayoutAnimation.Properties.opacity,
);

export function SearchScreen() {
  const { theme, isDark } = useTheme();
  const { colors, spacing, typography, borderRadius } = theme;
  const navigation = useNavigation<Nav>();
  const { t } = useTranslation();
  const { width: screenWidth } = useWindowDimensions();
  const [queryStr, setQueryStr] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [activeCategory, setActiveCategory] = useState<Category>('matches');
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const recentSearchesRef = useRef<string[]>([]);
  const keyboardVisibleRef = useRef(false);

  // Track keyboard visibility
  useEffect(() => {
    const showSub = Keyboard.addListener('keyboardDidShow', () => { keyboardVisibleRef.current = true; });
    const hideSub = Keyboard.addListener('keyboardDidHide', () => { keyboardVisibleRef.current = false; });
    return () => { showSub.remove(); hideSub.remove(); };
  }, []);

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

  // Debounce search query by 300ms to prevent excessive queries and keep UI responsive
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(queryStr);
      if (queryStr.trim().length >= 2) saveRecentSearch(queryStr);
    }, 300);
    return () => clearTimeout(timer);
  }, [queryStr]);

  const GAP = spacing.sm;
  const HORIZONTAL_PADDING = spacing.md;
  const CARD_WIDTH = (screenWidth - HORIZONTAL_PADDING * 2 - GAP * (NUM_COLUMNS - 1)) / NUM_COLUMNS;

  const { data: users, isLoading: usersLoading } = useSearchUsers(debouncedQuery, activeCategory === 'members');
  const { data: matchPages, isLoading: matchesLoading, isFetching: matchesFetching, fetchNextPage: fetchNextMatchPage, hasNextPage: hasNextMatchPage, isFetchingNextPage: isFetchingNextMatchPage } = useSearchMatches(debouncedQuery, activeCategory === 'matches');
  const matchResults = useMemo(() => {
    if (!matchPages?.pages) return [];
    // Flatten all pages, deduplicate, preserve per-page ordering
    const seen = new Set<number>();
    const all: Match[] = [];
    for (const page of matchPages.pages) {
      for (const m of page.matches) {
        if (!seen.has(m.id)) { seen.add(m.id); all.push(m); }
      }
    }
    return all;
  }, [matchPages]);
  const { data: teamResults, isLoading: teamsLoading } = useSearchTeams(debouncedQuery, activeCategory === 'teams');
  const { data: playerPages, isLoading: playersLoading, isFetching: playersFetching, fetchNextPage: fetchNextPlayerPage, hasNextPage: hasNextPlayerPage, isFetchingNextPage: isFetchingNextPlayerPage } = useSearchPlayers(debouncedQuery, activeCategory === 'players');
  const playerResults = useMemo(() => {
    if (!playerPages?.pages) return [];
    return playerPages.pages.flatMap((p) => p.players);
  }, [playerPages]);
  const { data: reviewResults, isLoading: reviewsLoading, isFetching: reviewsFetching } = useSearchReviews(debouncedQuery, activeCategory === 'reviews');
  const { data: listResults, isLoading: listsLoading, isFetching: listsFetching } = useSearchLists(debouncedQuery, activeCategory === 'lists');

  const hasQuery = isSearching && debouncedQuery.length >= 2;
  const isLoading = hasQuery && (
    (activeCategory === 'matches' && matchesLoading) ||
    (activeCategory === 'teams' && teamsLoading) ||
    (activeCategory === 'players' && (playersLoading || playersFetching)) ||
    (activeCategory === 'members' && usersLoading) ||
    (activeCategory === 'reviews' && (reviewsLoading || reviewsFetching)) ||
    (activeCategory === 'lists' && (listsLoading || listsFetching))
  );

  // Get current results based on active category
  const currentResults = useMemo(() => {
    if (!hasQuery) return [];
    switch (activeCategory) {
      case 'matches': return matchResults || [];
      case 'teams': return teamResults || [];
      case 'players': return playerResults || [];
      case 'members': return users || [];
      case 'reviews': return reviewResults || [];
      case 'lists': return listResults || [];
      default: return [];
    }
  }, [hasQuery, activeCategory, matchResults, teamResults, playerResults, users, reviewResults, listResults]);

  const renderItem = useCallback(({ item }: { item: any }) => {
    switch (activeCategory) {
      case 'matches':
        return (
          <MatchPosterCard
            match={item}
            onPress={() => navigation.navigate('MatchDetail', { matchId: item.id })}
            width={CARD_WIDTH}
          />
        );
      case 'teams':
        return (
          <Pressable
            onPress={() => navigation.navigate('TeamDetail', { teamId: item.id, teamName: item.name, teamCrest: item.crest })}
            style={({ pressed }) => ({
              borderBottomWidth: 1,
              borderBottomColor: colors.border,
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm + 2, paddingHorizontal: spacing.md }}>
              <TeamLogo uri={item.crest} size={28} />
              <Text style={{ ...typography.body, color: colors.foreground, fontSize: 15, flex: 1 }}>{item.name}</Text>
              <Ionicons name="chevron-forward" size={14} color={colors.textSecondary} />
            </View>
          </Pressable>
        );
      case 'players':
        return (
          <Pressable
            onPress={() => navigation.navigate('PersonDetail', { personId: item.id, personName: shortName(item.name), role: item.position === 'Coach' ? 'manager' : 'player' })}
            style={({ pressed }) => ({
              borderBottomWidth: 1,
              borderBottomColor: colors.border,
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm + 2, paddingHorizontal: spacing.md }}>
              <Avatar uri={item.photo} name={item.name} size={36} />
              <View style={{ flex: 1 }}>
                <Text style={{ ...typography.body, color: colors.foreground, fontSize: 15 }}>{shortName(item.name)}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
                  {item.position && (
                    <Text style={{ ...typography.caption, color: colors.textSecondary }}>{item.position}</Text>
                  )}
                  {item.currentTeam && (
                    <Text style={{ ...typography.caption, color: colors.textSecondary }}>
                      {item.position ? ' · ' : ''}{item.currentTeam.name}
                    </Text>
                  )}
                </View>
              </View>
              <Ionicons name="chevron-forward" size={14} color={colors.textSecondary} />
            </View>
          </Pressable>
        );
      case 'members':
        return (
          <Pressable
            onPress={() => navigation.navigate('UserProfile', { userId: item.id })}
            style={{
              borderBottomWidth: 1,
              borderBottomColor: colors.border,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', padding: spacing.sm, paddingHorizontal: spacing.md }}>
              <Avatar uri={item.avatar} name={item.displayName} size={44} />
              <View style={{ marginLeft: spacing.sm, flex: 1 }}>
                <Text style={{ ...typography.bodyBold, color: colors.foreground }}>{item.displayName}</Text>
                <Text style={{ ...typography.caption, color: colors.textSecondary }}>@{item.username}</Text>
              </View>
            </View>
          </Pressable>
        );
      case 'reviews':
        return (
          <ReviewCard
            review={item}
            onPress={() => navigation.navigate('ReviewDetail', { reviewId: item.id })}
          />
        );
      case 'lists':
        return (
          <ListPreviewCard
            list={item}
            onPress={() => navigation.navigate('ListDetail', { listId: item.id })}
            onMatchPress={(matchId) => navigation.navigate('MatchDetail', { matchId })}
          />
        );
      default:
        return null;
    }
  }, [activeCategory, colors, spacing, typography, navigation, CARD_WIDTH]);

  const keyExtractor = useCallback((item: any) => String(item.id), []);

  // Content to show when NOT searching (browse view) or when searching with no query yet (recent searches)
  const renderNonResultContent = () => {
    if (!isSearching) {
      return (
        <ScrollView showsVerticalScrollIndicator={false} indicatorStyle={isDark ? 'white' : 'default'} style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 0 }} keyboardShouldPersistTaps="always" keyboardDismissMode="on-drag">
          <View style={{ paddingVertical: spacing.lg, paddingHorizontal: spacing.md }}>
            <Text style={{ ...typography.h4, color: colors.foreground, marginBottom: spacing.md }}>
              {t('search.browseBy')}
            </Text>
            <View style={{ backgroundColor: colors.card, borderRadius: borderRadius.md, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' }}>
              {BROWSE_LINKS.map((link, i) => (
                <Pressable
                  key={link.i18nKey}
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
                  <Text style={{ ...typography.body, color: colors.foreground }}>{t(link.i18nKey)}</Text>
                  <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
                </Pressable>
              ))}
            </View>

            {/* Bookd section */}
            <Text style={{ ...typography.h4, color: colors.foreground, marginTop: spacing.xl, marginBottom: spacing.md }}>
              bookd
            </Text>
            <View style={{ backgroundColor: colors.card, borderRadius: borderRadius.md, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' }}>
              {[{ i18nKey: 'search.newHere', route: 'NewHere' as const }, { i18nKey: 'search.frequentQuestions', route: 'FAQ' as const }].map((item, i) => (
                <Pressable
                  key={item.i18nKey}
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
                  <Text style={{ ...typography.body, color: colors.foreground }}>{t(item.i18nKey)}</Text>
                  <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
                </Pressable>
              ))}
            </View>
          </View>
        </ScrollView>
      );
    }

    // Searching but no query yet — show recent searches
    if (!queryStr) {
      return (
        <ScrollView showsVerticalScrollIndicator={false} indicatorStyle={isDark ? 'white' : 'default'} style={{ flex: 1 }} keyboardShouldPersistTaps="always" keyboardDismissMode="on-drag">
          {recentSearches.length > 0 ? (
            <View style={{ paddingTop: spacing.md }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm, paddingHorizontal: spacing.md }}>
                <Text style={{ ...typography.h4, color: colors.foreground }}>{t('search.recentSearches')}</Text>
                <Pressable
                  onPress={async () => {
                    setRecentSearches([]);
                    recentSearchesRef.current = [];
                    await AsyncStorage.removeItem(RECENT_SEARCHES_KEY);
                  }}
                  hitSlop={8}
                >
                  <Text style={{ ...typography.caption, color: colors.textSecondary }}>{t('search.clearAll')}</Text>
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
              <Text style={{ ...typography.body, color: colors.textSecondary }}>{t('search.startTypingToSearch')}</Text>
            </View>
          )}
        </ScrollView>
      );
    }

    return null;
  };

  // Render search results with FlatList (or loading/empty state)
  const renderSearchResults = () => {
    if (!hasQuery) return null;

    if (isLoading) {
      return (
        <View style={{ flex: 1, marginTop: spacing.xl }}>
          <LoadingSpinner fullScreen={false} />
        </View>
      );
    }

    if (currentResults.length === 0) {
      return (
        <View style={{ flex: 1, alignItems: 'center', paddingTop: spacing.lg, paddingHorizontal: spacing.xl }}>
          <Ionicons name={EMPTY_ICONS[activeCategory]} size={32} color={colors.textSecondary} />
          <Text style={{ ...typography.body, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.sm }}>
            {t(EMPTY_LABEL_KEYS[activeCategory])}
          </Text>
        </View>
      );
    }

    if (activeCategory === 'matches') {
      return (
        <FlatList showsVerticalScrollIndicator={false}
          key="matches-grid"
          data={currentResults}
          keyExtractor={keyExtractor}
          numColumns={NUM_COLUMNS}
          columnWrapperStyle={{ gap: GAP }}
          contentContainerStyle={{ paddingHorizontal: HORIZONTAL_PADDING, paddingTop: spacing.md, gap: GAP, paddingBottom: spacing.xl }}
          renderItem={renderItem}
          keyboardShouldPersistTaps="always"
          keyboardDismissMode="on-drag"
          indicatorStyle={isDark ? 'white' : 'default'}
          removeClippedSubviews
          onEndReached={() => { if (hasNextMatchPage && !isFetchingNextMatchPage) fetchNextMatchPage(); }}
          onEndReachedThreshold={0.5}
          ListFooterComponent={isFetchingNextMatchPage ? <ActivityIndicator style={{ paddingVertical: spacing.md }} color={colors.primary} /> : null}
        />
      );
    }

    const handleEndReached = activeCategory === 'players' && hasNextPlayerPage && !isFetchingNextPlayerPage
      ? () => fetchNextPlayerPage()
      : undefined;
    const footerComponent = activeCategory === 'players' && isFetchingNextPlayerPage
      ? <ActivityIndicator style={{ paddingVertical: spacing.md }} color={colors.primary} />
      : null;

    return (
      <FlatList showsVerticalScrollIndicator={false}
        key="list"
        data={currentResults}
        keyExtractor={keyExtractor}
        contentContainerStyle={{ paddingTop: spacing.xs, paddingBottom: spacing.xl }}
        renderItem={renderItem}
        keyboardShouldPersistTaps="always"
        keyboardDismissMode="on-drag"
        indicatorStyle={isDark ? 'white' : 'default'}
        removeClippedSubviews
        onEndReached={handleEndReached}
        onEndReachedThreshold={0.5}
        ListFooterComponent={footerComponent}
      />
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      {/* Header */}
      <Pressable onPress={Keyboard.dismiss} style={{ paddingHorizontal: spacing.md, paddingTop: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border }}>
        <Text style={{ ...typography.h2, color: colors.foreground, textAlign: 'center', marginBottom: spacing.md }}>
          {t('common.search')}
        </Text>

        {/* Search input */}
        <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.muted, borderRadius: borderRadius.md, marginBottom: spacing.sm, paddingHorizontal: 12 }}>
          <Ionicons name="search" size={18} color={colors.textSecondary} />
          <RNTextInput
            placeholder={t('search.searchPlaceholder')}
            placeholderTextColor={colors.textSecondary}
            value={queryStr}
            onChangeText={setQueryStr}
            onFocus={() => { LayoutAnimation.configureNext(LAYOUT_ANIM); setIsSearching(true); }}
            onBlur={() => { if (!queryStr) { LayoutAnimation.configureNext(LAYOUT_ANIM); setIsSearching(false); } }}
            autoCapitalize="none"
            autoCorrect={false}
            textContentType="none"
            autoComplete="off"
            style={{
              flex: 1,
              paddingLeft: 10,
              paddingVertical: 10,
              color: colors.foreground,
              fontSize: 14,
            }}
          />
          {queryStr.length > 0 && (
            <Pressable onPress={() => {
              setQueryStr(''); setDebouncedQuery('');
              if (!keyboardVisibleRef.current) {
                LayoutAnimation.configureNext(LAYOUT_ANIM);
                setIsSearching(false);
              }
            }}>
              <Ionicons name="close" size={18} color={colors.textSecondary} />
            </Pressable>
          )}
        </View>

        {/* Category tabs */}
        {isSearching && (
          <ScrollView showsVerticalScrollIndicator={false} horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="always" style={{ marginBottom: spacing.sm }}>
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              {CATEGORY_KEYS.map((cat) => (
                <Pressable
                  key={cat.key}
                  onPress={() => {
                    if (queryStr.trim()) Keyboard.dismiss();
                    setActiveCategory(cat.key);
                  }}
                  hitSlop={8}
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
                    {t(cat.i18nKey)}
                  </Text>
                </Pressable>
              ))}
            </View>
          </ScrollView>
        )}
      </Pressable>

      {/* Content area — tap empty space to dismiss keyboard */}
      <Pressable style={{ flex: 1 }} onPress={Keyboard.dismiss}>
        {renderNonResultContent()}
        {renderSearchResults()}
      </Pressable>
    </SafeAreaView>
  );
}
