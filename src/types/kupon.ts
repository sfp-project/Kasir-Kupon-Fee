export type KuponStatus = 'MENUNGGU_KASIR' | 'LUNAS';

export type KuponKategori = 'MOHAT_DESA' | 'PKM_FASKES_1';

export type PenjaminPasien = 'BPJS' | 'UMUM' | 'JASA_RAHARJA';

export type SyncProvider = 'LOCAL_REST' | 'FIREBASE_FIRESTORE' | 'GOOGLE_SHEETS' | 'CUSTOM_WEBHOOK';

export interface KuponFee {
  id: string;
  noKupon: string;
  tanggalInput: string; // ISO 8601 timestamp
  namaPasien: string;
  noRm?: string;
  ruangRanap: string;
  penjamin: PenjaminPasien;
  kategori: KuponKategori;
  namaPerujuk: string; // Nama Sopir / Perujuk
  asalInstansi: string; // Desa / PKM / Klinik
  noHpPerujuk?: string;
  nominalFee: number;
  status: KuponStatus;
  petugasPendaftaran: string;
  waktuCair?: string | null; // ISO 8601 timestamp saat kasir menandai lunas
  petugasKasir?: string | null;
  catatanKasir?: string | null;
  riwayatBatal?: {
    waktu: string;
    alasan: string;
    petugasSebelumnya?: string | null;
  } | null;
  sumberSync?: string; // 'WEB_PENDAFTARAN' | 'SIMULASI' | 'FIREBASE' | 'GOOGLE_SHEETS'
}

export interface SyncConfig {
  provider: SyncProvider;
  autoSyncEnabled: boolean;
  pollIntervalSeconds: number;
  // Firebase Firestore structure (REST / SDK compatible)
  firebaseProjectId: string;
  firebaseCollection: string;
  firebaseDatabaseId: string;
  // Google Sheets Apps Script Webhook
  googleSheetsWebhookUrl: string;
  // Custom REST API / Webhook Pendaftaran
  restBaseUrl: string;
  outboundWebhookUrl: string;
  // Metadata
  lastSyncAt: string | null;
  lastSyncMessage: string | null;
}

export interface NewKuponPayload {
  noKupon?: string;
  namaPasien: string;
  noRm?: string;
  ruangRanap: string;
  penjamin: PenjaminPasien;
  kategori: KuponKategori;
  namaPerujuk: string;
  asalInstansi: string;
  noHpPerujuk?: string;
  nominalFee: number;
  petugasPendaftaran: string;
  sumberSync?: string;
}

export interface CashSummary {
  menungguCount: number;
  menungguTotal: number;
  lunasCount: number;
  lunasTotal: number;
  totalTodayCount: number;
  totalTodayNominal: number;
  mohatTodayCount: number;
  mohatTodayNominal: number;
  faskesTodayCount: number;
  faskesTodayNominal: number;
}
