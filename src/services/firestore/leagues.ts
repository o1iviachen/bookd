import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { League } from '../../types/league';

const LEAGUES_COLLECTION = 'leagues';

export async function getLeagues(): Promise<League[]> {
  const q = query(collection(db, LEAGUES_COLLECTION), orderBy('displayOrder'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data() as League);
}
