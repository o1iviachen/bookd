import React from 'react';
import { View, Text, ScrollView, Pressable, Modal } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { Avatar } from './Avatar';
import { User } from '../../types/user';

interface LikedByModalProps {
  visible: boolean;
  onClose: () => void;
  likers: User[];
  isLoading: boolean;
  following: string[];
  onUserPress: (userId: string) => void;
}

export function LikedByModal({ visible, onClose, likers, isLoading, following, onUserPress }: LikedByModalProps) {
  const { theme } = useTheme();
  const { colors, spacing, typography, borderRadius } = theme;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        onPress={onClose}
        style={{ flex: 1, backgroundColor: colors.overlay, justifyContent: 'center', alignItems: 'center', padding: spacing.xl }}
      >
        <Pressable
          onPress={(e) => e.stopPropagation()}
          style={{
            width: '100%',
            maxWidth: 300,
            maxHeight: 400,
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
          <View style={{ paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 4, borderBottomWidth: 1, borderBottomColor: colors.border }}>
            <Text style={{ ...typography.bodyBold, color: colors.foreground, fontSize: 14 }}>
              Liked by
            </Text>
          </View>
          <ScrollView bounces={false} style={{ maxHeight: 340 }}>
            {isLoading ? (
              <View style={{ paddingVertical: spacing.xl, alignItems: 'center' }}>
                <Text style={{ ...typography.body, color: colors.textSecondary }}>Loading...</Text>
              </View>
            ) : likers.length === 0 ? (
              <Text style={{ ...typography.body, color: colors.textSecondary, textAlign: 'center', paddingVertical: spacing.xl }}>No likes yet</Text>
            ) : (
              likers.map((liker) => {
                const isFollowing = following.includes(liker.id);
                const name = liker.displayName || liker.username;
                return (
                  <Pressable
                    key={liker.id}
                    onPress={() => onUserPress(liker.id)}
                    style={({ pressed }) => ({
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: spacing.sm,
                      paddingHorizontal: spacing.md,
                      paddingVertical: 10,
                      borderBottomWidth: 1,
                      borderBottomColor: colors.border,
                      backgroundColor: pressed ? colors.muted : 'transparent',
                    })}
                  >
                    <Avatar uri={liker.avatar} name={name} size={32} />
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
                        <Text style={{ ...typography.bodyBold, fontSize: 14, color: colors.foreground }} numberOfLines={1}>
                          {name}
                        </Text>
                        <Text style={{ ...typography.small, color: colors.textSecondary }} numberOfLines={1}>
                          @{liker.username}
                        </Text>
                      </View>
                      {isFollowing && (
                        <Text style={{ ...typography.small, color: colors.textSecondary }}>Following</Text>
                      )}
                    </View>
                  </Pressable>
                );
              })
            )}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
