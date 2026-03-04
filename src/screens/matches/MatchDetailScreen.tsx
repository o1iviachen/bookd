import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { View, Text, Pressable, ScrollView, Animated, useWindowDimensions, Share, KeyboardAvoidingView, Platform } from 'react-native';
import { Select } from '../../components/ui/Select';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useQueries, useQueryClient } from '@tanstack/react-query';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { useMatch, useMatchDetail } from '../../hooks/useMatches';
import { useReviewsForMatch } from '../../hooks/useReviews';
import { useUserProfile, useReviewerTeamIds } from '../../hooks/useUser';
import { getUserProfile } from '../../services/firestore/users';
import { useListsForMatch } from '../../hooks/useLists';
import { TeamLogo } from '../../components/match/TeamLogo';
import { Avatar } from '../../components/ui/Avatar';
import { StarRating } from '../../components/ui/StarRating';
import { ReviewCard } from '../../components/review/ReviewCard';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { AddToListModal } from '../../components/list/AddToListModal';
import { ActionMenu } from '../../components/ui/ActionMenu';
import { RatingChart } from '../../components/profile/RatingChart';
import { formatFullDate, formatMatchTime } from '../../utils/formatDate';
import { getStadiumImageUrl } from '../../utils/stadiumImages';
import { MatchesStackParamList } from '../../types/navigation';
import { MatchDetail, MatchPlayer, MatchGoal, MatchBooking, MatchSubstitution } from '../../services/footballApi';
import { shortName, lastName } from '../../utils/formatName';
import { nationalityFlag } from '../../utils/flagEmoji';
import { MatchPosterCard } from '../../components/match/MatchPosterCard';
import { DiscussionSection, DiscussionInputBar } from '../../components/discussion/DiscussionSection';
import { useDiscussion } from '../../hooks/useDiscussion';
import { User } from '../../types/user';

type MatchTab = 'reviews' | 'discussion' | 'lineup' | 'info';

type Props = NativeStackScreenProps<MatchesStackParamList, 'MatchDetail'>;

const FALLBACK_STADIUM = 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d2/London_Wembley.jpg/1280px-London_Wembley.jpg';

const HERO_HEIGHT = 320;
const COMP_ROW_HEIGHT = 28;
const TAB_BAR_HEIGHT = 44;
const STICKY_NAV_HEIGHT = 44;
const REFEREE_MOTM_ID = -1;

