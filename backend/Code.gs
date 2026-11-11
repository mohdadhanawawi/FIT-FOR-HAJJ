/**
 * FIT FOR HAJJ — Backend API (Google Apps Script)
 * ------------------------------------------------
 * 1. Tampal fail ini ke Extensions → Apps Script (projek terikat pada Google Sheet).
 * 2. Pilih fungsi `setup` → Run (sekali sahaja) → beri kebenaran.
 * 3. Deploy → New deployment → Web app (Execute as: Me, Who has access: Anyone).
 *
 * Semua request: POST, body JSON (Content-Type text/plain), medan `action` + `token`.
 * Semua respons: { ok:true, ... } atau { ok:false, error:"mesej BM", code? }.
 */

/* ===================== KONFIGURASI ===================== */
var TZ = 'Asia/Kuala_Lumpur';
var SESSION_DAYS = 30;
var MAX_FAIL = 5;          // cubaan PIN salah sebelum dikunci
var LOCK_MIN = 15;         // minit dikunci
var MSG_AUTH = 'Sesi tamat. Sila log masuk semula.';

var SHEET_DEF = {
  USERS: ['userId', 'nama', 'umur', 'jantina', 'telefon', 'kumpulan', 'role', 'pinHash', 'salt', 'createdAt'],
  RECORDS: ['recordId', 'userId', 'nama', 'kumpulan', 'type', 'itemId', 'itemName', 'fase', 'date',
    'skor', 'jarak', 'hrPre', 'hrPeak', 'kanan', 'kiri', 'pushup', 'bilangan', 'ulangan', 'sesi', 'set',
    'minit', 'langkah', 'namaSenaman', 'nota', 'createdAt', 'updatedAt', 'deleted'],
  SESSIONS: ['token', 'userId', 'expiresAt']
};

// Kolum yang mesti kekal teks (supaya Sheets tak tukar tarikh / buang sifar depan no. telefon)
var TEXT_COLS = {
  USERS: ['userId', 'nama', 'jantina', 'telefon', 'kumpulan', 'role', 'pinHash', 'salt', 'createdAt'],
  RECORDS: ['recordId', 'userId', 'nama', 'kumpulan', 'type', 'itemId', 'itemName', 'fase', 'date',
    'namaSenaman', 'nota', 'createdAt', 'updatedAt'],
  SESSIONS: ['token', 'userId', 'expiresAt']
};

var VALUE_KEYS = ['skor', 'jarak', 'hrPre', 'hrPeak', 'kanan', 'kiri', 'pushup', 'bilangan', 'ulangan',
  'sesi', 'set', 'minit', 'langkah'];

// Katalog ujian & senaman. f: { key: [label, unit, wajib(1/0), max] }
var ITEMS = {
  test: {
    sitreach: { name: 'Sit and Reach', f: { skor: ['Skor', 'cm', 1, 100] } },
    '6mwt': { name: '6-Minute Walk Test', f: {
      jarak: ['Jarak', 'm', 1, 3000], hrPre: ['HR sebelum', 'bpm', 1, 250], hrPeak: ['Peak HR', 'bpm', 1, 250] } },
    armcurl: { name: '30-Second Arm Curl', f: {
      kanan: ['Kanan', 'kali', 1, 100], kiri: ['Kiri', 'kali', 1, 100], pushup: ['1-Minute Push-Up', 'kali', 0, 200] } },
    chairstand: { name: '30-Second Chair Stand', f: { bilangan: ['Bilangan', 'kali', 1, 100] } },
    olstand: { name: 'One-Leg Stand', f: { kanan: ['Kaki kanan', 'saat', 1, 600], kiri: ['Kaki kiri', 'saat', 1, 600] } }
  },
  ex: {
    sitreach: { name: 'Sit and Reach', f: { ulangan: ['Ulangan', 'kali', 1, 1000], sesi: ['Sesi hari ini', 'kali', 1, 100] } },
    walking: { name: 'Berjalan', f: { minit: ['Tempoh', 'minit', 1, 1440], langkah: ['Langkah', 'langkah', 0, 200000] } },
    armcurl: { name: 'Arm curl', f: { set: ['Set', 'set', 1, 100], ulangan: ['Ulangan setiap set', 'kali', 1, 1000] } },
    sittostand: { name: 'Sit to stand', f: { set: ['Set', 'set', 1, 100], ulangan: ['Ulangan setiap set', 'kali', 1, 1000] } },
    crabwalk: { name: 'Crab walk', f: { set: ['Set', 'set', 1, 100] } },
    other: { name: 'Lain-lain', f: { namaSenaman: ['Nama senaman', 'text', 1, 80], minit: ['Tempoh', 'minit', 0, 1440] } }
  }
};
var TEST_IDS = Object.keys(ITEMS.test);
var WEAK_PINS = ['000000', '111111', '222222', '333333', '444444', '555555', '666666', '777777', '888888',
  '999999', '123456', '654321', '012345', '543210'];

