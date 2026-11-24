import { Download, ScanBarcode, Search, X } from 'lucide-react';
import type { KeyboardEvent, RefObject } from 'react';
import type { KuponKategori } from '../types/kupon.ts';
import { CalendarDateFilter } from './CalendarDateFilter.tsx';

export type StatusFilter = 'SEMUA' | 'MENUNGGU_KASIR' | 'LUNAS';
export type KategoriFilter = 'SEMUA' | KuponKategori;
export type DateScope = 'HARI_INI' | 'SEMUA_TANGGAL' | 'TANGGAL_TERTENTU';
export type SortOrder = 'TERBARU' | 'TERLAMA';

interface SearchFilterBarProps {
  searchRef: RefObject<HTMLInputElement | null>;
  searchQuery: string;
  onSearchChange: (value: string) => void;
  onBarcodeEnter: () => void;
  statusFilter: StatusFilter;
  onStatusFilterChange: (status: StatusFilter) => void;
  kategoriFilter: KategoriFilter;
  onKategoriFilterChange: (kategori: KategoriFilter) => void;
  sortOrder: SortOrder;
  onSortOrderChange: (order: SortOrder) => void;
  dateScope: DateScope;
  selectedDate: string;
  availableDateKeys: Set<string>;
  onDateScopeChange: (scope: DateScope) => void;
  onSelectedDateChange: (dateKey: string) => void;
  counts: {
    semua: number;
    menunggu: number;
    lunas: number;
  };
  onExportCsv: () => void;
}

export function SearchFilterBar({
  searchRef,
  searchQuery,
  onSearchChange,
  onBarcodeEnter,
  statusFilter,
  onStatusFilterChange,
  kategoriFilter,
  onKategoriFilterChange,
  sortOrder,
  onSortOrderChange,
  dateScope,
  selectedDate,
  availableDateKeys,
  onDateScopeChange,
  onSelectedDateChange,
  counts,
  onExportCsv,
}: SearchFilterBarProps) {
  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      onBarcodeEnter();
    } else if (e.key === 'Escape') {
      onSearchChange('');
    }
  };

  const statusTabs: Array<{ id: StatusFilter; label: string; count: number }> = [
    { id: 'MENUNGGU_KASIR', label: 'Menunggu Kasir', count: counts.menunggu },
    { id: 'LUNAS', label: 'Lunas', count: counts.lunas },
    { id: 'SEMUA', label: 'Semua', count: counts.semua },
  ];

  return (
    <section aria-label="Pencarian cepat dan filter kupon" className="neu-raised rounded-2xl p-5 sm:p-6 space-y-5">
      {/* Large Search & Barcode Scan Bar */}
      <div className="flex flex-col lg:flex-row gap-3.5 items-stretch lg:items-center">
        <div className="relative flex-1">
          <div className="pointer-events-none absolute inset-y-0 left-4 flex items-center gap-2 text-slate-500">
            <Search className="w-5 h-5" />
          </div>
          <input
            ref={searchRef}
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Scan barcode No. Kupon atau ketik Nama Sopir, Perujuk, Instansi, atau Pasien..."
            aria-label="Cari atau scan nomor kupon"
            className="neu-inset w-full h-13 pl-12 pr-28 rounded-xl text-sm sm:text-base font-medium text-slate-900 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-600/40"
          />
          <div className="absolute inset-y-0 right-3 flex items-center gap-2">
            {searchQuery ? (
              <button
                type="button"
                onClick={() => {
                  onSearchChange('');
                  searchRef.current?.focus();
                }}
                aria-label="Hapus pencarian"
                className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-200/70 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            ) : null}
            <button
              type="button"
              onClick={onBarcodeEnter}
              title="Tekan Enter setelah scan barcode untuk langsung membuka konfirmasi pencairan"
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-emerald-800 bg-emerald-100/70 hover:bg-emerald-200/70 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <ScanBarcode className="w-4 h-4" />
              <span className="hidden sm:inline">Scan / Enter</span>
            </button>
          </div>
        </div>

        {/* Utility Actions */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={onExportCsv}
            title="Unduh rekap tabel yang tampil sebagai CSV"
            className="neu-btn h-13 px-4 rounded-xl inline-flex items-center justify-center gap-2 text-sm font-semibold text-slate-700 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Download className="w-4 h-4 text-slate-600" />
            <span className="hidden sm:inline">Unduh CSV</span>
          </button>
        </div>
      </div>

      {/* Filter Row: Segmented Status Filter + Secondary Filters */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pt-1">
        {/* Status Segmented Tabs */}
        <div
          role="tablist"
          aria-label="Filter status kupon"
          className="neu-inset-sm p-1.5 rounded-xl inline-flex items-center gap-1 self-start overflow-x-auto max-w-full"
        >
          {statusTabs.map((tab) => {
            const active = statusFilter === tab.id;
            return (
              <button
                key={tab.id}
                role="tab"
                type="button"
                aria-selected={active}
                onClick={() => onStatusFilterChange(tab.id)}
                className={`px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all whitespace-nowrap shrink-0 flex items-center gap-2 cursor-pointer ${
                  active
                    ? 'neu-raised-sm text-slate-900'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`font-mono tabular-nums text-xs ${
                    active
                      ? tab.id === 'MENUNGGU_KASIR'
                        ? 'text-amber-700 font-bold'
                        : tab.id === 'LUNAS'
                          ? 'text-emerald-700 font-bold'
                          : 'text-slate-800 font-bold'
                      : 'text-slate-500'
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Secondary Filters: Sort Order, Category & Date Scope */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <label htmlFor="filter-urutan" className="text-xs font-semibold text-slate-600 whitespace-nowrap">
              Urutan:
            </label>
            <select
              id="filter-urutan"
              value={sortOrder}
              onChange={(e) => onSortOrderChange(e.target.value as SortOrder)}
              className="neu-inset-sm h-10 px-3 rounded-xl text-xs sm:text-sm font-semibold text-slate-800 bg-[#E4EBF2] cursor-pointer"
            >
              <option value="TERBARU">Terbaru ke Terlama</option>
              <option value="TERLAMA">Terlama ke Terbaru</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <label htmlFor="filter-kategori" className="text-xs font-semibold text-slate-600 whitespace-nowrap">
              Kategori:
            </label>
            <select
              id="filter-kategori"
              value={kategoriFilter}
              onChange={(e) => onKategoriFilterChange(e.target.value as KategoriFilter)}
              className="neu-inset-sm h-10 px-3 rounded-xl text-xs sm:text-sm font-semibold text-slate-800 bg-[#E4EBF2] cursor-pointer"
            >
              <option value="SEMUA">Semua Kategori</option>
              <option value="MOHAT_DESA">Mohat Desa (Rp 25.000)</option>
              <option value="PKM_FASKES_1">PKM / Faskes 1 (Rp 20k / 35k)</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <label htmlFor="filter-tanggal" className="text-xs font-semibold text-slate-600 whitespace-nowrap">
              Tanggal:
            </label>
            <CalendarDateFilter
              id="filter-tanggal"
              dateScope={dateScope}
              selectedDate={selectedDate}
              availableDateKeys={availableDateKeys}
              onSelectAllDates={() => {
                onDateScopeChange('SEMUA_TANGGAL');
                onSelectedDateChange('');
              }}
              onSelectToday={() => {
                onDateScopeChange('HARI_INI');
                onSelectedDateChange('');
              }}
              onSelectSpecificDate={(dateKey) => {
                onSelectedDateChange(dateKey);
                onDateScopeChange('TANGGAL_TERTENTU');
              }}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