export function MatchDetailScreen({ route, navigation }: Props) {
  const { theme, isDark } = useTheme();
  const { colors, spacing, typography, borderRadius } = theme;
  const { user } = useAuth();
  const { matchId } = route.params;
  const [showListModal, setShowListModal] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [activeTabIndex, setActiveTabIndex] = useState(0);
  const scrollY = useRef(new Animated.Value(0)).current;
  const insets = useSafeAreaInsets();
  const MATCH_TABS: { key: MatchTab; label: string }[] = [
    { key: 'reviews', label: 'Reviews' },
    { key: 'discussion', label: 'Discussion' },
    { key: 'lineup', label: 'Lineup' },
    { key: 'info', label: 'Info' },
  ];

  const handleTabPress = useCallback((index: number) => {
    setActiveTabIndex(index);
  }, []);


  const handleScroll = useMemo(
    () => Animated.event(
      [{ nativeEvent: { contentOffset: { y: scrollY } } }],
      { useNativeDriver: true },
    ),
    [scrollY],
  );

  const queryClient = useQueryClient();

  // How far the user must scroll before the sticky mini-header appears
  // (entire header scrolls away: hero + comp row + tab bar)
  const collapseDistance = useMemo(
    () => HERO_HEIGHT + COMP_ROW_HEIGHT + TAB_BAR_HEIGHT - insets.top - STICKY_NAV_HEIGHT,
    [insets.top],
  );

  // Sticky mini-header fades in once the original header is mostly gone
  const stickyHeaderOpacity = useMemo(
    () => scrollY.interpolate({
      inputRange: [collapseDistance - 60, collapseDistance],
      outputRange: [0, 1],
      extrapolate: 'clamp',
    }),
    [collapseDistance],
  );

  // Track whether header is collapsed for pointer events on sticky nav
  const [headerCollapsed, setHeaderCollapsed] = useState(false);
  useEffect(() => {
    const id = scrollY.addListener(({ value }) => {
      setHeaderCollapsed(value >= collapseDistance - 10);
    });
    return () => scrollY.removeListener(id);
  }, [collapseDistance]);

  const { data: match, isLoading } = useMatch(matchId);
  const { data: reviews } = useReviewsForMatch(matchId);
  const { data: profile } = useUserProfile(user?.uid || '');
  const { data: matchLists } = useListsForMatch(matchId);
  const { data: matchDetail } = useMatchDetail(matchId);

  // MOTM winner from aggregated votes on match doc
  const motmWinnerId = useMemo(() => {
    const votes = match?.motmVotes;
    if (!votes) return null;
    let maxCount = 0;
    let winnerId: number | null = null;
    for (const [playerId, count] of Object.entries(votes)) {
      if (count > maxCount) {
        maxCount = count;
        winnerId = Number(playerId);
      }
    }
    return winnerId;
  }, [match?.motmVotes]);

  // Fetch reviewer team affiliations for ratings filter
  const reviewerUserIds = useMemo(() => (reviews || []).map((r) => r.userId), [reviews]);
  const { data: reviewerTeamMap } = useReviewerTeamIds(reviewerUserIds);

  const handleRefresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['match', matchId] });
    queryClient.invalidateQueries({ queryKey: ['reviews', 'match', matchId] });
    queryClient.invalidateQueries({ queryKey: ['matchDetail', matchId] });
    queryClient.invalidateQueries({ queryKey: ['lists', 'match', matchId] });
  }, [queryClient, matchId]);

  const handleScrollEndDrag = useCallback((e: any) => {
    if (e.nativeEvent.contentOffset.y < -80) handleRefresh();
  }, [handleRefresh]);

  // Discussion window: open 30 min before kickoff through full-time
  const [now, setNow] = useState(Date.now());
  const matchKickoff = match?.kickoff;
  const matchStatus = match?.status;
  useEffect(() => {
    if (!matchKickoff) return;
    const kickoffMs = new Date(matchKickoff).getTime();
    const delta = (kickoffMs - 30 * 60 * 1000) - Date.now();
    if (delta > 0 && delta < 60 * 60 * 1000) {
      const timer = setTimeout(() => setNow(Date.now()), delta);
      return () => clearTimeout(timer);
    }
  }, [matchKickoff]);

  const isDiscussionOpen = useMemo(() => {
    if (!matchKickoff || !matchStatus) return false;
    const kickoffMs = new Date(matchKickoff).getTime();
    const preMatchWindow = kickoffMs - 30 * 60 * 1000;
    const live = matchStatus === 'IN_PLAY' || matchStatus === 'PAUSED';
    return live || (['TIMED', 'SCHEDULED'].includes(matchStatus) && now >= preMatchWindow);
  }, [matchKickoff, matchStatus, now]);

  const isDiscussionReadable = isDiscussionOpen || matchStatus === 'FINISHED';
  const isDiscussionTabActive = MATCH_TABS[activeTabIndex]?.key === 'discussion';

  const { messages: discussionMessages, isLoading: discussionLoading } =
    useDiscussion(matchId, isDiscussionTabActive && isDiscussionReadable);

  if (isLoading || !match) {
    return <LoadingSpinner />;
  }

  const isFinished = match.status === 'FINISHED';
  const isLive = match.status === 'IN_PLAY' || match.status === 'PAUSED';

  const userReviews = reviews?.filter((r) => r.userId === user?.uid) || [];
  const hasReview = userReviews.length > 0;

  const stadiumUrl = getStadiumImageUrl(match.homeTeam.id);

  const handleShare = async () => {
    const label = (isFinished || isLive)
      ? `${match.homeTeam.shortName} ${match.homeScore} - ${match.awayScore} ${match.awayTeam.shortName} · ${match.competition.name} on bookd`
      : `${match.homeTeam.shortName} vs ${match.awayTeam.shortName} · ${match.competition.name} on bookd`;
    try {
      await Share.share({ message: label, url: `bookd://match/${matchId}` });
    } catch (err) {
      // User cancelled or share failed — ignore
    }
  };

  const stickyScoreText = (isFinished || isLive)
    ? `${match.homeTeam.shortName}  ${match.homeScore} - ${match.awayScore}  ${match.awayTeam.shortName}`
    : `${match.homeTeam.shortName}  vs  ${match.awayTeam.shortName}`;

  // Header rendered inside each ScrollView — scrolls naturally with content
  const renderMatchHeader = () => (
    <>
      {/* Hero area with stadium background — stretchy parallax on pull-down */}
      <View style={{ height: HERO_HEIGHT, backgroundColor: colors.background, overflow: 'visible' }}>
        <Animated.View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: HERO_HEIGHT,
            transform: [
              {
                translateY: scrollY.interpolate({
                  inputRange: [-HERO_HEIGHT, 0],
                  outputRange: [-HERO_HEIGHT / 2, 0],
                  extrapolateRight: 'clamp',
                }),
              },
              {
                scale: scrollY.interpolate({
                  inputRange: [-HERO_HEIGHT, 0],
                  outputRange: [2, 1],
                  extrapolateRight: 'clamp',
                }),
              },
            ],
          }}
        >
          <Image
            source={{ uri: stadiumUrl || FALLBACK_STADIUM }}
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
            contentFit="cover"
            transition={300}
          />
          <LinearGradient
            colors={['rgba(0,0,0,0.3)', 'rgba(0,0,0,0.5)']}
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
          />
        </Animated.View>

        {/* Back button overlay */}
        <Pressable
          onPress={() => navigation.goBack()}
          style={{
            position: 'absolute',
            top: insets.top + spacing.xs,
            left: spacing.md,
            zIndex: 10,
            backgroundColor: 'rgba(0,0,0,0.5)',
            borderRadius: borderRadius.full,
            padding: spacing.sm,
          }}
        >
          <Ionicons name="arrow-back" size={20} color="#fff" />
        </Pressable>

        {/* Three-dot menu button */}
        <Pressable
          onPress={() => setShowMenu(true)}
          style={{
            position: 'absolute',
            top: insets.top + spacing.xs,
            right: spacing.md,
            zIndex: 10,
            backgroundColor: 'rgba(0,0,0,0.5)',
            borderRadius: borderRadius.full,
            padding: spacing.sm,
          }}
        >
          <Ionicons name="ellipsis-horizontal" size={20} color="#fff" />
        </Pressable>

        {/* Team crests in hero */}
        <View
          style={{
            flex: 1,
            flexDirection: 'row',
            alignItems: 'flex-end',
            justifyContent: 'center',
            gap: spacing.xxl,
            paddingBottom: 80,
            zIndex: 5,
          }}
        >
          <Pressable onPress={() => (navigation as any).navigate('TeamDetail', { teamId: match.homeTeam.id, teamName: match.homeTeam.name, teamCrest: match.homeTeam.crest })}>
            <TeamLogo uri={match.homeTeam.crest} size={80} />
          </Pressable>
          <Pressable onPress={() => (navigation as any).navigate('TeamDetail', { teamId: match.awayTeam.id, teamName: match.awayTeam.name, teamCrest: match.awayTeam.crest })}>
            <TeamLogo uri={match.awayTeam.crest} size={80} />
          </Pressable>
        </View>

        {/* Gradient overlay at bottom of hero */}
        <LinearGradient
          colors={['transparent', `${colors.background}40`, `${colors.background}99`, `${colors.background}cc`, colors.background]}
          locations={[0, 0.3, 0.55, 0.75, 1]}
          style={{
            position: 'absolute', bottom: 0, left: 0, right: 0, height: 200,
            justifyContent: 'flex-end', alignItems: 'center', paddingBottom: spacing.xs,
          }}
        >
          {(isFinished || isLive) ? (
            <>
              <View style={{ flexDirection: 'row', alignItems: 'center', alignSelf: 'stretch', paddingHorizontal: spacing.md }}>
                <Pressable onPress={() => (navigation as any).navigate('TeamDetail', { teamId: match.homeTeam.id, teamName: match.homeTeam.name, teamCrest: match.homeTeam.crest })} style={{ flex: 1 }}>
                  <Text style={{ ...typography.bodyBold, color: colors.foreground, fontSize: 16, textAlign: 'right' }} numberOfLines={1}>{match.homeTeam.shortName}</Text>
                </Pressable>
                <Text style={{ fontSize: 40, fontWeight: '700', color: colors.primary, paddingHorizontal: spacing.md }}>
                  {match.homeScore} - {match.awayScore}
                </Text>
                <Pressable onPress={() => (navigation as any).navigate('TeamDetail', { teamId: match.awayTeam.id, teamName: match.awayTeam.name, teamCrest: match.awayTeam.crest })} style={{ flex: 1 }}>
                  <Text style={{ ...typography.bodyBold, color: colors.foreground, fontSize: 16, textAlign: 'left' }} numberOfLines={1}>{match.awayTeam.shortName}</Text>
                </Pressable>
              </View>
              {isLive && (
                <View style={{ backgroundColor: colors.primary, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4, marginTop: 4 }}>
                  <Text style={{ fontSize: 11, fontWeight: '800', color: '#14181c' }}>LIVE</Text>
                </View>
              )}
              {isFinished && (
                <Text style={{ ...typography.caption, color: colors.textSecondary, marginTop: 4 }}>Full Time</Text>
              )}
            </>
          ) : (
            <>
              <View style={{ flexDirection: 'row', alignItems: 'center', alignSelf: 'stretch', paddingHorizontal: spacing.md }}>
                <Pressable onPress={() => (navigation as any).navigate('TeamDetail', { teamId: match.homeTeam.id, teamName: match.homeTeam.name, teamCrest: match.homeTeam.crest })} style={{ flex: 1 }}>
                  <Text style={{ ...typography.bodyBold, color: colors.foreground, textAlign: 'right' }} numberOfLines={1}>{match.homeTeam.shortName}</Text>
                </Pressable>
                <Text style={{ ...typography.h2, color: colors.textSecondary, paddingHorizontal: spacing.md }}>vs</Text>
                <Pressable onPress={() => (navigation as any).navigate('TeamDetail', { teamId: match.awayTeam.id, teamName: match.awayTeam.name, teamCrest: match.awayTeam.crest })} style={{ flex: 1 }}>
                  <Text style={{ ...typography.bodyBold, color: colors.foreground, textAlign: 'left' }} numberOfLines={1}>{match.awayTeam.shortName}</Text>
                </Pressable>
              </View>
              <Text style={{ ...typography.caption, color: colors.textSecondary, marginTop: 4 }}>
                {formatMatchTime(match.kickoff)}
              </Text>
            </>
          )}
        </LinearGradient>
      </View>

      {/* Competition + date */}
      <Pressable
        onPress={() => (navigation as any).navigate('LeagueDetail', { competitionCode: match.competition.code, competitionName: match.competition.name, competitionEmblem: match.competition.emblem })}
        style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs, paddingBottom: spacing.xs, backgroundColor: colors.background, opacity: pressed ? 0.7 : 1 })}
      >
        <View style={{ backgroundColor: '#fff', borderRadius: 4, padding: 2 }}>
          <TeamLogo uri={match.competition.emblem} size={16} />
        </View>
        <Text style={{ ...typography.caption, color: colors.textSecondary }}>
          {match.competition.name}{roundLabel(match) ? ` · ${roundLabel(match)}` : ''} · {formatFullDate(match.kickoff)}
        </Text>
      </Pressable>

      {/* Tab bar */}
      <View style={{ flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.background }}>
        {MATCH_TABS.map((tab, i) => {
          const isActive = activeTabIndex === i;
          return (
            <Pressable
              key={tab.key}
              onPress={() => handleTabPress(i)}
              style={{
                flex: 1,
                alignItems: 'center',
                paddingVertical: spacing.sm,
                borderBottomWidth: 2,
                borderBottomColor: isActive ? colors.primary : 'transparent',
              }}
            >
              <Text style={{
                ...typography.body,
                fontWeight: isActive ? '600' : '400',
                color: isActive ? colors.foreground : colors.textSecondary,
                fontSize: 15,
              }}>
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </>
  );

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.background }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {/* ─── Single ScrollView with header + active tab content ─── */}
      <Animated.ScrollView
        style={{ backgroundColor: colors.background }}
        indicatorStyle={isDark ? 'white' : 'default'}
        contentContainerStyle={{ paddingBottom: 16 }}
        onScroll={handleScroll}
        onScrollEndDrag={handleScrollEndDrag}
        scrollEventThrottle={16}
        bounces
      >
        {renderMatchHeader()}

        {/* ─── Active tab content ─── */}
        {activeTabIndex === 0 && (
          <View>
            {/* Stats row */}
            {isFinished && reviews && reviews.length > 0 && (
              <View style={{ flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.md, marginTop: spacing.sm, marginBottom: spacing.md }}>
                <Pressable
                  onPress={() => navigation.navigate('WatchedBy', { matchId })}
                  style={{ flex: 1, backgroundColor: colors.primary, borderRadius: borderRadius.md, padding: spacing.md, alignItems: 'center' }}
                >
                  <Text style={{ fontSize: 24, fontWeight: '700', color: '#14181c' }}>{new Set(reviews.map((r: any) => r.userId)).size}</Text>
                  <Text style={{ fontSize: 11, color: '#14181c', fontWeight: '500' }}>Watched</Text>
                </Pressable>
                <Pressable
                  onPress={() => navigation.navigate('MatchLists', { matchId })}
                  style={{ flex: 1, backgroundColor: '#3b82f6', borderRadius: borderRadius.md, padding: spacing.md, alignItems: 'center' }}
                >
                  <Text style={{ fontSize: 24, fontWeight: '700', color: '#fff' }}>{matchLists?.length || 0}</Text>
                  <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.8)' }}>Lists</Text>
                </Pressable>
              </View>
            )}

            {/* Rating distribution bar chart */}
            {isFinished && reviews && reviews.length > 0 && (
              <RatingChart
                reviews={reviews}
                showStats
                homeTeamId={match.homeTeam.id}
                awayTeamId={match.awayTeam.id}
                homeTeamName={match.homeTeam.name}
                awayTeamName={match.awayTeam.name}
                reviewerTeamMap={reviewerTeamMap}
              />
            )}

            {/* Locked state for non-finished matches */}
            {!isFinished && (
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  backgroundColor: colors.muted,
                  borderRadius: borderRadius.md,
                  padding: spacing.md,
                  marginHorizontal: spacing.md,
                  marginTop: spacing.md,
                  gap: spacing.sm,
                }}
              >
                <Ionicons name="lock-closed" size={18} color={colors.textSecondary} />
                <Text style={{ ...typography.body, color: colors.textSecondary, flex: 1 }}>
                  {isLive ? 'Reviews unlock after full time' : 'Reviews unlock after this match is played'}
                </Text>
              </View>
            )}

            {/* Watched by friends */}
            {isFinished && reviews && reviews.length > 0 && (profile?.following?.length || 0) > 0 && (
              <WatchedByFriends
                reviews={reviews}
                matchId={matchId}
                following={profile?.following || []}
                colors={colors}
                spacing={spacing}
                typography={typography}
                navigation={navigation}
              />
            )}

            {/* Review CTA */}
            {isFinished && (
              <Pressable
                onPress={() => navigation.navigate('CreateReview', { matchId })}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  backgroundColor: colors.muted,
                  borderRadius: borderRadius.md,
                  padding: spacing.md,
                  marginHorizontal: spacing.md,
                  marginTop: spacing.md,
                  gap: spacing.md,
                }}
              >
                <View style={{ flex: 1 }}>
                  <Text style={{ ...typography.bodyBold, color: colors.foreground }}>
                    {hasReview ? 'Log again...' : 'Rate or review...'}
                  </Text>
                  <Text style={{ ...typography.small, color: colors.textSecondary }}>
                    {hasReview ? 'Add another diary entry' : 'Share your thoughts on this match'}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
              </Pressable>
            )}

            {/* Reviews section */}
            {isFinished && (
              <ReviewsSection reviews={reviews || []} userId={user?.uid} profile={profile} colors={colors} spacing={spacing} typography={typography} borderRadius={borderRadius} navigation={navigation} />
            )}
          </View>
        )}

        {activeTabIndex === 1 && (
          <DiscussionSection
            matchId={matchId}
            messages={discussionMessages}
            isLoading={discussionLoading}
            isOpen={isDiscussionOpen}
            isReadable={isDiscussionReadable}
            isFinished={isFinished}
            userId={user?.uid || null}
            colors={colors}
            spacing={spacing}
            typography={typography}
            borderRadius={borderRadius}
            navigation={navigation}
          />
        )}

        {activeTabIndex === 2 && (
          <LineupSection matchDetail={matchDetail || null} match={match} colors={colors} spacing={spacing} typography={typography} navigation={navigation} motmWinnerId={motmWinnerId} />
        )}

        {activeTabIndex === 3 && (
          <InfoSection matchDetail={matchDetail || null} match={match} colors={colors} spacing={spacing} typography={typography} borderRadius={borderRadius} navigation={navigation} />
        )}
      </Animated.ScrollView>

      {/* ─── Discussion input bar — only when discussion tab active & writable ─── */}
      {user && isDiscussionTabActive && isDiscussionOpen && (
        <DiscussionInputBar
          matchId={matchId}
          userId={user.uid}
          profile={profile}
          colors={colors}
          spacing={spacing}
          borderRadius={borderRadius}
        />
      )}

      {/* ─── Sticky mini-header — fades in when hero scrolls away ─── */}
      <Animated.View
        pointerEvents={headerCollapsed ? 'auto' : 'none'}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 25,
          opacity: stickyHeaderOpacity,
        }}
      >
        <View style={{
          paddingTop: insets.top,
          height: insets.top + STICKY_NAV_HEIGHT,
          backgroundColor: colors.background,
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: spacing.md,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        }}>
          <Pressable
            onPress={() => navigation.goBack()}
            style={{ padding: spacing.xs, marginRight: spacing.sm }}
          >
            <Ionicons name="arrow-back" size={22} color={colors.foreground} />
          </Pressable>
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text style={{ ...typography.bodyBold, color: colors.foreground, fontSize: 15 }} numberOfLines={1}>
              {stickyScoreText}
            </Text>
          </View>
          <Pressable
            onPress={() => setShowMenu(true)}
            style={{ padding: spacing.xs, marginLeft: spacing.sm }}
          >
            <Ionicons name="ellipsis-horizontal" size={22} color={colors.foreground} />
          </Pressable>
        </View>
      </Animated.View>

      {/* Fixed gradient overlay behind status bar */}
      <LinearGradient
        colors={['rgba(0,0,0,0.6)', 'rgba(0,0,0,0.3)', 'transparent']}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: insets.top + 40,
          zIndex: 20,
        }}
        pointerEvents="none"
      />

      {/* Three-dot menu */}
      <ActionMenu
        visible={showMenu}
        onClose={() => setShowMenu(false)}
        items={[
          { label: 'Add to list', icon: 'list-outline', onPress: () => { setShowMenu(false); setShowListModal(true); } },
          { label: 'Share', icon: 'share-social-outline', onPress: () => { setShowMenu(false); setTimeout(handleShare, 300); } },
        ]}
      />

      {/* Add to List Modal */}
      <AddToListModal
        visible={showListModal}
        onClose={() => setShowListModal(false)}
        matchId={matchId}
      />

    </KeyboardAvoidingView>
  );
}

