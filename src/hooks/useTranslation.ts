import { useState, useCallback, useRef } from 'react';
import { getFunctions, httpsCallable } from 'firebase/functions';

interface TranslationResult {
  translatedText: string;
  detectedSourceLang: string;
  detectedSourceLangName: string;
}

// In-memory cache: key = text+targetLang, value = result
const translationCache = new Map<string, TranslationResult>();

export function useTranslation() {
  const [isTranslating, setIsTranslating] = useState(false);
  const abortRef = useRef(false);

  const translate = useCallback(async (text: string, targetLang: string): Promise<TranslationResult | null> => {
    const cacheKey = `${text}::${targetLang}`;
    const cached = translationCache.get(cacheKey);
    if (cached) return cached;

    setIsTranslating(true);
    abortRef.current = false;

    try {
      const fns = getFunctions();
      const translateFn = httpsCallable<{ text: string; targetLang: string }, TranslationResult>(fns, 'translateText');
      const result = await translateFn({ text, targetLang });

      if (abortRef.current) return null;

      const data = result.data;
      translationCache.set(cacheKey, data);
      return data;
    } catch (err) {
      console.error('[useTranslation] Error:', err);
      return null;
    } finally {
      setIsTranslating(false);
    }
  }, []);

  return { translate, isTranslating };
}
