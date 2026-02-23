import React, { useState, useMemo } from 'react';
import { View, Text, ScrollView, Pressable, TextInput as RNTextInput, LayoutAnimation, UIManager, Platform, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { useSearchUsers } from '../../hooks/useUser';
import { useMatchesByDate } from '../../hooks/useMatches';
import { Avatar } from '../../components/ui/Avatar';
import { MatchPosterCard } from '../../components/match/MatchPosterCard';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { SearchStackParamList } from '../../types/navigation';

type Nav = NativeStackNavigationProp<SearchStackParamList, 'Search'>;
type Category = 'matches' | 'teams' | 'players' | 'members' | 'reviews' | 'lists';

const NUM_COLUMNS = 3;

export function SearchScreen() {
  const { theme } = useTheme();
  const { colors, spacing, typography, borderRadius } = theme;
  const navigation = useNavigation<Nav>();
  const { width: screenWidth } = useWindowDimensions();
  const [queryStr, setQueryStr] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [activeCategory, setActiveCategory] = useState<Category>('matches');

  const GAP = spacing.sm;
  const HORIZONTAL_PADDING = spacing.md;
  const CARD_WIDTH = (screenWidth - HORIZONTAL_PADDING * 2 - GAP * (NUM_COLUMNS - 1)) / NUM_COLUMNS;

  const { data: users, isLoading: usersLoading } = useSearchUsers(queryStr);
  const { data: todayMatches } = useMatchesByDate(new Date());

  const matchResults = useMemo(() => {
    if (!queryStr || queryStr.length < 2 || !todayMatches) return [];
    const q = queryStr.toLowerCase();
    return todayMatches.filter(
      (m) =>
        m.homeTeam.name.toLowerCase().includes(q) ||
        m.awayTeam.name.toLowerCase().includes(q) ||
        m.homeTeam.shortName.toLowerCase().includes(q) ||
        m.awayTeam.shortName.toLowerCase().includes(q) ||
        m.competition.name.toLowerCase().includes(q)
    );
  }, [queryStr, todayMatches]);

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
            onChangeText={setQueryStr}
            onFocus={() => { LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut); setIsSearching(true); }}
            onBlur={() => { if (!queryStr) { LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut); setIsSearching(false); } }}
            autoCapitalize="none"
            style={{
              flex: 1,
              paddingLeft: 10,
              paddingVertical: 10,
              color: colors.foreground,
              fontSize: 14,
            }}
          />
          {queryStr.length > 0 && (
            <Pressable onPress={() => { LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut); setQueryStr(''); setIsSearching(false); }}>
              <Ionicons name="close" size={18} color={colors.textSecondary} />
            </Pressable>
          )}
        </View>

        {/* Category tabs */}
        {isSearching && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing.sm }}>
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

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 100 }}>
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

        {/* Empty search prompt */}
        {isSearching && !queryStr && (
          <View style={{ alignItems: 'center', paddingTop: spacing.xxl * 2 }}>
            <Text style={{ ...typography.body, color: colors.textSecondary }}>Start typing to search...</Text>
          </View>
        )}

        {/* Matches results — 4-column poster grid */}
        {isSearching && queryStr.length >= 2 && activeCategory === 'matches' && (
          <View style={{ paddingHorizontal: HORIZONTAL_PADDING, paddingTop: spacing.md }}>
            <Text style={{ fontSize: 11, fontWeight: '600', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 1, marginBottom: spacing.sm }}>
              Matches ({matchResults.length})
            </Text>
            {matchResults.length === 0 ? (
              <Text style={{ ...typography.body, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.xl }}>
                No matches found
              </Text>
            ) : (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: GAP }}>
                {matchResults.map((match) => (
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
        {isSearching && queryStr.length >= 2 && activeCategory === 'teams' && (
          <View style={{ alignItems: 'center', paddingTop: spacing.xxl * 2, paddingHorizontal: spacing.xl }}>
            <Ionicons name="shield-outline" size={48} color={colors.textSecondary} />
            <Text style={{ ...typography.body, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.md }}>
              Team search coming soon
            </Text>
          </View>
        )}

        {/* Players and Managers results */}
        {isSearching && queryStr.length >= 2 && activeCategory === 'players' && (
          <View style={{ alignItems: 'center', paddingTop: spacing.xxl * 2, paddingHorizontal: spacing.xl }}>
            <Ionicons name="people-outline" size={48} color={colors.textSecondary} />
            <Text style={{ ...typography.body, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.md }}>
              Player and manager search coming soon
            </Text>
          </View>
        )}

        {/* Members results */}
        {isSearching && queryStr.length >= 2 && activeCategory === 'members' && (
          <View style={{ paddingHorizontal: spacing.md, paddingTop: spacing.md }}>
            <Text style={{ fontSize: 11, fontWeight: '600', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 1, marginBottom: spacing.sm }}>
              Members ({users?.length || 0})
            </Text>
            {usersLoading ? (
              <View style={{ marginTop: spacing.xl }}><LoadingSpinner fullScreen={false} /></View>
            ) : !users || users.length === 0 ? (
              <Text style={{ ...typography.body, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.xl }}>
                No members found
              </Text>
            ) : (
              users.map((u) => (
                <Pressable
                  key={u.id}
                  onPress={() => navigation.navigate('UserProfile', { userId: u.id })}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    padding: spacing.sm,
                    borderRadius: borderRadius.md,
                    marginBottom: spacing.xs,
                  }}
                >
                  <Avatar uri={u.avatar} name={u.displayName} size={44} />
                  <View style={{ marginLeft: spacing.sm, flex: 1 }}>
                    <Text style={{ ...typography.bodyBold, color: colors.foreground }}>{u.displayName}</Text>
                    <Text style={{ ...typography.caption, color: colors.textSecondary }}>@{u.username}</Text>
                  </View>
                </Pressable>
              ))
            )}
          </View>
        )}

        {/* Reviews results */}
        {isSearching && queryStr.length >= 2 && activeCategory === 'reviews' && (
          <View style={{ alignItems: 'center', paddingTop: spacing.xxl * 2, paddingHorizontal: spacing.xl }}>
            <Ionicons name="chatbubble-outline" size={48} color={colors.textSecondary} />
            <Text style={{ ...typography.body, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.md }}>
              Review search coming soon
            </Text>
          </View>
        )}

        {/* Lists results */}
        {isSearching && queryStr.length >= 2 && activeCategory === 'lists' && (
          <View style={{ alignItems: 'center', paddingTop: spacing.xxl * 2, paddingHorizontal: spacing.xl }}>
            <Ionicons name="list-outline" size={48} color={colors.textSecondary} />
            <Text style={{ ...typography.body, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.md }}>
              List search coming soon
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
