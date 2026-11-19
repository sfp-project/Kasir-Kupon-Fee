import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { KuponFee } from '../types/kupon.ts';
import { formatRupiah, formatTanggalJam } from './formatters.ts';

interface CategorizedDailyData {
  mohatItems: KuponFee[];
  faskesItems: KuponFee[];
  mohatTotal: number;
  faskesTotal: number;
  grandTotal: number;
}

export function categorizeDailyLunas(todayLunasKupons: KuponFee[]): CategorizedDailyData {
  const sorted = [...todayLunasKupons].sort(
    (a, b) =>
      new Date(a.waktuCair || a.tanggalInput).getTime() -
      new Date(b.waktuCair || b.tanggalInput).getTime(),
  );

  const mohatItems = sorted.filter((k) => k.kategori === 'MOHAT_DESA');
  const faskesItems = sorted.filter((k) => k.kategori === 'PKM_FASKES_1');
  const mohatTotal = mohatItems.reduce((sum, k) => sum + k.nominalFee, 0);
  const faskesTotal = faskesItems.reduce((sum, k) => sum + k.nominalFee, 0);

  return {
    mohatItems,
    faskesItems,
    mohatTotal,
    faskesTotal,
    grandTotal: mohatTotal + faskesTotal,
  };
}

export function downloadDailyReportPdf(todayLunasKupons: KuponFee[], reportDate = new Date()): void {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const marginX = 14;
  const { mohatItems, faskesItems, mohatTotal, faskesTotal, grandTotal } =
    categorizeDailyLunas(todayLunasKupons);

  const dateLabel = new Intl.DateTimeFormat('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(reportDate);

  const printedAt = formatTanggalJam(new Date().toISOString()).lengkap;

  // Hospital Official Header
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(15, 23, 42);
  doc.text('RSU MUHAMMADIYAH BABAT', marginX, 16);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);
  doc.text('Jl. KH. Ahmad Dahlan No. 14, Babat, Kabupaten Lamongan, Jawa Timur', marginX, 21);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(21, 128, 61);
  doc.text('LAPORAN HARIAN PENCAIRAN KUPON FEE (LUNAS)', pageWidth - marginX, 16, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);
  doc.text(`Tanggal: ${dateLabel}`, pageWidth - marginX, 21, { align: 'right' });

  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.4);
  doc.line(marginX, 24.5, pageWidth - marginX, 24.5);

  // Executive Summary Box (3 columns)
  const boxY = 29;
  const boxH = 19;
  const colGap = 4;
  const colW = (pageWidth - marginX * 2 - colGap * 2) / 3;

  const summaryBlocks = [
    {
      label: 'Total Mohat Desa (Lunas)',
      value: formatRupiah(mohatTotal),
      sub: `${mohatItems.length} transaksi`,
      accent: [15, 23, 42] as [number, number, number],
    },
    {
      label: 'Total PKM / Faskes 1 (Lunas)',
      value: formatRupiah(faskesTotal),
      sub: `${faskesItems.length} transaksi`,
      accent: [15, 23, 42] as [number, number, number],
    },
    {
      label: 'Total Kas Keluar Hari Ini',
      value: formatRupiah(grandTotal),
      sub: `${todayLunasKupons.length} transaksi lunas`,
      accent: [21, 128, 61] as [number, number, number],
    },
  ];

  summaryBlocks.forEach((blk, idx) => {
    const x = marginX + idx * (colW + colGap);
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(x, boxY, colW, boxH, 2, 2, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text(blk.label, x + 3.5, boxY + 5.5);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(blk.accent[0], blk.accent[1], blk.accent[2]);
    doc.text(blk.value, x + 3.5, boxY + 12);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text(blk.sub, x + 3.5, boxY + 16.5);
  });

  let cursorY = boxY + boxH + 8;

  const renderCategorySection = (
    title: string,
    items: KuponFee[],
    subtotal: number,
  ) => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);
    doc.text(`${title} (${items.length} kupon)`, marginX, cursorY);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(21, 128, 61);
    doc.text(`Subtotal: ${formatRupiah(subtotal)}`, pageWidth - marginX, cursorY, {
      align: 'right',
    });

    cursorY += 3;

    if (items.length === 0) {
      autoTable(doc, {
        startY: cursorY,
        margin: { left: marginX, right: marginX },
        body: [['Belum ada transaksi berstatus Lunas untuk kategori ini pada hari ini.']],
        styles: {
          fontSize: 8,
          textColor: [100, 116, 139],
          cellPadding: 3.5,
          fillColor: [248, 250, 252],
        },
        theme: 'plain',
      });
    } else {
      autoTable(doc, {
        startY: cursorY,
        margin: { left: marginX, right: marginX },
        head: [['No', 'No. Kupon', 'Jam Cair', 'Sopir / Perujuk & Instansi', 'Pasien Ranap', 'Petugas Kasir', 'Nominal']],
        body: items.map((k, idx) => [
          String(idx + 1),
          k.noKupon,
          formatTanggalJam(k.waktuCair).jam,
          `${k.namaPerujuk}\n${k.asalInstansi}`,
          `${k.namaPasien} (${k.penjamin})`,
          k.petugasKasir || 'Petugas Kasir',
          formatRupiah(k.nominalFee),
        ]),
        foot: [
          ['', '', '', '', '', `Subtotal ${title}`, formatRupiah(subtotal)],
        ],
        headStyles: {
          fillColor: [241, 245, 249],
          textColor: [30, 41, 59],
          fontStyle: 'bold',
          fontSize: 7.5,
          cellPadding: 2.5,
        },
        bodyStyles: {
          fontSize: 7.5,
          textColor: [30, 41, 59],
          cellPadding: 2.5,
          valign: 'middle',
        },
        footStyles: {
          fillColor: [236, 253, 245],
          textColor: [6, 95, 70],
          fontStyle: 'bold',
          fontSize: 8,
          cellPadding: 2.8,
        },
        columnStyles: {
          0: { cellWidth: 8, halign: 'center' },
          1: { cellWidth: 27, fontStyle: 'bold' },
          2: { cellWidth: 18 },
          3: { cellWidth: 46 },
          4: { cellWidth: 34 },
          5: { cellWidth: 27 },
          6: { cellWidth: 22, halign: 'right', fontStyle: 'bold' },
        },
        theme: 'grid',
        styles: {
          lineColor: [226, 232, 240],
          lineWidth: 0.2,
        },
      });
    }

    const lastY = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? cursorY + 10;
    cursorY = lastY + 8;
  };

  renderCategorySection('1. Kategori Mohat Desa', mohatItems, mohatTotal);
  renderCategorySection('2. Kategori PKM / Faskes 1', faskesItems, faskesTotal);

  // Check if signature block fits on current page
  const pageHeight = doc.internal.pageSize.getHeight();
  if (cursorY + 38 > pageHeight - 12) {
    doc.addPage();
    cursorY = 20;
  }

  // Grand Total Strip
  doc.setFillColor(236, 253, 245);
  doc.setDrawColor(167, 243, 208);
  doc.roundedRect(marginX, cursorY, pageWidth - marginX * 2, 11, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(6, 78, 59);
  doc.text(
    `GRAND TOTAL PENCAIRAN LUNAS HARI INI (${todayLunasKupons.length} KUPON)`,
    marginX + 4,
    cursorY + 7,
  );
  doc.setFontSize(11);
  doc.text(formatRupiah(grandTotal), pageWidth - marginX - 4, cursorY + 7, { align: 'right' });

  cursorY += 20;

  // Signature Footer
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  doc.text(`Dicetak pada: ${printedAt}`, marginX, cursorY);

  const sigY = cursorY + 6;
  doc.text('Petugas Kasir Shift,', marginX + 25, sigY, { align: 'center' });
  doc.text('Mengetahui, Kepala Unit Keuangan', pageWidth - marginX - 32, sigY, { align: 'center' });

  doc.setDrawColor(148, 163, 184);
  doc.line(marginX + 5, sigY + 18, marginX + 45, sigY + 18);
  doc.line(pageWidth - marginX - 54, sigY + 18, pageWidth - marginX - 10, sigY + 18);

  doc.setFontSize(7.5);
  doc.text('( Nama Terang & Paraf )', marginX + 25, sigY + 22, { align: 'center' });
  doc.text('( Nama Terang & Paraf )', pageWidth - marginX - 32, sigY + 22, { align: 'center' });

  const fileDate = [
    reportDate.getFullYear(),
    String(reportDate.getMonth() + 1).padStart(2, '0'),
    String(reportDate.getDate()).padStart(2, '0'),
  ].join('-');

  doc.save(`Laporan-Harian-Kasir-Kupon-RSUMB-${fileDate}.pdf`);
}
