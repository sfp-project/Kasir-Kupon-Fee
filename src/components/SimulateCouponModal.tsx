import { Send, X } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import type { KuponKategori, NewKuponPayload, PenjaminPasien } from '../types/kupon.ts';
import { formatRupiah, getDefaultFee } from '../utils/formatters.ts';

interface SimulateCouponModalProps {
  isOpen: boolean;
  isSubmitting: boolean;
  onClose: () => void;
  onSubmit: (payload: NewKuponPayload) => Promise<void>;
}

const STAF_PENDAFTARAN = ['Hisyam', 'Alivia', 'Abi', 'Ady', 'Melinda', 'Agnia', 'Ismed', 'Syafik'];
const RUANG_RANAP = ['R. Arafah Lt. 1', 'R. Arafah Lt. 2', 'R. Mina Lt. 1', 'R. Mina Lt. 2', 'R. Shofa Anak', 'R. Marwah', 'R. Zam-Zam VIP', 'ICU'];

export function SimulateCouponModal({
  isOpen,
  isSubmitting,
  onClose,
  onSubmit,
}: SimulateCouponModalProps) {
  const [namaPasien, setNamaPasien] = useState('');
  const [noRm, setNoRm] = useState('');
  const [ruangRanap, setRuangRanap] = useState(RUANG_RANAP[0]);
  const [kategori, setKategori] = useState<KuponKategori>('MOHAT_DESA');
  const [penjamin, setPenjamin] = useState<PenjaminPasien>('BPJS');
  const [namaPerujuk, setNamaPerujuk] = useState('');
  const [asalInstansi, setAsalInstansi] = useState('');
  const [petugasPendaftaran, setPetugasPendaftaran] = useState(STAF_PENDAFTARAN[0]);

  if (!isOpen) return null;

  const nominalFee = getDefaultFee(kategori, penjamin);

  const fillQuickSample = (type: 'mohat' | 'pkm_bpjs' | 'pkm_umum') => {
    if (type === 'mohat') {
      setNamaPasien('Tn. Kusnadi');
      setNoRm('04-82-66');
      setRuangRanap('R. Arafah Lt. 2');
      setKategori('MOHAT_DESA');
      setPenjamin('BPJS');
      setNamaPerujuk('Bpk. Sukardi');
      setAsalInstansi('Mohat Desa Moropelang, Babat');
      setPetugasPendaftaran('Hisyam');
    } else if (type === 'pkm_bpjs') {
      setNamaPasien('Ny. Rohmatul Ummah');
      setNoRm('04-82-71');
      setRuangRanap('R. Marwah');
      setKategori('PKM_FASKES_1');
      setPenjamin('BPJS');
      setNamaPerujuk('Bd. Laila Maghfiroh');
      setAsalInstansi('PKM Babat');
      setPetugasPendaftaran('Alivia');
    } else {
      setNamaPasien('Tn. H. Subakir');
      setNoRm('04-82-74');
      setRuangRanap('R. Zam-Zam VIP');
      setKategori('PKM_FASKES_1');
      setPenjamin('UMUM');
      setNamaPerujuk('Bpk. Wahyu Hidayat');
      setAsalInstansi('Klinik Pratama Muhammadiyah Pucuk');
      setPetugasPendaftaran('Abi');
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!namaPasien.trim() || !namaPerujuk.trim() || !asalInstansi.trim()) return;
    await onSubmit({
      namaPasien: namaPasien.trim(),
      noRm: noRm.trim() || undefined,
      ruangRanap,
      penjamin,
      kategori,
      namaPerujuk: namaPerujuk.trim(),
      asalInstansi: asalInstansi.trim(),
      nominalFee,
      petugasPendaftaran,
      sumberSync: 'SIMULASI_PENDAFTARAN',
    });
    setNamaPasien('');
    setNoRm('');
    setNamaPerujuk('');
    setAsalInstansi('');
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="sim-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/45 backdrop-blur-xs"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isSubmitting) onClose();
      }}
    >
      <div className="neu-raised w-full max-w-xl rounded-2xl p-6 max-h-[92vh] overflow-y-auto">
        <div className="flex items-start justify-between gap-4 pb-4 border-b border-slate-300/60">
          <div>
            <h2 id="sim-modal-title" className="text-lg font-extrabold text-slate-900">
              Simulasi Kupon Masuk dari Pendaftaran
            </h2>
            <p className="text-xs text-slate-600 mt-0.5">
              Uji alur real-time saat staf Pendaftaran menginput kupon fee baru ke server Kasir.
            </p>
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

        {/* Quick Preset Autofill */}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-slate-600">Isi cepat contoh:</span>
          <button
            type="button"
            onClick={() => fillQuickSample('mohat')}
            className="neu-btn px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-800 cursor-pointer"
          >
            Mohat Desa (Rp 25.000)
          </button>
          <button
            type="button"
            onClick={() => fillQuickSample('pkm_bpjs')}
            className="neu-btn px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-800 cursor-pointer"
          >
            PKM BPJS (Rp 20.000)
          </button>
          <button
            type="button"
            onClick={() => fillQuickSample('pkm_umum')}
            className="neu-btn px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-800 cursor-pointer"
          >
            Faskes 1 Umum (Rp 35.000)
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="sim-pasien" className="block text-xs font-bold text-slate-700 mb-1.5">
                Nama Pasien Ranap *
              </label>
              <input
                id="sim-pasien"
                required
                type="text"
                value={namaPasien}
                onChange={(e) => setNamaPasien(e.target.value)}
                placeholder="Contoh: Tn. Kusnadi"
                className="neu-inset-sm w-full h-11 px-3.5 rounded-xl text-sm font-medium text-slate-900"
              />
            </div>
            <div>
              <label htmlFor="sim-norm" className="block text-xs font-bold text-slate-700 mb-1.5">
                No. Rekam Medis <span className="font-normal text-slate-500">(opsional)</span>
              </label>
              <input
                id="sim-norm"
                type="text"
                value={noRm}
                onChange={(e) => setNoRm(e.target.value)}
                placeholder="04-82-66"
                className="neu-inset-sm w-full h-11 px-3.5 rounded-xl text-sm font-mono text-slate-900"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label htmlFor="sim-kategori" className="block text-xs font-bold text-slate-700 mb-1.5">
                Kategori Fee
              </label>
              <select
                id="sim-kategori"
                value={kategori}
                onChange={(e) => setKategori(e.target.value as KuponKategori)}
                className="neu-inset-sm w-full h-11 px-3 rounded-xl text-sm font-semibold text-slate-900 bg-[#E4EBF2]"
              >
                <option value="MOHAT_DESA">Mohat Desa</option>
                <option value="PKM_FASKES_1">PKM / Faskes 1</option>
              </select>
            </div>
            <div>
              <label htmlFor="sim-penjamin" className="block text-xs font-bold text-slate-700 mb-1.5">
                Penjamin Pasien
              </label>
              <select
                id="sim-penjamin"
                value={penjamin}
                onChange={(e) => setPenjamin(e.target.value as PenjaminPasien)}
                className="neu-inset-sm w-full h-11 px-3 rounded-xl text-sm font-semibold text-slate-900 bg-[#E4EBF2]"
              >
                <option value="BPJS">BPJS Kesehatan</option>
                <option value="UMUM">Pasien Umum</option>
                <option value="JASA_RAHARJA">Jasa Raharja</option>
              </select>
            </div>
            <div>
              <label htmlFor="sim-ruang" className="block text-xs font-bold text-slate-700 mb-1.5">
                Ruang Rawat Inap
              </label>
              <select
                id="sim-ruang"
                value={ruangRanap}
                onChange={(e) => setRuangRanap(e.target.value)}
                className="neu-inset-sm w-full h-11 px-3 rounded-xl text-sm font-semibold text-slate-900 bg-[#E4EBF2]"
              >
                {RUANG_RANAP.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="sim-perujuk" className="block text-xs font-bold text-slate-700 mb-1.5">
                Nama Sopir / Perujuk *
              </label>
              <input
                id="sim-perujuk"
                required
                type="text"
                value={namaPerujuk}
                onChange={(e) => setNamaPerujuk(e.target.value)}
                placeholder="Contoh: Bpk. Sukardi"
                className="neu-inset-sm w-full h-11 px-3.5 rounded-xl text-sm font-medium text-slate-900"
              />
            </div>
            <div>
              <label htmlFor="sim-instansi" className="block text-xs font-bold text-slate-700 mb-1.5">
                Asal Desa / PKM / Klinik *
              </label>
              <input
                id="sim-instansi"
                required
                type="text"
                value={asalInstansi}
                onChange={(e) => setAsalInstansi(e.target.value)}
                placeholder="Contoh: Mohat Desa Moropelang"
                className="neu-inset-sm w-full h-11 px-3.5 rounded-xl text-sm font-medium text-slate-900"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-end">
            <div>
              <label htmlFor="sim-staf" className="block text-xs font-bold text-slate-700 mb-1.5">
                Staf Pendaftaran Pengirim
              </label>
              <select
                id="sim-staf"
                value={petugasPendaftaran}
                onChange={(e) => setPetugasPendaftaran(e.target.value)}
                className="neu-inset-sm w-full h-11 px-3 rounded-xl text-sm font-semibold text-slate-900 bg-[#E4EBF2]"
              >
                {STAF_PENDAFTARAN.map((staf) => (
                  <option key={staf} value={staf}>
                    {staf}
                  </option>
                ))}
              </select>
            </div>
            <div className="neu-inset rounded-xl px-4 py-2.5 flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-600">Nominal Fee Otomatis</span>
              <span className="font-mono tabular-nums text-lg font-extrabold text-emerald-800">
                {formatRupiah(nominalFee)}
              </span>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-300/60 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="neu-btn px-4 py-2.5 rounded-xl text-sm font-semibold text-slate-700 cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="neu-btn-emerald inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold cursor-pointer disabled:opacity-60"
            >
              <Send className="w-4 h-4" />
              <span>{isSubmitting ? 'Mengirim...' : 'Kirim ke Antrean Kasir'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
