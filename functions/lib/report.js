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
Object.defineProperty(exports, "__esModule", { value: true });
exports.submitReport = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const nodemailer = __importStar(require("nodemailer"));
const db = admin.firestore();
/**
 * Callable function: saves a content report to Firestore and emails the admin.
 *
 * Email is sent if these env vars are set in functions/.env:
 *   REPORT_EMAIL_USER=yourapp@gmail.com   (sender Gmail address)
 *   REPORT_EMAIL_PASS=xxxx xxxx xxxx xxxx  (Gmail App Password)
 *   REPORT_EMAIL_TO=admin@example.com      (recipient)
 */
exports.submitReport = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Must be logged in to report content');
    }
    const { contentType, contentId, reason, note } = data;
    if (!contentType || !contentId || !reason) {
        throw new functions.https.HttpsError('invalid-argument', 'contentType, contentId, and reason are required');
    }
    // Save to Firestore (admin SDK — bypasses client rules)
    const reportRef = await db.collection('reports').add({
        reporterId: context.auth.uid,
        contentType,
        contentId,
        reason,
        note: note || '',
        status: 'pending',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    // Send email notification if credentials are configured
    const emailUser = process.env.REPORT_EMAIL_USER;
    const emailPass = process.env.REPORT_EMAIL_PASS;
    const emailTo = process.env.REPORT_EMAIL_TO;
    if (emailUser && emailPass && emailTo) {
        try {
            const transporter = nodemailer.createTransport({
                service: 'gmail',
                auth: { user: emailUser, pass: emailPass },
            });
            await transporter.sendMail({
                from: emailUser,
                to: emailTo,
                subject: `[bookd] New ${contentType} report`,
                text: [
                    `A new report has been submitted on bookd.`,
                    ``,
                    `Report ID: ${reportRef.id}`,
                    `Type: ${contentType}`,
                    `Content ID: ${contentId}`,
                    `Reason: ${reason}`,
                    `Note: ${note || 'None'}`,
                    `Reporter UID: ${context.auth.uid}`,
                    ``,
                    `Review in Firebase console: https://console.firebase.google.com/project/bookd-ff19a/firestore/data/reports/${reportRef.id}`,
                ].join('\n'),
            });
        }
        catch (emailErr) {
            // Email failure doesn't fail the report — it's still saved to Firestore
            console.error('[submitReport] Email send failed:', emailErr);
        }
    }
    else {
        console.log(`[submitReport] Email not configured. Report saved to Firestore: ${reportRef.id}`);
    }
    return { success: true };
});
//# sourceMappingURL=report.js.map