import React, { useState, useEffect, useRef, useMemo } from 'react';
import { View, Text, ScrollView, Pressable, KeyboardAvoidingView, Platform, Alert, ActivityIndicator, Switch, Modal, Dimensions, PanResponder, Animated as RNAnimated, LayoutAnimation, UIManager } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Video, ResizeMode, AVPlaybackStatus } from 'expo-av';
import * as ImagePicker from 'expo-image-picker';
import * as VideoThumbnails from 'expo-video-thumbnails';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { useMatch } from '../../hooks/useMatches';
import { useCreateReview, useUpdateReview, useReview } from '../../hooks/useReviews';
import { useUserProfile, useAddCustomTag, useMarkWatched, useToggleWatched, useToggleLiked } from '../../hooks/useUser';
import { uploadReviewMedia, uploadThumbnail } from '../../services/storage';
import { TeamLogo } from '../../components/match/TeamLogo';
import { StarRating } from '../../components/ui/StarRating';
import { Button } from '../../components/ui/Button';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { ReviewMedia } from '../../types/review';
import { TextInput as RNTextInput } from 'react-native';
import { isTextClean } from '../../utils/moderation';

interface LocalMedia {
  uri: string;
  type: 'image' | 'video';
  thumbnail?: string;
  durationMs?: number;
  width?: number;
  height?: number;
}

const FILMSTRIP_COUNT = 10;
const screenWidth = Dimensions.get('window').width;

