/**
 * Rhadz Calendar - External Data Storage
 * Berisi semua data hardcoded agar file HTML tetap ringan.
 */

const quotes = [
    "Semakin kita mencari kebahagiaan, semakin jauh ia menghilang.", "Kegagalan terbesar adalah tidak pernah mencoba.", "Kata-kata terlembut bisa melukai paling dalam.", "Kita belajar paling banyak dari orang yang paling kita benci.", "Diam terkadang lebih berisik daripada teriakan.", "Kehilangan mengajarkan kita nilai memiliki.", "Kesendirian ramai, keramaian bisa sangat sunyi.", "Menerima adalah cara terkuat untuk melawan.", "Kita paling kuat saat mengakui kelemahan.", "Berubah adalah satu-satunya yang tetap.", "Makin banyak tahu, makin sadar tak tahu apa-apa.", "Waktu sembuhkan luka, waktu juga ciptakan luka.", "Cinta membebaskan dengan cara mengikat.", "Kesederhanaan butuh usaha yang rumit.", "Memberi adalah cara terbaik menerima.", "Memaafkan membebaskan yang memaafkan.", "Ketakutan terbesar adalah takut itu sendiri.", "Kontrol dimulai dari melepas kontrol.", "Kematian memberi arti pada kehidupan.", "Harapan bisa menjadi belenggu tersendiri.", "Kebenaran menyakitkan lebih baik dari kebohongan manis.", "Kesalahan masa lalu adalah guru terbaik hari ini.", "Semakin keras kita pegang, semakin mudah lepas.", "Pertanyaan lebih berharga daripada jawaban.", "Kegelapan mengajarkan kita menghargai cahaya.", "Kepastian adalah ilusi yang nyaman.", "Kita paling hidup saat hampir mati.", "Mendengar lebih sulit daripada berbicara.", "Kesuksesan dimulai dari kegagalan berulang.", "Kehilangan jalan adalah cara menemukan jalan baru.", "Keraguan adalah awal dari kebijaksanaan.", "Melambat terkadang cara tercepat sampai tujuan.", "Rasa sakit mengingatkan kita bahwa kita hidup.", "Mengenal diri sendiri adalah perjalanan seumur hidup.", "Kebahagiaan sejati datang dari dalam, bukan luar.", "Waktu tidak bisa dibeli tapi sering kita siasiakan.", "Masalah terbesar sering punya solusi tersederhana.", "Kehilangan adalah bagian dari memiliki.", "Kesempurnaan adalah musuh dari kemajuan.", "Kita tumbuh paling cepat di luar zona nyaman.", "Yang kita takuti sering tidak pernah terjadi.", "Kebencian meracuni yang membenci.", "Berhenti adalah langkah maju terkadang.", "Mimpi tanpa aksi hanya angan-angan.", "Ketenangan lahir dari menerima kekacauan.", "Perpisahan mengajarkan arti kebersamaan.", "Kekuatan sejati adalah kelembutan.", "Hidup dimulai di ujung zona nyaman.", "Kesabaran adalah kekuatan yang tersembunyi.", "Melepas adalah bentuk kepemilikan tertinggi."
];

const familyBirthdays = [];

const weddingAnniversary = { day: null, month: null, year: null };

