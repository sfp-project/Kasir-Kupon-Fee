import express, { type Request, type Response } from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { createDefaultSyncConfig, createSeedKupons } from './src/data/seedKupons.ts';
import type { KuponFee, NewKuponPayload, SyncConfig } from './src/types/kupon.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.resolve(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'kupon-db.json');

interface PersistedDatabase {
  kupons: KuponFee[];
  syncConfig: SyncConfig;
}

function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function loadDatabase(): PersistedDatabase {
  ensureDataDir();
  if (!fs.existsSync(DB_FILE)) {
    const initial: PersistedDatabase = {
      kupons: createSeedKupons(),
      syncConfig: createDefaultSyncConfig(),
    };
    fs.writeFileSync(DB_FILE, JSON.stringify(initial, null, 2), 'utf-8');
    return initial;
  }
  try {
    const raw = fs.readFileSync(DB_FILE, 'utf-8');
    const parsed = JSON.parse(raw) as Partial<PersistedDatabase>;
    return {
      kupons: Array.isArray(parsed.kupons) ? parsed.kupons : createSeedKupons(),
      syncConfig: parsed.syncConfig
        ? { ...createDefaultSyncConfig(), ...parsed.syncConfig }
        : createDefaultSyncConfig(),
    };
  } catch {
    const fallback: PersistedDatabase = {
      kupons: createSeedKupons(),
      syncConfig: createDefaultSyncConfig(),
    };
    saveDatabase(fallback);
    return fallback;
  }
}

function saveDatabase(db: PersistedDatabase): void {
  ensureDataDir();
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf-8');
}

function generateCouponNumber(existing: KuponFee[]): string {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const prefix = `KPN-${yy}${mm}${dd}-`;
  const todayNums = existing
    .map((k) => k.noKupon)
    .filter((code) => code.startsWith(prefix))
    .map((code) => Number.parseInt(code.slice(prefix.length), 10))
    .filter((n) => !Number.isNaN(n));
  const nextSeq = (todayNums.length > 0 ? Math.max(...todayNums) : 0) + 1;
  return `${prefix}${String(nextSeq).padStart(3, '0')}`;
}

let db = loadDatabase();

// Server-Sent Events subscribers for real-time cashier synchronization
const sseClients = new Set<Response>();

function broadcastEvent(event: string, payload: unknown): void {
  const frame = `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`;
  for (const res of sseClients) {
    try {
      res.write(frame);
    } catch {
      sseClients.delete(res);
    }
  }
}

// Optional outbound sync dispatcher to Web Pendaftaran / Google Sheets / Firestore REST
async function dispatchOutboundSync(action: 'LUNAS' | 'BATAL_LUNAS' | 'CREATED', kupon: KuponFee): Promise<string | null> {
  const cfg = db.syncConfig;
  const targetUrl =
    cfg.provider === 'GOOGLE_SHEETS'
      ? cfg.googleSheetsWebhookUrl.trim()
      : cfg.provider === 'CUSTOM_WEBHOOK'
        ? cfg.outboundWebhookUrl.trim()
        : '';

  if (!targetUrl) {
    return null;
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        source: 'KASIR_RSUMB',
        action,
        timestamp: new Date().toISOString(),
        kupon,
      }),
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!response.ok) {
      return `Webhook merespons status ${response.status}`;
    }
    db.syncConfig.lastSyncAt = new Date().toISOString();
    db.syncConfig.lastSyncMessage = `Status ${kupon.noKupon} tersinkron ke endpoint eksternal.`;
    saveDatabase(db);
    return null;
  } catch (err) {
    return err instanceof Error ? err.message : 'Gagal menghubungi webhook eksternal';
  }
}