/* ─── Watched by friends (horizontal avatar row) ─── */

function WatchedByFriends({ reviews, matchId, following, colors, spacing, typography, navigation }: {
  reviews: any[];
  matchId: number;
  following: string[];
  colors: any;
  spacing: any;
  typography: any;
  navigation: any;
}) {
  // Get friend reviews grouped by userId (latest review per user + aggregated data)
  const { friendLatest, friendAllByUser } = useMemo(() => {
    const latestMap = new Map<string, any>();
    const allMap = new Map<string, any[]>();
    const sorted = [...reviews].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    for (const r of sorted) {
      if (!following.includes(r.userId)) continue;
      if (!latestMap.has(r.userId)) latestMap.set(r.userId, r);
      if (!allMap.has(r.userId)) allMap.set(r.userId, []);
      allMap.get(r.userId)!.push(r);
    }
    return { friendLatest: Array.from(latestMap.values()), friendAllByUser: allMap };
  }, [reviews, following]);

  // Fetch profiles for friend watchers
  const friendIds = useMemo(() => friendLatest.map((r) => r.userId), [friendLatest]);
  const profileQueries = useQueries({
    queries: friendIds.map((uid) => ({
      queryKey: ['user', uid],
      queryFn: () => getUserProfile(uid),
      staleTime: 2 * 60 * 1000,
      enabled: friendIds.length > 0,
    })),
  });

  const friendWatchers = useMemo(() => {
    const entries: { userId: string; profile: User; rating: number; hasText: boolean; likedMatch: boolean; username: string; reviewCount: number; singleReviewId: string | null }[] = [];
    profileQueries.forEach((q) => {
      if (!q.data) return;
      const p = q.data;
      const latestReview = friendLatest.find((r) => r.userId === p.id);
      if (!latestReview) return;
      const allUserReviews = friendAllByUser.get(p.id) || [];
      const hasAnyText = allUserReviews.some((r: any) => (r.text?.trim().length || 0) > 0);
      entries.push({
        userId: p.id,
        profile: p,
        rating: latestReview.rating,
        hasText: hasAnyText,
        likedMatch: p.likedMatchIds?.some((id: number) => String(id) === String(matchId)) || false,
        username: p.displayName || p.username,
        reviewCount: allUserReviews.length,
        singleReviewId: allUserReviews.length === 1 ? allUserReviews[0].id : null,
      });
    });
    return entries;
  }, [profileQueries, friendLatest, friendAllByUser, matchId]);

  if (friendWatchers.length === 0) return null;

  return (
    <View style={{ paddingHorizontal: spacing.md, paddingVertical: spacing.md, backgroundColor: `${colors.accent}30`, borderBottomWidth: 1, borderColor: colors.border }}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm }}>
        <Text style={{ fontSize: 11, fontWeight: '600', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 1 }}>
          Watched by
        </Text>
        <Pressable
          onPress={() => navigation.navigate('WatchedBy', { matchId, initialTab: 'friends' })}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}
        >
          <Text style={{ ...typography.caption, color: colors.primary }}>More</Text>
          <Ionicons name="chevron-forward" size={14} color={colors.primary} />
        </Pressable>
      </View>

      {/* Horizontal avatar scroll */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.md }}>
        {friendWatchers.map((w) => {
          const handlePress = () => {
            if (w.singleReviewId) {
              navigation.navigate('ReviewDetail', { reviewId: w.singleReviewId });
            } else {
              navigation.navigate('UserMatchReviews', { matchId, userId: w.userId, username: w.username });
            }
          };

          return (
            <Pressable key={w.userId} onPress={handlePress} style={{ alignItems: 'center', width: 64 }}>
              <View>
                <Avatar uri={w.profile.avatar} name={w.profile.username} size={52} />
                {/* Badge icons */}
                <View style={{ position: 'absolute', top: -2, right: -2, flexDirection: 'row', gap: 1 }}>
                  {w.hasText && (
                    <View style={{ backgroundColor: colors.card, borderRadius: 8, padding: 2 }}>
                      <Ionicons name="reorder-three-outline" size={10} color={colors.textSecondary} />
                    </View>
                  )}
                </View>
              </View>
              {w.rating > 0 && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2, marginTop: 4 }}>
                  <StarRating rating={w.rating} size={8} />
                  {w.likedMatch && <Ionicons name="heart" size={8} color="#ef4444" />}
                </View>
              )}
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

type ReviewFilter = 'everyone' | 'friends' | 'you';
type ReviewSort = 'recent' | 'popular' | 'highest' | 'lowest';


function ReviewsSection({ reviews, userId, profile, colors, spacing, typography, borderRadius, navigation }: any) {
  const [filter, setFilter] = useState<ReviewFilter>('everyone');
  const [sort, setSort] = useState<ReviewSort>('popular');

  const filteredReviews = useMemo(() => {
    // Only show reviews that have written text
    let filtered = [...reviews].filter((r: any) => r.text?.trim().length > 0);

    if (filter === 'friends' && profile?.following?.length) {
      filtered = filtered.filter((r: any) => profile.following.includes(r.userId));
    } else if (filter === 'you' && userId) {
      filtered = filtered.filter((r: any) => r.userId === userId);
    }

    if (sort === 'recent') {
      filtered.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    } else if (sort === 'popular') {
      filtered.sort((a: any, b: any) => ((b.upvotes || 0) - (b.downvotes || 0)) - ((a.upvotes || 0) - (a.downvotes || 0)));
    } else if (sort === 'highest') {
      filtered.sort((a: any, b: any) => b.rating - a.rating);
    } else if (sort === 'lowest') {
      filtered.sort((a: any, b: any) => a.rating - b.rating);
    }

    return filtered;
  }, [reviews, filter, sort, userId, profile?.following]);

  const filterTabs: { key: ReviewFilter; label: string }[] = [
    { key: 'everyone', label: 'Everyone' },
    { key: 'friends', label: 'Friends' },
    { key: 'you', label: 'You' },
  ];

  const sortOptions: { key: ReviewSort; label: string }[] = [
    { key: 'recent', label: 'Most Recent' },
    { key: 'popular', label: 'Most Popular' },
    { key: 'highest', label: 'Highest Rating' },
    { key: 'lowest', label: 'Lowest Rating' },
  ];

  return (
    <View style={{ marginTop: spacing.lg }}>
      {/* Header */}
      <Text style={{ ...typography.h4, color: colors.foreground, marginBottom: spacing.sm, paddingHorizontal: spacing.md }}>
        Reviews {filteredReviews.length > 0 ? `(${filteredReviews.length})` : ''}
      </Text>

      {/* Filter tabs + Sort dropdown row */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md, paddingHorizontal: spacing.md }}>
        <View style={{ flexDirection: 'row', gap: spacing.xs }}>
          {filterTabs.map((tab) => (
            <Pressable
              key={tab.key}
              onPress={() => setFilter(tab.key)}
              style={{
                paddingHorizontal: spacing.sm + 2,
                paddingVertical: spacing.xs,
                borderRadius: borderRadius.full,
                backgroundColor: filter === tab.key ? colors.primary : colors.muted,
              }}
            >
              <Text style={{ fontSize: 12, fontWeight: '500', color: filter === tab.key ? '#14181c' : colors.textSecondary }}>
                {tab.label}
              </Text>
            </Pressable>
          ))}
        </View>
        <View style={{ width: 140 }}>
          <Select
            value={sort}
            onValueChange={(v) => setSort(v as ReviewSort)}
            title="Sort Reviews"
            options={sortOptions.map((o) => ({ value: o.key, label: o.label }))}
          />
        </View>
      </View>

      {/* Review list */}
      {filteredReviews.length === 0 ? (
        <View style={{ alignItems: 'center', paddingVertical: spacing.xl }}>
          <Ionicons name="chatbubbles-outline" size={36} color={colors.textSecondary} />
          <Text style={{ ...typography.body, color: colors.textSecondary, marginTop: spacing.sm }}>
            {filter === 'everyone' ? 'No reviews yet. Be the first!' : filter === 'friends' ? 'No reviews from friends yet' : 'You haven\'t logged this match yet'}
          </Text>
        </View>
      ) : (
        filteredReviews.map((review: any, i: number) => (
          <ReviewCard
            key={review.id}
            review={review}
            onPress={() => navigation.navigate('ReviewDetail', { reviewId: review.id })}
            isLast={i === filteredReviews.length - 1}
          />
        ))
      )}
    </View>
  );
}

