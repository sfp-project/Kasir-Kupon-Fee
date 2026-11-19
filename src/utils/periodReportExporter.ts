import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import type { KuponFee } from '../types/kupon.ts';
import { formatRupiah, formatTanggalJam, getKategoriLabel } from './formatters.ts';

export type ReportPeriodType = 'HARIAN' | 'MINGGUAN' | 'BULANAN' | 'TRIBULANAN';
export type WeeklyMode = 'LAST_7_DAYS' | 'CURRENT_WEEK';
export type QuarterlyMode = 'LAST_3_MONTHS' | 'Q1' | 'Q2' | 'Q3' | 'Q4';

export interface ReportPeriodSelection {
  type: ReportPeriodType;
  dailyDate: string; // YYYY-MM-DD
  weeklyMode: WeeklyMode;
  month: number; // 0-11
  year: number;
  quarterlyMode: QuarterlyMode;
  quarterlyYear: number;
}

export interface OfficerSummaryItem {
  name: string;
  count: number;
  total: number;
}

export interface ResolvedPeriodReport {
  periodType: ReportPeriodType;
  periodBadge: string; // "Harian" | "Mingguan" | "Bulanan" | "3 Bulanan"
  periodDescription: string; // Human-readable Indonesian period string
  fileSlug: string; // e.g., Harian_2026-11-19
  startDate: Date;
  endDate: Date;
  items: KuponFee[];
  totalCount: number;
  totalNominal: number;
  mohatCount: number;
  mohatNominal: number;
  faskesCount: number;
  faskesNominal: number;
  officerSummary: OfficerSummaryItem[];
  officerFilterLabel?: string;
}

export const INDONESIAN_MONTHS = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember',
] as const;

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function toIsoDate(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function formatLongDate(d: Date): string {
  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(d);
}

function formatShortDate(d: Date): string {
  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(d);
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}

function endOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
}

function parseYmd(ymd: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
  if (!m) return new Date();
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

export function resolvePeriodRange(selection: ReportPeriodSelection): {
  periodBadge: string;
  periodDescription: string;
  fileSlug: string;
  startDate: Date;
  endDate: Date;
} {
  const now = new Date();

  if (selection.type === 'HARIAN') {
    const target = parseYmd(selection.dailyDate);
    return {
      periodBadge: 'Harian',
      periodDescription: `Harian — ${formatLongDate(target)}`,
      fileSlug: `Harian_${toIsoDate(target)}`,
      startDate: startOfDay(target),
      endDate: endOfDay(target),
    };
  }

  if (selection.type === 'MINGGUAN') {
    if (selection.weeklyMode === 'CURRENT_WEEK') {
      // Monday through Sunday of current week
      const dayOfWeek = now.getDay(); // 0=Sun, 1=Mon
      const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
      const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + diffToMonday);
      const sunday = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 6);
      return {
        periodBadge: 'Mingguan',
        periodDescription: `Mingguan (Minggu Berjalan) — ${formatShortDate(monday)} s.d. ${formatShortDate(sunday)}`,
        fileSlug: `Mingguan_${toIsoDate(monday)}_sd_${toIsoDate(sunday)}`,
        startDate: startOfDay(monday),
        endDate: endOfDay(sunday),
      };
    }

    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6);
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return {
      periodBadge: 'Mingguan',
      periodDescription: `Mingguan (7 Hari Terakhir) — ${formatShortDate(start)} s.d. ${formatShortDate(end)}`,
      fileSlug: `Mingguan_${toIsoDate(start)}_sd_${toIsoDate(end)}`,
      startDate: startOfDay(start),
      endDate: endOfDay(end),
    };
  }

  if (selection.type === 'BULANAN') {
    const start = new Date(selection.year, selection.month, 1);
    const end = new Date(selection.year, selection.month + 1, 0);
    const monthName = INDONESIAN_MONTHS[selection.month] ?? '';
    return {
      periodBadge: 'Bulanan',
      periodDescription: `Bulanan — ${monthName} ${selection.year}`,
      fileSlug: `Bulanan_${selection.year}-${pad2(selection.month + 1)}`,
      startDate: startOfDay(start),
      endDate: endOfDay(end),
    };
  }

  // TRIBULANAN (3 Bulanan)
  if (selection.quarterlyMode === 'LAST_3_MONTHS') {
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const start = new Date(now.getFullYear(), now.getMonth() - 2, 1);
    return {
      periodBadge: '3 Bulanan',
      periodDescription: `3 Bulanan (3 Bulan Terakhir) — ${formatShortDate(start)} s.d. ${formatShortDate(end)}`,
      fileSlug: `3Bulanan_${toIsoDate(start)}_sd_${toIsoDate(end)}`,
      startDate: startOfDay(start),
      endDate: endOfDay(end),
    };
  }

  const quarterIndexMap: Record<'Q1' | 'Q2' | 'Q3' | 'Q4', { startMonth: number; label: string; slug: string }> = {
    Q1: { startMonth: 0, label: 'Triwulan I (Januari – Maret)', slug: 'TW1' },
    Q2: { startMonth: 3, label: 'Triwulan II (April – Juni)', slug: 'TW2' },
    Q3: { startMonth: 6, label: 'Triwulan III (Juli – September)', slug: 'TW3' },
    Q4: { startMonth: 9, label: 'Triwulan IV (Oktober – Desember)', slug: 'TW4' },
  };
  const qInfo = quarterIndexMap[selection.quarterlyMode];
  const start = new Date(selection.quarterlyYear, qInfo.startMonth, 1);
  const end = new Date(selection.quarterlyYear, qInfo.startMonth + 3, 0);
  return {
    periodBadge: '3 Bulanan',
    periodDescription: `3 Bulanan — ${qInfo.label} ${selection.quarterlyYear}`,
    fileSlug: `3Bulanan_${qInfo.slug}-${selection.quarterlyYear}`,
    startDate: startOfDay(start),
    endDate: endOfDay(end),
  };
}