/* ===================== SETUP (run sekali) ===================== */
function setup() {
  var ss = SpreadsheetApp.getActive();
  ss.setSpreadsheetTimeZone(TZ);
  Object.keys(SHEET_DEF).forEach(function (name) {
    var sh = ss.getSheetByName(name) || ss.insertSheet(name);
    var lastCol = sh.getLastColumn();
    var have = lastCol ? sh.getRange(1, 1, 1, lastCol).getValues()[0].map(String) : [];
    if (!have.some(function (h) { return h; })) have = [];
    SHEET_DEF[name].forEach(function (h) { if (have.indexOf(h) < 0) have.push(h); });
    if (sh.getMaxColumns() < have.length) sh.insertColumnsAfter(sh.getMaxColumns(), have.length - sh.getMaxColumns());
    sh.getRange(1, 1, 1, have.length).setValues([have])
      .setFontWeight('bold').setBackground('#13294B').setFontColor('#FFFFFF');
    sh.setFrozenRows(1);
    if (sh.getMaxRows() > 1) applyTextFormat_(sh, name, have, 2, sh.getMaxRows() - 1);
  });

  // Dropdown role: jemaah / fisio
  var u = ss.getSheetByName('USERS');
  var rc = headers_(u).indexOf('role') + 1;
  if (rc > 0 && u.getMaxRows() > 1) {
    u.getRange(2, rc, u.getMaxRows() - 1, 1).setDataValidation(
      SpreadsheetApp.newDataValidation().requireValueInList(['jemaah', 'fisio'], true).setAllowInvalid(false).build());
  }

  // Buang tab kosong lalai
  ['Sheet1', 'Helaian1'].forEach(function (n) {
    var s = ss.getSheetByName(n);
    if (s && s.getLastRow() === 0 && ss.getSheets().length > 1) ss.deleteSheet(s);
  });

  pepper_();
  Logger.log('Setup selesai. Tab USERS, RECORDS dan SESSIONS sedia. Sekarang Deploy → New deployment → Web app.');
}

/* ===================== ENTRY POINT ===================== */
function doGet() {
  return out_({ ok: true, app: 'FIT FOR HAJJ API', time: nowIso_() });
}

function doPost(e) {
  var res;
  try {
    var req = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    var fn = ACTIONS[req.action];
    if (!fn) fail_('Tindakan tidak sah.');
    res = fn(req);
  } catch (err) {
    if (err && err.isApp) res = { ok: false, error: err.message, code: err.code || null };
    else {
      console.error(err && err.stack ? err.stack : err);
      res = { ok: false, error: 'Ralat pelayan. Sila cuba lagi sebentar.', code: 'SERVER' };
    }
  }
  return out_(res);
}

var ACTIONS = {
  register: register_, login: login_, logout: logout_, getMe: getMe_,
  listRecords: listRecords_, addRecord: addRecord_, updateRecord: updateRecord_, deleteRecord: deleteRecord_,
  listUsers: listUsers_, getUserRecords: getUserRecords_, groupSummary: groupSummary_, resetPin: resetPin_
};

