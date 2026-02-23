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
  increment,
} from 'firebase/firestore';
import { db } from '../../config/firebase';
import { MatchList } from '../../types/list';

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

export async function likeList(listId: string): Promise<void> {
  await updateDoc(doc(db, 'lists', listId), { likes: increment(1) });
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
