import { FileDown, FileSpreadsheet, Printer, X } from 'lucide-react';
import type { KuponFee } from '../types/kupon.ts';
import { categorizeDailyLunas, downloadDailyReportPdf } from '../utils/dailyReportPdf.ts';
import { formatRupiah, formatTanggalJam } from '../utils/formatters.ts';
import { buildPeriodReportData, exportPeriodReportExcel } from '../utils/periodReportExporter.ts';
import { toLocalDateKey } from './CalendarDateFilter.tsx';

interface DailyReportModalProps {
  isOpen: boolean;
  todayLunasKupons: KuponFee[];
  onClose: () => void;
}

export function DailyReportModal({
  isOpen,
  todayLunasKupons,
  onClose,
}: DailyReportModalProps) {
  if (!isOpen) return null;

  const now = new Date();
  const { mohatItems, faskesItems, mohatTotal, faskesTotal, grandTotal } =
    categorizeDailyLunas(todayLunasKupons);

  const dateLabel = new Intl.DateTimeFormat('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(now);

  const printedAt = formatTanggalJam(now.toISOString()).lengkap;

  const handleDownloadPdf = () => {
    downloadDailyReportPdf(todayLunasKupons, now);
  };

  const handleDownloadExcel = () => {
    const dailyData = buildPeriodReportData(todayLunasKupons, {
      type: 'HARIAN',
      dailyDate: toLocalDateKey(now),
      weeklyMode: 'LAST_7_DAYS',
      month: now.getMonth(),
      year: now.getFullYear(),
      quarterlyMode: 'LAST_3_MONTHS',
      quarterlyYear: now.getFullYear(),
    });
    exportPeriodReportExcel(dailyData);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="daily-report-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="neu-raised w-full max-w-4xl rounded-2xl p-5 sm:p-6 max-h-[92vh] flex flex-col">
        {/* Modal Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-300/60 shrink-0">
          <div>
            <h2 id="daily-report-title" className="text-lg font-extrabold text-slate-900">
              Laporan Harian Pencairan Kupon Fee (Lunas)
            </h2>
            <p className="text-xs text-slate-600 mt-0.5">
              Ringkasan transaksi Lunas hari ini berdasarkan kategori Mohat Desa dan PKM / Faskes 1.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="neu-btn inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold text-slate-800 whitespace-nowrap cursor-pointer"
            >
              <Printer className="w-4 h-4 text-slate-700" />
              <span>Cetak</span>
            </button>
            <button
              type="button"
              onClick={handleDownloadExcel}
              className="neu-btn inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold text-emerald-800 whitespace-nowrap cursor-pointer"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-700" />
              <span>Export Excel</span>
            </button>
            <button
              type="button"
              onClick={handleDownloadPdf}
              className="neu-btn-emerald inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap cursor-pointer"
            >
              <FileDown className="w-4 h-4" />
              <span>Export PDF</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Tutup pratinjau laporan harian"
              className="neu-btn p-2 rounded-xl text-slate-600 hover:text-slate-900 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Printable A4 Sheet Preview */}
        <div
          id="daily-report-print"
          className="mt-4 flex-1 overflow-y-auto bg-white rounded-xl border border-slate-300/80 p-6 sm:p-8 text-slate-900 space-y-6"
        >
          {/* Official Header */}
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 pb-4 border-b border-slate-300">
            <div>
              <h3 className="text-base sm:text-lg font-extrabold tracking-tight text-slate-900">
                RSU MUHAMMADIYAH BABAT
              </h3>
              <p className="text-xs text-slate-600 mt-0.5">
                Jl. KH. Ahmad Dahlan No. 14, Babat, Kabupaten Lamongan
              </p>
            </div>
            <div className="sm:text-right">
              <p className="text-xs sm:text-sm font-extrabold text-emerald-800">
                LAPORAN HARIAN KASIR KUPON FEE (LUNAS)
              </p>
              <p className="text-xs text-slate-600 mt-0.5">{dateLabel}</p>
            </div>
          </div>

          {/* Categorized Totals Strip */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4">
              <p className="text-xs font-semibold text-slate-600">Total Mohat Desa (Lunas)</p>
              <p className="mt-1.5 font-mono tabular-nums text-xl font-extrabold text-slate-900">
                {formatRupiah(mohatTotal)}
              </p>
              <p className="mt-1 text-xs text-slate-500 font-mono tabular-nums">
                {mohatItems.length} transaksi
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4">
              <p className="text-xs font-semibold text-slate-600">Total PKM / Faskes 1 (Lunas)</p>
              <p className="mt-1.5 font-mono tabular-nums text-xl font-extrabold text-slate-900">
                {formatRupiah(faskesTotal)}
              </p>
              <p className="mt-1 text-xs text-slate-500 font-mono tabular-nums">
                {faskesItems.length} transaksi
              </p>
            </div>

            <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-4">
              <p className="text-xs font-semibold text-emerald-800">Total Kas Keluar Hari Ini</p>
              <p className="mt-1.5 font-mono tabular-nums text-xl font-extrabold text-emerald-900">
                {formatRupiah(grandTotal)}
              </p>
              <p className="mt-1 text-xs text-emerald-700 font-mono tabular-nums">
                {todayLunasKupons.length} transaksi lunas
              </p>
            </div>
          </div>

          {/* Section 1: Mohat Desa */}
          <div className="space-y-2.5">
            <div className="flex items-baseline justify-between gap-2">
              <h4 className="text-sm font-bold text-slate-900">
                1. Kategori Mohat Desa ({mohatItems.length} kupon)
              </h4>
              <span className="font-mono tabular-nums text-xs sm:text-sm font-bold text-emerald-800">
                Subtotal: {formatRupiah(mohatTotal)}
              </span>
            </div>

            {mohatItems.length === 0 ? (
              <p className="text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-lg px-4 py-3">
                Belum ada transaksi Mohat Desa yang berstatus Lunas hari ini.
              </p>
            ) : (
              <div className="overflow-x-auto border border-slate-200 rounded-lg">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-100 text-slate-700 border-b border-slate-200">
                      <th className="py-2 px-2.5 text-center w-9">No</th>
                      <th className="py-2 px-2.5">No. Kupon</th>
                      <th className="py-2 px-2.5">Jam Cair</th>
                      <th className="py-2 px-2.5">Sopir / Perujuk &amp; Desa</th>
                      <th className="py-2 px-2.5">Pasien Ranap</th>
                      <th className="py-2 px-2.5">Petugas Kasir</th>
                      <th className="py-2 px-2.5 text-right">Nominal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {mohatItems.map((k, idx) => (
                      <tr key={k.id}>
                        <td className="py-2 px-2.5 text-center font-mono tabular-nums text-slate-500">
                          {idx + 1}
                        </td>
                        <td className="py-2 px-2.5 font-mono tabular-nums font-bold text-slate-900 whitespace-nowrap">
                          {k.noKupon}
                        </td>
                        <td className="py-2 px-2.5 font-mono tabular-nums text-slate-700 whitespace-nowrap">
                          {formatTanggalJam(k.waktuCair).jam}
                        </td>
                        <td className="py-2 px-2.5">
                          <div className="font-semibold text-slate-900">{k.namaPerujuk}</div>
                          <div className="text-[11px] text-slate-600">{k.asalInstansi}</div>
                        </td>
                        <td className="py-2 px-2.5">
                          <span className="font-medium text-slate-800">{k.namaPasien}</span>
                          <span className="text-slate-500"> ({k.penjamin})</span>
                        </td>
                        <td className="py-2 px-2.5 text-slate-700">{k.petugasKasir || 'Petugas Kasir'}</td>
                        <td className="py-2 px-2.5 text-right font-mono tabular-nums font-bold text-slate-900 whitespace-nowrap">
                          {formatRupiah(k.nominalFee)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-emerald-50/70 border-t border-emerald-200 font-bold text-emerald-900">
                      <td colSpan={6} className="py-2 px-2.5 text-right">
                        Subtotal Mohat Desa
                      </td>
                      <td className="py-2 px-2.5 text-right font-mono tabular-nums whitespace-nowrap">
                        {formatRupiah(mohatTotal)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>

          {/* Section 2: PKM / Faskes 1 */}
          <div className="space-y-2.5">
            <div className="flex items-baseline justify-between gap-2">
              <h4 className="text-sm font-bold text-slate-900">
                2. Kategori PKM / Faskes 1 ({faskesItems.length} kupon)
              </h4>
              <span className="font-mono tabular-nums text-xs sm:text-sm font-bold text-emerald-800">
                Subtotal: {formatRupiah(faskesTotal)}
              </span>
            </div>

            {faskesItems.length === 0 ? (
              <p className="text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-lg px-4 py-3">
                Belum ada transaksi PKM / Faskes 1 yang berstatus Lunas hari ini.
              </p>
            ) : (
              <div className="overflow-x-auto border border-slate-200 rounded-lg">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-100 text-slate-700 border-b border-slate-200">
                      <th className="py-2 px-2.5 text-center w-9">No</th>
                      <th className="py-2 px-2.5">No. Kupon</th>
                      <th className="py-2 px-2.5">Jam Cair</th>
                      <th className="py-2 px-2.5">Perujuk &amp; Instansi</th>
                      <th className="py-2 px-2.5">Pasien Ranap</th>
                      <th className="py-2 px-2.5">Petugas Kasir</th>
                      <th className="py-2 px-2.5 text-right">Nominal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {faskesItems.map((k, idx) => (
                      <tr key={k.id}>
                        <td className="py-2 px-2.5 text-center font-mono tabular-nums text-slate-500">
                          {idx + 1}
                        </td>
                        <td className="py-2 px-2.5 font-mono tabular-nums font-bold text-slate-900 whitespace-nowrap">
                          {k.noKupon}
                        </td>
                        <td className="py-2 px-2.5 font-mono tabular-nums text-slate-700 whitespace-nowrap">
                          {formatTanggalJam(k.waktuCair).jam}
                        </td>
                        <td className="py-2 px-2.5">
                          <div className="font-semibold text-slate-900">{k.namaPerujuk}</div>
                          <div className="text-[11px] text-slate-600">{k.asalInstansi}</div>
                        </td>
                        <td className="py-2 px-2.5">
                          <span className="font-medium text-slate-800">{k.namaPasien}</span>
                          <span className="text-slate-500"> ({k.penjamin})</span>
                        </td>
                        <td className="py-2 px-2.5 text-slate-700">{k.petugasKasir || 'Petugas Kasir'}</td>
                        <td className="py-2 px-2.5 text-right font-mono tabular-nums font-bold text-slate-900 whitespace-nowrap">
                          {formatRupiah(k.nominalFee)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-emerald-50/70 border-t border-emerald-200 font-bold text-emerald-900">
                      <td colSpan={6} className="py-2 px-2.5 text-right">
                        Subtotal PKM / Faskes 1
                      </td>
                      <td className="py-2 px-2.5 text-right font-mono tabular-nums whitespace-nowrap">
                        {formatRupiah(faskesTotal)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>

          {/* Grand Total Bar */}
          <div className="rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3 flex items-center justify-between gap-4">
            <span className="text-xs sm:text-sm font-extrabold text-emerald-950">
              GRAND TOTAL PENCAIRAN LUNAS HARI INI ({todayLunasKupons.length} KUPON)
            </span>
            <span className="font-mono tabular-nums text-base sm:text-lg font-extrabold text-emerald-900 whitespace-nowrap">
              {formatRupiah(grandTotal)}
            </span>
          </div>

          {/* Print Signature Footer */}
          <div className="pt-2 space-y-4 text-xs text-slate-600">
            <p>Dicetak pada: <span className="font-mono tabular-nums">{printedAt}</span></p>
            <div className="grid grid-cols-2 gap-8 pt-2 text-center">
              <div>
                <p>Petugas Kasir Shift,</p>
                <div className="h-14" />
                <p className="border-t border-slate-400 pt-1 mx-6 text-[11px]">( Nama Terang &amp; Paraf )</p>
              </div>
              <div>
                <p>Mengetahui, Kepala Unit Keuangan</p>
                <div className="h-14" />
                <p className="border-t border-slate-400 pt-1 mx-6 text-[11px]">( Nama Terang &amp; Paraf )</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