/** Short round/stage label for the info line, e.g. "MD38", "QF", "SF", "F" */
function roundLabel(match: { matchday: number | null; stage: string | null }): string | null {
  const STAGE_LABELS: Record<string, string> = {
    FINAL: 'F',
    SEMI_FINALS: 'SF',
    QUARTER_FINALS: 'QF',
    ROUND_OF_16: 'R16',
    LAST_16: 'R16',
    ROUND_OF_32: 'R32',
    LAST_32: 'R32',
    GROUP_STAGE: match.matchday ? `GS${match.matchday}` : 'GS',
    PRELIMINARY_ROUND: 'PR',
    QUALIFICATION: 'Q',
    PLAYOFF: 'PO',
    THIRD_PLACE: '3rd',
  };

  if (match.stage && STAGE_LABELS[match.stage]) return STAGE_LABELS[match.stage];
  if (match.matchday) return `MD${match.matchday}`;
  return null;
}

/* ─── Lineup Section — Formation Pitch Diagram ─── */

/** Parse "4-3-3" → [4, 3, 3] */
function parseFormation(formation: string): number[] {
  return formation.split('-').map(Number).filter((n) => !isNaN(n) && n > 0);
}

/** Build player events lookup: playerId → { goals, yellowCard, redCard, subbedOut minute } */
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
    if (g.detail === 'Own Goal') {
      getOrCreate(g.scorer.id).ownGoals++;
    } else {
      getOrCreate(g.scorer.id).goals++;
    }
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

