import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import axios from 'axios';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const db = admin.firestore();

/**
 * Find Expo push tokens for users who follow any of the given team IDs
 * and have the specified notification preference enabled.
 */
async function getTokensForTeams(teamIds: string[]): Promise<string[]> {
  const tokens: string[] = [];
  const seen = new Set<string>();

  for (const teamId of teamIds) {
    const snap = await db
      .collection('users')
      .where('favoriteTeams', 'array-contains', teamId)
      .get();

    for (const userDoc of snap.docs) {
      if (seen.has(userDoc.id)) continue;
      seen.add(userDoc.id);

      const data = userDoc.data();
      const token = data.expoPushToken;
      if (!token) continue;

      const prefs = data.notificationPreferences || {};
      if (prefs.pushEnabled === false) continue;
      if (prefs.matchEvents === false) continue;

      tokens.push(token);
    }
  }

  return tokens;
}

/**
 * Send push notifications in batches of 100 (Expo API limit per request).
 */
async function sendBatchPush(
  tokens: string[],
  message: { title: string; body: string; data: Record<string, any> },
): Promise<void> {
  const BATCH_SIZE = 100;

  for (let i = 0; i < tokens.length; i += BATCH_SIZE) {
    const batch = tokens.slice(i, i + BATCH_SIZE);
    const messages = batch.map((token) => ({
      to: token,
      title: message.title,
      body: message.body,
      sound: 'default' as const,
      data: message.data,
    }));

    try {
      await axios.post(EXPO_PUSH_URL, messages);
    } catch (err: any) {
      console.error(`[matchNotify] Batch send failed:`, err.message);
    }
  }
}

/**
 * Scheduled function: find matches kicking off within the next 65 minutes
 * that haven't been notified yet, and send pre-match push notifications.
 */
export async function sendPreMatchNotifications(): Promise<number> {
  const now = new Date();
  const soon = new Date(now.getTime() + 65 * 60 * 1000);

  const snap = await db
    .collection('matches')
    .where('status', 'in', ['SCHEDULED', 'TIMED'])
    .where('kickoff', '>=', now.toISOString())
    .where('kickoff', '<=', soon.toISOString())
    .get();

  const unnotified = snap.docs.filter((d) => !d.data().notifiedPreMatch);
  let sent = 0;

  for (const matchDoc of unnotified) {
    const match = matchDoc.data();
    const homeId = String(match.homeTeam.id);
    const awayId = String(match.awayTeam.id);

    const tokens = await getTokensForTeams([homeId, awayId]);
    if (tokens.length === 0) {
      await matchDoc.ref.update({ notifiedPreMatch: true });
      continue;
    }

    await sendBatchPush(tokens, {
      title: 'Match Starting Soon',
      body: `Discussion is open for ${match.homeTeam.name} vs ${match.awayTeam.name}!`,
      data: { type: 'match_pre', matchId: match.id },
    });

    await matchDoc.ref.update({ notifiedPreMatch: true });
    sent++;
    console.log(`[preMatch] Notified ${tokens.length} users for ${match.homeTeam.name} vs ${match.awayTeam.name}`);
  }

  return sent;
}

/**
 * Firestore onUpdate handler: when a match status changes to FINISHED,
 * send post-match push notifications.
 */
export async function handleMatchStatusChange(
  change: functions.Change<functions.firestore.DocumentSnapshot>,
): Promise<void> {
  const before = change.before.data();
  const after = change.after.data();
  if (!before || !after) return;

  // Only fire when status changes TO 'FINISHED'
  if (before.status === 'FINISHED' || after.status !== 'FINISHED') return;
  if (after.notifiedPostMatch) return;

  const homeId = String(after.homeTeam.id);
  const awayId = String(after.awayTeam.id);

  const tokens = await getTokensForTeams([homeId, awayId]);
  if (tokens.length === 0) {
    await change.after.ref.update({ notifiedPostMatch: true });
    return;
  }

  const score = `${after.homeScore ?? '?'}-${after.awayScore ?? '?'}`;
  await sendBatchPush(tokens, {
    title: 'Full Time',
    body: `Reviews are open for ${after.homeTeam.name} ${score} ${after.awayTeam.name}!`,
    data: { type: 'match_post', matchId: after.id },
  });

  await change.after.ref.update({ notifiedPostMatch: true });
  console.log(`[postMatch] Notified ${tokens.length} users for ${after.homeTeam.name} ${score} ${after.awayTeam.name}`);
}
