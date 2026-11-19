import { CheckCircle2, Clock, Printer, RotateCcw, Banknote, SearchX } from 'lucide-react';
import type { KuponFee } from '../types/kupon.ts';
import { formatRupiah, formatTanggalJam, getKategoriLabel } from '../utils/formatters.ts';

interface KuponTableProps {
  kupons: KuponFee[];
  isLoading: boolean;
  highlightedId?: string | null;
  onPayClick: (kupon: KuponFee) => void;
  onCancelLunasClick: (kupon: KuponFee) => void;
  onPrintReceiptClick: (kupon: KuponFee) => void;
  onResetFilters: () => void;
}

export function KuponTable({
  kupons,
  isLoading,
  highlightedId,
  onPayClick,
  onCancelLunasClick,
  onPrintReceiptClick,
  onResetFilters,
}: KuponTableProps) {
  if (isLoading) {
    return (
      <section aria-label="Memuat daftar kupon" className="neu-raised rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-300/60 flex items-center justify-between">
          <div className="h-5 w-48 rounded bg-slate-300/60 animate-pulse" />
          <div className="h-4 w-28 rounded bg-slate-300/60 animate-pulse" />
        </div>
        <div className="divide-y divide-slate-300/40">
          {Array.from({ length: 5 }).map((_, idx) => (
            <div key={idx} className="px-6 py-4 grid grid-cols-8 gap-4 items-center">
              <div className="h-4 rounded bg-slate-300/60 animate-pulse" />
              <div className="h-4 rounded bg-slate-300/50 animate-pulse" />
              <div className="h-4 rounded bg-slate-300/60 animate-pulse col-span-2" />
              <div className="h-4 rounded bg-slate-300/50 animate-pulse col-span-2" />
              <div className="h-4 rounded bg-slate-300/60 animate-pulse" />
              <div className="h-9 rounded-xl bg-slate-300/60 animate-pulse" />
            </div>
          ))}
        </div>
      </section>
    );
  }

  return (
    <section aria-label="Tabel daftar kupon fee" className="neu-raised rounded-2xl overflow-hidden">
      <div className="px-5 sm:px-6 py-4 border-b border-slate-300/60 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-900">Daftar Kupon Fee Mohat &amp; Perujuk</h2>
          <p className="text-xs text-slate-600 mt-0.5">
            Menampilkan <span className="font-mono tabular-nums font-semibold text-slate-800">{kupons.length}</span> data kupon sesuai filter aktif
          </p>
        </div>
        <div className="text-xs text-slate-600 font-mono tabular-nums">
          Subtotal tampil:{' '}
          <strong className="text-slate-900 text-sm">
            {formatRupiah(kupons.reduce((acc, k) => acc + k.nominalFee, 0))}
          </strong>
        </div>
      </div>

      {kupons.length === 0 ? (
        <div className="px-6 py-16 text-center flex flex-col items-center justify-center">
          <div className="w-12 h-12 rounded-2xl neu-inset flex items-center justify-center text-slate-500 mb-4">
            <SearchX className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-slate-900">Tidak ada kupon ditemukan</h3>
          <p className="text-sm text-slate-600 max-w-md mt-1">
            Belum ada data kupon yang cocok dengan filter status atau kata kunci pencarian Anda saat ini.
          </p>
          <button
            type="button"
            onClick={onResetFilters}
            className="neu-btn mt-5 px-4 py-2.5 rounded-xl text-sm font-semibold text-slate-800 cursor-pointer"
          >
            Tampilkan Semua Kupon
          </button>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[1040px]">
            <thead>
              <tr className="border-b border-slate-300/60 bg-[#E6ECF3]/70 text-xs font-bold text-slate-600">
                <th className="py-3.5 pl-6 pr-3 whitespace-nowrap">No. Kupon</th>
                <th className="py-3.5 px-3 whitespace-nowrap">Tanggal / Jam Input</th>
                <th className="py-3.5 px-3 whitespace-nowrap">Nama Pasien Ranap</th>
                <th className="py-3.5 px-3 whitespace-nowrap">Kategori</th>
                <th className="py-3.5 px-3 whitespace-nowrap">Sopir / Perujuk &amp; Instansi</th>
                <th className="py-3.5 px-3 text-right whitespace-nowrap">Nominal Fee</th>
                <th className="py-3.5 px-3 whitespace-nowrap">Status</th>
                <th className="py-3.5 pl-3 pr-6 text-right whitespace-nowrap">Aksi Kasir</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-300/50 text-sm">
              {kupons.map((kupon) => {
                const inputDt = formatTanggalJam(kupon.tanggalInput);
                const cairDt = kupon.waktuCair ? formatTanggalJam(kupon.waktuCair) : null;
                const isPending = kupon.status === 'MENUNGGU_KASIR';
                const isHighlighted = highlightedId === kupon.id;

                return (
                  <tr
                    key={kupon.id}
                    className={`transition-colors duration-150 ${
                      isHighlighted
                        ? 'bg-emerald-50/90'
                        : 'hover:bg-white/45'
                    }`}
                  >
                    {/* No. Kupon */}
                    <td className="py-4 pl-6 pr-3 align-middle">
                      <div className="font-mono tabular-nums font-bold text-slate-900 whitespace-nowrap">
                        {kupon.noKupon}
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5 whitespace-nowrap">
                        Input: {kupon.petugasPendaftaran}
                      </div>
                    </td>

                    {/* Tanggal / Jam Input */}
                    <td className="py-4 px-3 align-middle whitespace-nowrap">
                      <div className="font-mono tabular-nums text-xs font-semibold text-slate-800">
                        {inputDt.tanggal}
                      </div>
                      <div className="font-mono tabular-nums text-xs text-slate-500 mt-0.5">
                        {inputDt.jam}
                      </div>
                    </td>

                    {/* Nama Pasien Ranap */}
                    <td className="py-4 px-3 align-middle">
                      <div className="font-semibold text-slate-900">{kupon.namaPasien}</div>
                      <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-1.5 flex-wrap">
                        <span>{kupon.ruangRanap}</span>
                        <span aria-hidden="true">·</span>
                        <span className="font-medium text-slate-700">{kupon.penjamin}</span>
                        {kupon.noRm ? (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="font-mono tabular-nums">RM {kupon.noRm}</span>
                          </>
                        ) : null}
                      </div>
                    </td>

                    {/* Kategori */}
                    <td className="py-4 px-3 align-middle whitespace-nowrap">
                      <div className="font-semibold text-slate-800 text-xs sm:text-sm">
                        {getKategoriLabel(kupon.kategori)}
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5">
                        {kupon.kategori === 'MOHAT_DESA'
                          ? 'Tarif Desa / Mohat'
                          : kupon.penjamin === 'UMUM'
                            ? 'Rujukan Umum'
                            : 'Rujukan BPJS'}
                      </div>
                    </td>

                    {/* Sopir / Perujuk & Asal Instansi */}
                    <td className="py-4 px-3 align-middle">
                      <div className="font-semibold text-slate-900">{kupon.namaPerujuk}</div>
                      <div className="text-xs text-slate-600 mt-0.5">{kupon.asalInstansi}</div>
                    </td>

                    {/* Nominal Fee (Rp) */}
                    <td className="py-4 px-3 align-middle text-right whitespace-nowrap">
                      <span className="font-mono tabular-nums text-base font-bold text-slate-900">
                        {formatRupiah(kupon.nominalFee)}
                      </span>
                    </td>

                    {/* Status Badge (Explicitly requested: Orange "Menunggu Kasir" / Green "Lunas") */}
                    <td className="py-4 px-3 align-middle whitespace-nowrap">
                      {isPending ? (
                        <div>
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-100 text-amber-900 border border-amber-300/80">
                            <Clock className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                            <span>Menunggu Kasir</span>
                          </span>
                          {kupon.riwayatBatal ? (
                            <div className="text-[11px] text-slate-500 mt-1 max-w-[170px] truncate" title={kupon.riwayatBatal.alasan}>
                              Koreksi: {kupon.riwayatBatal.alasan}
                            </div>
                          ) : null}
                        </div>
                      ) : (
                        <div>
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-100 text-emerald-900 border border-emerald-300/80">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                            <span>Lunas</span>
                          </span>
                          {cairDt ? (
                            <div className="text-[11px] text-slate-600 font-mono tabular-nums mt-1">
                              {cairDt.tanggal}, {cairDt.jam}
                            </div>
                          ) : null}
                          {kupon.petugasKasir ? (
                            <div className="text-[11px] text-slate-500">
                              Kasir: {kupon.petugasKasir}
                            </div>
                          ) : null}
                        </div>
                      )}
                    </td>

                    {/* Kolom Aksi */}
                    <td className="py-4 pl-3 pr-6 align-middle text-right whitespace-nowrap">
                      {isPending ? (
                        <button
                          type="button"
                          onClick={() => onPayClick(kupon)}
                          className="neu-btn-emerald inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap shrink-0 cursor-pointer"
                        >
                          <Banknote className="w-4 h-4 shrink-0" />
                          <span>Bayar &amp; Tandai Lunas</span>
                        </button>
                      ) : (
                        <div className="inline-flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => onPrintReceiptClick(kupon)}
                            className="neu-btn inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 whitespace-nowrap shrink-0 cursor-pointer"
                          >
                            <Printer className="w-3.5 h-3.5 text-emerald-700" />
                            <span>Cetak Bukti</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => onCancelLunasClick(kupon)}
                            className="neu-btn inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-red-700 hover:text-red-800 whitespace-nowrap shrink-0 cursor-pointer"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            <span>Batalkan Lunas</span>
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
