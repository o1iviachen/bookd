import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import axios from 'axios';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

// Map in-app notification type to preference key
const TYPE_TO_PREF: Record<string, string> = {
  review_like: 'reviewLikes',
  comment: 'reviewComments',
  comment_like: 'commentLikes',
  list_like: 'listLikes',
  list_comment: 'listComments',
  follow: 'follows',
};

// Build push message content based on notification type
function buildMessage(type: string, senderUsername: string): { title: string; body: string } {
  switch (type) {
    case 'review_like':
      return { title: 'Review Liked', body: `${senderUsername} liked your review` };
    case 'comment':
      return { title: 'New Comment', body: `${senderUsername} commented on your review` };
    case 'comment_like':
      return { title: 'Comment Liked', body: `${senderUsername} liked your comment` };
    case 'list_like':
      return { title: 'List Liked', body: `${senderUsername} liked your list` };
    case 'list_comment':
      return { title: 'List Comment', body: `${senderUsername} commented on your list` };
    case 'follow':
      return { title: 'New Follower', body: `${senderUsername} started following you` };
    default:
      return { title: 'bookd', body: `${senderUsername} interacted with your content` };
  }
}

/**
 * Firestore onCreate trigger: when an in-app notification is created,
 * send a push notification to the recipient via Expo Push API.
 */
export const sendPushNotification = functions
  .runWith({ timeoutSeconds: 30, memory: '128MB' })
  .firestore.document('notifications/{notificationId}')
  .onCreate(async (snap) => {
    const data = snap.data();
    if (!data) return;

    const { recipientId, senderId, senderUsername, type, reviewId, listId } = data;

    // Fetch recipient user doc
    const userDoc = await admin.firestore().collection('users').doc(recipientId).get();
    if (!userDoc.exists) return;

    const userData = userDoc.data()!;
    const token = userData.expoPushToken;
    if (!token) return;

    // Check notification preferences
    const prefs = userData.notificationPreferences || {};
    if (prefs.pushEnabled === false) return;

    const prefKey = TYPE_TO_PREF[type];
    if (prefKey && prefs[prefKey] === false) return;

    // Build and send the push message
    const { title, body } = buildMessage(type, senderUsername || 'Someone');

    try {
      await axios.post(EXPO_PUSH_URL, {
        to: token,
        title,
        body,
        sound: 'default',
        data: { type, senderId, reviewId: reviewId || null, listId: listId || null },
      });
      console.log(`[push] Sent to ${recipientId}: ${type}`);
    } catch (err: any) {
      console.error(`[push] Failed for ${recipientId}:`, err.message);
    }
  });