const holidaysData = {
    2025: {
        0: { 1: "Tahun Baru 2025 Masehi", 27: "Isra Mikraj Nabi Muhammad SAW", 29: "Tahun Baru Imlek 2576 Kongzili" },
        2: { 29: "Hari Suci Nyepi (Tahun Baru Saka 1947)", 31: "Idul Fitri 1446 Hijriah" },
        3: { 1: "Idul Fitri 1446 Hijriah", 18: "Wafat Yesus Kristus", 20: "Kebangkitan Yesus Kristus (Paskah)" },
        4: { 1: "Hari Buruh Internasional", 12: "Hari Raya Waisak 2569 BE", 29: "Kenaikan Yesus Kristus" },
        5: { 1: "Hari Lahir Pancasila", 6: "Idul Adha 1446 Hijriah", 27: "1 Muharam Tahun Baru Islam 1447 Hijriah" },
        7: { 17: "Proklamasi Kemerdekaan RI" },
        8: { 5: "Maulid Nabi Muhammad SAW" },
        11: { 25: "Kelahiran Yesus Kristus (Natal)" }
    },
    2026: {
        0: { 1: "Tahun Baru 2026 Masehi", 16: "Isra Mikraj Nabi Muhammad SAW" },
        1: { 17: "Tahun Baru Imlek 2577 Kongzili" },
        2: { 19: "Hari Suci Nyepi (Tahun Baru Saka 1948)", 21: "Idul Fitri 1447 Hijriah", 22: "Idul Fitri 1447 Hijriah" },
        3: { 3: "Wafat Yesus Kristus", 5: "Kebangkitan Yesus Kristus (Paskah)" },
        4: { 1: "Hari Buruh Internasional", 14: "Kenaikan Yesus Kristus", 27: "Idul Adha 1447 Hijriah", 31: "Hari Raya Waisak 2570 BE" },
        5: { 1: "Hari Lahir Pancasila", 16: "1 Muharam Tahun Baru Islam 1448 Hijriah" },
        7: { 17: "Proklamasi Kemerdekaan RI", 25: "Maulid Nabi Muhammad SAW" },
        11: { 25: "Kelahiran Yesus Kristus (Natal)" }
    }
};

const cutiBersamaData = {
    2025: {
        0: { 28: "Cuti Bersama Imlek 2576" },
        2: { 28: "Cuti Bersama Nyepi Saka 1947" },
        3: { 2: "Cuti Bersama Idul Fitri", 3: "Cuti Bersama Idul Fitri", 4: "Cuti Bersama Idul Fitri", 7: "Cuti Bersama Idul Fitri" },
        4: { 13: "Cuti Bersama Waisak", 30: "Cuti Bersama Kenaikan Yesus Kristus" },
        5: { 9: "Cuti Bersama Idul Adha" },
        7: { 18: "Cuti Bersama Proklamasi Kemerdekaan" },
        11: { 26: "Cuti Bersama Natal" }
    },
    2026: {
        1: { 16: "Cuti Bersama Imlek 2577" },
        2: { 18: "Cuti Bersama Nyepi Saka 1948", 20: "Cuti Bersama Idul Fitri", 23: "Cuti Bersama Idul Fitri", 24: "Cuti Bersama Idul Fitri" },
        4: { 15: "Cuti Bersama Kenaikan Yesus Kristus", 28: "Cuti Bersama Idul Adha" },
        11: { 24: "Cuti Bersama Natal" }
    }
};

const nationalObservances = {
    0: { 3: "Hari Amal Bhakti Kemenag RI", 5: "Hari KOWAL", 10: "Hari Tritura", 15: "Hari Dharma Samudera", 17: "Hari Raya Siwaratri", 23: "Hari Patriotik", 25: "Hari Gizi Nasional", 31: "Harlah NU" },
    1: { 5: "Peristiwa Kapal Tujuh", 9: "Hari Pers Nasional (HPN)", 14: "Peringatan PETA", 21: "Hari Peduli Sampah Nasional", 28: "Hari Gizi Nasional" },
    2: { 1: "Serangan Umum 1 Maret", 9: "Hari Musik Nasional", 30: "Hari Film Nasional" },
    3: { 6: "Hari Nelayan Indonesia", 9: "Hari TNI AU", 16: "Hari Kopassus", 21: "Hari Kartini", 27: "Hari Pemasyarakatan", 28: "Hari Puisi Nasional" },
    4: { 2: "Hardiknas", 17: "Hari Buku Nasional", 20: "Hari Kebangkitan Nasional", 29: "Hari Lanjut Usia Nasional" },
    5: { 21: "Hari Krida Pertanian", 24: "Hari Bidan Nasional", 29: "Hari KB" },
    6: { 1: "Hari Bhayangkara", 5: "Hari Bank Indonesia", 12: "Hari Koperasi Indonesia", 22: "Hari Kejaksaan", 23: "Hari Anak Nasional" },
    7: { 5: "Hari Dharma Wanita", 10: "Hari Veteran Nasional", 14: "Hari Pramuka", 21: "Hari Maritim Nasional", 24: "Hari TVRI" },
    8: { 1: "Hari Polwan", 3: "Hari PMI", 4: "Hari Pelanggan Nasional", 9: "Hari Olahraga Nasional", 17: "Hari Perhubungan Nasional", 24: "Hari Tani Nasional", 28: "Hari Kereta Api", 30: "Peringatan G30S/PKI" },
    9: { 1: "Hari Kesaktian Pancasila", 2: "Hari Batik Nasional", 5: "Hari TNI", 24: "Hari Dokter Indonesia", 27: "Hari Listrik Nasional", 28: "Hari Sumpah Pemuda", 30: "Hari Keuangan Nasional" },
    10: { 5: "Hari Cinta Puspa & Satwa", 10: "Hari Pahlawan", 12: "Hari Kesehatan / Hari Ayah", 14: "Hari Brimob", 25: "Hari Guru", 28: "Hari Menanam Pohon", 29: "Hari KORPRI" },
    11: { 12: "Hari Transmigrasi", 13: "Hari Nusantara", 19: "Hari Bela Negara", 22: "Hari Ibu" }
};

