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
exports.sendPushNotification = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const axios_1 = __importDefault(require("axios"));
const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
// Map in-app notification type to preference key
const TYPE_TO_PREF = {
    review_like: 'reviewLikes',
    comment: 'reviewComments',
    comment_like: 'commentLikes',
    list_like: 'listLikes',
    list_comment: 'listComments',
    follow: 'follows',
};
// Build push message content based on notification type
function buildMessage(type, senderUsername) {
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
exports.sendPushNotification = functions
    .runWith({ timeoutSeconds: 30, memory: '128MB' })
    .firestore.document('notifications/{notificationId}')
    .onCreate(async (snap) => {
    const data = snap.data();
    if (!data)
        return;
    const { recipientId, senderId, senderUsername, type, reviewId, listId } = data;
    // Fetch recipient user doc
    const userDoc = await admin.firestore().collection('users').doc(recipientId).get();
    if (!userDoc.exists)
        return;
    const userData = userDoc.data();
    const token = userData.expoPushToken;
    if (!token)
        return;
    // Check notification preferences
    const prefs = userData.notificationPreferences || {};
    if (prefs.pushEnabled === false)
        return;
    const prefKey = TYPE_TO_PREF[type];
    if (prefKey && prefs[prefKey] === false)
        return;
    // Build and send the push message
    const { title, body } = buildMessage(type, senderUsername || 'Someone');
    try {
        await axios_1.default.post(EXPO_PUSH_URL, {
            to: token,
            title,
            body,
            sound: 'default',
            data: { type, senderId, reviewId: reviewId || null, listId: listId || null },
        });
        console.log(`[push] Sent to ${recipientId}: ${type}`);
    }
    catch (err) {
        console.error(`[push] Failed for ${recipientId}:`, err.message);
    }
});
//# sourceMappingURL=notifications.js.map