/* ===================== AUTH ===================== */
function register_(req) {
  var nama = cleanName_(req.nama);
  var umur = Number(req.umur);
  var jantina = String(req.jantina || '').toUpperCase();
  var telefon = normPhone_(req.telefon);
  var kumpulan = normKumpulan_(req.kumpulan);
  var pin = String(req.pin || '');
  if (!nama) fail_('Sila isi nama penuh anda.');
  if (!(umur >= 10 && umur <= 110) || Math.floor(umur) !== umur) fail_('Umur tidak sah.');
  if (jantina !== 'L' && jantina !== 'P') fail_('Sila pilih jantina.');
  if (!telefon) fail_('No. telefon tidak sah. Contoh: 0123456789');
  checkPin_(pin);

  return withLock_(function () {
    if (findUserByPhone_(telefon)) fail_('No. telefon ini sudah didaftarkan. Sila log masuk.');
    var salt = uuid_();
    var user = {
      userId: 'U' + uuid_().slice(0, 12), nama: nama, umur: umur, jantina: jantina, telefon: telefon,
      kumpulan: kumpulan, role: 'jemaah', pinHash: hashPin_(pin, salt), salt: salt, createdAt: nowIso_()
    };
    appendObj_('USERS', user);
    return { ok: true, token: createSession_(user.userId), user: publicUser_(user) };
  });
}

function login_(req) {
  var telefon = normPhone_(req.telefon);
  var pin = String(req.pin || '');
  if (!telefon) fail_('No. telefon tidak sah.');
  if (!/^\d{6}$/.test(pin)) fail_('PIN mesti 6 digit.');
  var cache = CacheService.getScriptCache();
  var fk = 'fail_' + telefon;
  var fails = Number(cache.get(fk) || 0);
  if (fails >= MAX_FAIL) fail_('Terlalu banyak cubaan salah. Cuba lagi selepas ' + LOCK_MIN + ' minit, atau hubungi fisio anda.');

  var u = findUserByPhone_(telefon);
  if (!u) fail_('No. telefon ini belum didaftarkan. Sila tekan "Daftar".');
  if (hashPin_(pin, String(u.salt)) !== String(u.pinHash)) {
    cache.put(fk, String(fails + 1), LOCK_MIN * 60);
    var left = MAX_FAIL - fails - 1;
    fail_('PIN salah.' + (left > 0 ? ' Baki cubaan: ' + left + '.' : ' Akaun dikunci ' + LOCK_MIN + ' minit.'));
  }
  cache.remove(fk);
  var token = withLock_(function () {
    if (Math.random() < 0.1) purgeSessions_();
    return createSession_(String(u.userId));
  });
  return { ok: true, token: token, user: publicUser_(u), sheetUrl: isFisio_(u) ? SpreadsheetApp.getActive().getUrl() : null };
}

function logout_(req) {
  var t = String(req.token || '');
  if (!/^[a-f0-9]{64}$/.test(t)) return { ok: true };
  withLock_(function () {
    var row = findRow_('SESSIONS', 'token', t);
    if (row) sheet_('SESSIONS').deleteRow(row);
  });
  CacheService.getScriptCache().remove('s_' + t);
  return { ok: true };
}

function getMe_(req) {
  var u = auth_(req);
  return { ok: true, user: publicUser_(u), sheetUrl: isFisio_(u) ? SpreadsheetApp.getActive().getUrl() : null };
}

/* ===================== REKOD JEMAAH ===================== */
function listRecords_(req) {
  var u = auth_(req);
  var recs = readAll_('RECORDS').rows
    .filter(function (r) { return String(r.userId) === String(u.userId) && !isDeleted_(r); })
    .map(recOut_);
  return { ok: true, user: publicUser_(u), records: recs };
}

