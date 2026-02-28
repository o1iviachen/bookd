import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  sendPasswordResetEmail,
} from 'firebase/auth';
import { auth } from '../config/firebase';
import { getEmailByUsername } from './firestore/users';

export async function signUp(email: string, password: string) {
  const credential = await createUserWithEmailAndPassword(auth, email, password);
  return credential.user;
}

export async function signIn(emailOrUsername: string, password: string) {
  let email = emailOrUsername;

  // If the input doesn't contain @, treat it as a username and look up the email
  if (!emailOrUsername.includes('@')) {
    const found = await getEmailByUsername(emailOrUsername);
    if (!found) {
      throw new Error('No account found with that username');
    }
    email = found;
  }

  const credential = await signInWithEmailAndPassword(auth, email, password);
  return credential.user;
}

export async function signOut() {
  await firebaseSignOut(auth);
}

export async function resetPassword(emailOrUsername: string) {
  let email = emailOrUsername;
  if (!emailOrUsername.includes('@')) {
    const found = await getEmailByUsername(emailOrUsername);
    if (!found) {
      throw new Error('No account found with that username');
    }
    email = found;
  }
  await sendPasswordResetEmail(auth, email);
}
