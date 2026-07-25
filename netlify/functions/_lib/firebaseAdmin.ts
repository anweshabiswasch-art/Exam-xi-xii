import * as admin from 'firebase-admin';

/**
 * Lazily initializes the Firebase Admin SDK from a service account JSON
 * stored in the FIREBASE_SERVICE_ACCOUNT environment variable (Netlify
 * dashboard -> Environment variables). Get this JSON from Firebase console:
 * Project settings -> Service accounts -> Generate new private key.
 * Paste the whole file contents as the value of one env var.
 */
export function getAdminSdk(): typeof admin {
  if (!admin.apps.length) {
    const json = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (!json) {
      throw new Error(
        'FIREBASE_SERVICE_ACCOUNT is not set in Netlify environment variables. See README "Self-evolution setup".'
      );
    }
    admin.initializeApp({ credential: admin.credential.cert(JSON.parse(json)) });
  }
  return admin;
}

/**
 * Verifies the caller is a signed-in admin. Throws if not. Used to protect
 * manually-triggered functions (the scheduled cron path doesn't call this —
 * it's authenticated by Netlify itself invoking the function directly).
 */
export async function verifyAdmin(authHeader: string | undefined): Promise<string> {
  if (!authHeader?.startsWith('Bearer ')) {
    throw new Error('Missing Authorization: Bearer <idToken> header.');
  }
  const token = authHeader.slice('Bearer '.length);
  const sdk = getAdminSdk();
  const decoded = await sdk.auth().verifyIdToken(token);
  const userDoc = await sdk.firestore().collection('users').doc(decoded.uid).get();
  if (!userDoc.exists || userDoc.data()?.role !== 'admin') {
    throw new Error('This account is not an admin.');
  }
  return decoded.uid;
}

/** True when Netlify itself invoked this function on its cron schedule. */
export function isScheduledInvocation(headers: Record<string, string | undefined>): boolean {
  return headers['x-netlify-event'] === 'schedule';
}
