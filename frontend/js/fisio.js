/* FIT FOR HAJJ — dashboard fisio */
(function () {
  const { $, esc, fmt, icon } = UI;
  const app = $("#app");
  const K_FILTER = "ffh_fisio_kump";

  if (!API.getToken()) { location.replace("index.html"); return; }

  const st = {
    view: "list", id: null, me: API.getUser(),
    users: null, kumpulan: [], today: null, usersErr: null,
    filter: API.LS.get(K_FILTER, ""), q: "",
    detail: null, detailErr: null, diariTab: "ujian", weekOffset: 0, resetArm: false, resetBusy: false,
    summary: null, summaryErr: null, summaryK: null
  };

  /* ---------- router ---------- */
  function parseHash() {
    const p = location.hash.replace(/^#\/?/, "").split("/").filter(Boolean);
    if (p[0] === "jemaah" && p[1]) return ["detail", decodeURIComponent(p[1])];
    if (p[0] === "ringkasan") return ["summary", null];
    return ["list", null];
  }
  function onRoute() {
    const [v, id] = parseHash();
    st.view = v; st.id = id; st.resetArm = false;
    if (v === "detail" && (!st.detail || st.detail.user.userId !== id)) { st.detail = null; st.detailErr = null; st.weekOffset = 0; loadDetail(id); }
    if (v === "summary" && st.summaryK !== st.filter) loadSummary();
    if (v === "list" && !st.users) loadUsers();
    render(); window.scrollTo(0, 0);
  }
  window.addEventListener("hashchange", onRoute);

  /* ---------- data ---------- */
  async function loadUsers() {
    st.usersErr = null;
    try {
      const d = await API.call("listUsers");
      st.users = d.users; st.kumpulan = d.kumpulan; st.today = d.today;
      if (st.filter && !st.kumpulan.includes(st.filter)) st.filter = "";
    } catch (err) { if (!handleAuth(err)) st.usersErr = err.message; }
    if (st.view === "list") render();
  }
  async function loadDetail(id) {
    try { st.detail = await API.call("getUserRecords", { userId: id }); }
    catch (err) { if (!handleAuth(err)) st.detailErr = err.message; }
    if (st.view === "detail" && st.id === id) render();
  }
  async function loadSummary() {
    st.summary = null; st.summaryErr = null; st.summaryK = st.filter;
    const k = st.filter;
    try { const d = await API.call("groupSummary", { kumpulan: k }); if (st.summaryK === k) st.summary = d; }
    catch (err) { if (!handleAuth(err)) st.summaryErr = err.message; }
    if (st.view === "summary") render();
  }
  function handleAuth(err) {
    if (err.code === "AUTH") { location.replace("index.html?tamat=1"); return true; }
    if (err.code === "FORBIDDEN") { st.forbidden = true; render(); return true; }
    return false;
  }

  /* ---------- views ---------- */
  const loading = msg => `<div class="loading"><div class="spinner"></div>${esc(msg)}</div>`;
  const errBox = (msg, act) => `<div class="card" style="display:grid;gap:12px;text-align:center"><p class="err">${esc(msg)}</p><button class="btn" data-act="${act}">Cuba lagi</button></div>`;

  function nav() {
    return `<div class="ftabs tabs" role="navigation" aria-label="Menu fisio">
      <a class="btn sm ${st.view === "list" || st.view === "detail" ? "navy" : "ghost"}" href="#/">Senarai jemaah</a>
      <a class="btn sm ${st.view === "summary" ? "navy" : "ghost"}" href="#/ringkasan">Ringkasan kumpulan</a>
    </div>`;
  }
  function kumpSelect(id) {
    return `<div class="field"><label for="${id}">Kod kumpulan</label><select id="${id}" data-filter>
      <option value="">Semua kumpulan</option>${st.kumpulan.map(k => `<option ${k === st.filter ? "selected" : ""}>${esc(k)}</option>`).join("")}</select></div>`;
  }
  const pill = (n, total) => `<span class="pill ${n >= total ? "ok" : n > 0 ? "part" : ""}">${n >= total ? "✓ Siap" : `${n}/${total}`}</span>`;

  function filtered() {
    const q = st.q.trim().toLowerCase();
    return (st.users || []).filter(u => (!st.filter || u.kumpulan === st.filter) && (!q || u.nama.toLowerCase().includes(q) || (u.telefon || "").includes(q)));
  }
  function rowsHTML() {
    const list = filtered();
    if (!list.length) return `<tr><td colspan="8" style="text-align:center;padding:20px" class="note">Tiada jemaah dijumpai.</td></tr>`;
    return list.map(u => `<tr data-uid="${esc(u.userId)}">
      <td><button class="namebtn" data-open="${esc(u.userId)}">${esc(u.nama)}</button><br><span class="note">${esc(u.telefon)}</span></td>
      <td>${esc(u.kumpulan || "—")}</td><td>${esc(u.umur)}</td><td>${u.jantina === "L" ? "L" : "P"}</td>
      <td>${pill(u.pre, u.testTotal)}</td><td>${pill(u.post, u.testTotal)}</td>
      <td><b>${u.active7}</b>/7</td><td>${fmt(u.lastLog)}</td></tr>`).join("");
  }
  function vList() {
    let body;
    if (st.usersErr) body = errBox(st.usersErr, "reloadUsers");
    else if (!st.users) body = loading("Memuatkan senarai jemaah…");
    else {
      const list = filtered();
      const act3 = list.filter(u => u.active7 >= 3).length;
      body = `
        <div class="kpis">
          <div class="stat"><b>${list.length}</b><span>Jemaah</span></div>
          <div class="stat"><b>${list.filter(u => u.pre >= u.testTotal).length}</b><span>PRE lengkap</span></div>
          <div class="stat"><b>${list.filter(u => u.post >= u.testTotal).length}</b><span>POST lengkap</span></div>
          <div class="stat"><b>${list.length ? Math.round(act3 / list.length * 100) : 0}%</b><span>Aktif ≥3 hari (7 hari lepas)</span></div>
        </div>
        <div class="card toolbar">
          ${kumpSelect("fk")}
          <div class="field"><label for="fq">Cari nama / telefon</label><input type="search" id="fq" value="${esc(st.q)}" placeholder="Taip untuk cari…"></div>
          <button class="btn ghost sm" data-act="reloadUsers">Muat semula</button>
        </div>
        <div class="tbl-wrap"><table class="dtable"><thead><tr><th>Nama</th><th>Kumpulan</th><th>Umur</th><th>Jantina</th><th>PRE siap?</th><th>POST siap?</th><th>Hari aktif (7 hari)</th><th>Log terakhir</th></tr></thead>
        <tbody id="ulist">${rowsHTML()}</tbody></table></div>
        <p class="note" style="margin:0">PRE/POST siap = kelima-lima ujian ada rekod. Klik nama untuk lihat diari jemaah.</p>`;
    }
    return `<section class="screen">
      <div><div class="eyebrow">Dashboard Fisio</div><h1 style="font-size:28px">Senarai Jemaah</h1></div>
      ${nav()}${body}</section>`;
  }

  function vDetail() {
    const back = `<a class="back" href="#/" style="text-decoration:none">${icon.back} Senarai jemaah</a>`;
    if (st.detailErr) return `<section class="screen">${back}${errBox(st.detailErr, "reloadDetail")}</section>`;
    if (!st.detail) return `<section class="screen">${back}${loading("Memuatkan diari jemaah…")}</section>`;
    const u = st.detail.user;
    return `<section class="screen">
      ${nav()}${back}
      <div><div class="eyebrow">Diari jemaah · paparan sahaja</div><h1 style="font-size:26px">${esc(u.nama)}</h1>
        <p class="note" style="margin:4px 0 0">Tel: ${esc(u.telefon)} · ${esc(u.kumpulan || "Tiada kumpulan")}</p></div>
      <details class="card" ${st.resetArm || st.resetBusy ? "open" : ""}>
        <summary style="font-weight:800;cursor:pointer;min-height:32px">Set semula PIN jemaah</summary>
        <form id="resetForm" class="form" style="margin-top:12px" novalidate>
          <div class="field"><label for="newpin">PIN baharu (6 digit)</label><input type="tel" id="newpin" inputmode="numeric" maxlength="6" autocomplete="off" placeholder="Contoh: 482915"></div>
          <p class="err" id="pin-err" role="alert" hidden></p>
          <button class="btn ${st.resetArm ? "danger" : ""}" type="submit" ${st.resetBusy ? "disabled" : ""}>${st.resetBusy ? "Sedang menukar…" : st.resetArm ? "Sahkan reset PIN" : "Reset PIN"}</button>
          <p class="note" style="margin:0">Jemaah akan dilog keluar dari semua peranti. Beritahu PIN baharu kepada jemaah secara peribadi.</p>
        </form>
      </details>
      ${UI.diariHTML(u, st.detail.records || [], st, { readOnly: true })}
    </section>`;
  }

  function vSummary() {
    let body;
    if (st.summaryErr) body = errBox(st.summaryErr, "reloadSummary");
    else if (!st.summary) body = loading("Mengira ringkasan kumpulan…");
    else {
      const s = st.summary;
      const f1 = v => v == null ? "—" : String(v);
      let last = "";
      const rows = s.rows.map(r => {
        const first = r.testId !== last; last = r.testId;
        const cls = r.better === "up" && r.diffAvg ? (r.diffAvg > 0 ? "up" : "down") : "";
        const span = s.rows.filter(x => x.testId === r.testId).length;
        return `<tr>${first ? `<td rowspan="${span}"><b>${esc(r.testName)}</b></td>` : ""}<td class="sub">${esc(r.label)} (${esc(r.unit)})</td>
          <td>${f1(r.preAvg)} <span class="note">n=${r.preN}</span></td><td>${f1(r.postAvg)} <span class="note">n=${r.postN}</span></td>
          <td class="delta ${cls}">${r.diffAvg == null ? "—" : (r.diffAvg > 0 ? "+" : "") + r.diffAvg} <span class="note">n=${r.pairN}</span></td></tr>`;
      }).join("");
      body = `
        <div class="card toolbar" style="grid-template-columns:minmax(0,260px) auto">${kumpSelect("sk")}<button class="btn ghost sm" data-act="reloadSummary">Muat semula</button></div>
        <div class="kpis">
          <div class="stat"><b>${s.total}</b><span>Jemaah</span></div>
          <div class="stat"><b>${s.pctActive3}%</b><span>Aktif ≥3 hari seminggu (${s.active3}/${s.total})</span></div>
          <div class="stat"><b>${s.preDone}</b><span>PRE lengkap</span></div>
          <div class="stat"><b>${s.postDone}</b><span>POST lengkap</span></div>
        </div>
        <div class="sec"><h2>Purata PRE vs POST</h2>
          <p class="note" style="margin:-4px 0 10px">Skor terkini setiap jemaah bagi setiap fasa. Beza = purata perubahan bagi jemaah yang ada kedua-dua PRE dan POST (n berpasangan). Tempoh aktiviti: ${fmt(s.from)} – ${fmt(s.today)}.</p>
          <div class="tbl-wrap"><table><thead><tr><th>Ujian</th><th>Ukuran</th><th>Purata PRE</th><th>Purata POST</th><th>Purata beza</th></tr></thead><tbody>${rows}</tbody></table></div>
        </div>`;
    }
    return `<section class="screen">
      <div><div class="eyebrow">Dashboard Fisio</div><h1 style="font-size:28px">Ringkasan Kumpulan${st.filter ? " · " + esc(st.filter) : ""}</h1></div>
      ${nav()}${body}</section>`;
  }

  function vForbidden() {
    return `<section class="screen"><div class="card" style="display:grid;gap:12px;text-align:center">
      <h2>Akses fisio sahaja</h2><p class="note" style="margin:0">Akaun ini bukan akaun fisio. Minta pentadbir tukar <b>role</b> akaun anda kepada <b>fisio</b> dalam tab USERS di Google Sheet, kemudian log masuk semula.</p>
      <a class="btn" href="app.html">Buka app jemaah</a><button class="btn ghost" data-act="logout">Keluar</button></div></section>`;
  }

  function render() {
    if (st.forbidden) { app.innerHTML = vForbidden(); return; }
    app.innerHTML = st.view === "detail" ? vDetail() : st.view === "summary" ? vSummary() : vList();
  }

  /* ---------- events ---------- */
  document.addEventListener("click", e => {
    const o = e.target.closest("[data-open]") || e.target.closest("tr[data-uid]");
    if (o && !e.target.closest("a")) { location.hash = "#/jemaah/" + encodeURIComponent(o.dataset.open || o.dataset.uid); return; }
    const a = e.target.closest("[data-act]");
    if (!a) return;
    if (UI.diariClick(a, st, render)) return;
    const act = a.dataset.act;
    if (act === "logout") { a.disabled = true; API.logout().then(() => location.replace("index.html")); }
    if (act === "reloadUsers") { st.users = null; render(); loadUsers(); }
    if (act === "reloadDetail") { st.detail = null; st.detailErr = null; render(); loadDetail(st.id); }
    if (act === "reloadSummary") { st.summaryK = null; loadSummary(); render(); }
  });
  document.addEventListener("change", e => {
    if (e.target.matches("[data-filter]")) {
      st.filter = e.target.value; API.LS.set(K_FILTER, st.filter);
      if (st.view === "summary") { loadSummary(); render(); } else render();
    }
  });
  document.addEventListener("input", e => {
    if (e.target.id === "fq") { st.q = e.target.value; const b = $("#ulist"); if (b) b.innerHTML = rowsHTML(); }
  });
  document.addEventListener("submit", async e => {
    e.preventDefault();
    if (e.target.id !== "resetForm") return;
    const pin = $("#newpin").value.trim(), err = $("#pin-err");
    if (!/^\d{6}$/.test(pin)) { err.textContent = "PIN mesti 6 digit nombor."; err.hidden = false; return; }
    if (!st.resetArm) { st.resetArm = true; const keep = pin; render(); $("#newpin").value = keep; return; }
    st.resetBusy = true; render(); $("#newpin").value = pin;
    try {
      const d = await API.call("resetPin", { userId: st.id, pin });
      st.resetArm = false; st.resetBusy = false; render();
      UI.toast(`PIN ${d.nama} telah ditukar`);
    } catch (ex) {
      st.resetBusy = false; st.resetArm = false;
      if (handleAuth(ex)) return;
      render(); $("#newpin").value = pin; const er = $("#pin-err"); er.textContent = ex.message; er.hidden = false;
    }
  });

  /* ---------- mula ---------- */
  (async function init() {
    app.innerHTML = loading("Menyemak akaun…");
    try {
      const d = await API.call("getMe");
      API.setUser(d.user); st.me = d.user; API.setSheetUrl(d.sheetUrl);
      if (d.user.role !== "fisio") { st.forbidden = true; render(); return; }
    } catch (err) {
      if (handleAuth(err)) return;
      if (!st.me || st.me.role !== "fisio") { app.innerHTML = `<section class="screen">${errBox(err.message, "reload")}</section>`; app.querySelector("[data-act=reload]").onclick = () => location.reload(); return; }
    }
    const url = API.sheetUrl();
    if (url) { const l = $("#sheetLink"); l.href = url; l.hidden = false; }
    onRoute();
  })();
})();
