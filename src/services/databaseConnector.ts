import type { KuponFee, NewKuponPayload, SyncConfig } from '../types/kupon.ts';

export interface KuponListResponse {
  kupons: KuponFee[];
  syncConfig: SyncConfig;
  serverTime: string;
}

export async function fetchKupons(): Promise<KuponListResponse> {
  const res = await fetch('/api/kupon');
  if (!res.ok) {
    throw new Error('Gagal memuat daftar kupon dari server kasir.');
  }
  return (await res.json()) as KuponListResponse;
}

export async function createIncomingKupon(payload: NewKuponPayload): Promise<KuponFee> {
  const res = await fetch('/api/kupon', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = (await res.json()) as { kupon?: KuponFee; error?: string };
  if (!res.ok || !data.kupon) {
    throw new Error(data.error || 'Gagal menyimpan kupon masuk.');
  }
  return data.kupon;
}

export async function markKuponLunas(
  id: string,
  payload: { nominalFee?: number; petugasKasir?: string; catatanKasir?: string },
): Promise<{ kupon: KuponFee; syncWarning?: string | null }> {
  const res = await fetch(`/api/kupon/${encodeURIComponent(id)}/lunas`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = (await res.json()) as { kupon?: KuponFee; syncWarning?: string | null; error?: string };
  if (!res.ok || !data.kupon) {
    throw new Error(data.error || 'Gagal memproses pencairan kupon.');
  }
  return { kupon: data.kupon, syncWarning: data.syncWarning };
}

export async function cancelKuponLunas(
  id: string,
  alasan?: string,
): Promise<{ kupon: KuponFee; syncWarning?: string | null }> {
  const res = await fetch(`/api/kupon/${encodeURIComponent(id)}/batal`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ alasan }),
  });
  const data = (await res.json()) as { kupon?: KuponFee; syncWarning?: string | null; error?: string };
  if (!res.ok || !data.kupon) {
    throw new Error(data.error || 'Gagal membatalkan status lunas.');
  }
  return { kupon: data.kupon, syncWarning: data.syncWarning };
}

export async function resetDemoKupons(): Promise<{ kupons: KuponFee[]; syncConfig: SyncConfig }> {
  const res = await fetch('/api/kupon/reset-demo', { method: 'POST' });
  if (!res.ok) {
    throw new Error('Gagal memuat ulang data simulasi.');
  }
  return (await res.json()) as { kupons: KuponFee[]; syncConfig: SyncConfig };
}

export async function saveSyncConfig(config: Partial<SyncConfig>): Promise<SyncConfig> {
  const res = await fetch('/api/sync-config', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config),
  });
  const data = (await res.json()) as { syncConfig?: SyncConfig; error?: string };
  if (!res.ok || !data.syncConfig) {
    throw new Error(data.error || 'Gagal menyimpan konfigurasi sinkronisasi.');
  }
  return data.syncConfig;
}

export async function triggerSyncPull(): Promise<{
  syncedCount: number;
  kupons: KuponFee[];
  syncConfig: SyncConfig;
  message: string;
}> {
  const res = await fetch('/api/sync/pull', { method: 'POST' });
  const data = (await res.json()) as {
    syncedCount?: number;
    kupons?: KuponFee[];
    syncConfig?: SyncConfig;
    message?: string;
    error?: string;
  };
  if (!res.ok || !data.kupons || !data.syncConfig) {
    throw new Error(data.error || 'Gagal menarik data dari sumber eksternal.');
  }
  return {
    syncedCount: data.syncedCount ?? 0,
    kupons: data.kupons,
    syncConfig: data.syncConfig,
    message: data.message || 'Sinkronisasi selesai.',
  };
}

export async function testSyncConnection(
  config: Partial<SyncConfig>,
): Promise<{ ok: boolean; latencyMs?: number; message: string }> {
  const res = await fetch('/api/sync/test', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config),
  });
  return (await res.json()) as { ok: boolean; latencyMs?: number; message: string };
}

export interface RealtimeHandlers {
  onCreated: (kupon: KuponFee) => void;
  onUpdated: (kupon: KuponFee) => void;
  onReset: (kupons: KuponFee[]) => void;
  onConnectionChange?: (connected: boolean) => void;
}

