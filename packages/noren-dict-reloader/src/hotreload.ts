type SourceMeta = {
  etag?: string;
  lastModified?: string;
  text?: string;
  json?: unknown;
};

export type ReloaderOptions<TCompiled> = {
  policyUrl: string;
  dictManifestUrl: string; // { dicts: [{id,url}] }
  headers?: Record<string, string>;
  intervalMs?: number;
  maxIntervalMs?: number;
  jitter?: number;
  onSwap?: (compiled: TCompiled, changed: string[]) => void;
  onError?: (err: unknown) => void;
  compile: (policy: unknown, dicts: unknown[]) => TCompiled; // 注入
};

export class PolicyDictReloader<TCompiled> {
  private opts: Required<Omit<ReloaderOptions<TCompiled>, 'onSwap'|'onError'|'compile'>> & Pick<ReloaderOptions<TCompiled>, 'onSwap'|'onError'|'compile'>;
  private timer: any = null;
  private running = false;
  private backoff = 0;

  private policy: SourceMeta = {};
  private manifest: SourceMeta = {};
  private dicts = new Map<string, SourceMeta>();
  private compiled: TCompiled | null = null;

  constructor(opts: ReloaderOptions<TCompiled>) {
    this.opts = {
      intervalMs: opts.intervalMs ?? 30_000,
      maxIntervalMs: opts.maxIntervalMs ?? 5 * 60_000,
      jitter: opts.jitter ?? 0.2,
      headers: opts.headers ?? {},
      policyUrl: opts.policyUrl,
      dictManifestUrl: opts.dictManifestUrl,
      onSwap: opts.onSwap,
      onError: opts.onError,
      compile: opts.compile
    };
  }

  getCompiled() { if (!this.compiled) throw new Error('not compiled'); return this.compiled; }

  async start() { if (this.running) return; this.running = true; await this.tick(false); }
  stop() { this.running = false; if (this.timer) clearTimeout(this.timer); this.timer = null; }

  async forceReload() { await this.tick(true); }

  // ---- 内部 ----
  private nextDelay(ok: boolean) {
    if (ok) this.backoff = 0; else this.backoff = Math.min((this.backoff || 1) * 2, Math.floor(this.opts.maxIntervalMs / this.opts.intervalMs));
    const base = this.opts.intervalMs * (this.backoff || 1);
    const rnd = 1 + (Math.random() * 2 * this.opts.jitter - this.opts.jitter);
    return Math.floor(base * rnd);
  }
  private schedule(ok: boolean) {
    if (!this.running) return;
    this.timer = setTimeout(() => this.tick(false).catch(()=>{}), this.nextDelay(ok));
  }

  private async tick(force: boolean) {
    try {
      const changed: string[] = [];
      const p = await conditionalGet(this.opts.policyUrl, this.policy, this.opts.headers, force);
      if (p.status === 200) { this.policy = p.meta; changed.push('policy'); }

      const m = await conditionalGet(this.opts.dictManifestUrl, this.manifest, this.opts.headers, force);
      if (m.status === 200) { this.manifest = m.meta; changed.push('manifest'); }

      const list = (this.manifest.json as any)?.dicts as Array<{id:string; url:string}> ?? [];
      for (const { id, url } of list) {
        const prev = this.dicts.get(id);
        const d = await conditionalGet(url, prev, this.opts.headers, force);
        if (d.status === 200) { this.dicts.set(id, d.meta); changed.push(`dict:${id}`); }
      }
      for (const existingId of Array.from(this.dicts.keys())) {
        if (!list.find(x => x.id === existingId)) {
          this.dicts.delete(existingId); changed.push(`dict-removed:${existingId}`);
        }
      }

      if (changed.length === 0 && this.compiled && !force) { this.schedule(true); return; }

      const policyRaw = this.policy.json ?? {};
      const dictsRaw = Array.from(this.dicts.values()).map(v => v.json ?? {});
      const compiled = this.opts.compile(policyRaw, dictsRaw);

      this.compiled = compiled;
      this.opts.onSwap?.(compiled, changed);
      this.schedule(true);
    } catch (e) {
      this.opts.onError?.(e);
      this.schedule(false);
    }
  }
}

// ---- fetch helpers ----
async function conditionalGet(url: string, prev: SourceMeta | undefined, headers: Record<string,string>, force: boolean) {
  const h: Record<string,string> = { 'cache-control': 'no-cache', ...(headers ?? {}) };
  let reqUrl = url;
  if (force) {
    const u = new URL(url);
    u.searchParams.set('_bust', String(Date.now()));
    reqUrl = u.toString();
    h['pragma'] = 'no-cache';
  } else {
    if (prev?.etag) h['if-none-match'] = prev.etag;
    else if (prev?.lastModified) h['if-modified-since'] = prev.lastModified;
  }

  const res = await fetch(reqUrl, { method: 'GET', headers: h });
  if (res.status === 304) return { status: 304 as const, meta: prev! };
  if (!res.ok) throw new Error(`fetch ${reqUrl} -> ${res.status}`);

  const text = await res.text();
  let etag = res.headers.get('etag') ?? undefined;
  let lastModified = res.headers.get('last-modified') ?? undefined;
  if (!etag) etag = `W/"sha256:${await sha256Hex(text)}"`;

  let json: unknown; try { json = JSON.parse(text); } catch { json = text; }
  return { status: 200 as const, meta: { etag, lastModified, text, json } };
}

const enc = new TextEncoder();
async function sha256Hex(s: string) {
  const buf = await crypto.subtle.digest('SHA-256', enc.encode(s));
  const u8 = new Uint8Array(buf); let hex = '';
  for (let i = 0; i < u8.length; i++) { const v = u8[i]; hex += (v >>> 4).toString(16) + (v & 0xf).toString(16); }
  return hex;
}
