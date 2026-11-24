import { Printer, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { formatRupiah, formatTanggalJam, getKategoriLabel } from '../utils/formatters.ts';
import {
  parseThermalReceiptFromLocation,
  saveThermalPaperSize,
  type ThermalPaperSize,
} from '../utils/thermalReceiptUrl.ts';

export function ThermalReceiptPrintPage() {
  const initial = useMemo(() => parseThermalReceiptFromLocation(), []);
  const [paperSize, setPaperSize] = useState<ThermalPaperSize>(initial.paperSize);
  const hasAutoPrintedRef = useRef(false);
  const payload = initial.payload;

  useEffect(() => {
    document.body.classList.add('thermal-print-page');
    if (payload) {
      document.title = `Struk Thermal ${payload.noKupon} — RSU Muhammadiyah Babat`;
    } else {
      document.title = 'Cetak Struk Thermal — RSU Muhammadiyah Babat';
    }
    return () => {
      document.body.classList.remove('thermal-print-page');
    };
  }, [payload]);

  useEffect(() => {
    saveThermalPaperSize(paperSize);
  }, [paperSize]);

  // Automatically trigger thermal print dialog once fonts and layout are ready
  useEffect(() => {
    if (!payload || hasAutoPrintedRef.current) return;
    hasAutoPrintedRef.current = true;

    let cancelled = false;
    let timerId: number | undefined;

    const triggerPrint = () => {
      if (cancelled) return;
      timerId = window.setTimeout(() => {
        if (!cancelled) {
          window.focus();
          window.print();
        }
      }, 280);
    };

    if (document.fonts && typeof document.fonts.ready?.then === 'function') {
      document.fonts.ready.then(triggerPrint, triggerPrint);
    } else {
      triggerPrint();
    }

    return () => {
      cancelled = true;
      if (timerId !== undefined) {
        window.clearTimeout(timerId);
      }
    };
  }, [payload]);

  const handlePrintNow = () => {
    window.focus();
    window.print();
  };

  const handleCloseTab = () => {
    window.close();
  };

  const is58 = paperSize === '58mm';

  // Dynamic @page size so 58mm and 80mm thermal printers do not feed extra blank A4 length
  const dynamicPageCss = `
    @page {
      size: ${paperSize} auto;
      margin: 0mm;
    }
    @media print {
      html, body.thermal-print-page {
        width: ${paperSize} !important;
        min-width: ${paperSize} !important;
        max-width: ${paperSize} !important;
        margin: 0 !important;
        padding: 0 !important;
        background: #ffffff !important;
        color: #000000 !important;
        height: auto !important;
        min-height: 0 !important;
      }
      #thermal-receipt-sheet {
        width: ${paperSize} !important;
        max-width: ${paperSize} !important;
        margin: 0 !important;
        padding: ${is58 ? '2.5mm 2.5mm 6mm 2.5mm' : '4mm 4mm 6mm 4mm'} !important;
        border: none !important;
        border-radius: 0 !important;
        box-shadow: none !important;
        background: #ffffff !important;
        color: #000000 !important;
      }
    }
  `;

  if (!payload) {
    return (
      <div className="min-h-screen neu-canvas flex items-center justify-center p-6">
        <div className="neu-raised max-w-md w-full rounded-2xl p-6 text-center space-y-4">
          <h1 className="text-base font-extrabold text-slate-900">Data Struk Tidak Ditemukan</h1>
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
            Silakan buka kembali bukti pencairan kupon dari halaman Web Kasir lalu klik tombol
            <strong> Cetak Thermal</strong>.
          </p>
          <button
            type="button"
            onClick={handleCloseTab}
            className="neu-btn px-5 py-2.5 rounded-xl text-sm font-bold text-slate-800 cursor-pointer"
          >
            Tutup Tab
          </button>
        </div>
      </div>
    );
  }

  const inputDt = formatTanggalJam(payload.tanggalInput);
  const cairDt = formatTanggalJam(payload.waktuCair);

  return (
    <div className="min-h-screen neu-canvas print:min-h-0 print:bg-white">
      <style>{dynamicPageCss}</style>

      {/* Non-printing top toolbar */}
      <header className="thermal-no-print sticky top-0 z-20 px-4 py-3 border-b border-slate-300/70 bg-[#ebf0f5]/95 backdrop-blur-xs">
        <div className="max-w-2xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-sm sm:text-base font-extrabold text-slate-900">
              Cetak Struk Thermal · {payload.noKupon}
            </h1>
            <p className="text-[11px] text-slate-600 mt-0.5">
              Atur Margins: <strong>None</strong> &amp; matikan <strong>Headers and footers</strong>{' '}
              pada dialog cetak printer thermal.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Paper width toggle (58mm / 80mm) */}
            <div
              role="group"
              aria-label="Pilih lebar kertas thermal"
              className="neu-inset-sm p-1 rounded-xl inline-flex items-center gap-1"
            >
              {(['58mm', '80mm'] as const).map((size) => {
                const active = paperSize === size;
                return (
                  <button
                    key={size}
                    type="button"
                    onClick={() => setPaperSize(size)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${
                      active
                        ? 'bg-emerald-700 text-white shadow-xs'
                        : 'text-slate-700 hover:text-slate-900'
                    }`}
                  >
                    {size}
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              onClick={handlePrintNow}
              className="neu-btn-emerald inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>Cetak Sekarang</span>
            </button>

            <button
              type="button"
              onClick={handleCloseTab}
              className="neu-btn inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold text-slate-700 cursor-pointer"
            >
              <X className="w-4 h-4" />
              <span>Tutup</span>
            </button>
          </div>
        </div>
      </header>

      {/* Thermal Paper Sheet */}
      <main className="py-8 px-4 flex justify-center print:p-0 print:block">
        <article
          id="thermal-receipt-sheet"
          className={`bg-white text-black font-mono border border-slate-300 rounded-xl shadow-md print:shadow-none print:border-0 print:rounded-none ${
            is58
              ? 'w-[58mm] p-[3mm] text-[10px] leading-[1.4]'
              : 'w-[80mm] p-[4mm] text-[11.5px] leading-[1.45]'
          }`}
        >
          {/* Hospital Header */}
          <div className="text-center border-b border-dashed border-black pb-2.5">
            <p className={`font-bold tracking-tight text-black ${is58 ? 'text-[11px]' : 'text-[13px]'}`}>
              RSU MUHAMMADIYAH BABAT
            </p>
            <p className={`text-black mt-0.5 ${is58 ? 'text-[9px]' : 'text-[10px]'}`}>
              Jl. KH. Ahmad Dahlan No. 14, Babat, Lamongan
            </p>
            <p className={`mt-1.5 font-bold text-black ${is58 ? 'text-[10px]' : 'text-[11.5px]'}`}>
              BUKTI PENCAIRAN FEE RUJUKAN
            </p>
          </div>

          {/* Coupon & Cashier Metadata */}
          <div className="py-2.5 space-y-1 border-b border-dashed border-black">
            <div className="flex justify-between gap-2">
              <span className="shrink-0">No. Kupon</span>
              <span className="font-bold tabular-nums text-right break-all">{payload.noKupon}</span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="shrink-0">Status</span>
              <span className="font-bold text-right">{payload.status}</span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="shrink-0">Waktu Cair</span>
              <span className="tabular-nums text-right">{cairDt.lengkap}</span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="shrink-0">Petugas Kasir</span>
              <span className="text-right break-words">{payload.petugasKasir}</span>
            </div>
          </div>

          {/* Referrer & Patient Info */}
          <div className="py-2.5 space-y-1 border-b border-dashed border-black">
            <div className="flex justify-between gap-2">
              <span className="shrink-0">Kategori</span>
              <span className="text-right">{getKategoriLabel(payload.kategori)}</span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="shrink-0">Sopir/Perujuk</span>
              <span className="font-bold text-right break-words">{payload.namaPerujuk}</span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="shrink-0">Instansi/Desa</span>
              <span className="text-right break-words">{payload.asalInstansi}</span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="shrink-0">Pasien Ranap</span>
              <span className="text-right break-words">{payload.namaPasien}</span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="shrink-0">Input Daftar</span>
              <span className="text-right tabular-nums break-words">
                {inputDt.jam} ({payload.petugasPendaftaran})
              </span>
            </div>
          </div>

          {/* Total Received */}
          <div
            className={`py-2.5 flex items-center justify-between font-bold border-b border-dashed border-black ${
              is58 ? 'text-[11.5px]' : 'text-[13px]'
            }`}
          >
            <span>TOTAL DITERIMA</span>
            <span className={`tabular-nums ${is58 ? 'text-[12.5px]' : 'text-[15px]'}`}>
              {formatRupiah(payload.nominalFee)}
            </span>
          </div>

          {payload.catatanKasir ? (
            <p className={`pt-2 break-words ${is58 ? 'text-[9px]' : 'text-[10.5px]'}`}>
              Catatan: {payload.catatanKasir}
            </p>
          ) : null}

          {/* Signature Block */}
          <div
            className={`pt-4 grid grid-cols-2 gap-3 text-center ${
              is58 ? 'text-[9px]' : 'text-[10.5px]'
            }`}
          >
            <div>
              <p>Petugas Kasir</p>
              <div className={is58 ? 'h-8' : 'h-10'} />
              <p className="border-t border-black pt-1 break-words">{payload.petugasKasir}</p>
            </div>
            <div>
              <p>Penerima / Sopir</p>
              <div className={is58 ? 'h-8' : 'h-10'} />
              <p className="border-t border-black pt-1 break-words">{payload.namaPerujuk}</p>
            </div>
          </div>

          <p className={`mt-4 text-center ${is58 ? 'text-[8.5px]' : 'text-[9.5px]'}`}>
            --- Terima Kasih · Kasir RSUMB ---
          </p>
        </article>
      </main>
    </div>
  );
}
