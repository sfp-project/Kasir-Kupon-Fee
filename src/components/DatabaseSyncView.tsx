import {
  Check,
  Copy,
  Database,
  Flame,
  RefreshCw,
  RotateCcw,
  Save,
  Sheet,
  Webhook,
  Wifi,
} from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import {
  buildPendaftaranIntegrationSnippets,
  testSyncConnection,
} from '../services/databaseConnector.ts';
import type { SyncConfig, SyncProvider } from '../types/kupon.ts';
import { formatTanggalJam } from '../utils/formatters.ts';

interface DatabaseSyncViewProps {
  syncConfig: SyncConfig;
  realtimeConnected: boolean;
  onSaveConfig: (config: Partial<SyncConfig>) => Promise<void>;
  onPullNow: () => Promise<void>;
  onResetDemo: () => Promise<void>;
  onOpenSimulateModal: () => void;
}

const PROVIDERS: Array<{
  id: SyncProvider;
  title: string;
  subtitle: string;
}> = [
  {
    id: 'LOCAL_REST',
    title: 'Server API Kasir (Lokal / Webhook)',
    subtitle: 'Siap pakai — Web Pendaftaran kirim kupon langsung via POST /api/webhook/pendaftaran.',
  },
  {
    id: 'FIREBASE_FIRESTORE',
    title: 'Firebase Firestore',
    subtitle: 'Sinkronisasi ke koleksi Firestore yang sama dengan aplikasi Portal Pendaftaran RSUMB.',
  },
  {
    id: 'GOOGLE_SHEETS',
    title: 'Google Sheets Webhook',
    subtitle: 'Sinkronisasi dua arah melalui Google Apps Script Web App URL.',
  },
  {
    id: 'CUSTOM_WEBHOOK',
    title: 'REST API / Webhook Eksternal',
    subtitle: 'Sambungkan ke backend SIMRS atau server REST kustom rumah sakit.',
  },
];

