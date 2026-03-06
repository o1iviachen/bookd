"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.translateText = void 0;
const functions = __importStar(require("firebase-functions"));
const axios_1 = __importDefault(require("axios"));
const GOOGLE_TRANSLATE_URL = 'https://translation.googleapis.com/language/translate/v2';
// Language code → display name map
const LANGUAGE_NAMES = {
    en: 'English', es: 'Spanish', de: 'German', it: 'Italian',
    fr: 'French', pt: 'Portuguese', ar: 'Arabic', nl: 'Dutch',
    ja: 'Japanese', ko: 'Korean', zh: 'Chinese', ru: 'Russian',
    tr: 'Turkish', pl: 'Polish', sv: 'Swedish', da: 'Danish',
    no: 'Norwegian', fi: 'Finnish', el: 'Greek', cs: 'Czech',
    ro: 'Romanian', hu: 'Hungarian', uk: 'Ukrainian', hi: 'Hindi',
    th: 'Thai', vi: 'Vietnamese', id: 'Indonesian', ms: 'Malay',
};
exports.translateText = functions
    .runWith({ timeoutSeconds: 30, memory: '256MB' })
    .https.onCall(async (data, context) => {
    var _a, _b, _c, _d;
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
        const response = await axios_1.default.post(GOOGLE_TRANSLATE_URL, null, {
            params: {
                q: text,
                target: targetLang,
                format: 'text',
                key: apiKey,
            },
        });
        const translation = (_c = (_b = (_a = response.data) === null || _a === void 0 ? void 0 : _a.data) === null || _b === void 0 ? void 0 : _b.translations) === null || _c === void 0 ? void 0 : _c[0];
        if (!translation) {
            throw new functions.https.HttpsError('internal', 'No translation returned');
        }
        return {
            translatedText: translation.translatedText,
            detectedSourceLang: translation.detectedSourceLanguage || '',
            detectedSourceLangName: LANGUAGE_NAMES[translation.detectedSourceLanguage] || translation.detectedSourceLanguage || '',
        };
    }
    catch (err) {
        if (err instanceof functions.https.HttpsError)
            throw err;
        console.error('[translate] Error:', ((_d = err.response) === null || _d === void 0 ? void 0 : _d.data) || err.message);
        throw new functions.https.HttpsError('internal', 'Translation failed');
    }
});
//# sourceMappingURL=translate.js.map