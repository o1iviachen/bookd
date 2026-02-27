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
  serverTimestamp,
  increment,
  setDoc,
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
  };
}

async function getUserVote(reviewId: string, userId: string): Promise<'up' | 'down' | null> {
  const voteSnap = await getDoc(doc(db, 'reviews', reviewId, 'votes', userId));
  if (!voteSnap.exists()) return null;
  return voteSnap.data().voteType;
}

export async function createReview(
  matchId: number,
  userId: string,
  username: string,
  userAvatar: string | null,
  rating: number,
  text: string,
  tags: string[],
  media: ReviewMedia[] = [],
  isSpoiler: boolean = false
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
  });
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
  return reviews;
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
  return Promise.all(
    snapshot.docs.map(async (d) => {
      const vote = currentUserId ? await getUserVote(d.id, currentUserId) : null;
      return docToReview(d, vote);
    })
  );
}

/** Returns matchIds ranked by number of reviews this week, most logged first. */
export async function getPopularMatchIdsThisWeek(): Promise<{ matchId: number; count: number }[]> {
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);

  const q = query(
    collection(db, 'reviews'),
    where('createdAt', '>=', weekAgo),
    orderBy('createdAt', 'desc'),
    limit(500)
  );
  const snapshot = await getDocs(q);

  const counts = new Map<number, number>();
  for (const d of snapshot.docs) {
    const matchId = d.data().matchId as number;
    if (matchId) counts.set(matchId, (counts.get(matchId) || 0) + 1);
  }

  return [...counts.entries()]
    .map(([matchId, count]) => ({ matchId, count }))
    .sort((a, b) => b.count - a.count);
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
      });
    } else {
      // Switch vote
      await setDoc(voteRef, { voteType });
      await updateDoc(reviewRef, {
        [existingVote === 'up' ? 'upvotes' : 'downvotes']: increment(-1),
        [voteType === 'up' ? 'upvotes' : 'downvotes']: increment(1),
      });
      if (voteType === 'up') shouldNotify = true;
    }
  } else {
    // New vote
    await setDoc(voteRef, { voteType });
    await updateDoc(reviewRef, {
      [voteType === 'up' ? 'upvotes' : 'downvotes']: increment(1),
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
  const votesQuery = query(
    collectionGroup(db, 'votes'),
    where('voteType', '==', 'up')
  );
  const votesSnapshot = await getDocs(votesQuery);
  const reviewIds: string[] = [];
  votesSnapshot.docs.forEach((d) => {
    if (d.id === userId) {
      const reviewId = d.ref.parent.parent?.id;
      if (reviewId) reviewIds.push(reviewId);
    }
  });

  if (reviewIds.length === 0) return [];

  const reviews = await Promise.all(
    reviewIds.map(async (id) => {
      const reviewSnap = await getDoc(doc(db, 'reviews', id));
      if (!reviewSnap.exists()) return null;
      const vote = currentUserId ? await getUserVote(id, currentUserId) : null;
      return docToReview(reviewSnap, vote);
    })
  );
  return reviews.filter(Boolean) as Review[];
}

export async function updateReview(
  reviewId: string,
  data: {
    rating?: number;
    text?: string;
    tags?: string[];
    media?: ReviewMedia[];
    isSpoiler?: boolean;
  }
): Promise<void> {
  const reviewRef = doc(db, 'reviews', reviewId);
  await updateDoc(reviewRef, { ...data, editedAt: serverTimestamp() });
}

export async function deleteReview(reviewId: string): Promise<void> {
  await deleteDoc(doc(db, 'reviews', reviewId));
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
      r.text.toLowerCase().includes(qLower) ||
      r.username.toLowerCase().includes(qLower) ||
      (r.matchLabel && r.matchLabel.toLowerCase().includes(qLower)) ||
      r.tags.some((t) => t.toLowerCase().includes(qLower))
    )
    .slice(0, 20);
}

export async function getAvgRatingsForMatches(matchIds: number[]): Promise<Map<number, number>> {
  const result = new Map<number, number>();
  if (matchIds.length === 0) return result;

  // Firestore 'in' supports max 30 items per query
  const batches: number[][] = [];
  for (let i = 0; i < matchIds.length; i += 30) {
    batches.push(matchIds.slice(i, i + 30));
  }

  for (const batch of batches) {
    const q = query(collection(db, 'reviews'), where('matchId', 'in', batch));
    const snapshot = await getDocs(q);
    const grouped = new Map<number, number[]>();
    snapshot.docs.forEach((d) => {
      const data = d.data();
      const ratings = grouped.get(data.matchId) || [];
      ratings.push(data.rating);
      grouped.set(data.matchId, ratings);
    });
    grouped.forEach((ratings, matchId) => {
      result.set(matchId, ratings.reduce((a, b) => a + b, 0) / ratings.length);
    });
  }

  return result;
}