function addRecord_(req) {
  var u = auth_(req);
  var input = req.record || {};
  var v = validateRecord_(input);
  var id = String(input.recordId || '');
  if (!/^[A-Za-z0-9_-]{8,40}$/.test(id)) id = 'R' + uuid_().slice(0, 16);
  return withLock_(function () {
    var row = findRow_('RECORDS', 'recordId', id);
    if (row) { // idempotent: rekod sama dihantar semula dari offline queue
      var ex = readRow_('RECORDS', row);
      if (String(ex.userId) !== String(u.userId)) fail_('ID rekod bertindih. Sila cuba lagi.');
      return { ok: true, record: recOut_(ex), duplicate: true };
    }
    var now = nowIso_();
    var obj = recRow_(u, v, id, now, now);
    appendObj_('RECORDS', obj);
    return { ok: true, record: recOut_(obj) };
  });
}

function updateRecord_(req) {
  var u = auth_(req);
  var id = String(req.recordId || '');
  if (!id) fail_('ID rekod tiada.');
  return withLock_(function () {
    var row = findRow_('RECORDS', 'recordId', id);
    if (!row) fail_('Rekod tidak dijumpai.');
    var ex = readRow_('RECORDS', row);
    if (String(ex.userId) !== String(u.userId)) fail_('Anda tidak boleh mengubah rekod ini.');
    if (isDeleted_(ex)) fail_('Rekod ini telah dipadam.');
    var input = req.record || {};
    var v = validateRecord_({ type: ex.type, itemId: ex.itemId, fase: input.fase, date: input.date, values: input.values, nota: input.nota });
    var obj = recRow_(u, v, id, str_(ex.createdAt), nowIso_());
    writeObj_('RECORDS', row, obj);
    return { ok: true, record: recOut_(obj) };
  });
}

function deleteRecord_(req) {
  var u = auth_(req);
  var id = String(req.recordId || '');
  if (!id) fail_('ID rekod tiada.');
  return withLock_(function () {
    var row = findRow_('RECORDS', 'recordId', id);
    if (!row) return { ok: true }; // tiada di pelayan = anggap sudah dipadam
    var ex = readRow_('RECORDS', row);
    if (String(ex.userId) !== String(u.userId)) fail_('Anda tidak boleh memadam rekod ini.');
    var sh = sheet_('RECORDS'), h = headers_(sh);
    sh.getRange(row, h.indexOf('deleted') + 1).setValue(true);
    sh.getRange(row, h.indexOf('updatedAt') + 1).setValue(nowIso_());
    return { ok: true };
  });
}

/* ===================== FISIO ===================== */
function listUsers_(req) {
  requireFisio_(req);
  var users = readAll_('USERS').rows.filter(function (u) { return !isFisio_(u) && String(u.userId); });
  var byUser = recordsByUser_();
  var today = todayStr_(), from = addDays_(today, -6);
  var groups = {};
  var out = users.map(function (u) {
    var rs = byUser[String(u.userId)] || [];
    var k = String(u.kumpulan || '').trim();
    if (k) groups[k] = 1;
    var last = rs.reduce(function (m, r) { return r.date > m ? r.date : m; }, '');
    return Object.assign(publicUser_(u), {
      createdAt: str_(u.createdAt),
      pre: countFase_(rs, 'PRE'), post: countFase_(rs, 'POST'), testTotal: TEST_IDS.length,
      active7: activeDays_(rs, from, today),
      nLogs: rs.filter(function (r) { return r.type === 'ex'; }).length,
      lastLog: last
    });
  }).sort(function (a, b) { return a.nama.localeCompare(b.nama); });
  return { ok: true, users: out, kumpulan: Object.keys(groups).sort(), today: today };
}

function getUserRecords_(req) {
  requireFisio_(req);
  var id = String(req.userId || '');
  var u = findUserById_(id);
  if (!u) fail_('Jemaah tidak dijumpai.');
  var recs = (recordsByUser_()[id] || []);
  return { ok: true, user: publicUser_(u), records: recs };
}