/** Assign players to formation rows. Player 0 = GK, then fill rows from back to front. */
function assignPlayersToRows(players: MatchPlayer[], formation: number[]): MatchPlayer[][] {
  const rows: MatchPlayer[][] = [];
  // GK is always first player
  rows.push([players[0]]);
  let idx = 1;
  for (const count of formation) {
    rows.push(players.slice(idx, idx + count));
    idx += count;
  }
  return rows;
}

function PitchPlayerDot({
  player, x, y, teamColor, events, onPress, isMOTM,
}: {
  player: MatchPlayer;
  x: number; y: number;
  teamColor: string;
  events: { goals: number; ownGoals: number; yellowCard: boolean; redCard: boolean; subbedOutMin: number | null } | undefined;
  onPress: () => void;
  isMOTM?: boolean;
}) {
  const DOT_SIZE = 36;
  const TOUCH_WIDTH = 56;
  // Show last name only for pitch diagram
  const displayName = lastName(player.name);

  const hasEvents = events && (events.goals > 0 || events.ownGoals > 0 || events.yellowCard || events.redCard || events.subbedOutMin !== null);

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
      {/* Player circle + event badges */}
      <View style={{ width: DOT_SIZE, height: DOT_SIZE }}>
        <View style={{
          width: DOT_SIZE,
          height: DOT_SIZE,
          borderRadius: DOT_SIZE / 2,
          backgroundColor: isMOTM ? 'rgba(245,158,11,0.9)' : teamColor,
          alignItems: 'center',
          justifyContent: 'center',
          borderWidth: 2,
          borderColor: isMOTM ? '#f59e0b' : 'rgba(255,255,255,0.5)',
        }}>
          <Text style={{ fontSize: 13, fontWeight: '800', color: '#fff' }}>
            {player.shirtNumber ?? ''}
          </Text>
        </View>
        {/* Goal — top left, overlapping circle */}
        {events && events.goals > 0 && (
          <View style={{ position: 'absolute', top: -1, left: -1 }}>
            <Text style={{ fontSize: 11 }}>⚽</Text>
          </View>
        )}
        {/* Own goal — top left with red circle behind ball */}
        {events && events.ownGoals > 0 && (
          <View style={{ position: 'absolute', top: -2, left: -2, width: 16, height: 16, borderRadius: 8, backgroundColor: 'rgba(239, 68, 68, 0.45)', alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontSize: 11 }}>⚽</Text>
          </View>
        )}
        {/* Card — bottom left */}
        {events?.yellowCard && (
          <View style={{ position: 'absolute', bottom: -1, left: -1, width: 7, height: 10, backgroundColor: '#facc15', borderRadius: 1, borderWidth: 0.5, borderColor: 'rgba(0,0,0,0.3)' }} />
        )}
        {events?.redCard && (
          <View style={{ position: 'absolute', bottom: -1, left: -1, width: 7, height: 10, backgroundColor: '#ef4444', borderRadius: 1, borderWidth: 0.5, borderColor: 'rgba(0,0,0,0.3)' }} />
        )}
        {/* Sub — top right */}
        {events?.subbedOutMin !== null && events?.subbedOutMin !== undefined && (
          <View style={{ position: 'absolute', top: -5, right: -5, width: 15, height: 15, borderRadius: 8, backgroundColor: 'rgba(239,68,68,0.9)', alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontSize: 9, color: '#fff', fontWeight: '700' }}>↓</Text>
          </View>
        )}
        {/* MOTM star — bottom right */}
        {isMOTM && (
          <View style={{ position: 'absolute', bottom: -4, right: -4 }}>
            <Text style={{ fontSize: 12 }}>⭐</Text>
          </View>
        )}
      </View>
      {/* Player name */}
      <Text style={{ fontSize: 9, fontWeight: '700', color: '#fff', textAlign: 'center', marginTop: 2, textShadowColor: 'rgba(0,0,0,0.9)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 }} numberOfLines={1}>
        {displayName}
      </Text>
    </Pressable>
  );
}

function FormationPitch({
  matchDetail, match, navigation, pitchWidth, motmWinnerId,
}: {
  matchDetail: MatchDetail;
  match: any;
  navigation: any;
  pitchWidth: number;
  motmWinnerId?: number | null;
}) {
  const pitchHeight = pitchWidth * 1.7;
  const halfHeight = pitchHeight / 2;
  const padX = 24;
  // GK sits inside the penalty area; bottom needs extra room for name text below dot
  const topPad = pitchHeight * 0.07;    // home GK ~inside penalty box
  const bottomPad = pitchHeight * 0.08; // away GK ~inside penalty box (extra for name)
  const centerPad = 40;                 // push strikers away from center line

  const homeFormation = matchDetail.homeFormation ? parseFormation(matchDetail.homeFormation) : [];
  const awayFormation = matchDetail.awayFormation ? parseFormation(matchDetail.awayFormation) : [];

  const playerEvents = useMemo(() =>
    buildPlayerEvents(matchDetail.goals, matchDetail.bookings, matchDetail.substitutions),
    [matchDetail.goals, matchDetail.bookings, matchDetail.substitutions]
  );

  const homeRows = homeFormation.length > 0 ? assignPlayersToRows(matchDetail.homeLineup, homeFormation) : [];
  const awayRows = awayFormation.length > 0 ? assignPlayersToRows(matchDetail.awayLineup, awayFormation) : [];

  // Calculate x,y for a player in a row
  // Home: GK at y=topPad, forwards at y=halfHeight-centerPad
  // Away: GK at y=pitchHeight-bottomPad, forwards at y=halfHeight+centerPad
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
      const y = yStart + step * rowIndex;
      return { x, y };
    } else {
      const yStart = pitchHeight - bottomPad; // GK near bottom (accounts for name text)
      const yEnd = halfHeight + centerPad;     // forwards near center
      const step = totalRows > 1 ? (yStart - yEnd) / (totalRows - 1) : 0;
      const y = yStart - step * rowIndex;
      return { x, y };
    }
  };

  // Pitch markings
  const lineColor = 'rgba(255,255,255,0.25)';
  const penaltyBoxWidth = pitchWidth * 0.55;
  const penaltyBoxHeight = pitchHeight * 0.11;
  const goalBoxWidth = pitchWidth * 0.28;
  const goalBoxHeight = pitchHeight * 0.045;
  const circleSize = pitchWidth * 0.22;

  return (
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

      {/* Home team logo — top left */}
      <View style={{ position: 'absolute', top: 10, left: 12 }}>
        <TeamLogo uri={match.homeTeam.crest} size={24} />
      </View>
      {/* Away team logo — bottom right */}
      <View style={{ position: 'absolute', bottom: 10, right: 12 }}>
        <TeamLogo uri={match.awayTeam.crest} size={24} />
      </View>

      {/* Home players (top half) */}
      {homeRows.map((row, rowIdx) =>
        row.map((player, pIdx) => {
          const pos = getPlayerPos(rowIdx, pIdx, row.length, homeRows.length, true);
          return (
            <PitchPlayerDot
              key={`h-${player.id}`}
              player={player}
              x={pos.x}
              y={pos.y}
              teamColor="rgba(20,20,30,0.65)"
              events={playerEvents.get(player.id)}
              isMOTM={motmWinnerId === player.id}
              onPress={() => navigation.navigate('PersonDetail', { personId: player.id, personName: shortName(player.name), role: 'player' })}
            />
          );
        })
      )}

      {/* Away players (bottom half) */}
      {awayRows.map((row, rowIdx) =>
        row.map((player, pIdx) => {
          const pos = getPlayerPos(rowIdx, pIdx, row.length, awayRows.length, false);
          return (
            <PitchPlayerDot
              key={`a-${player.id}`}
              player={player}
              x={pos.x}
              y={pos.y}
              teamColor="rgba(255,255,255,0.2)"
              events={playerEvents.get(player.id)}
              isMOTM={motmWinnerId === player.id}
              onPress={() => navigation.navigate('PersonDetail', { personId: player.id, personName: shortName(player.name), role: 'player' })}
            />
          );
        })
      )}
    </View>
  );
}

