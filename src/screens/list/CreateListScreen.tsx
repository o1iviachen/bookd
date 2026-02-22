import React, { useState } from 'react';
import { View, Text, Pressable, KeyboardAvoidingView, Platform, Alert } from 'react-native';
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

type Props = NativeStackScreenProps<ProfileStackParamList, 'CreateList'>;

export function CreateListScreen({ navigation }: Props) {
  const { theme } = useTheme();
  const { colors, spacing, typography } = theme;
  const { user } = useAuth();
  const { data: profile } = useUserProfile(user?.uid || '');
  const createList = useCreateList();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  const handleCreate = () => {
    if (!name.trim()) {
      Alert.alert('Name Required', 'Please enter a list name.');
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
      },
      {
        onSuccess: () => navigation.goBack(),
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
          <Button
            title="Create List"
            onPress={handleCreate}
            loading={createList.isPending}
            disabled={!name.trim()}
            size="lg"
            style={{ marginTop: spacing.md }}
          />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
