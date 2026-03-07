import React, { useState, useEffect, useMemo, useRef } from 'react';
import { View, Text, Pressable, ScrollView, Alert, Animated, Switch, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useQueries } from '@tanstack/react-query';
import Swipeable from 'react-native-gesture-handler/Swipeable';
import { useTheme } from '../../context/ThemeContext';
import { usePreferredLanguage } from '../../hooks/usePreferredLanguage';
import { useList, useUpdateList, useUpdateMatchOrder, useRemoveMatchFromList } from '../../hooks/useLists';
import { getMatchById } from '../../services/matchService';
import { TextInput } from '../../components/ui/TextInput';
import { Button } from '../../components/ui/Button';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { MatchPickerModal } from '../../components/match/MatchPickerModal';
import { Match } from '../../types/match';
import { isTextClean } from '../../utils/moderation';
import { uploadHeaderImage } from '../../services/storage';
import { useAuth } from '../../context/AuthContext';
import * as ImagePicker from 'expo-image-picker';
import { useTranslation } from 'react-i18next';

function SwipeableMatchRow({
  children,
  onDelete,
}: {
  children: React.ReactNode;
  onDelete: () => void;
}) {
  const swipeableRef = useRef<Swipeable>(null);
  const { theme } = useTheme();
  const { t } = useTranslation();

  const renderRightActions = (
    _progress: Animated.AnimatedInterpolation<number>,
    dragX: Animated.AnimatedInterpolation<number>
  ) => {
    const scale = dragX.interpolate({
      inputRange: [-80, 0],
      outputRange: [1, 0.5],
      extrapolate: 'clamp',
    });

    return (
      <Pressable
        onPress={() => {
          swipeableRef.current?.close();
          onDelete();
        }}
        style={{
          backgroundColor: '#ef4444',
          justifyContent: 'center',
          alignItems: 'center',
          width: 80,
        }}
      >
        <Animated.View style={{ transform: [{ scale }] }}>
          <Ionicons name="trash" size={22} color="#fff" />
          <Text style={{ color: '#fff', fontSize: 12, marginTop: 2, fontWeight: '600' }}>{t('common.delete')}</Text>
        </Animated.View>
      </Pressable>
    );
  };

  return (
    <Swipeable
      ref={swipeableRef}
      renderRightActions={renderRightActions}
      overshootRight={false}
      friction={2}
    >
      {children}
    </Swipeable>
  );
}