function BenchPlayerRow({ player, substitution, colors, spacing, typography, onPress, isMOTM }: {
  player: MatchPlayer;
  substitution?: MatchSubstitution;
  colors: any; spacing: any; typography: any;
  onPress: () => void;
  isMOTM?: boolean;
}) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.xs + 2, gap: spacing.sm }}>
        {player.shirtNumber !== null && (
          <Text style={{ width: 24, textAlign: 'center', ...typography.caption, color: colors.textSecondary }}>
            {player.shirtNumber}
          </Text>
        )}
        {isMOTM && <Text style={{ fontSize: 13 }}>⭐</Text>}
        <Text style={{ ...typography.body, color: isMOTM ? '#f59e0b' : colors.foreground, fontSize: 14, flex: 1, fontWeight: isMOTM ? '700' : '400' }} numberOfLines={1}>
          {shortName(player.name)}
        </Text>
        {substitution && (
          <Text style={{ fontSize: 11, color: colors.textSecondary }}>
            ↔ {substitution.minute}'
          </Text>
        )}
        {player.position && !substitution && (
          <Text style={{ ...typography.small, color: colors.textSecondary }}>
            {player.position === 'Goalkeeper' ? 'GK' : player.position === 'Defender' ? 'DEF' : player.position === 'Midfielder' ? 'MID' : player.position === 'Forward' ? 'FWD' : player.position}
          </Text>
        )}
      </View>
    </Pressable>
  );
}

