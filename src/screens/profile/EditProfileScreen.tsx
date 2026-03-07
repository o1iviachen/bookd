import React, { useState, useEffect } from 'react';
import { View, Text, Pressable, KeyboardAvoidingView, Platform, Alert, ScrollView, ActivityIndicator, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { useUserProfile } from '../../hooks/useUser';
import { updateUserProfile } from '../../services/firestore/users';
import { uploadAvatar, uploadHeaderImage } from '../../services/storage';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Avatar } from '../../components/ui/Avatar';
import { TextInput } from '../../components/ui/TextInput';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { ProfileStackParamList } from '../../types/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { isUsernameClean, isDisplayNameClean } from '../../utils/moderation';
import { isUsernameReserved } from '../../utils/reservedUsernames';
import { useTranslation } from 'react-i18next';

type Props = NativeStackScreenProps<ProfileStackParamList, 'EditProfile'>;

export function EditProfileScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const { theme, isDark } = useTheme();
  const { colors, spacing, typography, borderRadius } = theme;
  const { user } = useAuth();
  const { data: profile, isLoading } = useUserProfile(user?.uid || '');
  const queryClient = useQueryClient();

  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [location, setLocation] = useState('');
  const [website, setWebsite] = useState('');
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [avatarChanged, setAvatarChanged] = useState(false);
  const [headerImageUri, setHeaderImageUri] = useState<string | null>(null);
  const [headerImageChanged, setHeaderImageChanged] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [saving, setSaving] = useState(false);
  const { width: screenWidth } = useWindowDimensions();

  useEffect(() => {
    if (profile) {
      setUsername(profile.username);
      setDisplayName(profile.displayName);
      setBio(profile.bio);
      setLocation(profile.location || '');
      setWebsite(profile.website || '');
      setAvatarUri(profile.avatar || null);
      setHeaderImageUri(profile.headerImage || null);
    }
  }, [profile]);

  const handlePickHeaderImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setHeaderImageUri(result.assets[0].uri);
      setHeaderImageChanged(true);
    }
  };

  const handleRemoveHeaderImage = () => {
    setHeaderImageUri(null);
    setHeaderImageChanged(true);
  };

  const handlePickAvatar = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setAvatarUri(result.assets[0].uri);
      setAvatarChanged(true);
    }
  };

  const handleSave = async () => {
    if (!user) return;
    if (!username.trim() || username.trim().length < 3) {
      Alert.alert(t('common.error'), t('auth.usernameMustBeAtLeast3'));
      return;
    }
    if (!isUsernameClean(username.trim())) {
      Alert.alert(t('common.error'), t('auth.usernameNotAllowed'));
      return;
    }
    if (isUsernameReserved(username.trim())) {
      Alert.alert(t('common.error'), t('auth.usernameReserved'));
      return;
    }
    if (!isDisplayNameClean(displayName.trim())) {
      Alert.alert(t('common.error'), t('review.contentWarning'));
      return;
    }
    setSaving(true);
    try {
      let avatarUrl = avatarUri;
      if (avatarChanged && avatarUri) {
        setUploadingAvatar(true);
        avatarUrl = await uploadAvatar(user.uid, avatarUri);
        setUploadingAvatar(false);
      }
      let headerImageUrl = headerImageUri;
      if (headerImageChanged) {
        if (headerImageUri && !headerImageUri.startsWith('http')) {
          headerImageUrl = await uploadHeaderImage(`headers/users/${user.uid}.jpg`, headerImageUri);
        }
      }
      await updateUserProfile(user.uid, {
        username: username.trim().toLowerCase(),
        displayName,
        bio,
        location,
        website,
        avatar: avatarUrl,
        headerImage: headerImageChanged ? headerImageUrl : undefined,
      });
      queryClient.invalidateQueries({ queryKey: ['user', user.uid] });
      navigation.goBack();
    } catch (err: any) {
      console.error('Profile update error:', err);
      Alert.alert(t('common.error'), err?.message || t('common.error'));
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) return <LoadingSpinner />;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', padding: spacing.md }}>
          <Pressable onPress={() => navigation.goBack()}>
            <Ionicons name="close" size={24} color={colors.foreground} />
          </Pressable>
          <Text style={{ ...typography.h4, color: colors.foreground, flex: 1, textAlign: 'center' }}>
            {t('profile.editProfile')}
          </Text>
          <Pressable onPress={handleSave} disabled={saving} style={{ opacity: saving ? 0.5 : 1 }}>
            {saving ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Text style={{ ...typography.body, color: colors.primary, fontWeight: '600' }}>{t('common.save')}</Text>
            )}
          </Pressable>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} indicatorStyle={isDark ? 'white' : 'default'} contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
          {/* Header image picker */}
          <Pressable onPress={handlePickHeaderImage} style={{ width: '100%', height: Math.round(screenWidth * 0.5), overflow: 'hidden', justifyContent: 'center', alignItems: 'center' }}>
            {headerImageUri ? (
              <>
                <Image source={{ uri: headerImageUri }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
                <LinearGradient
                  colors={['transparent', colors.background]}
                  style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 80 }}
                />
                <Pressable
                  onPress={handleRemoveHeaderImage}
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
                <Text style={{ ...typography.caption, color: colors.textSecondary, marginTop: 4 }}>{t('profile.addHeaderImage')}</Text>
              </LinearGradient>
            )}
          </Pressable>

          {/* Avatar picker — overlaps header image */}
          <Pressable onPress={handlePickAvatar} style={{ alignSelf: 'center', marginTop: -48, marginBottom: spacing.lg }}>
            <Avatar uri={avatarUri} name={displayName || 'User'} size={96} />
            <View
              style={{
                position: 'absolute',
                bottom: 0,
                right: 0,
                backgroundColor: colors.primary,
                borderRadius: 14,
                width: 28,
                height: 28,
                alignItems: 'center',
                justifyContent: 'center',
                borderWidth: 2,
                borderColor: colors.background,
              }}
            >
              {uploadingAvatar ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Ionicons name="camera" size={14} color="#fff" />
              )}
            </View>
          </Pressable>

          <View style={{ paddingHorizontal: spacing.md }}>
          <TextInput
            label={t('auth.username')}
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
            placeholder="your_username"
          />
          <TextInput label={t('profile.displayName')} value={displayName} onChangeText={setDisplayName} placeholder={t('profile.displayNamePlaceholder')} />
          <TextInput label={t('profile.bio')} value={bio} onChangeText={setBio} multiline numberOfLines={3} placeholder={t('profile.bioPlaceholder')} />
          <TextInput
            label={t('profile.location')}
            value={location}
            onChangeText={setLocation}
            placeholder={t('profile.locationPlaceholder')}
            autoCapitalize="words"
          />
          <TextInput
            label={t('profile.website')}
            value={website}
            onChangeText={setWebsite}
            placeholder={t('profile.websitePlaceholder')}
            autoCapitalize="none"
            keyboardType="url"
          />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

    </SafeAreaView>
  );
}
