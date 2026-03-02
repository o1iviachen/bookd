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
exports.moderateReviewMedia = void 0;
const functions = __importStar(require("firebase-functions"));
const vision_1 = __importDefault(require("@google-cloud/vision"));
const visionClient = new vision_1.default.ImageAnnotatorClient();
/**
 * Firestore trigger: when a review is created or updated,
 * check any media URLs for inappropriate content via Google Cloud Vision SafeSearch.
 * If flagged, set review.flagged = true so the client can hide it.
 */
exports.moderateReviewMedia = functions
    .runWith({ timeoutSeconds: 120, memory: '256MB' })
    .firestore.document('reviews/{reviewId}')
    .onWrite(async (change, context) => {
    const after = change.after.data();
    if (!after)
        return; // deleted
    // Skip if this update was from moderation itself (only flagged changed, media unchanged)
    const before = change.before.data();
    if (before && JSON.stringify(before.media) === JSON.stringify(after.media)) {
        return;
    }
    const media = after.media || [];
    const imageUrls = media.filter((m) => m.type === 'image').map((m) => m.url);
    if (imageUrls.length === 0)
        return;
    let flagged = false;
    for (const url of imageUrls) {
        try {
            const [result] = await visionClient.safeSearchDetection(url);
            const safe = result.safeSearchAnnotation;
            if (!safe)
                continue;
            // Flag if any category is LIKELY or VERY_LIKELY
            const dangerous = ['LIKELY', 'VERY_LIKELY'];
            if (dangerous.includes(String(safe.adult || '')) ||
                dangerous.includes(String(safe.violence || '')) ||
                dangerous.includes(String(safe.racy || ''))) {
                flagged = true;
                console.log(`[moderateReviewMedia] Flagged review ${context.params.reviewId}: adult=${safe.adult}, violence=${safe.violence}, racy=${safe.racy}`);
                break;
            }
        }
        catch (err) {
            console.error(`[moderateReviewMedia] Vision API error for ${url}:`, err);
        }
    }
    // Update the review document with moderation result
    await change.after.ref.update({ flagged });
});
//# sourceMappingURL=moderateMedia.js.map