function LineupSection({ matchDetail, match, colors, spacing, typography, navigation, motmWinnerId }: { matchDetail: MatchDetail | null; match: any; colors: any; spacing: any; typography: any; navigation: any; motmWinnerId?: number | null }) {
  const { width: screenWidth } = useWindowDimensions();
  const pitchWidth = screenWidth - spacing.md * 2;

  if (!matchDetail) {
    return (
      <View style={{ alignItems: 'center', paddingVertical: spacing.xxl }}>
        <LoadingSpinner fullScreen={false} />
      </View>
    );
  }

  const hasLineup = matchDetail.homeLineup.length > 0 || matchDetail.awayLineup.length > 0;

  if (!hasLineup) {
    return (
      <View style={{ alignItems: 'center', paddingVertical: spacing.xxl, paddingHorizontal: spacing.xl }}>
        <Ionicons name="people-outline" size={40} color={colors.textSecondary} />
        <Text style={{ ...typography.bodyBold, color: colors.foreground, marginTop: spacing.md }}>
          Lineups not available
        </Text>
        <Text style={{ ...typography.body, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.xs }}>
          Lineups are usually available close to kickoff
        </Text>
      </View>
    );
  }

  // Build substitution lookup for bench players
  const subsByPlayerIn = new Map<number, MatchSubstitution>();
  for (const s of matchDetail.substitutions) {
    subsByPlayerIn.set(s.playerIn.id, s);
  }

  return (
    <View style={{ paddingHorizontal: spacing.md, paddingTop: spacing.sm }}>
      {/* Formation Pitch Diagram */}
      {matchDetail.homeFormation && matchDetail.awayFormation && (
        <FormationPitch
          matchDetail={matchDetail}
          match={match}
          navigation={navigation}
          pitchWidth={pitchWidth}
          motmWinnerId={motmWinnerId}
        />
      )}

      {/* Fallback: if no formation data but we have lineups, show as list */}
      {(!matchDetail.homeFormation || !matchDetail.awayFormation) && hasLineup && (
        <>
          {/* Home Starting XI */}
          <View style={{ marginBottom: spacing.md }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm }}>
              <TeamLogo uri={match.homeTeam.crest} size={18} />
              <Text style={{ ...typography.bodyBold, color: colors.foreground, fontSize: 14 }}>{match.homeTeam.shortName}</Text>
              <Text style={{ ...typography.caption, color: colors.textSecondary }}>Starting XI</Text>
            </View>
            {matchDetail.homeLineup.map((p) => (
              <BenchPlayerRow key={p.id} player={p} colors={colors} spacing={spacing} typography={typography} isMOTM={motmWinnerId === p.id} onPress={() => navigation.navigate('PersonDetail', { personId: p.id, personName: shortName(p.name), role: 'player' })} />
            ))}
          </View>
          <View style={{ height: 1, backgroundColor: colors.border, marginBottom: spacing.md }} />
          {/* Away Starting XI */}
          <View style={{ marginBottom: spacing.md }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm }}>
              <TeamLogo uri={match.awayTeam.crest} size={18} />
              <Text style={{ ...typography.bodyBold, color: colors.foreground, fontSize: 14 }}>{match.awayTeam.shortName}</Text>
              <Text style={{ ...typography.caption, color: colors.textSecondary }}>Starting XI</Text>
            </View>
            {matchDetail.awayLineup.map((p) => (
              <BenchPlayerRow key={p.id} player={p} colors={colors} spacing={spacing} typography={typography} isMOTM={motmWinnerId === p.id} onPress={() => navigation.navigate('PersonDetail', { personId: p.id, personName: shortName(p.name), role: 'player' })} />
            ))}
          </View>
        </>
      )}

      {/* Home Substitutes */}
      {matchDetail.homeBench.length > 0 && (
        <View style={{ marginTop: spacing.lg }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm }}>
            <TeamLogo uri={match.homeTeam.crest} size={18} />
            <Text style={{ ...typography.bodyBold, color: colors.foreground, fontSize: 14 }}>
              {match.homeTeam.shortName}
            </Text>
            <Text style={{ ...typography.caption, color: colors.textSecondary }}>Substitutes</Text>
          </View>
          {matchDetail.homeBench.map((p) => (
            <BenchPlayerRow
              key={p.id}
              player={p}
              substitution={subsByPlayerIn.get(p.id)}
              colors={colors}
              spacing={spacing}
              typography={typography}
              isMOTM={motmWinnerId === p.id}
              onPress={() => navigation.navigate('PersonDetail', { personId: p.id, personName: shortName(p.name), role: 'player' })}
            />
          ))}
          {matchDetail.homeCoach && (
            <Pressable onPress={() => navigation.navigate('PersonDetail', { personId: matchDetail.homeCoach!.id, personName: shortName(matchDetail.homeCoach!.name), role: 'manager' })} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
              <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.xs + 2, gap: spacing.sm, marginTop: spacing.xs }}>
                <Text style={{ width: 24, textAlign: 'center', ...typography.caption, color: colors.textSecondary }}>
                  <Ionicons name="person" size={12} color={colors.textSecondary} />
                </Text>
                <Text style={{ ...typography.body, color: colors.textSecondary, fontSize: 14, fontStyle: 'italic' }}>
                  {shortName(matchDetail.homeCoach.name)} (Coach)
                </Text>
              </View>
            </Pressable>
          )}
        </View>
      )}

      <View style={{ height: 1, backgroundColor: colors.border, marginVertical: spacing.md, marginHorizontal: -spacing.md }} />

      {/* Away Substitutes */}
      {matchDetail.awayBench.length > 0 && (
        <View style={{ marginBottom: spacing.md }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm }}>
            <TeamLogo uri={match.awayTeam.crest} size={18} />
            <Text style={{ ...typography.bodyBold, color: colors.foreground, fontSize: 14 }}>
              {match.awayTeam.shortName}
            </Text>
            <Text style={{ ...typography.caption, color: colors.textSecondary }}>Substitutes</Text>
          </View>
          {matchDetail.awayBench.map((p) => (
            <BenchPlayerRow
              key={p.id}
              player={p}
              substitution={subsByPlayerIn.get(p.id)}
              colors={colors}
              spacing={spacing}
              typography={typography}
              isMOTM={motmWinnerId === p.id}
              onPress={() => navigation.navigate('PersonDetail', { personId: p.id, personName: shortName(p.name), role: 'player' })}
            />
          ))}
          {matchDetail.awayCoach && (
            <Pressable onPress={() => navigation.navigate('PersonDetail', { personId: matchDetail.awayCoach!.id, personName: shortName(matchDetail.awayCoach!.name), role: 'manager' })} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
              <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.xs + 2, gap: spacing.sm, marginTop: spacing.xs }}>
                <Text style={{ width: 24, textAlign: 'center', ...typography.caption, color: colors.textSecondary }}>
                  <Ionicons name="person" size={12} color={colors.textSecondary} />
                </Text>
                <Text style={{ ...typography.body, color: colors.textSecondary, fontSize: 14, fontStyle: 'italic' }}>
                  {shortName(matchDetail.awayCoach.name)} (Coach)
                </Text>
              </View>
            </Pressable>
          )}
        </View>
      )}

      {/* Referee */}
      {matchDetail.referee && (() => {
        const parts = matchDetail.referee.split(',');
        const refCountry = parts.length > 1 ? parts.pop()!.trim() : null;
        const refName = parts.join(',').trim();
        const refFlag = nationalityFlag(refCountry);
        return (
          <>
            <View style={{ height: 1, backgroundColor: colors.border, marginVertical: spacing.md, marginHorizontal: -spacing.md }} />
            <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.xs + 2, gap: spacing.sm, marginBottom: spacing.md }}>
              <View style={{ width: 24, alignItems: 'center' }}>
                {refFlag ? <Text style={{ fontSize: 14 }}>{refFlag}</Text> : <Ionicons name="flag-outline" size={12} color={colors.textSecondary} />}
              </View>
              {motmWinnerId === REFEREE_MOTM_ID && <Text style={{ fontSize: 13 }}>⭐</Text>}
              <Text style={{ ...typography.body, color: motmWinnerId === REFEREE_MOTM_ID ? '#f59e0b' : colors.textSecondary, fontSize: 14, fontStyle: 'italic', flex: 1, fontWeight: motmWinnerId === REFEREE_MOTM_ID ? '700' : '400' }}>
                {refName} (Referee)
              </Text>
            </View>
          </>
        );
      })()}
    </View>
  );
}

/* ─── Info Section ─── */

