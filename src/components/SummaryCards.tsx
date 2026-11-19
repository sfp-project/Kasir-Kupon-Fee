import { FileDown } from 'lucide-react';
import type { CashSummary } from '../types/kupon.ts';
import { formatRupiah } from '../utils/formatters.ts';

interface SummaryCardsProps {
  summary: CashSummary;
  totalAllPendingCount: number;
  totalAllPendingNominal: number;
  onQuickFilterPending: () => void;
  onQuickFilterLunas: () => void;
  onDownloadDailyReport: () => void;
}

export function SummaryCards({
  summary,
  totalAllPendingCount,
  totalAllPendingNominal,
  onQuickFilterPending,
  onQuickFilterLunas,
  onDownloadDailyReport,
}: SummaryCardsProps) {
  const completionPct =
    summary.totalTodayCount > 0
      ? Math.round((summary.lunasCount / summary.totalTodayCount) * 100)
      : 0;

  const olderPendingCount = Math.max(0, totalAllPendingCount - summary.menungguCount);

  return (
    <section aria-label="Ringkasan kas hari ini" className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
        {/* Card 1: Menunggu Kasir Hari Ini */}
        <button
          type="button"
          onClick={onQuickFilterPending}
          className="neu-raised rounded-2xl p-5 text-left transition-transform duration-150 hover:-translate-y-0.5 cursor-pointer group flex flex-col justify-between"
        >
          <div>
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-xs font-semibold text-amber-800">Menunggu Kasir (Hari Ini)</span>
              <span className="font-mono tabular-nums text-xs font-semibold text-amber-700">
                {summary.menungguCount} kupon
              </span>
            </div>

            <p className="mt-3 font-mono tabular-nums text-2xl sm:text-[26px] font-bold tracking-tight text-slate-900">
              {formatRupiah(summary.menungguTotal)}
            </p>
          </div>

          <div className="mt-3 pt-3 border-t border-slate-300/50 flex items-center justify-between text-xs text-slate-600">
            {olderPendingCount > 0 ? (
              <span>
                +{olderPendingCount} kupon sebelumnya ·{' '}
                <strong className="font-mono tabular-nums text-slate-700">
                  {formatRupiah(totalAllPendingNominal)}
                </strong>
              </span>
            ) : (
              <span>Siap dicairkan tunai di loket</span>
            )}
            <span className="text-amber-700 font-semibold group-hover:underline">Lihat</span>
          </div>
        </button>

        {/* Card 2: Lunas Hari Ini + Download Daily Report PDF Action */}
        <div className="neu-raised rounded-2xl p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-xs font-semibold text-emerald-800">Lunas Dicairkan (Hari Ini)</span>
              <span className="font-mono tabular-nums text-xs font-semibold text-emerald-700">
                {summary.lunasCount} kupon
              </span>
            </div>

            <p className="mt-3 font-mono tabular-nums text-2xl sm:text-[26px] font-bold tracking-tight text-emerald-900">
              {formatRupiah(summary.lunasTotal)}
            </p>
          </div>

          <div className="mt-3 pt-3 border-t border-slate-300/50 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={onDownloadDailyReport}
              className="neu-btn inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-emerald-800 hover:text-emerald-950 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <FileDown className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
              <span>Download Daily Report</span>
            </button>
            <button
              type="button"
              onClick={onQuickFilterLunas}
              className="text-xs text-emerald-700 font-semibold hover:underline whitespace-nowrap shrink-0 cursor-pointer"
            >
              Riwayat
            </button>
          </div>
        </div>

        {/* Card 3: Total Kupon Hari Ini */}
        <div className="neu-raised rounded-2xl p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-xs font-semibold text-slate-600">Total Kupon Hari Ini</span>
              <span className="font-mono tabular-nums text-xs font-semibold text-slate-700">
                {summary.totalTodayCount} kupon
              </span>
            </div>

            <p className="mt-3 font-mono tabular-nums text-2xl sm:text-[26px] font-bold tracking-tight text-slate-900">
              {formatRupiah(summary.totalTodayNominal)}
            </p>
          </div>

          <div className="mt-3 pt-3 border-t border-slate-300/50">
            <div className="flex items-center justify-between text-xs text-slate-600 mb-1.5">
              <span>Progres pencairan hari ini</span>
              <span className="font-mono tabular-nums font-semibold text-slate-800">{completionPct}%</span>
            </div>
            <div className="h-2 w-full rounded-full neu-inset-sm overflow-hidden">
              <div
                className="h-full rounded-full bg-emerald-600 transition-all duration-300"
                style={{ width: `${completionPct}%` }}
              />
            </div>
          </div>
        </div>

        {/* Card 4: Rincian Kategori Hari Ini */}
        <div className="neu-raised rounded-2xl p-5 flex flex-col justify-between">
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-xs font-semibold text-slate-600">Rincian Kategori (Hari Ini)</span>
            <span className="text-xs text-slate-500">Tarif RSUMB</span>
          </div>

          <div className="mt-3 space-y-2.5">
            <div className="flex items-center justify-between text-sm">
              <div>
                <span className="font-semibold text-slate-800">Mohat Desa</span>
                <span className="ml-1.5 text-xs text-slate-500 font-mono tabular-nums">
                  ({summary.mohatTodayCount})
                </span>
              </div>
              <span className="font-mono tabular-nums font-bold text-slate-900">
                {formatRupiah(summary.mohatTodayNominal)}
              </span>
            </div>

            <div className="h-px bg-slate-300/50" />

            <div className="flex items-center justify-between text-sm">
              <div>
                <span className="font-semibold text-slate-800">PKM / Faskes 1</span>
                <span className="ml-1.5 text-xs text-slate-500 font-mono tabular-nums">
                  ({summary.faskesTodayCount})
                </span>
              </div>
              <span className="font-mono tabular-nums font-bold text-slate-900">
                {formatRupiah(summary.faskesTodayNominal)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
