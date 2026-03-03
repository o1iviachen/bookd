import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable, Alert, Switch, Modal, TextInput, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { reauthenticateWithCredential, EmailAuthProvider } from 'firebase/auth';
import { auth } from '../../config/firebase';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';

export function SettingsScreen() {
  const { theme, toggleTheme, isDark } = useTheme();
  const { colors, spacing, typography, borderRadius } = theme;
  const navigation = useNavigation();
  const { signOut, user } = useAuth();
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleting, setDeleting] = useState(false);

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: () => signOut() },
    ]);
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'This will permanently delete your account, all your reviews, comments, and lists. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Continue',
          style: 'destructive',
          onPress: () => {
            setDeletePassword('');
            setShowDeleteModal(true);
          },
        },
      ]
    );
  };

  const confirmDelete = async () => {
    if (!deletePassword || !user?.email) return;
    setDeleting(true);
    try {
      const credential = EmailAuthProvider.credential(user.email, deletePassword);
      await reauthenticateWithCredential(auth.currentUser!, credential);
      const fns = getFunctions();
      const deleteAccountFn = httpsCallable(fns, 'deleteAccount');
      await deleteAccountFn({});
      await signOut();
    } catch (err: any) {
      const isWrongPassword = err?.code === 'auth/wrong-password' || err?.code === 'auth/invalid-credential';
      Alert.alert('Error', isWrongPassword ? 'Incorrect password. Please try again.' : 'Failed to delete account. Please try again.');
    } finally {
      setDeleting(false);
    }
  };

  const sections: { title: string; items: { label: string; icon: keyof typeof Ionicons.glyphMap; onPress?: () => void; right?: React.ReactNode }[] }[] = [
    {
      title: 'Appearance',
      items: [
        {
          label: 'Dark Mode',
          icon: 'moon',
          right: (
            <Switch
              value={isDark}
              onValueChange={toggleTheme}
              trackColor={{ false: colors.muted, true: colors.primary }}
              thumbColor="#fff"
            />
          ),
        },
      ],
    },
    {
      title: 'Who are ya?',
      items: [
        { label: 'Favourite Teams', icon: 'shield-outline', onPress: () => navigation.navigate('FavouriteTeams' as never) },
        { label: 'Favourite Matches', icon: 'football-outline', onPress: () => navigation.navigate('FavouriteMatches' as never) },
      ],
    },
    {
      title: 'Following',
      items: [
        { label: 'Teams', icon: 'shield-outline', onPress: () => navigation.navigate('FollowedTeams' as never) },
        { label: 'Leagues', icon: 'trophy-outline', onPress: () => navigation.navigate('FollowedLeagues' as never) },
      ],
    },
    {
      title: 'Account',
      items: [
        { label: 'Edit Profile', icon: 'person-outline', onPress: () => navigation.navigate('EditProfile' as never) },
        { label: 'Notifications', icon: 'notifications-outline', onPress: () => navigation.navigate('NotificationSettings' as never) },
      ],
    },
    {
      title: 'About',
      items: [
        { label: 'Privacy Policy', icon: 'lock-closed-outline' },
        { label: 'Terms of Service', icon: 'document-text-outline' },
      ],
    },
  ];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border }}>
        <Pressable onPress={() => navigation.goBack()} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Ionicons name="chevron-back" size={22} color={colors.primary} />
          <Text style={{ color: colors.primary, fontSize: 16 }}>Back</Text>
        </Pressable>
        <Text style={{ ...typography.bodyBold, color: colors.foreground, fontSize: 17 }}>Settings</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView indicatorStyle={isDark ? 'white' : 'default'} contentContainerStyle={{ paddingBottom: 40 }}>
        {sections.map((section) => (
          <View key={section.title} style={{ marginTop: spacing.lg, paddingHorizontal: spacing.md }}>
            <Text style={{ fontSize: 11, fontWeight: '600', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 1, marginBottom: spacing.sm, marginLeft: spacing.xs }}>
              {section.title}
            </Text>
            <View style={{ backgroundColor: colors.card, borderRadius: borderRadius.md, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' }}>
              {section.items.map((item, i) => (
                <Pressable
                  key={item.label}
                  onPress={item.onPress}
                  style={({ pressed }) => ({
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    paddingVertical: spacing.md,
                    paddingHorizontal: spacing.md,
                    backgroundColor: pressed ? colors.accent : 'transparent',
                    borderTopWidth: i > 0 ? 1 : 0,
                    borderTopColor: colors.border,
                  })}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                    <Ionicons name={item.icon} size={20} color={colors.foreground} />
                    <Text style={{ ...typography.body, color: colors.foreground }}>{item.label}</Text>
                  </View>
                  {item.right || <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />}
                </Pressable>
              ))}
            </View>
          </View>
        ))}

        {/* Sign Out */}
        <View style={{ marginTop: spacing.xl, paddingHorizontal: spacing.md }}>
          <Pressable
            onPress={handleSignOut}
            style={({ pressed }) => ({
              backgroundColor: pressed ? colors.accent : colors.card,
              borderRadius: borderRadius.md,
              borderWidth: 1,
              borderColor: colors.border,
              paddingVertical: spacing.md,
              alignItems: 'center',
            })}
          >
            <Text style={{ ...typography.bodyBold, color: '#ef4444', fontSize: 15 }}>Sign Out</Text>
          </Pressable>
        </View>

        {/* Delete Account */}
        <View style={{ marginTop: spacing.sm, paddingHorizontal: spacing.md, marginBottom: spacing.md }}>
          <Pressable
            onPress={handleDeleteAccount}
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              backgroundColor: pressed ? colors.accent : 'transparent',
              borderRadius: borderRadius.md,
              paddingVertical: spacing.sm,
            })}
          >
            <Ionicons name="trash-outline" size={14} color={colors.textSecondary} />
            <Text style={{ ...typography.small, color: colors.textSecondary, fontSize: 13 }}>Delete Account</Text>
          </Pressable>
        </View>
      </ScrollView>

      {/* Delete Account Password Modal */}
      <Modal visible={showDeleteModal} transparent animationType="slide" onRequestClose={() => setShowDeleteModal(false)}>
        <Pressable
          onPress={() => setShowDeleteModal(false)}
          style={{ flex: 1, backgroundColor: 'transparent', justifyContent: 'flex-end' }}
        >
          <Pressable
            onPress={(e) => e.stopPropagation()}
            style={{
              backgroundColor: colors.background,
              borderTopLeftRadius: borderRadius.lg,
              borderTopRightRadius: borderRadius.lg,
              paddingTop: spacing.md,
              paddingBottom: spacing.xl + 16,
              paddingHorizontal: spacing.md,
            }}
          >
            <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: 'center', marginBottom: spacing.md }} />

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.xs }}>
              <Ionicons name="trash-outline" size={20} color="#ef4444" />
              <Text style={{ ...typography.bodyBold, color: colors.foreground, fontSize: 17 }}>Delete Account</Text>
            </View>
            <Text style={{ ...typography.small, color: colors.textSecondary, marginBottom: spacing.lg }}>
              Enter your password to permanently delete your account and all data.
            </Text>

            <TextInput
              value={deletePassword}
              onChangeText={setDeletePassword}
              placeholder="Password"
              placeholderTextColor={colors.textSecondary}
              secureTextEntry
              autoFocus
              style={{
                backgroundColor: colors.muted,
                borderRadius: borderRadius.md,
                padding: spacing.md,
                color: colors.foreground,
                ...typography.body,
                marginBottom: spacing.lg,
              }}
            />

            <Pressable
              onPress={confirmDelete}
              disabled={!deletePassword || deleting}
              style={({ pressed }) => ({
                backgroundColor: deletePassword ? '#ef4444' : colors.muted,
                borderRadius: borderRadius.md,
                paddingVertical: spacing.md,
                alignItems: 'center',
                opacity: pressed ? 0.8 : 1,
              })}
            >
              {deleting ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={{ ...typography.bodyBold, color: deletePassword ? '#fff' : colors.textSecondary }}>
                  Delete Account
                </Text>
              )}
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}
