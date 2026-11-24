import type { KuponFee, SyncConfig } from '../types/kupon.ts';

// Built-in simulation/dummy KPN-... data is disabled:
// Web Kasir reads live coupons directly from Firebase Firestore collection "mohat_coupons".
export function createSeedKupons(): KuponFee[] {
  return [];
}

export function createDefaultSyncConfig(): SyncConfig {
  return {
    provider: 'FIREBASE_FIRESTORE',
    autoSyncEnabled: true,
    pollIntervalSeconds: 15,
    firebaseProjectId: 'gen-lang-client-0208641258',
    firebaseCollection: 'mohat_coupons',
    firebaseDatabaseId: 'ai-studio-portalpendaftara-21a36b17-5987-42de-b51e-51d49cc4bfe0',
    googleSheetsWebhookUrl: '',
    restBaseUrl: '',
    outboundWebhookUrl: '',
    lastSyncAt: new Date().toISOString(),
    lastSyncMessage: 'Terhubung langsung ke Firebase Firestore (mohat_coupons).',
  };
}
