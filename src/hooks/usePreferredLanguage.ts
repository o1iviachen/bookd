import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getLocales } from 'expo-localization';
import { useAuth } from '../context/AuthContext';
import { useUserProfile } from './useUser';
import { updateUserProfile } from '../services/firestore/users';
import { useQueryClient } from '@tanstack/react-query';
import i18next from 'i18next';

const STORAGE_KEY = 'bookd_preferred_language';

export const SUPPORTED_LANGUAGES: { code: string; label: string }[] = [
  { code: 'en', label: 'English' },
  { code: 'es', label: 'Español' },
  { code: 'de', label: 'Deutsch' },
  { code: 'it', label: 'Italiano' },
  { code: 'fr', label: 'Français' },
  { code: 'pt', label: 'Português' },
];

function getDeviceLanguage(): string {
  const locales = getLocales();
  const code = locales[0]?.languageCode || 'en';
  return code;
}

export function usePreferredLanguage() {
  const { user } = useAuth();
  const { data: profile } = useUserProfile(user?.uid || '');
  const queryClient = useQueryClient();
  const [language, setLanguageState] = useState<string>('');
  const [loaded, setLoaded] = useState(false);

  // Load from AsyncStorage on mount, initialize from device locale if empty
  useEffect(() => {
    (async () => {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) {
        setLanguageState(stored);
        if (i18next.language !== stored) i18next.changeLanguage(stored);
      } else {
        // First launch — use device locale
        const deviceLang = getDeviceLanguage();
        setLanguageState(deviceLang);
        await AsyncStorage.setItem(STORAGE_KEY, deviceLang);
        // Save to Firestore if signed in
        if (user?.uid) {
          updateUserProfile(user.uid, { preferredLanguage: deviceLang }).catch(() => {});
        }
      }
      setLoaded(true);
    })();
  }, [user?.uid]);

  // Sync from Firestore profile if it has a value and local doesn't match
  useEffect(() => {
    if (profile?.preferredLanguage && loaded) {
      const firestoreVal = profile.preferredLanguage;
      AsyncStorage.getItem(STORAGE_KEY).then((local) => {
        // Firestore is source of truth if user changed on another device
        if (local && local !== firestoreVal) {
          // Keep local unless Firestore was explicitly set
        }
      });
    }
  }, [profile?.preferredLanguage, loaded]);

  const setLanguage = useCallback(async (lang: string) => {
    setLanguageState(lang);
    i18next.changeLanguage(lang);
    await AsyncStorage.setItem(STORAGE_KEY, lang);
    if (user?.uid) {
      await updateUserProfile(user.uid, { preferredLanguage: lang });
      queryClient.invalidateQueries({ queryKey: ['user', user.uid] });
    }
  }, [user?.uid, queryClient]);

  return { language: language || getDeviceLanguage(), setLanguage, loaded };
}
