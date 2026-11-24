import {
  CheckCircle2,
  Database,
  Flame,
  LogIn,
  LogOut,
  RefreshCw,
  ShieldCheck,
  Wifi,
} from 'lucide-react';
import type { User } from 'firebase/auth';
import { useState } from 'react';
import { FIREBASE_META, testFirestoreConnection } from '../firebase.ts';
import { formatTanggalJam } from '../utils/formatters.ts';

interface DatabaseSyncViewProps {
  realtimeConnected: boolean;
  totalDocuments: number;
  lastSyncedAt: string | null;
  authUser: User | null;
  isAuthLoading: boolean;
  isSyncing: boolean;
  onRefreshNow: () => Promise<void>;
  onSignInGoogle: () => Promise<void>;
  onSignOut: () => Promise<void>;
}

const FIELD_MAPPINGS = [
  {
    kasirField: 'No. Kupon',
    firestoreFields: 'noKupon / couponNumber / couponCode',
    direction: 'Baca dari Pendaftaran',
  },
  {
    kasirField: 'Tanggal / Jam Input',
    firestoreFields: 'tanggalInput / createdAt / timestamp',
    direction: 'Baca dari Pendaftaran',
  },
  {
    kasirField: 'Pasien, Ruang & Penjamin',
    firestoreFields: 'namaPasien, ruangRanap, penjamin',
    direction: 'Baca dari Pendaftaran',
  },
  {
    kasirField: 'Kategori & Perujuk / Sopir',
    firestoreFields: 'kategori, namaPerujuk / namaSopir, asalInstansi',
    direction: 'Baca dari Pendaftaran',
  },
  {
    kasirField: 'Nominal Fee / Nominal Akhir Cair',
    firestoreFields: 'nominalFee, nominalAkhirCair',
    direction: 'Sinkron Dua Arah (updateDoc)',
  },
  {
    kasirField: 'Status Pencairan',
    firestoreFields: 'status ("Menunggu Kasir" → "Lunas")',
    direction: 'Sinkron Dua Arah (updateDoc)',
  },
  {
    kasirField: 'Petugas Kasir, Catatan & Waktu Cair',
    firestoreFields: 'petugasKasir, catatanPencairan, catatanKasir, waktuCair',
    direction: 'Ditulis Kasir (updateDoc)',
  },
];

