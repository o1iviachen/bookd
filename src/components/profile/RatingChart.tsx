import React, { useState, useRef, useCallback, useMemo } from 'react';
import { View, Text, PanResponder, LayoutChangeEvent, Pressable, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../context/ThemeContext';
import { Review } from '../../types/review';

type RatingFilter = 'everyone' | 'neutral' | 'home' | 'away';

interface RatingChartProps {
  reviews: Review[];
  // Pre-aggregated bucket counts (key = rating × 10 as string, e.g. "35" for 3.5).
  // When provided, used instead of computing from reviews — O(1) read path.
  ratingBuckets?: Record<string, number>;
  // Fan-type-specific pre-aggregated buckets (same key format)
  ratingBucketsHome?: Record<string, number>;
  ratingBucketsAway?: Record<string, number>;
  ratingBucketsNeutral?: Record<string, number>;
  showStats?: boolean;
  homeTeamId?: number;
  awayTeamId?: number;
  homeTeamName?: string;
  awayTeamName?: string;
  // For bucket-based fan filter on team pages (label: "[teamName] Fans")
  teamName?: string;
  reviewerTeamMap?: Map<string, string[]>;
  season?: string;
  seasonOptions?: { value: string; label: string }[];
  onSeasonChange?: (season: string) => void;
  loading?: boolean;
  onTouchStart?: () => void;
  onTouchEnd?: () => void;
}

const BUCKETS = [0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5];
const BAR_HEIGHT = 40;

export function RatingChart({ reviews, ratingBuckets, ratingBucketsHome, ratingBucketsAway, ratingBucketsNeutral, showStats = false, homeTeamId, awayTeamId, homeTeamName, awayTeamName, teamName, reviewerTeamMap, season, seasonOptions, onSeasonChange, loading = false, onTouchStart, onTouchEnd }: RatingChartProps) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const { colors, spacing, borderRadius } = theme;
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [filter, setFilter] = useState<RatingFilter>('everyone');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [seasonDropdownOpen, setSeasonDropdownOpen] = useState(false);
  const barAreaWidth = useRef(0);
  const barAreaX = useRef(0);
  const onTouchStartRef = useRef(onTouchStart);
  onTouchStartRef.current = onTouchStart;
  const onTouchEndRef = useRef(onTouchEnd);
  onTouchEndRef.current = onTouchEnd;

  const hasTeamData = !!reviewerTeamMap && !!(homeTeamName || awayTeamName);
  const hasFanBuckets = !!(ratingBucketsHome || ratingBucketsAway || ratingBucketsNeutral);

  const filteredReviews = useMemo(() => {
    if (ratingBuckets) return []; // not used when buckets are pre-aggregated
    if (!hasTeamData || filter === 'everyone') return reviews;
    // reviewerTeamMap values are team NAMES (e.g. "Arsenal", "Manchester City")
    // homeTeamName / awayTeamName are full names from football-data.org (e.g. "Arsenal FC")
    // Use substring match so "Arsenal FC".includes("Arsenal") resolves correctly
    const homeNameLower = (homeTeamName || '').toLowerCase();
    const awayNameLower = (awayTeamName || '').toLowerCase();
    return reviews.filter((r) => {
      const teams = reviewerTeamMap!.get(r.userId) || [];
      const supportsHome = teams.some((n) => homeNameLower.includes(n.toLowerCase()));
      const supportsAway = teams.some((n) => awayNameLower.includes(n.toLowerCase()));
      switch (filter) {
        case 'neutral': return !supportsHome && !supportsAway;
        case 'home': return supportsHome;
        case 'away': return supportsAway;
        default: return true;
      }
    });
  }, [reviews, ratingBuckets, filter, reviewerTeamMap, homeTeamName, awayTeamName, hasTeamData]);

  // Select the appropriate bucket set based on filter and available data
  const activeBuckets = useMemo(() => {
    if (!ratingBuckets) return null; // no buckets — use reviews path
    if (!hasFanBuckets || filter === 'everyone') return ratingBuckets;
    switch (filter) {
      case 'home': return ratingBucketsHome || {};
      case 'away': return ratingBucketsAway || {};
      case 'neutral': return ratingBucketsNeutral || {};
      default: return ratingBuckets;
    }
  }, [ratingBuckets, hasFanBuckets, filter, ratingBucketsHome, ratingBucketsAway, ratingBucketsNeutral]);

  // When ratingBuckets provided (O(1) pre-aggregated path), read directly from them.
  // Otherwise compute from individual review ratings.
  const counts = activeBuckets
    ? BUCKETS.map((b) => activeBuckets[String(Math.round(b * 10))] || 0)
    : BUCKETS.map((b) => filteredReviews.filter((r) => r.rating === b).length);
  const maxCount = Math.max(...counts, 1);
  const totalRated = counts.reduce((sum, c) => sum + c, 0);

  const avgRating = useMemo(() => {
    if (totalRated === 0) return 0;
    const sum = BUCKETS.reduce((acc, b, i) => acc + b * counts[i], 0);
    return sum / totalRated;
  }, [counts, totalRated]);

  const getIndexFromX = useCallback((pageX: number) => {
    const relX = pageX - barAreaX.current;
    if (relX < 0 || relX > barAreaWidth.current) return null;
    const idx = Math.floor((relX / barAreaWidth.current) * BUCKETS.length);
    return Math.min(Math.max(idx, 0), BUCKETS.length - 1);
  }, []);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        onTouchStartRef.current?.();
        const idx = getIndexFromX(evt.nativeEvent.pageX);
        setActiveIndex(idx);
      },
      onPanResponderMove: (evt) => {
        const idx = getIndexFromX(evt.nativeEvent.pageX);
        setActiveIndex(idx);
      },
      onPanResponderRelease: () => {
        onTouchEndRef.current?.();
        setActiveIndex(null);
      },
      onPanResponderTerminate: () => {
        onTouchEndRef.current?.();
        setActiveIndex(null);
      },
    })
  ).current;

  const onBarAreaLayout = useCallback((e: LayoutChangeEvent) => {
    barAreaWidth.current = e.nativeEvent.layout.width;
    e.target.measureInWindow((x: number) => {
      barAreaX.current = x;
    });
  }, []);

  // Determine what to show on the right side
  const showSelected = activeIndex !== null && counts[activeIndex] > 0;
  const selectedBucket = activeIndex !== null ? BUCKETS[activeIndex] : 0;
  const selectedFullStars = Math.floor(selectedBucket);
  const selectedHalfStar = selectedBucket % 1 !== 0;
  const selectedEmptyStars = 5 - selectedFullStars - (selectedHalfStar ? 1 : 0);

  // For default state (nothing selected): show 5 filled stars

  const filterOptions: { key: RatingFilter; label: string }[] = useMemo(() => {
    if (hasFanBuckets && teamName) {
      // Bucket-based fan filter (team/person pages)
      return [
        { key: 'everyone' as RatingFilter, label: t('profile.fanEveryone') },
        { key: 'home' as RatingFilter, label: t('profile.fanTeam', { teamName }) },
        { key: 'away' as RatingFilter, label: t('profile.fanOpposition') },
        { key: 'neutral' as RatingFilter, label: t('profile.fanNeutral') },
      ];
    }
    // Review-based fan filter (match detail pages)
    return [
      { key: 'everyone' as RatingFilter, label: t('profile.fanEveryone') },
      { key: 'neutral' as RatingFilter, label: awayTeamName ? t('profile.fanNeutral') : t('profile.fanOther') },
      { key: 'home' as RatingFilter, label: t('profile.fanTeam', { teamName: homeTeamName || '' }) },
      ...(awayTeamName ? [{ key: 'away' as RatingFilter, label: t('profile.fanAway') }] : []),
    ];
  }, [hasFanBuckets, teamName, homeTeamName, awayTeamName, t]);

  const activeFilterLabel = filterOptions.find((f) => f.key === filter)?.label || t('profile.fanEveryone');

  const hasSeasonPicker = !!(seasonOptions && seasonOptions.length > 0 && onSeasonChange);
  const activeSeasonLabel = seasonOptions?.find((o) => o.value === season)?.label ?? season ?? t('profile.allSeasons');

  return (
    <View style={{ paddingHorizontal: spacing.md, paddingTop: spacing.sm, paddingBottom: spacing.md, backgroundColor: `${colors.accent}30`, borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.border }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md }}>
        <Text style={{ fontSize: 11, fontWeight: '600', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 1 }}>
          {t('profile.ratingsLabel')}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
          {hasSeasonPicker && (
            <Pressable
              onPress={() => { setSeasonDropdownOpen(!seasonDropdownOpen); setDropdownOpen(false); }}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 4,
                backgroundColor: colors.muted,
                paddingHorizontal: 8,
                paddingVertical: 3,
                borderRadius: borderRadius.full,
              }}
            >
              <Text style={{ fontSize: 11, fontWeight: '500', color: colors.foreground }}>{activeSeasonLabel}</Text>
              <Ionicons name={seasonDropdownOpen ? 'chevron-up' : 'chevron-down'} size={12} color={colors.textSecondary} />
            </Pressable>
          )}
          {(hasTeamData || hasFanBuckets) && (
            <Pressable
              onPress={() => { setDropdownOpen(!dropdownOpen); setSeasonDropdownOpen(false); }}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 4,
                backgroundColor: colors.muted,
                paddingHorizontal: 8,
                paddingVertical: 3,
                borderRadius: borderRadius.full,
              }}
            >
              <Text style={{ fontSize: 11, fontWeight: '500', color: colors.foreground }}>{activeFilterLabel}</Text>
              <Ionicons name={dropdownOpen ? 'chevron-up' : 'chevron-down'} size={12} color={colors.textSecondary} />
            </Pressable>
          )}
        </View>
      </View>

      {/* Season dropdown */}
      {seasonDropdownOpen && hasSeasonPicker && (
        <View style={{ marginBottom: spacing.sm, backgroundColor: colors.card, borderRadius: borderRadius.md, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' }}>
          {seasonOptions!.map((opt, i) => (
            <Pressable
              key={opt.value}
              onPress={() => { onSeasonChange!(opt.value); setSeasonDropdownOpen(false); }}
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingHorizontal: 12,
                paddingVertical: 8,
                backgroundColor: pressed ? colors.accent : 'transparent',
                borderTopWidth: i > 0 ? 1 : 0,
                borderTopColor: colors.border,
              })}
            >
              <Text style={{ fontSize: 13, color: season === opt.value ? colors.primary : colors.foreground, fontWeight: season === opt.value ? '600' : '400' }}>
                {opt.label}
              </Text>
              {season === opt.value && <Ionicons name="checkmark" size={16} color={colors.primary} />}
            </Pressable>
          ))}
        </View>
      )}

      {/* Filter dropdown */}
      {dropdownOpen && (hasTeamData || hasFanBuckets) && (
        <View style={{ marginBottom: spacing.sm, backgroundColor: colors.card, borderRadius: borderRadius.md, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' }}>
          {filterOptions.map((opt, i) => (
            <Pressable
              key={opt.key}
              onPress={() => { setFilter(opt.key); setDropdownOpen(false); }}
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingHorizontal: 12,
                paddingVertical: 8,
                backgroundColor: pressed ? colors.accent : 'transparent',
                borderTopWidth: i > 0 ? 1 : 0,
                borderTopColor: colors.border,
              })}
            >
              <Text style={{ fontSize: 13, color: filter === opt.key ? colors.primary : colors.foreground, fontWeight: filter === opt.key ? '600' : '400' }}>
                {opt.label}
              </Text>
              {filter === opt.key && <Ionicons name="checkmark" size={16} color={colors.primary} />}
            </Pressable>
          ))}
        </View>
      )}

      {loading ? (
        <View style={{ height: BAR_HEIGHT + 8, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="small" color={colors.textSecondary} />
        </View>
      ) : (
        <View style={{ flexDirection: 'row', alignItems: 'flex-end' }}>
          {/* 1 star label on left */}
          <View style={{ justifyContent: 'flex-end', marginRight: 6, paddingBottom: 1 }}>
            <Ionicons name="star" size={10} color={colors.star} />
          </View>

          {/* Vertical bars — pan responder for swipe */}
          <View
            style={{ flex: 1, flexDirection: 'row', alignItems: 'flex-end', gap: 3 }}
            onLayout={onBarAreaLayout}
            {...panResponder.panHandlers}
          >
            {BUCKETS.map((bucket, i) => {
              const count = counts[i];
              const heightPct = count > 0 ? (count / maxCount) * BAR_HEIGHT : 0;
              const isActive = activeIndex === i;

              return (
                <View
                  key={bucket}
                  style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-end', height: BAR_HEIGHT }}
                >
                  <View
                    style={{
                      width: '100%',
                      height: Math.max(heightPct, count > 0 ? 3 : 1),
                      backgroundColor: isActive ? colors.star : colors.muted,
                      borderRadius: 2,
                    }}
                  />
                </View>
              );
            })}
          </View>

          {/* Right side */}
          <View style={{ justifyContent: 'flex-end', marginLeft: 6, paddingBottom: 1, alignItems: 'flex-end' }}>
            {showSelected ? (
              <>
                <Text style={{ fontSize: 10, color: colors.textSecondary, textAlign: 'right', marginBottom: 2 }}>
                  {t('common.ratingCount', { count: counts[activeIndex!] })}
                </Text>
                <View style={{ flexDirection: 'row' }}>
                  {Array.from({ length: selectedFullStars }).map((_, s) => (
                    <Ionicons key={`f${s}`} name="star" size={10} color={colors.star} />
                  ))}
                  {selectedHalfStar && (
                    <Ionicons name="star-half" size={10} color={colors.star} />
                  )}
                  {Array.from({ length: selectedEmptyStars }).map((_, s) => (
                    <Ionicons key={`e${s}`} name="star-outline" size={10} color={colors.star} />
                  ))}
                </View>
              </>
            ) : (
              <>
                {showStats && totalRated > 0 && (
                  <Text style={{ fontSize: 14, fontWeight: '700', color: colors.foreground, lineHeight: 16, textAlign: 'right', marginBottom: 1 }}>
                    {avgRating.toFixed(1)}
                  </Text>
                )}
                {totalRated > 0 && (
                  <Text style={{ fontSize: 10, color: colors.textSecondary, textAlign: 'right', marginBottom: 2 }}>
                    {t('common.ratingCount', { count: totalRated })}
                  </Text>
                )}
                <View style={{ flexDirection: 'row' }}>
                  {Array.from({ length: 5 }).map((_, s) => (
                    <Ionicons key={`f${s}`} name="star" size={10} color={colors.star} />
                  ))}
                </View>
              </>
            )}
          </View>
        </View>
      )}
    </View>
  );
}
