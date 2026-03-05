import React, { useState, useMemo } from 'react';
import { View, Text, Pressable, ScrollView, Alert, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useQueries } from '@tanstack/react-query';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { useUserProfile } from '../../hooks/useUser';
import { useCreateList } from '../../hooks/useLists';
import { getMatchById } from '../../services/matchService';
import { TextInput } from '../../components/ui/TextInput';
import { Button } from '../../components/ui/Button';
import { MatchPickerModal } from '../../components/match/MatchPickerModal';
import { Match } from '../../types/match';
import { ProfileStackParamList } from '../../types/navigation';
import { isTextClean } from '../../utils/moderation';

type Props = NativeStackScreenProps<ProfileStackParamList, 'CreateList'>;

export function CreateListScreen({ navigation }: Props) {
  const { theme, isDark } = useTheme();
  const { colors, spacing, typography, borderRadius } = theme;
  const { user } = useAuth();
  const { data: profile } = useUserProfile(user?.uid || '');
  const createList = useCreateList();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [ranked, setRanked] = useState(false);
  const [matchIds, setMatchIds] = useState<number[]>([]);
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
      Alert.alert('Name Required', 'Please enter a list name.');
      return;
    }
    if (!isTextClean(name) || !isTextClean(description)) {
      Alert.alert('Content Warning', 'Your list contains inappropriate language. Please revise.');
      return;
    }
    if (!user || !profile) return;

    createList.mutate(
      {
        userId: user.uid,
        username: profile.username,
        name: name.trim(),
        description: description.trim(),
        matchIds,
        ranked,
      },
      {
        onSuccess: (listId) => navigation.replace('ListDetail', { listId }),
        onError: () => Alert.alert('Error', 'Failed to create list. Try again.'),
      }
    );
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
          New List
        </Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false}
        indicatorStyle={isDark ? 'white' : 'default'}
        contentContainerStyle={{ paddingBottom: 100 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* List info fields */}
        <View style={{ padding: spacing.md }}>
          <TextInput label="List Name" value={name} onChangeText={setName} placeholder="e.g. Best UCL Finals" />
          <TextInput
            label="Description (optional)"
            value={description}
            onChangeText={setDescription}
            placeholder="What's this list about?"
            multiline
            numberOfLines={3}
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
              <Text style={{ ...typography.bodyBold, color: colors.foreground }}>Ranked list</Text>
              <Text style={{ ...typography.caption, color: colors.textSecondary, marginTop: 2 }}>
                Manually order matches by your ranking
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
              Matches ({matchIds.length})
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
              <Text style={{ ...typography.caption, color: '#fff', fontWeight: '600' }}>Add</Text>
            </Pressable>
          </View>

          {/* Match rows */}
          {matchIds.length === 0 ? (
            <View style={{ alignItems: 'center', paddingVertical: spacing.xl, paddingHorizontal: spacing.xl }}>
              <Ionicons name="list-outline" size={36} color={colors.textSecondary} />
              <Text style={{ ...typography.body, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.sm }}>
                No matches yet. Tap Add to get started.
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
                      <Text style={{ ...typography.body, color: colors.textSecondary }}>Loading...</Text>
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
          title="Create List"
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