export function subscribeRealtimeKupons(handlers: RealtimeHandlers): () => void {
  const eventSource = new EventSource('/api/stream');

  eventSource.addEventListener('connected', () => {
    handlers.onConnectionChange?.(true);
  });

  eventSource.addEventListener('kupon_created', (evt) => {
    try {
      const kupon = JSON.parse((evt as MessageEvent).data) as KuponFee;
      handlers.onCreated(kupon);
    } catch {
      // Ignore malformed frame
    }
  });

  eventSource.addEventListener('kupon_updated', (evt) => {
    try {
      const kupon = JSON.parse((evt as MessageEvent).data) as KuponFee;
      handlers.onUpdated(kupon);
    } catch {
      // Ignore malformed frame
    }
  });

  eventSource.addEventListener('kupon_reset', (evt) => {
    try {
      const payload = JSON.parse((evt as MessageEvent).data) as { kupons: KuponFee[] };
      if (Array.isArray(payload.kupons)) {
        handlers.onReset(payload.kupons);
      }
    } catch {
      // Ignore malformed frame
    }
  });

  eventSource.onerror = () => {
    handlers.onConnectionChange?.(false);
  };

  return () => {
    eventSource.close();
  };
}

export function buildPendaftaranIntegrationSnippets(origin: string, config: SyncConfig) {
  const webhookEndpoint = `${origin}/api/webhook/pendaftaran`;
  const listEndpoint = `${origin}/api/kupon`;

  const pendaftaranFetchSnippet = `// Panggil dari Web Pendaftaran RSUMB saat kupon fee dicetak/disimpan
await fetch("${webhookEndpoint}", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    noKupon: "KPN-261118-015",
    namaPasien: "Ny. Siti Aminah",
    noRm: "04-82-19",
    ruangRanap: "R. Arafah Lt. 2",
    penjamin: "BPJS", // "BPJS" | "UMUM" | "JASA_RAHARJA"
    kategori: "MOHAT_DESA", // "MOHAT_DESA" | "PKM_FASKES_1"
    namaPerujuk: "Bpk. Slamet Riyadi",
    asalInstansi: "Mohat Desa Plaosan",
    nominalFee: 25000,
    petugasPendaftaran: "Hisyam"
  })
});`;

  const firestoreSchemaSnippet = `// Koleksi Firestore: "${config.firebaseCollection || 'kupon_fee_mohat'}"
// Project ID: "${config.firebaseProjectId || 'rsumb-portal-pendaftaran'}"
// Web Pendaftaran menulis dokumen dengan status: "MENUNGGU_KASIR"
// Web Kasir memperbarui status menjadi "LUNAS" + waktuCair + petugasKasir
{
  "noKupon": "KPN-261118-015",
  "tanggalInput": "2026-11-18T08:15:00.000Z",
  "namaPasien": "Ny. Siti Aminah",
  "ruangRanap": "R. Arafah Lt. 2",
  "penjamin": "BPJS",
  "kategori": "MOHAT_DESA",
  "namaPerujuk": "Bpk. Slamet Riyadi",
  "asalInstansi": "Mohat Desa Plaosan",
  "nominalFee": 25000,
  "status": "MENUNGGU_KASIR",
  "petugasPendaftaran": "Hisyam",
  "waktuCair": null,
  "petugasKasir": null
}`;

  const appsScriptSnippet = `// Tempel di Google Apps Script (Extensions > Apps Script) pada Sheet Kupon RSUMB
function doGet() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("KuponFee");
  const rows = sheet.getDataRange().getValues();
  const headers = rows.shift();
  const data = rows.map(r => Object.fromEntries(headers.map((h, i) => [h, r[i]])));
  return ContentService.createTextOutput(JSON.stringify({ kupons: data }))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  const payload = JSON.parse(e.postData.contents);
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("KuponFee");
  const rows = sheet.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] === payload.kupon.noKupon) {
      sheet.getRange(i + 1, 9).setValue(payload.kupon.status);
      sheet.getRange(i + 1, 10).setValue(payload.kupon.waktuCair || "");
      sheet.getRange(i + 1, 11).setValue(payload.kupon.petugasKasir || "");
      break;
    }
  }
  return ContentService.createTextOutput(JSON.stringify({ ok: true }))
    .setMimeType(ContentService.MimeType.JSON);
}`;

  return {
    webhookEndpoint,
    listEndpoint,
    pendaftaranFetchSnippet,
    firestoreSchemaSnippet,
    appsScriptSnippet,
  };
}