export function buildPeriodReportData(
  allKupons: KuponFee[],
  selection: ReportPeriodSelection,
  officerFilter = 'SEMUA',
): ResolvedPeriodReport {
  const range = resolvePeriodRange(selection);

  const lunasInRange = allKupons
    .filter((k) => {
      if (k.status !== 'LUNAS') return false;
      const dt = new Date(k.waktuCair || k.tanggalInput);
      if (Number.isNaN(dt.getTime())) return false;
      return dt.getTime() >= range.startDate.getTime() && dt.getTime() <= range.endDate.getTime();
    })
    .sort(
      (a, b) =>
        new Date(b.waktuCair || b.tanggalInput).getTime() -
        new Date(a.waktuCair || a.tanggalInput).getTime(),
    );

  // Full officer summary for the period (before officer sub-filter)
  const officerMap = new Map<string, OfficerSummaryItem>();
  for (const k of lunasInRange) {
    const name = k.petugasKasir?.trim() || 'Petugas Kasir';
    const current = officerMap.get(name) ?? { name, count: 0, total: 0 };
    current.count += 1;
    current.total += k.nominalFee;
    officerMap.set(name, current);
  }
  const officerSummary = Array.from(officerMap.values()).sort((a, b) => b.total - a.total);

  const items =
    officerFilter === 'SEMUA'
      ? lunasInRange
      : lunasInRange.filter((k) => (k.petugasKasir?.trim() || 'Petugas Kasir') === officerFilter);

  let mohatCount = 0;
  let mohatNominal = 0;
  let faskesCount = 0;
  let faskesNominal = 0;

  for (const k of items) {
    if (k.kategori === 'MOHAT_DESA') {
      mohatCount += 1;
      mohatNominal += k.nominalFee;
    } else {
      faskesCount += 1;
      faskesNominal += k.nominalFee;
    }
  }

  return {
    periodType: selection.type,
    periodBadge: range.periodBadge,
    periodDescription: range.periodDescription,
    fileSlug: range.fileSlug,
    startDate: range.startDate,
    endDate: range.endDate,
    items,
    totalCount: items.length,
    totalNominal: mohatNominal + faskesNominal,
    mohatCount,
    mohatNominal,
    faskesCount,
    faskesNominal,
    officerSummary,
    officerFilterLabel: officerFilter === 'SEMUA' ? undefined : officerFilter,
  };
}

