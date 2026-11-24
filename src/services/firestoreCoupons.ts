import {
  Timestamp,
  collection,
  doc,
  getDocs,
  onSnapshot,
  updateDoc,
  type DocumentData,
} from 'firebase/firestore';
import {
  MOHAT_COUPONS_COLLECTION,
  OperationType,
  buildFirestoreErrorInfo,
  db,
  handleFirestoreError,
} from '../firebase.ts';
import type { KuponFee, KuponKategori, KuponStatus, PenjaminPasien } from '../types/kupon.ts';

function pickString(data: DocumentData, keys: string[], fallback = ''): string {
  for (const key of keys) {
    const val = data[key];
    if (typeof val === 'string' && val.trim().length > 0) {
      return val.trim();
    }
    if (typeof val === 'number' && Number.isFinite(val)) {
      return String(val);
    }
  }
  return fallback;
}

function parseFirestoreTimestamp(val: unknown): string | null {
  if (!val) return null;
  if (val instanceof Timestamp) {
    return val.toDate().toISOString();
  }
  if (typeof val === 'object' && val !== null) {
    const maybeTs = val as { toDate?: () => Date; seconds?: number; _seconds?: number };
    if (typeof maybeTs.toDate === 'function') {
      const d = maybeTs.toDate();
      return Number.isNaN(d.getTime()) ? null : d.toISOString();
    }
    const secs = typeof maybeTs.seconds === 'number' ? maybeTs.seconds : maybeTs._seconds;
    if (typeof secs === 'number' && Number.isFinite(secs)) {
      return new Date(secs * 1000).toISOString();
    }
  }
  if (typeof val === 'number' && Number.isFinite(val)) {
    const ms = val < 1e12 ? val * 1000 : val;
    const d = new Date(ms);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }
  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (!trimmed) return null;
    const direct = new Date(trimmed);
    if (!Number.isNaN(direct.getTime())) {
      return direct.toISOString();
    }
    // Support DD/MM/YYYY or DD-MM-YYYY (with optional HH:mm)
    const idMatch = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})(?:[\s,T]+(\d{1,2})[:.](\d{2}))?/.exec(trimmed);
    if (idMatch) {
      const dd = Number(idMatch[1]);
      const mm = Number(idMatch[2]) - 1;
      const yyyy = Number(idMatch[3]);
      const hh = idMatch[4] ? Number(idMatch[4]) : 8;
      const min = idMatch[5] ? Number(idMatch[5]) : 0;
      const parsed = new Date(yyyy, mm, dd, hh, min, 0);
      if (!Number.isNaN(parsed.getTime())) {
        return parsed.toISOString();
      }
    }
  }
  return null;
}

function pickTimestamp(data: DocumentData, keys: string[]): string | null {
  for (const key of keys) {
    if (data[key] !== undefined && data[key] !== null && data[key] !== '') {
      const parsed = parseFirestoreTimestamp(data[key]);
      if (parsed) return parsed;
    }
  }
  return null;
}

