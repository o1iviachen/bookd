import { useState, useEffect, useRef } from 'react';
import { subscribeToDiscussion } from '../services/firestore/discussions';
import { DiscussionMessage } from '../types/discussion';

/**
 * Real-time hook for match discussion messages.
 * Uses Firestore onSnapshot — NOT React Query — so updates push automatically.
 * Only subscribes when `enabled` is true (tab active + match readable).
 */
export function useDiscussion(matchId: number, enabled: boolean, blockedUsers?: Set<string>) {
  const [messages, setMessages] = useState<DiscussionMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const initialLoad = useRef(true);

  useEffect(() => {
    if (!enabled) {
      setMessages([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    initialLoad.current = true;

    const unsubscribe = subscribeToDiscussion(matchId, (msgs) => {
      setMessages(msgs);
      if (initialLoad.current) {
        setIsLoading(false);
        initialLoad.current = false;
      }
    }, blockedUsers);

    return () => {
      unsubscribe();
    };
  }, [matchId, enabled, blockedUsers]);

  return { messages, isLoading };
}
