import React from 'react';
import { View, Text, ScrollView, Pressable, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';

export function SettingsScreen() {
  const { theme, toggleTheme, isDark } = useTheme();
  const { colors, spacing, typography, borderRadius } = theme;
  const navigation = useNavigation();
  const { signOut } = useAuth();

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: () => signOut() },
    ]);
  };

  const sections: { title: string; items: { label: string; icon: keyof typeof Ionicons.glyphMap; onPress?: () => void; right?: React.ReactNode }[] }[] = [
    {
      title: 'Appearance',
      items: [
        {
          label: isDark ? 'Dark Mode' : 'Light Mode',
          icon: isDark ? 'moon' : 'sunny-outline',
          onPress: toggleTheme,
          right: (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
              <Text style={{ ...typography.caption, color: colors.textSecondary }}>{isDark ? 'On' : 'Off'}</Text>
              <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
            </View>
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
        { label: 'Notifications', icon: 'notifications-outline' },
        { label: 'Privacy', icon: 'lock-closed-outline' },
      ],
    },
    {
      title: 'About',
      items: [
        { label: 'Help and Support', icon: 'help-circle-outline' },
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
      </ScrollView>
    </SafeAreaView>
  );
}
