if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js');
}
// Initialize State variables
let currentThemeIndex = 0;

let currentDate = new Date();
let isAnimating = false;
let highlightTriggered = false;
let isNotesView = false;

let currentNoteMode = 'weekly';
let currentNoteDate = new Date();
// Variabel untuk menyimpan argument terakhir showDetail agar bisa refresh modal
let lastDetailArgs = null;

// Mengambil data dari localStorage, jika kosong pakai default
let settings = JSON.parse(localStorage.getItem('rhadzCalSettings')) || {
    showHijri: true,
    showPasaran: true,
    showObservances: true,
    showFamily: true,
    transitionType: 'none',
    darkMode: false
};
// Fungsi pembantu untuk menyimpan setiap ada perubahan
function saveSettingsToStorage() {
    localStorage.setItem('rhadzCalSettings', JSON.stringify(settings));
};
function updateTransition(val) {
    settings.transitionType = val;
    saveSettingsToStorage(); // Simpan pilihan transisi ke memori
}

// HISTORY API HANDLER: Mengatur Tombol Back HP
window.onpopstate = function (event) {
    const hash = location.hash;
    const modal = document.getElementById('selectorModal');

    // KASUS 1: Jika MODAL terbuka, tutup modalnya saja.
    if (modal && modal.classList.contains('active')) {
        // Panggil closeModal dengan parameter true (artinya trigger dari history)
        closeModal(true);
        return;
    }

    // KASUS 2: Jika berada di halaman NOTES
    if (typeof isNotesView !== 'undefined' && isNotesView) {
        // Jika URL berubah jadi #calendar atau kosong, BARU pindah ke Kalender
        if (hash === '#calendar' || hash === '') {
            toggleNotesView(true); // Ini akan mematikan notes view
        }
        // Jika hash masih #notes, JANGAN LAKUKAN APA-APA (Biarkan tetap di notes)
        return;
    }

    // KASUS 3: Default Safety
    if (!hash || hash === '#home') {
        history.replaceState({ view: 'calendar' }, '', '#calendar');
    }
};

function init() {
    // 1. Terapkan Tema Warna
    const savedTheme = localStorage.getItem('rhadzThemeIndex');
    if (savedTheme !== null) applyTheme(parseInt(savedTheme));

    // 2. Terapkan Dark Mode
    updateDarkModeVisuals();

    // 3. Sinkronkan tampilan menu
    syncSettingsUI();

    // 4. Render komponen utama
    renderCalendar();
    updateQuote();

    // 5. Setup History & Back Button (Insight User)
    // Kita paksa aplikasi mulai dari hash #calendar sebagai base entry.
    if (location.hash !== '#calendar' && location.hash !== '#notes') {
        history.replaceState({ view: 'calendar' }, '', '#calendar');
    } else if (location.hash === '#notes') {
        isNotesView = false;
        toggleNotesView(true);
    }

    // 6. Listener resize & swipe
    setupSwipe();
    window.addEventListener('resize', renderCalendar);

    setupKeyboardShortcuts();
    startAlarmSystem(); // <--- Panggil fungsi monitoring alarm

    // TAMBAHKAN INI: Update tampilan sidebar saat load awal
    updateDesktopSidebarUI();

    // 7. Timeout transisi
    setTimeout(() => {
        const transSelect = document.getElementById('transitionSelect');
        if (transSelect) transSelect.value = settings.transitionType;
    }, 100);

    setupFabScroll();
}

function setupFabScroll() {
    const container = document.getElementById('notesListContainer');
    const fab = document.getElementById('floatingNotesBtn');
    let lastScrollTop = 0;

    if (!container || !fab) return;

    container.addEventListener('scroll', () => {
        const scrollTop = container.scrollTop;
        
        // Logika: Jika scroll lebih dari 50px DAN arah ke bawah -> Kecilkan
        if (scrollTop > lastScrollTop && scrollTop > 50) {
            fab.classList.add('shrink');
        } else {
            // Jika scroll ke atas -> Lebarkan kembali
            fab.classList.remove('shrink');
        }
        
        lastScrollTop = scrollTop;
    }, { passive: true });
}

function syncSettingsUI() {
    document.getElementById('dsk-pasaran').checked = settings.showPasaran;
    document.getElementById('dsk-hijri').checked = settings.showHijri;
    document.getElementById('dsk-obs').checked = settings.showObservances;
}

function cycleTheme() {
    currentThemeIndex = (currentThemeIndex + 1) % themes.length;
    applyTheme(currentThemeIndex);
}

function applyTheme(index) {
    currentThemeIndex = index;
    localStorage.setItem('rhadzThemeIndex', index); // Simpan pilihan tema

    const theme = themes[currentThemeIndex];

    // 1. Reset semua class dulu (ini yang bikin Dark Mode hilang)
    document.body.className = '';

    // 2. Pasang class tema warna baru (jika ada)
    if (theme.class) {
        document.body.classList.add(theme.class);
    }

    // Handle theme and dark mode interaction
    // 3. Cek apakah Mode Gelap sedang aktif? Jika ya, pasang lagi class-nya!
    if (settings.darkMode) {
        document.body.classList.add('dark-mode');
    }

    // 4. Update Label Nama Tema
    const desktopLabel = document.getElementById('themeNameDesktop');
    if (desktopLabel) desktopLabel.textContent = theme.name;

    const modalLabel = document.getElementById('themeNameModal');
    if (modalLabel) modalLabel.textContent = theme.name;

    // 5. Update Border Tombol di Modal
    themes.forEach((t, i) => {
        const btn = document.getElementById(`themeBtn-${i}`);
        if (btn) {
            btn.className = `w-10 h-10 rounded-full border-2 transition ${t.colorBg} hover:scale-110 shadow-sm`;

            if (i === index) {
                btn.classList.add(t.borderColor, 'ring-2', t.ringColor);
                btn.classList.remove('border-transparent');
            } else {
                btn.classList.add('border-transparent');
            }
        }
    });
}

function getStoredNotes() {
    const stored = localStorage.getItem('rhadzCalNotes');
    let data = stored ? JSON.parse(stored) : {};

    // --- AUTO MIGRATION LOGIC ---
    // Cek apakah data masih format lama (String)? Jika ya, ubah ke Array Object
    let migrated = false;
    Object.keys(data).forEach(key => {
        if (typeof data[key] === 'string') {
            // Konversi string lama menjadi object note pertama
            data[key] = [{
                id: Date.now() + Math.random(), // Random ID
                text: data[key],
                category: 'pribadi', // Default category
                time: '',
                isCompleted: false
            }];
            migrated = true;
        }
    });

    if (migrated) {
        localStorage.setItem('rhadzCalNotes', JSON.stringify(data));
    }

    return data;
}

// --- NEW CRUD OPERATIONS ---

function addNote(dateKey, text, category = 'pribadi', time = '') {
    const notes = getStoredNotes();
    if (!notes[dateKey]) notes[dateKey] = [];

    notes[dateKey].push({
        id: Date.now(),
        text: text,
        category: category,
        time: time,
        isCompleted: false
    });

    localStorage.setItem('rhadzCalNotes', JSON.stringify(notes));
    renderCalendar(); // Update dot indikator
    renderNotesList(); // Update global list jika sedang dibuka
    return notes[dateKey]; // Return updated list
}

function deleteNote(dateKey, noteId) {
    const notes = getStoredNotes();
    if (notes[dateKey]) {
        notes[dateKey] = notes[dateKey].filter(n => n.id != noteId); // Pakai filter != karena ID bisa number/string dari JSON
        if (notes[dateKey].length === 0) delete notes[dateKey]; // Hapus key jika kosong

        localStorage.setItem('rhadzCalNotes', JSON.stringify(notes));
        renderCalendar();
        renderNotesList();
    }
    return notes[dateKey] || [];
}

function editNote(dateKey, noteId, newText, newCategory, newTime) {
    const notes = getStoredNotes();
    if (notes[dateKey]) {
        const note = notes[dateKey].find(n => n.id == noteId);
        if (note) {
            note.text = newText;
            note.category = newCategory;
            note.time = newTime;
            localStorage.setItem('rhadzCalNotes', JSON.stringify(notes));
            renderCalendar();
            renderNotesList();
        }
    }
    return notes[dateKey] || [];
}

function toggleNoteStatus(dateKey, noteId) {
    const notes = getStoredNotes();
    if (notes[dateKey]) {
        const note = notes[dateKey].find(n => n.id == noteId);
        if (note) {
            note.isCompleted = !note.isCompleted;
            localStorage.setItem('rhadzCalNotes', JSON.stringify(notes));
            renderCalendar();
            renderNotesList();
        }
    }
    return notes[dateKey] || [];
}

// --- BACKUP & RESTORE ---
function exportData() {
    try {
        const data = {
            settings: JSON.parse(localStorage.getItem('rhadzCalSettings')),
            notes: JSON.parse(localStorage.getItem('rhadzCalNotes')),
            themeIndex: localStorage.getItem('rhadzThemeIndex'),
            ver: 'v10'
        };
        const json = JSON.stringify(data, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href", url);
        downloadAnchorNode.setAttribute("download", "rhadz-backup-" + new Date().toISOString().slice(0, 10) + ".json");
        document.body.appendChild(downloadAnchorNode);
        downloadAnchorNode.click();

        // Cleanup
        setTimeout(() => {
            if (document.body.contains(downloadAnchorNode)) {
                document.body.removeChild(downloadAnchorNode);
            }
            URL.revokeObjectURL(url);
        }, 1000); // Bertahan lebih lama agar download sempat dipicu di Android
    } catch (e) {
        alert("Gagal melakukan backup: " + e.message);
    }
}

function importData(input) {
    const file = input.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function (e) {
        try {
            const data = JSON.parse(e.target.result);
            console.log("Restoring data...", data);

            if (data.settings) {
                localStorage.setItem('rhadzCalSettings', JSON.stringify(data.settings));
                Object.assign(settings, data.settings);
            }
            if (data.notes) localStorage.setItem('rhadzCalNotes', JSON.stringify(data.notes));
            if (data.themeIndex !== undefined) localStorage.setItem('rhadzThemeIndex', data.themeIndex);

            alert('Data berhasil dipulihkan! Halaman akan dimuat ulang.');
            window.location.reload();
        } catch (err) {
            alert('File backup tidak valid: ' + err.message);
            console.error(err);
        } finally {
            input.value = ''; // Reset agar bisa pilih file yang sama lagi
        }
    };
    reader.onerror = function () {
        alert('Gagal membaca file!');
    };
    reader.readAsText(file);
}

function getNoteForDate(d, m, y) {
    const key = `${y}-${m}-${d}`;
    const notes = getStoredNotes();
    // Return array of notes, or empty array
    return notes[key] || [];
}

function getHijriDate(date) {
    // Normalisasi tanggal target ke 00:00:00
    const targetDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    targetDate.setHours(0, 0, 0, 0);

    // --- 1. COBA CARI DI HARDCODE (ANCHOR) ---
    let bestAnchor = null;
    for (let i = 0; i < hijriAnchors.length; i++) {
        const a = hijriAnchors[i];
        const anchorDate = new Date(a.y, a.m, a.d);
        anchorDate.setHours(0, 0, 0, 0);

        if (targetDate.getTime() >= anchorDate.getTime()) {
            bestAnchor = { ...a, objDate: anchorDate };
        } else {
            break; // Karena data urut, stop jika sudah lewat
        }
    }

    // Jika ketemu anchor dan selisih harinya masih wajar (kurang dari 30 hari)
    if (bestAnchor) {
        const diffTime = targetDate.getTime() - bestAnchor.objDate.getTime();
        const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays < 30) {
            // RETURN HASIL HARDCODE (isHardcoded = true)
            return {
                day: 1 + diffDays,
                month: bestAnchor.hM,
                year: bestAnchor.hY,
                isHardcoded: true
            };
        }
    }

    // --- 2. JIKA GAGAL/TIDAK ADA DI HARDCODE, PAKAI RUMUS MATEMATIKA ---
    let julian = Math.floor((date.getTime() / 86400000) + 2440587.5);
    let l = julian - 1948440 + 10632;
    let n = Math.floor((l - 1) / 10631);
    l = l - 10631 * n + 354;
    let j = (Math.floor((10985 - l) / 5316)) * (Math.floor((50 * l) / 17719)) + (Math.floor(l / 5670)) * (Math.floor((43 * l) / 15238));
    l = l - (Math.floor((30 - j) / 15)) * (Math.floor((17719 * j) / 50)) - (Math.floor(j / 16)) * (Math.floor((15238 * j) / 43)) + 29;
    let m = Math.floor((24 * l) / 709);
    let d = l - Math.floor((709 * m) / 24);
    let y = 30 * n + j - 30;

    // Koreksi manual rumus (+1 hari biasanya biar pas)
    d += 1;

    // PENGAMAN: Jangan sampai ada tanggal 31/32 Hijriah
    if (d > 30) {
        d = 1;
        m += 1; // Pindah bulan
    }
    if (m > 12) { // Reset tahun jika lewat Dzulhijjah
        m = 1;
        y += 1;
    }

    // RETURN HASIL RUMUS (isHardcoded = false)
    return {
        day: d,
        month: m - 1,
        year: y,
        isHardcoded: false
    };
}

function toggleNotesView(fromHistory = false) {
    isNotesView = !isNotesView;

    const calendarContainer = document.getElementById('calendarViewContainer');
    const notesContainer = document.getElementById('notesViewContainer');
    const calHeader = document.getElementById('calendarHeaderCenter');
    const notesHeader = document.getElementById('notesHeaderCenter'); // Opsional jika ada header khusus notes

    // Footer Icon Elements (Mobile)
    const footerLeft = document.getElementById('footerLeftBtn');
    
    // Desktop Button (Sidebar)
    const btnDesktop = document.getElementById('btnToggleViewDesktop');

    if (isNotesView) {
        // --- MASUK MODE NOTES ---
        calendarContainer.classList.add('hidden');
        notesContainer.classList.remove('hidden');
        notesContainer.classList.add('active');
        
        // Sembunyikan Header Kalender
        if (calHeader) calHeader.classList.add('hidden');
        if (notesHeader) notesHeader.classList.remove('hidden');

        // Update Icon Footer (Mobile): Jadi icon Home
        if(footerLeft) footerLeft.innerHTML = '<i class="fas fa-home text-white text-sm"></i>';
        
        // Update Tombol Desktop: Berubah jadi "Kalender" (Tombol Pulang)
        if (btnDesktop) {
            btnDesktop.innerHTML = '<i class="fas fa-calendar-alt"></i> Kalender';
            btnDesktop.classList.add('bg-white/20'); // Highlight tombol
        }

        // Render ulang list catatan
        currentNoteDate = new Date();
        renderNotesList();

        // Push History
        if (!fromHistory && location.hash !== '#notes') {
            history.pushState({ view: 'notes' }, '', '#notes');
        }

    } else {
        // --- KEMBALI KE KALENDER ---
        calendarContainer.classList.remove('hidden');
        notesContainer.classList.remove('active');
        notesContainer.classList.add('hidden');
        
        // Munculkan Header Kalender
        if (calHeader) calHeader.classList.remove('hidden');
        if (notesHeader) notesHeader.classList.add('hidden');

        // Reset Icon Footer (Mobile): Jadi icon Buku
        if(footerLeft) footerLeft.innerHTML = '<i class="fas fa-book text-white text-sm"></i>';
        
        // Reset Tombol Desktop: Berubah jadi "Catatanku" (Tombol Masuk)
        if (btnDesktop) {
            btnDesktop.innerHTML = '<i class="fas fa-book"></i> Catatanku';
            btnDesktop.classList.remove('bg-white/20'); // Hapus highlight
        }

        // Handle History Back
        if (!fromHistory && location.hash === '#notes') {
            history.back();
        }

        // Refresh kalender (penting jika ada perubahan data saat di mode notes)
        renderCalendar();
    }
}

