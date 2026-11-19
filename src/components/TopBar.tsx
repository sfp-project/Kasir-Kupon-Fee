import { RefreshCw } from 'lucide-react';

export type ActiveTab = 'daftar' | 'riwayat' | 'koneksi';

interface TopBarProps {
  activeTab: ActiveTab;
  onChangeTab: (tab: ActiveTab) => void;
  onSyncNow: () => void;
  isSyncing: boolean;
}

const NAV_ITEMS: Array<{ id: ActiveTab; label: string }> = [
  { id: 'daftar', label: 'Daftar Kupon' },
  { id: 'riwayat', label: 'Riwayat & Laporan' },
  { id: 'koneksi', label: 'Koneksi Database' },
];

export function TopBar({ activeTab, onChangeTab, onSyncNow, isSyncing }: TopBarProps) {
  return (
    <header className="sticky top-0 z-30 bg-[#EBF0F5]/95 backdrop-blur-md border-b border-slate-300/60">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4 sm:gap-8">
        {/* Zone 1: Single-line Brand Title */}
        <button
          type="button"
          onClick={() => onChangeTab('daftar')}
          className="text-base sm:text-lg font-extrabold tracking-tight text-slate-900 whitespace-nowrap shrink-0 text-left hover:text-emerald-800 transition-colors cursor-pointer"
        >
          Kasir Kupon RSUMB
        </button>

        {/* Zone 2: Clean single-line text navigation */}
        <nav aria-label="Navigasi utama kasir" className="hidden md:flex items-center gap-7">
          {NAV_ITEMS.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onChangeTab(item.id)}
                className={`relative py-2 text-sm font-semibold whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                  isActive
                    ? 'text-emerald-800'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {item.label}
                <span
                  aria-hidden="true"
                  className={`absolute left-0 right-0 bottom-0 h-0.5 rounded-full transition-opacity ${
                    isActive ? 'bg-emerald-700 opacity-100' : 'opacity-0'
                  }`}
                />
              </button>
            );
          })}
        </nav>

        {/* Zone 3: Single Primary Action */}
        <div className="flex items-center shrink-0">
          <button
            type="button"
            onClick={onSyncNow}
            disabled={isSyncing}
            className="neu-btn inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold text-slate-800 whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-60"
          >
            <RefreshCw className={`w-4 h-4 text-emerald-700 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>{isSyncing ? 'Menyinkronkan...' : 'Sinkronkan Data'}</span>
          </button>
        </div>
      </div>

      {/* Mobile Navigation Strip (kept compact within mobile sticky budget) */}
      <nav
        aria-label="Navigasi mobile"
        className="md:hidden flex items-center justify-around border-t border-slate-300/50 px-3 py-1.5 bg-[#EBF0F5]"
      >
        {NAV_ITEMS.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onChangeTab(item.id)}
              className={`px-3 py-1.5 text-xs font-semibold whitespace-nowrap shrink-0 rounded-lg transition-colors ${
                isActive ? 'text-emerald-800 bg-white/70' : 'text-slate-600'
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </nav>
    </header>
  );
}
