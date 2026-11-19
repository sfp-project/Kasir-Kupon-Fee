import type { KuponFee, KuponKategori } from '../types/kupon.ts';

export function formatRupiah(amount: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })
    .format(amount)
    .replace('IDR', 'Rp')
    .replace(/\u00A0/g, ' ');
}

export function formatTanggalJam(iso?: string | null): { tanggal: string; jam: string; lengkap: string } {
  if (!iso) {
    return { tanggal: '-', jam: '-', lengkap: '-' };
  }
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return { tanggal: '-', jam: '-', lengkap: '-' };
  }
  const tanggal = new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);

  const jam = `${new Intl.DateTimeFormat('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
    .format(date)
    .replace('.', ':')} WIB`;

  return {
    tanggal,
    jam,
    lengkap: `${tanggal}, ${jam}`,
  };
}

export function isSameLocalDay(iso?: string | null, referenceDate = new Date()): boolean {
  if (!iso) return false;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return false;
  return (
    d.getFullYear() === referenceDate.getFullYear() &&
    d.getMonth() === referenceDate.getMonth() &&
    d.getDate() === referenceDate.getDate()
  );
}

export function getKategoriLabel(kategori: KuponKategori): string {
  return kategori === 'MOHAT_DESA' ? 'Mohat Desa' : 'PKM / Faskes 1';
}

export function getDefaultFee(kategori: KuponKategori, penjamin: 'BPJS' | 'UMUM' | 'JASA_RAHARJA'): number {
  if (kategori === 'MOHAT_DESA') {
    return 25000;
  }
  return penjamin === 'UMUM' ? 35000 : 20000;
}

export function exportKuponsToCsv(kupons: KuponFee[], filenamePrefix = 'rekap-kasir-kupon-rsumb'): void {
  const headers = [
    'No. Kupon',
    'Tanggal Input',
    'Nama Pasien Ranap',
    'No. RM',
    'Ruang Ranap',
    'Penjamin',
    'Kategori',
    'Nama Sopir / Perujuk',
    'Asal Instansi',
    'Nominal Fee (Rp)',
    'Status',
    'Staf Pendaftaran',
    'Waktu Pencairan',
    'Petugas Kasir',
    'Catatan Kasir',
  ];

  const escapeCsv = (val: unknown): string => {
    const str = String(val ?? '');
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const rows = kupons.map((k) => [
    k.noKupon,
    formatTanggalJam(k.tanggalInput).lengkap,
    k.namaPasien,
    k.noRm ?? '',
    k.ruangRanap,
    k.penjamin,
    getKategoriLabel(k.kategori),
    k.namaPerujuk,
    k.asalInstansi,
    k.nominalFee,
    k.status === 'LUNAS' ? 'Lunas' : 'Menunggu Kasir',
    k.petugasPendaftaran,
    k.waktuCair ? formatTanggalJam(k.waktuCair).lengkap : '-',
    k.petugasKasir ?? '-',
    k.catatanKasir ?? '',
  ]);

  const csvContent =
    '\uFEFF' +
    [headers.map(escapeCsv).join(','), ...rows.map((r) => r.map(escapeCsv).join(','))].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const todayStr = new Date().toISOString().slice(0, 10);
  link.href = url;
  link.download = `${filenamePrefix}-${todayStr}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
