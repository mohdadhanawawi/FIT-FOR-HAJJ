# FIT FOR HAJJ

Webapp persediaan fizikal jemaah haji: jemaah buat **ujian kecergasan** (PRE / POST), **log senaman harian** dan tengok **diari kemajuan**. Fisio pula pantau semua jemaah dari **dashboard fisio**.

- **Database:** Google Sheet (3 tab: `USERS`, `RECORDS`, `SESSIONS`)
- **API:** Google Apps Script Web App (`backend/Code.gs`)
- **Frontend:** fail statik (HTML + CSS + JS biasa). Tiada build, tiada npm. Drag-and-drop terus ke Netlify.

```
fit-for-hajj/
  frontend/
    index.html      Log masuk / daftar (PIN pad besar)
    app.html        App jemaah: Utama, Ujian, Senaman, Diari
    fisio.html      Dashboard fisio
    css/style.css
    js/config.js    ← URL Web App (anda isi)
    js/api.js       Panggilan API + cache + offline queue
    js/data.js      Senarai ujian & senaman (prosedur, medan, preskripsi)
    js/ui.js        Fungsi dikongsi (diari, borang cetak, PIN pad)
    js/login.js     Logik log masuk / daftar
    js/app.js       Logik app jemaah
    js/fisio.js     Logik dashboard fisio
  backend/
    Code.gs         API + setup() automatik
```

---

## Setup step-by-step (±20 minit)

Anda perlu: akaun Google, dan akaun Netlify percuma (boleh daftar guna akaun Google).

### Langkah 1: Cipta Google Sheet
1. Buka **https://sheets.new** (Google Sheet kosong baharu akan dibuka).
2. Tukar nama fail (kiri atas), contoh: `FIT FOR HAJJ - Data`.

### Langkah 2: Tampal kod Apps Script
1. Dalam Google Sheet tadi, klik menu **Extensions → Apps Script**.
2. Tab baharu akan dibuka dengan fail `Code.gs` yang berisi `function myFunction() {}`. **Padam semua** isi fail itu.
3. Buka fail `backend/Code.gs` dari folder ini (guna Notepad), **Select All (Ctrl+A) → Copy (Ctrl+C)**.
4. Tampal (**Ctrl+V**) dalam editor Apps Script, kemudian klik ikon **💾 Save** (atau Ctrl+S).
5. (Disyorkan) Klik ikon **⚙ Project Settings** di kiri. Pada **Time zone**, pilih **(GMT+08:00) Kuala Lumpur**.

### Langkah 3: Run `setup()` sekali
1. Kembali ke editor (ikon **< >** di kiri).
2. Di bar atas, pada dropdown fungsi, pilih **`setup`**, kemudian klik **▶ Run**.
3. Akan keluar tetingkap **Authorization required**. Klik **Review permissions**, kemudian pilih akaun Google anda.
4. Jika keluar "Google hasn't verified this app", klik **Advanced → Go to (nama projek) (unsafe)**. Ini normal sebab skrip ini milik anda sendiri.
5. Klik **Allow**.
6. Tunggu sehingga **Execution log** papar `Setup selesai`.
7. Buka semula Google Sheet. Anda akan nampak 3 tab: **USERS**, **RECORDS**, **SESSIONS**, siap dengan header.

### Langkah 4: Deploy sebagai Web App
1. Dalam editor Apps Script, klik butang biru **Deploy → New deployment**.
2. Klik ikon ⚙ sebelah "Select type", kemudian pilih **Web app**.
3. Isi:
   - **Description:** `v1`
   - **Execute as:** **Me**
   - **Who has access:** **Anyone**
4. Klik **Deploy** (beri kebenaran sekali lagi jika diminta).
5. **Salin Web app URL** (bermula `https://script.google.com/macros/s/.../exec`).
6. Uji: tampal URL itu dalam browser. Anda patut nampak `{"ok":true,"app":"FIT FOR HAJJ API",...}`.

### Langkah 5: Masukkan URL ke `config.js`
1. Buka `frontend/js/config.js` dengan Notepad.
2. Gantikan `TAMPAL_URL_WEB_APP_DI_SINI` dengan URL tadi. Kekalkan tanda petik:
   ```js
   WEB_APP_URL: "https://script.google.com/macros/s/AKfycb.../exec"
   ```
3. Save.

