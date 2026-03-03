import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

const db = admin.firestore();

/**
 * Callable function: deletes all of a user's data and their Firebase Auth account.
 * The client must call signOut() after this succeeds.
 */
export const deleteAccount = functions.https.onCall(async (_data, context) => {
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