function handleFooterRightAction() {
    openDateSearch();
}

function switchNoteTab(mode, tabElement) {
    currentNoteMode = mode;
    document.querySelectorAll('.notes-tab').forEach(t => t.classList.remove('active'));
    tabElement.classList.add('active');
    currentNoteDate = new Date();
    renderNotesList();
}

function navNotes(dir) {
    if (currentNoteMode === 'weekly') {
        currentNoteDate.setDate(currentNoteDate.getDate() + (dir * 7));
    } else if (currentNoteMode === 'monthly') {
        currentNoteDate.setMonth(currentNoteDate.getMonth() + dir);
    } else if (currentNoteMode === 'yearly') {
        currentNoteDate.setFullYear(currentNoteDate.getFullYear() + dir);
    }
    renderNotesList();
}

function renderNotesList() {
    const container = document.getElementById('notesListContainer');
    const label = document.getElementById('notesNavLabel');
    container.innerHTML = '';

    let startD, endD, labelText;
    const now = new Date();
    const storedNotes = getStoredNotes();
    let notesFound = [];

    // --- LOGIKA PENENTUAN WAKTU (MINGGUAN/BULANAN/TAHUNAN) ---
    // (Bagian ini tidak berubah, tetap sama seperti sebelumnya)
    if (currentNoteMode === 'weekly') {
        const day = currentNoteDate.getDay();
        const startOfWeek = new Date(currentNoteDate);
        startOfWeek.setDate(currentNoteDate.getDate() - currentNoteDate.getDay());
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 6);
        const currentWeekStart = new Date(now);
        currentWeekStart.setDate(now.getDate() - now.getDay());
        const timeDiff = startOfWeek.getTime() - currentWeekStart.getTime();
        const dayDiff = timeDiff / (1000 * 3600 * 24);
        if (Math.abs(dayDiff) < 1) labelText = "MINGGU INI";
        else if (dayDiff > 0 && dayDiff <= 7) labelText = "MINGGU DEPAN";
        else if (dayDiff < 0 && dayDiff >= -7) labelText = "MINGGU LALU";
        else labelText = `${startOfWeek.getDate()}/${startOfWeek.getMonth() + 1} - ${endOfWeek.getDate()}/${endOfWeek.getMonth() + 1}`;
        startD = startOfWeek; endD = endOfWeek;
    } else if (currentNoteMode === 'monthly') {
        labelText = `${monthNames[currentNoteDate.getMonth()]} ${currentNoteDate.getFullYear()}`;
        startD = new Date(currentNoteDate.getFullYear(), currentNoteDate.getMonth(), 1);
        endD = new Date(currentNoteDate.getFullYear(), currentNoteDate.getMonth() + 1, 0);
    } else {
        labelText = `TAHUN ${currentNoteDate.getFullYear()}`;
        startD = new Date(currentNoteDate.getFullYear(), 0, 1);
        endD = new Date(currentNoteDate.getFullYear(), 11, 31);
    }

    label.textContent = labelText;

    // --- PENGUMPULAN DATA CATATAN ---
    Object.keys(storedNotes).forEach(dateKey => {
        const [y, m, d] = dateKey.split('-').map(Number);
        const noteDate = new Date(y, m, d);
        const checkTime = noteDate.getTime();
        const startTime = new Date(startD.getFullYear(), startD.getMonth(), startD.getDate()).getTime();
        const endTime = new Date(endD.getFullYear(), endD.getMonth(), endD.getDate()).getTime();
        if (checkTime >= startTime && checkTime <= endTime) {
            notesFound.push({ date: noteDate, items: storedNotes[dateKey], key: dateKey });
        }
    });

    notesFound.sort((a, b) => a.date - b.date);

    // --- TAMPILAN KOSONG ---
    if (notesFound.length === 0) {
        container.innerHTML = `
                <div class="flex flex-col items-center justify-center h-48 opacity-50">
                    <i class="fas fa-clipboard-list text-4xl mb-3 text-slate-400"></i>
                    <p class="text-sm font-medium text-slate-500">Tidak ada catatan</p>
                </div>
            `;
        return;
    }

    // --- PENGELOMPOKAN DATA ---
    const allNotes = [];
    notesFound.forEach(item => {
        item.items.forEach(note => {
            allNotes.push({
                ...note,
                dateKey: item.key,
                date: item.date,
                dateStr: `${item.date.getDate()} ${monthNames[item.date.getMonth()]} ${item.date.getFullYear()}`,
                dayName: dayNames[item.date.getDay()]
            });
        });
    });

    const grouped = { penting: [], kerja: [], pribadi: [], ide: [] };
    allNotes.forEach(note => {
        const cat = note.category || 'pribadi';
        if (grouped[cat]) grouped[cat].push(note);
    });

    // Sort waktu
    Object.keys(grouped).forEach(cat => {
        grouped[cat].sort((a, b) => {
            if (a.date.getTime() !== b.date.getTime()) return a.date - b.date;
            if (a.time && !b.time) return -1;
            if (!a.time && b.time) return 1;
            if (a.time && b.time) return a.time.localeCompare(b.time);
            return 0;
        });
    });

    // --- CONFIG WARNA PER KATEGORI (UPDATE UTAMA DI SINI) ---
    // Kita definisikan warna spesifik untuk badge & border
    const categoryConfig = {
        penting: { 
            label: 'Penting', 
            icon: 'fa-exclamation-circle', 
            // Warna Header
            headerColor: 'text-red-600',
            // Warna Item Catatan (Badge & Border)
            badgeBg: 'bg-red-100', 
            badgeText: 'text-red-600', 
            borderColor: 'border-red-500', 
            checkColor: 'text-red-500'
        },
        kerja: { 
            label: 'Kerja', 
            icon: 'fa-briefcase', 
            headerColor: 'text-blue-600',
            badgeBg: 'bg-blue-100', 
            badgeText: 'text-blue-600', 
            borderColor: 'border-blue-500', 
            checkColor: 'text-blue-500'
        },
        pribadi: { 
            label: 'Pribadi', 
            icon: 'fa-sticky-note', 
            headerColor: 'text-emerald-600',
            badgeBg: 'bg-emerald-100', 
            badgeText: 'text-emerald-600', 
            borderColor: 'border-emerald-500', 
            checkColor: 'text-emerald-500'
        },
        ide: { 
            label: 'Ide', 
            icon: 'fa-lightbulb', 
            headerColor: 'text-amber-600',
            badgeBg: 'bg-amber-100', 
            badgeText: 'text-amber-600', 
            borderColor: 'border-amber-500', 
            checkColor: 'text-amber-500'
        }
    };

    // --- RENDERING LOOP ---
    ['penting', 'kerja', 'pribadi', 'ide'].forEach(cat => {
        if (grouped[cat].length === 0) return;

        const config = categoryConfig[cat];

        // 1. HEADER KATEGORI (Tanpa Kotak Background, Font Lebih Besar)
        const categoryHeader = document.createElement('div');
        categoryHeader.className = `mb-2 mt-6 first:mt-0 px-2`; // px-2 agar sejajar visual
        categoryHeader.innerHTML = `
            <div class="flex items-center justify-between border-b border-slate-200 pb-2">
                <div class="flex items-center gap-2">
                    <i class="fas ${config.icon} ${config.headerColor} text-lg"></i>
                    <span class="text-base font-black ${config.headerColor} uppercase tracking-wider">${config.label}</span>
                </div>
                <span class="text-[0.65rem] font-black bg-white ${config.headerColor} px-2 py-0.5 rounded-full shadow-sm border border-slate-100">${grouped[cat].length}</span>
            </div>
        `;
        container.appendChild(categoryHeader);

        // 2. CONTAINER LIST CATATAN (Dengan Indentasi)
        const listWrapper = document.createElement('div');
        listWrapper.className = "pl-4 space-y-3"; // pl-4 memberikan indentasi ke kanan

        grouped[cat].forEach(note => {
            const el = document.createElement('div');
            
            // Perhatikan penggunaan variable config (borderColor) agar warna garis kiri sesuai kategori
            el.className = `bg-white p-3 rounded-xl shadow-sm border-l-4 ${config.borderColor} hover:bg-slate-50 transition relative overflow-hidden group`;

            const isDone = note.isCompleted;
            
            // Badge Waktu juga mengikuti nuansa warna kategori (opsional, atau tetap slate)
            // Di sini saya buat netral (slate) agar tidak terlalu ramai, tapi ikon check mengikuti kategori.
            const timeBadge = note.time ? `<span class="text-[0.6rem] font-bold bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded"><i class="far fa-clock mr-1"></i>${note.time}</span>` : '';

            el.innerHTML = `
                <div class="flex items-start gap-3">
                    <div class="mt-0.5 cursor-pointer" onclick="event.stopPropagation(); toggleNoteStatusInList('${note.dateKey}', '${note.id}')">
                        <i class="fas ${isDone ? `fa-check-circle ${config.checkColor}` : 'fa-circle text-slate-300'} text-lg transition-colors"></i>
                    </div>
                    
                    <div class="flex-1 ${isDone ? 'opacity-50 line-through decoration-slate-400' : ''}">
                        <p class="text-sm font-bold text-slate-700 leading-snug mb-1">${note.text}</p>
                        <div class="flex items-center gap-2 text-[0.65rem] text-slate-400 font-medium">
                            <span>${note.dayName}, ${note.dateStr}</span>
                            ${timeBadge}
                        </div>
                    </div>
                    
                    <button onclick="event.stopPropagation(); deleteNoteFromList('${note.dateKey}', '${note.id}')" class="text-slate-300 hover:text-red-500 transition px-2 opacity-0 group-hover:opacity-100">
                        <i class="fas fa-trash-alt"></i>
                    </button>
                </div>
            `;

            el.setAttribute('onclick', `openEditNoteModal('${note.dateKey}', '${note.id}')`);
            listWrapper.appendChild(el);
        });

        container.appendChild(listWrapper);
    });
}

// Helper functions for Catatanku
function toggleNoteStatusInList(dateKey, noteId) {
    toggleNoteStatus(dateKey, noteId);
    renderNotesList(); // Fix: use renderNotesList instead of updateNotesView
}

function deleteNoteFromList(dateKey, noteId) {
    if (confirm('Apakah Anda yakin ingin menghapus catatan ini?')) {
        deleteNote(dateKey, noteId);
        renderNotesList(); // Fix: use renderNotesList instead of updateNotesView
    }
}

function openCreateNoteModal() {
    const overlay = document.getElementById('selectorModal');
    const body = document.getElementById('modalBody');
    const title = document.getElementById('modalTitle');

    title.classList.remove('hidden'); title.textContent = "BUAT CATATAN BARU";
    body.className = "w-full";
    const today = new Date();
    const curD = today.getDate();
    const curM = today.getMonth();
    const curY = today.getFullYear();

    openModal('pos-center');

    body.innerHTML = `
            <div class="mb-4">
                <p class="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 text-center">Pilih Tanggal</p>
                <div class="flex gap-2 h-32 overflow-hidden relative mask-linear">
                    <div class="flex-1 w-full flex flex-col items-center overflow-x-hidden overflow-y-auto snap-y snap-mandatory scrollbar-none text-center bg-slate-50 rounded-lg" id="scrollDay"></div>
                    <div class="flex-1 w-full flex flex-col items-center overflow-x-hidden overflow-y-auto snap-y snap-mandatory scrollbar-none text-center bg-slate-50 rounded-lg" id="scrollMonth"></div>
                    <div class="flex-1 w-full flex flex-col items-center overflow-x-hidden overflow-y-auto snap-y snap-mandatory scrollbar-none text-center bg-slate-50 rounded-lg" id="scrollYear"></div>
                    <div class="absolute top-1/2 left-0 right-0 h-8 -mt-4 border-t border-b border-slate-300 pointer-events-none bg-slate-900/5"></div>
                </div>
            </div>

            <div class="flex gap-3 mb-4">
                <div class="flex-1">
                    <p class="text-[0.6rem] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1">Kategori</p>
                    <select id="newNoteCategoryList" class="premium-select text-center font-bold" style="background:#f8fafc; border-color:#e2e8f0; height: 48px;" onchange="this.style.color = {pribadi:'#10b981', kerja:'#3b82f6', penting:'#ef4444', ide:'#f59e0b'}[this.value]">
                        <option value="pribadi" selected class="text-emerald-500 font-bold">Pribadi</option>
                        <option value="kerja" class="text-blue-500 font-bold">Kerja</option>
                        <option value="penting" class="text-red-500 font-bold">Penting</option>
                        <option value="ide" class="text-amber-500 font-bold">Ide</option>
                    </select>
                </div>
                <div class="flex-1">
                    <p class="text-[0.6rem] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1">Waktu</p>
                    <input type="time" id="newNoteTimeList" class="premium-select text-center font-bold" style="background:#f8fafc; border-color:#e2e8f0; height: 48px;">
                </div>
            </div>

            <textarea id="newNoteInput" class="w-full p-4 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-blue-500 transition h-32 resize-none bg-white mb-4 shadow-inner" placeholder="Tulis catatanmu di sini..."></textarea>
            <button onclick="confirmCreateNote()" class="w-full bg-slate-900 text-white p-3 rounded-xl font-bold text-xs tracking-wider shadow-lg hover:bg-slate-800 transition mb-6">SIMPAN CATATAN</button>
        `;

    const dContainer = document.getElementById('scrollDay');
    const mContainer = document.getElementById('scrollMonth');
    const yContainer = document.getElementById('scrollYear');
    const createSpacer = () => { const s = document.createElement('div'); s.style.minHeight = "48px"; s.style.width = "100%"; return s; };

    const initInfiniteScroll = (container, items, initialIndex) => {
        const itemHeight = 36;
        const renderSet = (offsetVal = 0) => {
            items.forEach((item, idx) => {
                const realVal = idx;
                const el = document.createElement('div');
                el.className = `w-full py-2 text-sm font-bold snap-center cursor-pointer flex-shrink-0 transition-all duration-150`;
                el.textContent = item;
                el.dataset.val = realVal;
                if (realVal === initialIndex && offsetVal === 1) {
                    el.classList.add('text-blue-600', 'scale-110');
                    el.classList.remove('text-slate-400');
                } else {
                    el.classList.add('text-slate-400');
                }
                el.onclick = function () { this.scrollIntoView({ behavior: 'smooth', block: 'center' }); };
                container.appendChild(el);
            });
        };
        container.innerHTML = '';
        container.appendChild(createSpacer());
        renderSet(0); renderSet(1); renderSet(2);
        container.appendChild(createSpacer());
        setTimeout(() => {
            const allItems = container.querySelectorAll(`div[data-val="${initialIndex}"]`);
            if (allItems.length >= 2) allItems[1].scrollIntoView({ block: 'center' });
        }, 50);
        container.onscroll = () => {
            const totalHeight = container.scrollHeight;
            const viewHeight = container.clientHeight;
            const scrollTop = container.scrollTop;
            if (scrollTop < 50) {
                const middleElement = container.querySelectorAll(`div[data-val="0"]`)[1];
                if (middleElement) middleElement.scrollIntoView({ block: 'start' });
            } else if (scrollTop > totalHeight - viewHeight - 50) {
                const middleElement = container.querySelectorAll(`div[data-val="${items.length - 1}"]`)[1];
                if (middleElement) middleElement.scrollIntoView({ block: 'end' });
            }
            const center = scrollTop + viewHeight / 2;
            Array.from(container.children).forEach(child => {
                if (!child.dataset.val) return;
                const childCenter = child.offsetTop + child.offsetHeight / 2;
                if (Math.abs(center - childCenter) < 20) {
                    child.classList.add('text-blue-600', 'scale-110');
                    child.classList.remove('text-slate-400');
                } else {
                    child.classList.remove('text-blue-600', 'scale-110');
                    child.classList.add('text-slate-400');
                }
            });
        };
    };

    const daysArr = Array.from({ length: 31 }, (_, i) => i + 1);
    initInfiniteScroll(dContainer, daysArr, curD - 1);
    const monthsShort = monthNames.map(m => m.substring(0, 3));
    initInfiniteScroll(mContainer, monthsShort, curM);
    yContainer.appendChild(createSpacer());
    for (let i = curY - 50; i <= curY + 50; i++) {
        const el = document.createElement('div');
        el.className = `w-full py-2 text-sm font-bold snap-center cursor-pointer flex-shrink-0 ${i === curY ? 'text-blue-600 scale-110' : 'text-slate-400'}`;
        el.textContent = i;
        el.dataset.val = i;
        el.onclick = function () { this.scrollIntoView({ behavior: 'smooth', block: 'center' }); };
        yContainer.appendChild(el);
    }
    yContainer.appendChild(createSpacer());
    setTimeout(() => {
        const activeY = yContainer.querySelector('.text-blue-600');
        if (activeY) activeY.scrollIntoView({ block: 'center' });
        yContainer.addEventListener('scroll', () => {
            const center = yContainer.scrollTop + yContainer.offsetHeight / 2;
            Array.from(yContainer.children).forEach(child => {
                if (!child.dataset.val) return;
                const childCenter = child.offsetTop + child.offsetHeight / 2;
                if (Math.abs(center - childCenter) < 20) {
                    child.classList.add('text-blue-600', 'scale-110');
                    child.classList.remove('text-slate-400');
                } else {
                    child.classList.remove('text-blue-600', 'scale-110');
                    child.classList.add('text-slate-400');
                }
            });
        });
    }, 100);

    openModal();
}

