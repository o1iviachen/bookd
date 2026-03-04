import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import { GoogleAuthProvider, signInWithCredential } from 'firebase/auth';
import { auth } from '../config/firebase';

// Handle redirect back from browser
WebBrowser.maybeCompleteAuthSession();

export function useGoogleAuth() {
  const [request, response, promptAsync] = Google.useIdTokenAuthRequest({
    clientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
  });

  return { request, response, promptAsync };
}

export async function firebaseGoogleSignIn(idToken: string) {
  const credential = GoogleAuthProvider.credential(idToken);
  const result = await signInWithCredential(auth, credential);
  return result.user;
}
