import { onAuthStateChanged, type User } from 'firebase/auth';
import { CheckCircle2, Info, LogIn, Printer, X } from 'lucide-react';
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
  type SortOrder,
  type StatusFilter,
} from './components/SearchFilterBar.tsx';
import { SummaryCards } from './components/SummaryCards.tsx';
import { TopBar, type ActiveTab } from './components/TopBar.tsx';
import {
  FIREBASE_META,
  auth,
  isPermissionDeniedError,
  signInWithGoogle,
  signOutUser,
} from './firebase.ts';
import {
  cancelFirestoreCouponLunas,
  fetchFirestoreCoupons,
  markFirestoreCouponLunas,
  subscribeFirestoreCoupons,
} from './services/firestoreCoupons.ts';
import type { CashSummary, KuponFee } from './types/kupon.ts';
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
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [realtimeConnected, setRealtimeConnected] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [needsAuth, setNeedsAuth] = useState(false);

  // Firebase Auth state (used when shared Portal Pendaftaran rules require Google sign-in)
  const [authUser, setAuthUser] = useState<User | null>(() => auth.currentUser);
  const [authVersion, setAuthVersion] = useState(0);
  const [isAuthLoading, setIsAuthLoading] = useState(false);

  // Filters (default "Menunggu Kasir" as requested)
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('MENUNGGU_KASIR');
  const [kategoriFilter, setKategoriFilter] = useState<KategoriFilter>('SEMUA');
  const [sortOrder, setSortOrder] = useState<SortOrder>('TERBARU');
  const [dateScope, setDateScope] = useState<DateScope>('SEMUA_TANGGAL');
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [highlightedId, setHighlightedId] = useState<string | null>(null);

  // Modals state
  const [payingKupon, setPayingKupon] = useState<KuponFee | null>(null);
  const [cancellingKupon, setCancellingKupon] = useState<KuponFee | null>(null);
  const [receiptKupon, setReceiptKupon] = useState<KuponFee | null>(null);
  const [isDailyReportOpen, setIsDailyReportOpen] = useState(false);
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
  const knownIdsRef = useRef<Set<string>>(new Set());
  const initialSnapshotDoneRef = useRef(false);

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

  // Listen to Firebase Auth changes and re-trigger Firestore subscription when user signs in/out
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setAuthUser(user);
      setAuthVersion((v) => v + 1);
    });
    return unsubscribe;
  }, []);

  // Real-time Firestore onSnapshot listener directly on mohat_coupons
  useEffect(() => {
    setIsLoading(true);
    setLoadError(null);
    initialSnapshotDoneRef.current = false;

    const unsubscribe = subscribeFirestoreCoupons(
      (liveKupons) => {
        // Notify cashier when a brand-new pending coupon arrives from Portal Pendaftaran after initial load
        if (initialSnapshotDoneRef.current) {
          const newlyAdded = liveKupons.find(
            (k) => !knownIdsRef.current.has(k.id) && k.status === 'MENUNGGU_KASIR',
          );
          if (newlyAdded) {
            setHighlightedId(newlyAdded.id);
            setTimeout(
              () => setHighlightedId((curr) => (curr === newlyAdded.id ? null : curr)),
              4000,
            );
            showToast(
              'info',
              `Kupon baru dari Portal Pendaftaran: ${newlyAdded.noKupon} — ${newlyAdded.namaPerujuk} (${formatRupiah(newlyAdded.nominalFee)})`,
            );
          }
        } else {
          initialSnapshotDoneRef.current = true;
        }

        knownIdsRef.current = new Set(liveKupons.map((k) => k.id));
        setKupons(liveKupons);
        setRealtimeConnected(true);
        setNeedsAuth(false);
        setLoadError(null);
        setLastSyncedAt(new Date().toISOString());
        setIsLoading(false);
      },
      (_structuredError, rawError) => {
        setRealtimeConnected(false);
        setIsLoading(false);
        const rawMsg = rawError instanceof Error ? rawError.message : String(rawError);

        if (rawMsg.toLowerCase().includes('quota exceeded')) {
          setLoadError(
            `Kuota harian Firestore tercapai. Kuota akan direset besok atau Anda dapat memeriksa paket pada https://console.firebase.google.com/project/${FIREBASE_META.projectId}/firestore/databases/${FIREBASE_META.firestoreDatabaseId}/data?openUpgradeDialog=true`,
          );
          return;
        }

        if (isPermissionDeniedError(rawError)) {
          setNeedsAuth(true);
          setLoadError(
            auth.currentUser
              ? `Akun ${auth.currentUser.email} belum memiliki izin baca pada koleksi "${FIREBASE_META.collection}". Pastikan aturan Firestore Portal Pendaftaran mengizinkan akses akun ini.`
              : `Akses ke koleksi "${FIREBASE_META.collection}" memerlukan login akun Google RSUMB yang terdaftar di Portal Pendaftaran.`,
          );
          return;
        }

        setLoadError(`Gagal terhubung ke Firestore (${FIREBASE_META.collection}): ${rawMsg}`);
      },
    );

    return () => {
      unsubscribe();
    };
  }, [authVersion, showToast]);

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
    const filtered =
      statusFilter === 'SEMUA'
        ? preStatusFiltered
        : preStatusFiltered.filter((k) => k.status === statusFilter);

    return [...filtered].sort((a, b) => {
      const timeA = new Date(a.tanggalInput).getTime();
      const timeB = new Date(b.tanggalInput).getTime();
      const safeA = Number.isNaN(timeA) ? 0 : timeA;
      const safeB = Number.isNaN(timeB) ? 0 : timeB;

      if (safeA !== safeB) {
        return sortOrder === 'TERBARU' ? safeB - safeA : safeA - safeB;
      }

      const codeCmp = a.noKupon.localeCompare(b.noKupon, 'id', {
        numeric: true,
        sensitivity: 'base',
      });
      return sortOrder === 'TERBARU' ? -codeCmp : codeCmp;
    });
  }, [preStatusFiltered, statusFilter, sortOrder]);

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

  // Manual getDocs refresh from Firestore mohat_coupons
  const handleSyncNow = async () => {
    setIsSyncing(true);
    try {
      const fresh = await fetchFirestoreCoupons();
      knownIdsRef.current = new Set(fresh.map((k) => k.id));
      setKupons(fresh);
      setRealtimeConnected(true);
      setNeedsAuth(false);
      setLoadError(null);
      setLastSyncedAt(new Date().toISOString());
      showToast(
        'success',
        `Berhasil sinkronisasi langsung dari Firestore (${fresh.length} kupon di koleksi ${FIREBASE_META.collection}).`,
      );
    } catch (err) {
      if (isPermissionDeniedError(err)) {
        setNeedsAuth(true);
        showToast(
          'error',
          'Izin akses Firestore ditolak. Silakan masuk dengan akun Google RSUMB terlebih dahulu.',
        );
      } else {
        showToast('error', 'Gagal memuat data terbaru dari Firestore.');
      }
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSignInGoogle = async () => {
    setIsAuthLoading(true);
    try {
      const user = await signInWithGoogle();
      showToast('success', `Berhasil masuk sebagai ${user.displayName || user.email}.`);
    } catch (err) {
      showToast(
        'error',
        err instanceof Error ? err.message : 'Gagal masuk menggunakan akun Google.',
      );
    } finally {
      setIsAuthLoading(false);
    }
  };

  const handleSignOut = async () => {
    setIsAuthLoading(true);
    try {
      await signOutUser();
      showToast('info', 'Anda telah keluar dari akun Google.');
    } finally {
      setIsAuthLoading(false);
    }
  };

  // Direct Firestore updateDoc when marking LUNAS
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

      const updated = await markFirestoreCouponLunas(payingKupon, {
        nominalFee,
        petugasKasir,
        catatanKasir,
      });

      setPayingKupon(null);

      // Clear barcode search after fast scan payout so cashier is ready for next driver
      if (searchQuery.trim().toLowerCase() === updated.noKupon.toLowerCase()) {
        setSearchQuery('');
      }

      showToast(
        'success',
        `Kupon ${updated.noKupon} berhasil diperbarui LUNAS di Firestore (${formatRupiah(updated.nominalFee)}).`,
        updated,
      );
    } catch (err) {
      if (isPermissionDeniedError(err)) {
        setNeedsAuth(true);
        showToast(
          'error',
          'Izin update dokumen ditolak oleh aturan Firestore. Silakan login dengan akun Google RSUMB.',
        );
      } else {
        showToast('error', 'Gagal memperbarui status Lunas ke Firestore. Silakan coba lagi.');
      }
    } finally {
      setIsActionSubmitting(false);
    }
  };

  // Direct Firestore updateDoc when cancelling LUNAS
  const handleConfirmCancelLunas = async (alasan: string) => {
    if (!cancellingKupon) return;
    setIsActionSubmitting(true);
    try {
      const updated = await cancelFirestoreCouponLunas(cancellingKupon, alasan);
      setCancellingKupon(null);
      showToast(
        'info',
        `Status Lunas kupon ${updated.noKupon} dibatalkan dan dikembalikan ke Menunggu Kasir di Firestore.`,
      );
    } catch (err) {
      if (isPermissionDeniedError(err)) {
        setNeedsAuth(true);
        showToast(
          'error',
          'Izin pembatalan ditolak oleh aturan Firestore. Silakan login dengan akun Google RSUMB.',
        );
      } else {
        showToast('error', 'Gagal membatalkan status Lunas di Firestore.');
      }
    } finally {
      setIsActionSubmitting(false);
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
          <div className="neu-raised rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border border-amber-300/80">
            <div className="space-y-1">
              <p className="text-sm font-bold text-slate-900">
                {needsAuth ? 'Diperlukan Autentikasi Firebase Firestore' : 'Kendala Koneksi Firestore'}
              </p>
              <p className="text-xs sm:text-sm text-slate-700 leading-relaxed break-words">
                {loadError}
              </p>
            </div>
            <div className="flex items-center gap-2.5 shrink-0">
              {needsAuth ? (
                <button
                  type="button"
                  onClick={() => void handleSignInGoogle()}
                  disabled={isAuthLoading}
                  className="neu-btn-emerald inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap cursor-pointer disabled:opacity-60"
                >
                  <LogIn className="w-4 h-4" />
                  <span>{isAuthLoading ? 'Memproses...' : 'Masuk dengan Google'}</span>
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => void handleSyncNow()}
                disabled={isSyncing}
                className="neu-btn px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold text-slate-800 whitespace-nowrap cursor-pointer"
              >
                Coba Lagi
              </button>
            </div>
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
                Firestore Live: <span className="font-mono font-semibold text-emerald-800">{FIREBASE_META.collection}</span>
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
              sortOrder={sortOrder}
              onSortOrderChange={setSortOrder}
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
                setSortOrder('TERBARU');
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
            realtimeConnected={realtimeConnected}
            totalDocuments={kupons.length}
            lastSyncedAt={lastSyncedAt}
            authUser={authUser}
            isAuthLoading={isAuthLoading}
            isSyncing={isSyncing}
            onRefreshNow={handleSyncNow}
            onSignInGoogle={handleSignInGoogle}
            onSignOut={handleSignOut}
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
