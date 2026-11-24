import type { KuponFee, KuponKategori } from '../types/kupon.ts';

export type ThermalPaperSize = '58mm' | '80mm';

export interface ThermalReceiptPayload {
  noKupon: string;
  status: string;
  waktuCair: string | null;
  petugasKasir: string;
  kategori: KuponKategori;
  namaPerujuk: string;
  asalInstansi: string;
  namaPasien: string;
  ruangRanap: string;
  tanggalInput: string;
  petugasPendaftaran: string;
  nominalFee: number;
  catatanKasir: string | null;
}

const PAPER_SIZE_STORAGE_KEY = 'rsumb_kasir_thermal_paper_size';
const LAST_RECEIPT_SESSION_KEY = 'rsumb_kasir_last_thermal_receipt';

export function getSavedThermalPaperSize(): ThermalPaperSize {
  try {
    const saved = localStorage.getItem(PAPER_SIZE_STORAGE_KEY);
    if (saved === '58mm' || saved === '80mm') {
      return saved;
    }
  } catch {
    // Ignore storage access errors
  }
  return '80mm';
}

export function saveThermalPaperSize(size: ThermalPaperSize): void {
  try {
    localStorage.setItem(PAPER_SIZE_STORAGE_KEY, size);
  } catch {
    // Ignore storage access errors
  }
}

function encodeBase64Url(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function decodeBase64Url(encoded: string): string {
  const padded = encoded.replace(/-/g, '+').replace(/_/g, '/');
  const mod = padded.length % 4;
  const base64 = mod === 0 ? padded : `${padded}${'='.repeat(4 - mod)}`;
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new TextDecoder().decode(bytes);
}

export function toThermalReceiptPayload(kupon: KuponFee): ThermalReceiptPayload {
  return {
    noKupon: kupon.noKupon,
    status: kupon.status === 'LUNAS' ? 'LUNAS (TUNAI)' : 'MENUNGGU KASIR',
    waktuCair: kupon.waktuCair ?? null,
    petugasKasir: kupon.petugasKasir?.trim() || 'Petugas Kasir',
    kategori: kupon.kategori,
    namaPerujuk: kupon.namaPerujuk,
    asalInstansi: kupon.asalInstansi || '-',
    namaPasien: kupon.namaPasien,
    ruangRanap: kupon.ruangRanap || '-',
    tanggalInput: kupon.tanggalInput,
    petugasPendaftaran: kupon.petugasPendaftaran || 'Pendaftaran',
    nominalFee: kupon.nominalFee,
    catatanKasir: kupon.catatanKasir?.trim() || null,
  };
}

export function buildThermalReceiptTabUrl(
  kupon: KuponFee,
  paperSize: ThermalPaperSize,
): string {
  const payload = toThermalReceiptPayload(kupon);
  const encoded = encodeBase64Url(JSON.stringify(payload));
  const baseUrl = `${window.location.origin}${window.location.pathname}`;
  return `${baseUrl}?cetak=struk&paper=${paperSize}#d=${encoded}`;
}

export function isThermalReceiptPrintRoute(): boolean {
  try {
    const params = new URLSearchParams(window.location.search);
    return params.get('cetak') === 'struk';
  } catch {
    return false;
  }
}

function validatePayload(raw: unknown): ThermalReceiptPayload | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;
  if (typeof obj.noKupon !== 'string' || !obj.noKupon.trim()) return null;

  const nominal = typeof obj.nominalFee === 'number' && Number.isFinite(obj.nominalFee)
    ? obj.nominalFee
    : 0;

  return {
    noKupon: obj.noKupon.trim(),
    status: typeof obj.status === 'string' && obj.status.trim() ? obj.status.trim() : 'LUNAS (TUNAI)',
    waktuCair: typeof obj.waktuCair === 'string' ? obj.waktuCair : null,
    petugasKasir:
      typeof obj.petugasKasir === 'string' && obj.petugasKasir.trim()
        ? obj.petugasKasir.trim()
        : 'Petugas Kasir',
    kategori: obj.kategori === 'PKM_FASKES_1' ? 'PKM_FASKES_1' : 'MOHAT_DESA',
    namaPerujuk:
      typeof obj.namaPerujuk === 'string' && obj.namaPerujuk.trim() ? obj.namaPerujuk.trim() : '-',
    asalInstansi:
      typeof obj.asalInstansi === 'string' && obj.asalInstansi.trim()
        ? obj.asalInstansi.trim()
        : '-',
    namaPasien:
      typeof obj.namaPasien === 'string' && obj.namaPasien.trim() ? obj.namaPasien.trim() : '-',
    ruangRanap:
      typeof obj.ruangRanap === 'string' && obj.ruangRanap.trim() ? obj.ruangRanap.trim() : '-',
    tanggalInput: typeof obj.tanggalInput === 'string' ? obj.tanggalInput : '',
    petugasPendaftaran:
      typeof obj.petugasPendaftaran === 'string' && obj.petugasPendaftaran.trim()
        ? obj.petugasPendaftaran.trim()
        : 'Pendaftaran',
    nominalFee: nominal,
    catatanKasir:
      typeof obj.catatanKasir === 'string' && obj.catatanKasir.trim()
        ? obj.catatanKasir.trim()
        : null,
  };
}

export function parseThermalReceiptFromLocation(): {
  payload: ThermalReceiptPayload | null;
  paperSize: ThermalPaperSize;
} {
  const params = new URLSearchParams(window.location.search);
  const paperParam = params.get('paper');
  const paperSize: ThermalPaperSize =
    paperParam === '58mm' || paperParam === '80mm' ? paperParam : getSavedThermalPaperSize();

  const hash = window.location.hash.startsWith('#')
    ? window.location.hash.slice(1)
    : window.location.hash;
  const hashParams = new URLSearchParams(hash);
  const encoded = hashParams.get('d');

  if (encoded) {
    try {
      const jsonStr = decodeBase64Url(encoded);
      const parsed = validatePayload(JSON.parse(jsonStr));
      if (parsed) {
        try {
          sessionStorage.setItem(LAST_RECEIPT_SESSION_KEY, JSON.stringify(parsed));
        } catch {
          // Ignore sessionStorage errors
        }
        return { payload: parsed, paperSize };
      }
    } catch {
      // Fall through to sessionStorage fallback
    }
  }

  try {
    const cached = sessionStorage.getItem(LAST_RECEIPT_SESSION_KEY);
    if (cached) {
      const parsed = validatePayload(JSON.parse(cached));
      if (parsed) {
        return { payload: parsed, paperSize };
      }
    }
  } catch {
    // Ignore sessionStorage errors
  }

  return { payload: null, paperSize };
}
