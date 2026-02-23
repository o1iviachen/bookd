import React, { useState } from 'react';
import {
  View,
  Text,
  Pressable,
  Modal,
  ScrollView,
  TextInput as RNTextInput,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { useUserProfile } from '../../hooks/useUser';
import { useListsForUser, useCreateList, useAddMatchToList, useRemoveMatchFromList } from '../../hooks/useLists';

interface AddToListModalProps {
  visible: boolean;
  onClose: () => void;
  matchId: number;
}

export function AddToListModal({ visible, onClose, matchId }: AddToListModalProps) {
  const { theme } = useTheme();
  const { colors, spacing, typography, borderRadius } = theme;
  const { user } = useAuth();
  const { data: profile } = useUserProfile(user?.uid || '');
  const { data: lists } = useListsForUser(user?.uid || '');
  const createList = useCreateList();
  const addMatch = useAddMatchToList();
  const removeMatch = useRemoveMatchFromList();
  const { height: screenHeight } = useWindowDimensions();

  const [showNewList, setShowNewList] = useState(false);
  const [newListName, setNewListName] = useState('');

  const toggleMatch = (listId: string, isInList: boolean) => {
    if (isInList) {
      removeMatch.mutate({ listId, matchId });
    } else {
      addMatch.mutate({ listId, matchId });
    }
  };

  const handleCreateList = () => {
    if (!user || !newListName.trim()) return;
    createList.mutate(
      {
        userId: user.uid,
        username: profile?.username || 'Anonymous',
        name: newListName.trim(),
        description: '',
        matchIds: [matchId],
      },
      {
        onSuccess: () => {
          setNewListName('');
          setShowNewList(false);
        },
      }
    );
  };

  const maxHeight = screenHeight * 0.5;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable
        onPress={onClose}
        style={{
          flex: 1,
          backgroundColor: colors.overlay,
          justifyContent: 'center',
          alignItems: 'center',
          padding: spacing.xl,
        }}
      >
        <Pressable
          onPress={(e) => e.stopPropagation()}
          style={{
            width: '100%',
            maxHeight,
            backgroundColor: colors.card,
            borderRadius: borderRadius.lg,
            overflow: 'hidden',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: 0.3,
            shadowRadius: 16,
            elevation: 12,
          }}
        >
          {/* Header */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingHorizontal: spacing.md,
              paddingVertical: spacing.sm + 4,
              borderBottomWidth: 1,
              borderBottomColor: colors.border,
            }}
          >
            <Text style={{ ...typography.bodyBold, color: colors.foreground, fontSize: 14 }}>
              Add to List
            </Text>
            <Pressable onPress={onClose} hitSlop={8}>
              <Ionicons name="close-circle" size={20} color={colors.textSecondary} />
            </Pressable>
          </View>

          <ScrollView bounces={false}>
            {/* List rows */}
            {lists && lists.length > 0 ? (
              lists.map((list) => {
                const isInList = list.matchIds.includes(matchId);
                return (
                  <Pressable
                    key={list.id}
                    onPress={() => toggleMatch(list.id, isInList)}
                    style={({ pressed }) => ({
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      paddingHorizontal: spacing.md,
                      paddingVertical: 12,
                      borderBottomWidth: 1,
                      borderBottomColor: colors.border,
                      backgroundColor: pressed ? colors.muted : 'transparent',
                    })}
                  >
                    <View style={{ flex: 1, marginRight: spacing.sm }}>
                      <Text
                        style={{ ...typography.body, color: colors.foreground }}
                        numberOfLines={1}
                      >
                        {list.name}
                      </Text>
                      <Text style={{ ...typography.small, color: colors.textSecondary }}>
                        {list.matchIds.length} {list.matchIds.length === 1 ? 'match' : 'matches'}
                      </Text>
                    </View>
                    <Ionicons
                      name={isInList ? 'checkbox' : 'square-outline'}
                      size={22}
                      color={isInList ? colors.primary : colors.textSecondary}
                    />
                  </Pressable>
                );
              })
            ) : (
              <View style={{ alignItems: 'center', paddingVertical: spacing.lg }}>
                <Text style={{ ...typography.body, color: colors.textSecondary }}>
                  No lists yet. Create your first!
                </Text>
              </View>
            )}

            {/* Create new list */}
            {showNewList ? (
              <View style={{ padding: spacing.md, borderTopWidth: 1, borderTopColor: colors.border }}>
                <RNTextInput
                  placeholder="List name..."
                  placeholderTextColor={colors.textSecondary}
                  value={newListName}
                  onChangeText={setNewListName}
                  autoFocus
                  style={{
                    backgroundColor: colors.muted,
                    borderRadius: borderRadius.md,
                    paddingHorizontal: spacing.sm + 2,
                    paddingVertical: spacing.sm,
                    color: colors.foreground,
                    fontSize: 14,
                    marginBottom: spacing.sm,
                  }}
                />
                <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                  <Pressable
                    onPress={() => { setShowNewList(false); setNewListName(''); }}
                    style={{
                      flex: 1,
                      paddingVertical: spacing.sm,
                      borderRadius: borderRadius.md,
                      backgroundColor: colors.muted,
                      alignItems: 'center',
                    }}
                  >
                    <Text style={{ ...typography.body, color: colors.textSecondary }}>Cancel</Text>
                  </Pressable>
                  <Pressable
                    onPress={handleCreateList}
                    style={{
                      flex: 1,
                      paddingVertical: spacing.sm,
                      borderRadius: borderRadius.md,
                      backgroundColor: newListName.trim() ? colors.primary : colors.muted,
                      alignItems: 'center',
                    }}
                  >
                    <Text style={{ ...typography.bodyBold, color: newListName.trim() ? '#14181c' : colors.textSecondary }}>
                      Create
                    </Text>
                  </Pressable>
                </View>
              </View>
            ) : (
              <Pressable
                onPress={() => setShowNewList(true)}
                style={({ pressed }) => ({
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: spacing.sm,
                  paddingHorizontal: spacing.md,
                  paddingVertical: 12,
                  backgroundColor: pressed ? colors.muted : 'transparent',
                })}
              >
                <Ionicons name="add-circle-outline" size={22} color={colors.primary} />
                <Text style={{ ...typography.body, color: colors.primary }}>New List</Text>
              </Pressable>
            )}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
