"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendPreMatchNotifications = sendPreMatchNotifications;
exports.handleMatchStatusChange = handleMatchStatusChange;
const admin = __importStar(require("firebase-admin"));
const axios_1 = __importDefault(require("axios"));
const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const db = admin.firestore();
/**
 * Find Expo push tokens for users who follow any of the given team IDs
 * and have the specified notification preference enabled.
 */
async function getTokensForTeams(teamIds) {
    const tokens = [];
    const seen = new Set();
    for (const teamId of teamIds) {
        const snap = await db
            .collection('users')
            .where('favoriteTeams', 'array-contains', teamId)
            .get();
        for (const userDoc of snap.docs) {
            if (seen.has(userDoc.id))
                continue;
            seen.add(userDoc.id);
            const data = userDoc.data();
            const token = data.expoPushToken;
            if (!token)
                continue;
            const prefs = data.notificationPreferences || {};
            if (prefs.pushEnabled === false)
                continue;
            if (prefs.matchEvents === false)
                continue;
            tokens.push(token);
        }
    }
    return tokens;
}
/**
 * Send push notifications in batches of 100 (Expo API limit per request).
 */
async function sendBatchPush(tokens, message) {
    const BATCH_SIZE = 100;
    for (let i = 0; i < tokens.length; i += BATCH_SIZE) {
        const batch = tokens.slice(i, i + BATCH_SIZE);
        const messages = batch.map((token) => ({
            to: token,
            title: message.title,
            body: message.body,
            sound: 'default',
            data: message.data,
        }));
        try {
            await axios_1.default.post(EXPO_PUSH_URL, messages);
        }
        catch (err) {
            console.error(`[matchNotify] Batch send failed:`, err.message);
        }
    }
}
/**
 * Scheduled function: find matches kicking off within the next 65 minutes
 * that haven't been notified yet, and send pre-match push notifications.
 */
async function sendPreMatchNotifications() {
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
            body: `Discussion is open for ${match.homeTeam.name} vs ${match.awayTeam.name}`,
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
async function handleMatchStatusChange(change) {
    var _a, _b;
    const before = change.before.data();
    const after = change.after.data();
    if (!before || !after)
        return;
    // Only fire when status changes TO 'FINISHED'
    if (before.status === 'FINISHED' || after.status !== 'FINISHED')
        return;
    if (after.notifiedPostMatch)
        return;
    const homeId = String(after.homeTeam.id);
    const awayId = String(after.awayTeam.id);
    const tokens = await getTokensForTeams([homeId, awayId]);
    if (tokens.length === 0) {
        await change.after.ref.update({ notifiedPostMatch: true });
        return;
    }
    const score = `${(_a = after.homeScore) !== null && _a !== void 0 ? _a : '?'}-${(_b = after.awayScore) !== null && _b !== void 0 ? _b : '?'}`;
    await sendBatchPush(tokens, {
        title: 'Full Time',
        body: `Reviews are open for ${after.homeTeam.name} ${score} ${after.awayTeam.name}`,
        data: { type: 'match_post', matchId: after.id },
    });
    await change.after.ref.update({ notifiedPostMatch: true });
    console.log(`[postMatch] Notified ${tokens.length} users for ${after.homeTeam.name} ${score} ${after.awayTeam.name}`);
}
//# sourceMappingURL=matchEventNotifications.js.map