import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../config/firebase';
import * as authService from '../services/auth';
import { createUserProfile, getUserProfile } from '../services/firestore/users';
import { registerForPushNotifications } from '../services/pushNotifications';
import { firebaseGoogleSignIn } from '../services/googleAuth';

interface AuthUser {
  uid: string;
  email: string | null;
}

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  needsOnboarding: boolean;
  needsUsername: boolean;
  completeOnboarding: () => void;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, username: string) => Promise<void>;
  signInWithGoogle: (idToken: string) => Promise<void>;
  createUsernameForGoogle: (username: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>(null as any);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [needsUsername, setNeedsUsername] = useState(false);

  // Flag to prevent onAuthStateChanged from triggering username flow during email signup
  const isEmailSignUpRef = useRef(false);

  const completeOnboarding = () => setNeedsOnboarding(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setUser({ uid: firebaseUser.uid, email: firebaseUser.email });
        registerForPushNotifications(firebaseUser.uid).catch(() => {});

        // Check if user has a Firestore profile (skip during normal email signup)
        if (!isEmailSignUpRef.current) {
          try {
            const profile = await getUserProfile(firebaseUser.uid);
            if (!profile) {
              setNeedsUsername(true);
            } else {
              setNeedsUsername(false);
            }
          } catch {
            setNeedsUsername(false);
          }
        }
        isEmailSignUpRef.current = false;
      } else {
        setUser(null);
        setNeedsUsername(false);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const signIn = async (email: string, password: string) => {
    await authService.signIn(email, password);
  };

  const signUp = async (email: string, password: string, username: string) => {
    isEmailSignUpRef.current = true;
    setNeedsOnboarding(true);
    const firebaseUser = await authService.signUp(email, password);
    await createUserProfile(firebaseUser.uid, email, username);
  };

  const signInWithGoogle = async (idToken: string) => {
    await firebaseGoogleSignIn(idToken);
    // onAuthStateChanged will handle profile check and routing
  };

  const createUsernameForGoogle = async (username: string) => {
    if (!user) throw new Error('No authenticated user');
    await createUserProfile(user.uid, user.email || '', username);
    setNeedsUsername(false);
    setNeedsOnboarding(true);
  };

  const signOut = async () => {
    await authService.signOut();
  };

  return (
    <AuthContext.Provider value={{
      user, loading, needsOnboarding, needsUsername,
      completeOnboarding, signIn, signUp, signInWithGoogle, createUsernameForGoogle, signOut,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
