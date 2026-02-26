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
  media: ReviewMedia[] = []
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
  }
): Promise<void> {
  const reviewRef = doc(db, 'reviews', reviewId);
  await updateDoc(reviewRef, { ...data, editedAt: serverTimestamp() });
}

export async function deleteReview(reviewId: string): Promise<void> {
  await deleteDoc(doc(db, 'reviews', reviewId));
}

// Search reviews by text content, username, or matchLabel
export async function searchReviews(queryStr: string): Promise<Review[]> {
  if (queryStr.length < 2) return [];
  // Fetch recent reviews and filter client-side (Firestore has no text search)
  const q = query(
    collection(db, 'reviews'),
    orderBy('createdAt', 'desc'),
    limit(100)
  );
  const snapshot = await getDocs(q);
  const qLower = queryStr.toLowerCase();
  return snapshot.docs
    .map((d) => docToReview(d))
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
