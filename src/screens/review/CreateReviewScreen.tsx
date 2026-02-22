import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable, KeyboardAvoidingView, Platform, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { useMatch } from '../../hooks/useMatches';
import { useCreateReview } from '../../hooks/useReviews';
import { useUserProfile, useAddCustomTag, useMarkWatched, useToggleWatched, useToggleLiked } from '../../hooks/useUser';
import { uploadReviewMedia } from '../../services/storage';
import { TeamLogo } from '../../components/match/TeamLogo';
import { StarRating } from '../../components/ui/StarRating';
import { Button } from '../../components/ui/Button';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { MatchesStackParamList } from '../../types/navigation';
import { ReviewMedia } from '../../types/review';
import { TextInput as RNTextInput } from 'react-native';

type Props = NativeStackScreenProps<MatchesStackParamList, 'CreateReview'>;

interface LocalMedia {
  uri: string;
  type: 'image' | 'video';
}

export function CreateReviewScreen({ route, navigation }: Props) {
  const { theme } = useTheme();
  const { colors, spacing, typography, borderRadius } = theme;
  const { user } = useAuth();
  const { matchId } = route.params;
  const { data: match, isLoading } = useMatch(matchId);
  const createReview = useCreateReview();
  const { data: profile } = useUserProfile(user?.uid || '');
  const addCustomTag = useAddCustomTag();
  const markWatched = useMarkWatched();
  const toggleWatched = useToggleWatched();
  const toggleLiked = useToggleLiked();

  const isWatched = profile?.watchedMatchIds?.includes(matchId) || false;
  const isLiked = profile?.likedMatchIds?.includes(matchId) || false;

  const [rating, setRating] = useState(0);
  const [text, setText] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [newTagInput, setNewTagInput] = useState('');
  const [showTagInput, setShowTagInput] = useState(false);
  const [mediaItems, setMediaItems] = useState<LocalMedia[]>([]);
  const [uploading, setUploading] = useState(false);

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

  const handlePickMedia = async () => {
    if (mediaItems.length >= 4) {
      Alert.alert('Limit Reached', 'You can attach up to 4 photos or videos.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images', 'videos'],
      allowsMultipleSelection: true,
      selectionLimit: 4 - mediaItems.length,
      quality: 0.8,
      videoMaxDuration: 60,
    });
    if (!result.canceled && result.assets.length > 0) {
      const newItems: LocalMedia[] = result.assets.map((asset) => ({
        uri: asset.uri,
        type: asset.type === 'video' ? 'video' as const : 'image' as const,
      }));
      setMediaItems((prev) => [...prev, ...newItems].slice(0, 4));
    }
  };

  const removeMedia = (index: number) => {
    setMediaItems((prev) => prev.filter((_, i) => i !== index));
  };

  const hasReviewText = text.trim().length > 0;

  const handleSubmit = async () => {
    if (rating === 0) {
      Alert.alert('Rating Required', 'Please select a star rating.');
      return;
    }
    if (!user) return;

    setUploading(true);
    try {
      // Upload media files to Firebase Storage
      const uploadedMedia: ReviewMedia[] = [];
      const tempReviewId = `${Date.now()}`;
      for (let i = 0; i < mediaItems.length; i++) {
        const item = mediaItems[i];
        const url = await uploadReviewMedia(user.uid, tempReviewId, item.uri, item.type, i);
        uploadedMedia.push({ url, type: item.type });
      }

      // Auto-mark as watched when submitting a review/log
      markWatched.mutate({ userId: user.uid, matchId });

      createReview.mutate(
        {
          matchId,
          userId: user.uid,
          username: profile?.username || user.email?.split('@')[0] || 'Anonymous',
          userAvatar: profile?.avatar || null,
          rating,
          text,
          tags: selectedTags,
          media: uploadedMedia,
        },
        {
          onSuccess: () => navigation.goBack(),
          onError: () => Alert.alert('Error', 'Failed to submit. Try again.'),
        }
      );
    } catch {
      Alert.alert('Upload Error', 'Failed to upload media. Try again.');
    } finally {
      setUploading(false);
    }
  };

  if (isLoading || !match) return <LoadingSpinner />;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', padding: spacing.md }}>
          <Pressable onPress={() => navigation.goBack()}>
            <Ionicons name="close" size={24} color={colors.foreground} />
          </Pressable>
          <Text style={{ ...typography.h4, color: colors.foreground, flex: 1, textAlign: 'center' }}>
            {hasReviewText ? 'Write Review' : 'Log Match'}
          </Text>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView contentContainerStyle={{ padding: spacing.md, paddingBottom: 100 }}>
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
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.lg }}>
            {mediaItems.map((item, index) => (
              <View
                key={index}
                style={{
                  width: 80,
                  height: 80,
                  borderRadius: borderRadius.md,
                  overflow: 'hidden',
                  backgroundColor: colors.accent,
                }}
              >
                <Image
                  source={{ uri: item.uri }}
                  style={{ width: 80, height: 80 }}
                  contentFit="cover"
                />
                {item.type === 'video' && (
                  <View style={{ position: 'absolute', top: 4, left: 4, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 4, paddingHorizontal: 4, paddingVertical: 1 }}>
                    <Ionicons name="videocam" size={10} color="#fff" />
                  </View>
                )}
                <Pressable
                  onPress={() => removeMedia(index)}
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
            ))}
            {mediaItems.length < 4 && (
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

          {!showTagInput && <View style={{ marginBottom: spacing.lg }} />}

          {/* Upload progress indicator */}
          {uploading && (
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, marginBottom: spacing.md }}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={{ ...typography.caption, color: colors.textSecondary }}>
                Uploading media...
              </Text>
            </View>
          )}

          {/* Submit — dynamic label */}
          <Button
            title={hasReviewText ? 'Post Review' : 'Log Match'}
            onPress={handleSubmit}
            loading={createReview.isPending || uploading}
            disabled={rating === 0 || uploading}
            size="lg"
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