function confirmCreateNote() {
    // 1. Ambil Data (Sama seperti sebelumnya)
    const getVal = (id) => {
        const c = document.getElementById(id);
        if (!c) return 1;
        const center = c.scrollTop + c.offsetHeight / 2;
        let val = null; let minDiff = Infinity;
        Array.from(c.children).forEach(child => {
            if (child.dataset.val === undefined) return;
            const diff = Math.abs(center - (child.offsetTop + child.offsetHeight / 2));
            if (diff < minDiff) { minDiff = diff; val = child.dataset.val; }
        });
        return parseInt(val);
    };

    const dIndex = getVal('scrollDay');
    const m = getVal('scrollMonth') || new Date().getMonth();
    const y = getVal('scrollYear') || new Date().getFullYear();

    const text = document.getElementById('newNoteInput').value.trim();
    const category = document.getElementById('newNoteCategoryList').value;
    const time = document.getElementById('newNoteTimeList').value;

    if (!text) { alert('Tulis catatan dulu!'); return; }

    // 2. Simpan Data
    const d = (dIndex || 0) + 1;
    const dateKey = `${y}-${m}-${d}`;
    addNote(dateKey, text, category, time);

    // 3. LOGIKA TUTUP & KUNCI TAMPILAN (REVISI FINAL)

    // A. Tutup Modal Secara UI (Hapus class active)
    const overlay = document.getElementById('selectorModal');
    if (overlay) overlay.classList.remove('active');

    // B. Render Kalender (Background update)
    renderCalendar();

    // C. CEK STATUS: Apakah kita sedang di mode Catatan?
    if (isNotesView) {
        // Hapus hash #modal secara manual tanpa memicu event back yang liar
        // Kita gunakan replaceState agar tidak menambah history baru, tapi menghapus #modal
        if (location.hash === '#modal') {
            history.replaceState({ view: 'notes' }, '', '#notes');
        }

        // Render ulang list catatan
        renderNotesList();

        // PAKSA Container agar tetap terlihat (Override jika ada reset otomatis)
        setTimeout(() => {
            const calView = document.getElementById('calendarViewContainer');
            const noteView = document.getElementById('notesViewContainer');
            const btnDesktop = document.getElementById('btnToggleViewDesktop');

            if (calView) calView.classList.add('hidden');
            if (noteView) {
                noteView.classList.remove('hidden');
                noteView.classList.add('active');
                noteView.style.display = 'flex'; // Paksa flex
            }

            // Pastikan tombol sidebar desktop tetap benar statusnya
            if (btnDesktop) {
                btnDesktop.innerHTML = '<i class="fas fa-calendar-alt"></i> Kalender';
                btnDesktop.classList.add('bg-white/20');
            }
        }, 10); // Timeout kecil untuk memastikan urutan eksekusi

    } else {
        // Jika dari mode Kalender biasa, kembalikan history normal
        if (location.hash === '#modal') history.back();

        // Refresh detail popup
        if (lastDetailArgs) showDetail(...lastDetailArgs);
    }
}

function openEditNoteModal(dateKey, noteId) {
    const notes = getStoredNotes();
    const noteList = notes[dateKey];
    if (!noteList) return;
    const note = noteList.find(n => n.id == noteId);
    if (!note) return;

    const body = document.getElementById('modalBody');
    const title = document.getElementById('modalTitle');

    title.classList.remove('hidden'); title.textContent = "EDIT CATATAN";
    body.className = "w-full";

    openModal('pos-center');

    body.innerHTML = `
            <div class="mb-4">
                <p class="text-[0.6rem] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1 text-center">Tanggal: ${dateKey}</p>
            </div>

            <div class="flex gap-3 mb-4">
                <div class="flex-1">
                    <p class="text-[0.6rem] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1">Kategori</p>
                    <select id="editNoteCategory" class="premium-select text-center font-bold" style="background:#f8fafc; border-color:#e2e8f0; height: 48px;">
                        <option value="pribadi" ${note.category === 'pribadi' ? 'selected' : ''}>Pribadi</option>
                        <option value="kerja" ${note.category === 'kerja' ? 'selected' : ''}>Kerja</option>
                        <option value="penting" ${note.category === 'penting' ? 'selected' : ''}>Penting</option>
                        <option value="ide" ${note.category === 'ide' ? 'selected' : ''}>Ide</option>
                    </select>
                </div>
                <div class="flex-1">
                    <p class="text-[0.6rem] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1">Waktu</p>
                    <input type="time" id="editNoteTime" value="${note.time || ''}" class="premium-select text-center font-bold" style="background:#f8fafc; border-color:#e2e8f0; height: 48px;">
                </div>
            </div>

            <textarea id="editNoteInput" class="w-full p-4 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-blue-500 transition h-32 resize-none bg-white mb-4 shadow-inner" placeholder="Tulis catatanmu di sini...">${note.text}</textarea>
            <button onclick="confirmEditNote('${dateKey}', '${noteId}')" class="w-full bg-slate-900 text-white p-3 rounded-xl font-bold text-xs tracking-wider shadow-lg hover:bg-slate-800 transition mb-6">SIMPAN PERUBAHAN</button>
            `;
}

function confirmEditNote(dateKey, noteId) {
    // 1. Ambil Data
    const text = document.getElementById('editNoteInput').value.trim();
    const category = document.getElementById('editNoteCategory').value;
    const time = document.getElementById('editNoteTime').value;

    if (!text) { alert('Tulis catatan dulu!'); return; }

    // 2. Simpan Perubahan
    editNote(dateKey, noteId, text, category, time);

    // 3. Tutup Modal Secara Manual (Bypass closeModal standar agar lebih terkontrol)
    const overlay = document.getElementById('selectorModal');
    overlay.classList.remove('active');

    // Mundurkan history #modal
    if (location.hash === '#modal') history.back();

    // 4. Update Background
    renderCalendar();

    // 5. PENGAMAN POSISI (Keep in Notes View)
    if (isNotesView) {
        renderNotesList(); // Refresh list agar perubahan terlihat

        setTimeout(() => {
            const calView = document.getElementById('calendarViewContainer');
            const noteView = document.getElementById('notesViewContainer');

            if (calView) calView.classList.add('hidden');
            if (noteView) {
                noteView.classList.remove('hidden');
                noteView.classList.add('active');
                noteView.style.display = 'flex';
            }
        }, 20);
    } else {
        // Jika edit dari Popup Kalender, buka lagi popupnya (Refresh Data)
        if (lastDetailArgs) showDetail(...lastDetailArgs);
    }
}

function getHolidayName(d, m, y) {
    if (holidaysData[y] && holidaysData[y][m] && holidaysData[y][m][d]) return holidaysData[y][m][d];
    return null;
}
function getCutiBersamaName(d, m, y) {
    if (cutiBersamaData[y] && cutiBersamaData[y][m] && cutiBersamaData[y][m][d]) return cutiBersamaData[y][m][d];
    return null;
}
function getObservanceName(d, m) {
    if (settings.showObservances && nationalObservances[m] && nationalObservances[m][d]) return nationalObservances[m][d];
    return null;
}
function getBirthday(d, m) {
    if (!settings.showFamily) return null;
    return familyBirthdays.find(b => b.day === d && b.month === m);
}
function isAnniversary(d, m) {
    if (!settings.showFamily) return null;
    return weddingAnniversary.day === d && weddingAnniversary.month === m;
}

function renderCalendar() {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const now = new Date();
    const isCurrentMonthYear = (now.getFullYear() === year && now.getMonth() === month);
    const todayDayNum = now.getDate();
    document.getElementById('monthLabelMobile').textContent = monthNames[month];
    document.getElementById('yearLabelMobile').textContent = year;
    document.getElementById('desktopMonthDisplay').textContent = monthNames[month];
    document.getElementById('desktopYearDisplay').textContent = year;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDay = new Date(year, month, 1).getDay();
    const startH = getHijriDate(new Date(year, month, 1));
    const endH = getHijriDate(new Date(year, month, daysInMonth));

    // Cek jika perpindahan tahun hijriah terjadi di bulan ini
    let hijriYearStr = startH.year;
    if (startH.year !== endH.year) {
        hijriYearStr = `${startH.year} / ${endH.year}`;
    }

    const hijriStr = `${hijriMonths[startH.month]} - ${hijriMonths[endH.month]}`;

    document.getElementById('hijriRangeMobile').textContent = hijriStr;
    // Sekarang Tahunnya Dinamis mengambil dari startH.year
    document.getElementById('desktopHijri').textContent = `${hijriStr} ${hijriYearStr}H`;
    const d_hijri = settings.showHijri ? 'block' : 'none';
    document.getElementById('hijriRangeMobile').style.display = d_hijri;
    document.getElementById('desktopHijri').style.display = d_hijri;
    const grid = document.getElementById('calendarGrid');
    grid.innerHTML = '';
    dayShortNames.forEach(d => {
        const el = document.createElement('div');
        el.className = 'day-label'; el.textContent = d; grid.appendChild(el);
    });

    // DYNAMIC ROWS: Hitung berapa cell yang benar-benar dibutuhkan (kelipatan 7)
    const requiredCells = firstDay + daysInMonth;
    const totalCells = Math.ceil(requiredCells / 7) * 7;

    // Dynamic Grid Rows
    const gridElement = document.getElementById('calendarGrid');

    // Hapus class lama dulu
    gridElement.classList.remove('rows-5', 'rows-6');

    if (totalCells === 42) {
        // Jika 42 kotak (6 minggu)
        gridElement.classList.add('rows-6');
    } else {
        // Jika 35 kotak (5 minggu) atau 28 (4 minggu - jarang)
        gridElement.classList.add('rows-5');
    }
    // -------------------------------

    const prevMonthLastDate = new Date(year, month, 0).getDate();

    for (let i = 0; i < totalCells; i++) {
        // --- AWAL GANTI ISI LOOP ---
        const cell = document.createElement('div');
        let displayDate, targetMonth, targetYear, isOtherMonth = false;

        // 1. Tentukan Tanggal (Prev/Current/Next Month)
        if (i < firstDay) {
            displayDate = prevMonthLastDate - (firstDay - i - 1);
            targetMonth = month - 1; targetYear = year; isOtherMonth = true;
        } else if (i < firstDay + daysInMonth) {
            displayDate = i - firstDay + 1; targetMonth = month; targetYear = year;
        } else {
            displayDate = i - (firstDay + daysInMonth) + 1; targetMonth = month + 1; targetYear = year; isOtherMonth = true;
        }

        // 2. Buat Object Date
        const dateObj = new Date(targetYear, targetMonth, displayDate);
        const actualDay = dateObj.getDate();
        const actualMonth = dateObj.getMonth();
        const actualYear = dateObj.getFullYear();

        if (isOtherMonth) {
            cell.className = 'day-cell other-month';
            cell.innerHTML = `<span class="date-wrapper">${actualDay}</span>`;
        } else {
            const isToday = isCurrentMonthYear && actualDay === todayDayNum;
            const h = getHijriDate(dateObj); // Hijriah
            const dayOfWeek = dateObj.getDay();
            const isSunday = dayOfWeek === 0;
            const isFriday = dayOfWeek === 5;

            // Cek Event
            const holidayName = getHolidayName(actualDay, actualMonth, actualYear);
            const isHoliday = !!holidayName;
            const cutiName = getCutiBersamaName(actualDay, actualMonth, actualYear);
            const observanceName = getObservanceName(actualDay, actualMonth);
            const birthdayData = getBirthday(actualDay, actualMonth);
            const anniversaryData = isAnniversary(actualDay, actualMonth);

            // --- LOGIKA BARU: KUMPULKAN SEMUA EVENT & CATATAN ---
            let inCellEvents = [];
            if (birthdayData) inCellEvents.push({ text: `Ultah ${birthdayData.name}`, color: 'text-amber-600' });
            if (anniversaryData) inCellEvents.push({ text: `Anniversary`, color: 'text-pink-600' });
            if (holidayName) inCellEvents.push({ text: holidayName, color: 'text-red-600' });
            if (cutiName) inCellEvents.push({ text: cutiName, color: 'text-red-500' });
            if (observanceName) inCellEvents.push({ text: observanceName, color: 'text-blue-500' });

            // --- LOGIKA INDIKATOR CATATAN & DATA TOOLTIP ---
            const noteList = getNoteForDate(actualDay, actualMonth, actualYear);
            const noteCount = noteList ? noteList.length : 0;

            let noteDotHTML = '';
            if (noteCount > 0) {
                // Buka Wadah Dot (Untuk Tampilan Kalender Biasa)
                noteDotHTML = '<div class="note-indicator-row">';
                if (noteCount > 3) {
                    noteDotHTML += '<div class="note-line-long"></div>';
                } else {
                    for (let k = 0; k < noteCount; k++) {
                        noteDotHTML += '<div class="note-dash-small"></div>';
                    }
                }
                noteDotHTML += '</div>';

                // Masukkan Catatan ke inCellEvents (Untuk Popup Hover & Agenda dalam Kotak)
                noteList.forEach(note => {
                    inCellEvents.push({ text: note.text, color: 'text-emerald-600' });
                });
            }

            // --- GENERATE HTML FINAL (AGENDA DALAM KOTAK & TOOLTIP HOVER) ---
            let inCellHTML = '';
            let tooltipDataString = '';

            if (inCellEvents.length > 0) {
                // 1. HTML untuk Agenda di Bawah Kotak (Saat Panel Kanan Ditutup)
                inCellHTML = '<div class="in-cell-agenda">';
                const showBullet = inCellEvents.length > 1;

                inCellEvents.forEach(evt => {
                    const bulletHTML = showBullet ? '<span class="agenda-bullet">&bull;</span>' : '';
                    inCellHTML += `
                                <div class="agenda-text-row ${evt.color}">
                                    ${bulletHTML}${evt.text}
                                </div>`;
                });
                inCellHTML += '</div>';

                // 2. HTML untuk Popup Hover (Tooltip)
                tooltipDataString = inCellEvents.map(e =>
                    `<div class='flex items-center gap-2 mb-1.5 last:mb-0'>
                                <span class='w-1.5 h-1.5 rounded-full bg-current opacity-70'></span>
                                <span class='font-medium'>${e.text}</span>
                            </div>`
                ).join('');
            }

            // --- LOGIKA DOT LAINNYA ---
            const cutiDotHTML = !!cutiName ? `<div class="cuti-dot"></div>` : '';
            const obsDotHTML = !!observanceName ? `<div class="obs-dot"></div>` : '';

            // Pasaran
            const refDate = new Date(2026, 1, 1);
            const diff = Math.floor((dateObj - refDate) / 86400000);
            let pasaranIdx = (3 + (diff % 5)) % 5;
            if (pasaranIdx < 0) pasaranIdx += 5;
            const pasaranContent = settings.showPasaran ? `<span class="pasaran-text">${pasaranArr[pasaranIdx]}</span>` : '';

            // Hijriah
            let hijriContent = '';
            let hDayModal = h.day; let hMonthModal = hijriMonths[h.month]; let hYearModal = h.year;
            let isHardcodedStatus = h.isHardcoded;

            if (settings.showHijri) {
                if (h.day === 1) {
                    let badgeBg = 'bg-slate-600';
                    if (isSunday || isHoliday) badgeBg = 'bg-red-500';
                    else if (isFriday) badgeBg = 'bg-emerald-500';
                    hijriContent = `<div class="hijri-badge ${badgeBg}">${h.day}</div>`;
                } else {
                    hijriContent = `<span class="hijri-text">${h.day}</span>`;
                }
            }

            // Tentukan Class CSS Cell
            let cellClass = `day-cell ${isToday ? 'today' : ''}`;
            if (isToday && highlightTriggered) cellClass += ' today-jump-animation';
            if (anniversaryData) cellClass += ' anniversary';
            else if (birthdayData) cellClass += ' birthday';
            else if (isSunday || isHoliday) cellClass += ' sunday';
            else if (isFriday) cellClass += ' friday';

            cell.className = cellClass;

            // --- RENDER HTML CELL ---
            cell.innerHTML = `
                    <span class="date-wrapper">
                        ${actualDay}
                        ${cutiDotHTML}
                        ${obsDotHTML}
                        ${noteDotHTML}
                    </span>
                    
                    <div class="cell-bottom-row">
                        ${pasaranContent}
                        ${hijriContent}
                    </div>
                    ${inCellHTML}
                    `;

            // --- PASANG EVENT HOVER TOOLTIP JIKA ADA DATA ---
            if (tooltipDataString !== '') {
                cell.dataset.tooltip = tooltipDataString;
                cell.onmouseenter = (e) => showHoverTooltip(e, cell);
                cell.onmouseleave = hideHoverTooltip;
            }

            // OnClick Event
            // OnClick Event
            cell.onclick = () => {
                // --- TAMBAHAN LOGIKA ANIMASI KENYAL ---
                if (window.innerWidth < 1024) { 
                    cell.classList.remove('cell-tap-animate');
                    void cell.offsetWidth; // Trigger reflow
                    cell.classList.add('cell-tap-animate');
                    
                    if (navigator.vibrate) navigator.vibrate(10); 

                    // Berikan delay 100ms agar user bisa melihat selnya "membal" 
                    // sebelum tertutup oleh popup detail
                    setTimeout(() => {
                        showDetail(actualDay, actualMonth, actualYear, dayNames[dayOfWeek], pasaranArr[pasaranIdx], hDayModal, hMonthModal, hYearModal, holidayName, cutiName, observanceName, isSunday, birthdayData, anniversaryData, isHardcodedStatus);
                    }, 100);
                } else {
                    // Desktop: Langsung buka tanpa animasi/delay
                    showDetail(actualDay, actualMonth, actualYear, dayNames[dayOfWeek], pasaranArr[pasaranIdx], hDayModal, hMonthModal, hYearModal, holidayName, cutiName, observanceName, isSunday, birthdayData, anniversaryData, isHardcodedStatus);
                }
            }; // Tutup cell.onclick

            // Pastikan grid.appendChild berada DI LUAR cell.onclick
            grid.appendChild(cell);
        // --- AKHIR GANTI ISI LOOP ---
    }}
    renderEventsList(month, year);
    if (highlightTriggered) setTimeout(() => { highlightTriggered = false; }, 2000);
}

