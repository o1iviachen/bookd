import {
  collection,
  doc,
  addDoc,
  getDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  serverTimestamp,
  arrayUnion,
  arrayRemove,
} from 'firebase/firestore';
import { db } from '../../config/firebase';
import { DiscussionMessage } from '../../types/discussion';

const COLLECTION = 'matchDiscussions';

function docToMessage(docSnap: any): DiscussionMessage {
  const data = docSnap.data();
  return {
    id: docSnap.id,
    matchId: data.matchId,
    userId: data.userId,
    username: data.username || 'Anonymous',
    userAvatar: data.userAvatar || null,
    text: data.text || '',
    likes: data.likes || 0,
    likedBy: data.likedBy || [],
    createdAt: data.createdAt?.toDate() || new Date(),
  };
}

/**
 * Real-time subscription to discussion messages for a match.
 * Returns an unsubscribe function.
 */
export function subscribeToDiscussion(
  matchId: number,
  callback: (messages: DiscussionMessage[]) => void,
): () => void {
  const q = query(
    collection(db, COLLECTION),
    where('matchId', '==', matchId),
    orderBy('createdAt', 'desc'),
    limit(200),
  );
  return onSnapshot(q, (snapshot) => {
    callback(snapshot.docs.map(docToMessage));
  });
}

export async function createDiscussionMessage(
  matchId: number,
  userId: string,
  username: string,
  userAvatar: string | null,
  text: string,
): Promise<string> {
  const ref = await addDoc(collection(db, COLLECTION), {
    matchId,
    userId,
    username,
    userAvatar,
    text,
    likes: 0,
    likedBy: [],
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function toggleDiscussionLike(
  messageId: string,
  userId: string,
): Promise<void> {
  const ref = doc(db, COLLECTION, messageId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;

  const data = snap.data();
  const likedBy: string[] = data.likedBy || [];
  if (likedBy.includes(userId)) {
    await updateDoc(ref, {
      likedBy: arrayRemove(userId),
      likes: Math.max((data.likes || 1) - 1, 0),
    });
  } else {
    await updateDoc(ref, {
      likedBy: arrayUnion(userId),
      likes: (data.likes || 0) + 1,
    });
  }
}

export async function deleteDiscussionMessage(messageId: string): Promise<void> {
  await deleteDoc(doc(db, COLLECTION, messageId));
}