export function EditListScreen({ route, navigation }: any) {
  const { theme, isDark } = useTheme();
  const { colors, spacing, typography, borderRadius } = theme;
  const { t } = useTranslation();
  const { language } = usePreferredLanguage();
  const { user } = useAuth();
  const { width: screenWidth } = useWindowDimensions();
  const { listId } = route.params;
  const { data: list, isLoading } = useList(listId);
  const updateList = useUpdateList();
  const updateOrder = useUpdateMatchOrder();
  const removeMatch = useRemoveMatchFromList();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [ranked, setRanked] = useState(false);
  const [localMatchIds, setLocalMatchIds] = useState<number[]>([]);
  const [coverImageUri, setCoverImageUri] = useState<string | null>(null);
  const [coverImageChanged, setCoverImageChanged] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (list && !initialized) {
      setName(list.name);
      setDescription(list.description);
      setRanked(list.ranked);
      setLocalMatchIds(list.matchIds);
      setCoverImageUri(list.coverImage || null);
      setInitialized(true);
    }
  }, [list, initialized]);

  // Fetch match data for all matchIds
  const matchQueries = useQueries({
    queries: localMatchIds.map((id) => ({
      queryKey: ['match', id],
      queryFn: () => getMatchById(id),
      staleTime: 5 * 60 * 1000,
      enabled: localMatchIds.length > 0,
    })),
  });

  const matchMap = useMemo(() => {
    const map = new Map<number, Match>();
    matchQueries.forEach((q) => {
      if (q.data) map.set(q.data.id, q.data);
    });
    return map;
  }, [matchQueries]);

  if (isLoading || !list) return <LoadingSpinner />;

  const handleSave = () => {
    if (!name.trim()) {
      Alert.alert(t('common.error'), t('list.listName'));
      return;
    }
    if (!isTextClean(name) || !isTextClean(description)) {
      Alert.alert(t('review.contentWarning'), t('review.reviewContainsInappropriate'));
      return;
    }

    const saveList = async () => {
      let coverImageUrl = coverImageUri;
      if (coverImageChanged && coverImageUri && !coverImageUri.startsWith('http')) {
        coverImageUrl = await uploadHeaderImage(`headers/lists/${listId}.jpg`, coverImageUri);
      }
      updateList.mutate(
        {
          listId,
          data: {
            name: name.trim(),
            description: description.trim(),
            ranked,
            language,
            ...(coverImageChanged && { coverImage: coverImageUrl }),
          },
        },
        {
          onSuccess: () => navigation.goBack(),
          onError: () => Alert.alert(t('common.error'), t('list.editList')),
        }
      );
    };
    saveList();
  };

  const handleAddMatches = (matchIds: number[]) => {
    const newIds = [...localMatchIds, ...matchIds];
    setLocalMatchIds(newIds);
    updateOrder.mutate({ listId, matchIds: newIds });
  };

  const handleRemove = (matchId: number) => {
    const newIds = localMatchIds.filter((id) => id !== matchId);
    setLocalMatchIds(newIds);
    removeMatch.mutate({ listId, matchId });
  };

  const handleMoveUp = (index: number) => {
    if (index === 0) return;
    const newIds = [...localMatchIds];
    [newIds[index - 1], newIds[index]] = [newIds[index], newIds[index - 1]];
    setLocalMatchIds(newIds);
    updateOrder.mutate({ listId, matchIds: newIds });
  };

  const handleMoveDown = (index: number) => {
    if (index === localMatchIds.length - 1) return;
    const newIds = [...localMatchIds];
    [newIds[index], newIds[index + 1]] = [newIds[index + 1], newIds[index]];
    setLocalMatchIds(newIds);
    updateOrder.mutate({ listId, matchIds: newIds });
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border }}>
        <Pressable onPress={() => navigation.goBack()}>
          <Ionicons name="close" size={24} color={colors.foreground} />
        </Pressable>
        <Text style={{ ...typography.h4, color: colors.foreground, flex: 1, textAlign: 'center' }}>
          {t('list.editList')}
        </Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false}
        indicatorStyle={isDark ? 'white' : 'default'}
        contentContainerStyle={{ paddingBottom: 100 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Cover image picker */}
        <Pressable
          onPress={async () => {
            const result = await ImagePicker.launchImageLibraryAsync({
              mediaTypes: ['images'],
              allowsEditing: true,
              aspect: [16, 9],
              quality: 0.8,
            });
            if (!result.canceled && result.assets[0]) {
              setCoverImageUri(result.assets[0].uri);
              setCoverImageChanged(true);
            }
          }}
          style={{ width: '100%', height: 160, overflow: 'hidden', justifyContent: 'center', alignItems: 'center' }}
        >
          {coverImageUri ? (
            <>
              <Image source={{ uri: coverImageUri }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
              <LinearGradient
                colors={['transparent', colors.background]}
                style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 60 }}
              />
              <Pressable
                onPress={() => { setCoverImageUri(null); setCoverImageChanged(true); }}
                style={{ position: 'absolute', top: spacing.sm, right: spacing.sm, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 14, width: 28, height: 28, alignItems: 'center', justifyContent: 'center' }}
              >
                <Ionicons name="close" size={16} color="#fff" />
              </Pressable>
            </>
          ) : (
            <LinearGradient
              colors={[colors.muted, colors.background]}
              style={{ width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' }}
            >
              <Ionicons name="image-outline" size={28} color={colors.textSecondary} />
              <Text style={{ ...typography.caption, color: colors.textSecondary, marginTop: 4 }}>{t('list.addCoverImage')}</Text>
            </LinearGradient>
          )}
        </Pressable>

        {/* List info fields */}
        <View style={{ padding: spacing.md }}>
          <TextInput label={t('list.listName')} value={name} onChangeText={setName} placeholder={t('list.listNamePlaceholder')} maxLength={50} />
          <TextInput
            label={t('list.descriptionOptional')}
            value={description}
            onChangeText={setDescription}
            placeholder={t('list.descriptionPlaceholder')}
            multiline
            numberOfLines={3}
            maxLength={150}
          />

          {/* Ranked toggle */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingVertical: spacing.md,
            }}
          >
            <View style={{ flex: 1, marginRight: spacing.md }}>
              <Text style={{ ...typography.bodyBold, color: colors.foreground }}>{t('list.rankedList')}</Text>
              <Text style={{ ...typography.caption, color: colors.textSecondary, marginTop: 2 }}>
                {t('list.rankedListDescription')}
              </Text>
            </View>
            <Switch
              value={ranked}
              onValueChange={setRanked}
              trackColor={{ false: colors.muted, true: colors.primary }}
              thumbColor="#fff"
            />
          </View>
        </View>

        {/* Matches section */}
        <View style={{ borderTopWidth: 1, borderTopColor: colors.border }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, paddingVertical: spacing.md }}>
            <Text style={{ ...typography.bodyBold, color: colors.foreground, fontSize: 16 }}>
              {t('list.matchesCount', { count: localMatchIds.length })}
            </Text>
            <Pressable
              onPress={() => setShowPicker(true)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 4,
                backgroundColor: colors.primary,
                paddingHorizontal: spacing.sm + 2,
                paddingVertical: spacing.xs + 2,
                borderRadius: borderRadius.md,
              }}
            >
              <Ionicons name="add" size={16} color="#fff" />
              <Text style={{ ...typography.caption, color: '#fff', fontWeight: '600' }}>{t('common.add')}</Text>
            </Pressable>
          </View>

          {/* Match rows */}
          {localMatchIds.length === 0 ? (
            <View style={{ alignItems: 'center', paddingVertical: spacing.xl, paddingHorizontal: spacing.xl }}>
              <Ionicons name="list-outline" size={36} color={colors.textSecondary} />
              <Text style={{ ...typography.body, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.sm }}>
                {t('list.noMatchesYet')}
              </Text>
            </View>
          ) : (
            localMatchIds.map((matchId, index) => {
              const match = matchMap.get(matchId);
              return (
                <SwipeableMatchRow key={matchId} onDelete={() => handleRemove(matchId)}>
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      paddingHorizontal: spacing.md,
                      paddingVertical: spacing.md,
                      borderBottomWidth: 1,
                      borderBottomColor: colors.border,
                      backgroundColor: colors.background,
                      gap: spacing.sm + 2,
                    }}
                  >
                    {/* Rank number for ranked lists */}
                    {ranked && (
                      <Text style={{ ...typography.bodyBold, color: colors.textSecondary, width: 22, textAlign: 'center', fontSize: 14 }}>
                        {index + 1}
                      </Text>
                    )}

                    {/* Match info: homeCrest - score - awayCrest + team names */}
                    {match ? (
                      <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm + 2 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                          <Image
                            source={{ uri: match.homeTeam.crest }}
                            style={{ width: 28, height: 28 }}
                            contentFit="contain"
                          />
                          {match.status === 'FINISHED' && (
                            <Text style={{ ...typography.bodyBold, color: colors.foreground, fontSize: 14 }}>
                              {match.homeScore}-{match.awayScore}
                            </Text>
                          )}
                          <Image
                            source={{ uri: match.awayTeam.crest }}
                            style={{ width: 28, height: 28 }}
                            contentFit="contain"
                          />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={{ ...typography.body, color: colors.foreground, fontSize: 15 }} numberOfLines={1}>
                            {match.homeTeam.shortName} v {match.awayTeam.shortName}
                          </Text>
                          <Text style={{ ...typography.caption, color: colors.textSecondary, marginTop: 2 }} numberOfLines={1}>
                            {match.competition.name}
                          </Text>
                        </View>
                      </View>
                    ) : (
                      <View style={{ flex: 1 }}>
                        <Text style={{ ...typography.body, color: colors.textSecondary }}>{t('common.loading')}</Text>
                      </View>
                    )}

                    {/* Reorder buttons */}
                    <View style={{ flexDirection: 'row', gap: 2 }}>
                      <Pressable
                        onPress={() => handleMoveUp(index)}
                        hitSlop={6}
                        style={{ padding: 4, opacity: index === 0 ? 0.3 : 1 }}
                      >
                        <Ionicons name="chevron-up" size={18} color={colors.textSecondary} />
                      </Pressable>
                      <Pressable
                        onPress={() => handleMoveDown(index)}
                        hitSlop={6}
                        style={{ padding: 4, opacity: index === localMatchIds.length - 1 ? 0.3 : 1 }}
                      >
                        <Ionicons name="chevron-down" size={18} color={colors.textSecondary} />
                      </Pressable>
                    </View>
                  </View>
                </SwipeableMatchRow>
              );
            })
          )}
        </View>
      </ScrollView>

      {/* Sticky save button at bottom */}
      <View
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          backgroundColor: colors.background,
          borderTopWidth: 1,
          borderTopColor: colors.border,
          paddingHorizontal: spacing.md,
          paddingTop: spacing.sm,
          paddingBottom: spacing.lg,
        }}
      >
        <Button
          title={t('list.saveChanges')}
          onPress={handleSave}
          loading={updateList.isPending}
          disabled={!name.trim()}
          size="lg"
        />
      </View>

      {/* Match picker modal */}
      <MatchPickerModal
        visible={showPicker}
        onClose={() => setShowPicker(false)}
        onAddMatches={handleAddMatches}
        excludeMatchIds={localMatchIds}
      />
    </SafeAreaView>
  );
}