async function startServer(): Promise<void> {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '1mb' }));

  // Allow cross-origin requests from Web Pendaftaran RSUMB
  app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }
    next();
  });

  // Real-time SSE stream for cashier clients
  app.get('/api/stream', (req: Request, res: Response) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    res.write(`event: connected\ndata: ${JSON.stringify({ ok: true, timestamp: new Date().toISOString() })}\n\n`);
    sseClients.add(res);

    const keepAlive = setInterval(() => {
      try {
        res.write(': ping\n\n');
      } catch {
        clearInterval(keepAlive);
        sseClients.delete(res);
      }
    }, 25_000);

    req.on('close', () => {
      clearInterval(keepAlive);
      sseClients.delete(res);
    });
  });

  // GET all coupons
  app.get('/api/kupon', (req: Request, res: Response) => {
    const statusFilter = typeof req.query.status === 'string' ? req.query.status.toUpperCase() : '';
    const q = typeof req.query.q === 'string' ? req.query.q.trim().toLowerCase() : '';

    let items = [...db.kupons].sort(
      (a, b) => new Date(b.tanggalInput).getTime() - new Date(a.tanggalInput).getTime(),
    );

    if (statusFilter === 'MENUNGGU_KASIR' || statusFilter === 'LUNAS') {
      items = items.filter((item) => item.status === statusFilter);
    }

    if (q) {
      items = items.filter(
        (item) =>
          item.noKupon.toLowerCase().includes(q) ||
          item.namaPasien.toLowerCase().includes(q) ||
          item.namaPerujuk.toLowerCase().includes(q) ||
          item.asalInstansi.toLowerCase().includes(q),
      );
    }

    res.json({
      kupons: items,
      syncConfig: db.syncConfig,
      serverTime: new Date().toISOString(),
    });
  });

  // POST receive new coupon (from Web Pendaftaran webhook or Cashier simulation)
  const handleCreateKupon = async (req: Request, res: Response) => {
    const body = req.body as Partial<NewKuponPayload>;

    if (!body.namaPasien?.trim() || !body.namaPerujuk?.trim() || !body.asalInstansi?.trim()) {
      res.status(400).json({
        error: 'Nama pasien, nama sopir/perujuk, dan asal instansi wajib diisi.',
      });
      return;
    }

    const kategori = body.kategori === 'PKM_FASKES_1' ? 'PKM_FASKES_1' : 'MOHAT_DESA';
    const penjamin =
      body.penjamin === 'UMUM' || body.penjamin === 'JASA_RAHARJA' ? body.penjamin : 'BPJS';
    const nominalFee =
      typeof body.nominalFee === 'number' && body.nominalFee > 0
        ? body.nominalFee
        : kategori === 'MOHAT_DESA'
          ? 25000
          : penjamin === 'UMUM'
            ? 35000
            : 20000;

    const newKupon: KuponFee = {
      id: `kpn-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      noKupon: body.noKupon?.trim() || generateCouponNumber(db.kupons),
      tanggalInput: new Date().toISOString(),
      namaPasien: body.namaPasien.trim(),
      noRm: body.noRm?.trim() || undefined,
      ruangRanap: body.ruangRanap?.trim() || 'R. Arafah Lt. 1',
      penjamin,
      kategori,
      namaPerujuk: body.namaPerujuk.trim(),
      asalInstansi: body.asalInstansi.trim(),
      noHpPerujuk: body.noHpPerujuk?.trim() || undefined,
      nominalFee,
      status: 'MENUNGGU_KASIR',
      petugasPendaftaran: body.petugasPendaftaran?.trim() || 'Staf Pendaftaran',
      waktuCair: null,
      petugasKasir: null,
      catatanKasir: null,
      sumberSync: body.sumberSync || 'WEB_PENDAFTARAN',
    };

    db.kupons.unshift(newKupon);
    db.syncConfig.lastSyncAt = new Date().toISOString();
    db.syncConfig.lastSyncMessage = `Kupon baru ${newKupon.noKupon} diterima secara real-time.`;
    saveDatabase(db);

    broadcastEvent('kupon_created', newKupon);
    void dispatchOutboundSync('CREATED', newKupon);

    res.status(201).json({ kupon: newKupon });
  };

  app.post('/api/kupon', handleCreateKupon);
  app.post('/api/webhook/pendaftaran', handleCreateKupon);

  // PATCH mark coupon as LUNAS
  app.patch('/api/kupon/:id/lunas', async (req: Request, res: Response) => {
    const { id } = req.params;
    const { nominalFee, petugasKasir, catatanKasir } = req.body as {
      nominalFee?: number;
      petugasKasir?: string;
      catatanKasir?: string;
    };

    const idx = db.kupons.findIndex((k) => k.id === id || k.noKupon === id);
    if (idx === -1) {
      res.status(404).json({ error: 'Data kupon tidak ditemukan.' });
      return;
    }

    const current = db.kupons[idx];
    if (current.status === 'LUNAS') {
      res.status(409).json({ error: 'Kupon ini sudah berstatus LUNAS.' });
      return;
    }

    if (
      nominalFee !== undefined &&
      (typeof nominalFee !== 'number' || !Number.isFinite(nominalFee) || nominalFee <= 0)
    ) {
      res.status(400).json({ error: 'Nominal pencairan harus berupa angka lebih dari Rp 0.' });
      return;
    }

    const finalNominal =
      typeof nominalFee === 'number' && Number.isFinite(nominalFee) && nominalFee > 0
        ? Math.round(nominalFee)
        : current.nominalFee;

    const updated: KuponFee = {
      ...current,
      nominalFee: finalNominal,
      status: 'LUNAS',
      waktuCair: new Date().toISOString(),
      petugasKasir: petugasKasir?.trim() || 'Petugas Kasir',
      catatanKasir: catatanKasir?.trim() || null,
    };

    db.kupons[idx] = updated;
    db.syncConfig.lastSyncAt = new Date().toISOString();
    db.syncConfig.lastSyncMessage = `Pencairan ${updated.noKupon} ditandai LUNAS.`;
    saveDatabase(db);

    broadcastEvent('kupon_updated', updated);
    const syncWarning = await dispatchOutboundSync('LUNAS', updated);

    res.json({ kupon: updated, syncWarning });
  });

  // PATCH cancel LUNAS status (revert to MENUNGGU_KASIR)
  app.patch('/api/kupon/:id/batal', async (req: Request, res: Response) => {
    const { id } = req.params;
    const { alasan } = req.body as { alasan?: string };

    const idx = db.kupons.findIndex((k) => k.id === id || k.noKupon === id);
    if (idx === -1) {
      res.status(404).json({ error: 'Data kupon tidak ditemukan.' });
      return;
    }

    const current = db.kupons[idx];
    if (current.status !== 'LUNAS') {
      res.status(409).json({ error: 'Kupon belum berstatus LUNAS.' });
      return;
    }

    const updated: KuponFee = {
      ...current,
      status: 'MENUNGGU_KASIR',
      riwayatBatal: {
        waktu: new Date().toISOString(),
        alasan: alasan?.trim() || 'Pembatalan oleh petugas kasir (koreksi input)',
        petugasSebelumnya: current.petugasKasir,
      },
      waktuCair: null,
      petugasKasir: null,
      catatanKasir: null,
    };

    db.kupons[idx] = updated;
    db.syncConfig.lastSyncAt = new Date().toISOString();
    db.syncConfig.lastSyncMessage = `Status Lunas ${updated.noKupon} dibatalkan kembali ke Menunggu Kasir.`;
    saveDatabase(db);

    broadcastEvent('kupon_updated', updated);
    const syncWarning = await dispatchOutboundSync('BATAL_LUNAS', updated);

    res.json({ kupon: updated, syncWarning });
  });

  // Reset demo data
  app.post('/api/kupon/reset-demo', (_req: Request, res: Response) => {
    db.kupons = createSeedKupons();
    db.syncConfig.lastSyncAt = new Date().toISOString();
    db.syncConfig.lastSyncMessage = 'Data simulasi awal RSUMB berhasil dimuat ulang.';
    saveDatabase(db);
    broadcastEvent('kupon_reset', { kupons: db.kupons });
    res.json({ kupons: db.kupons, syncConfig: db.syncConfig });
  });

  // Sync Config GET & PUT
  app.get('/api/sync-config', (_req: Request, res: Response) => {
    res.json({ syncConfig: db.syncConfig });
  });

  app.put('/api/sync-config', (req: Request, res: Response) => {
    const incoming = req.body as Partial<SyncConfig>;
    db.syncConfig = {
      ...db.syncConfig,
      ...incoming,
      lastSyncAt: new Date().toISOString(),
      lastSyncMessage: 'Konfigurasi koneksi database berhasil disimpan.',
    };
    saveDatabase(db);
    res.json({ syncConfig: db.syncConfig });
  });

  // Manual sync pull from external REST / Google Sheets / Firestore REST
  app.post('/api/sync/pull', async (_req: Request, res: Response) => {
    const cfg = db.syncConfig;
    let fetchUrl = '';

    if (cfg.provider === 'GOOGLE_SHEETS' && cfg.googleSheetsWebhookUrl.trim()) {
      fetchUrl = cfg.googleSheetsWebhookUrl.trim();
    } else if (cfg.provider === 'CUSTOM_WEBHOOK' && cfg.restBaseUrl.trim()) {
      fetchUrl = cfg.restBaseUrl.trim();
    } else if (cfg.provider === 'FIREBASE_FIRESTORE' && cfg.firebaseProjectId.trim()) {
      const dbId = cfg.firebaseDatabaseId.trim() || '(default)';
      const col = cfg.firebaseCollection.trim() || 'kupon_fee_mohat';
      fetchUrl = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(
        cfg.firebaseProjectId.trim(),
      )}/databases/${encodeURIComponent(dbId)}/documents/${encodeURIComponent(col)}`;
    }

    if (!fetchUrl) {
      db.syncConfig.lastSyncAt = new Date().toISOString();
      db.syncConfig.lastSyncMessage = 'Sinkronisasi lokal aktif — data terbaru sudah termuat.';
      saveDatabase(db);
      res.json({
        syncedCount: 0,
        kupons: db.kupons,
        syncConfig: db.syncConfig,
        message: 'Mode Server Lokal aktif. Semua data kupon sudah sinkron.',
      });
      return;
    }

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 7000);
      const response = await fetch(fetchUrl, { signal: controller.signal });
      clearTimeout(timer);

      if (!response.ok) {
        res.status(502).json({
          error: `Sumber eksternal merespons HTTP ${response.status}. Periksa URL atau izin akses endpoint.`,
        });
        return;
      }

      const raw = (await response.json()) as Record<string, unknown>;
      let incomingList: Partial<KuponFee>[] = [];

      if (Array.isArray(raw)) {
        incomingList = raw as Partial<KuponFee>[];
      } else if (Array.isArray(raw.kupons)) {
        incomingList = raw.kupons as Partial<KuponFee>[];
      } else if (Array.isArray(raw.data)) {
        incomingList = raw.data as Partial<KuponFee>[];
      } else if (Array.isArray(raw.documents)) {
        // Parse Firestore REST response documents
        incomingList = (raw.documents as Array<{ name?: string; fields?: Record<string, Record<string, string>> }>).map(
          (doc) => {
            const f = doc.fields ?? {};
            const str = (key: string) => f[key]?.stringValue ?? '';
            const num = (key: string) => Number(f[key]?.integerValue ?? f[key]?.doubleValue ?? 0);
            return {
              id: doc.name?.split('/').pop(),
              noKupon: str('noKupon'),
              tanggalInput: str('tanggalInput') || new Date().toISOString(),
              namaPasien: str('namaPasien'),
              ruangRanap: str('ruangRanap') || 'Rawat Inap',
              penjamin: (str('penjamin') as KuponFee['penjamin']) || 'BPJS',
              kategori: (str('kategori') as KuponFee['kategori']) || 'MOHAT_DESA',
              namaPerujuk: str('namaPerujuk'),
              asalInstansi: str('asalInstansi'),
              nominalFee: num('nominalFee') || 25000,
              status: str('status') === 'LUNAS' ? 'LUNAS' : 'MENUNGGU_KASIR',
              petugasPendaftaran: str('petugasPendaftaran') || 'Pendaftaran',
              waktuCair: str('waktuCair') || null,
              petugasKasir: str('petugasKasir') || null,
            };
          },
        );
      }

      let addedOrUpdated = 0;
      for (const item of incomingList) {
        if (!item.noKupon || !item.namaPasien) continue;
        const existingIdx = db.kupons.findIndex((k) => k.noKupon === item.noKupon);
        if (existingIdx === -1) {
          db.kupons.unshift({
            id: item.id || `sync-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            noKupon: item.noKupon,
            tanggalInput: item.tanggalInput || new Date().toISOString(),
            namaPasien: item.namaPasien,
            noRm: item.noRm,
            ruangRanap: item.ruangRanap || 'Rawat Inap',
            penjamin: item.penjamin || 'BPJS',
            kategori: item.kategori || 'MOHAT_DESA',
            namaPerujuk: item.namaPerujuk || '-',
            asalInstansi: item.asalInstansi || '-',
            nominalFee: item.nominalFee || 25000,
            status: item.status === 'LUNAS' ? 'LUNAS' : 'MENUNGGU_KASIR',
            petugasPendaftaran: item.petugasPendaftaran || 'Pendaftaran',
            waktuCair: item.waktuCair ?? null,
            petugasKasir: item.petugasKasir ?? null,
            catatanKasir: item.catatanKasir ?? null,
            sumberSync: cfg.provider,
          });
          addedOrUpdated++;
        }
      }

      db.syncConfig.lastSyncAt = new Date().toISOString();
      db.syncConfig.lastSyncMessage = `Berhasil sinkronisasi dari ${cfg.provider} (${addedOrUpdated} kupon baru).`;
      saveDatabase(db);

      if (addedOrUpdated > 0) {
        broadcastEvent('kupon_reset', { kupons: db.kupons });
      }

      res.json({
        syncedCount: addedOrUpdated,
        kupons: db.kupons,
        syncConfig: db.syncConfig,
        message: db.syncConfig.lastSyncMessage,
      });
    } catch (err) {
      res.status(502).json({
        error: err instanceof Error ? err.message : 'Gagal mengambil data dari sumber eksternal.',
      });
    }
  });

  // Connection test endpoint
  app.post('/api/sync/test', async (req: Request, res: Response) => {
    const incoming = (req.body || {}) as Partial<SyncConfig>;
    const provider = incoming.provider || db.syncConfig.provider;

    if (provider === 'LOCAL_REST') {
      res.json({
        ok: true,
        latencyMs: 4,
        message: 'Server API Kasir lokal aktif dan siap menerima data real-time dari Web Pendaftaran.',
      });
      return;
    }

    let testUrl = '';
    if (provider === 'GOOGLE_SHEETS') {
      testUrl = (incoming.googleSheetsWebhookUrl ?? db.syncConfig.googleSheetsWebhookUrl).trim();
    } else if (provider === 'CUSTOM_WEBHOOK') {
      testUrl = (incoming.restBaseUrl ?? db.syncConfig.restBaseUrl).trim();
    } else if (provider === 'FIREBASE_FIRESTORE') {
      const pid = (incoming.firebaseProjectId ?? db.syncConfig.firebaseProjectId).trim();
      const col = (incoming.firebaseCollection ?? db.syncConfig.firebaseCollection).trim() || 'kupon_fee_mohat';
      const dbId = (incoming.firebaseDatabaseId ?? db.syncConfig.firebaseDatabaseId).trim() || '(default)';
      if (pid) {
        testUrl = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(pid)}/databases/${encodeURIComponent(dbId)}/documents/${encodeURIComponent(col)}?pageSize=1`;
      }
    }

    if (!testUrl) {
      res.status(400).json({
        ok: false,
        message: 'URL atau Project ID tujuan belum diisi.',
      });
      return;
    }

    const start = Date.now();
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 5000);
      const response = await fetch(testUrl, { method: 'GET', signal: controller.signal });
      clearTimeout(timer);
      const latencyMs = Date.now() - start;
      if (response.ok) {
        res.json({
          ok: true,
          latencyMs,
          message: `Koneksi berhasil (HTTP ${response.status}) dalam ${latencyMs} ms.`,
        });
      } else {
        res.json({
          ok: false,
          latencyMs,
          message: `Endpoint merespons HTTP ${response.status}. Pastikan URL publik atau rules Firestore mengizinkan akses.`,
        });
      }
    } catch (err) {
      res.json({
        ok: false,
        latencyMs: Date.now() - start,
        message: err instanceof Error ? `Koneksi gagal: ${err.message}` : 'Endpoint tidak dapat dijangkau.',
      });
    }
  });

  // Vite middleware in development, static dist in production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server Kasir Kupon Fee RSUMB berjalan di http://localhost:${PORT}`);
  });
}

startServer();