const hijriMonths = ["MUHARRAM", "SAFAR", "RABIUL AWAL", "RABIUL AKHIR", "JUMADIL AWAL", "JUMADIL AKHIR", "RAJAB", "SYA'BAN", "RAMADHAN", "SYAWAL", "DZULQA'DAH", "DZULHIJJAH"];
const pasaranArr = ["LEGI", "PAHING", "PON", "WAGE", "KLIWON"];
const monthNames = ["JANUARI", "FEBRUARI", "MARET", "APRIL", "MEI", "JUNI", "JULI", "AGUSTUS", "SEPTEMBER", "OKTOBER", "NOVEMBER", "DESEMBER"];
const dayNames = ["MINGGU", "SENIN", "SELASA", "RABU", "KAMIS", "JUMAT", "SABTU"];
const dayShortNames = ["MGG", "SEN", "SEL", "RAB", "KAM", "JUM", "SAB"];

const hijriAnchors = [
    // 1445 H
    { d: 13, m: 0, y: 2024, hM: 6, hY: 1445 },  // 1 Rajab
    { d: 11, m: 1, y: 2024, hM: 7, hY: 1445 },  // 1 Sya'ban
    { d: 12, m: 2, y: 2024, hM: 8, hY: 1445 },  // 1 Ramadhan
    { d: 10, m: 3, y: 2024, hM: 9, hY: 1445 },  // 1 Syawal
    { d: 10, m: 4, y: 2024, hM: 10, hY: 1445 }, // 1 Dzulqa'dah
    { d: 8, m: 5, y: 2024, hM: 11, hY: 1445 },  // 1 Dzulhijjah

    // 1446 H
    { d: 7, m: 6, y: 2024, hM: 0, hY: 1446 },   // 1 Muharram
    { d: 6, m: 7, y: 2024, hM: 1, hY: 1446 },   // 1 Safar
    { d: 5, m: 8, y: 2024, hM: 2, hY: 1446 },   // 1 Rabiul Awal
    { d: 4, m: 9, y: 2024, hM: 3, hY: 1446 },   // 1 Rabiul Akhir
    { d: 3, m: 10, y: 2024, hM: 4, hY: 1446 },  // 1 Jumadil Awal
    { d: 3, m: 11, y: 2024, hM: 5, hY: 1446 },  // 1 Jumadil Akhir
    { d: 1, m: 0, y: 2025, hM: 6, hY: 1446 },   // 1 Rajab
    { d: 31, m: 0, y: 2025, hM: 7, hY: 1446 },  // 1 Sya'ban
    { d: 1, m: 2, y: 2025, hM: 8, hY: 1446 },   // 1 Ramadhan
    { d: 31, m: 2, y: 2025, hM: 9, hY: 1446 },  // 1 Syawal
    { d: 29, m: 3, y: 2025, hM: 10, hY: 1446 }, // 1 Dzulqa'dah
    { d: 28, m: 4, y: 2025, hM: 11, hY: 1446 }, // 1 Dzulhijjah

    // 1447 H
    { d: 27, m: 5, y: 2025, hM: 0, hY: 1447 },  // 1 Muharram
    { d: 26, m: 6, y: 2025, hM: 1, hY: 1447 },  // 1 Safar
    { d: 25, m: 7, y: 2025, hM: 2, hY: 1447 },  // 1 Rabiul Awal
    { d: 23, m: 8, y: 2025, hM: 3, hY: 1447 },  // 1 Rabiul Akhir
    { d: 23, m: 9, y: 2025, hM: 4, hY: 1447 },  // 1 Jumadil Awal
    { d: 22, m: 10, y: 2025, hM: 5, hY: 1447 }, // 1 Jumadil Akhir
    { d: 21, m: 11, y: 2025, hM: 6, hY: 1447 }, // 1 Rajab
    { d: 20, m: 0, y: 2026, hM: 7, hY: 1447 },  // 1 Sya'ban
    { d: 19, m: 1, y: 2026, hM: 8, hY: 1447 },  // 1 Ramadhan
    { d: 21, m: 2, y: 2026, hM: 9, hY: 1447 },  // 1 Syawal
    { d: 19, m: 3, y: 2026, hM: 10, hY: 1447 }, // 1 Dzulqa'dah
    { d: 18, m: 4, y: 2026, hM: 11, hY: 1447 }, // 1 Dzulhijjah

    // 1448 H
    { d: 16, m: 5, y: 2026, hM: 0, hY: 1448 },   // 1 Muharram
    { d: 16, m: 6, y: 2026, hM: 1, hY: 1448 },   // 1 Safar
    { d: 14, m: 7, y: 2026, hM: 2, hY: 1448 },   // 1 Rabi'ul-Awal
    { d: 13, m: 8, y: 2026, hM: 3, hY: 1448 },   // 1 Rabi'ul-Akhir
    { d: 12, m: 9, y: 2026, hM: 4, hY: 1448 },   // 1 Jumadil Awal
    { d: 11, m: 10, y: 2026, hM: 5, hY: 1448 },   // 1 Jumadil Akhir
    { d: 10, m: 11, y: 2026, hM: 6, hY: 1448 }   // 1 Rajab 
];