### Langkah 6: Upload ke Netlify (drag-and-drop)
1. Log masuk ke **https://app.netlify.com**.
2. Pergi ke **Sites**. Di bahagian bawah ada kotak "Drag and drop your site output folder here" (atau buka **https://app.netlify.com/drop**).
3. **Drag folder `frontend`** (folder itu sahaja, bukan folder induk) dan lepaskan dalam kotak tersebut.
4. Tunggu beberapa saat. Netlify akan beri URL, contoh `https://nama-rawak.netlify.app`.
5. (Pilihan) **Site configuration → Change site name** untuk tukar kepada nama yang mudah, contoh `fitforhajj-hta`.

> Bila anda ubah fail frontend (contoh `config.js`), buka site di Netlify, pergi ke **Deploys**, kemudian drag folder `frontend` sekali lagi ke kotak "Need to update your site? Drag and drop…".

### Langkah 7: Cipta akaun fisio
1. Buka URL Netlify anda, klik **Daftar baharu**, dan daftar macam jemaah biasa (guna nombor telefon anda sendiri).
2. Buka Google Sheet, kemudian tab **USERS**. Cari baris anda dan tukar kolum **role** dari `jemaah` kepada **`fisio`**.
3. Log keluar dari app, kemudian log masuk semula. Anda akan terus dibawa ke **Dashboard Fisio**.

Ulang untuk setiap fisio.

### Langkah 8: Beri kod kumpulan kepada jemaah
Tetapkan kod untuk setiap kumpulan, contoh `HTA-2027-A`. Jemaah isi kod itu semasa daftar. Di dashboard, anda boleh tapis jemaah ikut kod ini.

---

## Bila `Code.gs` dikemas kini (URL kekal sama)

**Jangan** buat "New deployment" sebab itu akan hasilkan URL baharu. Sebaliknya:

1. Tampal `Code.gs` yang baharu dalam editor, kemudian **Save**.
2. **Deploy → Manage deployments**.
3. Pilih deployment sedia ada, kemudian klik ikon **✏ Edit** (pensel).
4. Pada **Version**, pilih **New version**.
5. Klik **Deploy**.

URL kekal sama, jadi `config.js` dan Netlify tak perlu diubah.

> Jika `Code.gs` baharu ada kolum tambahan, run `setup()` sekali lagi. Ia hanya **menambah** kolum/tab yang tiada. Data sedia ada tidak dipadam.

---

## Cara guna

**Jemaah**
- **Daftar:** isi nama, umur, jantina, no. telefon, kod kumpulan, kemudian cipta PIN 6 digit (dua kali).
- **Log masuk:** isi no. telefon, kemudian tekan PIN pada papan nombor. App akan masuk sendiri bila PIN cukup 6 digit.
- **Lupa PIN:** hubungi fisio. Fisio boleh set PIN baharu.
- **Ujian:** pilih ujian, pilih PRE/POST, isi skor, kemudian tekan **Simpan skor**. Rekod boleh di-Edit atau dipadam (tekan **Padam**, kemudian **Sahkan padam**).
- **Senaman:** nilai preskripsi sudah terisi. Tekan **Simpan log** sahaja jika ikut preskripsi.
- **Diari:** jadual PRE vs POST, grid mingguan dan semua log. Butang **Cetak / Simpan PDF** hasilkan borang A4 satu muka.

**Fisio** (`fisio.html`, terus dibuka selepas log masuk)
- **Senarai jemaah:** tapis ikut kod kumpulan dan cari nama/telefon. Kolum PRE siap?, POST siap?, hari aktif 7 hari lepas dan log terakhir.
- **Klik nama:** papar diari jemaah (paparan sahaja), cetak diari, dan **Set semula PIN**.
- **Ringkasan kumpulan:** purata PRE vs POST setiap ujian, purata beza berpasangan, dan % jemaah aktif ≥3 hari seminggu.
- Butang **Google Sheet ↗** di atas membuka data mentah.

**Internet lemah / tiada internet:** rekod tetap "Disimpan" dan terus dipaparkan. Penanda **Belum sync (n)** muncul di atas, dan app hantar sendiri bila internet kembali (atau tekan penanda itu untuk cuba sekarang).

---

## Struktur data (Google Sheet)

| Tab | Kolum |
|---|---|
| `USERS` | userId, nama, umur, jantina, telefon, kumpulan, role, pinHash, salt, createdAt |
| `RECORDS` | recordId, userId, nama, kumpulan, type, itemId, itemName, fase, date, skor, jarak, hrPre, hrPeak, kanan, kiri, pushup, bilangan, ulangan, sesi, set, minit, langkah, namaSenaman, nota, createdAt, updatedAt, deleted |
| `SESSIONS` | token, userId, expiresAt |

- `type` = `test` / `ex`. `fase` = `PRE` / `POST` (ujian sahaja). `date` = `YYYY-MM-DD`.
- Padam = `deleted = TRUE` (baris tidak dibuang). Untuk analisis, tapis `deleted = FALSE`.
- Format lebar dan rata, jadi boleh terus disambung ke **Looker Studio** (Add data → Google Sheets → tab `RECORDS`).

## Keselamatan
- PIN disimpan sebagai **SHA-256 (pepper + salt + PIN)**, bukan teks biasa. Pepper rahsia disimpan dalam Script Properties, bukan dalam Sheet.
- 5 cubaan PIN salah akan mengunci akaun selama 15 minit.
- Token log masuk sah 30 hari. Server guna `userId` dari token, bukan dari browser.
- Akses fisio disemak di server (`role = fisio`). Semua tulisan guna `LockService`.
- **Jangan kongsi Google Sheet** kepada orang lain kecuali fisio. Sheet mengandungi nama dan no. telefon.

## Senarai API (`doPost`, medan `action`)
`register`, `login`, `logout`, `getMe`, `listRecords`, `addRecord`, `updateRecord`, `deleteRecord`. Untuk fisio: `listUsers`, `getUserRecords`, `groupSummary`, `resetPin`.
Respons: `{ok:true, ...}` atau `{ok:false, error:"mesej BM"}`.

## Masalah biasa
| Masalah | Penyelesaian |
|---|---|
| "Belum disambung… WEB_APP_URL" | Isi `js/config.js` (Langkah 5), kemudian upload semula ke Netlify. |
| "Tab USERS tiada" | Run `setup()` (Langkah 3). |
| Ubah `Code.gs` tapi tiada kesan | Buat **Manage deployments → Edit → New version**. |
| Log masuk berpusing lama | Apps Script ambil masa 1–3 saat, kadang lebih untuk request pertama. Tunggu sekejap. |
| "Akses untuk fisio sahaja" | Tukar `role` kepada `fisio` dalam tab USERS, kemudian log masuk semula. |
| No. telefon hilang sifar depan dalam Sheet | Run `setup()` sekali lagi (ia set kolum sebagai teks). App tetap boleh log masuk. |