export function DatabaseSyncView({
  realtimeConnected,
  totalDocuments,
  lastSyncedAt,
  authUser,
  isAuthLoading,
  isSyncing,
  onRefreshNow,
  onSignInGoogle,
  onSignOut,
}: DatabaseSyncViewProps) {
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  const lastSyncFormatted = formatTanggalJam(lastSyncedAt);

  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const result = await testFirestoreConnection();
      setTestResult({ ok: result.ok, message: result.message });
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Overview */}
      <section className="neu-raised rounded-2xl p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900">
            Koneksi Firebase Firestore — Portal Pendaftaran RSUMB
          </h1>
          <p className="text-sm text-slate-600 mt-1 max-w-3xl">
            Web Kasir terhubung langsung secara real-time (<code className="font-mono text-xs font-semibold">onSnapshot</code>) ke koleksi <code className="font-mono text-xs font-semibold">{FIREBASE_META.collection}</code> milik Portal Pendaftaran. Data simulasi bawaan telah dinonaktifkan sehingga hanya data kupon asli yang ditampilkan.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={handleTestConnection}
            disabled={isTesting}
            className="neu-btn px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold text-slate-800 whitespace-nowrap cursor-pointer disabled:opacity-60"
          >
            {isTesting ? 'Menguji Koneksi...' : 'Uji Koneksi Firestore'}
          </button>
          <button
            type="button"
            onClick={() => void onRefreshNow()}
            disabled={isSyncing}
            className="neu-btn-emerald inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap cursor-pointer disabled:opacity-60"
          >
            <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>{isSyncing ? 'Memuat Data...' : 'Muat Ulang Data (getDocs)'}</span>
          </button>
        </div>
      </section>

      {testResult ? (
        <div
          className={`rounded-2xl px-5 py-3.5 text-xs sm:text-sm font-semibold ${
            testResult.ok
              ? 'bg-emerald-100/90 text-emerald-900 border border-emerald-300'
              : 'bg-amber-100/90 text-amber-950 border border-amber-300'
          }`}
        >
          {testResult.message}
        </div>
      ) : null}

      {/* Live Status & Auth Row */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-stretch">
        {/* Left: Active Firestore Config */}
        <section className="xl:col-span-7 neu-raised rounded-2xl p-6 space-y-5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl neu-inset flex items-center justify-center shrink-0">
                <Flame className="w-5 h-5 text-amber-700" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900">Konfigurasi Firestore Aktif</h2>
                <p className="text-xs text-slate-600">
                  Terhubung langsung ke database bersama Portal Pendaftaran RSUMB
                </p>
              </div>
            </div>
            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-800 whitespace-nowrap">
              <Wifi className={`w-4 h-4 ${realtimeConnected ? 'text-emerald-700' : 'text-amber-600'}`} />
              <span>{realtimeConnected ? 'Real-Time Aktif' : 'Menghubungkan...'}</span>
            </span>
          </div>

          <dl className="neu-inset rounded-xl p-4 space-y-3 text-xs sm:text-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
              <dt className="font-semibold text-slate-500">Project ID</dt>
              <dd className="font-mono font-bold text-slate-900 break-all">{FIREBASE_META.projectId}</dd>
            </div>
            <div className="h-px bg-slate-300/60" />
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
              <dt className="font-semibold text-slate-500">Firestore Database ID</dt>
              <dd className="font-mono font-bold text-slate-900 break-all">
                {FIREBASE_META.firestoreDatabaseId}
              </dd>
            </div>
            <div className="h-px bg-slate-300/60" />
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
              <dt className="font-semibold text-slate-500">Collection Target</dt>
              <dd className="font-mono font-bold text-emerald-800">{FIREBASE_META.collection}</dd>
            </div>
            <div className="h-px bg-slate-300/60" />
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
              <dt className="font-semibold text-slate-500">Dokumen Terbaca</dt>
              <dd className="font-mono tabular-nums font-bold text-slate-900">
                {totalDocuments} dokumen kupon
              </dd>
            </div>
            <div className="h-px bg-slate-300/60" />
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
              <dt className="font-semibold text-slate-500">Sinkronisasi Terakhir</dt>
              <dd className="font-mono tabular-nums text-slate-700">{lastSyncFormatted.lengkap}</dd>
            </div>
          </dl>
        </section>

        {/* Right: Authentication Card */}
        <section className="xl:col-span-5 neu-raised rounded-2xl p-6 flex flex-col justify-between space-y-5">
          <div className="space-y-4">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl neu-inset flex items-center justify-center shrink-0">
                <ShieldCheck className="w-5 h-5 text-emerald-700" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900">Autentikasi Akun Google</h2>
                <p className="text-xs text-slate-600">
                  Digunakan bila aturan Firestore Portal Pendaftaran memerlukan login akun staf.
                </p>
              </div>
            </div>

            <div className="neu-inset rounded-xl p-4">
              {authUser ? (
                <div className="space-y-1.5">
                  <div className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-800">
                    <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                    <span>Masuk sebagai staf terverifikasi</span>
                  </div>
                  <p className="text-sm font-bold text-slate-900">
                    {authUser.displayName || 'Petugas RSUMB'}
                  </p>
                  <p className="text-xs font-mono text-slate-600 break-all">{authUser.email}</p>
                </div>
              ) : (
                <div className="space-y-1">
                  <p className="text-sm font-bold text-slate-800">Belum masuk dengan akun Google</p>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Jika data tidak muncul atau muncul pesan izin akses ditolak saat menandai Lunas, klik tombol di bawah untuk masuk menggunakan akun Google RSUMB.
                  </p>
                </div>
              )}
            </div>
          </div>

          <div>
            {authUser ? (
              <button
                type="button"
                onClick={() => void onSignOut()}
                disabled={isAuthLoading}
                className="neu-btn w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-red-700 cursor-pointer disabled:opacity-60"
              >
                <LogOut className="w-4 h-4" />
                <span>Keluar Akun Google</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void onSignInGoogle()}
                disabled={isAuthLoading}
                className="neu-btn-emerald w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold cursor-pointer disabled:opacity-60"
              >
                <LogIn className="w-4 h-4" />
                <span>{isAuthLoading ? 'Memproses Login...' : 'Masuk dengan Google (RSUMB)'}</span>
              </button>
            )}
          </div>
        </section>
      </div>

      {/* Field Mapping Reference Table */}
      <section className="neu-raised rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-300/60 flex items-center gap-2.5">
          <Database className="w-4 h-4 text-emerald-700 shrink-0" />
          <div>
            <h2 className="text-sm sm:text-base font-bold text-slate-900">
              Pemetaan Field Dokumen Koleksi <code className="font-mono text-emerald-800">mohat_coupons</code>
            </h2>
            <p className="text-xs text-slate-600 mt-0.5">
              Saat Kasir menekan &ldquo;Konfirmasi Bayar &amp; Tandai Lunas&rdquo;, dokumen langsung diperbarui melalui <code className="font-mono">updateDoc</code> agar langsung tampil di Riwayat Portal Pendaftaran.
            </p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs sm:text-sm min-w-[680px]">
            <thead>
              <tr className="border-b border-slate-300/60 bg-[#E6ECF3]/70 text-xs font-bold text-slate-600">
                <th className="py-3 pl-6 pr-3">Kolom di Web Kasir</th>
                <th className="py-3 px-3">Field Dokumen Firestore</th>
                <th className="py-3 pl-3 pr-6">Arah Sinkronisasi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-300/50">
              {FIELD_MAPPINGS.map((row) => (
                <tr key={row.kasirField} className="hover:bg-white/40">
                  <td className="py-3 pl-6 pr-3 font-semibold text-slate-900">{row.kasirField}</td>
                  <td className="py-3 px-3 font-mono text-xs text-slate-700">{row.firestoreFields}</td>
                  <td className="py-3 pl-3 pr-6 text-xs font-semibold text-emerald-800">
                    {row.direction}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