function parseRupiahNumber(val: unknown): number | null {
  if (typeof val === 'number' && Number.isFinite(val)) {
    return Math.round(val);
  }
  if (typeof val === 'string') {
    const digits = val.replace(/\D/g, '');
    if (digits.length > 0) {
      const parsed = Number.parseInt(digits, 10);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return null;
}

function normalizeStatus(rawStatus: string): KuponStatus {
  const s = rawStatus.trim().toLowerCase();
  if (
    s === 'lunas' ||
    s.includes('lunas') ||
    s === 'paid' ||
    s === 'selesai' ||
    s === 'dibayar' ||
    s === 'cair'
  ) {
    return 'LUNAS';
  }
  return 'MENUNGGU_KASIR';
}

function normalizePenjamin(raw: string): PenjaminPasien {
  const s = raw.trim().toLowerCase();
  if (s.includes('jasa') || s.includes('raharja') || s === 'jr') {
    return 'JASA_RAHARJA';
  }
  if (s.includes('umum') || s.includes('mandiri') || s.includes('tunai') || s.includes('pribadi')) {
    return 'UMUM';
  }
  return 'BPJS';
}

function normalizeKategori(rawKategori: string, asalInstansi: string, nominal: number): KuponKategori {
  const combined = `${rawKategori} ${asalInstansi}`.toLowerCase();
  if (
    rawKategori.toLowerCase().includes('pkm') ||
    rawKategori.toLowerCase().includes('faskes') ||
    rawKategori.toLowerCase().includes('puskesmas') ||
    rawKategori.toLowerCase().includes('klinik') ||
    rawKategori.toLowerCase().includes('bidan') ||
    rawKategori.toLowerCase().includes('perujuk')
  ) {
    return 'PKM_FASKES_1';
  }
  if (
    rawKategori.toLowerCase().includes('mohat') ||
    rawKategori.toLowerCase().includes('desa') ||
    rawKategori.toLowerCase().includes('ambulans')
  ) {
    return 'MOHAT_DESA';
  }
  if (
    combined.includes('pkm') ||
    combined.includes('puskesmas') ||
    combined.includes('klinik') ||
    combined.includes('faskes')
  ) {
    return 'PKM_FASKES_1';
  }
  if (combined.includes('mohat') || combined.includes('desa')) {
    return 'MOHAT_DESA';
  }
  return nominal === 25000 ? 'MOHAT_DESA' : 'PKM_FASKES_1';
}

export function mapFirestoreDocToKupon(docId: string, data: DocumentData): KuponFee {
  const noKupon = pickString(
    data,
    [
      'noKupon',
      'couponNumber',
      'couponCode',
      'nomorKupon',
      'kodeKupon',
      'no_kupon',
      'coupon_number',
      'coupon_code',
      'code',
      'kuponNo',
      'idKupon',
    ],
    docId,
  );

  const rawStatus = pickString(
    data,
    ['status', 'statusKasir', 'statusPencairan', 'paymentStatus', 'status_kasir'],
    'Menunggu Kasir',
  );
  const status = normalizeStatus(rawStatus);

  // Detect nominal & preserve original key for bidirectional write-back
  const nominalKeys =
    status === 'LUNAS'
      ? [
          'nominalAkhirCair',
          'nominalFee',
          'nominal',
          'fee',
          'amount',
          'nominalCair',
          'tarif',
          'jumlah',
          'totalFee',
          'nominal_fee',
        ]
      : [
          'nominalFee',
          'nominal',
          'fee',
          'amount',
          'nominalAkhirCair',
          'nominalCair',
          'tarif',
          'jumlah',
          'totalFee',
          'nominal_fee',
        ];

  let nominalFee = 0;
  let rawNominalKey: string | undefined;
  for (const key of nominalKeys) {
    const parsed = parseRupiahNumber(data[key]);
    if (parsed !== null && parsed >= 0) {
      nominalFee = parsed;
      if (key !== 'nominalAkhirCair') {
        rawNominalKey = key;
      }
      break;
    }
  }
  if (!rawNominalKey) {
    for (const candidate of ['nominalFee', 'nominal', 'fee', 'amount']) {
      if (data[candidate] !== undefined) {
        rawNominalKey = candidate;
        break;
      }
    }
  }

  const tanggalInput =
    pickTimestamp(data, [
      'tanggalInput',
      'createdAt',
      'created_at',
      'timestamp',
      'waktuInput',
      'tglInput',
      'tanggal',
      'date',
      'inputAt',
    ]) || new Date().toISOString();

  const namaPasien = pickString(
    data,
    ['namaPasien', 'patientName', 'pasien', 'nama_pasien', 'patient_name', 'nama'],
    '-',
  );

  const noRm =
    pickString(data, ['noRm', 'noRM', 'rm', 'no_rm', 'medicalRecordNumber', 'norm']) || undefined;

  const ruangRanap = pickString(
    data,
    ['ruangRanap', 'ruangan', 'ruang', 'room', 'kamar', 'unit', 'poli', 'ward', 'ruang_ranap'],
    'Rawat Inap',
  );

  const rawPenjamin = pickString(
    data,
    [
      'penjamin',
      'jaminan',
      'insurance',
      'caraBayar',
      'jenisPasien',
      'tipePasien',
      'paymentType',
      'statusPasien',
    ],
    'BPJS',
  );
  const penjamin = normalizePenjamin(rawPenjamin);

  const asalInstansi = pickString(
    data,
    [
      'asalInstansi',
      'instansi',
      'asal',
      'desa',
      'asalDesa',
      'faskesAsal',
      'origin',
      'institution',
      'village',
      'alamat',
      'asal_instansi',
      'unitAsal',
    ],
    '-',
  );

  const rawKategori = pickString(
    data,
    ['kategori', 'category', 'jenis', 'jenisFee', 'tipe', 'feeType', 'jenisPerujuk', 'tipePerujuk'],
    '',
  );
  const kategori = normalizeKategori(rawKategori, asalInstansi, nominalFee);

  const namaPerujuk = pickString(
    data,
    [
      'namaPerujuk',
      'namaSopir',
      'driverName',
      'referrerName',
      'sopir',
      'perujuk',
      'pengantar',
      'namaPengantar',
      'driver',
      'nama_sopir',
      'nama_perujuk',
    ],
    '-',
  );

  const noHpPerujuk =
    pickString(data, ['noHpPerujuk', 'noHp', 'hp', 'phone', 'telepon', 'whatsapp', 'noWa', 'no_hp']) ||
    undefined;

  const petugasPendaftaran = pickString(
    data,
    [
      'petugasPendaftaran',
      'staffName',
      'petugas',
      'staf',
      'inputBy',
      'createdBy',
      'operator',
      'namaPetugas',
      'petugas_pendaftaran',
    ],
    'Pendaftaran',
  );

  const waktuCair =
    status === 'LUNAS'
      ? pickTimestamp(data, [
          'waktuCair',
          'paidAt',
          'tanggalCair',
          'disbursedAt',
          'waktu_cair',
          'tglCair',
          'updatedAt',
        ])
      : null;

  const petugasKasir =
    status === 'LUNAS'
      ? pickString(data, ['petugasKasir', 'cashierName', 'kasir', 'paidBy', 'petugas_kasir']) || null
      : null;

  const catatanKasir =
    pickString(data, [
      'catatanPencairan',
      'catatanKasir',
      'cashierNotes',
      'catatan_kasir',
      'keteranganKasir',
      'catatan',
      'notes',
    ]) || null;

  const riwayatBatal =
    data.riwayatBatal && typeof data.riwayatBatal === 'object'
      ? {
          waktu: String(data.riwayatBatal.waktu ?? ''),
          alasan: String(data.riwayatBatal.alasan ?? ''),
          petugasSebelumnya: data.riwayatBatal.petugasSebelumnya
            ? String(data.riwayatBatal.petugasSebelumnya)
            : null,
        }
      : null;

  return {
    id: docId,
    noKupon,
    tanggalInput,
    namaPasien,
    noRm,
    ruangRanap,
    penjamin,
    kategori,
    namaPerujuk,
    asalInstansi,
    noHpPerujuk,
    nominalFee,
    status,
    petugasPendaftaran,
    waktuCair,
    petugasKasir,
    catatanKasir,
    riwayatBatal,
    sumberSync: 'FIRESTORE_PORTAL_PENDAFTARAN',
    rawNominalKey,
    rawKategoriLabel: rawKategori || undefined,
  };
}

function sortCouponsNewestFirst(items: KuponFee[]): KuponFee[] {
  return [...items].sort(
    (a, b) => new Date(b.tanggalInput).getTime() - new Date(a.tanggalInput).getTime(),
  );
}

export function subscribeFirestoreCoupons(
  onData: (kupons: KuponFee[]) => void,
  onError: (error: Error, rawError: unknown) => void,
): () => void {
  const colRef = collection(db, MOHAT_COUPONS_COLLECTION);

  return onSnapshot(
    colRef,
    (snapshot) => {
      const mapped = snapshot.docs.map((snap) => mapFirestoreDocToKupon(snap.id, snap.data()));
      onData(sortCouponsNewestFirst(mapped));
    },
    (error) => {
      const errInfo = buildFirestoreErrorInfo(error, OperationType.LIST, MOHAT_COUPONS_COLLECTION);
      console.error('Firestore Error: ', JSON.stringify(errInfo));
      onError(new Error(JSON.stringify(errInfo)), error);
    },
  );
}

export async function fetchFirestoreCoupons(): Promise<KuponFee[]> {
  try {
    const snapshot = await getDocs(collection(db, MOHAT_COUPONS_COLLECTION));
    const mapped = snapshot.docs.map((snap) => mapFirestoreDocToKupon(snap.id, snap.data()));
    return sortCouponsNewestFirst(mapped);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, MOHAT_COUPONS_COLLECTION);
  }
}

export async function markFirestoreCouponLunas(
  kupon: KuponFee,
  payload: {
    nominalFee: number;
    petugasKasir: string;
    catatanKasir: string;
  },
): Promise<KuponFee> {
  const docPath = `${MOHAT_COUPONS_COLLECTION}/${kupon.id}`;
  const nowIso = new Date().toISOString();
  const finalNominal = Math.round(payload.nominalFee);
  const officerName = payload.petugasKasir.trim() || 'Petugas Kasir';
  const noteText = payload.catatanKasir.trim();

  const updatePayload: Record<string, unknown> = {
    status: 'Lunas',
    nominalFee: finalNominal,
    nominalAkhirCair: finalNominal,
    petugasKasir: officerName,
    catatanPencairan: noteText,
    catatanKasir: noteText,
    waktuCair: nowIso,
    paidAt: nowIso,
    updatedAt: nowIso,
  };

  // Keep Portal Pendaftaran's original nominal key synchronized if it used a different field name
  if (
    kupon.rawNominalKey &&
    kupon.rawNominalKey !== 'nominalFee' &&
    kupon.rawNominalKey !== 'nominalAkhirCair'
  ) {
    updatePayload[kupon.rawNominalKey] = finalNominal;
  }

  try {
    await updateDoc(doc(db, MOHAT_COUPONS_COLLECTION, kupon.id), updatePayload);
    return {
      ...kupon,
      nominalFee: finalNominal,
      status: 'LUNAS',
      waktuCair: nowIso,
      petugasKasir: officerName,
      catatanKasir: noteText || null,
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, docPath);
  }
}

export async function cancelFirestoreCouponLunas(
  kupon: KuponFee,
  alasan?: string,
): Promise<KuponFee> {
  const docPath = `${MOHAT_COUPONS_COLLECTION}/${kupon.id}`;
  const nowIso = new Date().toISOString();
  const riwayatBatal = {
    waktu: nowIso,
    alasan: alasan?.trim() || 'Pembatalan oleh petugas kasir (koreksi input)',
    petugasSebelumnya: kupon.petugasKasir ?? null,
  };

  try {
    await updateDoc(doc(db, MOHAT_COUPONS_COLLECTION, kupon.id), {
      status: 'Menunggu Kasir',
      waktuCair: null,
      paidAt: null,
      petugasKasir: null,
      catatanPencairan: null,
      catatanKasir: null,
      riwayatBatal,
      updatedAt: nowIso,
    });
    return {
      ...kupon,
      status: 'MENUNGGU_KASIR',
      waktuCair: null,
      petugasKasir: null,
      catatanKasir: null,
      riwayatBatal,
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, docPath);
  }
}
