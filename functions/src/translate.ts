import * as functions from 'firebase-functions';
import axios from 'axios';

const GOOGLE_TRANSLATE_URL = 'https://translation.googleapis.com/language/translate/v2';

// Language code → display name map
const LANGUAGE_NAMES: Record<string, string> = {
  en: 'English', es: 'Spanish', de: 'German', it: 'Italian',
  fr: 'French', pt: 'Portuguese', ar: 'Arabic', nl: 'Dutch',
  ja: 'Japanese', ko: 'Korean', zh: 'Chinese', ru: 'Russian',
  tr: 'Turkish', pl: 'Polish', sv: 'Swedish', da: 'Danish',
  no: 'Norwegian', fi: 'Finnish', el: 'Greek', cs: 'Czech',
  ro: 'Romanian', hu: 'Hungarian', uk: 'Ukrainian', hi: 'Hindi',
  th: 'Thai', vi: 'Vietnamese', id: 'Indonesian', ms: 'Malay',
};

export const translateText = functions
  .runWith({ timeoutSeconds: 30, memory: '256MB' })
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Must be signed in');
    }

    const { text, targetLang } = data;
    if (!text || !targetLang) {
      throw new functions.https.HttpsError('invalid-argument', 'text and targetLang are required');
    }

    if (text.length > 5000) {
      throw new functions.https.HttpsError('invalid-argument', 'Text too long (max 5000 chars)');
    }

    try {
      const apiKey = process.env.GOOGLE_TRANSLATE_API_KEY;
      if (!apiKey) {
        throw new functions.https.HttpsError('failed-precondition', 'GOOGLE_TRANSLATE_API_KEY not set in functions/.env');
      }

      const response = await axios.post(GOOGLE_TRANSLATE_URL, null, {
        params: {
          q: text,
          target: targetLang,
          format: 'text',
          key: apiKey,
        },
      });

      const translation = response.data?.data?.translations?.[0];
      if (!translation) {
        throw new functions.https.HttpsError('internal', 'No translation returned');
      }

      return {
        translatedText: translation.translatedText,
        detectedSourceLang: translation.detectedSourceLanguage || '',
        detectedSourceLangName: LANGUAGE_NAMES[translation.detectedSourceLanguage] || translation.detectedSourceLanguage || '',
      };
    } catch (err: any) {
      if (err instanceof functions.https.HttpsError) throw err;
      console.error('[translate] Error:', err.response?.data || err.message);
      throw new functions.https.HttpsError('internal', 'Translation failed');
    }
  });