function groupSummary_(req) {
  requireFisio_(req);
  var k = normKumpulan_(req.kumpulan || '', true);
  var users = readAll_('USERS').rows.filter(function (u) {
    return !isFisio_(u) && (!k || String(u.kumpulan || '').toUpperCase() === k);
  });
  var byUser = recordsByUser_();
  var today = todayStr_(), from = addDays_(today, -6);
  var rows = [];
  TEST_IDS.forEach(function (tid) {
    var item = ITEMS.test[tid];
    Object.keys(item.f).forEach(function (key) {
      var pre = [], post = [], diff = [];
      users.forEach(function (u) {
        var rs = (byUser[String(u.userId)] || []).filter(function (r) { return r.type === 'test' && r.itemId === tid; });
        var a = latestVal_(rs, 'PRE', key), b = latestVal_(rs, 'POST', key);
        if (a != null) pre.push(a);
        if (b != null) post.push(b);
        if (a != null && b != null) diff.push(b - a);
      });
      rows.push({
        testId: tid, testName: item.name, key: key, label: item.f[key][0], unit: item.f[key][1],
        better: /^hr/.test(key) ? 'neutral' : 'up',
        preAvg: avg_(pre), preN: pre.length, postAvg: avg_(post), postN: post.length,
        diffAvg: avg_(diff), pairN: diff.length
      });
    });
  });
  var active3 = 0, preDone = 0, postDone = 0;
  users.forEach(function (u) {
    var rs = byUser[String(u.userId)] || [];
    if (activeDays_(rs, from, today) >= 3) active3++;
    if (countFase_(rs, 'PRE') === TEST_IDS.length) preDone++;
    if (countFase_(rs, 'POST') === TEST_IDS.length) postDone++;
  });
  return {
    ok: true, kumpulan: k, rows: rows, total: users.length, active3: active3,
    pctActive3: users.length ? Math.round(active3 / users.length * 100) : 0,
    preDone: preDone, postDone: postDone, from: from, today: today
  };
}

function resetPin_(req) {
  requireFisio_(req);
  var id = String(req.userId || '');
  var pin = String(req.pin || '');
  checkPin_(pin);
  return withLock_(function () {
    var row = findRow_('USERS', 'userId', id);
    if (!row) fail_('Jemaah tidak dijumpai.');
    var sh = sheet_('USERS'), h = headers_(sh);
    var salt = uuid_();
    sh.getRange(row, h.indexOf('pinHash') + 1).setValue(hashPin_(pin, salt));
    sh.getRange(row, h.indexOf('salt') + 1).setValue(salt);
    // Tamatkan semua sesi jemaah ini
    var s = readAll_('SESSIONS');
    var cache = CacheService.getScriptCache();
    for (var i = s.rows.length - 1; i >= 0; i--) {
      if (String(s.rows[i].userId) === id) {
        cache.remove('s_' + String(s.rows[i].token));
        s.sh.deleteRow(s.rows[i]._row);
      }
    }
    var u = readRow_('USERS', row);
    CacheService.getScriptCache().remove('fail_' + phoneStr_(u.telefon));
    return { ok: true, nama: String(u.nama) };
  });
}

/* ===================== VALIDASI ===================== */
function validateRecord_(r) {
  var type = String(r.type || '');
  if (type !== 'test' && type !== 'ex') fail_('Jenis rekod tidak sah.');
  var itemId = String(r.itemId || '');
  var item = ITEMS[type][itemId];
  if (!item) fail_('Ujian / senaman tidak dikenali.');
  var fase = '';
  if (type === 'test') {
    fase = String(r.fase || '').toUpperCase();
    if (fase !== 'PRE' && fase !== 'POST') fail_('Sila pilih fasa PRE atau POST.');
  }
  var date = String(r.date || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || isNaN(new Date(date + 'T00:00:00Z').getTime()) ||
      new Date(date + 'T00:00:00Z').toISOString().slice(0, 10) !== date) fail_('Format tarikh tidak sah.');
  if (date < '2020-01-01' || date > addDays_(todayStr_(), 1)) fail_('Tarikh tidak boleh pada masa hadapan.');

  var input = r.values || {};
  var values = {};
  Object.keys(item.f).forEach(function (key) {
    var spec = item.f[key];
    var raw = input[key];
    var blank = raw === undefined || raw === null || String(raw).trim() === '';
    if (blank) { if (spec[2]) fail_('Sila isi ' + spec[0] + '.'); return; }
    if (spec[1] === 'text') {
      var s = String(raw).trim().replace(/\s+/g, ' ');
      if (s.length > spec[3]) fail_(spec[0] + ' terlalu panjang.');
      values[key] = s;
      return;
    }
    var n = Number(raw);
    if (!isFinite(n) || n < 0) fail_(spec[0] + ' mesti nombor 0 atau lebih.');
    if (n > spec[3]) fail_(spec[0] + ' terlalu besar (maksimum ' + spec[3] + ' ' + spec[1] + ').');
    values[key] = Math.round(n * 10) / 10;
  });
  var nota = String(r.nota || '').trim();
  if (nota.length > 500) fail_('Catatan terlalu panjang (maksimum 500 aksara).');
  return { type: type, itemId: itemId, itemName: item.name, fase: fase, date: date, values: values, nota: nota };
}

