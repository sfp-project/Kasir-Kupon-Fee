import { CheckCircle2, Info, Printer, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { parseLocalDateKey, toLocalDateKey } from './components/CalendarDateFilter.tsx';
import { CancelLunasModal } from './components/CancelLunasModal.tsx';
import { DailyReportModal } from './components/DailyReportModal.tsx';
import { DatabaseSyncView } from './components/DatabaseSyncView.tsx';
import { HistoryView } from './components/HistoryView.tsx';
import { KuponTable } from './components/KuponTable.tsx';
import { PayConfirmModal } from './components/PayConfirmModal.tsx';
import { ReceiptModal } from './components/ReceiptModal.tsx';
import {
  SearchFilterBar,
  type DateScope,
  type KategoriFilter,
  type StatusFilter,
} from './components/SearchFilterBar.tsx';
import { SimulateCouponModal } from './components/SimulateCouponModal.tsx';
import { SummaryCards } from './components/SummaryCards.tsx';
import { TopBar, type ActiveTab } from './components/TopBar.tsx';
import { createDefaultSyncConfig } from './data/seedKupons.ts';
import {
  cancelKuponLunas,
  createIncomingKupon,
  fetchKupons,
  markKuponLunas,
  resetDemoKupons,
  saveSyncConfig,
  subscribeRealtimeKupons,
  triggerSyncPull,
} from './services/databaseConnector.ts';
import type { CashSummary, KuponFee, NewKuponPayload, SyncConfig } from './types/kupon.ts';
import { exportKuponsToCsv, formatRupiah, isSameLocalDay } from './utils/formatters.ts';

interface ToastNotice {
  id: number;
  tone: 'success' | 'info' | 'error';
  message: string;
  receiptKupon?: KuponFee;
}

const CASHIER_NAME_STORAGE_KEY = 'rsumb_kasir_active_officer';

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('daftar');
  const [kupons, setKupons] = useState<KuponFee[]>([]);
  const [syncConfig, setSyncConfig] = useState<SyncConfig>(createDefaultSyncConfig);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [realtimeConnected, setRealtimeConnected] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Filters (default "Menunggu Kasir" as requested)
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('MENUNGGU_KASIR');
  const [kategoriFilter, setKategoriFilter] = useState<KategoriFilter>('SEMUA');
  const [dateScope, setDateScope] = useState<DateScope>('SEMUA_TANGGAL');
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [highlightedId, setHighlightedId] = useState<string | null>(null);

  // Modals state
  const [payingKupon, setPayingKupon] = useState<KuponFee | null>(null);
  const [cancellingKupon, setCancellingKupon] = useState<KuponFee | null>(null);
  const [receiptKupon, setReceiptKupon] = useState<KuponFee | null>(null);
  const [isDailyReportOpen, setIsDailyReportOpen] = useState(false);
  const [isSimulateOpen, setIsSimulateOpen] = useState(false);
  const [isActionSubmitting, setIsActionSubmitting] = useState(false);

  // Remembered cashier officer name for faster payouts
  const [defaultCashierName, setDefaultCashierName] = useState<string>(() => {
    try {
      return localStorage.getItem(CASHIER_NAME_STORAGE_KEY) || '';
    } catch {
      return '';
    }
  });

  // Toast feedback
  const [toast, setToast] = useState<ToastNotice | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  const showToast = useCallback(
    (tone: ToastNotice['tone'], message: string, receipt?: KuponFee) => {
      const id = Date.now();
      setToast({ id, tone, message, receiptKupon: receipt });
    },
    [],
  );

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => {
      setToast((curr) => (curr?.id === toast.id ? null : curr));
    }, 5500);
    return () => clearTimeout(timer);
  }, [toast]);

  // Initial load
  const loadInitialData = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const data = await fetchKupons();
      setKupons(data.kupons);
      setSyncConfig(data.syncConfig);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Gagal memuat data kasir.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadInitialData();
  }, [loadInitialData]);

  // Real-time Server-Sent Events subscription
  useEffect(() => {
    const unsubscribe = subscribeRealtimeKupons({
      onConnectionChange: (connected) => setRealtimeConnected(connected),
      onCreated: (newKupon) => {
        setKupons((prev) => {
          if (prev.some((k) => k.id === newKupon.id)) return prev;
          return [newKupon, ...prev];
        });
        setHighlightedId(newKupon.id);
        setTimeout(() => setHighlightedId((curr) => (curr === newKupon.id ? null : curr)), 4000);
        showToast(
          'info',
          `Kupon baru masuk: ${newKupon.noKupon} — ${newKupon.namaPerujuk} (${formatRupiah(newKupon.nominalFee)})`,
        );
      },
      onUpdated: (updated) => {
        setKupons((prev) => prev.map((k) => (k.id === updated.id ? updated : k)));
      },
      onReset: (nextList) => {
        setKupons(nextList);
      },
    });
    return unsubscribe;
  }, [showToast]);

  // Optional external polling when external database provider is configured
  useEffect(() => {
    if (!syncConfig.autoSyncEnabled || syncConfig.provider === 'LOCAL_REST') {
      return;
    }
    const intervalMs = Math.max(10, syncConfig.pollIntervalSeconds || 15) * 1000;
    const timer = setInterval(async () => {
      try {
        const res = await triggerSyncPull();
        setKupons(res.kupons);
        setSyncConfig(res.syncConfig);
      } catch {
        // Quietly retry next cycle
      }
    }, intervalMs);
    return () => clearInterval(timer);
  }, [syncConfig.autoSyncEnabled, syncConfig.provider, syncConfig.pollIntervalSeconds]);

  // Keyboard shortcut: press '/' anywhere outside inputs to focus barcode search
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isTyping =
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.tagName === 'SELECT';
      if (!isTyping && e.key === '/' && activeTab === 'daftar') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [activeTab]);

  // Today's Cash Summary KPIs
  const { todaySummary, totalAllPendingCount, totalAllPendingNominal } = useMemo(() => {
    const now = new Date();
    const summary: CashSummary = {
      menungguCount: 0,
      menungguTotal: 0,
      lunasCount: 0,
      lunasTotal: 0,
      totalTodayCount: 0,
      totalTodayNominal: 0,
      mohatTodayCount: 0,
      mohatTodayNominal: 0,
      faskesTodayCount: 0,
      faskesTodayNominal: 0,
    };

    let allPendingCount = 0;
    let allPendingNominal = 0;

    for (const k of kupons) {
      if (k.status === 'MENUNGGU_KASIR') {
        allPendingCount += 1;
        allPendingNominal += k.nominalFee;
      }

      const inputToday = isSameLocalDay(k.tanggalInput, now);
      const paidToday = k.status === 'LUNAS' && isSameLocalDay(k.waktuCair, now);

      if (inputToday) {
        summary.totalTodayCount += 1;
        summary.totalTodayNominal += k.nominalFee;
        if (k.kategori === 'MOHAT_DESA') {
          summary.mohatTodayCount += 1;
          summary.mohatTodayNominal += k.nominalFee;
        } else {
          summary.faskesTodayCount += 1;
          summary.faskesTodayNominal += k.nominalFee;
        }
        if (k.status === 'MENUNGGU_KASIR') {
          summary.menungguCount += 1;
          summary.menungguTotal += k.nominalFee;
        }
      }

      if (paidToday) {
        summary.lunasCount += 1;
        summary.lunasTotal += k.nominalFee;
      }
    }

    return {
      todaySummary: summary,
      totalAllPendingCount: allPendingCount,
      totalAllPendingNominal: allPendingNominal,
    };
  }, [kupons]);

  const todayLunasKupons = useMemo(() => {
    const now = new Date();
    return kupons.filter(
      (k) => k.status === 'LUNAS' && isSameLocalDay(k.waktuCair || k.tanggalInput, now),
    );
  }, [kupons]);

  const availableDateKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const k of kupons) {
      const d = new Date(k.tanggalInput);
      if (!Number.isNaN(d.getTime())) {
        keys.add(toLocalDateKey(d));
      }
    }
    return keys;
  }, [kupons]);

  // Base filtered list (before status tab) for accurate tab badges
  const preStatusFiltered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const specificDateObj =
      dateScope === 'TANGGAL_TERTENTU' && selectedDate ? parseLocalDateKey(selectedDate) : null;

    return kupons.filter((k) => {
      if (dateScope === 'HARI_INI' && !isSameLocalDay(k.tanggalInput)) {
        return false;
      }
      if (specificDateObj && !isSameLocalDay(k.tanggalInput, specificDateObj)) {
        return false;
      }
      if (kategoriFilter !== 'SEMUA' && k.kategori !== kategoriFilter) {
        return false;
      }
      if (q) {
        const hay = `${k.noKupon} ${k.namaPasien} ${k.noRm ?? ''} ${k.namaPerujuk} ${k.asalInstansi} ${k.petugasPendaftaran}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [kupons, dateScope, selectedDate, kategoriFilter, searchQuery]);

  const tabCounts = useMemo(() => {
    let menunggu = 0;
    let lunas = 0;
    for (const k of preStatusFiltered) {
      if (k.status === 'MENUNGGU_KASIR') menunggu += 1;
      else lunas += 1;
    }
    return {
      semua: preStatusFiltered.length,
      menunggu,
      lunas,
    };
  }, [preStatusFiltered]);

  const visibleKupons = useMemo(() => {
    if (statusFilter === 'SEMUA') return preStatusFiltered;
    return preStatusFiltered.filter((k) => k.status === statusFilter);
  }, [preStatusFiltered, statusFilter]);

  // Barcode Enter shortcut: instant verification & payout modal trigger
  const handleBarcodeEnter = () => {
    const raw = searchQuery.trim().toLowerCase();
    if (!raw) {
      searchInputRef.current?.focus();
      return;
    }

    const exact = kupons.find((k) => k.noKupon.toLowerCase() === raw);
    const target = exact ?? (visibleKupons.length === 1 ? visibleKupons[0] : null);

    if (!target) {
      showToast('info', 'Tidak ditemukan kecocokan tunggal. Pilih kupon langsung pada tabel.');
      return;
    }

    if (target.status === 'LUNAS') {
      setStatusFilter('SEMUA');
      setHighlightedId(target.id);
      setTimeout(() => setHighlightedId(null), 4000);
      showToast(
        'error',
        `Perhatian: Kupon ${target.noKupon} SUDAH LUNAS dicairkan sebelumnya oleh ${target.petugasKasir || 'Kasir'}.`,
      );
      return;
    }

    setPayingKupon(target);
  };

  // Actions
  const handleSyncNow = async () => {
    setIsSyncing(true);
    try {
      const res = await triggerSyncPull();
      setKupons(res.kupons);
      setSyncConfig(res.syncConfig);
      showToast('success', res.message);
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Sinkronisasi gagal.');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleConfirmPay = async (
    nominalFee: number,
    petugasKasir: string,
    catatanKasir: string,
  ) => {
    if (!payingKupon) return;
    setIsActionSubmitting(true);
    try {
      if (petugasKasir) {
        setDefaultCashierName(petugasKasir);
        try {
          localStorage.setItem(CASHIER_NAME_STORAGE_KEY, petugasKasir);
        } catch {
          // Ignore storage errors
        }
      }

      const { kupon: updated, syncWarning } = await markKuponLunas(payingKupon.id, {
        nominalFee,
        petugasKasir,
        catatanKasir,
      });

      setKupons((prev) => prev.map((k) => (k.id === updated.id ? updated : k)));
      setPayingKupon(null);

      // Clear barcode search after fast scan payout so cashier is ready for next driver
      if (searchQuery.trim().toLowerCase() === updated.noKupon.toLowerCase()) {
        setSearchQuery('');
      }

      showToast(
        'success',
        syncWarning
          ? `Kupon ${updated.noKupon} LUNAS (${formatRupiah(updated.nominalFee)}). Catatan sync: ${syncWarning}`
          : `Kupon ${updated.noKupon} berhasil dicairkan & ditandai LUNAS (${formatRupiah(updated.nominalFee)}).`,
        updated,
      );
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Gagal menandai lunas.');
    } finally {
      setIsActionSubmitting(false);
    }
  };

  const handleConfirmCancelLunas = async (alasan: string) => {
    if (!cancellingKupon) return;
    setIsActionSubmitting(true);
    try {
      const { kupon: updated } = await cancelKuponLunas(cancellingKupon.id, alasan);
      setKupons((prev) => prev.map((k) => (k.id === updated.id ? updated : k)));
      setCancellingKupon(null);
      showToast(
        'info',
        `Status Lunas kupon ${updated.noKupon} dibatalkan dan dikembalikan ke antrean Menunggu Kasir.`,
      );
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Gagal membatalkan status lunas.');
    } finally {
      setIsActionSubmitting(false);
    }
  };

  const handleSimulateCreate = async (payload: NewKuponPayload) => {
    setIsActionSubmitting(true);
    try {
      const created = await createIncomingKupon(payload);
      setKupons((prev) => {
        if (prev.some((k) => k.id === created.id)) return prev;
        return [created, ...prev];
      });
      setIsSimulateOpen(false);
      setActiveTab('daftar');
      setStatusFilter('MENUNGGU_KASIR');
      setHighlightedId(created.id);
      setTimeout(() => setHighlightedId((curr) => (curr === created.id ? null : curr)), 4000);
      showToast(
        'success',
        `Kupon ${created.noKupon} (${created.namaPerujuk}) masuk ke antrean Menunggu Kasir.`,
      );
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Gagal mengirim simulasi kupon.');
    } finally {
      setIsActionSubmitting(false);
    }
  };

  const handleSaveConfig = async (cfg: Partial<SyncConfig>) => {
    try {
      const saved = await saveSyncConfig(cfg);
      setSyncConfig(saved);
      showToast('success', 'Konfigurasi koneksi database berhasil disimpan.');
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Gagal menyimpan konfigurasi.');
    }
  };

  const handleResetDemo = async () => {
    try {
      const res = await resetDemoKupons();
      setKupons(res.kupons);
      setSyncConfig(res.syncConfig);
      showToast('success', 'Data simulasi kupon RSUMB berhasil dimuat ulang.');
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Gagal mereset data simulasi.');
    }
  };

  const todayDisplay = new Intl.DateTimeFormat('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date());

  return (
    <div className="min-h-screen neu-canvas flex flex-col">
      <TopBar
        activeTab={activeTab}
        onChangeTab={setActiveTab}
        onSyncNow={handleSyncNow}
        isSyncing={isSyncing}
      />

      <main className="flex-1 w-full max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">
        {loadError ? (
          <div className="neu-raised rounded-2xl p-5 flex items-center justify-between gap-4 border border-red-300/70">
            <p className="text-sm font-semibold text-red-800">{loadError}</p>
            <button
              type="button"
              onClick={() => void loadInitialData()}
              className="neu-btn px-4 py-2 rounded-xl text-xs font-bold text-slate-800 cursor-pointer"
            >
              Coba Lagi
            </button>
          </div>
        ) : null}

        {activeTab === 'daftar' ? (
          <>
            {/* Compact Page Title & Context Line */}
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2">
              <div>
                <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-slate-900">
                  Loket Pencairan Kupon Fee Mohat &amp; Perujuk
                </h1>
                <p className="text-xs sm:text-sm text-slate-600 mt-1">
                  RSU Muhammadiyah Babat · {todayDisplay}
                  {defaultCashierName ? ` · Petugas Kasir: ${defaultCashierName}` : ''}
                </p>
              </div>
              <p className="text-xs text-slate-500 whitespace-nowrap">
                Tarif standar: Mohat Desa Rp 25.000 · Faskes 1 BPJS Rp 20.000 · Faskes 1 Umum Rp 35.000
              </p>
            </div>

            {/* Today's Cash Summary Strip */}
            <SummaryCards
              summary={todaySummary}
              totalAllPendingCount={totalAllPendingCount}
              totalAllPendingNominal={totalAllPendingNominal}
              onQuickFilterPending={() => setStatusFilter('MENUNGGU_KASIR')}
              onQuickFilterLunas={() => setActiveTab('riwayat')}
              onDownloadDailyReport={() => setIsDailyReportOpen(true)}
            />

            {/* Large Search / Barcode Scan & Filter Toolbar */}
            <SearchFilterBar
              searchRef={searchInputRef}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              onBarcodeEnter={handleBarcodeEnter}
              statusFilter={statusFilter}
              onStatusFilterChange={setStatusFilter}
              kategoriFilter={kategoriFilter}
              onKategoriFilterChange={setKategoriFilter}
              dateScope={dateScope}
              selectedDate={selectedDate}
              availableDateKeys={availableDateKeys}
              onDateScopeChange={setDateScope}
              onSelectedDateChange={setSelectedDate}
              counts={tabCounts}
              onExportCsv={() => exportKuponsToCsv(visibleKupons)}
            />

            {/* Coupon Listing Table */}
            <KuponTable
              kupons={visibleKupons}
              isLoading={isLoading}
              highlightedId={highlightedId}
              onPayClick={(kupon) => setPayingKupon(kupon)}
              onCancelLunasClick={(kupon) => setCancellingKupon(kupon)}
              onPrintReceiptClick={(kupon) => setReceiptKupon(kupon)}
              onResetFilters={() => {
                setSearchQuery('');
                setStatusFilter('SEMUA');
                setKategoriFilter('SEMUA');
                setDateScope('SEMUA_TANGGAL');
                setSelectedDate('');
              }}
            />
          </>
        ) : null}

        {activeTab === 'riwayat' ? (
          <HistoryView
            kupons={kupons}
            onPrintReceipt={(kupon) => setReceiptKupon(kupon)}
            onCancelLunas={(kupon) => setCancellingKupon(kupon)}
          />
        ) : null}

        {activeTab === 'koneksi' ? (
          <DatabaseSyncView
            syncConfig={syncConfig}
            realtimeConnected={realtimeConnected}
            onSaveConfig={handleSaveConfig}
            onPullNow={handleSyncNow}
            onResetDemo={handleResetDemo}
            onOpenSimulateModal={() => setIsSimulateOpen(true)}
          />
        ) : null}
      </main>

      {/* Quiet Hospital Footer */}
      <footer className="max-w-[1440px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-5 border-t border-slate-300/60 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-500">
        <span>Unit Kasir &amp; Keuangan · RSU Muhammadiyah Babat</span>
        <span>Tekan tombol &ldquo;/&rdquo; untuk fokus cepat ke kolom scan barcode kupon</span>
      </footer>

      {/* Modals */}
      <PayConfirmModal
        kupon={payingKupon}
        defaultCashierName={defaultCashierName}
        isSubmitting={isActionSubmitting}
        onClose={() => setPayingKupon(null)}
        onConfirm={handleConfirmPay}
      />

      <CancelLunasModal
        kupon={cancellingKupon}
        isSubmitting={isActionSubmitting}
        onClose={() => setCancellingKupon(null)}
        onConfirm={handleConfirmCancelLunas}
      />

      <ReceiptModal kupon={receiptKupon} onClose={() => setReceiptKupon(null)} />

      <DailyReportModal
        isOpen={isDailyReportOpen}
        todayLunasKupons={todayLunasKupons}
        onClose={() => setIsDailyReportOpen(false)}
      />

      <SimulateCouponModal
        isOpen={isSimulateOpen}
        isSubmitting={isActionSubmitting}
        onClose={() => setIsSimulateOpen(false)}
        onSubmit={handleSimulateCreate}
      />

      {/* Clean Floating Toast Notification */}
      {toast ? (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-5 right-5 z-50 max-w-md neu-raised rounded-2xl p-4 flex items-start gap-3 border border-slate-300/70"
        >
          <div className="mt-0.5 shrink-0">
            {toast.tone === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-700" />
            ) : toast.tone === 'error' ? (
              <Info className="w-5 h-5 text-red-700" />
            ) : (
              <Info className="w-5 h-5 text-amber-700" />
            )}
          </div>
          <div className="flex-1 text-xs sm:text-sm font-semibold text-slate-800 leading-snug">
            <p>{toast.message}</p>
            {toast.receiptKupon ? (
              <button
                type="button"
                onClick={() => {
                  setReceiptKupon(toast.receiptKupon ?? null);
                  setToast(null);
                }}
                className="mt-2 inline-flex items-center gap-1.5 text-xs font-bold text-emerald-800 hover:underline cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Cetak Bukti Pencairan</span>
              </button>
            ) : null}
          </div>
          <button
            type="button"
            onClick={() => setToast(null)}
            aria-label="Tutup notifikasi"
            className="text-slate-400 hover:text-slate-700 p-1 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ) : null}
    </div>
  );
}
