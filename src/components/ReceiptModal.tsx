import { ExternalLink, Printer, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { KuponFee } from '../types/kupon.ts';
import { formatRupiah, formatTanggalJam, getKategoriLabel } from '../utils/formatters.ts';
import {
  buildThermalReceiptTabUrl,
  getSavedThermalPaperSize,
  saveThermalPaperSize,
  type ThermalPaperSize,
} from '../utils/thermalReceiptUrl.ts';

interface ReceiptModalProps {
  kupon: KuponFee | null;
  onClose: () => void;
}

export function ReceiptModal({ kupon, onClose }: ReceiptModalProps) {
  const [paperSize, setPaperSize] = useState<ThermalPaperSize>(() => getSavedThermalPaperSize());

  const printTabUrl = useMemo(() => {
    if (!kupon) return '#';
    return buildThermalReceiptTabUrl(kupon, paperSize);
  }, [kupon, paperSize]);

  if (!kupon) return null;

  const inputDt = formatTanggalJam(kupon.tanggalInput);
  const cairDt = formatTanggalJam(kupon.waktuCair);

  const handleSelectPaperSize = (size: ThermalPaperSize) => {
    setPaperSize(size);
    saveThermalPaperSize(size);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="receipt-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/45 backdrop-blur-xs"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="neu-raised w-full max-w-md rounded-2xl p-6 max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-4 border-b border-slate-300/60">
          <div>
            <h2 id="receipt-modal-title" className="text-base font-extrabold text-slate-900">
              Bukti Pencairan Kupon Fee
            </h2>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Cetak dibuka di tab browser baru khusus printer thermal
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup pratinjau struk"
            className="neu-btn p-2 rounded-xl text-slate-600 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Thermal Paper Size Selector */}
        <div className="mt-4 flex items-center justify-between gap-3">
          <span className="text-xs font-semibold text-slate-600">Lebar Kertas Thermal</span>
          <div
            role="group"
            aria-label="Pilih ukuran kertas thermal"
            className="neu-inset-sm p-1 rounded-xl inline-flex items-center gap-1"
          >
            {(['58mm', '80mm'] as const).map((size) => {
              const active = paperSize === size;
              return (
                <button
                  key={size}
                  type="button"
                  onClick={() => handleSelectPaperSize(size)}
                  className={`px-3 py-1 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${
                    active
                      ? 'bg-emerald-700 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {size}
                </button>
              );
            })}
          </div>
        </div>

        {/* Thermal Receipt Preview Block (58mm / 80mm compatible) */}
        <div
          id="thermal-receipt-print"
          className="mt-3.5 bg-white rounded-xl p-5 border border-slate-300/80 text-slate-900 font-mono text-xs leading-relaxed"
        >
          <div className="text-center border-b border-dashed border-slate-400 pb-3">
            <p className="font-bold text-sm tracking-tight">RSU MUHAMMADIYAH BABAT</p>
            <p className="text-[11px] text-slate-600">Jl. KH. Ahmad Dahlan No. 14, Babat, Lamongan</p>
            <p className="mt-1 font-bold text-xs">BUKTI PENCAIRAN FEE RUJUKAN</p>
          </div>

          <div className="py-3 space-y-1.5 border-b border-dashed border-slate-400">
            <div className="flex justify-between gap-2">
              <span className="text-slate-600">No. Kupon</span>
              <span className="font-bold tabular-nums">{kupon.noKupon}</span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-slate-600">Status</span>
              <span className="font-bold">LUNAS (TUNAI)</span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-slate-600">Waktu Cair</span>
              <span className="tabular-nums text-right">{cairDt.lengkap}</span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-slate-600">Petugas Kasir</span>
              <span className="text-right">{kupon.petugasKasir || 'Petugas Kasir'}</span>
            </div>
          </div>

          <div className="py-3 space-y-1.5 border-b border-dashed border-slate-400">
            <div className="flex justify-between gap-2">
              <span className="text-slate-600">Kategori</span>
              <span className="text-right">{getKategoriLabel(kupon.kategori)}</span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-slate-600">Sopir/Perujuk</span>
              <span className="font-bold text-right">{kupon.namaPerujuk}</span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-slate-600">Instansi/Desa</span>
              <span className="text-right">{kupon.asalInstansi}</span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-slate-600">Pasien Ranap</span>
              <span className="text-right">{kupon.namaPasien}</span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-slate-600">Input Daftar</span>
              <span className="text-right">{inputDt.jam} ({kupon.petugasPendaftaran})</span>
            </div>
          </div>

          <div className="py-3 flex items-center justify-between text-sm font-bold border-b border-dashed border-slate-400">
            <span>TOTAL DITERIMA</span>
            <span className="tabular-nums text-base">{formatRupiah(kupon.nominalFee)}</span>
          </div>

          {kupon.catatanKasir ? (
            <p className="pt-2 text-[11px] text-slate-600">Catatan: {kupon.catatanKasir}</p>
          ) : null}

          <div className="pt-5 grid grid-cols-2 gap-4 text-center text-[11px]">
            <div>
              <p className="text-slate-500">Petugas Kasir</p>
              <div className="h-9" />
              <p className="border-t border-slate-400 pt-1">{kupon.petugasKasir || 'Kasir RSUMB'}</p>
            </div>
            <div>
              <p className="text-slate-500">Penerima / Sopir</p>
              <div className="h-9" />
              <p className="border-t border-slate-400 pt-1">{kupon.namaPerujuk}</p>
            </div>
          </div>
        </div>

        <div className="mt-5 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="neu-btn px-4 py-2.5 rounded-xl text-sm font-semibold text-slate-700 cursor-pointer"
          >
            Tutup
          </button>
          <a
            href={printTabUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="neu-btn-emerald inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold cursor-pointer no-underline"
          >
            <Printer className="w-4 h-4" />
            <span>Cetak Thermal ({paperSize})</span>
            <ExternalLink className="w-3.5 h-3.5 opacity-85" />
          </a>
        </div>
      </div>
    </div>
  );
}
