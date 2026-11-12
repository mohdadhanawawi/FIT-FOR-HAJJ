/* FIT FOR HAJJ — log masuk & daftar */
(function () {
  const { $, esc } = UI;
  const app = $("#app");
  const K_PHONE = "ffh_last_phone";

  // Sudah log masuk? terus ke app
  const tok = API.getToken(), me = API.getUser();
  if (tok && me) { location.replace(me.role === "fisio" ? "fisio.html" : "app.html"); return; }

  const params = new URLSearchParams(location.search);
  const st = {
    mode: "login",            // login | reg
    step: 1,                  // daftar: 1 maklumat, 2 cipta PIN, 3 sahkan PIN
    reg: { nama: "", umur: "", jantina: "", telefon: "", kumpulan: "" },
    pin1: "", forgot: false, busy: false, msg: params.get("tamat") ? "Sesi anda telah tamat. Sila log masuk semula." : ""
  };

  const hero = `<div class="hero">
      <svg class="arch" viewBox="0 0 32 32" aria-hidden="true"><rect x="6" y="11" width="20" height="17" fill="currentColor"/><path d="M4 11 16 4l12 7" fill="none" stroke="currentColor" stroke-width="2"/></svg>
      <div class="eyebrow" style="color:var(--gold)">Komponen Persediaan Kesihatan Fizikal</div>
      <h1>FIT FOR <span>HAJJ</span></h1>
      <p>Uji tahap kecergasan, ikut senaman harian, dan pantau kemajuan anda sebelum berangkat ke Tanah Suci.</p>
    </div>`;

  const cfgWarn = () => API.configured() ? "" : `<div class="warn"><span>⚠</span><span><b>Belum disambung:</b> WEB_APP_URL dalam <code>js/config.js</code> belum diisi. Rujuk README untuk langkah setup.</span></div>`;

  function seg() {
    return `<div class="seg" role="group" aria-label="Pilih">
      <button type="button" data-mode="login" aria-pressed="${st.mode === "login"}">Log masuk</button>
      <button type="button" data-mode="reg" aria-pressed="${st.mode === "reg"}">Daftar baharu</button></div>`;
  }

  function vLogin() {
    const phone = API.LS.get(K_PHONE, "");
    return `<div class="card form" id="loginCard">
      ${seg()}
      <div class="field"><label for="lg-tel">No. telefon</label>
        <input type="tel" id="lg-tel" inputmode="numeric" autocomplete="tel" placeholder="Contoh: 0123456789" value="${esc(phone)}"></div>
      <div class="field"><span class="lbl" id="pinlbl">PIN 6 digit</span>${UI.pinPadHTML("pad")}</div>
      <p class="err" id="lg-err" role="alert" ${st.msg ? "" : "hidden"}>${esc(st.msg)}</p>
      <button class="btn block" id="lg-go" type="button">Masuk</button>
      <button class="linkbtn" type="button" data-act="forgot">Lupa PIN?</button>
      <div class="info" ${st.forgot ? "" : "hidden"} id="forgot"><b>Lupa PIN?</b> Hubungi fisio anda untuk set semula PIN. Selepas itu, log masuk dengan PIN baharu yang diberi.</div>
    </div>`;
  }

  function stepper() {
    return `<div class="stepper" aria-label="Langkah ${st.step} daripada 3"><span>Langkah ${st.step}/3</span><i class="on"></i><i class="${st.step >= 2 ? "on" : ""}"></i><i class="${st.step >= 3 ? "on" : ""}"></i></div>`;
  }

  function vReg() {
    const r = st.reg;
    if (st.step === 1) return `<form class="card form" id="regForm" novalidate>
      ${seg()}${stepper()}
      <h2 style="font-size:20px">Maklumat diri</h2>
      <div class="field"><label for="rg-nama">Nama penuh</label><input type="text" id="rg-nama" autocomplete="name" value="${esc(r.nama)}" placeholder="Seperti dalam kad pengenalan"></div>
      <div class="row2">
        <div class="field"><label for="rg-umur">Umur</label><div class="unitwrap"><input type="number" id="rg-umur" inputmode="numeric" min="10" max="110" value="${esc(r.umur)}" placeholder="0"><span class="u">tahun</span></div></div>
        <div class="field"><span class="lbl">Jantina</span><div class="seg" id="rg-j"><button type="button" data-j="L" aria-pressed="${r.jantina === "L"}">Lelaki</button><button type="button" data-j="P" aria-pressed="${r.jantina === "P"}">Perempuan</button></div></div>
      </div>
      <div class="field"><label for="rg-tel">No. telefon</label><input type="tel" id="rg-tel" inputmode="numeric" autocomplete="tel" value="${esc(r.telefon)}" placeholder="Contoh: 0123456789"><span class="hint">Nombor ini digunakan untuk log masuk.</span></div>
      <p class="err" id="rg-err" role="alert" hidden></p>
      <button class="btn block" type="submit">Seterusnya</button>
      ${cfgWarn()}
    </form>`;
    return `<div class="card form">
      ${seg()}${stepper()}
      <button class="back" type="button" data-act="regback">${UI.icon.back} Kembali</button>
      <h2 style="font-size:20px">${st.step === 2 ? "Cipta PIN 6 digit" : "Masukkan PIN sekali lagi"}</h2>
      <p class="note" style="margin:0">${st.step === 2 ? "Pilih 6 nombor yang mudah anda ingat. Jangan kongsi PIN dengan orang lain." : "Untuk pastikan PIN anda betul."}</p>
      ${UI.pinPadHTML("pad")}
      <p class="err" id="rg-err" role="alert" ${st.msg ? "" : "hidden"}>${esc(st.msg)}</p>
      <div id="rg-busy" class="loading" hidden style="padding:8px"><div class="spinner"></div>Sedang mendaftar…</div>
    </div>`;
  }

  function render() {
    app.innerHTML = `<section class="screen">${hero}${st.mode === "login" ? vLogin() : vReg()}${st.mode === "login" ? cfgWarn() : ""}</section>`;
    const padEl = $("#pad");
    if (!padEl) return;
    if (st.mode === "login") {
      const pad = UI.PinPad(padEl, { onComplete: () => doLogin(pad), onChange: () => { $("#lg-err").hidden = true; } });
      $("#lg-go").onclick = () => doLogin(pad);
      const tel = $("#lg-tel");
      if (!tel.value) tel.focus();
    } else {
      const pad = UI.PinPad(padEl, { onComplete: v => regPin(v, pad), onChange: () => { const e = $("#rg-err"); if (e && st.msg) { st.msg = ""; e.hidden = true; } } });
    }
  }

  function showErr(id, msg) { const e = $(id); e.textContent = msg; e.hidden = false; }

  async function doLogin(pad) {
    if (st.busy) return;
    const telefon = $("#lg-tel").value.replace(/\D/g, ""), pin = pad.get();
    if (telefon.length < 9) { showErr("#lg-err", "Sila isi no. telefon yang betul."); $("#lg-tel").focus(); return; }
    if (pin.length !== 6) { showErr("#lg-err", "Sila masukkan PIN 6 digit."); return; }
    st.busy = true; pad.busy(true);
    const btn = $("#lg-go"); btn.disabled = true; btn.innerHTML = `<span class="spinner sm"></span> Sedang log masuk…`;
    try {
      const d = await API.call("login", { telefon, pin });
      API.LS.set(K_PHONE, telefon);
      API.setSession(d.token, d.user, d.sheetUrl);
      location.replace(d.user.role === "fisio" ? "fisio.html" : "app.html");
    } catch (err) {
      st.busy = false; pad.busy(false); pad.error();
      btn.disabled = false; btn.textContent = "Masuk";
      showErr("#lg-err", err.message);
    }
  }

  function regPin(v, pad) {
    if (st.step === 2) {
      if (/^(\d)\1{5}$/.test(v) || ["123456", "654321", "012345", "543210"].includes(v)) {
        st.msg = "PIN terlalu mudah diteka. Sila pilih PIN lain."; pad.error(); showErr("#rg-err", st.msg); return;
      }
      st.pin1 = v; st.step = 3; st.msg = ""; render(); return;
    }
    if (v !== st.pin1) { st.step = 2; st.pin1 = ""; st.msg = "PIN tidak sama. Sila cipta semula."; render(); return; }
    doRegister(v, pad);
  }

  async function doRegister(pin, pad) {
    if (st.busy) return;
    st.busy = true; pad.busy(true); $("#rg-busy").hidden = false;
    try {
      const d = await API.call("register", Object.assign({}, st.reg, { pin }));
      API.LS.set(K_PHONE, st.reg.telefon.replace(/\D/g, ""));
      API.setSession(d.token, d.user, d.sheetUrl);
      location.replace("app.html");
    } catch (err) {
      st.busy = false;
      // ralat maklumat (cth. telefon sudah didaftar) → balik ke langkah 1
      const pinErr = /PIN/.test(err.message);
      st.step = pinErr ? 2 : 1; st.pin1 = "";
      render();
      showErr("#rg-err", err.message);
    }
  }

  app.addEventListener("click", e => {
    const m = e.target.closest("[data-mode]");
    if (m) { st.mode = m.dataset.mode; st.step = 1; st.msg = ""; st.forgot = false; render(); return; }
    const j = e.target.closest("#rg-j button");
    if (j) { st.reg.jantina = j.dataset.j; document.querySelectorAll("#rg-j button").forEach(b => b.setAttribute("aria-pressed", b === j)); return; }
    const a = e.target.closest("[data-act]");
    if (!a) return;
    if (a.dataset.act === "forgot") { st.forgot = !st.forgot; $("#forgot").hidden = !st.forgot; }
    if (a.dataset.act === "regback") { st.step = st.step === 3 ? 2 : 1; st.pin1 = ""; st.msg = ""; render(); }
  });

  app.addEventListener("submit", e => {
    e.preventDefault();
    if (e.target.id !== "regForm") return;
    const r = st.reg;
    r.nama = $("#rg-nama").value.trim().replace(/\s+/g, " ");
    r.umur = $("#rg-umur").value.trim();
    r.telefon = $("#rg-tel").value.trim();
    const tel = r.telefon.replace(/\D/g, "").replace(/^60(?=\d{9,10}$)/, "0");
    const umur = Number(r.umur);
    let msg = "", focus = null;
    if (r.nama.length < 2) { msg = "Sila isi nama penuh anda."; focus = "#rg-nama"; }
    else if (!(umur >= 10 && umur <= 110) || !Number.isInteger(umur)) { msg = "Sila isi umur yang betul."; focus = "#rg-umur"; }
    else if (!r.jantina) msg = "Sila pilih jantina.";
    else if (!/^0\d{8,10}$/.test(tel)) { msg = "No. telefon tidak sah. Contoh: 0123456789"; focus = "#rg-tel"; }
    if (msg) { showErr("#rg-err", msg); if (focus) $(focus).focus(); return; }
    r.telefon = tel;
    st.step = 2; st.msg = ""; render();
  });

  render();
})();
