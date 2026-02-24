import React, { useState, useRef, useCallback, useMemo } from 'react';
import { View, Text, PanResponder, LayoutChangeEvent } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { Review } from '../../types/review';

interface RatingChartProps {
  reviews: Review[];
  showStats?: boolean;
}

const BUCKETS = [0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5];
const BAR_HEIGHT = 40;

export function RatingChart({ reviews, showStats = false }: RatingChartProps) {
  const { theme } = useTheme();
  const { colors, spacing } = theme;
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const barAreaWidth = useRef(0);
  const barAreaX = useRef(0);

  const counts = BUCKETS.map((b) => reviews.filter((r) => r.rating === b).length);
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
        const idx = getIndexFromX(evt.nativeEvent.pageX);
        setActiveIndex(idx);
      },
      onPanResponderMove: (evt) => {
        const idx = getIndexFromX(evt.nativeEvent.pageX);
        setActiveIndex(idx);
      },
      onPanResponderRelease: () => {
        setActiveIndex(null);
      },
      onPanResponderTerminate: () => {
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

  // For default state: show average as stars
  const avgFullStars = Math.floor(avgRating);
  const avgHalfStar = avgRating % 1 >= 0.25 && avgRating % 1 < 0.75;
  const avgRoundedUp = avgRating % 1 >= 0.75;
  const defaultFullStars = avgRoundedUp ? avgFullStars + 1 : avgFullStars;
  const defaultHalf = avgHalfStar;
  const defaultEmptyStars = 5 - defaultFullStars - (defaultHalf ? 1 : 0);

  return (
    <View style={{ paddingHorizontal: spacing.md, paddingVertical: spacing.md, backgroundColor: `${colors.accent}30`, borderBottomWidth: 1, borderColor: colors.border }}>
      <Text style={{ fontSize: 11, fontWeight: '600', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 1, marginBottom: spacing.sm }}>
        Ratings
      </Text>

      <View style={{ flexDirection: 'row', alignItems: 'flex-end' }}>
        {/* 1 star label on left */}
        <View style={{ justifyContent: 'flex-end', marginRight: 6, paddingBottom: 1 }}>
          <Ionicons name="star" size={10} color={colors.primary} />
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
                    backgroundColor: isActive ? colors.primary : colors.muted,
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
                {counts[activeIndex!]} {counts[activeIndex!] === 1 ? 'rating' : 'ratings'}
              </Text>
              <View style={{ flexDirection: 'row' }}>
                {Array.from({ length: selectedFullStars }).map((_, s) => (
                  <Ionicons key={`f${s}`} name="star" size={10} color={colors.primary} />
                ))}
                {selectedHalfStar && (
                  <Ionicons name="star-half" size={10} color={colors.primary} />
                )}
                {Array.from({ length: selectedEmptyStars }).map((_, s) => (
                  <Ionicons key={`e${s}`} name="star-outline" size={10} color={colors.primary} />
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
                  {totalRated} {totalRated === 1 ? 'rating' : 'ratings'}
                </Text>
              )}
              <View style={{ flexDirection: 'row' }}>
                {Array.from({ length: defaultFullStars }).map((_, s) => (
                  <Ionicons key={`f${s}`} name="star" size={10} color={colors.primary} />
                ))}
                {defaultHalf && (
                  <Ionicons name="star-half" size={10} color={colors.primary} />
                )}
                {Array.from({ length: Math.max(0, defaultEmptyStars) }).map((_, s) => (
                  <Ionicons key={`e${s}`} name="star-outline" size={10} color={colors.primary} />
                ))}
              </View>
            </>
          )}
        </View>
      </View>
    </View>
  );
}
