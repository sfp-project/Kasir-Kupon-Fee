import { AlertTriangle, RotateCcw, X } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import type { KuponFee } from '../types/kupon.ts';
import { formatRupiah, formatTanggalJam } from '../utils/formatters.ts';

interface CancelLunasModalProps {
  kupon: KuponFee | null;
  isSubmitting: boolean;
  onClose: () => void;
  onConfirm: (alasan: string) => Promise<void>;
}

export function CancelLunasModal({
  kupon,
  isSubmitting,
  onClose,
  onConfirm,
}: CancelLunasModalProps) {
  const [alasan, setAlasan] = useState('');

  useEffect(() => {
    if (kupon) {
      setAlasan('');
    }
  }, [kupon]);

  if (!kupon) return null;

  const cairDt = formatTanggalJam(kupon.waktuCair);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    await onConfirm(alasan.trim() || 'Salah klik oleh petugas kasir');
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="cancel-lunas-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/45 backdrop-blur-xs"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isSubmitting) onClose();
      }}
    >
      <div className="neu-raised w-full max-w-md rounded-2xl p-6">
        <div className="flex items-start justify-between gap-4 pb-4 border-b border-slate-300/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-100 text-red-700 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h2 id="cancel-lunas-title" className="text-base font-extrabold text-slate-900">
                Batalkan Status Lunas?
              </h2>
              <p className="text-xs text-slate-600 mt-0.5">
                Status kupon akan dikembalikan ke Menunggu Kasir.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            aria-label="Tutup dialog"
            className="neu-btn p-2 rounded-xl text-slate-600 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <dl className="mt-4 neu-inset rounded-xl p-4 space-y-2 text-xs sm:text-sm">
          <div className="flex justify-between gap-3">
            <dt className="text-slate-500">No. Kupon</dt>
            <dd className="font-mono tabular-nums font-bold text-slate-900">{kupon.noKupon}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-slate-500">Sopir / Perujuk</dt>
            <dd className="font-semibold text-slate-900 text-right">{kupon.namaPerujuk}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-slate-500">Nominal Fee</dt>
            <dd className="font-mono tabular-nums font-bold text-slate-900">
              {formatRupiah(kupon.nominalFee)}
            </dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-slate-500">Dicairkan Pada</dt>
            <dd className="font-mono tabular-nums text-slate-700 text-right">
              {cairDt.lengkap} ({kupon.petugasKasir || 'Kasir'})
            </dd>
          </div>
        </dl>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label htmlFor="cancel-reason" className="block text-xs font-bold text-slate-700 mb-1.5">
              Alasan Pembatalan <span className="font-normal text-slate-500">(opsional)</span>
            </label>
            <input
              id="cancel-reason"
              type="text"
              value={alasan}
              onChange={(e) => setAlasan(e.target.value)}
              placeholder="Contoh: Salah klik baris kupon"
              className="neu-inset-sm w-full h-11 px-3.5 rounded-xl text-sm font-medium text-slate-900 placeholder:text-slate-400"
            />
          </div>

          <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="neu-btn px-4 py-2.5 rounded-xl text-sm font-semibold text-slate-700 cursor-pointer"
            >
              Tetap Lunas
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="neu-btn-danger inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold cursor-pointer disabled:opacity-60"
            >
              <RotateCcw className="w-4 h-4" />
              <span>{isSubmitting ? 'Membatalkan...' : 'Ya, Batalkan Lunas'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