export function DatabaseSyncView({
  syncConfig,
  realtimeConnected,
  onSaveConfig,
  onPullNow,
  onResetDemo,
  onOpenSimulateModal,
}: DatabaseSyncViewProps) {
  const [form, setForm] = useState<SyncConfig>(syncConfig);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [isPulling, setIsPulling] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [activeSnippet, setActiveSnippet] = useState<'webhook' | 'firestore' | 'sheets'>('webhook');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  useEffect(() => {
    setForm(syncConfig);
  }, [syncConfig]);

  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://kasir-kupon-rsumb.app';
  const snippets = buildPendaftaranIntegrationSnippets(origin, form);
  const lastSyncFormatted = formatTanggalJam(syncConfig.lastSyncAt);

  const handleCopy = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2000);
    } catch {
      // Fallback ignored if clipboard permission unavailable
    }
  };

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setTestResult(null);
    try {
      await onSaveConfig(form);
    } finally {
      setIsSaving(false);
    }
  };

  const handleTest = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const result = await testSyncConnection(form);
      setTestResult({ ok: result.ok, message: result.message });
    } catch (err) {
      setTestResult({
        ok: false,
        message: err instanceof Error ? err.message : 'Gagal menguji koneksi.',
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handlePull = async () => {
    setIsPulling(true);
    try {
      await onPullNow();
    } finally {
      setIsPulling(false);
    }
  };

  const handleReset = async () => {
    setIsResetting(true);
    try {
      await onResetDemo();
    } finally {
      setIsResetting(false);
    }
  };

  const renderProviderIcon = (id: SyncProvider) => {
    if (id === 'FIREBASE_FIRESTORE') return <Flame className="w-4 h-4 text-amber-700 shrink-0" />;
    if (id === 'GOOGLE_SHEETS') return <Sheet className="w-4 h-4 text-emerald-700 shrink-0" />;
    if (id === 'CUSTOM_WEBHOOK') return <Webhook className="w-4 h-4 text-slate-700 shrink-0" />;
    return <Database className="w-4 h-4 text-emerald-800 shrink-0" />;
  };

  return (
    <div className="space-y-6">
      {/* Header Overview */}
      <section className="neu-raised rounded-2xl p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900">
            Koneksi Database &amp; Sinkronisasi Web Pendaftaran
          </h1>
          <p className="text-sm text-slate-600 mt-1 max-w-3xl">
            Hubungkan aplikasi Kasir ini dengan database Kupon Fee milik Portal Pendaftaran RSUMB agar kupon masuk tampil otomatis secara real-time dan status Lunas terbaca kembali di Pendaftaran.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={onOpenSimulateModal}
            className="neu-btn px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold text-slate-800 cursor-pointer"
          >
            Simulasi Kupon Masuk
          </button>
          <button
            type="button"
            onClick={handleReset}
            disabled={isResetting}
            className="neu-btn inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold text-slate-700 cursor-pointer disabled:opacity-50"
          >
            <RotateCcw className="w-4 h-4" />
            <span>{isResetting ? 'Memuat Ulang...' : 'Reset Data Simulasi'}</span>
          </button>
        </div>
      </section>

      {/* Live Sync Status Summary Row */}
      <section className="neu-raised rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl neu-inset flex items-center justify-center shrink-0">
            <Wifi className={`w-5 h-5 ${realtimeConnected ? 'text-emerald-700' : 'text-amber-700'}`} />
          </div>
          <div>
            <p className="text-sm font-bold text-slate-900">
              {realtimeConnected
                ? 'Saluran Real-Time Kasir Aktif (SSE Tersambung)'
                : 'Menyambungkan Ulang Saluran Real-Time...'}
            </p>
            <p className="text-xs text-slate-600 mt-0.5">
              {syncConfig.lastSyncMessage || 'Siap menerima data kupon.'}
              {syncConfig.lastSyncAt ? (
                <span className="font-mono tabular-nums text-slate-500">
                  {' '}
                  · Terakhir: {lastSyncFormatted.lengkap}
                </span>
              ) : null}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handlePull}
          disabled={isPulling}
          className="neu-btn inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold text-emerald-800 whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-60"
        >
          <RefreshCw className={`w-4 h-4 ${isPulling ? 'animate-spin' : ''}`} />
          <span>{isPulling ? 'Menarik Data...' : 'Tarik Data Sekarang'}</span>
        </button>
      </section>

      {/* Main 2-Column Configuration & Integration Guide */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* Left: Connector Settings Form */}
        <form onSubmit={handleSave} className="xl:col-span-7 neu-raised rounded-2xl p-6 space-y-6">
          <div>
            <h2 className="text-base font-bold text-slate-900">Pilih Mode Konektor Database</h2>
            <p className="text-xs text-slate-600 mt-0.5">
              Pilih infrastruktur yang digunakan oleh aplikasi Portal Pendaftaran RSUMB.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {PROVIDERS.map((p) => {
              const selected = form.provider === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    setForm((prev) => ({ ...prev, provider: p.id }));
                    setTestResult(null);
                  }}
                  className={`rounded-xl p-4 text-left transition-all cursor-pointer ${
                    selected
                      ? 'neu-inset ring-2 ring-emerald-600/40'
                      : 'neu-btn'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {renderProviderIcon(p.id)}
                    <span className="text-xs sm:text-sm font-bold text-slate-900">{p.title}</span>
                  </div>
                  <p className="mt-1.5 text-xs text-slate-600 leading-relaxed">{p.subtitle}</p>
                </button>
              );
            })}
          </div>

          {/* Provider-Specific Configuration Fields */}
          <div className="pt-4 border-t border-slate-300/60 space-y-4">
            {form.provider === 'LOCAL_REST' ? (
              <div className="space-y-3">
                <p className="text-xs font-bold text-slate-700">
                  Endpoint Terima Kupon (Webhook dari Web Pendaftaran)
                </p>
                <div className="flex items-center gap-2">
                  <input
                    readOnly
                    type="text"
                    value={snippets.webhookEndpoint}
                    className="neu-inset-sm flex-1 h-11 px-3.5 rounded-xl font-mono text-xs text-slate-800"
                  />
                  <button
                    type="button"
                    onClick={() => handleCopy(snippets.webhookEndpoint, 'webhook-url')}
                    className="neu-btn h-11 px-3.5 rounded-xl inline-flex items-center gap-1.5 text-xs font-semibold text-slate-800 cursor-pointer shrink-0"
                  >
                    {copiedKey === 'webhook-url' ? (
                      <>
                        <Check className="w-4 h-4 text-emerald-700" />
                        <span>Tersalin</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4" />
                        <span>Salin URL</span>
                      </>
                    )}
                  </button>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Web Pendaftaran cukup mengirim HTTP <code className="font-mono font-semibold">POST</code> ke URL di atas saat kupon dibuat, dan membaca status <code className="font-mono font-semibold">LUNAS</code> melalui <code className="font-mono font-semibold">GET /api/kupon</code>.
                </p>
              </div>
            ) : null}

            {form.provider === 'FIREBASE_FIRESTORE' ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label htmlFor="fb-project" className="block text-xs font-bold text-slate-700 mb-1.5">
                    Firebase Project ID
                  </label>
                  <input
                    id="fb-project"
                    type="text"
                    value={form.firebaseProjectId}
                    onChange={(e) => setForm((prev) => ({ ...prev, firebaseProjectId: e.target.value }))}
                    placeholder="rsumb-portal-pendaftaran"
                    className="neu-inset-sm w-full h-11 px-3.5 rounded-xl font-mono text-sm text-slate-900"
                  />
                </div>
                <div>
                  <label htmlFor="fb-collection" className="block text-xs font-bold text-slate-700 mb-1.5">
                    Nama Collection Kupon
                  </label>
                  <input
                    id="fb-collection"
                    type="text"
                    value={form.firebaseCollection}
                    onChange={(e) => setForm((prev) => ({ ...prev, firebaseCollection: e.target.value }))}
                    placeholder="kupon_fee_mohat"
                    className="neu-inset-sm w-full h-11 px-3.5 rounded-xl font-mono text-sm text-slate-900"
                  />
                </div>
                <div>
                  <label htmlFor="fb-db" className="block text-xs font-bold text-slate-700 mb-1.5">
                    Firestore Database ID
                  </label>
                  <input
                    id="fb-db"
                    type="text"
                    value={form.firebaseDatabaseId}
                    onChange={(e) => setForm((prev) => ({ ...prev, firebaseDatabaseId: e.target.value }))}
                    placeholder="(default)"
                    className="neu-inset-sm w-full h-11 px-3.5 rounded-xl font-mono text-sm text-slate-900"
                  />
                </div>
              </div>
            ) : null}

            {form.provider === 'GOOGLE_SHEETS' ? (
              <div className="space-y-3">
                <label htmlFor="gs-url" className="block text-xs font-bold text-slate-700">
                  URL Google Apps Script Web App (Deploy /exec)
                </label>
                <input
                  id="gs-url"
                  type="url"
                  value={form.googleSheetsWebhookUrl}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, googleSheetsWebhookUrl: e.target.value }))
                  }
                  placeholder="https://script.google.com/macros/s/AKfycb.../exec"
                  className="neu-inset-sm w-full h-11 px-3.5 rounded-xl font-mono text-xs sm:text-sm text-slate-900"
                />
                <p className="text-xs text-slate-600">
                  Saat Kasir menekan tombol Lunas atau Batalkan Lunas, server otomatis mengirim update status ke Apps Script di atas.
                </p>
              </div>
            ) : null}

            {form.provider === 'CUSTOM_WEBHOOK' ? (
              <div className="space-y-4">
                <div>
                  <label htmlFor="rest-pull" className="block text-xs font-bold text-slate-700 mb-1.5">
                    URL Tarik Data Kupon (GET JSON dari Web Pendaftaran)
                  </label>
                  <input
                    id="rest-pull"
                    type="url"
                    value={form.restBaseUrl}
                    onChange={(e) => setForm((prev) => ({ ...prev, restBaseUrl: e.target.value }))}
                    placeholder="https://pendaftaran.rsumb.or.id/api/kupon-fee"
                    className="neu-inset-sm w-full h-11 px-3.5 rounded-xl font-mono text-xs sm:text-sm text-slate-900"
                  />
                </div>
                <div>
                  <label htmlFor="rest-push" className="block text-xs font-bold text-slate-700 mb-1.5">
                    URL Webhook Balik Status Lunas (POST ke Web Pendaftaran)
                  </label>
                  <input
                    id="rest-push"
                    type="url"
                    value={form.outboundWebhookUrl}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, outboundWebhookUrl: e.target.value }))
                    }
                    placeholder="https://pendaftaran.rsumb.or.id/api/webhook/kasir-lunas"
                    className="neu-inset-sm w-full h-11 px-3.5 rounded-xl font-mono text-xs sm:text-sm text-slate-900"
                  />
                </div>
              </div>
            ) : null}

            {/* Auto-Sync Polling Setting */}
            <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <label className="inline-flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.autoSyncEnabled}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, autoSyncEnabled: e.target.checked }))
                  }
                  className="w-4 h-4 rounded accent-emerald-700"
                />
                <span className="text-xs sm:text-sm font-semibold text-slate-800">
                  Aktifkan sinkronisasi otomatis berkala
                </span>
              </label>

              <div className="flex items-center gap-2">
                <label htmlFor="poll-interval" className="text-xs font-semibold text-slate-600">
                  Interval:
                </label>
                <select
                  id="poll-interval"
                  value={form.pollIntervalSeconds}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, pollIntervalSeconds: Number(e.target.value) }))
                  }
                  className="neu-inset-sm h-9 px-3 rounded-xl text-xs font-mono font-semibold text-slate-800 bg-[#E4EBF2]"
                >
                  <option value={10}>10 detik</option>
                  <option value={15}>15 detik</option>
                  <option value={30}>30 detik</option>
                  <option value={60}>60 detik</option>
                </select>
              </div>
            </div>
          </div>

          {testResult ? (
            <div
              className={`rounded-xl px-4 py-3 text-xs font-semibold ${
                testResult.ok
                  ? 'bg-emerald-100/90 text-emerald-900 border border-emerald-300'
                  : 'bg-amber-100/90 text-amber-950 border border-amber-300'
              }`}
            >
              {testResult.message}
            </div>
          ) : null}

          <div className="pt-3 border-t border-slate-300/60 flex flex-wrap items-center justify-end gap-3">
            <button
              type="button"
              onClick={handleTest}
              disabled={isTesting}
              className="neu-btn px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold text-slate-800 cursor-pointer disabled:opacity-60"
            >
              {isTesting ? 'Menguji Koneksi...' : 'Uji Koneksi'}
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="neu-btn-emerald inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold cursor-pointer disabled:opacity-60"
            >
              <Save className="w-4 h-4" />
              <span>{isSaving ? 'Menyimpan...' : 'Simpan Konfigurasi'}</span>
            </button>
          </div>
        </form>

        {/* Right: Copyable Integration Guide for Web Pendaftaran */}
        <div className="xl:col-span-5 neu-raised rounded-2xl p-6 space-y-4">
          <div>
            <h2 className="text-base font-bold text-slate-900">Panduan Integrasi Web Pendaftaran</h2>
            <p className="text-xs text-slate-600 mt-0.5">
              Salin struktur payload atau skrip berikut untuk menyambungkan modul Kupon Fee di Portal Pendaftaran RSUMB.
            </p>
          </div>

          <div className="neu-inset-sm p-1 rounded-xl inline-flex items-center gap-1">
            <button
              type="button"
              onClick={() => setActiveSnippet('webhook')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                activeSnippet === 'webhook' ? 'neu-raised-sm text-slate-900' : 'text-slate-600'
              }`}
            >
              REST Webhook
            </button>
            <button
              type="button"
              onClick={() => setActiveSnippet('firestore')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                activeSnippet === 'firestore' ? 'neu-raised-sm text-slate-900' : 'text-slate-600'
              }`}
            >
              Firestore Schema
            </button>
            <button
              type="button"
              onClick={() => setActiveSnippet('sheets')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                activeSnippet === 'sheets' ? 'neu-raised-sm text-slate-900' : 'text-slate-600'
              }`}
            >
              Google Sheets
            </button>
          </div>

          <div className="relative">
            <pre className="neu-inset rounded-xl p-4 text-[11px] leading-relaxed font-mono text-slate-800 overflow-x-auto max-h-[360px]">
              <code>
                {activeSnippet === 'webhook'
                  ? snippets.pendaftaranFetchSnippet
                  : activeSnippet === 'firestore'
                    ? snippets.firestoreSchemaSnippet
                    : snippets.appsScriptSnippet}
              </code>
            </pre>

            <button
              type="button"
              onClick={() =>
                handleCopy(
                  activeSnippet === 'webhook'
                    ? snippets.pendaftaranFetchSnippet
                    : activeSnippet === 'firestore'
                      ? snippets.firestoreSchemaSnippet
                      : snippets.appsScriptSnippet,
                  `snippet-${activeSnippet}`,
                )
              }
              className="neu-btn absolute top-3 right-3 px-2.5 py-1.5 rounded-lg inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-800 cursor-pointer"
            >
              {copiedKey === `snippet-${activeSnippet}` ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-700" />
                  <span>Disalin</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Salin</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