// --- FUNGSI UNTUK MENAMPILKAN POPUP SAAT MOUSE HOVER ---
function showHoverTooltip(e, cell) {
    if (window.innerWidth < 1024) return; // Hanya aktif di Desktop/Web View

    const tooltip = document.getElementById('calendarHoverTooltip');
    if (!tooltip || !cell.dataset.tooltip) return;

    // Isi konten HTML dari data yang sudah disiapkan
    tooltip.innerHTML = cell.dataset.tooltip;

    // Hitung posisi kotak tanggal yang di-hover
    const rect = cell.getBoundingClientRect();

    // Set posisi X tepat di tengah kotak
    const x = rect.left + (rect.width / 2);
    // Set posisi Y di atas kotak (dikurangi 8px untuk jarak)
    let y = rect.top - 8;

    // Persiapkan tooltip agar bisa diukur tingginya
    tooltip.style.left = `${x}px`;
    tooltip.classList.remove('tooltip-bottom');
    tooltip.style.transform = `translate(-50%, -100%)`; // Geser ke atas sebesar tingginya sendiri

    // PENGAMAN: Jika tanggal ada di baris paling atas dan popup terpotong layar atas
    // Maka kita pindah popupnya ke bawah kotak
    if (y - tooltip.offsetHeight < 0) {
        y = rect.bottom + 8;
        tooltip.style.transform = `translate(-50%, 0)`;
        tooltip.classList.add('tooltip-bottom'); // Putar panahnya ke atas
    }

    tooltip.style.top = `${y}px`;
    tooltip.classList.add('show');
}

function hideHoverTooltip() {
    const tooltip = document.getElementById('calendarHoverTooltip');
    if (tooltip) tooltip.classList.remove('show');
}

function renderEventsList(month, year) {
    let htmlContent = '';
    const realToday = new Date();
    const tDay = realToday.getDate(); const tMonth = realToday.getMonth(); const tYear = realToday.getFullYear();
    if (settings.showFamily && weddingAnniversary.month === month) {
        const annAge = year - weddingAnniversary.year;
        if (annAge > 0) {
            const isToday = (weddingAnniversary.day === tDay && month === tMonth);
            htmlContent += `<div class="anniversary-item ${isToday ? 'highlight-today' : ''} flex justify-between items-center cursor-pointer hover:scale-[1.02] transition">
                    <div class="flex flex-col"><span class="text-[0.7rem] font-bold text-pink-800">${weddingAnniversary.day} ${monthNames[month]}</span><span class="text-[0.6rem] text-pink-600 font-semibold">Anniversary Pernikahan ❤️</span></div><span class="text-[0.65rem] font-bold text-pink-700 bg-pink-100 px-2 py-1 rounded-full">Ke-${annAge}</span></div>`;
        }
    }
    if (settings.showFamily) {
        const monthBirthdays = familyBirthdays.filter(b => b.month === month).sort((a, b) => a.day - b.day);
        monthBirthdays.forEach(b => {
            const age = year - b.year; const isToday = (b.day === tDay && month === tMonth);
            htmlContent += `<div class="birthday-item ${isToday ? 'highlight-today' : ''} flex justify-between items-center cursor-pointer hover:scale-[1.02] transition">
                    <div class="flex flex-col"><span class="text-[0.7rem] font-bold text-amber-800">${b.day} ${monthNames[month]}</span><span class="text-[0.6rem] text-amber-600 font-semibold truncate w-32">Ulang Tahun ${b.name}</span></div><span class="text-[0.65rem] font-bold text-amber-700 bg-amber-100 px-2 py-1 rounded-full">Ke-${age}</span></div>`;
        });
    }
    let mergedEvents = [];
    const storedNotes = getStoredNotes();
    Object.keys(storedNotes).forEach(dateKey => {
        const [nY, nM, nD] = dateKey.split('-').map(Number);
        if (nY === year && nM === month) {
            const noteArr = storedNotes[dateKey];
            if (Array.isArray(noteArr) && noteArr.length > 0) {
                // Push GROUP object instead of single text
                mergedEvents.push({ day: nD, type: 'note-group', items: noteArr });
            }
        }
    });
    if (holidaysData[year] && holidaysData[year][month]) {
        Object.keys(holidaysData[year][month]).forEach(d => mergedEvents.push({ day: parseInt(d), name: holidaysData[year][month][d], type: 'holiday' }));
    }
    if (cutiBersamaData[year] && cutiBersamaData[year][month]) {
        Object.keys(cutiBersamaData[year][month]).forEach(d => mergedEvents.push({ day: parseInt(d), name: cutiBersamaData[year][month][d], type: 'cuti' }));
    }
    if (settings.showObservances && nationalObservances[month]) {
        Object.keys(nationalObservances[month]).forEach(d => mergedEvents.push({ day: parseInt(d), name: nationalObservances[month][d], type: 'observance' }));
    }
    mergedEvents.sort((a, b) => a.day - b.day);
    mergedEvents.forEach(evt => {
        const isToday = (evt.day === tDay && month === tMonth && year === tYear);

        if (evt.type === 'note-group') {
            // --- RENDER GROUP NOTE ---
            const items = evt.items;
            if (items.length === 1) {
                // SINGLE NOTE
                const n = items[0];
                let iconClass = 'fa-sticky-note text-emerald-500';
                if (n.category === 'kerja') iconClass = 'fa-briefcase text-blue-500';
                else if (n.category === 'penting') iconClass = 'fa-exclamation-circle text-red-500';
                else if (n.category === 'ide') iconClass = 'fa-lightbulb text-amber-500';

                const timeBadge = n.time ? `<span class="ml-1 text-[0.55rem] font-bold bg-slate-100 text-slate-500 px-1 rounded">${n.time}</span>` : '';

                htmlContent += `<div class="note-item ${isToday ? 'highlight-today' : ''} flex justify-between items-center cursor-pointer hover:scale-[1.02] transition" onclick="showDetail(${evt.day}, ${month}, ${year}, '${dayNames[new Date(year, month, evt.day).getDay()]}', '', '', '', '', null, null, null, false, null, null, false)">
                        <span class="text-[0.7rem] font-bold text-slate-800 w-8">${evt.day} ${monthNames[month].substring(0, 3)}</span>
                        <div class="flex-1 flex items-center justify-end gap-1 overflow-hidden">
                             <i class="fas ${iconClass} text-[0.6rem]"></i>
                             <span class="text-[0.65rem] text-emerald-700 font-medium truncate">${n.text}</span>
                             ${timeBadge}
                        </div>
                        </div>`;
            } else {
                // MULTIPLE NOTES (Expandable)
                // SORT by time first
                items.sort((a, b) => {
                    if (a.time && !b.time) return -1;
                    if (!a.time && b.time) return 1;
                    if (a.time && b.time) return a.time.localeCompare(b.time);
                    return 0;
                });

                let subListHTML = '';
                items.forEach(n => {
                    let iconClass = 'fa-sticky-note text-emerald-500';
                    if (n.category === 'kerja') iconClass = 'fa-briefcase text-blue-500';
                    else if (n.category === 'penting') iconClass = 'fa-exclamation-circle text-red-500';
                    else if (n.category === 'ide') iconClass = 'fa-lightbulb text-amber-500';
                    const timeStr = n.time ? n.time : '--:--';

                    subListHTML += `
                             <div class="flex items-center gap-2 py-1 border-b border-slate-100 last:border-0 pl-2">
                                <span class="text-[0.6rem] font-bold text-slate-400 w-8">${timeStr}</span>
                                <i class="fas ${iconClass} text-[0.6rem] w-3 text-center"></i>
                                <span class="text-[0.65rem] text-slate-600 truncate flex-1">${n.text}</span>
                             </div>`;
                });

                htmlContent += `
                        <details class="note-item ${isToday ? 'highlight-today' : ''} group open:bg-emerald-50 transition-all duration-300 overflow-hidden">
                            <summary class="flex justify-between items-center cursor-pointer list-none p-0">
                                <span class="text-[0.7rem] font-bold text-slate-800 w-8">${evt.day} ${monthNames[month].substring(0, 3)}</span>
                                <div class="flex-1 flex items-center justify-end gap-1">
                                    <span class="text-[0.65rem] font-bold bg-emerald-100 text-emerald-600 px-2 py-0.5 rounded-full">${items.length} Catatan</span>
                                    <i class="fas fa-chevron-down text-[0.6rem] text-slate-400 group-open:rotate-180 transition-transform"></i>
                                </div>
                            </summary>
                            <div class="mt-2 pt-2 border-t border-emerald-100 bg-white/50 rounded-lg">
                                ${subListHTML}
                                <div class="text-center mt-1">
                                    <button onclick="showDetail(${evt.day}, ${month}, ${year}, '${dayNames[new Date(year, month, evt.day).getDay()]}', '', '', '', '', null, null, null, false, null, null, false)" class="text-[0.6rem] font-bold text-emerald-600 hover:text-emerald-800 uppercase tracking-wider py-1">Lihat Detail</button>
                                </div>
                            </div>
                        </details>`;
            }
        } else {
            // --- RENDER STANDARD EVENT (Holiday, Cuti, Observance) ---
            let colorClass, itemClass;
            if (evt.type === 'observance') { colorClass = 'text-blue-600'; itemClass = 'observance-item'; }
            else { colorClass = 'text-red-600'; itemClass = 'holiday-item'; }

            htmlContent += `<div class="${itemClass} ${isToday ? 'highlight-today' : ''} flex justify-between items-center cursor-pointer hover:scale-[1.02] transition">
                    <span class="text-[0.7rem] font-bold text-slate-800 w-10">${evt.day} ${monthNames[month].substring(0, 3)}</span><span class="text-[0.65rem] ${colorClass} font-medium text-right w-2/3 leading-tight line-clamp-2">${evt.name}</span></div>`;
        }
    });
    document.getElementById('holidayContainerMobile').innerHTML = htmlContent;
    document.getElementById('holidayContainerDesktop').innerHTML = htmlContent;
    if (!isNotesView) {
        const mobileContainer = document.getElementById('mobileInfoSection');
        if (mobileContainer) {
            mobileContainer.scrollTop = 0;
            setTimeout(() => {
                const todayEvent = document.querySelector('.highlight-today');
                if (todayEvent) todayEvent.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
            }, 600);
        }
    }
}

function goToToday() {
    const now = new Date();
    const isSameMonthYear = (currentDate.getFullYear() === now.getFullYear() && currentDate.getMonth() === now.getMonth());
    highlightTriggered = true;

    // Jika di halaman Catatanku, balik dulu ke Kalender
    if (isNotesView) {
        toggleNotesView();
    }

    if (isSameMonthYear) renderCalendar();
    else {
        const dir = (now.getFullYear() > currentDate.getFullYear() || (now.getFullYear() === now.getFullYear() && now.getMonth() > currentDate.getMonth())) ? 1 : -1;
        const originalTransition = settings.transitionType;
        settings.transitionType = 'zoom';
        changeMonth(dir, now);
        setTimeout(() => { settings.transitionType = originalTransition; }, 1000);
    }
}

function updateQuote() {
    const idx = Math.floor(Math.random() * quotes.length);
    const q = `"${quotes[idx]}"`;
    document.getElementById('quoteDisplayMobile').textContent = q;
    document.getElementById('quoteDisplayDesktop').textContent = q;
}