const themes = [
    { id: 'royal', name: 'Royal Blue', class: '', colorBg: 'bg-slate-900', ringColor: 'ring-blue-200', borderColor: 'border-blue-500' },
    { id: 'emerald', name: 'Emerald', class: 'theme-emerald', colorBg: 'bg-emerald-700', ringColor: 'ring-emerald-200', borderColor: 'border-emerald-500' },
    { id: 'amethyst', name: 'Amethyst', class: 'theme-amethyst', colorBg: 'bg-purple-700', ringColor: 'ring-purple-200', borderColor: 'border-purple-500' },
    { id: 'crimson', name: 'Crimson', class: 'theme-crimson', colorBg: 'bg-rose-700', ringColor: 'ring-rose-200', borderColor: 'border-rose-500' },
    { id: 'midnight', name: 'Midnight Slate', class: 'theme-midnight', colorBg: 'bg-slate-700', ringColor: 'ring-slate-300', borderColor: 'border-slate-500' },
    { id: 'ocean', name: 'Deep Ocean', class: 'theme-ocean', colorBg: 'bg-cyan-800', ringColor: 'ring-cyan-200', borderColor: 'border-cyan-500' },
    { id: 'sunset', name: 'Sunset Orange', class: 'theme-sunset', colorBg: 'bg-orange-800', ringColor: 'ring-orange-200', borderColor: 'border-orange-500' },
    { id: 'coffee', name: 'Elegant Coffee', class: 'theme-coffee', colorBg: 'bg-amber-900', ringColor: 'ring-amber-200', borderColor: 'border-amber-500' }
];