function checkPin_(pin) {
  if (!/^\d{6}$/.test(pin)) fail_('PIN mesti 6 digit nombor.');
  if (WEAK_PINS.indexOf(pin) >= 0) fail_('PIN terlalu mudah diteka. Sila pilih PIN lain.');
}

function cleanName_(s) {
  s = String(s || '').trim().replace(/\s+/g, ' ');
  return s.length >= 2 && s.length <= 80 ? s : '';
}

function normPhone_(x) {
  var s = String(x || '').replace(/\D/g, '');
  if (s.indexOf('60') === 0 && s.length >= 11) s = '0' + s.slice(2);
  return /^0\d{8,10}$/.test(s) ? s : '';
}

function normKumpulan_(x, lenient) {
  var k = String(x || '').trim().toUpperCase().replace(/\s+/g, '-');
  if (k && !/^[A-Z0-9][A-Z0-9-]{1,29}$/.test(k)) {
    if (lenient) return '';
    fail_('Kod kumpulan tidak sah. Contoh: HTA-2027-A');
  }
  return k;
}

/* ===================== SESI ===================== */
function createSession_(userId) {
  var token = uuid_() + uuid_();
  var exp = new Date(Date.now() + SESSION_DAYS * 864e5).toISOString();
  appendObj_('SESSIONS', { token: token, userId: userId, expiresAt: exp });
  CacheService.getScriptCache().put('s_' + token, JSON.stringify({ userId: userId, exp: exp }), 21600);
  return token;
}

function auth_(req) {
  var t = String(req.token || '');
  if (!/^[a-f0-9]{64}$/.test(t)) fail_(MSG_AUTH, 'AUTH');
  var cache = CacheService.getScriptCache();
  var s = null, c = cache.get('s_' + t);
  if (c) s = JSON.parse(c);
  else {
    var row = findRow_('SESSIONS', 'token', t);
    if (row) {
      var r = readRow_('SESSIONS', row);
      s = { userId: String(r.userId), exp: str_(r.expiresAt) };
      cache.put('s_' + t, JSON.stringify(s), 21600);
    }
  }
  if (!s || new Date(s.exp).getTime() < Date.now()) fail_(MSG_AUTH, 'AUTH');
  var u = findUserById_(s.userId);
  if (!u) fail_(MSG_AUTH, 'AUTH');
  return u;
}

function requireFisio_(req) {
  var u = auth_(req);
  if (!isFisio_(u)) fail_('Akses untuk fisio sahaja.', 'FORBIDDEN');
  return u;
}

function purgeSessions_() {
  var s = readAll_('SESSIONS');
  var now = Date.now();
  var keep = s.rows.filter(function (r) { return new Date(str_(r.expiresAt)).getTime() > now; });
  if (keep.length === s.rows.length) return;
  s.sh.getRange(2, 1, s.rows.length, s.h.length).clearContent();
  if (keep.length) s.sh.getRange(2, 1, keep.length, s.h.length)
    .setValues(keep.map(function (r) { return s.h.map(function (k) { return cell_(r[k]); }); }));
}

