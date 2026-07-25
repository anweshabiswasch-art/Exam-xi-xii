import { doc, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase/config';

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i += 1) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

/** Firestore doc IDs can't contain '/', so turn a push endpoint URL into a safe key. */
function endpointToDocId(endpoint: string): string {
  return endpoint.replace(/[^a-zA-Z0-9]/g, '_').slice(-150);
}

export function isPushSupported(): boolean {
  return typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window;
}

export async function getExistingSubscription(): Promise<PushSubscription | null> {
  if (!isPushSupported()) return null;
  const registration = await navigator.serviceWorker.ready;
  return registration.pushManager.getSubscription();
}

export async function subscribeToPush(uid: string, studentClass: 'XI' | 'XII' | null): Promise<void> {
  if (!isPushSupported()) throw new Error('Push notifications are not supported on this device/browser.');
  if (!VAPID_PUBLIC_KEY) {
    throw new Error('Push notifications are not configured yet (missing VITE_VAPID_PUBLIC_KEY). Ask your admin.');
  }

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    throw new Error('Notification permission was not granted.');
  }

  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
  });

  const json = subscription.toJSON();
  if (!json.endpoint || !json.keys) throw new Error('Browser returned an invalid push subscription.');

  await setDoc(doc(db, 'pushSubscriptions', endpointToDocId(json.endpoint)), {
    uid,
    class: studentClass,
    endpoint: json.endpoint,
    keys: json.keys,
    createdAt: serverTimestamp(),
  });
}

export async function unsubscribeFromPush(): Promise<void> {
  const subscription = await getExistingSubscription();
  if (!subscription) return;
  const json = subscription.toJSON();
  if (json.endpoint) {
    await deleteDoc(doc(db, 'pushSubscriptions', endpointToDocId(json.endpoint)));
  }
  await subscription.unsubscribe();
}
