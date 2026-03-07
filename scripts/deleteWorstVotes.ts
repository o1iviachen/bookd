/**
 * One-time cleanup: delete all worstVotes subcollections and fields from matches,
 * and worstPlayerId/worstPlayerName fields from reviews.
 *
 * Usage:
 *   npx ts-node scripts/deleteWorstVotes.ts
 *
 * Prerequisites:
 *   GOOGLE_APPLICATION_CREDENTIALS env var pointing to service account JSON
 */

import * as admin from 'firebase-admin';

const serviceAccount = process.env.GOOGLE_APPLICATION_CREDENTIALS;
if (!serviceAccount) {
  console.log('Tip: Set GOOGLE_APPLICATION_CREDENTIALS env var to your service account JSON path.');
  console.log('Falling back to default credentials...\n');
}

admin.initializeApp({
  credential: serviceAccount
    ? admin.credential.cert(serviceAccount)
    : admin.credential.applicationDefault(),
  projectId: 'bookd-ff19a',
});

const db = admin.firestore();

async function deleteWorstVotes() {
  const matchesRef = db.collection('matches');
  let totalDeleted = 0;
  let matchesChecked = 0;
  let lastDoc: admin.firestore.QueryDocumentSnapshot | undefined;

  // Paginate through all matches
  while (true) {
    let query = matchesRef.orderBy('__name__').limit(500);
    if (lastDoc) query = query.startAfter(lastDoc);

    const snapshot = await query.get();
    if (snapshot.empty) break;

    for (const matchDoc of snapshot.docs) {
      const worstVotesRef = matchDoc.ref.collection('worstVotes');
      const worstVotes = await worstVotesRef.limit(500).get();

      // Remove worstVotes field from the match document itself
      const matchData = matchDoc.data();
      if (matchData.worstVotes) {
        await matchDoc.ref.update({ worstVotes: admin.firestore.FieldValue.delete() });
        console.log(`  Removed worstVotes field from match ${matchDoc.id}`);
      }

      if (!worstVotes.empty) {
        // Delete in batches of 500 (Firestore limit)
        const batch = db.batch();
        worstVotes.docs.forEach((doc) => batch.delete(doc.ref));
        await batch.commit();
        totalDeleted += worstVotes.size;
        console.log(`  Deleted ${worstVotes.size} worstVotes subcollection docs from match ${matchDoc.id}`);

        // If there were exactly 500, there might be more
        let remaining = worstVotes.size === 500;
        while (remaining) {
          const more = await worstVotesRef.limit(500).get();
          if (more.empty) {
            remaining = false;
          } else {
            const batch2 = db.batch();
            more.docs.forEach((doc) => batch2.delete(doc.ref));
            await batch2.commit();
            totalDeleted += more.size;
            console.log(`  Deleted ${more.size} more worstVotes from match ${matchDoc.id}`);
            remaining = more.size === 500;
          }
        }
      }

      matchesChecked++;
    }

    lastDoc = snapshot.docs[snapshot.docs.length - 1];
    console.log(`Checked ${matchesChecked} matches so far...`);
  }

  console.log(`\nMatches done. Deleted ${totalDeleted} worstVote subcollection docs across ${matchesChecked} matches.`);

  // Clean worstPlayerId/worstPlayerName from reviews
  console.log('\nCleaning worstPlayerId/worstPlayerName from reviews...');
  const reviewsRef = db.collection('reviews');
  let reviewsCleaned = 0;
  let lastReview: admin.firestore.QueryDocumentSnapshot | undefined;

  while (true) {
    let rQuery = reviewsRef.orderBy('__name__').limit(500);
    if (lastReview) rQuery = rQuery.startAfter(lastReview);

    const rSnap = await rQuery.get();
    if (rSnap.empty) break;

    const batch = db.batch();
    let batchCount = 0;

    for (const reviewDoc of rSnap.docs) {
      const data = reviewDoc.data();
      if (data.worstPlayerId !== undefined || data.worstPlayerName !== undefined) {
        const updates: Record<string, any> = {};
        if (data.worstPlayerId !== undefined) updates.worstPlayerId = admin.firestore.FieldValue.delete();
        if (data.worstPlayerName !== undefined) updates.worstPlayerName = admin.firestore.FieldValue.delete();
        batch.update(reviewDoc.ref, updates);
        batchCount++;
      }
    }

    if (batchCount > 0) {
      await batch.commit();
      reviewsCleaned += batchCount;
      console.log(`  Cleaned ${batchCount} reviews (${reviewsCleaned} total)`);
    }

    lastReview = rSnap.docs[rSnap.docs.length - 1];
  }

  console.log(`\nAll done. Cleaned ${reviewsCleaned} reviews.`);
}

deleteWorstVotes().catch(console.error);
