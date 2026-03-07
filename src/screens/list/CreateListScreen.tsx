import React, { useState, useMemo } from 'react';
import { View, Text, Pressable, ScrollView, Alert, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { useQueries } from '@tanstack/react-query';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { usePreferredLanguage } from '../../hooks/usePreferredLanguage';
import { useUserProfile } from '../../hooks/useUser';
import { useCreateList } from '../../hooks/useLists';
import { getMatchById } from '../../services/matchService';
import { uploadHeaderImage } from '../../services/storage';
import { TextInput } from '../../components/ui/TextInput';
import { Button } from '../../components/ui/Button';
import { MatchPickerModal } from '../../components/match/MatchPickerModal';
import { Match } from '../../types/match';
import { ProfileStackParamList } from '../../types/navigation';
import { isTextClean } from '../../utils/moderation';
import { useTranslation } from 'react-i18next';

type Props = NativeStackScreenProps<ProfileStackParamList, 'CreateList'>;

export function CreateListScreen({ navigation }: Props) {
  const { theme, isDark } = useTheme();
  const { colors, spacing, typography, borderRadius } = theme;
  const { t } = useTranslation();
  const { user } = useAuth();
  const { language } = usePreferredLanguage();
  const { data: profile } = useUserProfile(user?.uid || '');
  const createList = useCreateList();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [ranked, setRanked] = useState(false);
  const [matchIds, setMatchIds] = useState<number[]>([]);
  const [coverImageUri, setCoverImageUri] = useState<string | null>(null);
  const [showPicker, setShowPicker] = useState(false);

  // Fetch match data for selected matches
  const matchQueries = useQueries({
    queries: matchIds.map((id) => ({
      queryKey: ['match', id],
      queryFn: () => getMatchById(id),
      staleTime: 5 * 60 * 1000,
      enabled: matchIds.length > 0,
    })),
  });

  const matchMap = useMemo(() => {
    const map = new Map<number, Match>();
    matchQueries.forEach((q) => {
      if (q.data) map.set(q.data.id, q.data);
    });
    return map;
  }, [matchQueries]);

  const handleCreate = () => {
    if (!name.trim()) {
      Alert.alert(t('common.error'), t('list.listName'));
      return;
    }
    if (!isTextClean(name) || !isTextClean(description)) {
      Alert.alert(t('review.contentWarning'), t('review.reviewContainsInappropriate'));
      return;
    }
    if (!user || !profile) return;

    const doCreate = async () => {
      let coverImageUrl: string | null = null;
      if (coverImageUri) {
        coverImageUrl = await uploadHeaderImage(`headers/lists/${Date.now()}.jpg`, coverImageUri);
      }
      createList.mutate(
        {
          userId: user.uid,
          username: profile.username,
          name: name.trim(),
          description: description.trim(),
          matchIds,
          ranked,
          language,
          coverImage: coverImageUrl,
        },
        {
          onSuccess: (listId) => navigation.replace('ListDetail', { listId }),
          onError: () => Alert.alert(t('common.error'), t('common.error')),
        }
      );
    };
    doCreate();
  };

  const handleAddMatches = (ids: number[]) => {
    setMatchIds((prev) => [...prev, ...ids]);
  };

  const handleRemove = (matchId: number) => {
    setMatchIds((prev) => prev.filter((id) => id !== matchId));
  };

  const handleMoveUp = (index: number) => {
    if (index === 0) return;
    setMatchIds((prev) => {
      const next = [...prev];
      [next[index - 1], next[index]] = [next[index], next[index - 1]];
      return next;
    });
  };

  const handleMoveDown = (index: number) => {
    if (index === matchIds.length - 1) return;
    setMatchIds((prev) => {
      const next = [...prev];
      [next[index], next[index + 1]] = [next[index + 1], next[index]];
      return next;
    });
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border }}>
        <Pressable onPress={() => navigation.goBack()}>
          <Ionicons name="close" size={24} color={colors.foreground} />
        </Pressable>
        <Text style={{ ...typography.h4, color: colors.foreground, flex: 1, textAlign: 'center' }}>
          {t('list.newList')}
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
                onPress={() => setCoverImageUri(null)}
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
              {t('list.matchesCount', { count: matchIds.length })}
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
          {matchIds.length === 0 ? (
            <View style={{ alignItems: 'center', paddingVertical: spacing.xl, paddingHorizontal: spacing.xl }}>
              <Ionicons name="list-outline" size={36} color={colors.textSecondary} />
              <Text style={{ ...typography.body, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.sm }}>
                {t('list.noMatchesYet')}
              </Text>
            </View>
          ) : (
            matchIds.map((id, index) => {
              const match = matchMap.get(id);
              return (
                <View
                  key={id}
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

                  {/* Match info */}
                  {match ? (
                    <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm + 2 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Image source={{ uri: match.homeTeam.crest }} style={{ width: 28, height: 28 }} contentFit="contain" />
                        {match.status === 'FINISHED' && (
                          <Text style={{ ...typography.bodyBold, color: colors.foreground, fontSize: 14 }}>
                            {match.homeScore}-{match.awayScore}
                          </Text>
                        )}
                        <Image source={{ uri: match.awayTeam.crest }} style={{ width: 28, height: 28 }} contentFit="contain" />
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

                  {/* Reorder + delete */}
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                    <Pressable onPress={() => handleMoveUp(index)} hitSlop={6} style={{ padding: 4, opacity: index === 0 ? 0.3 : 1 }}>
                      <Ionicons name="chevron-up" size={18} color={colors.textSecondary} />
                    </Pressable>
                    <Pressable onPress={() => handleMoveDown(index)} hitSlop={6} style={{ padding: 4, opacity: index === matchIds.length - 1 ? 0.3 : 1 }}>
                      <Ionicons name="chevron-down" size={18} color={colors.textSecondary} />
                    </Pressable>
                    <Pressable onPress={() => handleRemove(id)} hitSlop={6} style={{ padding: 4 }}>
                      <Ionicons name="close-circle" size={18} color={colors.textSecondary} />
                    </Pressable>
                  </View>
                </View>
              );
            })
          )}
        </View>
      </ScrollView>

      {/* Sticky create button at bottom */}
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
          title={t('list.createList')}
          onPress={handleCreate}
          loading={createList.isPending}
          disabled={!name.trim()}
          size="lg"
        />
      </View>

      {/* Match picker modal */}
      <MatchPickerModal
        visible={showPicker}
        onClose={() => setShowPicker(false)}
        onAddMatches={handleAddMatches}
        excludeMatchIds={matchIds}
      />
    </SafeAreaView>
  );
}
