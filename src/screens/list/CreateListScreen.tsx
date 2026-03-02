import React, { useState } from 'react';
import { View, Text, Pressable, KeyboardAvoidingView, Platform, Alert, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { useUserProfile } from '../../hooks/useUser';
import { useCreateList } from '../../hooks/useLists';
import { TextInput } from '../../components/ui/TextInput';
import { Button } from '../../components/ui/Button';
import { ProfileStackParamList } from '../../types/navigation';
import { isTextClean } from '../../utils/moderation';

type Props = NativeStackScreenProps<ProfileStackParamList, 'CreateList'>;

export function CreateListScreen({ navigation }: Props) {
  const { theme } = useTheme();
  const { colors, spacing, typography } = theme;
  const { user } = useAuth();
  const { data: profile } = useUserProfile(user?.uid || '');
  const createList = useCreateList();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [ranked, setRanked] = useState(false);

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
        matchIds: [],
        ranked,
      },
      {
        onSuccess: (listId) => navigation.replace('ListDetail', { listId }),
        onError: () => Alert.alert('Error', 'Failed to create list. Try again.'),
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
            New List
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
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingVertical: spacing.md,
              marginBottom: spacing.sm,
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

          <Button
            title="Create List"
            onPress={handleCreate}
            loading={createList.isPending}
            disabled={!name.trim()}
            size="lg"
            style={{ marginTop: spacing.sm }}
          />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