function changeMonth(dir, targetDate = null) {
    // --- BAGIAN BARU: Cek Transisi 'None' di Awal ---
    // Jika user memilih "None", kita langsung ubah tanggal dan render ulang.
    // Kita gunakan 'return' agar kode animasi di bawahnya TIDAK dijalankan sama sekali.
    if (settings.transitionType === 'none') {
        if (targetDate) {
            currentDate = new Date(targetDate);
        } else {
            // Ubah tanggal ke tanggal 1 bulan berikutnya/sebelumnya
            currentDate.setDate(1);
            currentDate.setMonth(currentDate.getMonth() + dir);
        }
        renderCalendar();
        updateQuote();
        return; // <--- INI KUNCINYA: Berhenti di sini, jangan lanjut ke animasi/setTimeout
    }

    // --- BAGIAN LAMA (ANIMASI) ---
    // Kode di bawah ini hanya akan jalan jika transitionType BUKAN 'none'

    if (isAnimating) return;
    isAnimating = true;

    const container = document.getElementById('gridContainer');
    const type = settings.transitionType;

    const applyTransitionOut = () => {
        container.style.opacity = '0';
        switch (type) {
            case 'slide': container.style.transform = dir > 0 ? 'translateX(-15%)' : 'translateX(15%)'; break;
            case 'cube': container.style.transformOrigin = dir > 0 ? 'left center' : 'right center'; container.style.transform = dir > 0 ? 'rotateY(-90deg) scale(0.85) translateZ(50px)' : 'rotateY(90deg) scale(0.85) translateZ(50px)'; break;
            case 'zoom': container.style.transform = 'scale(0.8)'; break;
            case 'flip': container.style.transform = 'rotateY(180deg)'; break;
        }
    };

    const applyTransitionIn = () => {
        container.style.transition = 'none';
        switch (type) {
            case 'slide': container.style.transform = dir > 0 ? 'translateX(15%)' : 'translateX(-15%)'; break;
            case 'cube': container.style.transformOrigin = dir > 0 ? 'right center' : 'left center'; container.style.transform = dir > 0 ? 'rotateY(90deg) scale(0.85) translateZ(50px)' : 'rotateY(-90deg) scale(0.85) translateZ(50px)'; break;
            case 'zoom': container.style.transform = 'scale(1.2)'; break;
            case 'flip': container.style.transform = 'rotateY(-180deg)'; break;
        }
    };

    const resetTransition = () => {
        const duration = type === 'cube' || type === 'flip' ? '0.3s' : '0.2s';
        const easing = type === 'cube' ? 'cubic-bezier(0.175, 0.885, 0.32, 1.275)' : 'cubic-bezier(0.4, 0, 0.2, 1)';
        container.style.transition = `transform ${duration} ${easing}, opacity 0.3s`;
        container.style.transform = 'translateX(0) rotateY(0deg) scale(1) translateZ(0)';
        container.style.opacity = '1';
    };

    // Eksekusi Animasi
    applyTransitionOut();

    // setTimeout ini yang bikin lag di versi lama, sekarang hanya jalan kalau ada animasi
    setTimeout(() => {
        if (targetDate) currentDate = new Date(targetDate);
        else { currentDate.setDate(1); currentDate.setMonth(currentDate.getMonth() + dir); }

        renderCalendar();
        updateQuote();
        applyTransitionIn();

        setTimeout(() => {
            resetTransition();
            setTimeout(() => isAnimating = false, 500);
        }, 50);
    }, 250);
}

function openSettings() {
    // ... (kode awal overlay, body, title tetap sama) ...
    const overlay = document.getElementById('selectorModal');
    const body = document.getElementById('modalBody');
    const title = document.getElementById('modalTitle');

    overlay.classList.remove('pos-top');
    overlay.classList.add('pos-center');
    title.classList.remove('hidden');
    title.textContent = "PENGATURAN";
    body.className = "p-4 space-y-4 w-full"; 

    // --- 0. TAMBAHAN: LOGIKA TOMBOL LOGIN (UNTUK MOBILE) ---
    // Logika ini untuk mengubah warna & teks tombol berdasarkan status login
    let loginBtnColor = currentUser ? "bg-red-600 text-white hover:bg-red-700" : "bg-blue-600 text-white hover:bg-blue-700";
    let loginBtnText = currentUser ? `LOGOUT (${currentUser.displayName.split(' ')[0]})` : "LOGIN GOOGLE";
    let loginIcon = currentUser ? "fas fa-sign-out-alt" : "fab fa-google";
    // Aksi: Jalankan toggleGoogleAuth lalu tutup modal pengaturan
    let loginAction = "toggleGoogleAuth(); closeModal();";

    const loginSectionHTML = `
        <div class="mb-2">
            <button onclick="${loginAction}" class="w-full ${loginBtnColor} p-3 rounded-xl font-bold text-sm shadow-lg flex items-center justify-center gap-2 transition active:scale-95">
                <i class="${loginIcon}"></i>
                <span>${loginBtnText}</span>
            </button>
        </div>
    `;

    // --- 1. LOGIKA STATUS NOTIFIKASI (TETAP SAMA) ---
    let isNotifOn = false;
    let notifLabel = "Belum Aktif";
    let notifSub = "Ketuk untuk mengaktifkan";
    let toggleClass = ""; // Kosong = OFF
    let iconClass = "fa-bell-slash"; // Ikon coret

    if (!('Notification' in window)) {
        notifLabel = "Tidak Support";
        notifSub = "Browser tidak mendukung";
    } else if (Notification.permission === 'granted') {
        isNotifOn = true;
        notifLabel = "Sudah Aktif";
        notifSub = "Ketuk untuk tes bunyi";
        toggleClass = "notif-active"; // Class CSS untuk warna Hijau
        iconClass = "fa-bell"; // Ikon lonceng
    } else if (Notification.permission === 'denied') {
        notifLabel = "Diblokir";
        notifSub = "Izinkan lewat pengaturan browser";
    }

    // --- 2. HTML NOTIFIKASI (TETAP SAMA) ---
    const notifSectionHTML = `
        <div class="flex justify-between items-center p-3 bg-slate-50 rounded-xl border border-slate-100 cursor-pointer ${toggleClass}" onclick="handleNotificationClick()">
            <div class="flex flex-col">
                <span class="font-bold text-sm text-slate-700">Notifikasi</span>
                <span class="text-[0.65rem] text-slate-400 font-bold uppercase tracking-wider">${notifLabel}</span>
                <span class="text-[0.6rem] text-slate-400 italic mt-0.5 leading-none">${notifSub}</span>
            </div>
            
            <div class="notif-toggle-pill">
                <div class="notif-toggle-circle">
                    <i class="fas ${iconClass} notif-toggle-icon"></i>
                </div>
            </div>
        </div>
    `;

    // --- 1. KOMPONEN TOGGLE BIASA (TETAP SAMA) ---
    const makeToggle = (label, key) => `
        <div class="flex justify-between items-center p-3 bg-slate-50 rounded-xl border border-slate-100">
            <span class="font-bold text-sm text-slate-700">${label}</span>
            <input type="checkbox" class="toggle-switch" ${settings[key] ? 'checked' : ''} onchange="toggleSetting('${key}')">
        </div>`;

    // --- 2. KOMPONEN MODE GELAP (TETAP SAMA) ---
    const darkModeHTML = `
        <div class="flex justify-between items-center p-3 bg-slate-50 rounded-xl border border-slate-100 cursor-pointer" onclick="toggleSetting('darkMode')">
            <div class="flex flex-col">
                <span class="font-bold text-sm text-slate-700">Mode Tampilan</span>
                <span class="text-[0.65rem] text-slate-400 font-bold uppercase tracking-wider">${settings.darkMode ? 'Mode Gelap (Malam)' : 'Mode Terang (Siang)'}</span>
            </div>
            
            <div class="theme-toggle-pill">
                <i class="fas fa-cloud toggle-bg-icon icon-cloud"></i>
                <i class="fas fa-star toggle-bg-icon icon-stars text-[0.5rem]"></i>
                <div class="theme-toggle-circle">
                    <i class="fas ${settings.darkMode ? 'fa-moon' : 'fa-sun'} theme-toggle-icon"></i>
                </div>
            </div>
        </div>
    `;

    // --- 3. KOMPONEN TEMA WARNA (TETAP SAMA) ---
    let themeButtonsHTML = '';
    themes.forEach((t, i) => {
        const isActive = i === currentThemeIndex;
        const activeClass = isActive ? `${t.borderColor} ring-2 ${t.ringColor}` : 'border-transparent';
        themeButtonsHTML += `<button id="themeBtn-${i}" onclick="applyTheme(${i})" class="w-10 h-10 rounded-full border-2 ${activeClass} ${t.colorBg} transition hover:scale-110 shadow-sm"></button>`;
    });

    const themeSectionHTML = `
        <div class="bg-slate-50 rounded-xl p-4 mt-2 border border-slate-100">
            <span class="block font-bold text-sm text-slate-700 mb-4 text-center">Pilih Tema Warna</span>
            <div class="grid grid-cols-4 gap-y-4 gap-x-2 justify-items-center mb-2">
                ${themeButtonsHTML}
            </div>
            <div class="text-center mt-4 pt-2 border-t border-slate-200">
                <span class="text-[0.65rem] font-bold text-slate-400 uppercase tracking-widest">Tema Aktif</span>
                <div class="text-xs font-bold text-slate-700 uppercase tracking-wider mt-1" id="themeNameModal">${themes[currentThemeIndex].name}</div>
            </div>
        </div>`;

    // --- 4. KOMPONEN TRANSISI (TETAP SAMA) ---
    const transitionHTML = `
        <div class="pt-2 mt-2 px-1">
            <span class="block font-bold text-[0.65rem] text-slate-400 uppercase tracking-widest mb-2">Efek Transisi</span>
            <select class="premium-select w-full" onchange="updateTransition(this.value)">
                <option value="none" ${settings.transitionType === 'none' ? 'selected' : ''}>None (Instant)</option>
                <option value="slide" ${settings.transitionType === 'slide' ? 'selected' : ''}>Slide</option>
                <option value="cube" ${settings.transitionType === 'cube' ? 'selected' : ''}>Cube Flip</option>
                <option value="fade" ${settings.transitionType === 'fade' ? 'selected' : ''}>Fade</option>
                <option value="zoom" ${settings.transitionType === 'zoom' ? 'selected' : ''}>Zoom</option>
                <option value="flip" ${settings.transitionType === 'flip' ? 'selected' : ''}>Flip Card</option>
            </select>
        </div>`;

    // --- 5. KOMPONEN INSTALL APP (TETAP SAMA) ---
    let installHTML = '';
    const appInstalled = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;

    if (appInstalled) {
        installHTML = `
            <div class="bg-green-50 border border-green-100 rounded-xl p-3 mt-4 flex items-center gap-3">
                <div class="w-8 h-8 bg-white rounded-full flex items-center justify-center text-green-600 shadow-sm">
                    <i class="fas fa-check"></i>
                </div>
                <div class="flex flex-col">
                    <span class="font-bold text-sm text-green-800">Aplikasi Terpasang</span>
                    <span class="text-[0.65rem] text-green-600">Versi PWA Aktif</span>
                </div>
            </div>`;
    } else {
        installHTML = `
            <div class="bg-slate-900 text-white rounded-xl p-4 mt-4 shadow-lg">
                <div class="flex justify-between items-center mb-2">
                    <span class="font-bold text-sm"><i class="fas fa-download mr-2"></i>Install Aplikasi</span>
                    <span class="text-[0.65rem] bg-white/20 px-2 py-0.5 rounded text-white">Gratis</span>
                </div>
                <p class="text-[0.7rem] text-slate-300 mb-3">Pasang agar lebih cepat & offline.</p>
                <button onclick="triggerInstallFromSettings()" class="w-full bg-white text-slate-900 py-2 rounded-lg text-xs font-bold hover:bg-slate-100 transition shadow-sm">
                    INSTALL SEKARANG
                </button>
            </div>`;
    }

    // --- 6. KOMPONEN BACKUP (TETAP SAMA) ---
    const backupHTML = `
        <div class="bg-blue-50 border border-blue-100 rounded-xl p-4 mt-6 mb-4">
            <span class="block font-bold text-sm text-blue-800 mb-2">Cadangkan Data</span>
            <p class="text-xs text-blue-600 mb-3 leading-relaxed">Simpan data catatan agar aman atau pulihkan dari file sebelumnya.</p>
            <div class="flex gap-2">
                <button onclick="exportData()" class="flex-1 bg-white border border-blue-200 text-blue-700 py-2.5 rounded-lg font-bold text-xs shadow-sm hover:bg-blue-50 transition flex items-center justify-center gap-2">
                    <i class="fas fa-download"></i> BACKUP
                </button>
                <label class="flex-1 bg-blue-600 text-white py-2.5 rounded-lg font-bold text-xs shadow-sm hover:bg-blue-700 transition text-center cursor-pointer flex items-center justify-center gap-2">
                    <i class="fas fa-upload"></i> RESTORE
                    <input type="file" class="hidden" accept=".json" onchange="importData(this)">
                </label>
            </div>
            <div class="text-center mt-3">
                 <span class="text-[0.65rem] text-blue-400/70 font-mono">Versi 4.2 • Offline Ready</span>
            </div>
        </div>`;

    // --- PENYUSUNAN AKHIR (Final HTML) ---
    // Di sini kita tambahkan loginSectionHTML di paling atas!
    let finalHTML =
        loginSectionHTML + // <--- INI DIA TOMBOL LOGIN MOBILE
        notifSectionHTML +
        darkModeHTML +
        makeToggle('Kalender Hijriah', 'showHijri') +
        makeToggle('Hari Pasaran', 'showPasaran') +
        makeToggle('Hari Peringatan', 'showObservances') +
        themeSectionHTML +
        transitionHTML +
        installHTML + 
        backupHTML + 
        '<div class="h-6"></div>';

    body.innerHTML = finalHTML;
    openModal('pos-center');
}

// GANTI FUNGSI handleNotificationClick YANG LAMA DENGAN INI

function handleNotificationClick() {
    // 1. Cek Dukungan
    if (!('Notification' in window)) {
        alert("Browser tidak mendukung notifikasi.");
        return;
    }

    // 2. Fungsi Helper untuk memicu Notifikasi via Service Worker (PENTING UNTUK MOBILE)
    const showPersistentNotification = async () => {
        if ('serviceWorker' in navigator) {
            const reg = await navigator.serviceWorker.ready;
            
            // Panggil notifikasi lewat Service Worker
            reg.showNotification("Tes Notifikasi Berhasil! 🔔", {
                body: "Sistem alarm Kalender BizDev sudah siap.",
                icon: "icons/icon_192.webp",
                badge: "icons/icon_192.webp",
                vibrate: [200, 100, 200], // Getar: zrrrt.. zrrrt..
                tag: 'test-notif' // Mencegah notifikasi numpuk
            });
        } else {
            // Fallback untuk browser PC lama
            new Notification("Tes Notifikasi Berhasil! 🔔", {
                body: "Sistem alarm Kalender BizDev sudah siap.",
                icon: "icons/icon_192.webp"
            });
        }
    };

    // 3. Logika Izin
    if (Notification.permission === 'granted') {
        showPersistentNotification();
    } else if (Notification.permission === 'denied') {
        alert("...");
    } else {
        Notification.requestPermission().then(permission => {
            openSettings(); // Refresh modal mobile
            
            // TAMBAHKAN INI: Refresh sidebar desktop
            updateDesktopSidebarUI(); 

            if (permission === 'granted') {
                showPersistentNotification();
            }
        });
    }
}

