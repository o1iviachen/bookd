import {
  collection,
  collectionGroup,
  doc,
  addDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  serverTimestamp,
  increment,
  setDoc,
  Timestamp,
  arrayUnion,
  arrayRemove,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../../config/firebase';
import { Review, ReviewMedia } from '../../types/review';

function docToReview(docSnap: any, userVote: 'up' | 'down' | null = null): Review {
  const data = docSnap.data();
  return {
    id: docSnap.id,
    matchId: data.matchId,
    userId: data.userId,
    username: data.username || 'Anonymous',
    userAvatar: data.userAvatar || null,
    rating: data.rating,
    text: data.text || '',
    tags: data.tags || [],
    media: data.media || [],
    isSpoiler: data.isSpoiler || false,
    upvotes: data.upvotes || 0,
    downvotes: data.downvotes || 0,
    createdAt: data.createdAt?.toDate() || new Date(),
    editedAt: data.editedAt?.toDate() || null,
    userVote,
    flagged: data.flagged || false,
    motmPlayerId: data.motmPlayerId ?? undefined,
    motmPlayerName: data.motmPlayerName ?? undefined,
  };
}

async function getUserVote(reviewId: string, userId: string): Promise<'up' | 'down' | null> {
  const voteSnap = await getDoc(doc(db, 'reviews', reviewId, 'votes', userId));
  if (!voteSnap.exists()) return null;
  return voteSnap.data().voteType;
}

// ─── MOTM voting ───

export async function voteMotm(
  matchId: number,
  userId: string,
  playerId: number,
): Promise<void> {
  const voteRef = doc(db, 'matches', String(matchId), 'motmVotes', userId);
  const matchRef = doc(db, 'matches', String(matchId));
  const voteSnap = await getDoc(voteRef);

  if (voteSnap.exists()) {
    const existingPlayerId = voteSnap.data().playerId as number;
    if (existingPlayerId === playerId) return; // same vote, no-op
    // Switch vote: decrement old, increment new
    await updateDoc(matchRef, {
      [`motmVotes.${existingPlayerId}`]: increment(-1),
      [`motmVotes.${playerId}`]: increment(1),
    });
    await setDoc(voteRef, { playerId });
  } else {
    // New vote
    await updateDoc(matchRef, {
      [`motmVotes.${playerId}`]: increment(1),
    });
    await setDoc(voteRef, { playerId });
  }
}

export async function removeMotmVote(
  matchId: number,
  userId: string,
): Promise<void> {
  const voteRef = doc(db, 'matches', String(matchId), 'motmVotes', userId);
  const voteSnap = await getDoc(voteRef);
  if (!voteSnap.exists()) return;

  const playerId = voteSnap.data().playerId as number;
  const matchRef = doc(db, 'matches', String(matchId));
  await updateDoc(matchRef, {
    [`motmVotes.${playerId}`]: increment(-1),
  });
  await deleteDoc(voteRef);
}

export async function getUserMotmVote(
  matchId: number,
  userId: string,
): Promise<number | null> {
  const voteRef = doc(db, 'matches', String(matchId), 'motmVotes', userId);
  const voteSnap = await getDoc(voteRef);
  if (!voteSnap.exists()) return null;
  return voteSnap.data().playerId as number;
}

// ─── Rating helpers ───

const ratingKey = (r: number) => String(Math.round(r * 10));

// ─── Reviews ───

export async function createReview(
  matchId: number,
  userId: string,
  username: string,
  userAvatar: string | null,
  rating: number,
  text: string,
  tags: string[],
  media: ReviewMedia[] = [],
  isSpoiler: boolean = false,
  motmPlayerId?: number,
  motmPlayerName?: string,
): Promise<string> {
  const reviewRef = await addDoc(collection(db, 'reviews'), {
    matchId,
    userId,
    username,
    userAvatar,
    rating,
    text,
    tags,
    media,
    isSpoiler,
    upvotes: 0,
    downvotes: 0,
    createdAt: serverTimestamp(),
    ...(motmPlayerId !== undefined && { motmPlayerId }),
    ...(motmPlayerName !== undefined && { motmPlayerName }),
  });
  
  // Update match aggregate stats atomically
  const matchRef = doc(db, 'matches', String(matchId));
  const ratingUpdate: Record<string, any> = { reviewCount: increment(1) };
  if (rating > 0) {
    ratingUpdate.ratingSum = increment(rating);
    ratingUpdate.ratingCount = increment(1);
    ratingUpdate[`ratingBuckets.${ratingKey(rating)}`] = increment(1);
  }
  await updateDoc(matchRef, ratingUpdate);

  if (motmPlayerId !== undefined) {
    await voteMotm(matchId, userId, motmPlayerId);
  }

  return reviewRef.id;
}

export async function getReviewsForMatch(matchId: number, currentUserId?: string): Promise<Review[]> {
  const q = query(
    collection(db, 'reviews'),
    where('matchId', '==', matchId),
  );
  const snapshot = await getDocs(q);
  const reviews = await Promise.all(
    snapshot.docs.map(async (d) => {
      const vote = currentUserId ? await getUserVote(d.id, currentUserId) : null;
      return docToReview(d, vote);
    })
  );
  reviews.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  return reviews.filter((r) => !r.flagged || r.userId === currentUserId);
}

export async function getReviewsForUser(userId: string, currentUserId?: string): Promise<Review[]> {
  const q = query(
    collection(db, 'reviews'),
    where('userId', '==', userId),
  );
  const snapshot = await getDocs(q);
  const reviews = await Promise.all(
    snapshot.docs.map(async (d) => {
      const vote = currentUserId ? await getUserVote(d.id, currentUserId) : null;
      return docToReview(d, vote);
    })
  );
  reviews.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  return reviews;
}

export async function getRecentReviews(currentUserId?: string): Promise<Review[]> {
  const q = query(
    collection(db, 'reviews'),
    orderBy('createdAt', 'desc'),
    limit(30)
  );
  const snapshot = await getDocs(q);
  const reviews = await Promise.all(
    snapshot.docs.map(async (d) => {
      const vote = currentUserId ? await getUserVote(d.id, currentUserId) : null;
      return docToReview(d, vote);
    })
  );
  return reviews.filter((r) => !r.flagged || r.userId === currentUserId);
}

const REVIEWS_PAGE_SIZE = 15;

export interface ReviewsPage {
  reviews: Review[];
  nextCursor: string | null;
}

export async function getRecentReviewsPaginated(
  currentUserId?: string,
  cursor?: string,
): Promise<ReviewsPage> {
  let q;
  if (cursor) {
    q = query(
      collection(db, 'reviews'),
      orderBy('createdAt', 'desc'),
      startAfter(Timestamp.fromDate(new Date(cursor))),
      limit(REVIEWS_PAGE_SIZE + 1),
    );
  } else {
    q = query(
      collection(db, 'reviews'),
      orderBy('createdAt', 'desc'),
      limit(REVIEWS_PAGE_SIZE + 1),
    );
  }

  const snapshot = await getDocs(q);

  const allDocs = snapshot.docs;
  const hasMore = allDocs.length > REVIEWS_PAGE_SIZE;
  const pageDocs = hasMore ? allDocs.slice(0, REVIEWS_PAGE_SIZE) : allDocs;
  const reviews = (await Promise.all(
    pageDocs.map(async (d) => {
      const vote = currentUserId ? await getUserVote(d.id, currentUserId) : null;
      return docToReview(d, vote);
    })
  )).filter((r) => !r.flagged || r.userId === currentUserId);

  const lastDoc = pageDocs[pageDocs.length - 1];
  const nextCursor = hasMore && lastDoc
    ? (lastDoc.data() as any).createdAt.toDate().toISOString()
    : null;

  return { reviews, nextCursor };
}

/** Returns top 20 matchIds from this week ranked by number of logs. */
export async function getPopularMatchIdsThisWeek(): Promise<{ matchId: number; count: number }[]> {
  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

  const q = query(
    collection(db, 'reviews'),
    where('createdAt', '>=', oneWeekAgo),
    orderBy('createdAt', 'desc'),
  );
  const snapshot = await getDocs(q);

  const counts = new Map<number, number>();
  for (const d of snapshot.docs) {
    const matchId = d.data().matchId as number;
    if (matchId) counts.set(matchId, (counts.get(matchId) || 0) + 1);
  }

  return [...counts.entries()]
    .map(([matchId, count]) => ({ matchId, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 50);
}

/** Returns all-time highest-rated matchIds from the pre-computed aggregates document. */
export async function getHighestRatedMatchIds(): Promise<{ matchId: number; avgRating: number; count: number }[]> {
  const snap = await getDoc(doc(db, 'aggregates', 'highestRatedMatchIds'));
  if (!snap.exists()) return [];
  const entries = snap.data()?.entries as { matchId: number; avgRating: number; count: number }[] | undefined;
  return entries ?? [];
}

/** Returns all-time popular matchIds from the pre-computed aggregates document. */
export async function getPopularMatchIdsAllTime(): Promise<{ matchId: number; count: number }[]> {
  const snap = await getDoc(doc(db, 'aggregates', 'popularMatchIds'));
  if (!snap.exists()) return [];
  const entries = snap.data()?.entries as { matchId: number; count: number }[] | undefined;
  return entries ?? [];
}

export async function getReviewById(reviewId: string, currentUserId?: string): Promise<Review | null> {
  const docSnap = await getDoc(doc(db, 'reviews', reviewId));
  if (!docSnap.exists()) return null;
  const vote = currentUserId ? await getUserVote(docSnap.id, currentUserId) : null;
  return docToReview(docSnap, vote);
}

export async function voteOnReview(
  reviewId: string,
  userId: string,
  voteType: 'up' | 'down',
  senderInfo?: { username: string; avatar: string | null }
): Promise<void> {
  const voteRef = doc(db, 'reviews', reviewId, 'votes', userId);
  const reviewRef = doc(db, 'reviews', reviewId);
  const voteSnap = await getDoc(voteRef);

  let shouldNotify = false;

  if (voteSnap.exists()) {
    const existingVote = voteSnap.data().voteType;
    if (existingVote === voteType) {
      // Remove vote
      await deleteDoc(voteRef);
      await updateDoc(reviewRef, {
        [voteType === 'up' ? 'upvotes' : 'downvotes']: increment(-1),
        ...(voteType === 'up' ? { upvotedBy: arrayRemove(userId) } : {}),
      });
    } else {
      // Switch vote
      await setDoc(voteRef, { voteType, userId });
      await updateDoc(reviewRef, {
        [existingVote === 'up' ? 'upvotes' : 'downvotes']: increment(-1),
        [voteType === 'up' ? 'upvotes' : 'downvotes']: increment(1),
        ...(voteType === 'up' ? { upvotedBy: arrayUnion(userId) } : { upvotedBy: arrayRemove(userId) }),
      });
      if (voteType === 'up') shouldNotify = true;
    }
  } else {
    // New vote
    await setDoc(voteRef, { voteType, userId });
    await updateDoc(reviewRef, {
      [voteType === 'up' ? 'upvotes' : 'downvotes']: increment(1),
      ...(voteType === 'up' ? { upvotedBy: arrayUnion(userId) } : {}),
    });
    if (voteType === 'up') shouldNotify = true;
  }

  if (shouldNotify && senderInfo) {
    const reviewSnap = await getDoc(reviewRef);
    const reviewUserId = reviewSnap.data()?.userId;
    if (reviewUserId) {
      const { createNotification } = await import('./notifications');
      await createNotification({
        recipientId: reviewUserId,
        senderId: userId,
        senderUsername: senderInfo.username,
        senderAvatar: senderInfo.avatar,
        type: 'review_like',
        reviewId,
      });
    }
  }
}

export async function getReviewUpvoterIds(reviewId: string): Promise<string[]> {
  const votesRef = collection(db, 'reviews', reviewId, 'votes');
  const q = query(votesRef, where('voteType', '==', 'up'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => d.id);
}

export async function getReviewsUpvotedByUser(userId: string, currentUserId?: string): Promise<Review[]> {
  const q = query(
    collection(db, 'reviews'),
    where('upvotedBy', 'array-contains', userId)
  );
  const snapshot = await getDocs(q);
  const reviews = await Promise.all(
    snapshot.docs.map(async (d) => {
      const vote = currentUserId ? await getUserVote(d.id, currentUserId) : null;
      return docToReview(d, vote);
    })
  );
  reviews.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  return reviews;
}

export async function updateReview(
  reviewId: string,
  data: {
    rating?: number;
    text?: string;
    tags?: string[];
    media?: ReviewMedia[];
    isSpoiler?: boolean;
    motmPlayerId?: number | null;
    motmPlayerName?: string | null;
  },
  matchId?: number,
  userId?: string,
  oldRating?: number,
): Promise<void> {
  const reviewRef = doc(db, 'reviews', reviewId);
  await updateDoc(reviewRef, { ...data, editedAt: serverTimestamp() });

  // Update match rating stats if rating changed
  if (data.rating !== undefined && oldRating !== undefined && matchId && data.rating !== oldRating) {
    const newRating = data.rating;
    const matchRef = doc(db, 'matches', String(matchId));
    const ratingUpdate: Record<string, any> = {};

    if (newRating > 0 && oldRating > 0) {
      // Both rated — adjust sum by delta, swap buckets
      ratingUpdate.ratingSum = increment(newRating - oldRating);
      ratingUpdate[`ratingBuckets.${ratingKey(oldRating)}`] = increment(-1);
      ratingUpdate[`ratingBuckets.${ratingKey(newRating)}`] = increment(1);
    } else if (newRating > 0 && oldRating === 0) {
      // Unrated → rated
      ratingUpdate.ratingSum = increment(newRating);
      ratingUpdate.ratingCount = increment(1);
      ratingUpdate[`ratingBuckets.${ratingKey(newRating)}`] = increment(1);
    } else if (newRating === 0 && oldRating > 0) {
      // Rated → unrated
      ratingUpdate.ratingSum = increment(-oldRating);
      ratingUpdate.ratingCount = increment(-1);
      ratingUpdate[`ratingBuckets.${ratingKey(oldRating)}`] = increment(-1);
    }

    if (Object.keys(ratingUpdate).length > 0) {
      await updateDoc(matchRef, ratingUpdate);
    }
  }

  // Sync MOTM vote if motmPlayerId changed and we have match/user context
  if (data.motmPlayerId !== undefined && matchId && userId) {
    if (data.motmPlayerId === null) {
      await removeMotmVote(matchId, userId);
    } else {
      await voteMotm(matchId, userId, data.motmPlayerId);
    }
  }
}

export async function deleteReview(reviewId: string): Promise<void> {
  const reviewSnap = await getDoc(doc(db, 'reviews', reviewId));
  if (reviewSnap.exists()) {
    const data = reviewSnap.data();
    const matchId = data.matchId as number;
    const userId = data.userId as string;
    const rating = (data.rating ?? 0) as number;
    const motmPlayerId = data.motmPlayerId as number | undefined;

    await deleteDoc(doc(db, 'reviews', reviewId));

    // Decrement match rating stats
    if (matchId) {
      const matchRef = doc(db, 'matches', String(matchId));
      const ratingUpdate: Record<string, any> = { reviewCount: increment(-1) };
      if (rating > 0) {
        ratingUpdate.ratingSum = increment(-rating);
        ratingUpdate.ratingCount = increment(-1);
        ratingUpdate[`ratingBuckets.${ratingKey(rating)}`] = increment(-1);
      }
      await updateDoc(matchRef, ratingUpdate);
    }

    // If this review had a MOTM pick, check if it matches the user's current vote
    if (motmPlayerId && matchId && userId) {
      const currentVote = await getUserMotmVote(matchId, userId);
      if (currentVote === motmPlayerId) {
        await removeMotmVote(matchId, userId);
      }
    }
  } else {
    await deleteDoc(doc(db, 'reviews', reviewId));
  }
}

// Search reviews by text content, username, or matchLabel
// Uses client-side filtering since Firestore has no text search.
// Cached via React Query staleTime so repeated queries are instant.
let _reviewsCacheData: Review[] | null = null;
let _reviewsCacheTs = 0;
const REVIEWS_CACHE_TTL = 3 * 60 * 1000; // 3 minutes

export async function searchReviews(queryStr: string): Promise<Review[]> {
  if (queryStr.length < 3) return [];
  // Fetch recent reviews once & cache in-memory to avoid re-fetching on every keystroke
  if (!_reviewsCacheData || Date.now() - _reviewsCacheTs > REVIEWS_CACHE_TTL) {
    const q = query(
      collection(db, 'reviews'),
      orderBy('createdAt', 'desc'),
      limit(100)
    );
    const snapshot = await getDocs(q);
    _reviewsCacheData = snapshot.docs.map((d) => docToReview(d));
    _reviewsCacheTs = Date.now();
  }
  const qLower = queryStr.toLowerCase();
  return _reviewsCacheData
    .filter((r) =>
      !r.flagged &&
      (r.text.toLowerCase().includes(qLower) ||
      r.username.toLowerCase().includes(qLower) ||
      (r.matchLabel && r.matchLabel.toLowerCase().includes(qLower)) ||
      r.tags.some((t) => t.toLowerCase().includes(qLower)))
    )
    .slice(0, 20);
}


export async function getReviewsForMatches(matchIds: number[]): Promise<Review[]> {
  if (matchIds.length === 0) return [];

  // Use individual equality queries per match — same pattern as getReviewsForMatch,
  // which is known to work reliably with the auto single-field index on matchId.
  const results = await Promise.allSettled(
    matchIds.map((id) =>
      getDocs(query(collection(db, 'reviews'), where('matchId', '==', id)))
    )
  );

  const reviews: Review[] = [];
  const seen = new Set<string>();
  for (const result of results) {
    if (result.status === 'rejected') {
      console.error('[getReviewsForMatches] query failed:', result.reason);
      continue;
    }
    for (const d of result.value.docs) {
      if (!seen.has(d.id)) {
        seen.add(d.id);
        reviews.push(docToReview(d));
      }
    }
  }
  return reviews.filter((r) => !r.flagged);
}

export async function renameTagOnReviews(userId: string, oldTag: string, newTag: string): Promise<void> {
  const q = query(collection(db, 'reviews'), where('userId', '==', userId));
  const snapshot = await getDocs(q);
  const docsWithTag = snapshot.docs.filter((d) => {
    const tags: string[] = d.data().tags || [];
    return tags.includes(oldTag);
  });
  if (docsWithTag.length === 0) return;

  for (let i = 0; i < docsWithTag.length; i += 500) {
    const batch = writeBatch(db);
    for (const d of docsWithTag.slice(i, i + 500)) {
      batch.update(d.ref, {
        tags: arrayRemove(oldTag),
      });
    }
    await batch.commit();
    const batch2 = writeBatch(db);
    for (const d of docsWithTag.slice(i, i + 500)) {
      batch2.update(d.ref, {
        tags: arrayUnion(newTag),
      });
    }
    await batch2.commit();
  }
}

export async function removeTagFromReviews(userId: string, tag: string): Promise<void> {
  const q = query(collection(db, 'reviews'), where('userId', '==', userId));
  const snapshot = await getDocs(q);
  const docsWithTag = snapshot.docs.filter((d) => {
    const tags: string[] = d.data().tags || [];
    return tags.includes(tag);
  });
  if (docsWithTag.length === 0) return;

  for (let i = 0; i < docsWithTag.length; i += 500) {
    const batch = writeBatch(db);
    for (const d of docsWithTag.slice(i, i + 500)) {
      batch.update(d.ref, {
        tags: arrayRemove(tag),
      });
    }
    await batch.commit();
  }
}
