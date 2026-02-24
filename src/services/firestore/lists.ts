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
  arrayUnion,
  arrayRemove,
} from 'firebase/firestore';
import { db } from '../../config/firebase';
import { MatchList } from '../../types/list';
import { createNotification } from './notifications';

function docToList(docSnap: any): MatchList {
  const data = docSnap.data();
  return {
    id: docSnap.id,
    userId: data.userId,
    username: data.username || 'Anonymous',
    name: data.name,
    description: data.description || '',
    matchIds: data.matchIds || [],
    ranked: data.ranked ?? false,
    likes: data.likes || 0,
    createdAt: data.createdAt?.toDate() || new Date(),
    coverImage: data.coverImage || null,
  };
}

export async function createList(
  userId: string,
  username: string,
  name: string,
  description: string,
  matchIds: number[],
  ranked: boolean = false
): Promise<string> {
  const ref = await addDoc(collection(db, 'lists'), {
    userId,
    username,
    name,
    description,
    matchIds,
    ranked,
    likes: 0,
    createdAt: serverTimestamp(),
    coverImage: null,
  });
  return ref.id;
}

export async function getListsForUser(userId: string): Promise<MatchList[]> {
  const q = query(
    collection(db, 'lists'),
    where('userId', '==', userId),
  );
  const snapshot = await getDocs(q);
  const lists = snapshot.docs.map(docToList);
  lists.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  return lists;
}

export async function getRecentLists(): Promise<MatchList[]> {
  const q = query(
    collection(db, 'lists'),
    orderBy('createdAt', 'desc'),
    limit(20)
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map(docToList);
}

export async function getListById(listId: string): Promise<MatchList | null> {
  const docSnap = await getDoc(doc(db, 'lists', listId));
  if (!docSnap.exists()) return null;
  return docToList(docSnap);
}

export async function addMatchToList(listId: string, matchId: number): Promise<void> {
  await updateDoc(doc(db, 'lists', listId), { matchIds: arrayUnion(matchId) });
}

export async function removeMatchFromList(listId: string, matchId: number): Promise<void> {
  await updateDoc(doc(db, 'lists', listId), { matchIds: arrayRemove(matchId) });
}

export async function getListsContainingMatch(matchId: number): Promise<MatchList[]> {
  const q = query(
    collection(db, 'lists'),
    where('matchIds', 'array-contains', matchId)
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map(docToList);
}

export async function toggleListLike(
  listId: string,
  userId: string,
  senderInfo?: { username: string; avatar: string | null }
): Promise<void> {
  const ref = doc(db, 'lists', listId);
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

    if (senderInfo && data.userId) {
      await createNotification({
        recipientId: data.userId,
        senderId: userId,
        senderUsername: senderInfo.username,
        senderAvatar: senderInfo.avatar,
        type: 'list_like',
        listId,
      });
    }
  }
}

export async function getListsLikedByUser(userId: string): Promise<MatchList[]> {
  const q = query(
    collection(db, 'lists'),
    where('likedBy', 'array-contains', userId)
  );
  const snapshot = await getDocs(q);
  const lists = snapshot.docs.map(docToList);
  lists.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  return lists;
}

export async function getListLikedBy(listId: string): Promise<string[]> {
  const snap = await getDoc(doc(db, 'lists', listId));
  return snap.exists() ? snap.data().likedBy || [] : [];
}

export interface ListComment {
  id: string;
  listId: string;
  userId: string;
  username: string;
  userAvatar: string | null;
  text: string;
  createdAt: Date;
}

function docToListComment(docSnap: any): ListComment {
  const data = docSnap.data();
  return {
    id: docSnap.id,
    listId: data.listId,
    userId: data.userId,
    username: data.username || 'Anonymous',
    userAvatar: data.userAvatar || null,
    text: data.text || '',
    createdAt: data.createdAt?.toDate() || new Date(),
  };
}

export async function createListComment(
  listId: string,
  userId: string,
  username: string,
  userAvatar: string | null,
  text: string,
): Promise<string> {
  const ref = await addDoc(collection(db, 'listComments'), {
    listId,
    userId,
    username,
    userAvatar,
    text,
    createdAt: serverTimestamp(),
  });

  const listSnap = await getDoc(doc(db, 'lists', listId));
  const listUserId = listSnap.data()?.userId;
  if (listUserId) {
    await createNotification({
      recipientId: listUserId,
      senderId: userId,
      senderUsername: username,
      senderAvatar: userAvatar,
      type: 'list_comment',
      listId,
      commentId: ref.id,
    });
  }

  return ref.id;
}

export async function getCommentsForList(listId: string): Promise<ListComment[]> {
  const q = query(
    collection(db, 'listComments'),
    where('listId', '==', listId),
  );
  const snapshot = await getDocs(q);
  const comments = snapshot.docs.map(docToListComment);
  comments.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  return comments;
}

export async function deleteListComment(commentId: string): Promise<void> {
  await deleteDoc(doc(db, 'listComments', commentId));
}

export async function updateList(
  listId: string,
  data: { name?: string; description?: string; ranked?: boolean }
): Promise<void> {
  await updateDoc(doc(db, 'lists', listId), data);
}

export async function updateMatchOrder(listId: string, matchIds: number[]): Promise<void> {
  await updateDoc(doc(db, 'lists', listId), { matchIds });
}

export async function deleteList(listId: string): Promise<void> {
  await deleteDoc(doc(db, 'lists', listId));
}