function hashPin_(pin, salt) {
  var bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, pepper_() + ':' + salt + ':' + pin, Utilities.Charset.UTF_8);
  return bytes.map(function (b) { return ('0' + (b & 0xff).toString(16)).slice(-2); }).join('');
}

function pepper_() {
  var p = PropertiesService.getScriptProperties();
  var v = p.getProperty('PEPPER');
  if (!v) { v = uuid_() + uuid_(); p.setProperty('PEPPER', v); }
  return v;
}

/* ===================== HELPER SHEET ===================== */
var HCACHE_ = {};
function sheet_(name) {
  var sh = SpreadsheetApp.getActive().getSheetByName(name);
  if (!sh) fail_('Tab ' + name + ' tiada dalam Google Sheet. Sila run setup() dahulu.');
  return sh;
}
function headers_(sh) {
  var n = sh.getName();
  if (!HCACHE_[n]) HCACHE_[n] = sh.getRange(1, 1, 1, Math.max(1, sh.getLastColumn())).getValues()[0].map(String);
  return HCACHE_[n];
}
function readAll_(name) {
  var sh = sheet_(name), h = headers_(sh), last = sh.getLastRow();
  if (last < 2) return { sh: sh, h: h, rows: [] };
  var vals = sh.getRange(2, 1, last - 1, h.length).getValues();
  return {
    sh: sh, h: h, rows: vals.map(function (r, i) {
      var o = { _row: i + 2 };
      h.forEach(function (k, j) { o[k] = r[j]; });
      return o;
    })
  };
}
function readRow_(name, row) {
  var sh = sheet_(name), h = headers_(sh);
  var vals = sh.getRange(row, 1, 1, h.length).getValues()[0];
  var o = { _row: row };
  h.forEach(function (k, j) { o[k] = vals[j]; });
  return o;
}
function findRow_(name, col, value) {
  var sh = sheet_(name), h = headers_(sh), ci = h.indexOf(col) + 1, last = sh.getLastRow();
  if (ci < 1 || last < 2 || !value) return 0;
  var c = sh.getRange(2, ci, last - 1, 1).createTextFinder(String(value)).matchEntireCell(true).findNext();
  return c ? c.getRow() : 0;
}
function appendObj_(name, obj) {
  var sh = sheet_(name), h = headers_(sh), row = sh.getLastRow() + 1;
  if (row > sh.getMaxRows()) {
    var start = sh.getMaxRows() + 1;
    sh.insertRowsAfter(sh.getMaxRows(), 500);
    applyTextFormat_(sh, name, h, start, 500);
  }
  writeObj_(name, row, obj);
  return row;
}
function writeObj_(name, row, obj) {
  var sh = sheet_(name), h = headers_(sh);
  sh.getRange(row, 1, 1, h.length).setValues([h.map(function (k) { return cell_(obj[k]); })]);
}
function applyTextFormat_(sh, name, h, startRow, count) {
  h.forEach(function (col, i) {
    if (TEXT_COLS[name].indexOf(col) >= 0) sh.getRange(startRow, i + 1, count, 1).setNumberFormat('@');
  });
}
function cell_(v) {
  if (v === undefined || v === null) return '';
  if (typeof v === 'string' && /^[=+\-@]/.test(v)) return ' ' + v; // elak formula injection
  return v;
}
function withLock_(fn) {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) fail_('Pelayan sibuk. Sila cuba lagi sebentar.');
  try {
    var r = fn();
    SpreadsheetApp.flush();
    return r;
  } finally {
    lock.releaseLock();
  }
}

