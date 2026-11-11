/* FIT FOR HAJJ — utiliti UI dikongsi (app jemaah, log masuk, dashboard fisio) */
window.UI = (function () {
  const { TESTS, EXS, DAYS } = window.FFH_DATA;

  const $ = s => document.querySelector(s);
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const pad = n => String(n).padStart(2, "0");
  const iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const today = () => iso(new Date());
  const fmt = s => { if (!s) return "—"; const [y, m, d] = String(s).split("-"); return d ? `${d}/${m}/${y}` : s; };
  const initials = n => String(n || "?").trim().split(/\s+/).slice(0, 2).map(w => w[0]).join("").toUpperCase();
  const addDays = (s, n) => { const d = new Date(s + "T00:00:00"); d.setDate(d.getDate() + n); return iso(d); };
  function mondayOf(d) { const x = new Date(d); const w = (x.getDay() + 6) % 7; x.setDate(x.getDate() - w); x.setHours(0, 0, 0, 0); return x; }
  const num = v => (v === undefined || v === null || v === "") ? "—" : String(v);

  function toast(msg, kind) {
    const t = $("#toast"); if (!t) return;
    t.textContent = msg; t.className = "toast" + (kind ? " " + kind : ""); t.hidden = false;
    clearTimeout(toast._t); toast._t = setTimeout(() => t.hidden = true, kind === "err" ? 4500 : 2400);
  }

  const icon = {
    chev: `<svg class="chev" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>`,
    back: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true"><path d="M15 6l-6 6 6 6"/></svg>`,
    kaabah: `<svg width="30" height="30" viewBox="0 0 32 32" aria-hidden="true"><rect x="6" y="11" width="20" height="17" rx="1.5" fill="#0B0B0B" stroke="#E9A400" stroke-width="1.5"/><rect x="6" y="15" width="20" height="3" fill="#E9A400"/><path d="M4 11 16 4l12 7" fill="none" stroke="#E9A400" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    print: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9V3h12v6M6 18H4a1 1 0 0 1-1-1v-6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v6a1 1 0 0 1-1 1h-2"/><rect x="6" y="14" width="12" height="7"/></svg>`
  };

  /* ---------- logik rekod ---------- */
  const byDateDesc = (a, b) => String(b.date).localeCompare(String(a.date)) || String(b.updatedAt || "").localeCompare(String(a.updatedAt || ""));
  const latest = recs => [...recs].sort(byDateDesc)[0];

  function valuesText(fields, v) {
    v = v || {};
    return fields.filter(f => v[f.key] !== undefined && v[f.key] !== "").map(f => f.type === "text" ? `<b>${esc(v[f.key])}</b>` :
      `${esc(f.label.replace(/ \(pilihan\)/, ""))}: <b>${esc(v[f.key])}</b> ${esc(f.unit)}`).join(" · ");
  }

  // Ujian dibuat /6 → 5 ujian + 1-Minute Push-Up
  function testsDone(recs) {
    const t = recs.filter(r => r.type === "test");
    const ids = new Set(t.map(r => r.itemId).filter(id => TESTS.some(x => x.id === id)));
    const push = t.some(r => r.itemId === "armcurl" && r.values && r.values.pushup != null && r.values.pushup !== "");
    return ids.size + (push ? 1 : 0);
  }
  function activeDays(recs, from, to) {
    return new Set(recs.filter(r => r.type === "ex" && r.date >= from && r.date <= to).map(r => r.date)).size;
  }
  function exName(r) {
    if (r.itemId === "other") return (r.values && r.values.namaSenaman) || "Lain-lain";
    const e = EXS.find(x => x.id === r.itemId); return e ? e.name : r.itemId;
  }

  function prePostRows(tests) {
    const out = [];
    TESTS.forEach(t => {
      const pre = latest(tests.filter(r => r.itemId === t.id && r.fase === "PRE"));
      const post = latest(tests.filter(r => r.itemId === t.id && r.fase === "POST"));
      const fields = t.fields.filter(f => !(f.optional && pre?.values?.[f.key] == null && post?.values?.[f.key] == null));
      fields.forEach((f, i) => {
        const a = pre?.values?.[f.key], b = post?.values?.[f.key];
        let d = "—", cls = "";
        if (a != null && a !== "" && b != null && b !== "") {
          const diff = +(b - a).toFixed(1); d = (diff > 0 ? "+" : "") + diff;
          if (f.better === "up" && diff !== 0) cls = diff > 0 ? "up" : "down";
        }
        out.push({ t, f, first: i === 0, span: fields.length, a, b, d, cls });
      });
    });
    return out;
  }

  function weekDates(offset) {
    const mon = mondayOf(new Date()); mon.setDate(mon.getDate() + offset * 7);
    return [...Array(7)].map((_, i) => { const d = new Date(mon); d.setDate(mon.getDate() + i); return iso(d); });
  }
  function weekRows(exs, dates) {
    const otherNames = [...new Set(exs.filter(r => r.itemId === "other" && dates.includes(r.date)).map(exName))];
    return [
      ...EXS.filter(e => e.id !== "other").map(e => ({ label: e.name, match: r => r.itemId === e.id })),
      ...otherNames.map(n => ({ label: n, match: r => r.itemId === "other" && exName(r) === n }))
    ].map(g => ({ label: g.label, days: dates.map(d => exs.some(r => r.date === d && g.match(r))) }));
  }

  /* ---------- Diari (dikongsi app & fisio) ---------- */
  // st: { diariTab, weekOffset } ; opts: { readOnly }
  function diariHTML(u, recs, st, opts = {}) {
    const tests = recs.filter(r => r.type === "test"), exs = recs.filter(r => r.type === "ex");
    const rows = prePostRows(tests).map(x => `<tr>${x.first ? `<td rowspan="${x.span}"><b>${esc(x.t.name)}</b><br><span class="note">${esc(x.t.sub)}</span></td>` : ""}
      <td class="sub">${esc(x.f.label.replace(/ \(pilihan\)/, ""))} (${esc(x.f.unit)})</td><td>${num(x.a)}</td><td>${num(x.b)}</td><td class="delta ${x.cls}">${x.d}</td></tr>`).join("");
    const preD = latest(tests.filter(r => r.fase === "PRE"))?.date, postD = latest(tests.filter(r => r.fase === "POST"))?.date;

    const hist = [...tests].sort(byDateDesc).map(r => {
      const t = TESTS.find(x => x.id === r.itemId); if (!t) return "";
      return `<tr><td>${fmt(r.date)}</td><td><span class="tag ${r.fase === "POST" ? "post" : ""}">${esc(r.fase)}</span></td><td>${esc(t.name)}</td><td class="wrap">${valuesText(t.fields, r.values)}</td><td class="sub wrap">${esc(r.nota || "")}</td></tr>`;
    }).join("");

    const dates = weekDates(st.weekOffset);
    const wk = weekRows(exs, dates).map(g => `<tr><td><b>${esc(g.label)}</b></td>${g.days.map(on => `<td><span class="tick ${on ? "on" : ""}" role="img" aria-label="${on ? "Dilakukan" : "Tidak"}">${on ? "✓" : ""}</span></td>`).join("")}</tr>`).join("");
    const nActive = activeDays(exs, dates[0], dates[6]);

    const exRows = [...exs].sort(byDateDesc).map(r => {
      const e = EXS.find(x => x.id === r.itemId); if (!e) return "";
      return `<tr><td>${fmt(r.date)}</td><td>${esc(exName(r))}</td><td class="wrap">${valuesText(e.fields.filter(f => f.type !== "text"), r.values) || "—"}</td><td class="sub wrap">${esc(r.nota || "")}</td></tr>`;
    }).join("");

    const tab = st.diariTab;
    return `
      <div class="card profbox"><span class="avatar">${esc(initials(u.nama))}</span><div style="flex:1;min-width:0"><h2>${esc(u.nama)}</h2>
        <span class="note">${esc(u.umur)} tahun · ${u.jantina === "L" ? "Lelaki" : "Perempuan"}${u.kumpulan ? " · " + esc(u.kumpulan) : ""}</span></div></div>
      <div class="diari-actions">
        <div class="tabs" role="group" aria-label="Bahagian diari">
          <button data-act="dtab" data-tab="ujian" aria-pressed="${tab === "ujian"}">Laporan Ujian</button>
          <button data-act="dtab" data-tab="senaman" aria-pressed="${tab === "senaman"}">Rekod Senaman</button>
        </div>
        <button class="btn ghost printbtn" data-act="print">${icon.print} Cetak / Simpan PDF</button>
      </div>
      ${tab === "ujian" ? `
        <div class="sec"><h2>Penilaian Kecergasan · PRE vs POST</h2>
          <p class="note" style="margin:-4px 0 10px">PRE: ${fmt(preD)} · POST: ${fmt(postD)}. Skor terkini bagi setiap fasa. <span class="delta up">Hijau</span> = meningkat, <span class="delta down">merah</span> = menurun.</p>
          <div class="tbl-wrap"><table><thead><tr><th>Ujian</th><th>Ukuran</th><th>PRE</th><th>POST</th><th>Beza</th></tr></thead><tbody>${rows}</tbody></table></div>
        </div>
        <div class="sec"><h2>Sejarah ujian</h2>${hist ? `<div class="tbl-wrap"><table><thead><tr><th>Tarikh</th><th>Fasa</th><th>Ujian</th><th>Skor</th><th>Catatan</th></tr></thead><tbody>${hist}</tbody></table></div>` : `<div class="empty">Belum ada ujian direkod.</div>`}</div>
      ` : `
        <div class="sec"><h2>Rekod Aktiviti Mingguan</h2>
          <div class="week"><button data-act="wk" data-d="-1" aria-label="Minggu sebelum">‹</button><b>${fmt(dates[0])} – ${fmt(dates[6])}<br><span class="note">${nActive}/7 hari aktif</span></b><button data-act="wk" data-d="1" aria-label="Minggu seterusnya" ${st.weekOffset >= 0 ? "disabled" : ""}>›</button></div>
          <div class="tbl-wrap"><table class="wk"><thead><tr><th>Senaman</th>${DAYS.map((d, i) => `<th>${d.slice(0, 3)}<br><span class="dnum">${dates[i].slice(8)}</span></th>`).join("")}</tr></thead><tbody>${wk}</tbody></table></div>
        </div>
        <div class="sec"><h2>Semua log senaman</h2>${exRows ? `<div class="tbl-wrap"><table><thead><tr><th>Tarikh</th><th>Senaman</th><th>Dilakukan</th><th>Nota</th></tr></thead><tbody>${exRows}</tbody></table></div>` : `<div class="empty">Belum ada senaman dilog.</div>`}</div>
      `}
      ${printHTML(u, recs, st)}`;
  }

  /* ---------- Borang cetak A4: "Diari Senaman Fit For Hajj" ---------- */
  function printHTML(u, recs, st) {
    const tests = recs.filter(r => r.type === "test"), exs = recs.filter(r => r.type === "ex");
    const preD = latest(tests.filter(r => r.fase === "PRE"))?.date, postD = latest(tests.filter(r => r.fase === "POST"))?.date;
    const rows = prePostRows(tests).map(x => `<tr>${x.first ? `<td rowspan="${x.span}"><b>${esc(x.t.name)}</b><br><small>Komponen ${x.t.k}</small></td>` : ""}
      <td>${esc(x.f.label.replace(/ \(pilihan\)/, ""))} (${esc(x.f.unit)})</td><td class="c">${num(x.a)}</td><td class="c">${num(x.b)}</td><td class="c"><b>${x.d}</b></td></tr>`).join("");
    const dates = weekDates(st.weekOffset);
    const wk = weekRows(exs, dates).map(g => `<tr><td>${esc(g.label)}</td>${g.days.map(on => `<td class="c">${on ? "✓" : ""}</td>`).join("")}</tr>`).join("");
    const logs = exs.filter(r => r.date >= dates[0] && r.date <= dates[6]).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 14);
    const logRows = logs.map(r => { const e = EXS.find(x => x.id === r.itemId); return `<tr><td>${fmt(r.date)}</td><td>${esc(exName(r))}</td><td>${e ? valuesText(e.fields.filter(f => f.type !== "text"), r.values) : ""}</td><td>${esc(r.nota || "")}</td></tr>`; }).join("");
    return `<section class="print-sheet" aria-hidden="true">
      <header class="ps-head">${icon.kaabah}<div><h1>DIARI SENAMAN FIT FOR HAJJ</h1><p>Komponen Persediaan Kesihatan Fizikal Jemaah Haji</p></div></header>
      <table class="ps-info"><tr><th>Nama</th><td colspan="3">${esc(u.nama)}</td></tr>
        <tr><th>Umur</th><td>${esc(u.umur)} tahun</td><th>Jantina</th><td>${u.jantina === "L" ? "Lelaki" : "Perempuan"}</td></tr>
        <tr><th>No. telefon</th><td>${esc(u.telefon || "")}</td><th>Kod kumpulan</th><td>${esc(u.kumpulan || "")}</td></tr></table>
      <h2>A. Penilaian Kecergasan</h2>
      <table class="ps-t"><thead><tr><th>Ujian</th><th>Ukuran</th><th>PRE<br><small>${fmt(preD)}</small></th><th>POST<br><small>${fmt(postD)}</small></th><th>Beza</th></tr></thead><tbody>${rows}</tbody></table>
      <h2>B. Rekod Aktiviti Mingguan · ${fmt(dates[0])} – ${fmt(dates[6])}</h2>
      <table class="ps-t"><thead><tr><th>Senaman</th>${DAYS.map((d, i) => `<th>${d.slice(0, 3)}<br><small>${dates[i].slice(8)}/${dates[i].slice(5, 7)}</small></th>`).join("")}</tr></thead><tbody>${wk}</tbody></table>
      <h2>C. Log Senaman Minggu Ini</h2>
      ${logRows ? `<table class="ps-t"><thead><tr><th>Tarikh</th><th>Senaman</th><th>Dilakukan</th><th>Nota</th></tr></thead><tbody>${logRows}</tbody></table>` : `<p class="ps-empty">Tiada log senaman untuk minggu ini.</p>`}
      <div class="ps-sign"><div><span>Catatan fisioterapis</span></div><div><span>Tandatangan &amp; cop</span></div><div><span>Tarikh</span></div></div>
      <footer class="ps-foot">Dicetak ${fmt(today())} · FIT FOR HAJJ · Hentikan senaman dan dapatkan rawatan jika sakit dada, sesak nafas teruk, pening atau berdebar-debar.</footer>
    </section>`;
  }

  // Kendalikan klik dalam diari. Pulang true jika diurus.
  function diariClick(a, st, rerender) {
    const act = a.dataset.act;
    if (act === "dtab") { st.diariTab = a.dataset.tab; rerender(); return true; }
    if (act === "wk") { st.weekOffset = Math.min(0, st.weekOffset + Number(a.dataset.d)); rerender(); return true; }
    if (act === "print") { window.print(); return true; }
    return false;
  }

  /* ---------- PIN pad ---------- */
  function pinPadHTML(id) {
    const keys = [1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => `<button type="button" data-k="${n}">${n}</button>`).join("");
    return `<div class="pinpad" id="${id}">
      <div class="pin-dots" aria-live="polite" aria-label="PIN">${"<span></span>".repeat(6)}</div>
      <div class="pin-keys">${keys}<button type="button" data-k="clr" class="fn">Kosong</button><button type="button" data-k="0">0</button><button type="button" data-k="del" class="fn" aria-label="Padam satu digit">⌫</button></div>
      <button type="button" class="pin-show" data-k="show" aria-pressed="false">Tunjuk PIN</button>
    </div>`;
  }
  function PinPad(el, { onComplete, onChange } = {}) {
    let val = "", show = false;
    const dots = el.querySelectorAll(".pin-dots span");
    function paint() {
      dots.forEach((d, i) => { d.classList.toggle("on", i < val.length); d.textContent = show && i < val.length ? val[i] : ""; });
      el.classList.remove("shake");
      onChange && onChange(val);
    }
    function press(k) {
      if (el.classList.contains("busy")) return;
      if (k === "del") val = val.slice(0, -1);
      else if (k === "clr") val = "";
      else if (k === "show") { show = !show; const b = el.querySelector(".pin-show"); b.setAttribute("aria-pressed", show); b.textContent = show ? "Sembunyi PIN" : "Tunjuk PIN"; }
      else if (/^\d$/.test(k) && val.length < 6) val += k;
      paint();
      if (/^\d$/.test(k) && val.length === 6 && onComplete) onComplete(val);
    }
    el.addEventListener("click", e => { const b = e.target.closest("[data-k]"); if (b) press(b.dataset.k); });
    const api = {
      el, press,
      get: () => val,
      clear() { val = ""; paint(); },
      error() { val = ""; paint(); void el.offsetWidth; el.classList.add("shake"); },
      busy(on) { el.classList.toggle("busy", !!on); }
    };
    PinPad.active = api;
    paint();
    return api;
  }
  document.addEventListener("keydown", e => {
    const p = PinPad.active;
    if (!p || !document.body.contains(p.el) || p.el.offsetParent === null) return;
    if (e.target.closest && e.target.closest("input,textarea,select")) return;
    if (/^\d$/.test(e.key)) { p.press(e.key); e.preventDefault(); }
    else if (e.key === "Backspace") { p.press("del"); e.preventDefault(); }
  });

  return { $, esc, pad, iso, today, fmt, initials, addDays, mondayOf, toast, icon, latest, byDateDesc, valuesText, testsDone, activeDays, exName, diariHTML, diariClick, pinPadHTML, PinPad };
})();
