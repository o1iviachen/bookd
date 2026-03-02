import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import vision from '@google-cloud/vision';

const visionClient = new vision.ImageAnnotatorClient();

/**
 * Firestore trigger: when a review is created or updated,
 * check any media URLs for inappropriate content via Google Cloud Vision SafeSearch.
 * If flagged, set review.flagged = true so the client can hide it.
 */
export const moderateReviewMedia = functions
  .runWith({ timeoutSeconds: 120, memory: '256MB' })
  .firestore.document('reviews/{reviewId}')
  .onWrite(async (change, context) => {
    const after = change.after.data();
    if (!after) return; // deleted

    // Skip if this update was from moderation itself (only flagged changed, media unchanged)
    const before = change.before.data();
    if (before && JSON.stringify(before.media) === JSON.stringify(after.media)) {
      return;
    }

    const media: { url: string; type: string }[] = after.media || [];
    const imageUrls = media.filter((m) => m.type === 'image').map((m) => m.url);

    if (imageUrls.length === 0) return;

    let flagged = false;

    for (const url of imageUrls) {
      try {
        const [result] = await visionClient.safeSearchDetection(url);
        const safe = result.safeSearchAnnotation;
        if (!safe) continue;

        // Flag if any category is LIKELY or VERY_LIKELY
        const dangerous = ['LIKELY', 'VERY_LIKELY'];
        if (
          dangerous.includes(String(safe.adult || '')) ||
          dangerous.includes(String(safe.violence || '')) ||
          dangerous.includes(String(safe.racy || ''))
        ) {
          flagged = true;
          console.log(`[moderateReviewMedia] Flagged review ${context.params.reviewId}: adult=${safe.adult}, violence=${safe.violence}, racy=${safe.racy}`);
          break;
        }
      } catch (err) {
        console.error(`[moderateReviewMedia] Vision API error for ${url}:`, err);
      }
    }

    // Update the review document with moderation result
    await change.after.ref.update({ flagged });
  });