// --- UPDATE FUNGSI TOGGLE SETTING ---
function toggleSetting(key) {
    settings[key] = !settings[key];
    saveSettingsToStorage();

    // LOGIKA DARK MODE
    if (key === 'darkMode') {
        updateDarkModeVisuals(); // Panggil fungsi update visual
    }

    syncSettingsUI();
    renderCalendar();
}
// --- FUNGSI BARU: UPDATE VISUAL DARK MODE (ICON & CLASS) ---
function updateDarkModeVisuals() {
    const isDark = settings.darkMode;
    const body = document.body;

    // 1. Tambah/Hapus class body
    if (isDark) {
        body.classList.add('dark-mode');
    } else {
        body.classList.remove('dark-mode');
    }

    // 2. Update Ikon di Desktop Sidebar & Mobile Modal (Jika ikon FontAwesome tidak otomatis ganti via CSS)
    const icons = document.querySelectorAll('.theme-toggle-icon');
    icons.forEach(icon => {
        if (isDark) {
            icon.classList.remove('fa-sun');
            icon.classList.add('fa-moon');
        } else {
            icon.classList.remove('fa-moon');
            icon.classList.add('fa-sun');
        }
    });
}
function createScrollerItem(text, value, isActive) { const item = document.createElement('div'); item.className = `scroller-item ${isActive ? 'active' : ''}`; item.textContent = text; item.dataset.value = value; return item; }

function setupScrollSnapObserver(containerId) {
    const container = document.getElementById(containerId);
    let scrollTimeout;
    container.onscroll = () => {
        clearTimeout(scrollTimeout);
        scrollTimeout = setTimeout(() => {
            const center = container.scrollTop + (container.clientHeight / 2);
            const items = container.querySelectorAll('.scroller-item');
            let closest = null; let minDiff = Infinity;
            items.forEach(item => {
                const itemCenter = item.offsetTop + (item.offsetHeight / 2);
                const diff = Math.abs(center - itemCenter);
                if (diff < minDiff) { minDiff = diff; closest = item; }
                item.classList.remove('active');
            });
            if (closest) closest.classList.add('active');
        }, 50);
    };
}

function openMonthSelector() {
    const overlay = document.getElementById('selectorModal');
    const body = document.getElementById('modalBody');
    const title = document.getElementById('modalTitle');

    // 1. Tambahkan class khusus agar modal muncul di atas
    overlay.classList.add('pos-top');

    title.classList.remove('hidden');
    title.textContent = "PILIH BULAN";

    // Menggunakan grid yang sudah kita perbaiki sebelumnya
    body.className = "grid grid-cols-3 gap-3 p-2 pb-4"; // pb dikurangi dikit karena di atas lebih aman

    body.innerHTML = '';
    monthNames.forEach((m, i) => {
        const div = document.createElement('div');
        div.className = `p-3 text-center rounded-xl font-bold text-[0.75rem] cursor-pointer transition active:scale-95 ${currentDate.getMonth() === i ? 'bg-slate-900 text-white shadow-lg' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'}`;
        div.textContent = m;
        div.onclick = () => {
            currentDate.setMonth(i);
            renderCalendar();
            closeModal();
        };
        body.appendChild(div);
    });

    openModal('pos-top');
}

function openYearSelector() {
    const overlay = document.getElementById('selectorModal');
    const body = document.getElementById('modalBody');
    const title = document.getElementById('modalTitle');

    overlay.classList.add('pos-top');
    title.classList.remove('hidden');
    title.textContent = "PILIH TAHUN";
    body.className = "w-full";

    const currentYear = currentDate.getFullYear();
    // Tombol juga sudah dinaikkan (mb-8) sesuai request sebelumnya
    body.innerHTML = `<div class="scroller-wrapper"><div class="selection-indicator"></div><div class="scroller-col" id="yearListScroll"></div></div><button onclick="selectHighlightedYear()" class="w-full mt-4 bg-slate-900 text-white p-3 rounded-xl font-bold text-xs tracking-wider mb-4">PILIH TAHUN</button>`;

    const list = document.getElementById('yearListScroll');
    for (let y = currentYear - 100; y <= currentYear + 100; y++) list.appendChild(createScrollerItem(y, y, y === currentYear));

    openModal('pos-top');
    setupScrollSnapObserver('yearListScroll');
    setTimeout(() => { const active = list.querySelector('.active'); if (active) active.scrollIntoView({ block: 'center' }); }, 100);
}

function selectHighlightedYear() {
    const activeEl = document.querySelector('#yearListScroll .active');
    if (activeEl) { currentDate.setFullYear(parseInt(activeEl.dataset.value)); renderCalendar(); closeModal(); }
}

// --- FITUR PENCARIAN BARU (TEKS & TANGGAL) ---

// --- FITUR PENCARIAN BARU (FIXED LAYOUT & SCROLL) ---

function openDateSearch() {
    const overlay = document.getElementById('selectorModal');
    const body = document.getElementById('modalBody');
    const title = document.getElementById('modalTitle');

    // DETEKSI LAYAR: Jika Desktop (>1024px), pakai 'pos-center'. Jika HP, pakai 'pos-top'
    const isDesktop = window.innerWidth >= 1024;

    if (isDesktop) {
        overlay.classList.remove('pos-top');
        overlay.classList.add('pos-center'); // Desktop: Tengah
    } else {
        overlay.classList.remove('pos-center');
        overlay.classList.add('pos-top'); // Mobile: Atas
    }

    title.classList.remove('hidden');
    title.textContent = "PENCARIAN";
    
    // Reset padding agar kita bisa atur full area
    body.className = "w-full p-0"; 

    // STRUKTUR HTML
    // Perbaikan Desktop: 'lg:h-auto' agar tinggi menyesuaikan isi, 'lg:max-h-[500px]' batas maksimal
    // Kita hapus height fix di desktop agar background membungkus sempurna
    body.innerHTML = `
        <div class="flex flex-col h-[65vh] lg:h-[450px] lg:max-h-[60vh] bg-white rounded-b-xl overflow-hidden">
            
            <div class="flex-none p-4 pb-2">
                <div class="relative">
                    <input type="text" id="searchInput" placeholder="Cari catatan..." 
                        class="w-full p-3 pl-10 rounded-xl border border-slate-200 bg-slate-50 font-bold text-sm focus:outline-none focus:border-blue-500 transition shadow-inner text-slate-700"
                        autocomplete="off">
                    <i class="fas fa-search absolute left-3 top-3.5 text-slate-400"></i>
                </div>
            </div>

            <div id="searchResults" class="flex-1 overflow-y-auto min-h-0 px-4 custom-scrollbar">
                <div class="flex flex-col items-center justify-center h-full opacity-50">
                    <i class="fas fa-search text-4xl mb-3 text-slate-300"></i>
                    <p class="text-xs text-slate-400 font-medium">Ketik kata kunci di atas</p>
                </div>
            </div>

            <div class="flex-none p-4 pt-2 border-t border-slate-100 bg-white mt-auto z-10 relative">
                <button onclick="switchToDateScroller()" class="w-full bg-slate-100 text-slate-600 p-3 rounded-xl font-bold text-xs tracking-wider hover:bg-slate-200 transition flex items-center justify-center gap-2 shadow-sm">
                    <i class="fas fa-calendar-alt"></i> ATAU PILIH TANGGAL MANUAL
                </button>
            </div>

        </div>
    `;

    // Buka Modal sesuai posisi yang ditentukan di atas
    openModal(isDesktop ? 'pos-center' : 'pos-top');

    // Logic Pencarian (SAMA SEPERTI SEBELUMNYA)
    const input = document.getElementById('searchInput');
    setTimeout(() => input.focus(), 100);
    
    input.oninput = function() {
        const keyword = this.value.toLowerCase().trim();
        const container = document.getElementById('searchResults');
        
        if (!keyword) {
            container.innerHTML = `
                <div class="flex flex-col items-center justify-center h-full opacity-50">
                    <i class="fas fa-search text-4xl mb-3 text-slate-300"></i>
                    <p class="text-xs text-slate-400 font-medium">Ketik kata kunci di atas</p>
                </div>`;
            return;
        }

        const notes = getStoredNotes();
        let results = [];

        Object.keys(notes).forEach(dateKey => {
            const dayNotes = notes[dateKey];
            dayNotes.forEach(note => {
                if (note.text.toLowerCase().includes(keyword)) {
                    results.push({ dateKey: dateKey, ...note });
                }
            });
        });

        results.sort((a, b) => new Date(b.dateKey) - new Date(a.dateKey));

        if (results.length === 0) {
            container.innerHTML = `
                <div class="flex flex-col items-center justify-center h-full text-slate-400">
                    <i class="far fa-sad-tear text-2xl mb-2"></i>
                    <p class="text-xs font-bold">Tidak ada hasil "${keyword}"</p>
                </div>`;
        } else {
            container.innerHTML = '';
            results.forEach(res => {
                const [y, m, d] = res.dateKey.split('-').map(Number);
                const dateObj = new Date(y, m, d);
                const dateStr = `${d} ${monthNames[m]} ${y}`;
                
                let iconClass = 'fa-sticky-note text-emerald-500';
                if (res.category === 'kerja') iconClass = 'fa-briefcase text-blue-500';
                else if (res.category === 'penting') iconClass = 'fa-exclamation-circle text-red-500';
                else if (res.category === 'ide') iconClass = 'fa-lightbulb text-amber-500';

                const el = document.createElement('div');
                el.className = 'bg-white p-3 rounded-xl border border-slate-200 shadow-sm cursor-pointer hover:bg-blue-50 hover:border-blue-200 transition active:scale-95 group mb-2 last:mb-0';
                el.innerHTML = `
                    <div class="flex justify-between items-start mb-1">
                        <span class="text-[0.65rem] font-bold text-slate-400 uppercase tracking-wider group-hover:text-blue-400 transition">${dateStr}</span>
                        ${res.time ? `<span class="text-[0.6rem] bg-slate-100 text-slate-500 px-1.5 rounded font-bold group-hover:bg-white group-hover:text-blue-500 transition">${res.time}</span>` : ''}
                    </div>
                    <div class="flex items-start gap-2">
                        <i class="fas ${iconClass} mt-1 text-xs"></i>
                        <p class="text-sm font-medium text-slate-700 line-clamp-2 leading-snug">${highlightKeyword(res.text, keyword)}</p>
                    </div>
                `;
                
                el.onclick = () => {
                    const h = getHijriDate(dateObj);
                    const dayName = dayNames[dateObj.getDay()];
                    
                    const refDate = new Date(2026, 1, 1);
                    const diff = Math.floor((dateObj - refDate) / 86400000);
                    let pasaranIdx = (3 + (diff % 5)) % 5;
                    if (pasaranIdx < 0) pasaranIdx += 5;
                    const pasaranName = pasaranArr[pasaranIdx];

                    const holiday = getHolidayName(d, m, y);
                    const cuti = getCutiBersamaName(d, m, y);
                    const obs = getObservanceName(d, m);
                    const bday = getBirthday(d, m);
                    const anniv = isAnniversary(d, m);

                    closeModal();
                    currentDate = new Date(y, m, 1);
                    renderCalendar();

                    setTimeout(() => {
                        showDetail(d, m, y, dayName, pasaranName, h.day, hijriMonths[h.month], h.year, holiday, cuti, obs, (dateObj.getDay()===0), bday, anniv, h.isHardcoded);
                    }, 300);
                };
                container.appendChild(el);
            });
        }
    }
}

// Helper untuk menebalkan teks yang dicari
function highlightKeyword(text, keyword) {
    const regex = new RegExp(`(${keyword})`, 'gi');
    return text.replace(regex, '<span class="bg-yellow-200 text-slate-900 px-0.5 rounded">$1</span>');
}

// Fungsi untuk beralih ke Mode Scroller Tanggal (Fitur Lama)
function switchToDateScroller() {
    const body = document.getElementById('modalBody');
    const curM = currentDate.getMonth(); 
    const curY = currentDate.getFullYear();
    
    // Render ulang modal body dengan scroller lama
    body.innerHTML = `
        <div class="scroller-wrapper">
            <div class="selection-indicator"></div>
            <div class="scroller-col" id="monthScroller"></div>
            <div class="scroller-col" id="yearScroller"></div>
        </div>
        <button onclick="jumpToSelectedMonthYear()" class="w-full mt-4 bg-slate-900 text-white p-3 rounded-xl font-bold text-xs tracking-wider mb-2">LIHAT KALENDER</button>
        <button onclick="openDateSearch()" class="w-full text-slate-400 p-2 text-xs font-bold hover:text-slate-600 transition">KEMBALI KE PENCARIAN TEKS</button>
    `;

    // Re-init Scroller logic
    const mList = document.getElementById('monthScroller'); 
    const yList = document.getElementById('yearScroller');
    
    monthNames.forEach((m, i) => { mList.appendChild(createScrollerItem(m, i, i === curM)); });
    for (let y = curY - 50; y <= curY + 50; y++) { yList.appendChild(createScrollerItem(y, y, y === curY)); }
    
    setupScrollSnapObserver('monthScroller'); 
    setupScrollSnapObserver('yearScroller');
    
    setTimeout(() => {
        const activeM = mList.querySelector('.active'); 
        const activeY = yList.querySelector('.active');
        if (activeM) activeM.scrollIntoView({ block: 'center' }); 
        if (activeY) activeY.scrollIntoView({ block: 'center' });
    }, 100);
}

function jumpToSelectedMonthYear() {
    const activeM = document.querySelector('#monthScroller .active');
    const activeY = document.querySelector('#yearScroller .active');
    if (activeM && activeY) {
        currentDate.setDate(1); currentDate.setMonth(parseInt(activeM.dataset.value)); currentDate.setFullYear(parseInt(activeY.dataset.value));
        renderCalendar(); updateQuote(); closeModal();
    }
}

