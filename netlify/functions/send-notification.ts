import type { Handler } from '@netlify/functions';
import webpush from 'web-push';
import { getAdminSdk, verifyAdmin } from './_lib/firebaseAdmin';

interface RequestBody {
  title: string;
  message: string;
  targetClass: 'XI' | 'XII' | 'ALL';
  url?: string;
}

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    await verifyAdmin(event.headers.authorization);
  } catch (err) {
    return { statusCode: 403, body: JSON.stringify({ error: err instanceof Error ? err.message : 'Forbidden' }) };
  }

  const publicKey = process.env.VITE_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT; // e.g. "mailto:you@example.com"
  if (!publicKey || !privateKey || !subject) {
    return {
      statusCode: 500,
      body: JSON.stringify({
        error:
          'Push notifications are not configured. Set VITE_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, and VAPID_SUBJECT in Netlify environment variables.',
      }),
    };
  }
  webpush.setVapidDetails(subject, publicKey, privateKey);

  let body: RequestBody;
  try {
    body = JSON.parse(event.body ?? '{}');
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON body' }) };
  }
  if (!body.title || !body.message) {
    return { statusCode: 400, body: JSON.stringify({ error: 'title and message are required' }) };
  }

  const admin = getAdminSdk();
  const db = admin.firestore();
  const collectionRef = db.collection('pushSubscriptions');
  const snap =
    body.targetClass === 'ALL' ? await collectionRef.get() : await collectionRef.where('class', '==', body.targetClass).get();

  const payload = JSON.stringify({ title: body.title, body: body.message, url: body.url ?? '/announcements' });

  let sent = 0;
  let removed = 0;
  let failed = 0;

  await Promise.all(
    snap.docs.map(async (subDoc) => {
      const data = subDoc.data() as { endpoint: string; keys: { p256dh: string; auth: string } };
      try {
        await webpush.sendNotification({ endpoint: data.endpoint, keys: data.keys }, payload);
        sent += 1;
      } catch (err) {
        const statusCode = (err as { statusCode?: number }).statusCode;
        if (statusCode === 404 || statusCode === 410) {
          // Subscription is dead (browser data cleared, uninstalled, etc.) — clean it up.
          await subDoc.ref.delete().catch(() => {});
          removed += 1;
        } else {
          failed += 1;
        }
      }
    })
  );

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ targeted: snap.size, sent, removed, failed }),
  };
};
