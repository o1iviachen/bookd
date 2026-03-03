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
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteAccount = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const db = admin.firestore();
/**
 * Callable function: deletes all of a user's data and their Firebase Auth account.
 * The client must call signOut() after this succeeds.
 */
exports.deleteAccount = functions.https.onCall(async (_data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Must be logged in to delete account');
    }
    const uid = context.auth.uid;
    // Delete reviews (in batches of 500)
    const reviews = await db.collection('reviews').where('userId', '==', uid).get();
    if (!reviews.empty) {
        const batch = db.batch();
        reviews.docs.forEach((doc) => batch.delete(doc.ref));
        await batch.commit();
    }
    // Delete comments
    const comments = await db.collection('comments').where('userId', '==', uid).get();
    if (!comments.empty) {
        const batch = db.batch();
        comments.docs.forEach((doc) => batch.delete(doc.ref));
        await batch.commit();
    }
    // Delete lists
    const lists = await db.collection('lists').where('userId', '==', uid).get();
    if (!lists.empty) {
        const batch = db.batch();
        lists.docs.forEach((doc) => batch.delete(doc.ref));
        await batch.commit();
    }
    // Delete notifications
    const notifs = await db.collection('notifications').where('recipientId', '==', uid).get();
    if (!notifs.empty) {
        const batch = db.batch();
        notifs.docs.forEach((doc) => batch.delete(doc.ref));
        await batch.commit();
    }
    // Delete user Firestore profile
    await db.collection('users').doc(uid).delete();
    // Delete Firebase Auth user (must be last)
    await admin.auth().deleteUser(uid);
    return { success: true };
});
//# sourceMappingURL=user.js.map