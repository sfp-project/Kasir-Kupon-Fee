import { Banknote, CheckCircle2, RotateCcw, X } from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { KuponFee } from '../types/kupon.ts';
import { formatRupiah, formatTanggalJam, getKategoriLabel } from '../utils/formatters.ts';

interface PayConfirmModalProps {
  kupon: KuponFee | null;
  defaultCashierName: string;
  isSubmitting: boolean;
  onClose: () => void;
  onConfirm: (nominalFee: number, petugasKasir: string, catatanKasir: string) => Promise<void>;
}

const NOMINAL_PRESETS = [10000, 15000, 20000, 25000, 30000, 35000] as const;

const CASHIER_PRESETS = [
  'RIA ERVINA',
  'IZZAH FAHMIYATUN NISA',
  'LABIBA QONITA SARISDA',
  'NILNA ALIVIA SYAHIRO',
] as const;

function formatNumericInput(value: number): string {
  if (!value || value <= 0) return '';
  return new Intl.NumberFormat('id-ID').format(value);
}

export function PayConfirmModal({
  kupon,
  defaultCashierName,
  isSubmitting,
  onClose,
  onConfirm,
}: PayConfirmModalProps) {
  const [nominalInput, setNominalInput] = useState<string>('');
  const [petugasKasir, setPetugasKasir] = useState(defaultCashierName);
  const [isCustomMode, setIsCustomMode] = useState(false);
  const [catatanKasir, setCatatanKasir] = useState('');
  const cashierInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (kupon) {
      setNominalInput(formatNumericInput(kupon.nominalFee));
      const initial = defaultCashierName || '';
      setPetugasKasir(initial);
      const matchesPreset = (CASHIER_PRESETS as readonly string[]).includes(initial);
      setIsCustomMode(Boolean(initial) && !matchesPreset);
      setCatatanKasir('');
    }
  }, [kupon, defaultCashierName]);

  if (!kupon) return null;

  const digitsOnly = nominalInput.replace(/\D/g, '');
  const parsedNominal = digitsOnly ? Number.parseInt(digitsOnly, 10) : 0;
  const isNominalValid = Number.isFinite(parsedNominal) && parsedNominal > 0;
  const isNominalModified = isNominalValid && parsedNominal !== kupon.nominalFee;

  const inputDt = formatTanggalJam(kupon.tanggalInput);
  const isPresetSelected = (name: string) => !isCustomMode && petugasKasir === name;
  const isCustomActive =
    isCustomMode ||
    (petugasKasir.trim().length > 0 && !(CASHIER_PRESETS as readonly string[]).includes(petugasKasir));

  const handleSelectNominalPreset = (amount: number) => {
    setNominalInput(formatNumericInput(amount));
  };

  const handleNominalChange = (raw: string) => {
    const cleanDigits = raw.replace(/\D/g, '').slice(0, 9);
    if (!cleanDigits) {
      setNominalInput('');
      return;
    }
    const num = Number.parseInt(cleanDigits, 10);
    setNominalInput(formatNumericInput(num));
  };

  const handleSelectPreset = (name: string) => {
    setIsCustomMode(false);
    setPetugasKasir(name);
  };

  const handleSelectCustom = () => {
    setIsCustomMode(true);
    if ((CASHIER_PRESETS as readonly string[]).includes(petugasKasir)) {
      setPetugasKasir('');
    }
    requestAnimationFrame(() => {
      cashierInputRef.current?.focus();
    });
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!isNominalValid) return;
    await onConfirm(parsedNominal, petugasKasir.trim(), catatanKasir.trim());
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="pay-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/45 backdrop-blur-xs"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isSubmitting) onClose();
      }}
    >
      <div className="neu-raised w-full max-w-lg rounded-2xl p-6 sm:p-7 relative max-h-[92vh] overflow-y-auto">
        <div className="flex items-start justify-between gap-4 pb-4 border-b border-slate-300/60">
          <div>
            <h2 id="pay-modal-title" className="text-lg font-extrabold text-slate-900">
              Konfirmasi Pencairan Kupon Fee
            </h2>
            <p className="text-xs text-slate-600 mt-0.5">
              Pastikan uang tunai diserahkan sesuai nominal kepada sopir atau perujuk.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            aria-label="Tutup dialog"
            className="neu-btn p-2 rounded-xl text-slate-600 hover:text-slate-900 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Highlighted & Editable Payout Nominal */}
        <div className="mt-5 neu-inset rounded-xl p-4 sm:p-5 space-y-3.5">
          <div className="text-center">
            <p className="text-xs font-semibold text-slate-600">Nominal Uang Tunai yang Diserahkan</p>
            <p
              className={`mt-1 font-mono tabular-nums text-3xl sm:text-4xl font-extrabold tracking-tight ${
                isNominalValid ? 'text-emerald-800' : 'text-red-700'
              }`}
            >
              {formatRupiah(parsedNominal)}
            </p>
            <div className="mt-1 flex items-center justify-center gap-2 text-xs text-slate-600 flex-wrap">
              <span>
                {getKategoriLabel(kupon.kategori)} · Penjamin {kupon.penjamin}
              </span>
              {isNominalModified ? (
                <button
                  type="button"
                  onClick={() => handleSelectNominalPreset(kupon.nominalFee)}
                  className="inline-flex items-center gap-1 font-semibold text-amber-800 hover:underline cursor-pointer"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Tarif awal: {formatRupiah(kupon.nominalFee)}</span>
                </button>
              ) : null}
            </div>
          </div>

          {/* Quick Select Nominal Chips */}
          <div className="pt-3 border-t border-slate-300/60 space-y-2.5">
            <div className="flex flex-wrap items-center justify-center gap-1.5">
              <span className="text-[11px] font-semibold text-slate-500 mr-1">Pilih cepat:</span>
              {NOMINAL_PRESETS.map((amount) => {
                const active = parsedNominal === amount;
                return (
                  <button
                    key={amount}
                    type="button"
                    onClick={() => handleSelectNominalPreset(amount)}
                    className={`px-2.5 py-1.5 rounded-lg text-[11px] font-mono tabular-nums font-bold transition-all whitespace-nowrap cursor-pointer ${
                      active
                        ? 'bg-emerald-700 text-white shadow-xs'
                        : 'neu-btn text-slate-700 hover:text-slate-900'
                    }`}
                  >
                    {formatRupiah(amount)}
                  </button>
                );
              })}
            </div>

            {/* Manual Custom Rupiah Input */}
            <div>
              <label htmlFor="custom-nominal-input" className="sr-only">
                Input nominal custom dalam Rupiah
              </label>
              <div className="relative flex items-center">
                <span className="pointer-events-none absolute left-3.5 text-xs font-mono font-bold text-slate-500">
                  Rp
                </span>
                <input
                  id="custom-nominal-input"
                  type="text"
                  inputMode="numeric"
                  value={nominalInput}
                  onChange={(e) => handleNominalChange(e.target.value)}
                  placeholder="Ketik nominal custom (mis. 25.000)"
                  className="neu-raised-sm w-full h-10 pl-10 pr-3.5 rounded-xl font-mono tabular-nums text-sm font-bold text-slate-900 placeholder:font-sans placeholder:font-normal placeholder:text-slate-400"
                />
              </div>
              {!isNominalValid ? (
                <p className="mt-1 text-[11px] font-semibold text-red-700">
                  Masukkan nominal pencairan lebih dari Rp 0.
                </p>
              ) : null}
            </div>
          </div>
        </div>

        {/* Coupon Details Summary */}
        <dl className="mt-5 space-y-2.5 text-sm border-b border-slate-300/60 pb-5">
          <div className="flex items-center justify-between gap-4">
            <dt className="text-slate-500">Nomor Kupon</dt>
            <dd className="font-mono tabular-nums font-bold text-slate-900">{kupon.noKupon}</dd>
          </div>
          <div className="flex items-center justify-between gap-4">
            <dt className="text-slate-500">Nama Sopir / Perujuk</dt>
            <dd className="font-bold text-slate-900 text-right">{kupon.namaPerujuk}</dd>
          </div>
          <div className="flex items-center justify-between gap-4">
            <dt className="text-slate-500">Asal Instansi / Desa</dt>
            <dd className="font-medium text-slate-800 text-right">{kupon.asalInstansi}</dd>
          </div>
          <div className="flex items-center justify-between gap-4">
            <dt className="text-slate-500">Pasien Rawat Inap</dt>
            <dd className="font-medium text-slate-800 text-right">
              {kupon.namaPasien} ({kupon.ruangRanap})
            </dd>
          </div>
          <div className="flex items-center justify-between gap-4">
            <dt className="text-slate-500">Waktu &amp; Staf Input</dt>
            <dd className="font-mono tabular-nums text-xs text-slate-700 text-right">
              {inputDt.lengkap} · {kupon.petugasPendaftaran}
            </dd>
          </div>
        </dl>

        {/* Cashier Officer Form */}
        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div>
            <label htmlFor="cashier-name-input" className="block text-xs font-bold text-slate-700 mb-1.5">
              Nama Petugas Kasir <span className="font-normal text-slate-500">(opsional)</span>
            </label>
            <div className="relative">
              <input
                ref={cashierInputRef}
                id="cashier-name-input"
                type="text"
                value={petugasKasir}
                onChange={(e) => {
                  const val = e.target.value;
                  setPetugasKasir(val);
                  if ((CASHIER_PRESETS as readonly string[]).includes(val)) {
                    setIsCustomMode(false);
                  } else if (val.length > 0) {
                    setIsCustomMode(true);
                  }
                }}
                placeholder={
                  isCustomMode
                    ? 'Ketik nama petugas kasir secara manual (boleh dikosongkan)'
                    : 'Pilih cepat di bawah atau ketik nama sendiri (opsional)'
                }
                className="neu-inset-sm w-full h-11 pl-3.5 pr-9 rounded-xl text-sm font-medium text-slate-900 placeholder:text-slate-400"
              />
              {petugasKasir ? (
                <button
                  type="button"
                  onClick={() => {
                    setPetugasKasir('');
                    setIsCustomMode(false);
                  }}
                  aria-label="Kosongkan nama petugas kasir"
                  className="absolute inset-y-0 right-2 my-auto h-7 w-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/70 transition-colors cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              ) : null}
            </div>

            <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] font-semibold text-slate-500 mr-1">Pilih cepat:</span>
              {CASHIER_PRESETS.map((name) => (
                <button
                  key={name}
                  type="button"
                  onClick={() => handleSelectPreset(name)}
                  className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-all whitespace-nowrap cursor-pointer ${
                    isPresetSelected(name)
                      ? 'bg-emerald-700 text-white shadow-xs'
                      : 'neu-btn text-slate-700 hover:text-slate-900'
                  }`}
                >
                  {name}
                </button>
              ))}
              <button
                type="button"
                onClick={handleSelectCustom}
                className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-all whitespace-nowrap cursor-pointer ${
                  isCustomActive
                    ? 'bg-slate-800 text-white shadow-xs'
                    : 'neu-btn text-slate-700 hover:text-slate-900'
                }`}
              >
                CUSTOM
              </button>
            </div>
          </div>

          <div>
            <label htmlFor="cashier-note-input" className="block text-xs font-bold text-slate-700 mb-1.5">
              Catatan Pencairan <span className="font-normal text-slate-500">(opsional)</span>
            </label>
            <input
              id="cashier-note-input"
              type="text"
              value={catatanKasir}
              onChange={(e) => setCatatanKasir(e.target.value)}
              placeholder="Misal: Diterima langsung oleh sopir / tanda terima lengkap"
              className="neu-inset-sm w-full h-11 px-3.5 rounded-xl text-sm font-medium text-slate-900 placeholder:text-slate-400"
            />
          </div>

          <div className="pt-2 flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="neu-btn px-5 py-2.5 rounded-xl text-sm font-semibold text-slate-700 cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !isNominalValid}
              className="neu-btn-emerald inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold cursor-pointer disabled:opacity-60"
            >
              {isSubmitting ? (
                <span>Memproses Pencairan...</span>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Konfirmasi Bayar &amp; Tandai Lunas</span>
                </>
              )}
            </button>
          </div>
        </form>

        <div className="mt-4 pt-3 border-t border-slate-300/50 flex items-center gap-2 text-[11px] text-slate-500">
          <Banknote className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
          <span>Status LUNAS otomatis tersinkron kembali ke database Web Pendaftaran RSUMB.</span>
        </div>
      </div>
    </div>
  );
}
