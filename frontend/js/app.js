/* FIT FOR HAJJ — app jemaah (Utama · Ujian · Senaman · Diari) */
(function () {
  const { TESTS, EXS, KOMP } = FFH_DATA;
  const { $, esc, fmt, today, iso, mondayOf, icon } = UI;
  const app = $("#app");

  let me = API.getUser();
  if (!API.getToken() || !me) { location.replace("index.html"); return; }

  Store.init(me.userId);

  const st = {
    view: "home", id: null, fase: "PRE", diariTab: "ujian", weekOffset: 0,
    pendingDel: null, editing: null, loaded: Store.hasCache(), loadErr: null, logoutArm: false
  };

  /* ---------- router (hash) ---------- */
  function parseHash() {
    const p = location.hash.replace(/^#\/?/, "").split("/").filter(Boolean);
    const v = p[0] || "home";
    if (v === "ujian") return p[1] && TESTS.some(t => t.id === p[1]) ? ["ujianDetail", p[1]] : ["ujian", null];
    if (v === "senaman") return p[1] && EXS.some(t => t.id === p[1]) ? ["senamanDetail", p[1]] : ["senaman", null];
    if (v === "diari") return ["diari", null];
    return ["home", null];
  }
  function onRoute() {
    const [v, id] = parseHash();
    const changed = v !== st.view || id !== st.id;
    st.view = v; st.id = id; st.pendingDel = null;
    if (changed) st.editing = null;
    render();
    if (changed) window.scrollTo(0, 0);
  }
  window.addEventListener("hashchange", onRoute);

  /* ---------- helpers ---------- */
  const recs = () => Store.list();
  const pendTag = r => r.pending ? `<span class="tag wait" title="Belum dihantar ke pelayan">Belum sync</span>` : "";

  function fieldInput(f, prefix, value) {
    const id = `${prefix}-${f.key}`;
    if (f.type === "text") return `<div class="field"><label for="${id}">${esc(f.label)}</label><input type="text" id="${id}" maxlength="${f.max || 80}" value="${esc(value ?? "")}"></div>`;
    return `<div class="field"><label for="${id}">${esc(f.label)}</label><div class="unitwrap"><input type="number" inputmode="decimal" step="${f.step || "1"}" min="0" max="${f.max || ""}" id="${id}" value="${esc(value ?? "")}" placeholder="0"><span class="u">${esc(f.unit)}</span></div></div>`;
  }
  function fieldsGrid(fields, prefix, vals) {
    return `<div class="row2">${fields.map(f => `<div style="${fields.length === 1 || f.optional || f.type === "text" ? "grid-column:1/-1" : ""}">${fieldInput(f, prefix, vals ? vals[f.key] : "")}</div>`).join("")}</div>`;
  }
  function readFields(fields, prefix) {
    const v = {}; let err = null;
    fields.forEach(f => {
      if (err) return;
      const el = $(`#${prefix}-${f.key}`); const raw = el.value.trim();
      if (raw === "") { if (!f.optional) err = { msg: `Sila isi ${f.label}.`, el }; return; }
      if (f.type === "text") { v[f.key] = raw; return; }
      const n = Number(raw.replace(",", "."));
      if (!isFinite(n) || n < 0) { err = { msg: `${f.label.replace(/ \(pilihan\)/, "")} mesti nombor 0 atau lebih.`, el }; return; }
      if (f.max && n > f.max) { err = { msg: `${f.label.replace(/ \(pilihan\)/, "")} terlalu besar (maksimum ${f.max} ${f.unit}).`, el }; return; }
      v[f.key] = n;
    });
    return { v, err };
  }
  function recList(list, fields, isTest) {
    if (!list.length) return `<div class="empty">Belum ada rekod. Isi borang di atas untuk mula.</div>`;
    return `<div class="list">${list.map(r => `<div class="rec">
      <span class="d">${fmt(r.date)} ${isTest ? `<span class="tag ${r.fase === "POST" ? "post" : ""}">${esc(r.fase)}</span>` : ""}${pendTag(r)}</span>
      <span class="v">${UI.valuesText(fields, r.values)}${r.nota ? ` · <i>${esc(r.nota)}</i>` : ""}</span>
      <span class="acts">
        <button type="button" data-act="edit" data-rid="${esc(r.recordId)}">Edit</button>
        <button type="button" class="${st.pendingDel === r.recordId ? "confirm" : ""}" data-act="del" data-rid="${esc(r.recordId)}">${st.pendingDel === r.recordId ? "Sahkan padam" : "Padam"}</button>
      </span>
    </div>`).join("")}</div>`;
  }

  // Gambar ilustrasi: img/ujian-<id>.jpg atau img/senaman-<id>.jpg (cuba .png jika .jpg tiada; disembunyi jika tiada langsung)
  function pic(kind, id, alt, cls) {
    const b = cls === "thumb" ? `img/thumb/${kind}-${id}` : `img/${kind}-${id}`;
    return `<figure class="pic ${cls || ""}"><img src="${b}.jpg" alt="${esc(alt)}" loading="lazy" onerror="if(!this.dataset.p){this.dataset.p=1;this.src='${b}.png'}else{this.closest('figure').remove()}"></figure>`;
  }

  // Video YouTube: papar gambar kecil dahulu (jimat data), muat video bila ditekan
  function video(k) {
    const K = KOMP[k]; if (!K || !K.video) return "";
    return `<div class="sec"><h2>Video panduan</h2>
      <div class="yt" data-act="yt" data-v="${esc(K.video)}" role="button" tabindex="0" aria-label="Main video ${esc(K.vtitle)}">
        <img src="https://i.ytimg.com/vi/${esc(K.video)}/hqdefault.jpg" alt="" loading="lazy">
        <span class="yt-play" aria-hidden="true"><svg width="34" height="34" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" fill="currentColor"/></svg></span>
        <span class="yt-cap">${esc(K.vtitle)}</span>
      </div>
      <a class="yt-link" href="https://youtu.be/${esc(K.video)}" target="_blank" rel="noopener">Buka di YouTube ↗</a></div>`;
  }

  /* ---------- views ---------- */
  function vLoading() {
    if (st.loadErr) return `<section class="screen"><div class="card" style="display:grid;gap:12px;text-align:center">
      <h2 style="font-size:20px">Tidak dapat memuatkan rekod</h2><p class="note" style="margin:0">${esc(st.loadErr)}</p>
      <button class="btn" data-act="retry">Cuba lagi</button></div></section>`;
    return `<section class="screen"><div class="loading"><div class="spinner"></div>Memuatkan rekod anda…<span class="note">Mungkin ambil beberapa saat.</span></div>
      <div class="skel"></div><div class="skel"></div></section>`;
  }

  function vHome() {
    const all = recs(), exs = all.filter(r => r.type === "ex");
    const wk = mondayOf(new Date()); const wkEnd = new Date(wk); wkEnd.setDate(wk.getDate() + 6);
    const daysThisWeek = UI.activeDays(all, iso(wk), iso(wkEnd));
    return `<section class="screen">
      <div class="greet"><div class="eyebrow">Assalamualaikum</div><h2>${esc(me.nama.split(" ")[0])}, jom bersedia.</h2></div>
      <div class="stats">
        <div class="stat"><b>${UI.testsDone(all)}/6</b><span>Ujian dibuat</span></div>
        <div class="stat"><b>${exs.length}</b><span>Log senaman</span></div>
        <div class="stat"><b>${daysThisWeek}/7</b><span>Hari aktif minggu ini</span></div>
      </div>
      <div class="steps">
        <a class="step" href="#/ujian" style="text-decoration:none;color:inherit"><span class="n">1</span><span><h3>Ujian</h3><p>Buat 6 ujian kecergasan dan rekod skor PRE / POST.</p></span>${icon.chev}</a>
        <a class="step" href="#/senaman" style="text-decoration:none;color:inherit"><span class="n">2</span><span><h3>Senaman</h3><p>Ikut aktiviti setiap komponen dan log senaman harian.</p></span>${icon.chev}</a>
        <a class="step" href="#/diari" style="text-decoration:none;color:inherit"><span class="n">3</span><span><h3>Diari</h3><p>Laporan skor ujian dan rekod senaman mingguan.</p></span>${icon.chev}</a>
      </div>
      <div class="warn"><span aria-hidden="true">⚠</span><span><b>Keselamatan:</b> Hentikan senaman dan dapatkan rawatan jika sakit dada, sesak nafas teruk, pening atau berdebar-debar.</span></div>
    </section>`;
  }

  function vUjianList() {
    const all = recs();
    const tiles = [1, 2, 3, 4].map(k => TESTS.filter(t => t.k === k).map(t => {
      const rs = all.filter(r => r.type === "test" && r.itemId === t.id);
      const pre = rs.some(r => r.fase === "PRE"), post = rs.some(r => r.fase === "POST");
      return `<a class="tile k${k}" href="#/ujian/${t.id}" style="text-decoration:none">
        ${pic("ujian", t.id, "", "thumb")}<span class="k">Komponen ${k}</span><h3>${esc(t.name)}</h3><p>${esc(t.purpose)}</p>
        <span class="meta"><span class="dot ${pre ? "on" : ""}"></span>PRE ${pre ? "✓" : ""}<span class="dot ${post ? "on" : ""}" style="margin-left:10px"></span>POST ${post ? "✓" : ""}</span>
      </a>`;
    }).join("")).join("");
    return `<section class="screen">
      <div><div class="eyebrow">Langkah 1</div><h1 style="font-size:28px">Ujian Kecergasan</h1><p class="lead">Pilih ujian untuk lihat prosedur dan masukkan skor anda.</p></div>
      <div class="grid">${tiles}</div>
    </section>`;
  }

  function vUjianDetail() {
    const t = TESTS.find(x => x.id === st.id);
    const list = recs().filter(r => r.type === "test" && r.itemId === t.id).sort(UI.byDateDesc);
    const ed = st.editing ? list.find(r => r.recordId === st.editing) : null;
    const fase = ed ? ed.fase : st.fase;
    return `<section class="screen">
      <a class="back" href="#/ujian" style="text-decoration:none">${icon.back} Semua ujian</a>
      <div class="dhead k${t.k}"><span class="k">Komponen ${t.k} · ${KOMP[t.k].name}</span><h1>Ujian ${esc(t.name)}</h1><p>${esc(t.purpose)}</p></div>
      <div class="sec"><h2>Peralatan</h2><div class="chips">${t.equip.map(e => `<span class="chip">${esc(e)}</span>`).join("")}</div></div>
      ${pic("ujian", t.id, "Gambar ujian " + t.name)}
      <div class="sec"><h2>Prosedur ujian</h2><ol class="proc">${t.steps.map(s => `<li><span>${esc(s)}</span></li>`).join("")}</ol></div>
      <div class="warn"><span aria-hidden="true">⚠</span><span><b>Keselamatan:</b> ${esc(t.safety)}</span></div>
      <form class="card form ${ed ? "editing" : ""}" id="testForm" novalidate>
        <div class="formhead"><h2>${ed ? "Edit rekod " + fmt(ed.date) : "Masukkan skor ujian anda"}</h2></div>
        <div class="field"><span class="lbl">Fasa</span><div class="seg" id="fase">
          <button type="button" data-f="PRE" aria-pressed="${fase === "PRE"}">PRE · Sebelum</button>
          <button type="button" data-f="POST" aria-pressed="${fase === "POST"}">POST · Selepas</button></div>
          <span class="hint">PRE = sebelum mula program senaman. POST = selepas tamat program.</span></div>
        <div class="field"><label for="t-date">Tarikh</label><input type="date" id="t-date" max="${today()}" value="${ed ? ed.date : today()}"></div>
        ${fieldsGrid(t.fields, "t", ed ? ed.values : null)}
        <div class="field"><label for="t-nota">Catatan</label><textarea id="t-nota" maxlength="500" placeholder="Contoh: rasa penat pada minit ke-4">${esc(ed ? ed.nota : "")}</textarea></div>
        <p class="err" id="t-err" role="alert" hidden></p>
        <div class="btnrow">${ed ? `<button class="btn ghost" type="button" data-act="cancelEdit">Batal</button>` : ""}<button class="btn" type="submit">${ed ? "Simpan perubahan" : "Simpan skor"}</button></div>
      </form>
      <div class="sec"><h2>Rekod anda</h2><div id="recs">${recList(list, t.fields, true)}</div></div>
    </section>`;
  }

  function vSenamanList() {
    const all = recs();
    const tiles = EXS.map(e => {
      const n = all.filter(r => r.type === "ex" && r.itemId === e.id).length;
      return `<a class="tile k${e.k}" href="#/senaman/${e.id}" style="text-decoration:none">
        ${pic("senaman", e.id, "", "thumb")}<span class="k">${e.k ? `Komponen ${e.k}` : "Tambahan"}</span><h3>${esc(e.title)}</h3><p>${esc(e.rx)}</p>
        <span class="meta">${n} log</span></a>`;
    }).join("");
    return `<section class="screen">
      <div><div class="eyebrow">Langkah 2</div><h1 style="font-size:28px">Senaman Harian</h1><p class="lead">Pilih aktiviti, ikut cara melakukan, kemudian log senaman anda.</p></div>
      <div class="grid">${tiles}</div>
    </section>`;
  }

  function vSenamanDetail() {
    const e = EXS.find(x => x.id === st.id);
    const list = recs().filter(r => r.type === "ex" && r.itemId === e.id).sort(UI.byDateDesc);
    const ed = st.editing ? list.find(r => r.recordId === st.editing) : null;
    const defs = {}; e.fields.forEach(f => { if (f.def != null) defs[f.key] = f.def; });
    return `<section class="screen">
      <a class="back" href="#/senaman" style="text-decoration:none">${icon.back} Semua aktiviti</a>
      <div class="dhead k${e.k}"><span class="k">${e.k ? `Komponen ${e.k} · ${KOMP[e.k].name}` : "Tambahan"}</span><h1>${esc(e.title)}</h1>
        <div class="rx"><span aria-hidden="true">🎯</span><span>${esc(e.rx)}</span></div></div>
      ${pic("senaman", e.id, "Gambar " + e.title)}
      ${video(e.k)}
      <div class="sec"><h2>Cara melakukan</h2><ol class="proc">${e.steps.map(s => `<li><span>${esc(s)}</span></li>`).join("")}</ol></div>
      <form class="card form ${ed ? "editing" : ""}" id="exForm" novalidate>
        <div class="formhead"><h2>${ed ? "Edit log " + fmt(ed.date) : "Log senaman anda"}</h2></div>
        <div class="field"><label for="e-date">Tarikh</label><input type="date" id="e-date" max="${today()}" value="${ed ? ed.date : today()}"></div>
        ${fieldsGrid(e.fields, "e", ed ? ed.values : defs)}
        <div class="field"><label for="e-nota">Nota</label><textarea id="e-nota" maxlength="500" placeholder="Contoh: lutut kanan rasa ketat">${esc(ed ? ed.nota : "")}</textarea></div>
        <p class="err" id="e-err" role="alert" hidden></p>
        <div class="btnrow">${ed ? `<button class="btn ghost" type="button" data-act="cancelEdit">Batal</button>` : ""}<button class="btn" type="submit">${ed ? "Simpan perubahan" : "Simpan log"}</button></div>
      </form>
      <div class="sec"><h2>Log terkini</h2><div id="recs">${recList(list.slice(0, 15), e.fields, false)}</div></div>
    </section>`;
  }

  function vDiari() {
    return `<section class="screen">
      <div><div class="eyebrow">Langkah 3</div><h1 style="font-size:28px">Diari Senaman</h1></div>
      ${UI.diariHTML(me, recs(), st)}
    </section>`;
  }

  /* ---------- render ---------- */
  const VIEWS = { home: vHome, ujian: vUjianList, ujianDetail: vUjianDetail, senaman: vSenamanList, senamanDetail: vSenamanDetail, diari: vDiari };
  function render() {
    $("#who").innerHTML = `${esc(me.nama.split(" ")[0])}<br><span style="opacity:.75">${esc(me.umur)} thn</span>`;
    app.innerHTML = st.loaded ? VIEWS[st.view]() : vLoading();
    const sect = { home: "home", ujian: "ujian", ujianDetail: "ujian", senaman: "senaman", senamanDetail: "senaman", diari: "diari" }[st.view];
    document.querySelectorAll(".tabbar a").forEach(a => a.dataset.sect === sect ? a.setAttribute("aria-current", "page") : a.removeAttribute("aria-current"));
    paintSync();
  }
  // kemas kini senarai rekod sahaja (tanpa kacau borang yang sedang diisi)
  function renderList() {
    const box = $("#recs");
    if (!box) return render();
    if (st.view === "ujianDetail") {
      const t = TESTS.find(x => x.id === st.id);
      box.innerHTML = recList(recs().filter(r => r.type === "test" && r.itemId === t.id).sort(UI.byDateDesc), t.fields, true);
    } else if (st.view === "senamanDetail") {
      const e = EXS.find(x => x.id === st.id);
      box.innerHTML = recList(recs().filter(r => r.type === "ex" && r.itemId === e.id).sort(UI.byDateDesc).slice(0, 15), e.fields, false);
    } else render();
  }

  function paintSync() {
    const b = $("#sync"), s = Store.status();
    if (s.pending) {
      b.hidden = false;
      b.className = "sync" + (s.syncing ? " busy" : s.offline ? " off" : "");
      b.textContent = s.syncing ? `Menghantar… (${s.pending})` : `Belum sync (${s.pending})`;
      b.title = s.offline ? "Tiada sambungan. Akan dihantar semula bila ada internet. Tekan untuk cuba sekarang." : "Tekan untuk hantar sekarang";
    } else if (s.offline) {
      b.hidden = false; b.className = "sync off"; b.textContent = "Luar talian"; b.title = "Tiada sambungan internet";
    } else b.hidden = true;
  }

  /* ---------- store events ---------- */
  Store.on((type, data) => {
    if (type === "status") paintSync();
    if (type === "change") { if (st.loaded) renderList(); paintSync(); }
    if (type === "error") UI.toast(data, "err");
    if (type === "auth") { location.replace("index.html?tamat=1"); }
  });

  function load() {
    st.loadErr = null;
    if (!st.loaded) render();
    Store.refresh().then(() => {
      me = API.getUser() || me;
      const first = !st.loaded;
      st.loaded = true;
      if (first) render();
      else { // jangan ganggu borang
        if (st.view === "ujianDetail" || st.view === "senamanDetail") renderList(); else render();
      }
    }).catch(err => {
      if (err.code === "AUTH") { location.replace("index.html?tamat=1"); return; }
      if (!st.loaded) { st.loadErr = err.message; render(); }
      paintSync();
    });
  }

  /* ---------- tindakan ---------- */
  document.addEventListener("click", e => {
    const a = e.target.closest("[data-act]");
    if (a) {
      const act = a.dataset.act;
      if (UI.diariClick(a, st, render)) return;
      if (act === "logout") {
        const n = Store.status().pending;
        if (n && !st.logoutArm) { st.logoutArm = true; a.textContent = "Keluar juga?"; UI.toast(`Ada ${n} rekod belum sync. Tekan sekali lagi untuk keluar.`, "err"); setTimeout(() => { st.logoutArm = false; a.textContent = "Keluar"; }, 5000); return; }
        a.disabled = true; API.logout().then(() => location.replace("index.html"));
        return;
      }
      if (act === "retry") { load(); return; }
      if (act === "yt") {
        const id = a.dataset.v;
        a.outerHTML = `<div class="yt on"><iframe src="https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}?autoplay=1&rel=0&playsinline=1" title="Video panduan" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen></iframe></div>`;
        return;
      }
      if (act === "edit") {
        st.editing = a.dataset.rid; st.pendingDel = null; render();
        const f = $("form.card"); if (f) f.scrollIntoView({ behavior: "smooth", block: "start" });
        return;
      }
      if (act === "cancelEdit") { st.editing = null; render(); return; }
      if (act === "del") {
        const rid = a.dataset.rid;
        if (st.pendingDel === rid) {
          st.pendingDel = null;
          if (st.editing === rid) { st.editing = null; Store.remove(rid); render(); } else Store.remove(rid);
          UI.toast("Dipadam");
        } else { st.pendingDel = rid; renderList(); }
        return;
      }
      return;
    }
    if (e.target.closest("#sync")) { Store.flush(); return; }
    const f = e.target.closest("#fase button");
    if (f) { if (!st.editing) st.fase = f.dataset.f; document.querySelectorAll("#fase button").forEach(b => b.setAttribute("aria-pressed", b === f)); }
  });

  document.addEventListener("keydown", e => {
    if ((e.key === "Enter" || e.key === " ") && e.target.matches && e.target.matches(".yt[data-act=yt]")) { e.preventDefault(); e.target.click(); }
  });

  document.addEventListener("submit", e => {
    e.preventDefault();
    const form = e.target;
    if (form.id === "testForm") {
      const t = TESTS.find(x => x.id === st.id);
      const { v, err } = readFields(t.fields, "t");
      const errEl = $("#t-err");
      const date = $("#t-date").value;
      const fase = (document.querySelector('#fase button[aria-pressed="true"]') || {}).dataset?.f || "PRE";
      const bad = err || dateErr(date, "#t-date");
      if (bad) { errEl.textContent = bad.msg; errEl.hidden = false; bad.el && bad.el.focus(); return; }
      const rec = { type: "test", itemId: t.id, fase, date, values: v, nota: $("#t-nota").value.trim() };
      if (st.editing) { Store.update(st.editing, rec); st.editing = null; UI.toast("Perubahan disimpan"); }
      else { Store.add(rec); st.fase = fase; UI.toast(`Skor ${fase} disimpan`); }
      render();
      const r = $("#recs"); if (r) r.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    if (form.id === "exForm") {
      const ex = EXS.find(x => x.id === st.id);
      const { v, err } = readFields(ex.fields, "e");
      const errEl = $("#e-err");
      const date = $("#e-date").value;
      const bad = err || dateErr(date, "#e-date");
      if (bad) { errEl.textContent = bad.msg; errEl.hidden = false; bad.el && bad.el.focus(); return; }
      const rec = { type: "ex", itemId: ex.id, date, values: v, nota: $("#e-nota").value.trim() };
      if (st.editing) { Store.update(st.editing, rec); st.editing = null; UI.toast("Perubahan disimpan"); }
      else { Store.add(rec); UI.toast("Disimpan"); }
      render();
      const r = $("#recs"); if (r) r.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  });

  function dateErr(d, sel) {
    const el = $(sel);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return { msg: "Sila pilih tarikh.", el };
    if (d > today()) return { msg: "Tarikh tidak boleh pada masa hadapan.", el };
    if (d < "2020-01-01") return { msg: "Tarikh tidak sah.", el };
    return null;
  }

  // segar semula bila app dibuka semula (cth. tukar tab telefon)
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && st.loaded) Store.refresh().then(() => { if (st.view !== "ujianDetail" && st.view !== "senamanDetail") render(); else renderList(); }).catch(() => paintSync());
  });

  onRoute();
  load();
})();