export function exportPeriodReportPdf(report: ResolvedPeriodReport): void {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginX = 12;
  const printedAt = formatTanggalJam(new Date().toISOString()).lengkap;

  // Kop Judul Resmi RSUMB
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(15, 23, 42);
  doc.text(
    'LAPORAN PENCAIRAN KUPON FEE MOHAT & PERUJUK - RSU MUHAMMADIYAH BABAT',
    pageWidth / 2,
    14,
    { align: 'center' },
  );

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);
  doc.text(
    'Jl. KH. Ahmad Dahlan No. 14, Babat, Kabupaten Lamongan, Jawa Timur',
    pageWidth / 2,
    19,
    { align: 'center' },
  );

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(21, 128, 61);
  const periodLine = report.officerFilterLabel
    ? `Periode: ${report.periodDescription}  |  Petugas Kasir: ${report.officerFilterLabel}`
    : `Periode: ${report.periodDescription}`;
  doc.text(periodLine, pageWidth / 2, 24.5, { align: 'center' });

  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.45);
  doc.line(marginX, 27.5, pageWidth - marginX, 27.5);

  // Summary Boxes (4 Columns)
  const boxY = 31;
  const boxH = 18;
  const gap = 4;
  const colW = (pageWidth - marginX * 2 - gap * 3) / 4;

  const activeOfficersCount = report.officerFilterLabel ? 1 : report.officerSummary.length;

  const blocks = [
    {
      title: 'Total Kupon Cair (Lunas)',
      value: `${report.totalCount} Kupon`,
      sub: `Periode ${report.periodBadge}`,
      isAccent: false,
    },
    {
      title: 'Total Kas Keluar (Rupiah)',
      value: formatRupiah(report.totalNominal),
      sub: 'Uang tunai dicairkan kasir',
      isAccent: true,
    },
    {
      title: 'Kategori Mohat Desa',
      value: formatRupiah(report.mohatNominal),
      sub: `${report.mohatCount} kupon lunas`,
      isAccent: false,
    },
    {
      title: 'Kategori PKM / Faskes 1',
      value: formatRupiah(report.faskesNominal),
      sub: `${report.faskesCount} kupon · ${activeOfficersCount} petugas kasir`,
      isAccent: false,
    },
  ];

  blocks.forEach((b, idx) => {
    const x = marginX + idx * (colW + gap);
    doc.setFillColor(b.isAccent ? 236 : 248, b.isAccent ? 253 : 250, b.isAccent ? 245 : 252);
    doc.setDrawColor(b.isAccent ? 167 : 226, b.isAccent ? 243 : 232, b.isAccent ? 208 : 240);
    doc.roundedRect(x, boxY, colW, boxH, 2, 2, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(b.isAccent ? 6 : 100, b.isAccent ? 95 : 116, b.isAccent ? 70 : 139);
    doc.text(b.title, x + 3.5, boxY + 5.2);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11.5);
    doc.setTextColor(b.isAccent ? 6 : 15, b.isAccent ? 78 : 23, b.isAccent ? 59 : 42);
    doc.text(b.value, x + 3.5, boxY + 11.5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.text(b.sub, x + 3.5, boxY + 15.8);
  });

  let cursorY = boxY + boxH + 6;

  // Main Detailed Table
  const chronological = [...report.items].reverse();

  if (chronological.length === 0) {
    autoTable(doc, {
      startY: cursorY,
      margin: { left: marginX, right: marginX },
      body: [['Tidak ada transaksi kupon berstatus Lunas pada periode laporan ini.']],
      styles: {
        fontSize: 8.5,
        textColor: [100, 116, 139],
        cellPadding: 5,
        fillColor: [248, 250, 252],
        halign: 'center',
      },
      theme: 'plain',
    });
  } else {
    autoTable(doc, {
      startY: cursorY,
      margin: { left: marginX, right: marginX },
      head: [
        [
          'No',
          'No. Kupon',
          'Tgl & Jam Cair',
          'Kategori',
          'Nama Sopir / Perujuk',
          'Asal Instansi / Desa',
          'Pasien Ranap',
          'Petugas Kasir',
          'Catatan',
          'Nominal Cair',
        ],
      ],
      body: chronological.map((k, idx) => [
        String(idx + 1),
        k.noKupon,
        formatTanggalJam(k.waktuCair || k.tanggalInput).lengkap,
        getKategoriLabel(k.kategori),
        k.namaPerujuk,
        k.asalInstansi,
        `${k.namaPasien} (${k.penjamin})`,
        k.petugasKasir || 'Petugas Kasir',
        k.catatanKasir || '-',
        formatRupiah(k.nominalFee),
      ]),
      foot: [
        [
          '',
          '',
          '',
          '',
          '',
          '',
          '',
          '',
          `TOTAL (${report.totalCount} KUPON)`,
          formatRupiah(report.totalNominal),
        ],
      ],
      headStyles: {
        fillColor: [241, 245, 249],
        textColor: [15, 23, 42],
        fontStyle: 'bold',
        fontSize: 7.5,
        cellPadding: 2.5,
      },
      bodyStyles: {
        fontSize: 7.3,
        textColor: [30, 41, 59],
        cellPadding: 2.3,
        valign: 'middle',
      },
      footStyles: {
        fillColor: [236, 253, 245],
        textColor: [6, 78, 59],
        fontStyle: 'bold',
        fontSize: 8.2,
        cellPadding: 2.8,
      },
      columnStyles: {
        0: { cellWidth: 9, halign: 'center' },
        1: { cellWidth: 27, fontStyle: 'bold' },
        2: { cellWidth: 31 },
        3: { cellWidth: 22 },
        4: { cellWidth: 30 },
        5: { cellWidth: 37 },
        6: { cellWidth: 33 },
        7: { cellWidth: 28 },
        8: { cellWidth: 31 },
        9: { cellWidth: 25, halign: 'right', fontStyle: 'bold' },
      },
      theme: 'grid',
      styles: {
        lineColor: [226, 232, 240],
        lineWidth: 0.2,
      },
    });
  }

  cursorY =
    ((doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? cursorY + 14) +
    6;

  // Compact Rekap Per Petugas Kasir if there are officers and no single-officer filter
  const officersToPrint = report.officerFilterLabel
    ? report.officerSummary.filter((o) => o.name === report.officerFilterLabel)
    : report.officerSummary;

  if (officersToPrint.length > 0) {
    if (cursorY + 34 > pageHeight - 16) {
      doc.addPage();
      cursorY = 16;
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(15, 23, 42);
    doc.text('Rekapitulasi Per Petugas Kasir', marginX, cursorY);
    cursorY += 2.5;

    autoTable(doc, {
      startY: cursorY,
      margin: { left: marginX, right: pageWidth - marginX - 135 },
      head: [['Nama Petugas Kasir', 'Jumlah Kupon', 'Total Dicairkan']],
      body: officersToPrint.map((o) => [o.name, `${o.count} kupon`, formatRupiah(o.total)]),
      headStyles: {
        fillColor: [241, 245, 249],
        textColor: [15, 23, 42],
        fontStyle: 'bold',
        fontSize: 7.5,
        cellPadding: 2,
      },
      bodyStyles: {
        fontSize: 7.5,
        textColor: [30, 41, 59],
        cellPadding: 2,
      },
      columnStyles: {
        0: { cellWidth: 68 },
        1: { cellWidth: 28, halign: 'center' },
        2: { cellWidth: 39, halign: 'right', fontStyle: 'bold' },
      },
      theme: 'grid',
      styles: { lineColor: [226, 232, 240], lineWidth: 0.2 },
    });

    cursorY =
      ((doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? cursorY + 12) +
      8;
  }

  // Signature Block
  if (cursorY + 34 > pageHeight - 10) {
    doc.addPage();
    cursorY = 20;
  }

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  doc.text(`Dicetak pada: ${printedAt}`, marginX, cursorY);

  const sigY = cursorY + 6;
  const leftSigX = marginX + 42;
  const rightSigX = pageWidth - marginX - 48;

  doc.setTextColor(30, 41, 59);
  doc.text('Petugas Kasir,', leftSigX, sigY, { align: 'center' });
  doc.text('Penanggung Jawab / Kepala Unit Keuangan,', rightSigX, sigY, { align: 'center' });

  doc.setDrawColor(148, 163, 184);
  doc.line(leftSigX - 28, sigY + 18, leftSigX + 28, sigY + 18);
  doc.line(rightSigX - 32, sigY + 18, rightSigX + 32, sigY + 18);

  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text(
    report.officerFilterLabel ? `( ${report.officerFilterLabel} )` : '( Nama Terang & Paraf )',
    leftSigX,
    sigY + 22.5,
    { align: 'center' },
  );
  doc.text('( Nama Terang & Paraf )', rightSigX, sigY + 22.5, { align: 'center' });

  doc.save(`Laporan_Kasir_Kupon_${report.fileSlug}.pdf`);
}

export function exportPeriodReportExcel(report: ResolvedPeriodReport): void {
  const wb = XLSX.utils.book_new();
  const printedAt = formatTanggalJam(new Date().toISOString()).lengkap;
  const chronological = [...report.items].reverse();

  // Sheet 1: Laporan Pencairan Detail
  const sheetRows: Array<Array<string | number>> = [
    ['LAPORAN PENCAIRAN KUPON FEE MOHAT & PERUJUK - RSU MUHAMMADIYAH BABAT'],
    [`Periode Laporan: ${report.periodDescription}${report.officerFilterLabel ? ` | Petugas Kasir: ${report.officerFilterLabel}` : ''}`],
    [`Waktu Ekspor: ${printedAt}`],
    [],
    [
      'No',
      'No. Kupon',
      'Tanggal & Jam Cair',
      'Kategori',
      'Nama Sopir / Perujuk',
      'Asal Instansi / Desa',
      'Pasien Ranap',
      'Ruang & Penjamin',
      'Petugas Kasir',
      'Catatan',
      'Nominal Akhir Cair (Rp)',
    ],
  ];

  chronological.forEach((k, idx) => {
    sheetRows.push([
      idx + 1,
      k.noKupon,
      formatTanggalJam(k.waktuCair || k.tanggalInput).lengkap,
      getKategoriLabel(k.kategori),
      k.namaPerujuk,
      k.asalInstansi,
      k.namaPasien,
      `${k.ruangRanap} (${k.penjamin})`,
      k.petugasKasir || 'Petugas Kasir',
      k.catatanKasir || '-',
      k.nominalFee,
    ]);
  });

  // Total Row at bottom
  const totalRowIdx = sheetRows.length;
  sheetRows.push([
    '',
    'TOTAL',
    `${report.totalCount} Kupon Lunas`,
    '',
    '',
    '',
    '',
    '',
    '',
    'TOTAL KAS KELUAR',
    report.totalNominal,
  ]);

  const wsMain = XLSX.utils.aoa_to_sheet(sheetRows);

  // Merge header banner rows across 11 columns
  wsMain['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 10 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: 10 } },
    { s: { r: 2, c: 0 }, e: { r: 2, c: 10 } },
  ];

  // Format Rupiah currency cells in column K (index 10)
  for (let r = 5; r <= totalRowIdx; r++) {
    const cellRef = XLSX.utils.encode_cell({ r, c: 10 });
    const cell = wsMain[cellRef];
    if (cell && typeof cell.v === 'number') {
      cell.z = '"Rp "#,##0';
    }
  }

  wsMain['!cols'] = [
    { wch: 5 },
    { wch: 19 },
    { wch: 23 },
    { wch: 16 },
    { wch: 24 },
    { wch: 30 },
    { wch: 22 },
    { wch: 22 },
    { wch: 24 },
    { wch: 28 },
    { wch: 22 },
  ];

  XLSX.utils.book_append_sheet(wb, wsMain, 'Laporan Pencairan');

  // Sheet 2: Ringkasan Kategori & Petugas Kasir
  const summaryRows: Array<Array<string | number>> = [
    ['RINGKASAN PENCAIRAN KUPON FEE - RSU MUHAMMADIYAH BABAT'],
    [`Periode: ${report.periodDescription}`],
    [],
    ['RINGKASAN BERDASARKAN KATEGORI'],
    ['Kategori', 'Jumlah Kupon Lunas', 'Total Nominal (Rp)'],
    ['Mohat Desa', report.mohatCount, report.mohatNominal],
    ['PKM / Faskes 1', report.faskesCount, report.faskesNominal],
    ['TOTAL', report.totalCount, report.totalNominal],
    [],
    ['RINGKASAN BERDASARKAN PETUGAS KASIR'],
    ['Nama Petugas Kasir', 'Jumlah Pencairan', 'Total Nominal (Rp)'],
  ];

  const officersForExcel = report.officerFilterLabel
    ? report.officerSummary.filter((o) => o.name === report.officerFilterLabel)
    : report.officerSummary;

  const officerStartRow = summaryRows.length;
  officersForExcel.forEach((o) => {
    summaryRows.push([o.name, o.count, o.total]);
  });
  const officerTotalRow = summaryRows.length;
  summaryRows.push(['TOTAL', report.totalCount, report.totalNominal]);

  const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows);
  wsSummary['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 2 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: 2 } },
    { s: { r: 3, c: 0 }, e: { r: 3, c: 2 } },
    { s: { r: 9, c: 0 }, e: { r: 9, c: 2 } },
  ];

  // Apply Rupiah formatting on Sheet 2 column C (index 2)
  for (const r of [5, 6, 7]) {
    const cell = wsSummary[XLSX.utils.encode_cell({ r, c: 2 })];
    if (cell && typeof cell.v === 'number') cell.z = '"Rp "#,##0';
  }
  for (let r = officerStartRow; r <= officerTotalRow; r++) {
    const cell = wsSummary[XLSX.utils.encode_cell({ r, c: 2 })];
    if (cell && typeof cell.v === 'number') cell.z = '"Rp "#,##0';
  }

  wsSummary['!cols'] = [{ wch: 30 }, { wch: 20 }, { wch: 22 }];

  XLSX.utils.book_append_sheet(wb, wsSummary, 'Ringkasan');

  XLSX.writeFile(wb, `Laporan_Kasir_Kupon_${report.fileSlug}.xlsx`);
}
