import {
  Calendar,
  CheckCircle2,
  FileDown,
  FileSpreadsheet,
  Printer,
  RotateCcw,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import type { KuponFee } from '../types/kupon.ts';
import { formatRupiah, formatTanggalJam, getKategoriLabel } from '../utils/formatters.ts';
import {
  INDONESIAN_MONTHS,
  buildPeriodReportData,
  exportPeriodReportExcel,
  exportPeriodReportPdf,
  type QuarterlyMode,
  type ReportPeriodSelection,
  type ReportPeriodType,
  type WeeklyMode,
} from '../utils/periodReportExporter.ts';
import { toLocalDateKey } from './CalendarDateFilter.tsx';

interface HistoryViewProps {
  kupons: KuponFee[];
  onPrintReceipt: (kupon: KuponFee) => void;
  onCancelLunas: (kupon: KuponFee) => void;
}

const PERIOD_TABS: Array<{ id: ReportPeriodType; label: string }> = [
  { id: 'HARIAN', label: 'Harian' },
  { id: 'MINGGUAN', label: 'Mingguan' },
  { id: 'BULANAN', label: 'Bulanan' },
  { id: 'TRIBULANAN', label: '3 Bulanan' },
];

export function HistoryView({ kupons, onPrintReceipt, onCancelLunas }: HistoryViewProps) {
  const now = new Date();
  const currentYear = now.getFullYear();

  const [selection, setSelection] = useState<ReportPeriodSelection>(() => ({
    type: 'HARIAN',
    dailyDate: toLocalDateKey(now),
    weeklyMode: 'LAST_7_DAYS',
    month: now.getMonth(),
    year: currentYear,
    quarterlyMode: 'LAST_3_MONTHS',
    quarterlyYear: currentYear,
  }));

  const [selectedOfficer, setSelectedOfficer] = useState<string>('SEMUA');

  const yearOptions = useMemo(() => {
    const years = new Set<number>([currentYear - 1, currentYear, currentYear + 1]);
    for (const k of kupons) {
      const y = new Date(k.waktuCair || k.tanggalInput).getFullYear();
      if (!Number.isNaN(y)) years.add(y);
    }
    return Array.from(years).sort((a, b) => b - a);
  }, [kupons, currentYear]);

  const report = useMemo(
    () => buildPeriodReportData(kupons, selection, selectedOfficer),
    [kupons, selection, selectedOfficer],
  );

  const handlePeriodTypeChange = (type: ReportPeriodType) => {
    setSelection((prev) => ({ ...prev, type }));
    setSelectedOfficer('SEMUA');
  };

  const handleExportPdf = () => {
    exportPeriodReportPdf(report);
  };

  const handleExportExcel = () => {
    exportPeriodReportExcel(report);
  };

  return (
    <div className="space-y-6">
      {/* Header & Primary Export Actions */}
      <section className="neu-raised rounded-2xl p-5 sm:p-6 space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-extrabold text-slate-900">
              Riwayat &amp; Laporan Pencairan Kasir
            </h1>
            <p className="text-sm text-slate-600 mt-1">
              Rekapitulasi kupon berstatus Lunas untuk periode Harian, Mingguan, Bulanan, hingga 3 Bulanan dengan ekspor PDF &amp; Excel.
            </p>
          </div>

          {/* Export PDF & Export Excel Buttons */}
          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={handleExportPdf}
              className="neu-btn-emerald inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap shrink-0 cursor-pointer"
            >
              <FileDown className="w-4 h-4 shrink-0" />
              <span>Export PDF</span>
            </button>
            <button
              type="button"
              onClick={handleExportExcel}
              className="neu-btn inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold text-emerald-800 hover:text-emerald-950 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-700 shrink-0" />
              <span>Export Excel</span>
            </button>
          </div>
        </div>

        {/* Period Tabs + Contextual Period Sub-Filters */}
        <div className="pt-4 border-t border-slate-300/60 flex flex-col xl:flex-row xl:items-center justify-between gap-4">
          {/* 4 Period Tabs */}
          <div
            role="tablist"
            aria-label="Pilih periode laporan"
            className="neu-inset-sm p-1.5 rounded-xl inline-flex items-center gap-1 self-start overflow-x-auto max-w-full"
          >
            {PERIOD_TABS.map((tab) => {
              const active = selection.type === tab.id;
              return (
                <button
                  key={tab.id}
                  role="tab"
                  type="button"
                  aria-selected={active}
                  onClick={() => handlePeriodTypeChange(tab.id)}
                  className={`px-4 py-2 rounded-lg text-xs sm:text-sm font-bold transition-all whitespace-nowrap shrink-0 cursor-pointer ${
                    active
                      ? 'neu-raised-sm text-emerald-900'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Dynamic Sub-Controls per Period */}
          <div className="flex flex-wrap items-center gap-3">
            {selection.type === 'HARIAN' ? (
              <div className="flex items-center gap-2">
                <label htmlFor="report-daily-date" className="text-xs font-semibold text-slate-600 whitespace-nowrap inline-flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-emerald-700" />
                  <span>Pilih Tanggal:</span>
                </label>
                <input
                  id="report-daily-date"
                  type="date"
                  value={selection.dailyDate}
                  onChange={(e) => {
                    if (e.target.value) {
                      setSelection((prev) => ({ ...prev, dailyDate: e.target.value }));
                      setSelectedOfficer('SEMUA');
                    }
                  }}
                  className="neu-inset-sm h-10 px-3 rounded-xl font-mono tabular-nums text-xs sm:text-sm font-semibold text-slate-800 bg-[#E4EBF2] cursor-pointer"
                />
                {selection.dailyDate !== toLocalDateKey(now) ? (
                  <button
                    type="button"
                    onClick={() => {
                      setSelection((prev) => ({ ...prev, dailyDate: toLocalDateKey(now) }));
                      setSelectedOfficer('SEMUA');
                    }}
                    className="neu-btn h-10 px-3 rounded-xl text-xs font-semibold text-emerald-800 whitespace-nowrap cursor-pointer"
                  >
                    Hari Ini
                  </button>
                ) : null}
              </div>
            ) : null}

            {selection.type === 'MINGGUAN' ? (
              <div className="flex items-center gap-2">
                <label htmlFor="report-weekly-mode" className="text-xs font-semibold text-slate-600 whitespace-nowrap">
                  Rentang Mingguan:
                </label>
                <select
                  id="report-weekly-mode"
                  value={selection.weeklyMode}
                  onChange={(e) => {
                    setSelection((prev) => ({
                      ...prev,
                      weeklyMode: e.target.value as WeeklyMode,
                    }));
                    setSelectedOfficer('SEMUA');
                  }}
                  className="neu-inset-sm h-10 px-3 rounded-xl text-xs sm:text-sm font-semibold text-slate-800 bg-[#E4EBF2] cursor-pointer"
                >
                  <option value="LAST_7_DAYS">7 Hari Terakhir</option>
                  <option value="CURRENT_WEEK">Minggu Berjalan (Senin – Minggu)</option>
                </select>
              </div>
            ) : null}

            {selection.type === 'BULANAN' ? (
              <div className="flex flex-wrap items-center gap-2.5">
                <div className="flex items-center gap-2">
                  <label htmlFor="report-month" className="text-xs font-semibold text-slate-600">
                    Bulan:
                  </label>
                  <select
                    id="report-month"
                    value={selection.month}
                    onChange={(e) => {
                      setSelection((prev) => ({ ...prev, month: Number(e.target.value) }));
                      setSelectedOfficer('SEMUA');
                    }}
                    className="neu-inset-sm h-10 px-3 rounded-xl text-xs sm:text-sm font-semibold text-slate-800 bg-[#E4EBF2] cursor-pointer"
                  >
                    {INDONESIAN_MONTHS.map((mName, idx) => (
                      <option key={mName} value={idx}>
                        {mName}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-2">
                  <label htmlFor="report-year" className="text-xs font-semibold text-slate-600">
                    Tahun:
                  </label>
                  <select
                    id="report-year"
                    value={selection.year}
                    onChange={(e) => {
                      setSelection((prev) => ({ ...prev, year: Number(e.target.value) }));
                      setSelectedOfficer('SEMUA');
                    }}
                    className="neu-inset-sm h-10 px-3 rounded-xl font-mono tabular-nums text-xs sm:text-sm font-semibold text-slate-800 bg-[#E4EBF2] cursor-pointer"
                  >
                    {yearOptions.map((y) => (
                      <option key={y} value={y}>
                        {y}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            ) : null}

            {selection.type === 'TRIBULANAN' ? (
              <div className="flex flex-wrap items-center gap-2.5">
                <div className="flex items-center gap-2">
                  <label htmlFor="report-quarter" className="text-xs font-semibold text-slate-600 whitespace-nowrap">
                    Periode 3 Bulanan:
                  </label>
                  <select
                    id="report-quarter"
                    value={selection.quarterlyMode}
                    onChange={(e) => {
                      setSelection((prev) => ({
                        ...prev,
                        quarterlyMode: e.target.value as QuarterlyMode,
                      }));
                      setSelectedOfficer('SEMUA');
                    }}
                    className="neu-inset-sm h-10 px-3 rounded-xl text-xs sm:text-sm font-semibold text-slate-800 bg-[#E4EBF2] cursor-pointer"
                  >
                    <option value="LAST_3_MONTHS">3 Bulan Terakhir</option>
                    <option value="Q1">Triwulan I (Jan – Mar)</option>
                    <option value="Q2">Triwulan II (Apr – Jun)</option>
                    <option value="Q3">Triwulan III (Jul – Sep)</option>
                    <option value="Q4">Triwulan IV (Okt – Des)</option>
                  </select>
                </div>

                {selection.quarterlyMode !== 'LAST_3_MONTHS' ? (
                  <div className="flex items-center gap-2">
                    <label htmlFor="report-quarter-year" className="text-xs font-semibold text-slate-600">
                      Tahun:
                    </label>
                    <select
                      id="report-quarter-year"
                      value={selection.quarterlyYear}
                      onChange={(e) => {
                        setSelection((prev) => ({
                          ...prev,
                          quarterlyYear: Number(e.target.value),
                        }));
                        setSelectedOfficer('SEMUA');
                      }}
                      className="neu-inset-sm h-10 px-3 rounded-xl font-mono tabular-nums text-xs sm:text-sm font-semibold text-slate-800 bg-[#E4EBF2] cursor-pointer"
                    >
                      {yearOptions.map((y) => (
                        <option key={y} value={y}>
                          {y}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>

        {/* Active Period Context Bar */}
        <div className="text-xs text-slate-600 flex flex-wrap items-center justify-between gap-2">
          <span>
            Periode aktif: <strong className="text-slate-900">{report.periodDescription}</strong>
            {selectedOfficer !== 'SEMUA' ? (
              <span>
                {' '}
                · Filter Petugas Kasir: <strong className="text-emerald-800">{selectedOfficer}</strong>
              </span>
            ) : null}
          </span>
          <span className="font-mono tabular-nums text-slate-500">
            Nama berkas: Laporan_Kasir_Kupon_{report.fileSlug}
          </span>
        </div>
      </section>

      {/* Period Summary KPI Strip */}
      <section aria-label="Ringkasan laporan periode terpilih" className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
        <div className="neu-raised rounded-2xl p-5">
          <p className="text-xs font-semibold text-emerald-800">Total Nominal Kas Keluar</p>
          <p className="mt-2.5 font-mono tabular-nums text-2xl sm:text-[26px] font-extrabold text-emerald-900">
            {formatRupiah(report.totalNominal)}
          </p>
          <p className="mt-2 text-xs text-slate-600">
            Periode {report.periodBadge} (terverifikasi Lunas)
          </p>
        </div>

        <div className="neu-raised rounded-2xl p-5">
          <p className="text-xs font-semibold text-slate-600">Total Kupon Cair (Lunas)</p>
          <p className="mt-2.5 font-mono tabular-nums text-2xl sm:text-[26px] font-extrabold text-slate-900">
            {report.totalCount} <span className="text-base font-bold text-slate-600">kupon</span>
          </p>
          <p className="mt-2 text-xs text-slate-600">
            Rata-rata:{' '}
            <strong className="font-mono tabular-nums text-slate-800">
              {report.totalCount > 0
                ? formatRupiah(Math.round(report.totalNominal / report.totalCount))
                : 'Rp 0'}
            </strong>{' '}
            / kupon
          </p>
        </div>

        <div className="neu-raised rounded-2xl p-5">
          <div className="flex items-baseline justify-between gap-2">
            <p className="text-xs font-semibold text-slate-600">Kategori Mohat Desa</p>
            <span className="font-mono tabular-nums text-xs font-semibold text-slate-700">
              {report.mohatCount} kupon
            </span>
          </div>
          <p className="mt-2.5 font-mono tabular-nums text-2xl sm:text-[26px] font-extrabold text-slate-900">
            {formatRupiah(report.mohatNominal)}
          </p>
          <p className="mt-2 text-xs text-slate-600">Ambulans &amp; Mohat Desa rujukan</p>
        </div>

        <div className="neu-raised rounded-2xl p-5">
          <div className="flex items-baseline justify-between gap-2">
            <p className="text-xs font-semibold text-slate-600">Kategori PKM / Faskes 1</p>
            <span className="font-mono tabular-nums text-xs font-semibold text-slate-700">
              {report.faskesCount} kupon
            </span>
          </div>
          <p className="mt-2.5 font-mono tabular-nums text-2xl sm:text-[26px] font-extrabold text-slate-900">
            {formatRupiah(report.faskesNominal)}
          </p>
          <p className="mt-2 text-xs text-slate-600">Puskesmas &amp; Klinik Pratama perujuk</p>
        </div>
      </section>

      {/* Per-Cashier Officer Breakdown Strip */}
      {report.officerSummary.length > 0 ? (
        <section aria-label="Rincian per petugas kasir" className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-800">
              Rincian Per Petugas Kasir ({report.periodBadge})
            </h2>
            {selectedOfficer !== 'SEMUA' ? (
              <button
                type="button"
                onClick={() => setSelectedOfficer('SEMUA')}
                className="text-xs font-semibold text-emerald-800 hover:underline cursor-pointer"
              >
                Tampilkan semua petugas
              </button>
            ) : null}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <button
              type="button"
              onClick={() => setSelectedOfficer('SEMUA')}
              className={`rounded-2xl p-4 text-left cursor-pointer transition-all ${
                selectedOfficer === 'SEMUA' ? 'neu-inset ring-2 ring-emerald-600/35' : 'neu-raised'
              }`}
            >
              <p className="text-xs font-semibold text-slate-600">Semua Petugas Kasir</p>
              <p className="mt-2 font-mono tabular-nums text-xl font-extrabold text-emerald-900">
                {formatRupiah(report.officerSummary.reduce((acc, o) => acc + o.total, 0))}
              </p>
              <p className="mt-1 text-xs text-slate-500 font-mono tabular-nums">
                {report.officerSummary.reduce((acc, o) => acc + o.count, 0)} kupon lunas
              </p>
            </button>

            {report.officerSummary.map((officer) => {
              const active = selectedOfficer === officer.name;
              return (
                <button
                  key={officer.name}
                  type="button"
                  onClick={() => setSelectedOfficer(active ? 'SEMUA' : officer.name)}
                  className={`rounded-2xl p-4 text-left cursor-pointer transition-all ${
                    active ? 'neu-inset ring-2 ring-emerald-600/35' : 'neu-raised'
                  }`}
                >
                  <p className="text-xs font-bold text-slate-700 truncate">{officer.name}</p>
                  <p className="mt-2 font-mono tabular-nums text-xl font-extrabold text-slate-900">
                    {formatRupiah(officer.total)}
                  </p>
                  <p className="mt-1 text-xs text-slate-500 font-mono tabular-nums">
                    {officer.count} pencairan
                  </p>
                </button>
              );
            })}
          </div>
        </section>
      ) : null}

      {/* Complete Paid Coupons Table */}
      <section className="neu-raised rounded-2xl overflow-hidden">
        <div className="px-5 sm:px-6 py-4 border-b border-slate-300/60 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm sm:text-base font-bold text-slate-900">
              Tabel Rincian Kupon Lunas — {report.periodBadge}
            </h2>
            <p className="text-xs text-slate-600 mt-0.5">
              {report.totalCount} transaksi cair · {report.periodDescription}
            </p>
          </div>
          <div className="text-sm font-mono tabular-nums font-extrabold text-emerald-900">
            Total: {formatRupiah(report.totalNominal)}
          </div>
        </div>

        {report.items.length === 0 ? (
          <div className="px-6 py-14 text-center space-y-2">
            <p className="text-sm font-bold text-slate-800">
              Belum ada transaksi berstatus Lunas pada periode ini
            </p>
            <p className="text-xs text-slate-600">
              Ubah rentang tanggal atau pilih tab periode lain (Mingguan, Bulanan, atau 3 Bulanan) untuk melihat data pencairan.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[1120px]">
              <thead>
                <tr className="border-b border-slate-300/60 bg-[#E6ECF3]/70 text-xs font-bold text-slate-600">
                  <th className="py-3.5 pl-6 pr-3 whitespace-nowrap">No. Kupon</th>
                  <th className="py-3.5 px-3 whitespace-nowrap">Tgl / Jam Cair</th>
                  <th className="py-3.5 px-3 whitespace-nowrap">Nama Sopir / Perujuk</th>
                  <th className="py-3.5 px-3 whitespace-nowrap">Asal Instansi / Desa</th>
                  <th className="py-3.5 px-3 whitespace-nowrap">Pasien Ranap</th>
                  <th className="py-3.5 px-3 whitespace-nowrap">Petugas Kasir</th>
                  <th className="py-3.5 px-3 whitespace-nowrap">Catatan</th>
                  <th className="py-3.5 px-3 text-right whitespace-nowrap">Nominal Akhir Cair</th>
                  <th className="py-3.5 pl-3 pr-6 text-right whitespace-nowrap">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-300/50 text-sm">
                {report.items.map((kupon) => {
                  const cairDt = formatTanggalJam(kupon.waktuCair || kupon.tanggalInput);
                  return (
                    <tr key={kupon.id} className="hover:bg-white/45 transition-colors">
                      <td className="py-3.5 pl-6 pr-3 whitespace-nowrap">
                        <div className="font-mono tabular-nums font-bold text-slate-900">
                          {kupon.noKupon}
                        </div>
                        <div className="text-xs text-slate-500 mt-0.5">
                          {getKategoriLabel(kupon.kategori)}
                        </div>
                      </td>
                      <td className="py-3.5 px-3 whitespace-nowrap font-mono tabular-nums text-xs">
                        <div className="font-semibold text-slate-800">{cairDt.tanggal}</div>
                        <div className="text-slate-500 mt-0.5">{cairDt.jam}</div>
                      </td>
                      <td className="py-3.5 px-3 font-semibold text-slate-900">
                        {kupon.namaPerujuk}
                      </td>
                      <td className="py-3.5 px-3 text-xs sm:text-sm text-slate-700">
                        {kupon.asalInstansi}
                      </td>
                      <td className="py-3.5 px-3">
                        <div className="font-medium text-slate-900">{kupon.namaPasien}</div>
                        <div className="text-xs text-slate-500 mt-0.5">
                          {kupon.ruangRanap} · {kupon.penjamin}
                        </div>
                      </td>
                      <td className="py-3.5 px-3 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-900">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                          <span>{kupon.petugasKasir || 'Petugas Kasir'}</span>
                        </span>
                      </td>
                      <td className="py-3.5 px-3 text-xs text-slate-600 max-w-[200px]">
                        <span className="line-clamp-2" title={kupon.catatanKasir || '-'}>
                          {kupon.catatanKasir || '—'}
                        </span>
                      </td>
                      <td className="py-3.5 px-3 text-right whitespace-nowrap font-mono tabular-nums font-extrabold text-emerald-900">
                        {formatRupiah(kupon.nominalFee)}
                      </td>
                      <td className="py-3.5 pl-3 pr-6 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => onPrintReceipt(kupon)}
                            className="neu-btn inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-700 cursor-pointer"
                          >
                            <Printer className="w-3.5 h-3.5 text-emerald-700" />
                            <span>Cetak</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => onCancelLunas(kupon)}
                            className="neu-btn inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-red-700 cursor-pointer"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            <span>Batalkan</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-emerald-50/75 border-t border-emerald-200">
                  <td colSpan={7} className="py-3.5 pl-6 pr-3 text-right text-xs sm:text-sm font-extrabold text-emerald-950">
                    TOTAL PENCAIRAN PERIODE {report.periodBadge.toUpperCase()} ({report.totalCount} KUPON)
                  </td>
                  <td className="py-3.5 px-3 text-right font-mono tabular-nums text-base font-extrabold text-emerald-900 whitespace-nowrap">
                    {formatRupiah(report.totalNominal)}
                  </td>
                  <td className="py-3.5 pl-3 pr-6" />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