/* ===================== HELPER DATA ===================== */
function findUserByPhone_(tel) {
  var rows = readAll_('USERS').rows;
  for (var i = 0; i < rows.length; i++) if (phoneStr_(rows[i].telefon) === tel) return rows[i];
  return null;
}
function findUserById_(id) {
  if (!id) return null;
  var row = findRow_('USERS', 'userId', id);
  return row ? readRow_('USERS', row) : null;
}
function recordsByUser_() {
  var m = {};
  readAll_('RECORDS').rows.forEach(function (r) {
    if (isDeleted_(r)) return;
    var id = String(r.userId);
    (m[id] = m[id] || []).push(recOut_(r));
  });
  return m;
}
function publicUser_(u) {
  return {
    userId: String(u.userId), nama: String(u.nama).trim(), umur: Number(u.umur) || 0,
    jantina: String(u.jantina), telefon: phoneStr_(u.telefon), kumpulan: String(u.kumpulan || '').trim(),
    role: isFisio_(u) ? 'fisio' : 'jemaah'
  };
}
function isFisio_(u) { return String(u.role || '').trim().toLowerCase() === 'fisio'; }
function isDeleted_(r) { return r.deleted === true || String(r.deleted).toUpperCase() === 'TRUE'; }

function recRow_(u, v, id, createdAt, updatedAt) {
  var o = {
    recordId: id, userId: String(u.userId), nama: String(u.nama).trim(), kumpulan: String(u.kumpulan || '').trim(),
    type: v.type, itemId: v.itemId, itemName: v.itemName, fase: v.fase, date: v.date,
    nota: v.nota, createdAt: createdAt, updatedAt: updatedAt, deleted: false
  };
  VALUE_KEYS.concat(['namaSenaman']).forEach(function (k) { o[k] = v.values[k] === undefined ? '' : v.values[k]; });
  return o;
}
function recOut_(r) {
  var values = {};
  VALUE_KEYS.forEach(function (k) {
    var x = r[k];
    if (x !== '' && x !== null && x !== undefined && isFinite(Number(x))) values[k] = Number(x);
  });
  var ns = String(r.namaSenaman || '').trim();
  if (ns) values.namaSenaman = ns;
  return {
    recordId: String(r.recordId), type: String(r.type), itemId: String(r.itemId), fase: String(r.fase || ''),
    date: dateStr_(r.date), values: values, nota: String(r.nota || '').trim(),
    createdAt: str_(r.createdAt), updatedAt: str_(r.updatedAt)
  };
}
function countFase_(rs, fase) {
  var s = {};
  rs.forEach(function (r) { if (r.type === 'test' && r.fase === fase) s[r.itemId] = 1; });
  return TEST_IDS.filter(function (t) { return s[t]; }).length;
}
function activeDays_(rs, from, to) {
  var s = {};
  rs.forEach(function (r) { if (r.type === 'ex' && r.date >= from && r.date <= to) s[r.date] = 1; });
  return Object.keys(s).length;
}
function latestVal_(rs, fase, key) {
  var list = rs.filter(function (r) { return r.fase === fase; }).sort(function (a, b) {
    return b.date.localeCompare(a.date) || String(b.updatedAt).localeCompare(String(a.updatedAt));
  });
  if (!list.length) return null;
  var v = list[0].values[key];
  return v === undefined ? null : v;
}
function avg_(arr) {
  if (!arr.length) return null;
  return Math.round(arr.reduce(function (a, b) { return a + b; }, 0) / arr.length * 10) / 10;
}

/* ===================== UTIL ===================== */
function fail_(msg, code) { var e = new Error(msg); e.isApp = true; e.code = code || null; throw e; }
function out_(obj) { return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON); }
function uuid_() { return Utilities.getUuid().replace(/-/g, ''); }
function nowIso_() { return new Date().toISOString(); }
function todayStr_() { return Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd'); }
function addDays_(s, n) { var d = new Date(s + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
function str_(v) { return v instanceof Date ? v.toISOString() : String(v == null ? '' : v); }
function dateStr_(v) { return v instanceof Date ? Utilities.formatDate(v, TZ, 'yyyy-MM-dd') : String(v || '').trim(); }
function phoneStr_(v) {
  if (typeof v === 'number') return '0' + String(v); // jika Sheets buang sifar depan
  return String(v || '').trim();
}
