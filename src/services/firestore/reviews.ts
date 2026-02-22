import {
  collection,
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

function docToReview(docSnap: any): Review {
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
    userVote: null,
  };
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

export async function getReviewsForMatch(matchId: number): Promise<Review[]> {
  const q = query(
    collection(db, 'reviews'),
    where('matchId', '==', matchId),
    orderBy('createdAt', 'desc'),
    limit(50)
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map(docToReview);
}

export async function getReviewsForUser(userId: string): Promise<Review[]> {
  const q = query(
    collection(db, 'reviews'),
    where('userId', '==', userId),
    orderBy('createdAt', 'desc'),
    limit(50)
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map(docToReview);
}

export async function getRecentReviews(): Promise<Review[]> {
  const q = query(
    collection(db, 'reviews'),
    orderBy('createdAt', 'desc'),
    limit(30)
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map(docToReview);
}

export async function getReviewById(reviewId: string): Promise<Review | null> {
  const docSnap = await getDoc(doc(db, 'reviews', reviewId));
  if (!docSnap.exists()) return null;
  return docToReview(docSnap);
}

export async function voteOnReview(
  reviewId: string,
  userId: string,
  voteType: 'up' | 'down'
): Promise<void> {
  const voteRef = doc(db, 'reviews', reviewId, 'votes', userId);
  const reviewRef = doc(db, 'reviews', reviewId);
  const voteSnap = await getDoc(voteRef);

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
    }
  } else {
    // New vote
    await setDoc(voteRef, { voteType });
    await updateDoc(reviewRef, {
      [voteType === 'up' ? 'upvotes' : 'downvotes']: increment(1),
    });
  }
}

export async function deleteReview(reviewId: string): Promise<void> {
  await deleteDoc(doc(db, 'reviews', reviewId));
}
