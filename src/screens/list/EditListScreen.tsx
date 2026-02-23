import React, { useState, useEffect } from 'react';
import { View, Text, Pressable, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { useList, useUpdateList } from '../../hooks/useLists';
import { TextInput } from '../../components/ui/TextInput';
import { Button } from '../../components/ui/Button';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';

export function EditListScreen({ route, navigation }: any) {
  const { theme } = useTheme();
  const { colors, spacing, typography } = theme;
  const { listId } = route.params;
  const { data: list, isLoading } = useList(listId);
  const updateList = useUpdateList();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [ranked, setRanked] = useState(false);

  useEffect(() => {
    if (list) {
      setName(list.name);
      setDescription(list.description);
      setRanked(list.ranked);
    }
  }, [list]);

  if (isLoading || !list) return <LoadingSpinner />;

  const handleSave = () => {
    if (!name.trim()) {
      Alert.alert('Name Required', 'Please enter a list name.');
      return;
    }

    updateList.mutate(
      {
        listId,
        data: {
          name: name.trim(),
          description: description.trim(),
          ranked,
        },
      },
      {
        onSuccess: () => navigation.goBack(),
        onError: () => Alert.alert('Error', 'Failed to update list. Try again.'),
      }
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', padding: spacing.md }}>
          <Pressable onPress={() => navigation.goBack()}>
            <Ionicons name="close" size={24} color={colors.foreground} />
          </Pressable>
          <Text style={{ ...typography.h4, color: colors.foreground, flex: 1, textAlign: 'center' }}>
            Edit List
          </Text>
          <View style={{ width: 24 }} />
        </View>

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
          <Pressable
            onPress={() => setRanked(!ranked)}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingVertical: spacing.md,
              marginBottom: spacing.sm,
            }}
          >
            <View>
              <Text style={{ ...typography.bodyBold, color: colors.foreground }}>Ranked list</Text>
              <Text style={{ ...typography.caption, color: colors.textSecondary, marginTop: 2 }}>
                Manually order matches by your ranking
              </Text>
            </View>
            <Ionicons
              name={ranked ? 'checkbox' : 'square-outline'}
              size={24}
              color={ranked ? colors.primary : colors.textSecondary}
            />
          </Pressable>

          <Button
            title="Save Changes"
            onPress={handleSave}
            loading={updateList.isPending}
            disabled={!name.trim()}
            size="lg"
            style={{ marginTop: spacing.sm }}
          />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