// Perhatikan penambahan parameter 'isHardcoded' di posisi terakhir
function showDetail(d, m, y, dayName, pasaranName, hDate, hMonth, hYear, holiday, cutiName, observanceName, isSunday, birthdayData, anniversaryData, isHardcoded) {
    try {
        const overlay = document.getElementById('selectorModal');
        const body = document.getElementById('modalBody');
        const title = document.getElementById('modalTitle');

        lastDetailArgs = [d, m, y, dayName, pasaranName, hDate, hMonth, hYear, holiday, cutiName, observanceName, isSunday, birthdayData, anniversaryData, isHardcoded];

        // 1. SETUP ELEMENT DOM
        title.classList.add('hidden');
        body.className = "p-4 text-center relative"; // Tambah relative untuk positioning

        // 2. LOGIKA WARNA & BADGE (Sama seperti sebelumnya)
        const detailQuote = quotes[Math.floor(Math.random() * quotes.length)];
        const isRedDay = isSunday || !!holiday;
        let dateColor = isRedDay ? "text-red-600" : "text-slate-900";
        let subColor = isRedDay ? "text-red-400" : "text-slate-400";
        if (birthdayData) { dateColor = "text-amber-600"; subColor = "text-amber-400"; }
        else if (anniversaryData) { dateColor = "text-pink-600"; subColor = "text-pink-400"; }

        let specialBadge = '';
        if (birthdayData) { const age = y - birthdayData.year; specialBadge += `<div class="mt-2 px-3 py-1 bg-amber-100 text-amber-700 rounded-full font-bold text-[0.65rem] uppercase tracking-wide border border-amber-200 inline-block mx-1 mb-1">🎉 ULTAH ${birthdayData.name} KE-${age}</div>`; }
        if (anniversaryData) { const annAge = y - weddingAnniversary.year; specialBadge += `<div class="mt-2 px-3 py-1 bg-pink-100 text-pink-700 rounded-full font-bold text-[0.65rem] uppercase tracking-wide border border-pink-200 inline-block mx-1 mb-1">💍 ANNIVERSARY KE-${annAge}</div>`; }
        if (holiday) specialBadge += `<div class="mt-2 px-3 py-1 bg-red-100 text-red-600 rounded-full font-bold text-[0.65rem] uppercase tracking-wide border border-red-200 inline-block mx-1 mb-1">${holiday}</div>`;
        if (cutiName) specialBadge += `<div class="mt-2 px-3 py-1 bg-red-50 text-red-500 rounded-full font-bold text-[0.65rem] uppercase tracking-wide border border-red-200 inline-block mx-1 mb-1">${cutiName}</div>`;
        if (observanceName) specialBadge += `<div class="mt-2 px-3 py-1 bg-blue-50 text-blue-500 rounded-full font-bold text-[0.65rem] uppercase tracking-wide border border-blue-200 inline-block mx-1 mb-1">${observanceName}</div>`;

        const pasaranText = settings.showPasaran ? pasaranName : '';
        let hijriTextDisplay = '';
        if (settings.showHijri && hDate) {
            hijriTextDisplay = isHardcoded ? `${hDate} ${hMonth} ${hYear}H` : `${hDate} ${hMonth}`;
        }

        // 3. AMBIL CATATAN
        const dateKey = `${y}-${m}-${d}`;
        const noteList = getNoteForDate(d, m, y);

        // Sort catatan
        noteList.sort((a, b) => {
            if (a.time && !b.time) return -1;
            if (!a.time && b.time) return 1;
            if (a.time && b.time) return a.time.localeCompare(b.time);
            return 0;
        });

        // --- RENDER LIST CATATAN (DENGAN SCROLL) ---
        let notesListHTML = '';
        if (noteList.length > 0) {
            // Kita beri max-height dan overflow-y-auto agar bisa discroll
            notesListHTML = `<div class="space-y-2 mb-4 max-h-[200px] overflow-y-auto pr-1 custom-scrollbar">`;
            noteList.forEach((n) => {
                const isDone = n.isCompleted;
                let catColor = 'border-slate-200';
                if (n.category === 'kerja') catColor = 'border-blue-400';
                else if (n.category === 'penting') catColor = 'border-red-400';
                else if (n.category === 'ide') catColor = 'border-amber-400';
                else catColor = 'border-emerald-400';

                notesListHTML += `
                        <div class="flex items-start gap-3 p-3 bg-white rounded-xl border-l-4 ${catColor} shadow-sm group text-left">
                            <div class="mt-0.5 cursor-pointer flex-shrink-0" onclick="toggleStatusAndRender('${dateKey}', '${n.id}', ${d}, ${m}, ${y})">
                                <i class="fas ${isDone ? 'fa-check-circle text-emerald-500' : 'fa-circle text-slate-300'} text-lg"></i>
                            </div>
                            <div class="flex-1 cursor-pointer overflow-hidden ${isDone ? 'opacity-50 line-through decoration-slate-400' : ''}" onclick="event.stopPropagation(); openEditNoteModal('${dateKey}', '${n.id}')">
                                <p class="text-sm font-medium text-slate-700 leading-snug break-words">${n.text}</p>
                                ${n.time ? `<span class="text-[0.65rem] font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded mt-1 inline-block"><i class="far fa-clock mr-1"></i>${n.time}</span>` : ''}
                            </div>
                            <button onclick="deleteNoteAndRender('${dateKey}', '${n.id}', ${d}, ${m}, ${y})" class="text-slate-300 hover:text-red-500 transition px-1 flex-shrink-0">
                                <i class="fas fa-trash-alt"></i>
                            </button>
                        </div>`;
            });
            notesListHTML += `</div>`;
        } else {
            notesListHTML = `<div class="text-center py-6 text-slate-400 text-xs italic">Belum ada catatan untuk hari ini.</div>`;
        }

        // 4. RENDER HTML UTAMA
        body.innerHTML = `
                    <div class="flex flex-col items-center justify-center mb-4">
                        <div class="text-5xl font-black ${dateColor} leading-none tracking-tighter">${d}</div>
                        <div class="text-xs font-bold ${subColor} uppercase mt-1 tracking-widest mb-1">${monthNames[m]} ${y}</div>
                        ${specialBadge}
                    </div>
                    
                    <div class="bg-white border border-slate-100 rounded-2xl p-3 shadow-sm mb-4">
                        <div class="text-lg font-black text-slate-800 uppercase tracking-tight">${dayName} ${pasaranText}</div>
                        <div class="text-xs font-medium text-slate-500 mt-1">${hijriTextDisplay}</div>
                    </div>
                    
                    <div class="bg-slate-50 border border-slate-100 rounded-2xl p-3 shadow-sm mb-4 text-left relative overflow-hidden">
                        <div class="flex justify-between items-center mb-3">
                            <label class="text-[0.65rem] font-bold text-slate-400 uppercase tracking-widest">Daftar Catatan</label>
                            <span class="text-[0.6rem] font-bold bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full">${noteList.length}</span>
                        </div>
                        
                        ${notesListHTML}

                        <button id="btnShowAddNote" onclick="toggleAddNoteForm(true)" class="w-full bg-white border border-slate-200 text-slate-600 p-2 rounded-xl font-bold text-xs hover:bg-slate-100 transition shadow-sm mt-2">
                            <i class="fas fa-plus-circle mr-1 text-emerald-500"></i> Tambah Catatan
                        </button>

                        <div id="addNoteForm" class="hidden absolute inset-0 bg-slate-50 z-20 flex flex-col p-3 rounded-2xl">
                            <div class="flex justify-between items-center mb-2">
                                <span class="text-xs font-bold text-slate-700">Catatan Baru</span>
                                <button onclick="toggleAddNoteForm(false)" class="text-slate-400 hover:text-red-500"><i class="fas fa-times"></i></button>
                            </div>
                            
                            <div class="flex gap-2 mb-2">
                                <select id="newNoteCategory" onchange="this.style.color = this.options[this.selectedIndex].style.color" class="bg-white border text-[0.65rem] font-bold uppercase tracking-wider border-slate-200 rounded-lg px-2 py-1 focus:outline-none flex-1" style="color: #94a3b8;">
                                    <option value="pribadi" selected style="color: #10b981;">Pribadi</option>
                                    <option value="kerja" style="color: #3b82f6;">Kerja</option>
                                    <option value="penting" style="color: #ef4444;">Penting</option>
                                    <option value="ide" style="color: #f59e0b;">Ide</option>
                                </select>
                                <input type="time" id="newNoteTime" class="bg-white border text-[0.65rem] font-bold text-slate-600 border-slate-200 rounded-lg px-2 py-1 focus:outline-none w-20">
                            </div>
                            
                            <textarea id="noteInput" class="flex-1 w-full p-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-blue-500 transition resize-none bg-white mb-2 shadow-inner" placeholder="Ketik di sini..."></textarea>
                            
                            <button onclick="addNoteAndRender('${dateKey}', ${d}, ${m}, ${y})" class="w-full bg-slate-900 text-white p-2 rounded-xl font-bold text-xs tracking-wider hover:bg-slate-800 transition shadow-md">
                                SIMPAN
                            </button>
                        </div>
                    </div>
                    
                    <div class="p-4 bg-slate-50 rounded-2xl border border-slate-100 mt-auto"> 
                        <i class="fas fa-quote-left text-slate-300 text-lg mb-1 block text-center"></i>
                        <p class="text-xs italic text-slate-600 leading-relaxed font-medium text-center">"${detailQuote}"</p>
                    </div>
                    
                    <div class="h-2"></div>
                `;

        openModal('pos-center');
    } catch (err) {
        console.error(err);
        alert("ERR: " + err.message);
    }
}

// FUNGSI PEMBANTU BARU (Wajib ditambahkan)
function toggleAddNoteForm(show) {
    const form = document.getElementById('addNoteForm');
    const btn = document.getElementById('btnShowAddNote');

    if (show) {
        form.classList.remove('hidden'); // Munculkan Form
        // Fokus otomatis ke textarea
        setTimeout(() => document.getElementById('noteInput').focus(), 100);
    } else {
        form.classList.add('hidden');    // Sembunyikan Form
    }
}

// --- HELPER UNTUK RE-RENDER MODAL SAAT ADA PERUBAHAN ---
// (Agar user tidak perlu tutup-buka modal setiap kali nambah/hapus)
function addNoteAndRender(dateKey, d, m, y) {
    const text = document.getElementById('noteInput').value;
    const category = document.getElementById('newNoteCategory').value;
    const time = document.getElementById('newNoteTime').value;

    if (text.trim()) {
        addNote(dateKey, text, category, time);
        // Refresh modal content (tanpa close)
        // Kita panggil showDetail lagi dengan semua parameter (agak hacky, tapi valid untuk single file simple)
        // Tapi kita butuh data-data lain (holiday, pasaran, dll). 
        // SOLUSI: Kita trigger click ulang pada tanggal di kalender? 
        // ATAU: Kita simpan last clicked data?
        // LEBIH BAIK: Kita update hanya bagian list HTML nya? Terlalu ribet manual DOM manipulation.
        // CARA MUDAH: Tutup lalu buka lagi? (Jelek UX)
        // CARA TERBAIK: Panggil ulang handler click elemen tanggal

        // Kita cari elemen tanggal yang sesuai di grid kalender dan klik secara programatik
        // Tapi day-cell tidak punya ID unik.

        // ALTERNATIF: Kita simpan argumen terakhir showDetail di variabel global?
        if (lastDetailArgs) {
            showDetail(...lastDetailArgs);
        }
    }
}

function deleteNoteAndRender(dateKey, id, d, m, y) {
    if (confirm('Hapus catatan ini?')) {
        deleteNote(dateKey, id);
        if (lastDetailArgs) showDetail(...lastDetailArgs);
    }
}

function toggleStatusAndRender(dateKey, id, d, m, y) {
    toggleNoteStatus(dateKey, id);
    if (lastDetailArgs) showDetail(...lastDetailArgs);
}



let modalClassTimeout = null;

function openModal(posClassName = '') {
    const overlay = document.getElementById('selectorModal');
    if (modalClassTimeout) { clearTimeout(modalClassTimeout); modalClassTimeout = null; }

    // Reset helper classes first
    overlay.classList.remove('pos-top', 'pos-center');
    // Then apply the requested one
    if (posClassName) overlay.classList.add(posClassName);

    overlay.classList.add('active');
    if (location.hash !== '#modal') {
        history.pushState({ view: 'modal' }, '', '#modal');
    }
}

function closeModal(fromHistory = false) {
    const overlay = document.getElementById('selectorModal');
    overlay.classList.remove('active');

    // 1. Bersihkan History jika perlu (Hapus #modal)
    if (!fromHistory && location.hash === '#modal') {
        history.back();
    }

    // 2. Hapus class helper posisi
    if (modalClassTimeout) clearTimeout(modalClassTimeout);
    modalClassTimeout = setTimeout(() => {
        overlay.classList.remove('pos-top');
        overlay.classList.remove('pos-center');
        modalClassTimeout = null;
    }, 300);

    // 3. LOGIKA PENGAMAN (SAFETY LOCK)
    // Ini yang mencegah aplikasi lari ke kalender saat klik di luar
    setTimeout(() => {
        if (typeof isNotesView !== 'undefined' && isNotesView) {
            // JIKA SEDANG DI MODE CATATAN:
            // Pastikan Container Catatan TETAP AKTIF
            const calView = document.getElementById('calendarViewContainer');
            const noteView = document.getElementById('notesViewContainer');
            const btnDesktop = document.getElementById('btnToggleViewDesktop');

            if (calView) calView.classList.add('hidden');
            if (noteView) {
                noteView.classList.remove('hidden');
                noteView.classList.add('active');
                noteView.style.display = 'flex'; // Paksa flex
            }

            // Pastikan tombol sidebar desktop konsisten
            if (btnDesktop) {
                btnDesktop.innerHTML = '<i class="fas fa-calendar-alt"></i> Kalender';
                btnDesktop.classList.add('bg-white/20');
            }
        }
        // Jika di Kalender, biarkan default (tidak perlu aksi apa-apa)
    }, 50); // Delay kecil agar tidak bentrok dengan event browser
}

function setupSwipe() {
    // 1. Swipe untuk Kalender (Ganti Bulan)
    let startX = 0; const area = document.getElementById('swipeArea');
    if (area) {
        area.addEventListener('touchstart', e => { startX = e.changedTouches[0].screenX; }, { passive: true });
        area.addEventListener('touchend', e => {
            const endX = e.changedTouches[0].screenX; if (endX < startX - 70) changeMonth(1); if (endX > startX + 70) changeMonth(-1);
        }, { passive: true });
    }

    // 2. Swipe untuk Catatanku (Ganti Minggu/Bulan/Tahun)
    const notesArea = document.getElementById('notesViewContainer');
    if (notesArea) {
        let sX = 0;
        notesArea.addEventListener('touchstart', e => { sX = e.changedTouches[0].screenX; }, { passive: true });
        notesArea.addEventListener('touchend', e => {
            const eX = e.changedTouches[0].screenX;
            if (eX < sX - 70) navNotes(1);  // Swipe Kiri -> Next
            if (eX > sX + 70) navNotes(-1); // Swipe Kanan -> Prev
        }, { passive: true });
    }
}

// Fungsi untuk buka-tutup sidebar
function toggleSidebar() {
    const sidebar = document.querySelector('.desktop-sidebar');
    const arrowBtn = document.getElementById('sidebarArrowBtn');
    const icon = arrowBtn.querySelector('i');

    if (sidebar) {
        // 1. Toggle class pada Sidebar (Logic lama)
        sidebar.classList.toggle('collapsed');

        // 2. Toggle class pada Tombol Panah (Logic baru)
        arrowBtn.classList.toggle('collapsed');

        // 3. Ganti Ikon Panah
        if (sidebar.classList.contains('collapsed')) {
            // Jika tertutup, panah menghadap KANAN (mengajak buka)
            icon.classList.remove('fa-chevron-left');
            icon.classList.add('fa-chevron-right');
            arrowBtn.setAttribute('title', 'Buka Menu');
        } else {
            // Jika terbuka, panah menghadap KIRI (mengajak tutup)
            icon.classList.remove('fa-chevron-right');
            icon.classList.add('fa-chevron-left');
            arrowBtn.setAttribute('title', 'Tutup Menu');
        }
    }
}

function toggleRightPanel() {
    const panel = document.getElementById('rightPanelDesktop');
    const arrowBtn = document.getElementById('rightArrowBtn');

    if (!panel || !arrowBtn) return;

    const icon = arrowBtn.querySelector('i');

    // 1. Toggle class pada Panel & Tombol
    panel.classList.toggle('collapsed');
    arrowBtn.classList.toggle('collapsed');

    // 2. LOGIKA BARU: Toggle Class pada Body untuk CSS Trigger
    if (panel.classList.contains('collapsed')) {
        document.body.classList.add('right-panel-closed'); // <--- INI KUNCINYA

        // Ganti Ikon Panah
        icon.classList.remove('fa-chevron-right');
        icon.classList.add('fa-chevron-left');
        arrowBtn.setAttribute('title', 'Buka Agenda');
    } else {
        document.body.classList.remove('right-panel-closed'); // <--- HAPUS CLASS

        // Ganti Ikon Panah
        icon.classList.remove('fa-chevron-left');
        icon.classList.add('fa-chevron-right');
        arrowBtn.setAttribute('title', 'Tutup Agenda');
    }
}

function setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
        // 1. PENGAMAN: Jangan jalan jika sedang mengetik di Input/Textarea
        // (Agar user tetap bisa select text pakai Shift+Panah di dalam input)
        if (e.target.matches('input, textarea, select')) return;

        // 2. PENGAMAN: Jangan jalan jika Modal sedang terbuka
        const modal = document.getElementById('selectorModal');
        if (modal && modal.classList.contains('active')) return;

        // --- LOGIKA UTAMA ---

        // TOMBOL KIRI
        if (e.key === 'ArrowLeft') {
            e.preventDefault(); // Cegah scroll browser

            if (e.shiftKey) {
                // KASUS: Shift + Kiri -> Toggle Sidebar Kiri
                toggleSidebar();
            } else {
                // KASUS: Kiri Biasa -> Navigasi
                if (typeof isNotesView !== 'undefined' && isNotesView) navNotes(-1);
                else changeMonth(-1);
            }
        }

        // TOMBOL KANAN
        if (e.key === 'ArrowRight') {
            e.preventDefault();

            if (e.shiftKey) {
                // KASUS: Shift + Kanan -> Toggle Panel Kanan
                toggleRightPanel();
            } else {
                // KASUS: Kanan Biasa -> Navigasi
                if (typeof isNotesView !== 'undefined' && isNotesView) navNotes(1);
                else changeMonth(1);
            }
        }

        // TOMBOL ATAS (Tahun Mundur)
        if (e.key === 'ArrowUp') {
            e.preventDefault();
            // Hanya aktif di kalender, bukan di notes (biar notes bisa discroll)
            if (typeof isNotesView !== 'undefined' && !isNotesView) {
                changeYearByKeyboard(-1);
            }
        }

        // TOMBOL BAWAH (Tahun Maju)
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (typeof isNotesView !== 'undefined' && !isNotesView) {
                changeYearByKeyboard(1);
            }
        }
    });
}

// Fungsi Helper Khusus Ganti Tahun via Keyboard
function changeYearByKeyboard(dir) {
    // Gunakan efek transisi 'zoom' sebentar agar terasa perpindahannya
    const originalTransition = settings.transitionType;
    if (settings.transitionType !== 'none') {
        // Trik visual: ganti transisi jadi zoom/fade sebentar
        settings.transitionType = 'fade';
    }

    // Ubah tahun
    currentDate.setFullYear(currentDate.getFullYear() + dir);
    renderCalendar();
    updateQuote();

    // Kembalikan setting transisi
    if (settings.transitionType !== 'none') {
        setTimeout(() => { settings.transitionType = originalTransition; }, 300);
    }
}

// --- SISTEM MONITORING ALARM (BARU) ---

let processedAlarms = new Set(); // Menyimpan ID alarm yang sudah bunyi agar tidak spam

function startAlarmSystem() {
    // Cek setiap 30 detik
    setInterval(() => {
        checkAlarms();
    }, 30000); 
}

function checkAlarms() {
    // 1. Cek Izin Notifikasi dulu
    if (Notification.permission !== 'granted') return;

    // 2. Ambil Waktu Sekarang
    const now = new Date();
    const currentH = String(now.getHours()).padStart(2, '0');
    const currentM = String(now.getMinutes()).padStart(2, '0');
    const currentTimeStr = `${currentH}:${currentM}`; // Format "14:30"
    
    // 3. Ambil Tanggal Hari Ini (Format YYYY-M-D sesuai key penyimpanan kita)
    // Note: getMonth() mulai dari 0, sedangkan key kita pakai 0-11 juga, tapi format tanggalnya d
    const todayKey = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}`;
    
    // 4. Ambil Data Catatan
    const notes = getStoredNotes();
    const todaysNotes = notes[todayKey];

    if (!todaysNotes) return; // Tidak ada catatan hari ini

    // 5. Loop Catatan Hari Ini
    todaysNotes.forEach(note => {
        // Jika catatan punya waktu DAN waktunya sama dengan sekarang
        if (note.time && note.time === currentTimeStr) {
            
            // Generate ID unik untuk alarm ini (ID Note + Jam)
            const alarmId = `${note.id}-${currentTimeStr}`;

            // Cek apakah sudah pernah bunyi di sesi ini?
            if (!processedAlarms.has(alarmId)) {
                triggerAlarm(note);
                processedAlarms.add(alarmId); // Tandai sudah bunyi

                // Bersihkan memori processedAlarms agar tidak penuh (opsional, reset tiap jam)
                setTimeout(() => processedAlarms.delete(alarmId), 60000 * 2); 
            }
        }
    });
}

function triggerAlarm(note) {
    // Mainkan Notifikasi Visual
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.ready.then(reg => {
            reg.showNotification(`🔔 Pengingat: ${note.text}`, {
                body: `Waktunya untuk agenda kategori: ${note.category.toUpperCase()}`,
                icon: "icons/icon_192.webp",
                vibrate: [500, 200, 500, 200, 500], // Getar panjang
                requireInteraction: true, // Notifikasi tidak hilang sampai diklik (Penting buat alarm)
                data: { url: '#calendar' } // Data payload
            });
        });
    } else {
        new Notification(`🔔 Pengingat: ${note.text}`, {
            body: `Waktunya untuk agenda kategori: ${note.category.toUpperCase()}`,
            icon: "icons/icon_192.webp"
        });
    }

    // OPSIONAL: Mainkan Suara (Hanya jalan jika user pernah interaksi dengan halaman)
    // const audio = new Audio('https://assets.mixkit.co/sfx/preview/mixkit-alarm-digital-clock-beep-989.mp3');
    // audio.play().catch(e => console.log("Audio autoplay diblokir browser, hanya notifikasi yang muncul."));
}

// --- 1. INISIALISASI APLIKASI ---
window.onload = init;

// --- 2. LOGIKA TOMBOL BACK (UNIVERSAL HANDLER) ---
// Fungsi ini akan dipanggil oleh Browser Back maupun Tombol Fisik Android
function handleGlobalBack() {
    const modal = document.getElementById('selectorModal');

    // CEK 1: Apakah Modal Terbuka?
    if (modal && modal.classList.contains('active')) {
        // Tutup modal (tanpa mengubah history lagi, karena trigger datang dari back)
        // Kita panggil fungsi close manual tapi set parameter true agar tidak double back
        closeModal(true);
        return true; // Berhasil handle back
    }

    // CEK 2: Apakah sedang di tampilan Catatanku (Notes)?
    if (typeof isNotesView !== 'undefined' && isNotesView) {
        // Kembali ke Kalender
        toggleNotesView(true);
        return true; // Berhasil handle back
    }

    // CEK 3: Sudah di Home/Calendar?
    return false; // Tidak ada yang di-handle, biarkan sistem yang memproses (Exit)
}

// --- 3. HANDLER UNTUK BROWSER / WEBVIEW BIASA ---
// Menangani navigasi history (misal user swipe back di browser)
window.onpopstate = function (event) {
    // Kita coba handle logic UI
    const handled = handleGlobalBack();

    // Jika logic UI tidak menangkap apa-apa (artinya kita di home),
    // dan user menekan back, browser otomatis akan mundur history.
    // Kita pastikan state konsisten.
    if (!handled) {
        // Jika history habis, biasanya browser diam atau keluar.
        // Kita pastikan kembali ke hash #calendar jika tersesat
        if (location.hash !== '#calendar' && location.hash !== '') {
            history.replaceState({ view: 'calendar' }, '', '#calendar');
        }
    }
};

// --- 4. HANDLER KHUSUS ANDROID (CAPACITOR / HYBRID) ---
// Kode ini hanya jalan jika aplikasi dibungkus menggunakan Capacitor
document.addEventListener('DOMContentLoaded', function () {
    if (window.Capacitor) {
        const App = Capacitor.Plugins.App;

        App.addListener('backButton', ({ canGoBack }) => {
            // Panggil logika manual kita
            // "Manual Check" karena tombol fisik Android tidak selalu memicu onpopstate
            const modal = document.getElementById('selectorModal');
            const isOnNotes = (typeof isNotesView !== 'undefined' && isNotesView);

            if ((modal && modal.classList.contains('active')) || isOnNotes) {
                // Jika ada modal atau di notes, kita manipulasi history secara manual
                // agar sinkron dengan browser history stack
                history.back();
            } else {
                // Jika sudah di Halaman Utama (Calendar) & Tidak ada modal
                App.exitApp();
            }
        });
    }
    // OPSIONAL: Jika kamu pakai WebView Android Studio Murni (tanpa Capacitor)
    // Kamu perlu inject JavaScript Interface, tapi biasanya onpopstate di atas sudah cukup
    // jika Android Overridenya benar.
});

// --- SISTEM INSTALL PWA (SILENT MODE) ---

let deferredPrompt; // Variabel penyimpan event install
const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
const iosModal = document.getElementById('iosInstallModal');

// 1. Event Listener Chrome/Android (Simpan event, jangan munculkan banner)
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e; // Simpan event ke variabel global
    // Kita tidak memanggil UI apa-apa di sini (Silent)
    // TAMBAHKAN INI: Update sidebar segera setelah browser siap install
    updateDesktopSidebarUI();
});

// 2. Fungsi Eksekusi Install (Dipanggil dari Tombol Settings)
function triggerInstallFromSettings() {
    if (isStandalone) {
        alert('Aplikasi sudah terinstall.');
        return;
    }

    if (isIOS) {
        // Khusus iOS: Buka Modal Panduan
        if(iosModal) {
            iosModal.classList.remove('hidden');
            iosModal.classList.add('flex');
            // Tutup modal settings biar fokus ke panduan
            closeModal();
        }
    } else if (deferredPrompt) {
        // Android/PC: Panggil Prompt Asli
        deferredPrompt.prompt();
        
        deferredPrompt.userChoice.then((choiceResult) => {
            if (choiceResult.outcome === 'accepted') {
                console.log('User menerima instalasi');
                deferredPrompt = null;
                openSettings(); // Refresh halaman settings
            }
        });
    } else {
        // Fallback jika browser tidak support PWA otomatis
        alert('Untuk menginstall: Buka menu browser (titik tiga) > Pilih "Install App" atau "Add to Home Screen".');
    }
}

// 3. Fungsi Tutup Modal iOS
function closeIosModal() {
    if(iosModal) {
        iosModal.classList.remove('flex');
        iosModal.classList.add('hidden');
    }
}

// --- FUNGSI UPDATE UI SIDEBAR DESKTOP ---
function updateDesktopSidebarUI() {
    const installContainer = document.getElementById('desktopInstallContainer');
    if (!installContainer) return;

    // 1. Logika Deteksi Status Instalasi
    // isStandalone sudah kita definisikan di bagian atas main.js
    if (isStandalone) {
        // TAMPILAN JIKA SUDAH TERPASANG (Persis mobile)
        installContainer.classList.remove('hidden');
        installContainer.innerHTML = `
            <p class="text-xs font-bold opacity-50 uppercase tracking-widest mb-1">Aplikasi</p>
            <div class="bg-emerald-500/20 border border-emerald-500/30 rounded-xl p-3 flex items-center gap-3">
                <div class="w-8 h-8 bg-emerald-500 rounded-full flex items-center justify-center text-white shadow-sm flex-shrink-0">
                    <i class="fas fa-check text-xs"></i>
                </div>
                <div class="flex flex-col overflow-hidden">
                    <span class="font-bold text-[0.7rem] text-emerald-200">Aplikasi Terpasang</span>
                    <span class="text-[0.55rem] text-emerald-300/80 uppercase tracking-tighter">Versi PWA Aktif</span>
                </div>
            </div>`;
    } else if (deferredPrompt) {
        // TAMPILAN TOMBOL INSTALL (Hanya jika belum install & browser siap)
        installContainer.classList.remove('hidden');
        installContainer.innerHTML = `
            <p class="text-xs font-bold opacity-50 uppercase tracking-widest mb-1">Aplikasi</p>
            <button onclick="triggerInstallFromSettings()" class="w-full bg-white text-slate-900 hover:bg-slate-100 transition p-3 rounded-xl flex items-center justify-center gap-2 font-bold text-[0.7rem] shadow-lg group">
                <i class="fas fa-download group-hover:scale-110 transition-transform"></i> INSTALL APP
            </button>`;
    } else {
        // SEMBUNYIKAN jika tidak support atau sedang di browser biasa tanpa prompt
        installContainer.classList.add('hidden');
    }

    // 2. Update Status Notifikasi (Tetap seperti sebelumnya)
    const statusEl = document.getElementById('desktopNotifStatus');
    const btnEl = document.getElementById('desktopNotifBtn');
    
    if (statusEl && btnEl) {
        if (Notification.permission === 'granted') {
            statusEl.textContent = "AKTIF ✅";
            statusEl.className = "text-[0.6rem] font-bold uppercase tracking-wider text-emerald-300";
            btnEl.textContent = "TES BUNYI ALARM";
            btnEl.className = "w-full py-2 rounded-lg text-[0.7rem] font-bold bg-emerald-500/20 text-emerald-200 border border-emerald-500/30 hover:bg-emerald-500/30 transition";
        } else if (Notification.permission === 'denied') {
            statusEl.textContent = "DIBLOKIR ❌";
            statusEl.className = "text-[0.6rem] font-bold uppercase tracking-wider text-red-300";
            btnEl.textContent = "CARA BUKA BLOKIR";
            btnEl.className = "w-full py-2 rounded-lg text-[0.7rem] font-bold bg-red-500/20 text-red-200 border border-red-500/30 hover:bg-red-500/30 transition";
        } else {
            statusEl.textContent = "BELUM AKTIF";
            btnEl.textContent = "AKTIFKAN SEKARANG";
        }
    }
}

// --- LOGIKA LOGIN GOOGLE (Vibe Coding) ---

// 1. Fungsi saat tombol diklik (Saklar Login/Logout)
async function toggleGoogleAuth() {
    const { auth, provider, signInWithPopup, signOut } = window.fbAuth;
    
    // Cek apakah user sedang login atau tidak
    if (!auth.currentUser) {
        // --- MAU LOGIN ---
        try {
            const result = await signInWithPopup(auth, provider);
            // Sukses! onAuthStateChanged di bawah akan otomatis menangani tampilan
            console.log("Login sukses:", result.user.displayName);
        } catch (error) {
            console.error("Login gagal:", error);
            alert("Gagal Login: " + error.message);
        }
    } else {
        // --- MAU LOGOUT ---
        if (confirm("Yakin ingin logout dari akun Google?")) {
            try {
                await signOut(auth);
                console.log("Logout sukses");
                // Sukses! Tampilan akan berubah otomatis
            } catch (error) {
                console.error("Logout gagal:", error);
            }
        }
    }
}

// 2. Mata-Mata Status Login (Otomatis jalan saat refresh)
window.fbAuth.onAuthStateChanged(window.fbAuth.auth, (user) => {
    const btn = document.getElementById('btnLoginGoogle');
    const txt = document.getElementById('btnTextGoogle');
    const icon = btn.querySelector('i');

    if (user) {
        // === USER SEDANG LOGIN ===
        // Ubah tombol jadi merah (Logout) & Tampilkan nama
        const namaDepan = user.displayName.split(' ')[0]; // Ambil nama depan saja
        txt.textContent = `LOGOUT (${namaDepan})`;
        
        btn.classList.remove('bg-white', 'text-slate-900');
        btn.classList.add('bg-red-600', 'text-white', 'hover:bg-red-700'); // Jadi merah
        
        icon.className = "fas fa-sign-out-alt"; // Ikon pintu keluar
        icon.classList.remove('text-red-500');  // Hapus warna merah ikon lama
        icon.classList.add('text-white');       // Ikon jadi putih

        // TODO: Di sini nanti kita panggil fungsi Sync Data
        // syncNotesFromFirebase(user.uid); 

    } else {
        // === USER TIDAK LOGIN (TAMU) ===
        // Reset tombol jadi putih (Login Google)
        txt.textContent = "LOGIN GOOGLE";
        
        btn.classList.add('bg-white', 'text-slate-900');
        btn.classList.remove('bg-red-600', 'text-white', 'hover:bg-red-700');
        
        icon.className = "fab fa-google text-red-500 group-hover:scale-110 transition-transform";
    }
});