export function CreateReviewScreen({ route, navigation }: any) {
  const { theme, isDark } = useTheme();
  const { colors, spacing, typography, borderRadius } = theme;
  const { user } = useAuth();
  const { matchId, reviewId } = route.params;
  const isEditMode = !!reviewId;
  const { data: match, isLoading } = useMatch(matchId);
  const { data: existingReview, isLoading: reviewLoading } = useReview(reviewId || '');
  const createReview = useCreateReview();
  const updateReviewMutation = useUpdateReview();
  const { data: profile } = useUserProfile(user?.uid || '');
  const addCustomTag = useAddCustomTag();
  const markWatched = useMarkWatched();
  const toggleWatched = useToggleWatched();
  const toggleLiked = useToggleLiked();

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
  const [thumbPickerVisible, setThumbPickerVisible] = useState(false);
  const [filmstripFrames, setFilmstripFrames] = useState<string[]>([]);
  const [pendingVideoUri, setPendingVideoUri] = useState<string | null>(null);
  const [pendingVideoDuration, setPendingVideoDuration] = useState(10000);
  const [pendingVideoAspect, setPendingVideoAspect] = useState(16 / 9);
  const [scrubPosition, setScrubPosition] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [previewImageUri, setPreviewImageUri] = useState<string | null>(null);
  const [videoLoading, setVideoLoading] = useState(true);
  const editingVideoItem = useRef<LocalMedia | null>(null);
  const editingExistingIndex = useRef<number | null>(null);
  const videoRef = useRef<Video>(null);

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
      setInitialized(true);
    }
  }, [isEditMode, existingReview, initialized]);

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

  const generateFilmstrip = async (videoUri: string, durationMs: number): Promise<string[]> => {
    const frames: string[] = [];
    for (let i = 0; i < FILMSTRIP_COUNT; i++) {
      const time = Math.floor((durationMs / FILMSTRIP_COUNT) * i);
      try {
        const { uri } = await VideoThumbnails.getThumbnailAsync(videoUri, { time });
        frames.push(uri);
      } catch {
        // skip failed frame
      }
    }
    return frames;
  };

  const durationKnown = useRef(false);

  const openThumbnailPicker = (videoUri: string, durationMs: number, width: number, height: number) => {
    const hasDuration = durationMs > 0 && durationMs !== 10000;
    durationKnown.current = hasDuration;
    setPendingVideoUri(videoUri);
    setPendingVideoDuration(durationMs);
    setPendingVideoAspect(width && height ? width / height : 16 / 9);
    setScrubPosition(0);
    setIsPlaying(false);
    setIsScrubbing(false);
    setVideoLoading(true);
    setThumbPickerVisible(true);
    if (hasDuration) {
      generateFilmstrip(videoUri, durationMs).then(setFilmstripFrames);
    } else {
      setFilmstripFrames([]);
    }
  };

  const addVideoWithThumbnail = (videoUri: string, durationMs?: number, width?: number, height?: number) => {
    const duration = durationMs && durationMs > 0 ? durationMs : 10000;
    openThumbnailPicker(videoUri, duration, width || 0, height || 0);
  };

  const filmstripWidth = useRef(0);

  const filmstripPanResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: (evt) => {
      setIsScrubbing(true);
      if (isPlaying) videoRef.current?.pauseAsync();
      const x = evt.nativeEvent.locationX;
      const w = filmstripWidth.current;
      if (w > 0) {
        const pos = Math.max(0, Math.min(1, x / w));
        setScrubPosition(pos);
        const posMs = Math.floor(pos * pendingVideoDuration);
        videoRef.current?.setPositionAsync(posMs, { toleranceMillisBefore: 100, toleranceMillisAfter: 100 });
      }
    },
    onPanResponderMove: (evt) => {
      const x = evt.nativeEvent.locationX;
      const w = filmstripWidth.current;
      if (w > 0) {
        const pos = Math.max(0, Math.min(1, x / w));
        setScrubPosition(pos);
        const posMs = Math.floor(pos * pendingVideoDuration);
        videoRef.current?.setPositionAsync(posMs, { toleranceMillisBefore: 100, toleranceMillisAfter: 100 });
      }
    },
    onPanResponderRelease: (evt) => {
      setIsScrubbing(false);
      const x = evt.nativeEvent.locationX;
      const w = filmstripWidth.current;
      if (w > 0) {
        const pos = Math.max(0, Math.min(1, x / w));
        setScrubPosition(pos);
        const posMs = Math.floor(pos * pendingVideoDuration);
        videoRef.current?.setPositionAsync(posMs, { toleranceMillisBefore: 0, toleranceMillisAfter: 0 });
      }
    },
  }), [pendingVideoDuration, isPlaying]);

  const handlePlaybackStatusUpdate = (status: AVPlaybackStatus) => {
    if (!status.isLoaded) return;
    if (videoLoading) setVideoLoading(false);
    // Auto-detect duration for remote videos where we don't know it upfront
    if (!durationKnown.current && status.durationMillis && status.durationMillis > 0) {
      durationKnown.current = true;
      setPendingVideoDuration(status.durationMillis);
      if (pendingVideoUri) {
        generateFilmstrip(pendingVideoUri, status.durationMillis).then(setFilmstripFrames);
      }
    }
    // Don't move the scrub indicator during playback — only user dragging moves it
    setIsPlaying(status.isPlaying);
  };

  const togglePlayPause = async () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      await videoRef.current.pauseAsync();
    } else {
      const status = await videoRef.current.getStatusAsync();
      if (status.isLoaded && status.durationMillis && status.positionMillis >= status.durationMillis - 100) {
        await videoRef.current.setPositionAsync(0);
      }
      await videoRef.current.playAsync();
    }
  };

  const handleConfirmThumbnail = async () => {
    if (!pendingVideoUri) return;
    // Pause video and capture thumbnail at current position
    await videoRef.current?.pauseAsync();
    const timeMs = Math.floor(scrubPosition * pendingVideoDuration);
    let thumbnailUri: string | undefined;
    try {
      const { uri } = await VideoThumbnails.getThumbnailAsync(pendingVideoUri, { time: timeMs });
      thumbnailUri = uri;
    } catch {
      // fall back to no thumbnail
    }

    if (editingExistingIndex.current !== null) {
      // Editing an existing uploaded video's thumbnail
      const idx = editingExistingIndex.current;
      if (thumbnailUri) {
        setExistingMedia((prev) => prev.map((item, i) =>
          i === idx ? { ...item, thumbnailUrl: thumbnailUri, _newThumbnailUri: thumbnailUri } as any : item
        ));
      }
      editingExistingIndex.current = null;
    } else {
      // Adding a new video
      const newItem: LocalMedia = {
        uri: pendingVideoUri, type: 'video',
        durationMs: pendingVideoDuration,
        width: pendingVideoAspect > 1 ? Math.round(pendingVideoAspect * 1000) : 1000,
        height: pendingVideoAspect > 1 ? 1000 : Math.round(1000 / pendingVideoAspect),
        ...(thumbnailUri && { thumbnail: thumbnailUri }),
      };
      setMediaItems((prev) => [...prev, newItem].slice(0, 4 - existingMedia.length));
      editingVideoItem.current = null;
    }

    setThumbPickerVisible(false);
    setPendingVideoUri(null);
    setFilmstripFrames([]);
    setIsPlaying(false);
  };

  const handleCancelThumbnail = () => {
    // Restore the video if we were editing an existing local item
    if (editingVideoItem.current) {
      setMediaItems((prev) => [...prev, editingVideoItem.current!]);
      editingVideoItem.current = null;
    }
    editingExistingIndex.current = null;
    setThumbPickerVisible(false);
    setPendingVideoUri(null);
    setFilmstripFrames([]);
    setIsPlaying(false);
  };

  const handleTapExistingMedia = (item: ReviewMedia, index: number) => {
    if (item.type === 'video') {
      // Open the thumbnail scrubber for existing uploaded videos
      editingExistingIndex.current = index;
      openThumbnailPicker(item.url, 10000, 0, 0);
    } else {
      setPreviewImageUri(item.url);
    }
  };

  const handleTapNewMedia = (item: LocalMedia, index: number) => {
    if (item.type === 'video') {
      // Save original and remove — will be re-added on confirm, or restored on cancel
      editingVideoItem.current = item;
      setMediaItems((prev) => prev.filter((_, i) => i !== index));
      openThumbnailPicker(item.uri, item.durationMs || 10000, item.width || 0, item.height || 0);
    } else {
      setPreviewImageUri(item.uri);
    }
  };

  const handlePickMedia = async () => {
    const totalMedia = mediaItems.length + existingMedia.length;
    if (totalMedia >= 4) {
      Alert.alert('Limit Reached', 'You can attach up to 4 photos or videos.');
      return;
    }

    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Please allow access to your photo library in Settings.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images', 'videos'],
        quality: 0.8,
        videoMaxDuration: 60,
        videoExportPreset: ImagePicker.VideoExportPreset.HighestQuality,
        preferredAssetRepresentationMode: ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
      });
      if (!result.canceled && result.assets.length > 0) {
        const asset = result.assets[0];
        const ext = asset.uri.split('.').pop()?.toLowerCase();
        const isVideo = asset.type === 'video' || ext === 'mov' || ext === 'mp4';
        if (isVideo) {
          // expo-image-picker duration is already in ms — enforce 1 min max
          if (asset.duration && asset.duration > 60000) {
            Alert.alert('Video Too Long', 'Videos must be 1 minute or shorter.');
            return;
          }
          addVideoWithThumbnail(asset.uri, asset.duration || undefined, asset.width, asset.height);
        } else {
          setMediaItems((prev) => [...prev, { uri: asset.uri, type: 'image' as const }].slice(0, 4 - existingMedia.length));
        }
      }
    } catch (err: any) {
      console.error('Pick media error:', err);
      Alert.alert('Error', 'Failed to pick media. Please try again.');
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
      const { locationX, locationY } = evt.nativeEvent;
      const idx = findItemAt(locationX, locationY);
      touchedItemIdx.current = idx;
      if (idx >= 0 && itemRects.current.length > 1) {
        longPressTimer.current = setTimeout(() => {
          isDragActive.current = true;
          dragIdxRef.current = idx;
          setDragIdx(idx);
          dragAnim.setValue({ x: 0, y: 0 });
        }, 150);
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
        let thumbnailUrl: string | undefined;
        if (item.type === 'video' && item.thumbnail) {
          thumbnailUrl = await uploadThumbnail(user.uid, tempReviewId, item.thumbnail, i);
        }
        uploadedMedia.push({ url, type: item.type, ...(thumbnailUrl && { thumbnailUrl }) });
      }

      // Upload any new thumbnails for existing videos
      const updatedExisting = await Promise.all(
        existingMedia.map(async (item) => {
          const newThumbUri = (item as any)._newThumbnailUri;
          if (newThumbUri) {
            const thumbUrl = await uploadThumbnail(user.uid, tempReviewId, newThumbUri, 0);
            const { _newThumbnailUri, ...rest } = item as any;
            return { ...rest, thumbnailUrl: thumbUrl } as ReviewMedia;
          }
          return item;
        })
      );

      const allMedia = [...updatedExisting, ...uploadedMedia];

      if (isEditMode && reviewId) {
        await updateReviewMutation.mutateAsync({
          reviewId,
          data: {
            rating,
            text,
            tags: selectedTags,
            media: allMedia,
            isSpoiler,
          },
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
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
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

        <ScrollView indicatorStyle={isDark ? 'white' : 'default'} contentContainerStyle={{ padding: spacing.md, paddingBottom: 100 }}>
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
          <RNTextInput
            placeholder="What did you think of this match?"
            placeholderTextColor={colors.textSecondary}
            value={text}
            onChangeText={setText}
            multiline
            numberOfLines={6}
            textAlignVertical="top"
            style={{
              backgroundColor: colors.accent,
              color: colors.foreground,
              borderRadius: borderRadius.md,
              padding: spacing.md,
              fontSize: 15,
              minHeight: 120,
              borderWidth: 1,
              borderColor: colors.border,
              marginBottom: spacing.lg,
            }}
          />

          {/* Media attachments */}
          <Text style={{ ...typography.bodyBold, color: colors.foreground, marginBottom: spacing.sm }}>
            Photos and Videos
          </Text>
          <View
            {...mediaDragPanResponder.panHandlers}
            style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.lg }}
          >
            {allMediaItems.map((meta, globalIndex) => {
              const isExisting = meta.source === 'existing';
              const existingItem = isExisting ? existingMedia[meta.index] : null;
              const newItem = !isExisting ? mediaItems[meta.index] : null;
              const thumbnailUri = isExisting
                ? (existingItem!.type === 'video' && existingItem!.thumbnailUrl ? existingItem!.thumbnailUrl : existingItem!.url)
                : (newItem!.type === 'video' && newItem!.thumbnail ? newItem!.thumbnail : newItem!.uri);
              const isVideo = isExisting ? existingItem!.type === 'video' : newItem!.type === 'video';
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
                    {isVideo && (
                      <View style={{ position: 'absolute', top: 4, left: 4, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 4, paddingHorizontal: 4, paddingVertical: 1 }}>
                        <Ionicons name="videocam" size={10} color="#fff" />
                      </View>
                    )}
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
              const thumbnailUri = isExisting
                ? (existingItem!.type === 'video' && existingItem!.thumbnailUrl ? existingItem!.thumbnailUrl : existingItem!.url)
                : (newItem!.type === 'video' && newItem!.thumbnail ? newItem!.thumbnail : newItem!.uri);
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

      {/* Thumbnail scrubber modal */}
      <Modal visible={thumbPickerVisible} animationType="none" presentationStyle="fullScreen">
        <View style={{ flex: 1, backgroundColor: '#000' }}>
          <SafeAreaView style={{ flex: 1 }}>
            {/* Header */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, paddingVertical: spacing.sm }}>
              <Pressable onPress={handleCancelThumbnail} hitSlop={8}>
                <Text style={{ ...typography.body, color: colors.textSecondary }}>Cancel</Text>
              </Pressable>
              <Text style={{ ...typography.bodyBold, color: '#fff' }}>Cover Image</Text>
              <Pressable onPress={handleConfirmThumbnail} hitSlop={8}>
                <Text style={{ ...typography.bodyBold, color: colors.primary }}>Done</Text>
              </Pressable>
            </View>

            {/* Video preview */}
            <View style={{ flex: 1, marginHorizontal: spacing.sm, marginTop: spacing.sm }}>
              {pendingVideoUri ? (
                <Pressable onPress={togglePlayPause} style={{ flex: 1 }}>
                  <Video
                    ref={videoRef}
                    source={{ uri: pendingVideoUri }}
                    style={{ flex: 1, borderRadius: borderRadius.lg }}
                    resizeMode={ResizeMode.CONTAIN}
                    shouldPlay={false}
                    isLooping={false}
                    onPlaybackStatusUpdate={handlePlaybackStatusUpdate}
                  />
                  {/* Loading overlay */}
                  {videoLoading && (
                    <View style={{
                      position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                      justifyContent: 'center',
                      alignItems: 'center',
                      backgroundColor: 'rgba(0,0,0,0.3)',
                      borderRadius: borderRadius.lg,
                    }}>
                      <ActivityIndicator size="large" color="#fff" />
                      <Text style={{ ...typography.caption, color: 'rgba(255,255,255,0.7)', marginTop: 8 }}>Loading video...</Text>
                    </View>
                  )}
                  {/* Play/pause overlay */}
                  {!isPlaying && !videoLoading && (
                    <View style={{
                      position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                      justifyContent: 'center',
                      alignItems: 'center',
                    }}>
                      <View style={{
                        width: 56,
                        height: 56,
                        borderRadius: 28,
                        backgroundColor: 'rgba(0,0,0,0.5)',
                        justifyContent: 'center',
                        alignItems: 'center',
                      }}>
                        <Ionicons name="play" size={28} color="#fff" style={{ marginLeft: 3 }} />
                      </View>
                    </View>
                  )}
                </Pressable>
              ) : (
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                  <ActivityIndicator color={colors.primary} />
                </View>
              )}
            </View>

            {/* Filmstrip + scrubber */}
            <View style={{ paddingHorizontal: spacing.md, paddingBottom: spacing.xl, marginTop: spacing.md, backgroundColor: 'transparent' }}>
              <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', textAlign: 'center', marginBottom: spacing.sm }}>
                Scrub to choose a cover frame
              </Text>
              {/* Filmstrip with overlay indicator */}
              <View
                onLayout={(e) => { filmstripWidth.current = e.nativeEvent.layout.width; }}
                {...filmstripPanResponder.panHandlers}
                style={{ height: 56 }}
              >
                {/* Frames */}
                <View style={{
                  height: 56,
                  borderRadius: borderRadius.sm,
                  overflow: 'hidden',
                  flexDirection: 'row',
                }}>
                  {filmstripFrames.length > 0 ? (
                    filmstripFrames.map((frameUri, i) => (
                      <Image
                        key={i}
                        source={{ uri: frameUri }}
                        style={{ flex: 1, height: 56 }}
                        contentFit="cover"
                      />
                    ))
                  ) : (
                    <View style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' }}>
                      <ActivityIndicator size="small" color={colors.textSecondary} />
                    </View>
                  )}
                </View>
                {/* Overlay scrub indicator */}
                {filmstripFrames.length > 0 && (
                  <View
                    style={{
                      position: 'absolute',
                      top: -2,
                      bottom: -2,
                      left: `${Math.max(0, Math.min(scrubPosition * 100, 100))}%`,
                      width: 36,
                      marginLeft: -18,
                      borderWidth: 2.5,
                      borderColor: '#fff',
                      borderRadius: 5,
                      backgroundColor: 'rgba(255,255,255,0.1)',
                    }}
                    pointerEvents="none"
                  />
                )}
              </View>
            </View>
          </SafeAreaView>
        </View>
      </Modal>

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
