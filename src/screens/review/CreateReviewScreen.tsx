import React, { useState, useEffect, useRef, useMemo } from 'react';
import { View, Text, ScrollView, Pressable, KeyboardAvoidingView, Platform, Alert, Switch, Modal, Dimensions, PanResponder, Animated as RNAnimated, LayoutAnimation, UIManager } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { useMatch, useMatchDetail } from '../../hooks/useMatches';
import { useCreateReview, useUpdateReview, useReview, useUserMotmVote } from '../../hooks/useReviews';
import { MOTMPickerModal } from '../../components/review/MOTMPickerModal';
import { useUserProfile, useAddCustomTag, useMarkWatched, useToggleWatched, useToggleLiked } from '../../hooks/useUser';
import { uploadReviewMedia } from '../../services/storage';
import { TeamLogo } from '../../components/match/TeamLogo';
import { StarRating } from '../../components/ui/StarRating';
import { Button } from '../../components/ui/Button';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { ReviewMedia } from '../../types/review';
import { TextInput as RNTextInput } from 'react-native';
import { isTextClean } from '../../utils/moderation';
import { MentionInput } from '../../components/ui/MentionInput';
import { shortName } from '../../utils/formatName';
import { nationalityFlag } from '../../utils/flagEmoji';

interface LocalMedia {
  uri: string;
  type: 'image';
}

const screenWidth = Dimensions.get('window').width;
const REFEREE_MOTM_ID = -1;

