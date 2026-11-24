import { initializeApp } from 'firebase/app';
import {
  GoogleAuthProvider,
  getAuth,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth';
import { doc, getDocFromServer, getFirestore } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

export const MOHAT_COUPONS_COLLECTION = 'mohat_coupons';

export const FIREBASE_META = {
  projectId: firebaseConfig.projectId,
  firestoreDatabaseId: firebaseConfig.firestoreDatabaseId,
  collection: MOHAT_COUPONS_COLLECTION,
} as const;

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function buildFirestoreErrorInfo(
  error: unknown,
  operationType: OperationType,
  path: string | null,
): FirestoreErrorInfo {
  return {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null,
): never {
  const errInfo = buildFirestoreErrorInfo(error, operationType, path);
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export function isPermissionDeniedError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  return msg.includes('permission') || msg.includes('insufficient permissions');
}

export async function testFirestoreConnection(): Promise<{ ok: boolean; message: string; latencyMs: number }> {
  const start = Date.now();
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    const latencyMs = Date.now() - start;
    return {
      ok: true,
      latencyMs,
      message: `Terhubung ke Firestore (${firebaseConfig.projectId}) dalam ${latencyMs} ms.`,
    };
  } catch (error) {
    const latencyMs = Date.now() - start;
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
      return {
        ok: false,
        latencyMs,
        message: 'Klien Firestore sedang offline. Periksa koneksi internet atau konfigurasi Firebase.',
      };
    }
    // A permission error on test/connection still confirms the Firestore server is reachable
    if (isPermissionDeniedError(error)) {
      return {
        ok: true,
        latencyMs,
        message: `Server Firestore aktif dan merespons dalam ${latencyMs} ms.`,
      };
    }
    return {
      ok: false,
      latencyMs,
      message: error instanceof Error ? error.message : 'Gagal menghubungi server Firestore.',
    };
  }
}

// Run startup connection validation
void testFirestoreConnection();

const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

export async function signInWithGoogle(): Promise<User> {
  const result = await signInWithPopup(auth, googleProvider);
  return result.user;
}

export async function signOutUser(): Promise<void> {
  await signOut(auth);
}
