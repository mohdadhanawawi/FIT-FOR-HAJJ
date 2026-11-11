/* FIT FOR HAJJ — API ke Google Apps Script + cache + offline queue */
(function () {
  const CFG = window.FFH_CONFIG || {};
  const K_TOKEN = "ffh_token", K_USER = "ffh_user", K_SHEET = "ffh_sheet";
  const kRecs = id => "ffh_recs_" + id, kQueue = id => "ffh_q_" + id;

  const LS = {
    get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { } },
    del(k) { try { localStorage.removeItem(k); } catch (e) { } }
  };

  class ApiError extends Error {
    constructor(msg, opt = {}) { super(msg); this.offline = !!opt.offline; this.code = opt.code || null; }
  }

  function configured() {
    const u = String(CFG.WEB_APP_URL || "");
    return /^https:\/\/script\.google(usercontent)?\.com\//.test(u) || /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?\//.test(u);
  }

  async function call(action, payload = {}, opt = {}) {
    if (!configured()) throw new ApiError("Aplikasi belum disambung ke Google Sheet. Isi WEB_APP_URL dalam js/config.js.", { code: "CONFIG" });
    if (navigator.onLine === false) throw new ApiError("Tiada sambungan internet.", { offline: true });
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), opt.timeout || 30000);
    let res;
    try {
      res = await fetch(CFG.WEB_APP_URL, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify(Object.assign({ action, token: getToken() }, payload)),
        signal: ctrl.signal, redirect: "follow"
      });
    } catch (e) {
      throw new ApiError("Tiada sambungan ke pelayan. Sila cuba lagi.", { offline: true });
    } finally { clearTimeout(timer); }
    let data;
    try { data = await res.json(); }
    catch (e) { throw new ApiError("Pelayan tidak memberi respons yang betul. Cuba lagi sebentar.", { offline: true }); }
    if (!data || !data.ok) {
      const err = new ApiError((data && data.error) || "Ralat tidak diketahui.", { code: data && data.code, offline: data && data.code === "SERVER" });
      if (err.code === "AUTH") clearSession();
      throw err;
    }
    return data;
  }

  /* ---------- sesi ---------- */
  function getToken() { return LS.get(K_TOKEN, null); }
  function getUser() { return LS.get(K_USER, null); }
  function setUser(u) { LS.set(K_USER, u); }
  function setSession(token, user, sheetUrl) { LS.set(K_TOKEN, token); LS.set(K_USER, user); if (sheetUrl) LS.set(K_SHEET, sheetUrl); }
  function clearSession() { LS.del(K_TOKEN); LS.del(K_SHEET); }
  function sheetUrl() { return LS.get(K_SHEET, null); }
  function setSheetUrl(u) { if (u) LS.set(K_SHEET, u); }
  async function logout() {
    const u = getUser();
    try { if (getToken()) await call("logout", {}, { timeout: 6000 }); } catch (e) { }
    clearSession();
    if (u) { LS.del(kRecs(u.userId)); LS.del(kQueue(u.userId)); }
    LS.del(K_USER);
  }

  /* ---------- store rekod (cache + queue) ---------- */
  function newId() {
    const a = new Uint8Array(6);
    (window.crypto || {}).getRandomValues ? crypto.getRandomValues(a) : a.forEach((_, i) => a[i] = Math.random() * 256);
    return "R" + Date.now().toString(36) + Array.from(a, b => b.toString(36).padStart(2, "0")).join("").slice(0, 8);
  }
  const strip = r => ({ recordId: r.recordId, type: r.type, itemId: r.itemId, fase: r.fase || "", date: r.date, values: r.values || {}, nota: r.nota || "" });

  function merge(server, queue) {
    const m = new Map(server.map(r => [r.recordId, r]));
    queue.forEach(q => {
      if (q.op === "delete") m.delete(q.recordId);
      else m.set(q.recordId, Object.assign({}, m.get(q.recordId) || {}, q.record, { pending: true }));
    });
    return [...m.values()];
  }

  const Store = {
    uid: null, recs: null, queue: [], syncing: false, offline: false, inflight: null,
    _listeners: [], _chain: Promise.resolve(), _timer: null,

    init(uid) {
      this.uid = uid;
      this.recs = LS.get(kRecs(uid), null);
      this.queue = LS.get(kQueue(uid), []);
      window.addEventListener("online", () => { this.offline = false; this.emit("status"); this.flush(); });
      window.addEventListener("offline", () => { this.offline = true; this.emit("status"); });
      this._timer = setInterval(() => { if (this.queue.length && !this.syncing) this.flush(); }, 30000);
    },
    hasCache() { return this.recs !== null; },
    list() { return this.recs || []; },
    on(fn) { this._listeners.push(fn); },
    emit(type, data) { this._listeners.forEach(f => { try { f(type, data); } catch (e) { console.error(e); } }); },
    persist() { LS.set(kRecs(this.uid), this.recs || []); LS.set(kQueue(this.uid), this.queue); },
    status() { return { pending: this.queue.length, syncing: this.syncing, offline: this.offline || navigator.onLine === false }; },

    add(rec) {
      const r = Object.assign(strip(rec), { recordId: newId(), updatedAt: new Date().toISOString(), pending: true });
      this.recs = [...this.list(), r];
      this.queue.push({ op: "add", recordId: r.recordId, record: strip(r) });
      this.persist(); this.emit("change"); this.flush();
      return r;
    },
    update(id, changes) {
      const cur = this.list().find(r => r.recordId === id);
      if (!cur) return null;
      const r = Object.assign({}, cur, strip(Object.assign({}, cur, changes)), { recordId: id, type: cur.type, itemId: cur.itemId, pending: true, updatedAt: new Date().toISOString() });
      this.recs = this.list().map(x => x.recordId === id ? r : x);
      const addOp = this.queue.find(q => q.recordId === id && q.op === "add" && q !== this.inflight);
      if (addOp) addOp.record = strip(r);
      else {
        this.queue = this.queue.filter(q => !(q.recordId === id && q.op === "update" && q !== this.inflight));
        this.queue.push({ op: "update", recordId: id, record: strip(r) });
      }
      this.persist(); this.emit("change"); this.flush();
      return r;
    },
    remove(id) {
      this.recs = this.list().filter(r => r.recordId !== id);
      const addOp = this.queue.find(q => q.recordId === id && q.op === "add" && q !== this.inflight);
      this.queue = this.queue.filter(q => q.recordId !== id || q === this.inflight);
      if (!addOp) this.queue.push({ op: "delete", recordId: id });
      this.persist(); this.emit("change"); this.flush();
    },

    run(task) { const p = this._chain.then(task); this._chain = p.catch(() => { }); return p; },
    flush() { return this.run(() => this._flush()); },
    async _flush() {
      if (!this.queue.length) return;
      this.syncing = true; this.emit("status");
      try {
        while (this.queue.length) {
          const op = this.queue[0];
          this.inflight = op;
          let res;
          try {
            if (op.op === "add") res = await call("addRecord", { record: op.record });
            else if (op.op === "update") res = await call("updateRecord", { recordId: op.recordId, record: op.record });
            else res = await call("deleteRecord", { recordId: op.recordId });
            this.offline = false;
          } catch (err) {
            this.inflight = null;
            if (err.offline) { this.offline = true; break; }
            if (err.code === "AUTH") { this.emit("auth"); break; }
            if (err.code === "CONFIG") break;
            // ditolak oleh pelayan (validasi) — buang dari queue supaya tak tersekat
            this.queue.shift();
            if (op.op === "add") this.recs = this.list().filter(r => r.recordId !== op.recordId);
            this.persist(); this.emit("error", "Rekod tidak dapat disimpan: " + err.message); this.emit("change");
            continue;
          }
          this.inflight = null;
          this.queue.shift();
          if (res.record && !this.queue.some(q => q.recordId === op.recordId)) {
            this.recs = this.list().map(r => r.recordId === op.recordId ? res.record : r);
          }
          this.persist(); this.emit("change");
        }
      } finally {
        this.inflight = null; this.syncing = false; this.emit("status");
      }
    },
    refresh() {
      return this.run(async () => {
        await this._flush();
        const d = await call("listRecords");
        if (d.user) setUser(d.user);
        this.recs = merge(d.records || [], this.queue);
        this.offline = false;
        this.persist(); this.emit("change"); this.emit("status");
        return d;
      });
    }
  };

  window.API = { call, configured, getToken, getUser, setUser, setSession, clearSession, logout, sheetUrl, setSheetUrl, ApiError, LS };
  window.Store = Store;
})();
