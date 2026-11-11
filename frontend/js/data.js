/* FIT FOR HAJJ — kandungan ujian & senaman (sumber: prototaip) */
window.FFH_DATA = (function () {
  const KOMP = {
    1: { name: "Regang & Pulih" }, 2: { name: "Jalan & Stamina" }, 3: { name: "Kuat & Tahan" }, 4: { name: "Imbang & Selamat" }
  };

  const TESTS = [
    { id: "sitreach", k: 1, name: "Sit and Reach", sub: "Fleksibiliti",
      purpose: "Menilai kelenturan otot hamstring dan belakang bawah.",
      equip: ["Kotak sit-and-reach / pembaris", "Tikar"],
      steps: ["Panaskan badan 3–5 minit (jalan ringan dan regangan perlahan).", "Buka kasut. Duduk di lantai, kedua-dua kaki lurus dan tapak kaki rapat pada kotak.", "Letak tangan bertindih, jari tengah selari.", "Hembus nafas sambil lentur badan ke depan perlahan-lahan. Tolak penanda sejauh mungkin. Lutut kekal lurus.", "Tahan 2 saat pada jarak paling jauh. Jangan menghentak.", "Buat 2 cubaan. Rekod skor yang terbaik dalam cm."],
      safety: "Hentikan jika sakit belakang yang tajam atau rasa kebas menjalar ke kaki.",
      fields: [{ key: "skor", label: "Skor", unit: "cm", step: "0.5", better: "up", max: 100 }] },
    { id: "6mwt", k: 2, name: "6-Minute Walk Test", sub: "Daya tahan",
      purpose: "Menilai daya tahan kardiorespiratori melalui jarak berjalan dalam 6 minit.",
      equip: ["Laluan rata 30 m bertanda", "2 kon", "Jam randik", "Oksimeter / pengukur nadi", "Kerusi untuk rehat"],
      steps: ["Duduk rehat 10 minit. Ukur kadar nadi (HR) sebelum ujian.", "Berjalan secepat mungkin selama 6 minit tanpa berlari. Pusing di setiap kon.", "Boleh perlahan atau berhenti rehat jika perlu. Jam terus berjalan.", "Pemeriksa memberi galakan setiap minit dan memberitahu baki masa.", "Pada minit ke-6, berhenti di tempat. Ukur HR puncak (peak HR) serta-merta.", "Kira jumlah jarak: bilangan pusingan × 60 m + baki jarak terakhir."],
      safety: "Hentikan serta-merta jika sakit dada, sesak nafas teruk, pening, pucat atau berpeluh sejuk. Ujian ini mesti dibuat dengan pengawasan.",
      fields: [
        { key: "jarak", label: "Jarak", unit: "m", step: "1", better: "up", max: 3000 },
        { key: "hrPre", label: "HR sebelum", unit: "bpm", step: "1", max: 250 },
        { key: "hrPeak", label: "Peak HR", unit: "bpm", step: "1", max: 250 }] },
    { id: "armcurl", k: 3, name: "30-Second Arm Curl", sub: "Kekuatan anggota atas",
      purpose: "Menilai kekuatan dan daya tahan otot lengan.",
      equip: ["Kerusi tanpa lengan", "Dumbbell 2.3 kg (wanita) / 3.6 kg (lelaki)", "Jam randik"],
      steps: ["Duduk tegak di kerusi, belakang lurus, kaki rata di lantai.", "Pegang dumbbell di sisi badan, tapak tangan menghadap ke dalam.", "Bengkokkan siku sepenuhnya sambil memusing tapak tangan ke atas, kemudian luruskan semula sepenuhnya.", "Lengan atas kekal rapat pada badan sepanjang pergerakan.", "Kira bilangan ulangan lengkap dalam 30 saat.", "Ulang untuk lengan sebelah lagi.", "Pilihan: 1-Minute Push-Up (dinding, lutut atau penuh ikut kemampuan). Kira bilangan dalam 1 minit."],
      safety: "Hentikan jika sakit sendi bahu atau siku. Jangan tahan nafas semasa mengangkat.",
      fields: [
        { key: "kanan", label: "Kanan", unit: "kali", step: "1", better: "up", max: 100 },
        { key: "kiri", label: "Kiri", unit: "kali", step: "1", better: "up", max: 100 },
        { key: "pushup", label: "1-Minute Push-Up (pilihan)", unit: "kali", step: "1", better: "up", optional: true, max: 200 }] },
    { id: "chairstand", k: 3, name: "30-Second Chair Stand", sub: "Kekuatan anggota bawah",
      purpose: "Menilai kekuatan dan daya tahan otot kaki.",
      equip: ["Kerusi bersandar tanpa lengan (±43 cm), disandarkan ke dinding", "Jam randik"],
      steps: ["Duduk di tengah kerusi, kaki rata di lantai, tangan bersilang di dada.", "Bangun hingga berdiri tegak sepenuhnya.", "Duduk semula sepenuhnya.", "Ulang secepat mungkin dengan selamat selama 30 saat.", "Kira bilangan berdiri lengkap. Jika separuh berdiri pada saat ke-30, kira sebagai satu."],
      safety: "Pastikan kerusi tidak bergerak. Hentikan jika sakit lutut atau pening.",
      fields: [{ key: "bilangan", label: "Bilangan", unit: "kali", step: "1", better: "up", max: 100 }] },
    { id: "olstand", k: 4, name: "One-Leg Stand", sub: "Keseimbangan",
      purpose: "Menilai keseimbangan statik dan kawalan postur.",
      equip: ["Kerusi untuk sokongan keselamatan", "Jam randik"],
      steps: ["Berdiri di sebelah kerusi, tangan di pinggang.", "Angkat sebelah kaki dengan lutut dibengkokkan. Kaki yang diangkat tidak menyentuh kaki yang berdiri.", "Mulakan jam sebaik kaki diangkat. Mata terbuka, pandang ke depan.", "Hentikan jam bila kaki menyentuh lantai, tangan terlepas dari pinggang atau kaki berdiri beralih. Maksimum 60 saat.", "Ulang untuk kaki sebelah lagi. Rekod masa dalam saat."],
      safety: "Pemeriksa berdiri dekat untuk menyambut jika hilang imbangan.",
      fields: [
        { key: "kanan", label: "Kaki kanan", unit: "saat", step: "1", better: "up", max: 600 },
        { key: "kiri", label: "Kaki kiri", unit: "saat", step: "1", better: "up", max: 600 }] }
  ];

  const EXS = [
    { id: "sitreach", k: 1, name: "Sit and Reach", title: "Aktiviti Sit-and-Reach",
      rx: "Tahan 15 saat, ulang 3 kali. Lakukan 5 kali sehari.",
      steps: ["Duduk di lantai atau di hujung kerusi, sebelah atau kedua-dua kaki lurus.", "Lentur badan ke depan sejauh yang boleh sambil belakang kekal panjang.", "Rasa regangan di belakang peha, bukan sakit.", "Tahan 15 saat sambil bernafas biasa.", "Ulang 3 kali. Buat sesi ini 5 kali sehari."],
      fields: [{ key: "ulangan", label: "Ulangan", unit: "kali", def: 3, max: 1000 }, { key: "sesi", label: "Sesi hari ini", unit: "kali", def: 5, max: 100 }] },
    { id: "walking", k: 2, name: "Berjalan", title: "Aktiviti Berjalan",
      rx: "Mulakan 20 minit atau kurang sehari. Tambah tempoh ikut kemampuan.",
      steps: ["Pakai kasut yang selesa. Bawa air.", "Mulakan 3–5 minit dengan langkah perlahan.", "Teruskan dengan rentak sederhana: masih boleh bercakap tetapi tidak boleh menyanyi.", "Akhiri dengan 3–5 minit langkah perlahan.", "Tambah 2–5 minit setiap minggu jika selesa. Sasaran jangka panjang: 30–45 minit, kerana tawaf dan sa'i memerlukan berjalan jauh."],
      fields: [{ key: "minit", label: "Tempoh", unit: "minit", def: 20, max: 1440 }, { key: "langkah", label: "Langkah (pilihan)", unit: "langkah", optional: true, max: 200000 }] },
    { id: "armcurl", k: 3, name: "Arm curl", title: "Aktiviti Kekuatan · Anggota Atas",
      rx: "Arm curl 25 kali × 3 set, kiri dan kanan.",
      steps: ["Duduk tegak di kerusi. Pegang botol air 500 ml atau dumbbell ringan.", "Bengkokkan siku dan angkat beban ke arah bahu.", "Turunkan perlahan-lahan hingga lengan lurus.", "Buat 25 kali, kemudian tukar tangan.", "Rehat 1 minit antara set. Ulang 3 set."],
      fields: [{ key: "set", label: "Set", unit: "set", def: 3, max: 100 }, { key: "ulangan", label: "Ulangan setiap set", unit: "kali", def: 25, max: 1000 }] },
    { id: "sittostand", k: 3, name: "Sit to stand", title: "Aktiviti Kekuatan · Anggota Kaki",
      rx: "Duduk dan bangun dari kerusi 10 kali × 3 set.",
      steps: ["Duduk di kerusi yang kukuh, kaki rata di lantai.", "Silangkan tangan di dada (atau guna tangan jika perlu).", "Condongkan badan ke depan dan bangun hingga berdiri tegak.", "Duduk semula perlahan-lahan dengan terkawal.", "Buat 10 kali. Rehat 1 minit. Ulang 3 set."],
      fields: [{ key: "set", label: "Set", unit: "set", def: 3, max: 100 }, { key: "ulangan", label: "Ulangan setiap set", unit: "kali", def: 10, max: 1000 }] },
    { id: "crabwalk", k: 4, name: "Crab walk", title: "Aktiviti Keseimbangan",
      rx: "Melangkah ke sisi 10 langkah ke kiri dan 10 langkah ke kanan. Ulang 3–5 set.",
      steps: ["Berdiri di tepi meja atau dinding untuk sokongan.", "Bengkokkan lutut sedikit, badan tegak.", "Langkah ke sisi kiri 10 langkah. Kaki tidak bersilang.", "Langkah ke sisi kanan 10 langkah.", "Ulang 3–5 set."],
      fields: [{ key: "set", label: "Set", unit: "set", def: 3, max: 100 }] },
    { id: "other", k: 0, name: "Lain-lain", title: "Senaman Lain",
      rx: "Rekod senaman lain yang anda lakukan.",
      steps: ["Tulis nama senaman (contoh: berenang, berbasikal, senaman kumpulan).", "Rekod tempoh atau bilangan yang dilakukan."],
      fields: [{ key: "namaSenaman", label: "Nama senaman", type: "text", max: 80 }, { key: "minit", label: "Tempoh (pilihan)", unit: "minit", optional: true, max: 1440 }] }
  ];

  const DAYS = ["Isnin", "Selasa", "Rabu", "Khamis", "Jumaat", "Sabtu", "Ahad"];
  return { KOMP, TESTS, EXS, DAYS };
})();
