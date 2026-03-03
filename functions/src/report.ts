import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import * as nodemailer from 'nodemailer';

const db = admin.firestore();

/**
 * Callable function: saves a content report to Firestore and emails the admin.
 *
 * Email is sent if these env vars are set in functions/.env:
 *   REPORT_EMAIL_USER=yourapp@gmail.com   (sender Gmail address)
 *   REPORT_EMAIL_PASS=xxxx xxxx xxxx xxxx  (Gmail App Password)
 *   REPORT_EMAIL_TO=admin@example.com      (recipient)
 */
export const submitReport = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Must be logged in to report content');
  }

  const { contentType, contentId, reason, note } = data as {
    contentType: 'review' | 'comment';
    contentId: string;
    reason: string;
    note?: string;
  };

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
    } catch (emailErr) {
      // Email failure doesn't fail the report — it's still saved to Firestore
      console.error('[submitReport] Email send failed:', emailErr);
    }
  } else {
    console.log(`[submitReport] Email not configured. Report saved to Firestore: ${reportRef.id}`);
  }

  return { success: true };
});