export function CreateReviewScreen({ route, navigation }: any) {
  const { theme, isDark } = useTheme();
  const { colors, spacing, typography, borderRadius } = theme;
  const { user } = useAuth();
  const { matchId, reviewId } = route.params;
  const isEditMode = !!reviewId;
  const { data: match, isLoading } = useMatch(matchId);
  const { data: matchDetail } = useMatchDetail(matchId);
  const { data: existingReview, isLoading: reviewLoading } = useReview(reviewId || '');
  const createReview = useCreateReview();
  const updateReviewMutation = useUpdateReview();
  const { data: profile } = useUserProfile(user?.uid || '');
  const addCustomTag = useAddCustomTag();
  const markWatched = useMarkWatched();
  const toggleWatched = useToggleWatched();
  const toggleLiked = useToggleLiked();

  const { data: existingMotmVote } = useUserMotmVote(matchId, user?.uid);
  const isLiked = profile?.likedMatchIds?.some((id) => String(id) === String(matchId)) || false;

  const [rating, setRating] = useState(0);
  const [text, setText] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [newTagInput, setNewTagInput] = useState('');
  const [showTagInput, setShowTagInput] = useState(false);
  const [mediaItems, setMediaItems] = useState<LocalMedia[]>([]);
  const [existingMedia, setExistingMedia] = useState<ReviewMedia[]>([]);
  const [isSpoiler, setIsSpoiler] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [initialized, setInitialized] = useState(!isEditMode);
  const [previewImageUri, setPreviewImageUri] = useState<string | null>(null);
  const [motmPlayerId, setMotmPlayerId] = useState<number | null>(null);
  const [showMotmModal, setShowMotmModal] = useState(false);

  const isWatched = profile?.watchedMatchIds?.some((id) => String(id) === String(matchId)) || rating > 0 || text.trim().length > 0;

  // Reset form when navigating to a new (non-edit) entry
  useEffect(() => {
    if (!isEditMode) {
      setRating(0);
      setText('');
      setSelectedTags([]);
      setMediaItems([]);
      setExistingMedia([]);
      setIsSpoiler(false);
    }
  }, [matchId, isEditMode]);

  // Pre-populate fields when editing
  useEffect(() => {
    if (isEditMode && existingReview && !initialized) {
      setRating(existingReview.rating);
      setText(existingReview.text);
      setSelectedTags(existingReview.tags);
      setExistingMedia(existingReview.media || []);
      setIsSpoiler(existingReview.isSpoiler || false);
      setMotmPlayerId(existingMotmVote ?? existingReview.motmPlayerId ?? null);
      setInitialized(true);
    }
  }, [isEditMode, existingReview, initialized, existingMotmVote]);

  // Pre-populate MOTM from user's existing vote (new review mode)
  useEffect(() => {
    if (!isEditMode && existingMotmVote !== undefined && existingMotmVote !== null && motmPlayerId === null) {
      setMotmPlayerId(existingMotmVote);
    }
  }, [isEditMode, existingMotmVote]);

  const userTags = profile?.customTags || [];

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const handleAddTag = () => {
    const tag = newTagInput.trim();
    if (!tag) return;
    if (userTags.includes(tag)) {
      if (!selectedTags.includes(tag)) {
        setSelectedTags((prev) => [...prev, tag]);
      }
    } else if (user) {
      addCustomTag.mutate({ userId: user.uid, tag });
      setSelectedTags((prev) => [...prev, tag]);
    }
    setNewTagInput('');
    setShowTagInput(false);
  };

  const handleTapExistingMedia = (item: ReviewMedia, index: number) => {
    setPreviewImageUri(item.url);
  };

  const handleTapNewMedia = (item: LocalMedia, index: number) => {
    setPreviewImageUri(item.uri);
  };

  const handlePickMedia = async () => {
    const totalMedia = mediaItems.length + existingMedia.length;
    if (totalMedia >= 4) {
      Alert.alert('Limit Reached', 'You can attach up to 4 photos.');
      return;
    }

    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Please allow access to your photo library in Settings.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.8,
      });
      if (!result.canceled && result.assets.length > 0) {
        const asset = result.assets[0];
        setMediaItems((prev) => [...prev, { uri: asset.uri, type: 'image' as const }].slice(0, 4 - existingMedia.length));
      }
    } catch (err: any) {
      console.error('Pick media error:', err);
      Alert.alert('Error', 'Failed to pick photo. Please try again.');
    }
  };

  const removeMedia = (index: number) => {
    setMediaItems((prev) => prev.filter((_, i) => i !== index));
  };

  const removeExistingMedia = (index: number) => {
    setExistingMedia((prev) => prev.filter((_, i) => i !== index));
  };

  const allMediaItems = useMemo(() => {
    const items: { key: string; source: 'existing' | 'new'; index: number }[] = [];
    existingMedia.forEach((_, i) => items.push({ key: `existing-${i}`, source: 'existing', index: i }));
    mediaItems.forEach((_, i) => items.push({ key: `new-${i}`, source: 'new', index: i }));
    return items;
  }, [existingMedia, mediaItems]);

  // Drag-to-reorder state
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const dragIdxRef = useRef<number | null>(null);
  const isDragActive = useRef(false);
  const touchedItemIdx = useRef(-1);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dragAnim = useRef(new RNAnimated.ValueXY()).current;
  const itemRects = useRef<{ x: number; y: number; w: number; h: number }[]>([]);
  const mediaContainerRef = useRef<View>(null);
  const mediaContainerPos = useRef({ x: 0, y: 0 });

  // Refs so PanResponder closures always have fresh data
  const existingMediaRef = useRef(existingMedia);
  existingMediaRef.current = existingMedia;
  const mediaItemsRef = useRef(mediaItems);
  mediaItemsRef.current = mediaItems;

  const handleMediaTapByIndex = (globalIdx: number) => {
    const existing = existingMediaRef.current;
    const items = mediaItemsRef.current;
    const allItems = [
      ...existing.map((_, i) => ({ source: 'existing' as const, index: i })),
      ...items.map((_, i) => ({ source: 'new' as const, index: i })),
    ];
    if (globalIdx < 0 || globalIdx >= allItems.length) return;
    const meta = allItems[globalIdx];
    if (meta.source === 'existing') {
      handleTapExistingMedia(existing[meta.index], meta.index);
    } else {
      handleTapNewMedia(items[meta.index], meta.index);
    }
  };
  const handleMediaTapRef = useRef(handleMediaTapByIndex);
  handleMediaTapRef.current = handleMediaTapByIndex;

  const doSwap = (from: number, to: number) => {
    const combined = [
      ...existingMediaRef.current.map((m) => ({ t: 'e' as const, d: m })),
      ...mediaItemsRef.current.map((m) => ({ t: 'n' as const, d: m })),
    ];
    [combined[from], combined[to]] = [combined[to], combined[from]];
    LayoutAnimation.configureNext({
      duration: 200,
      update: { type: LayoutAnimation.Types.easeInEaseOut },
    });
    setExistingMedia(combined.filter((c) => c.t === 'e').map((c) => c.d as ReviewMedia));
    setMediaItems(combined.filter((c) => c.t === 'n').map((c) => c.d as LocalMedia));
    dragIdxRef.current = to;
    setDragIdx(to);
    dragAnim.setValue({ x: 0, y: 0 });
  };
  const doSwapRef = useRef(doSwap);
  doSwapRef.current = doSwap;

  const findItemAt = (lx: number, ly: number): number => {
    for (let i = 0; i < itemRects.current.length; i++) {
      const r = itemRects.current[i];
      if (lx >= r.x && lx <= r.x + r.w && ly >= r.y && ly <= r.y + r.h) return i;
    }
    return -1;
  };

  const mediaDragPanResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => isDragActive.current,
    onPanResponderTerminationRequest: () => !isDragActive.current,
    onPanResponderGrant: (evt) => {
      isDragActive.current = false;
      const lx = evt.nativeEvent.pageX - mediaContainerPos.current.x;
      const ly = evt.nativeEvent.pageY - mediaContainerPos.current.y;
      const idx = findItemAt(lx, ly);
      touchedItemIdx.current = idx;
      if (idx >= 0 && itemRects.current.length > 1) {
        longPressTimer.current = setTimeout(() => {
          isDragActive.current = true;
          dragIdxRef.current = idx;
          setDragIdx(idx);
          dragAnim.setValue({ x: 0, y: 0 });
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        }, 200);
      }
    },
    onPanResponderMove: (_, g) => {
      if (!isDragActive.current) {
        if (Math.abs(g.dx) > 5 || Math.abs(g.dy) > 5) {
          if (longPressTimer.current) clearTimeout(longPressTimer.current);
          touchedItemIdx.current = -1;
        }
        return;
      }
      dragAnim.x.setValue(g.dx);
      dragAnim.y.setValue(g.dy);
      const idx = dragIdxRef.current;
      if (idx === null) return;
      const from = itemRects.current[idx];
      if (!from) return;
      const cx = from.x + from.w / 2 + g.dx;
      for (let i = 0; i < itemRects.current.length; i++) {
        if (i === idx) continue;
        const r = itemRects.current[i];
        const targetCx = r.x + r.w / 2;
        if (Math.abs(cx - targetCx) < r.w * 0.4) {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          doSwapRef.current(idx, i);
          break;
        }
      }
    },
    onPanResponderRelease: () => {
      if (longPressTimer.current) clearTimeout(longPressTimer.current);
      if (isDragActive.current) {
        isDragActive.current = false;
        dragIdxRef.current = null;
        setDragIdx(null);
        dragAnim.setValue({ x: 0, y: 0 });
      } else if (touchedItemIdx.current >= 0) {
        handleMediaTapRef.current(touchedItemIdx.current);
      }
      touchedItemIdx.current = -1;
    },
  }), []);

  const hasReviewText = text.trim().length > 0;

  // MOTM: derive played players (starters + subs who came on)
  const motmData = useMemo(() => {
    if (!matchDetail || !match || match.status !== 'FINISHED') return null;
    if (matchDetail.homeLineup.length === 0 && matchDetail.awayLineup.length === 0) return null;

    const subInIds = new Set(matchDetail.substitutions.map((s) => s.playerIn.id));

    const homePlayed = [
      ...matchDetail.homeLineup,
      ...matchDetail.homeBench.filter((p) => subInIds.has(p.id)),
    ];
    const awayPlayed = [
      ...matchDetail.awayLineup,
      ...matchDetail.awayBench.filter((p) => subInIds.has(p.id)),
    ];

    const allPlayed = [...homePlayed, ...awayPlayed];
    let selectedName: string | null = null;
    if (motmPlayerId === REFEREE_MOTM_ID) {
      const refParts = matchDetail.referee ? matchDetail.referee.split(',').map((s: string) => s.trim()) : [];
      const refName = refParts[0] || null;
      const refCountry = refParts[1] || null;
      const flag = nationalityFlag(refCountry);
      selectedName = refName ? `${refName} ${flag} (Referee)`.trim() : 'Referee';
    } else if (motmPlayerId !== null) {
      const p = allPlayed.find((pl) => pl.id === motmPlayerId);
      selectedName = p ? shortName(p.name) : null;
    }

    return { homePlayed, awayPlayed, selectedName };
  }, [matchDetail, match, motmPlayerId]);

  const handleSubmit = async () => {
    if (!user) return;

    if (!isTextClean(text)) {
      Alert.alert('Content Warning', 'Your review contains inappropriate language. Please revise before posting.');
      return;
    }

    setUploading(true);
    try {
      // Upload new media files to Firebase Storage
      const uploadedMedia: ReviewMedia[] = [];
      const tempReviewId = reviewId || `${Date.now()}`;
      for (let i = 0; i < mediaItems.length; i++) {
        const item = mediaItems[i];
        const url = await uploadReviewMedia(user.uid, tempReviewId, item.uri, item.type, i);
        uploadedMedia.push({ url, type: item.type });
      }

      const allMedia = [...existingMedia, ...uploadedMedia];

      if (isEditMode && reviewId) {
        await updateReviewMutation.mutateAsync({
          reviewId,
          data: {
            rating,
            text,
            tags: selectedTags,
            media: allMedia,
            isSpoiler,
            motmPlayerId: motmPlayerId ?? null,
            motmPlayerName: motmData?.selectedName ?? null,
          },
          matchId,
          userId: user.uid,
          oldRating: existingReview?.rating,
        });
      } else {
        // Auto-mark as watched when submitting a review/log
        markWatched.mutate({ userId: user.uid, matchId });

        await createReview.mutateAsync({
          matchId,
          userId: user.uid,
          username: profile?.username || user.email?.split('@')[0] || 'Anonymous',
          userAvatar: profile?.avatar || null,
          rating,
          text,
          tags: selectedTags,
          media: allMedia,
          isSpoiler,
          ...(motmPlayerId !== null && { motmPlayerId, motmPlayerName: motmData?.selectedName }),
        });
      }

      navigation.goBack();
    } catch (err) {
      console.error('Review submission error:', err);
      Alert.alert('Error', `Failed to ${isEditMode ? 'update' : 'submit'} review. Please try again.`);
    } finally {
      setUploading(false);
    }
  };

  if (isLoading || !match || (isEditMode && reviewLoading)) return <LoadingSpinner />;

  const totalMediaCount = mediaItems.length + existingMedia.length;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', padding: spacing.md }}>
          <Pressable onPress={() => navigation.goBack()}>
            <Ionicons name="close" size={24} color={colors.foreground} />
          </Pressable>
          <Text style={{ ...typography.h4, color: colors.foreground, flex: 1, textAlign: 'center' }}>
            {isEditMode ? 'Edit Review' : hasReviewText ? 'Write Review' : 'Log Match'}
          </Text>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView indicatorStyle={isDark ? 'white' : 'default'} contentContainerStyle={{ padding: spacing.md, paddingBottom: spacing.md }}>
          {/* Match info */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, marginBottom: spacing.lg }}>
            <TeamLogo uri={match.homeTeam.crest} size={28} />
            <Text style={{ ...typography.bodyBold, color: colors.foreground }}>
              {match.homeTeam.shortName} {match.homeScore} - {match.awayScore} {match.awayTeam.shortName}
            </Text>
            <TeamLogo uri={match.awayTeam.crest} size={28} />
          </View>

          {/* Star rating with heart + eye */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.md, marginBottom: spacing.lg }}>
            <StarRating rating={rating} size={36} interactive onRate={setRating} />
            <Pressable
              onPress={() => user && toggleLiked.mutate({ userId: user.uid, matchId })}
              hitSlop={8}
            >
              <Ionicons
                name={isLiked ? 'heart' : 'heart-outline'}
                size={26}
                color={isLiked ? '#ef4444' : colors.textSecondary}
              />
            </Pressable>
            <Pressable
              onPress={() => user && toggleWatched.mutate({ userId: user.uid, matchId })}
              hitSlop={8}
            >
              <Ionicons
                name={isWatched ? 'eye' : 'eye-outline'}
                size={26}
                color={isWatched ? colors.primary : colors.textSecondary}
              />
            </Pressable>
          </View>

          {/* Review text (optional) */}
          <Text style={{ ...typography.bodyBold, color: colors.foreground, marginBottom: spacing.sm }}>
            Your Review
          </Text>
          <MentionInput
            value={text}
            onChangeText={setText}
            placeholder="What did you think of this match?"
            multiline
            maxLength={250}
            containerStyle={{ marginBottom: spacing.xs, zIndex: 10 }}
            inputStyle={{
              backgroundColor: colors.accent,
              borderRadius: borderRadius.md,
              padding: spacing.md,
              fontSize: 15,
              minHeight: 120,
              borderWidth: 1,
              borderColor: colors.border,
              textAlignVertical: 'top',
            }}
          />
          <Text style={{ ...typography.small, color: text.length >= 240 ? '#ef4444' : colors.textSecondary, textAlign: 'right', marginBottom: spacing.lg }}>
            {text.length}/250
          </Text>

          {/* Media attachments */}
          <Text style={{ ...typography.bodyBold, color: colors.foreground, marginBottom: spacing.sm }}>
            Photos
          </Text>
          <View
            ref={mediaContainerRef}
            onLayout={() => {
              mediaContainerRef.current?.measure((x, y, w, h, pageX, pageY) => {
                mediaContainerPos.current = { x: pageX, y: pageY };
              });
            }}
            {...mediaDragPanResponder.panHandlers}
            style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.lg }}
          >
            {allMediaItems.map((meta, globalIndex) => {
              const isExisting = meta.source === 'existing';
              const existingItem = isExisting ? existingMedia[meta.index] : null;
              const newItem = !isExisting ? mediaItems[meta.index] : null;
              const thumbnailUri = isExisting ? existingItem!.url : newItem!.uri;
              const isDragging = dragIdx === globalIndex;

              const handleRemove = () => {
                if (isExisting) removeExistingMedia(meta.index);
                else removeMedia(meta.index);
              };

              return (
                <View
                  key={meta.key}
                  onLayout={(e) => {
                    const { x, y, width, height } = e.nativeEvent.layout;
                    itemRects.current[globalIndex] = { x, y, w: width, h: height };
                  }}
                >
                  <View style={{
                    width: 80,
                    height: 80,
                    borderRadius: borderRadius.md,
                    overflow: 'hidden',
                    backgroundColor: colors.accent,
                    opacity: isDragging ? 0.3 : 1,
                  }}>
                    <Image
                      source={{ uri: thumbnailUri }}
                      style={{ width: 80, height: 80 }}
                      contentFit="cover"
                    />
                    <Pressable
                      onPress={handleRemove}
                      style={{
                        position: 'absolute',
                        top: 4,
                        right: 4,
                        backgroundColor: 'rgba(0,0,0,0.6)',
                        borderRadius: 10,
                        width: 20,
                        height: 20,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Ionicons name="close" size={12} color="#fff" />
                    </Pressable>
                  </View>
                </View>
              );
            })}
            {/* Ghost item following finger during drag */}
            {dragIdx !== null && itemRects.current[dragIdx] && (() => {
              const meta = allMediaItems[dragIdx];
              if (!meta) return null;
              const isExisting = meta.source === 'existing';
              const existingItem = isExisting ? existingMedia[meta.index] : null;
              const newItem = !isExisting ? mediaItems[meta.index] : null;
              const thumbnailUri = isExisting ? existingItem!.url : newItem!.uri;
              return (
                <RNAnimated.View
                  pointerEvents="none"
                  style={{
                    position: 'absolute',
                    left: itemRects.current[dragIdx].x,
                    top: itemRects.current[dragIdx].y,
                    transform: [
                      { translateX: dragAnim.x },
                      { translateY: dragAnim.y },
                      { scale: 1.1 },
                    ],
                    zIndex: 100,
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.3,
                    shadowRadius: 8,
                    elevation: 8,
                  }}
                >
                  <View style={{ width: 80, height: 80, borderRadius: borderRadius.md, overflow: 'hidden', borderWidth: 2, borderColor: colors.primary }}>
                    <Image source={{ uri: thumbnailUri }} style={{ width: 80, height: 80 }} contentFit="cover" />
                  </View>
                </RNAnimated.View>
              );
            })()}
            {totalMediaCount < 4 && (
              <Pressable
                onPress={handlePickMedia}
                style={{
                  width: 80,
                  height: 80,
                  borderRadius: borderRadius.md,
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderStyle: 'dashed',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ionicons name="camera-outline" size={24} color={colors.textSecondary} />
                <Text style={{ ...typography.small, color: colors.textSecondary, marginTop: 2 }}>Add</Text>
              </Pressable>
            )}
          </View>

          {/* Man of the Match picker (finished matches with lineup only) */}
          {motmData && (
            <Pressable
              onPress={() => setShowMotmModal(true)}
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingVertical: spacing.sm,
                marginBottom: spacing.lg,
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                <Text style={{ fontSize: 16 }}>⭐</Text>
                <Text style={{ ...typography.body, color: colors.foreground }}>Man of the Match</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
                <Text style={{ ...typography.body, color: motmData.selectedName ? colors.primary : colors.textSecondary }}>
                  {motmData.selectedName || 'Select player'}
                </Text>
                <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
              </View>
            </Pressable>
          )}
          {isEditMode && motmData && (
            <Text style={{ ...typography.small, color: colors.textSecondary, marginTop: -spacing.md, marginBottom: spacing.lg }}>
              Only your latest vote counts toward the final MOTM result.
            </Text>
          )}

          {/* Tags — user custom */}
          <Text style={{ ...typography.bodyBold, color: colors.foreground, marginBottom: spacing.sm }}>
            Tags
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.sm }}>
            {userTags.map((tag) => {
              const isSelected = selectedTags.includes(tag);
              return (
                <Pressable
                  key={tag}
                  onPress={() => toggleTag(tag)}
                  style={{
                    paddingHorizontal: spacing.sm + 4,
                    paddingVertical: spacing.xs + 2,
                    borderRadius: borderRadius.full,
                    backgroundColor: isSelected ? colors.primary : colors.accent,
                    borderWidth: 1,
                    borderColor: isSelected ? colors.primary : colors.border,
                  }}
                >
                  <Text
                    style={{
                      ...typography.caption,
                      color: isSelected ? '#ffffff' : colors.foreground,
                    }}
                  >
                    {tag}
                  </Text>
                </Pressable>
              );
            })}
            {/* Add tag button */}
            <Pressable
              onPress={() => setShowTagInput(true)}
              style={{
                paddingHorizontal: spacing.sm + 4,
                paddingVertical: spacing.xs + 2,
                borderRadius: borderRadius.full,
                borderWidth: 1,
                borderColor: colors.border,
                borderStyle: 'dashed',
                flexDirection: 'row',
                alignItems: 'center',
                gap: 4,
              }}
            >
              <Ionicons name="add" size={14} color={colors.textSecondary} />
              <Text style={{ ...typography.caption, color: colors.textSecondary }}>
                Add tag
              </Text>
            </Pressable>
          </View>

          {/* New tag input */}
          {showTagInput && (
            <View style={{ flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg }}>
              <RNTextInput
                placeholder="Enter tag name..."
                placeholderTextColor={colors.textSecondary}
                value={newTagInput}
                onChangeText={setNewTagInput}
                autoFocus
                onSubmitEditing={handleAddTag}
                returnKeyType="done"
                style={{
                  flex: 1,
                  backgroundColor: colors.accent,
                  color: colors.foreground,
                  borderRadius: borderRadius.md,
                  paddingHorizontal: spacing.md,
                  paddingVertical: spacing.sm,
                  fontSize: 14,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              />
              <Pressable
                onPress={handleAddTag}
                style={{
                  backgroundColor: colors.primary,
                  borderRadius: borderRadius.md,
                  paddingHorizontal: spacing.md,
                  justifyContent: 'center',
                }}
              >
                <Text style={{ color: '#fff', fontWeight: '600', fontSize: 14 }}>Add</Text>
              </Pressable>
              <Pressable
                onPress={() => { setShowTagInput(false); setNewTagInput(''); }}
                style={{ justifyContent: 'center' }}
              >
                <Ionicons name="close" size={20} color={colors.textSecondary} />
              </Pressable>
            </View>
          )}

          {!showTagInput && <View style={{ marginBottom: spacing.md }} />}

          {/* Spoiler toggle */}
          <View style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingVertical: spacing.sm,
            marginBottom: spacing.lg,
          }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
              <Ionicons name="eye-off-outline" size={18} color={colors.textSecondary} />
              <Text style={{ ...typography.body, color: colors.foreground }}>Contains spoilers</Text>
            </View>
            <Switch
              value={isSpoiler}
              onValueChange={setIsSpoiler}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor="#fff"
            />
          </View>

          {/* Submit — dynamic label */}
          <Button
            title={isEditMode ? 'Save Changes' : hasReviewText ? 'Post Review' : 'Log Match'}
            onPress={handleSubmit}
            loading={createReview.isPending || updateReviewMutation.isPending || uploading}
            disabled={uploading}
            size="lg"
          />
        </ScrollView>
      </KeyboardAvoidingView>

      {/* MOTM picker modal */}
      {matchDetail && motmData && (
        <MOTMPickerModal
          visible={showMotmModal}
          onClose={() => setShowMotmModal(false)}
          matchDetail={matchDetail}
          homeTeamName={match?.homeTeam.name || ''}
          awayTeamName={match?.awayTeam.name || ''}
          homeTeamCrest={match?.homeTeam.crest || ''}
          awayTeamCrest={match?.awayTeam.crest || ''}
          selectedPlayerId={motmPlayerId}
          onSelect={setMotmPlayerId}
        />
      )}

      {/* Image preview modal */}
      <Modal visible={!!previewImageUri} transparent animationType="none">
        <Pressable
          onPress={() => setPreviewImageUri(null)}
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', justifyContent: 'center', alignItems: 'center' }}
        >
          {/* Close button */}
          <Pressable
            onPress={() => setPreviewImageUri(null)}
            style={{
              position: 'absolute',
              top: 54,
              right: 16,
              zIndex: 10,
              backgroundColor: 'rgba(255,255,255,0.2)',
              borderRadius: 16,
              width: 32,
              height: 32,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons name="close" size={18} color="#fff" />
          </Pressable>
          {/* Image */}
          {previewImageUri && (
            <Image
              source={{ uri: previewImageUri }}
              style={{ width: screenWidth, height: screenWidth }}
              contentFit="contain"
            />
          )}
        </Pressable>
      </Modal>

    </SafeAreaView>
  );
}