function StatRow({ label, home, away, colors, spacing, typography, isPossession }: {
  label: string; home: number; away: number; colors: any; spacing: any; typography: any; isPossession?: boolean;
}) {
  const homeHigher = home > away;
  const awayHigher = away > home;

  if (isPossession) {
    const homePct = home || 50;
    const awayPct = away || 50;
    return (
      <View style={{ marginBottom: spacing.md }}>
        <Text style={{ ...typography.small, color: colors.textSecondary, textAlign: 'center', marginBottom: spacing.xs }}>
          Ball Possession
        </Text>
        <View style={{ flexDirection: 'row', gap: 2, alignItems: 'center' }}>
          <View style={{
            flex: homePct, backgroundColor: colors.primary, borderTopLeftRadius: 20, borderBottomLeftRadius: 20,
            paddingVertical: 8, paddingHorizontal: 12, alignItems: homePct > 15 ? 'flex-start' : 'center',
          }}>
            <Text style={{ fontSize: 13, fontWeight: '700', color: '#14181c' }}>{homePct}%</Text>
          </View>
          <View style={{
            flex: awayPct, backgroundColor: '#3b82f6', borderTopRightRadius: 20, borderBottomRightRadius: 20,
            paddingVertical: 8, paddingHorizontal: 12, alignItems: awayPct > 15 ? 'flex-end' : 'center',
          }}>
            <Text style={{ fontSize: 13, fontWeight: '700', color: '#fff' }}>{awayPct}%</Text>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing.sm, gap: spacing.sm }}>
      <View style={{
        minWidth: 36, alignItems: 'center',
        ...(homeHigher ? { backgroundColor: colors.primary, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 4 } : {}),
      }}>
        <Text style={{
          fontSize: 14, fontWeight: homeHigher ? '700' : '400',
          color: homeHigher ? '#14181c' : colors.foreground,
        }}>
          {home}
        </Text>
      </View>
      <Text style={{ ...typography.small, color: colors.textSecondary, flex: 1, textAlign: 'center' }}>
        {label}
      </Text>
      <View style={{
        minWidth: 36, alignItems: 'center',
        ...(awayHigher ? { backgroundColor: '#3b82f6', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 4 } : {}),
      }}>
        <Text style={{
          fontSize: 14, fontWeight: awayHigher ? '700' : '400',
          color: awayHigher ? '#fff' : colors.foreground,
        }}>
          {away}
        </Text>
      </View>
    </View>
  );
}

function InfoSection({ matchDetail, match, colors, spacing, typography, borderRadius, navigation }: { matchDetail: MatchDetail | null; match: any; colors: any; spacing: any; typography: any; borderRadius: any; navigation: any }) {
  if (!matchDetail) {
    return (
      <View style={{ alignItems: 'center', paddingVertical: spacing.xxl }}>
        <LoadingSpinner fullScreen={false} />
      </View>
    );
  }

  const { stats } = matchDetail;

  const infoRows: { label: string; value: string }[] = [
    { label: 'Competition', value: match.competition.name },
    { label: 'Matchday', value: match.matchday ? `${match.matchday}` : '—' },
    { label: 'Date', value: formatFullDate(match.kickoff) },
    { label: 'Kick-off', value: formatMatchTime(match.kickoff) },
    { label: 'Venue', value: match.venue || '—' },
    ...(matchDetail.attendance ? [{ label: 'Attendance', value: matchDetail.attendance.toLocaleString() }] : []),
  ];

  return (
    <View style={{ paddingHorizontal: spacing.md, paddingTop: spacing.sm }}>
      {/* Match Stats */}
      {stats ? (
        <View style={{ backgroundColor: colors.card, borderRadius: borderRadius.lg, padding: spacing.md, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.lg }}>
          <Text style={{ ...typography.bodyBold, color: colors.foreground, fontSize: 15, textAlign: 'center', marginBottom: spacing.md }}>
            Match Stats
          </Text>

          {/* Team headers */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm }}>
            <Pressable onPress={() => navigation.navigate('TeamDetail', { teamId: match.homeTeam.id, teamName: match.homeTeam.name, teamCrest: match.homeTeam.crest })} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, opacity: pressed ? 0.7 : 1 })}>
              <TeamLogo uri={match.homeTeam.crest} size={18} />
              <Text style={{ ...typography.caption, color: colors.textSecondary }}>{match.homeTeam.shortName}</Text>
            </Pressable>
            <Pressable onPress={() => navigation.navigate('TeamDetail', { teamId: match.awayTeam.id, teamName: match.awayTeam.name, teamCrest: match.awayTeam.crest })} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, opacity: pressed ? 0.7 : 1 })}>
              <Text style={{ ...typography.caption, color: colors.textSecondary }}>{match.awayTeam.shortName}</Text>
              <TeamLogo uri={match.awayTeam.crest} size={18} />
            </Pressable>
          </View>

          <StatRow label="Ball Possession" home={stats.ballPossession[0]} away={stats.ballPossession[1]} colors={colors} spacing={spacing} typography={typography} isPossession />
          <StatRow label="Total Shots" home={stats.shots[0]} away={stats.shots[1]} colors={colors} spacing={spacing} typography={typography} />
          <StatRow label="Shots on Target" home={stats.shotsOnTarget[0]} away={stats.shotsOnTarget[1]} colors={colors} spacing={spacing} typography={typography} />
          <StatRow label="Corners" home={stats.corners[0]} away={stats.corners[1]} colors={colors} spacing={spacing} typography={typography} />
          <StatRow label="Saves" home={stats.saves[0]} away={stats.saves[1]} colors={colors} spacing={spacing} typography={typography} />
          <StatRow label="Fouls" home={stats.fouls[0]} away={stats.fouls[1]} colors={colors} spacing={spacing} typography={typography} />
          <StatRow label="Offsides" home={stats.offsides[0]} away={stats.offsides[1]} colors={colors} spacing={spacing} typography={typography} />
          <StatRow label="Yellow Cards" home={stats.yellowCards[0]} away={stats.yellowCards[1]} colors={colors} spacing={spacing} typography={typography} />
          <StatRow label="Red Cards" home={stats.redCards[0]} away={stats.redCards[1]} colors={colors} spacing={spacing} typography={typography} />
        </View>
      ) : (
        <View style={{ alignItems: 'center', paddingVertical: spacing.lg, marginBottom: spacing.lg }}>
          <Ionicons name="stats-chart-outline" size={36} color={colors.textSecondary} />
          <Text style={{ ...typography.body, color: colors.textSecondary, marginTop: spacing.sm }}>
            Match stats not available yet
          </Text>
        </View>
      )}

      {/* Match Information */}
      <View style={{ backgroundColor: colors.card, borderRadius: borderRadius.lg, padding: spacing.md, borderWidth: 1, borderColor: colors.border }}>
        <Text style={{ ...typography.bodyBold, color: colors.foreground, fontSize: 15, textAlign: 'center', marginBottom: spacing.md }}>
          Match Information
        </Text>
        {infoRows.map((row) => {
          const isCompetition = row.label === 'Competition';
          const Container = isCompetition ? Pressable : View;
          const containerProps = isCompetition
            ? { onPress: () => navigation.navigate('LeagueDetail', { competitionCode: match.competition.code, competitionName: match.competition.name, competitionEmblem: match.competition.emblem }) }
            : {};
          return (
            <Container
              key={row.label}
              {...containerProps}
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                paddingVertical: spacing.sm,
                borderBottomWidth: 1,
                borderBottomColor: colors.border,
              }}
            >
              <Text style={{ ...typography.body, color: colors.textSecondary, fontSize: 14 }}>
                {row.label}
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, flex: 1, justifyContent: 'flex-end', marginLeft: spacing.md }}>
                <Text style={{ ...typography.body, color: isCompetition ? colors.primary : colors.foreground, fontSize: 14, fontWeight: '500', textAlign: 'right' }}>
                  {row.value}
                </Text>
                {isCompetition && <Ionicons name="chevron-forward" size={14} color={colors.primary} />}
              </View>
            </Container>
          );
        })}
      </View>
    </View>
  );
}
