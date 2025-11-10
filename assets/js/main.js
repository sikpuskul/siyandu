// assets/js/main.js

// Variabel global untuk menyimpan info user saat ini
let currentUser = null;

$(document).ready(function () {
    // 1. Cek Sesi saat aplikasi dibuka
    checkAuth();

    // 2. Event Listener untuk Toggle Sidebar
    $("#menu-toggle").click(function (e) {
        e.preventDefault();
        $("#wrapper").toggleClass("toggled");
    });

    // 3. Event Listener untuk Navigasi Menu
    $(document).on('click', '[data-page]', function (e) {
        e.preventDefault();
        
        // Hapus kelas active dari semua menu sidebar
        $(".list-group-item-action").removeClass("active");
        // Jika yang diklik adalah menu sidebar, aktifkan visualnya
        if ($(this).hasClass('list-group-item-action')) {
            $(this).addClass("active");
        }

        const page = $(this).data("page");
        // Ambil judul dari teks menu, atau default jika kosong
        const title = $(this).text().trim() || 'Siyanduku NG';
        
        loadPage(page, title);

        // Di mobile, otomatis tutup sidebar jika klik menu (hanya jika yang diklik ada di sidebar)
        if ($(window).width() <= 768 && $(this).closest('#sidebar-wrapper').length > 0) {
             $("#wrapper").removeClass("toggled");
        }
    });

    // 4. Event Listener Logout
    $("#btnLogout, #btnLogoutDropdown").click(function(e) {
        e.preventDefault();
        Swal.fire({
            title: 'Yakin ingin keluar?',
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: 'Ya, Logout',
            cancelButtonText: 'Batal'
        }).then((result) => {
            if (result.isConfirmed) {
                logout();
            }
        });
    });

// --- GLOBAL LISTENER: TOMBOL SIMPAN/UPDATE PASIEN ---
$(document).on('click', '#btnSavePasien', async function(e) {
    e.preventDefault();

    // 1. Validasi HTML5
    const form = document.getElementById('formPasien');
    if (!form.checkValidity()) { form.reportValidity(); return; }

    // 2. Siapkan Data
    const formData = {
        nik: $('[name="nik"]').val().trim(),
        nama: $('[name="nama"]').val().trim(),
        tgl_lahir: $('[name="tgl_lahir"]').val(),
        jk: $('[name="jk"]').val(),
        no_hp: $('[name="no_hp"]').val().trim(),
        rt: $('[name="rt"]').val().trim(),
        rw: $('[name="rw"]').val().trim(),
        nama_ibu: $('[name="nama_ibu"]').val().trim(),
        // --- TAMBAHAN ---
        rpk: getCheckedValues('rpk'),
        rpd: getCheckedValues('rpd'),
        risk: getCheckedValues('risk')
    };

    // 3. Cek Mode & Loading
    const editId = $('#editPasienId').val();
    const isEditMode = editId !== "";
    const action = isEditMode ? 'updatePasien' : 'savePasien';
    const payload = isEditMode ? { id: editId, data: formData } : { data: formData };

    const btn = $(this);
    const originalText = btn.html();
    btn.prop('disabled', true).html('<i class="fas fa-spinner fa-spin me-2"></i>Memproses...');

    try {
        // 4. Panggil API
        const response = await callApi(action, payload);

        if (response.status === 'success') {
            // Tutup Modal Dulu
            const modalEl = document.getElementById('modalPasien');
            const modal = bootstrap.Modal.getInstance(modalEl);
            if (modal) { modal.hide(); } else { $(modalEl).modal('hide'); $('.modal-backdrop').remove(); }

            // --- LOGIKA CABANG SETELAH SUKSES ---
            if (isEditMode) {
                // KASUS 1: MODE EDIT
                Swal.fire({
                    icon: 'success',
                    title: 'Berhasil',
                    text: 'Data pasien diperbarui.',
                    timer: 1500,
                    showConfirmButton: false
                });
                // Langsung refresh tabel karena user pasti masih di halaman pasien
                if ($('#btnSearch').length) $('#btnSearch').click();

            } else {
                // KASUS 2: MODE TAMBAH BARU
                // Kita tawarkan pendaftaran. JANGAN refresh tabel dulu agar tidak bentrok alert.
                Swal.fire({
                    title: 'Pasien Baru Tersimpan!',
                    text: 'Apakah ingin langsung mendaftarkannya ke pelayanan hari ini?',
                    icon: 'success',
                    showCancelButton: true,
                    confirmButtonColor: '#198754', // Hijau
                    cancelButtonColor: '#6c757d',  // Abu-abu
                    confirmButtonText: 'Ya, Daftarkan',
                    cancelButtonText: 'Nanti Saja',
                    allowOutsideClick: false
                }).then((result) => {
                    if (result.isConfirmed) {
                        // OPSI A: User pilih "Ya" -> Buka Modal Pendaftaran
                        if (typeof window.daftarPasien === 'function') {
                            // response.data dari savePasien harusnya berisi {id, nama, umur, jk}
                            // Pastikan Backend PasienAPI.gs Anda sudah mengembalikan data lengkap ini!
                            const d = response.data;
                            window.daftarPasien(d.id, d.nama, d.umur, d.jk);
                        }
                    } else {
                        // OPSI B: User pilih "Nanti" -> Baru kita refresh tabel
                        // Opsional: Isi kolom pencarian dengan nama pasien baru agar langsung muncul
                        $('#searchInput').val(formData.nama);
                        if ($('#btnSearch').length) $('#btnSearch').click();
                    }
                });
            }

        } else {
            Swal.fire('Gagal', response.message, 'error');
        }

    } catch (error) {
        console.error(error);
        Swal.fire('Error', 'Terjadi kesalahan sistem.', 'error');
    } finally {
        btn.prop('disabled', false).html(originalText);
    }
});
});

// --- FUNGSI-FUNGSI UTAMA ---

function checkAuth() {
    const token = localStorage.getItem('sessionToken');
    const userStr = localStorage.getItem('sessionUser');
    const loginTime = localStorage.getItem('loginTime');

    // Validasi dasar ketersediaan token
    if (!token || !userStr || !loginTime) {
        forceLogout();
        return;
    }

    // Validasi Timeout (60 menit = 3600 * 1000 ms)
    const now = new Date().getTime();
    const sixtyMinutes = 60 * 60 * 1000;
    
    if (now - parseInt(loginTime) > sixtyMinutes) {
        Swal.fire('Sesi Berakhir', 'Silakan login kembali.', 'warning')
            .then(() => forceLogout());
        return;
    }

    // Update waktu aktivitas terakhir (sliding session di frontend)
    localStorage.setItem('loginTime', now);

    // Set user global dan update UI
    currentUser = JSON.parse(userStr);
    updateUserUI(currentUser);

    // CEK APAKAH ADA HALAMAN TERAKHIR YANG DISIMPAN?
    const lastPage = localStorage.getItem('lastPage');
    
    // Khusus halaman 'periksa', kita butuh data pasien aktif di sessionStorage
    if (lastPage === 'periksa' && !sessionStorage.getItem('activePasien')) {
        // Jika mau ke halaman periksa tapi data pasien hilang (misal tutup browser), kembalikan ke antrian
        loadPage('pendaftaran', 'Kunjungan Hari Ini');
    } else if (lastPage && lastPage !== 'login') {
        // Muat halaman terakhir
        loadPage(lastPage);
        // Aktifkan menu di sidebar yang sesuai
        $(".list-group-item-action").removeClass("active");
        $(`[data-page="${lastPage}"]`).addClass("active");
    } else {
        // Default jika tidak ada history
        loadPage('welcome', 'Beranda');
    }
}

function updateUserUI(user) {
    $("#user-fullname").html(`
        ${user.namaLengkap} 
        <div style="font-size: 0.75rem; opacity: 0.8; font-weight: normal;">
            ${user.namaPosyandu} - ${user.namaDesa}
        </div>
    `);

    // Info di Dropdown (Opsional, bisa disederhanakan karena sudah muncul di atas)
    $("#user-posyandu-info").text(`ID Unit: ${user.posyanduId}`);

    // --- LOGIKA MENU ADMIN ---
    // Tampilkan menu laporan HANYA jika role adalah 'admin_posyandu' atau 'admin_puskesmas'
    // Sesuaikan dengan value role yang Anda pakai di db_users.
    // Misal kita pakai standar: 'admin' (umum) atau cek spesifik.
    if (user.role === 'admin' || user.role === 'admin_posyandu' || user.role === 'admin_puskesmas') {
        $('#menu-laporan').show();
    } else {
        $('#menu-laporan').hide();
    }
}

function forceLogout() {
    localStorage.clear();
    window.location.href = 'login.html';
}

function logout() {
    localStorage.clear();
    window.location.href = 'login.html';
}

// Fungsi Router Sederhana
async function loadPage(pageName, pageTitle) {
    // Update judul halaman di navbar
    if (pageTitle) {
        $("#page-title").text(pageTitle);
    }

    if (pageName !== 'login') {
        sessionStorage.setItem('lastActivePage', pageName);
    }

    // Tampilkan loading di area konten
    $("#app-content").html(`
        <div class="d-flex justify-content-center align-items-center" style="height: 60vh;">
            <div class="spinner-border text-primary" style="width: 3rem; height: 3rem;" role="status">
                <span class="visually-hidden">Loading...</span>
            </div>
        </div>
    `);

    localStorage.setItem('lastPage', pageName);

    try {
        // Fetch file HTML dari folder pages/
        const response = await fetch(`pages/${pageName}.html`);
        if (!response.ok) throw new Error("Halaman tidak ditemukan");
        const html = await response.text();

        // Masukkan konten ke #app-content
        $("#app-content").html(html);

        // Cek apakah halaman tersebut punya fungsi inisialisasi khusus?
        // Misal: pages/pasien.html mungkin butuh init_pasien() untuk setup event listenernya
        const initFunctionName = `init_${pageName}`;
        if (typeof window[initFunctionName] === 'function') {
             // Panggil fungsi init jika ada (nanti kita buat di file terpisah atau inline)
             //console.log(`Memanggil fungsi: ${initFunctionName}`);
             window[initFunctionName]();
        }

    } catch (error) {
        $("#app-content").html(`
            <div class="alert alert-danger text-center">
                <h4>Terjadi Kesalahan</h4>
                <p>Gagal memuat halaman <b>${pageName}</b>.</p>
                <small>${error.message}</small>
            </div>
        `);
    }
}

// =========================================
// INISIALISASI HALAMAN (Page Initializers)
// =========================================

// --- Halaman Pasien ---
window.init_pasien = function() {
    // State lokal untuk halaman ini
    let currentPage = 1;
    let currentKeyword = '';

    // 1. Event Listener: Tombol Cari (DIPERBAIKI)
    // Menangani baik klik tombol 'CARI' maupun tekan 'Enter' sekaligus
    $('#searchForm').off('submit').on('submit', function(e) {
        e.preventDefault(); // Wajib, agar halaman tidak reload
        
        currentKeyword = $('#searchInput').val().trim();
        
        // Validasi
        if (currentKeyword === '') {
            Swal.fire({
                icon: 'warning',
                title: 'Kata Kunci Kosong',
                text: 'Silakan masukkan Nama atau NIK pasien.',
                timer: 1500,
                showConfirmButton: false
            });
            return;
        }

        currentPage = 1; 
        loadPasienData(currentKeyword, currentPage);
    });

    // 3. Event Listener: Tombol Tambah (Placeholder dulu)
    $('#btnAddPasien').off('click').on('click', function() {
    $('#formPasien')[0].reset();
    $('#editPasienId').val(''); // Kosongkan ID -> Mode Tambah
    $('#modalPasienTitle').html('<i class="fas fa-user-plus me-2"></i>Tambah Pasien Baru');
    $('#btnSavePasien').html('<i class="fas fa-save me-2"></i>SIMPAN DATA'); // Reset teks tombol
    new bootstrap.Modal(document.getElementById('modalPasien')).show();
    });

    // 4. Fungsi Memuat Data
    async function loadPasienData(keyword, page) {
        // Tampilkan loading di tabel
        const tbody = $('#pasienTableBody');
        tbody.html(`
            <tr>
                <td colspan="6" class="text-center py-5">
                    <div class="spinner-border text-primary mb-3" role="status"></div>
                    <p class="text-muted mb-0">Sedang mencari data...</p>
                </td>
            </tr>
        `);

        try {
            // Panggil API
            const response = await callApi('searchPasien', { 
                keyword: keyword, 
                page: page 
            });

            if (response.status === 'success') {
                renderPasienTable(response.data.pasien);
                renderPagination(response.data.pagination);
            } else {
                tbody.html(`<tr><td colspan="6" class="text-center py-4 text-danger">${response.message}</td></tr>`);
            }

        } catch (error) {
            tbody.html(`<tr><td colspan="6" class="text-center py-4 text-danger">Gagal terhubung ke server.</td></tr>`);
        }
    }

    // 5. Render Tabel
    function renderPasienTable(data) {
        const tbody = $('#pasienTableBody');
        tbody.empty();

        if (data.length === 0) {
            tbody.html(`
                <tr>
                    <td colspan="6" class="text-center py-5 text-muted">
                        <i class="far fa-folder-open fa-3x mb-3 opacity-50"></i>
                        <p class="mb-0">Tidak ditemukan data yang cocok.</p>
                    </td>
                </tr>
            `);
            return;
        }

        // Loop data dan buat baris tabel
        data.forEach(p => {
            // Kita kirim data lengkap ke fungsi daftarPasien agar modal bisa langsung terisi
            // PENTING: Perhatikan tanda kutip tunggal dan ganda agar tidak error syntax di HTML
            const btnDaftar = `<button class="btn btn-sm btn-success me-1" 
                onclick="daftarPasien('${p.id}', '${p.nama.replace(/'/g, "\\'")}', '${p.umur}', '${p.jk}')" 
                title="Daftar Pelayanan">
                <i class="fas fa-stethoscope"></i>
            </button>`;

            const row = `
                <tr>
                    <td class="ps-4 fw-bold">${p.nama}</td>
                    <td><span class="badge bg-light text-dark border">${p.nik}</span></td>
                    <td>${p.jk}</td>
                    <td>${p.umur} Thn</td>
                    <td>${p.alamat}</td>
                    <td class="text-end pe-4">
                        ${btnDaftar} 
                        <button class="btn btn-sm btn-info text-white me-1" onclick="showRiwayat('${p.id}', '${p.nama.replace(/'/g, "\\'")}')" title="Lihat Riwayat">
                            <i class="fas fa-history"></i>
                        </button>
                        <button class="btn btn-sm btn-outline-primary me-1" onclick="editPasien('${p.id}')" title="Edit">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn btn-sm btn-outline-danger" onclick="hapusPasien('${p.id}', '${p.nama.replace(/'/g, "\\'")}')" title="Hapus">
                            <i class="fas fa-trash"></i>
                        </button>
                    </td>
                </tr>
            `;
            tbody.append(row);
        });
    }

    // 6. Render Pagination
    function renderPagination(pagination) {
        const container = $('#paginationContainer');
        const info = $('#paginationInfo');
        const links = $('#paginationLinks');

        if (pagination.totalRows === 0) {
            container.css('visibility', 'hidden');
            return;
        }

        container.css('visibility', 'visible');
        const start = (pagination.currentPage - 1) * pagination.rowsPerPage + 1;
        const end = Math.min(start + pagination.rowsPerPage - 1, pagination.totalRows);
        info.text(`Menampilkan ${start}-${end} dari ${pagination.totalRows} data`);

        links.empty();
        
        // Tombol Previous
        links.append(`
            <li class="page-item ${pagination.currentPage === 1 ? 'disabled' : ''}">
                <a class="page-link" href="#" data-page="${pagination.currentPage - 1}">Previous</a>
            </li>
        `);

        // Tombol Halaman (Sederhana dulu, tampilkan semua jika < 5 halaman)
        // Nanti bisa dikembangkan agar ada ... jika halamannya banyak sekali
        for (let i = 1; i <= pagination.totalPages; i++) {
             // Tampilkan hanya 2 halaman di sekitar halaman aktif agar tidak kepanjangan
             if (i == 1 || i == pagination.totalPages || (i >= pagination.currentPage - 2 && i <= pagination.currentPage + 2)) {
                links.append(`
                    <li class="page-item ${i === pagination.currentPage ? 'active' : ''}">
                        <a class="page-link" href="#" data-page="${i}">${i}</a>
                    </li>
                `);
             } else if (links.children().last().text() !== '...') {
                 links.append('<li class="page-item disabled"><span class="page-link">...</span></li>');
             }
        }

        // Tombol Next
        links.append(`
            <li class="page-item ${pagination.currentPage === pagination.totalPages ? 'disabled' : ''}">
                <a class="page-link" href="#" data-page="${pagination.currentPage + 1}">Next</a>
            </li>
        `);

        // Event Listener untuk klik halaman
        $('#paginationLinks .page-link').on('click', function(e) {
            e.preventDefault();
            const page = $(this).data('page');
            if (page && page !== pagination.currentPage) {
                currentPage = page;
                loadPasienData(currentKeyword, currentPage);
            }
        });
    }
};

// --- Fungsi Global untuk Aksi Tabel (agar bisa dipanggil dari onclick HTML) ---
window.editPasien = async function(id) {
    // Tampilkan loading dulu
    Swal.fire({title: 'Memuat data...', allowOutsideClick: false, didOpen: () => Swal.showLoading()});

    try {
        const response = await callApi('getPasienById', { id: id });
        Swal.close(); // Tutup loading

        if (response.status === 'success') {
            const data = response.data;
            // Isi Form dengan Data
            $('#editPasienId').val(data.id); // Isi ID -> Mode Edit
            $('[name="nik"]').val(data.nik);
            $('[name="nama"]').val(data.nama);
            $('[name="tgl_lahir"]').val(data.tgl_lahir); // Pastikan format YYYY-MM-DD dari sheet sesuai
            $('[name="jk"]').val(data.jk);
            $('[name="no_hp"]').val(data.no_hp);
            $('[name="rt"]').val(data.rt);
            $('[name="rw"]').val(data.rw);
            $('[name="nama_ibu"]').val(data.nama_ibu);
            // --- ISI CHECKBOX ---
            // Reset dulu semua checkbox
            $('input[type="checkbox"]').prop('checked', false);
            // Centang yang sesuai data dari server
            if (data.rpk) data.rpk.forEach(val => $(`input[name="rpk[]"][value="${val}"]`).prop('checked', true));
            if (data.rpd) data.rpd.forEach(val => $(`input[name="rpd[]"][value="${val}"]`).prop('checked', true));
            if (data.risk) data.risk.forEach(val => $(`input[name="risk[]"][value="${val}"]`).prop('checked', true));

            // Ubah Tampilan Modal
            $('#modalPasienTitle').html('<i class="fas fa-user-edit me-2"></i>Edit Data Pasien');
            $('#btnSavePasien').html('<i class="fas fa-sync-alt me-2"></i>UPDATE DATA');
            
            // Tampilkan
            new bootstrap.Modal(document.getElementById('modalPasien')).show();

        } else {
            Swal.fire('Gagal', response.message, 'error');
        }
    } catch (error) {
        Swal.fire('Error', 'Gagal memuat data untuk edit.', 'error');
    }
}

window.hapusPasien = function(id, nama) {
    Swal.fire({
        title: 'Hapus Pasien?',
        html: `Anda yakin ingin menghapus data <b>${nama}</b>?<br><small class="text-danger">Data yang dihapus tidak dapat dikembalikan!</small>`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#3085d6',
        confirmButtonText: 'Ya, Hapus!',
        cancelButtonText: 'Batal'
    }).then(async (result) => {
        if (result.isConfirmed) {
            // Tampilkan loading
            Swal.fire({
                title: 'Menghapus...',
                allowOutsideClick: false,
                didOpen: () => { Swal.showLoading(); }
            });

            try {
                // Panggil API
                const response = await callApi('deletePasien', { id: id });

                if (response.status === 'success') {
                    Swal.fire('Terhapus!', response.message, 'success');
                    // Refresh tabel jika kita sedang di halaman pasien
                    // Kita trigger klik tombol cari lagi untuk refresh data
                    if ($('#btnSearch').length) {
                        $('#btnSearch').click();
                    }
                } else {
                    Swal.fire('Gagal', response.message, 'error');
                }
            } catch (error) {
                Swal.fire('Error', 'Gagal menghubungi server.', 'error');
            }
        }
    });
}

// --- FUNGSI HELPER ---
function getTodayDate() {
    const d = new Date();
    let month = '' + (d.getMonth() + 1);
    let day = '' + d.getDate();
    const year = d.getFullYear();

    if (month.length < 2) month = '0' + month;
    if (day.length < 2) day = '0' + day;

    return [year, month, day].join('-');
}

// --- FUNGSI GLOBAL: Buka Modal Pendaftaran ---
window.daftarPasien = function(id, nama, umur, jk) {
    // 1. Reset Form
    $('#formPendaftaran')[0].reset();
    
    // 2. Isi Data Pasien ke Hidden Input & Label
    $('#daftarPasienId').val(id);
    $('#daftarPasienJk').val(jk); // Penting untuk logika conditional
    $('#daftarPasienUmur').val(umur); // Penting untuk logika conditional

    $('#daftarNamaPasien').text(nama);
    $('#daftarUmurPasien').text(umur);
    $('#daftarJkPasien').text(jk);

    // 3. Set Default Tanggal Kunjungan = Hari Ini
    $('[name="tanggal_kunjungan"]').val(getTodayDate());

    // 4. Logika Tampilan Kondisional (Frontend UX)
    // Reset tampilan dulu (sembunyikan semua section khusus)
    $('.section-balita, .section-wus, .section-ptm').addClass('d-none');

    const umurAngka = parseInt(umur);
    
    // A. Balita (0-5 tahun) -> Tampilkan Lingkar Kepala
    if (umurAngka <= 5) {
        $('.section-balita').removeClass('d-none');
    }

    // B. Usia Produktif & Lansia (> 15 tahun) -> Tampilkan PTM (Tensi, Gula, LP)
    if (umurAngka >= 15) {
        $('.section-ptm').removeClass('d-none');
    }

    // C. Wanita Usia Subur (15-49 tahun) -> Tampilkan Status Hamil/Nifas/LiLA
    // Note: JK dari tabel mungkin "Perempuan" atau "Laki-laki" (sesuaikan dengan data Anda)
    if (jk === 'Perempuan' && umurAngka >= 10 && umurAngka <= 55) { // Range agak diperlebar untuk aman
        $('.section-wus').removeClass('d-none');
    }

    // 5. Tampilkan Modal
    new bootstrap.Modal(document.getElementById('modalPendaftaran')).show();
}

// --- GLOBAL LISTENER: SUBMIT PENDAFTARAN ---
$(document).ready(function() {
    // ... (listener lain tetap ada) ...

    $('#btnSubmitPendaftaran').on('click', async function(e) {
        e.preventDefault();

        // 1. Validasi HTML5
        const form = document.getElementById('formPendaftaran');
        if (!form.checkValidity()) {
            form.reportValidity();
            return;
        }

        // 2. Ambil Data
        // Kita ambil semua input yang visible maupun hidden yang relevan
        const pendaftaranData = {
            id_pasien: $('#daftarPasienId').val(),
            tanggal_kunjungan: $('[name="tanggal_kunjungan"]').val(),
            bb: $('[name="bb"]').val(),
            tb: $('[name="tb"]').val(),
            // Data opsional (ambil val()-nya, kalau kosong ya kirim kosong, backend yang handle)
            lk: $('[name="lk"]').val(),
            lp: $('[name="lp"]').val(),
            lila: $('[name="lila"]').val(),
            td_sistole: $('[name="td_sistole"]').val(),
            td_diastole: $('[name="td_diastole"]').val(),
            gula_darah: $('[name="gula_darah"]').val(),
            status_hamil: $('[name="status_hamil"]').val(),
            status_nifas: $('[name="status_nifas"]').val()
        };

        //console.log("[DEBUG Pendaftaran] Data:", pendaftaranData);

        // 3. Loading UI
        const btn = $(this);
        const originalHtml = btn.html();
        btn.prop('disabled', true).html('<i class="fas fa-spinner fa-spin me-2"></i>Memproses...');

        try {
            // 4. Panggil API
            const response = await callApi('savePendaftaran', { data: pendaftaranData });

            if (response.status === 'success') {
                // Tutup Modal
                bootstrap.Modal.getInstance(document.getElementById('modalPendaftaran')).hide();

                // Tampilkan info sukses & Kategori yang didapat dari backend
                Swal.fire({
                    icon: 'success',
                    title: 'Pendaftaran Berhasil!',
                    html: `Pasien masuk dalam kategori layanan:<br><h4 class="text-success fw-bold mt-2">${response.data.kategori}</h4>`,
                    timer: 3000,
                    showConfirmButton: false
                });

                // Opsional: Refresh sesuatu jika perlu

            } else {
                Swal.fire('Gagal', response.message, 'error');
            }

        } catch (error) {
             console.error("[DEBUG Pendaftaran] ERROR ASLI:", error); // <--- TAMBAHKAN INI
             Swal.fire('Error', 'Terjadi kesalahan sistem: ' + error.message, 'error'); // Tampilkan pesan aslinya
        } finally {
            btn.prop('disabled', false).html(originalHtml);
        }
    });
});

// assets/js/main.js

// --- HALAMAN PENDAFTARAN (Kunjungan Hari Ini) ---
window.init_pendaftaran = function() {
    // 1. Set Default Tanggal = Hari Ini
    const today = getTodayDate(); // Menggunakan helper yang sudah kita buat sebelumnya
    $('#filterTanggal').val(today);

    // 2. Load Data Awal
    loadKunjungan(today);

    // 3. Event Listener: Ganti Tanggal
    $('#filterTanggal').on('change', function() {
        loadKunjungan($(this).val());
    });

    // 4. Event Listener: Tombol Refresh
    $('#btnRefreshKunjungan').on('click', function() {
        loadKunjungan($('#filterTanggal').val());
    });

    // --- FUNGSI LOAD DATA ---
    async function loadKunjungan(tanggal) {
        const tbody = $('#kunjunganTableBody');
        tbody.html('<tr><td colspan="5" class="text-center py-5"><div class="spinner-border text-primary mb-3" role="status"></div><p class="mb-0">Memuat antrian...</p></td></tr>');

        try {
            // Panggil API getPendaftaranByDate
            const response = await callApi('getPendaftaranByDate', { date: tanggal });

            if (response.status === 'success') {
                renderKunjunganTable(response.data);
            } else {
                tbody.html(`<tr><td colspan="5" class="text-center py-4 text-danger"><i class="fas fa-exclamation-triangle me-2"></i>${response.message}</td></tr>`);
            }

        } catch (error) {
            tbody.html(`<tr><td colspan="5" class="text-center py-4 text-danger">Gagal terhubung ke server.</td></tr>`);
        }
    }

    // --- FUNGSI RENDER TABEL ---
    function renderKunjunganTable(data) {
        const tbody = $('#kunjunganTableBody');
        tbody.empty();

        if (data.length === 0) {
            tbody.html(`
                <tr>
                    <td colspan="5" class="text-center py-5 text-muted">
                        <img src="https://img.icons8.com/ios/100/bbbec5/empty-box.png" alt="Empty" style="opacity: 0.5; width: 64px;" class="mb-3">
                        <p class="mb-0">Tidak ada kunjungan pada tanggal ini.</p>
                    </td>
                </tr>
            `);
            return;
        }

        // Loop data dan buat baris tabel
        data.forEach(k => {
            // Tentukan warna badge kategori
            let katBadge = 'bg-secondary';
            if (k.kategori === 'Balita') katBadge = 'bg-info text-dark';
            else if (k.kategori === 'Ibu Hamil') katBadge = 'bg-danger';
            else if (k.kategori === 'Lansia') katBadge = 'bg-warning text-dark';
            else if (k.kategori === 'Usia Produktif') katBadge = 'bg-primary';

            // Tentukan warna badge status
            let stsBadge = 'bg-warning text-dark'; // Default: Belum Diperiksa
            if (k.status_layanan === 'Selesai') stsBadge = 'bg-success';

            const row = `
                <tr>
                    <td class="ps-4 fw-bold">${k.nama_pasien}</td>
                    <td>${k.umur_pasien} Thn <small class="text-muted ms-1">(${k.jk_pasien})</small></td>
                    <td><span class="badge ${katBadge}">${k.kategori}</span></td>
                    <td><span class="badge ${stsBadge}">${k.status_layanan}</span></td>
                    <td class="text-end pe-4">
                        ${k.status_layanan === 'Selesai' ? 
                            `<button class="btn btn-sm btn-info text-white" onclick="viewResume('${k.id_pendaftaran}')"><i class="fas fa-eye me-1"></i>Lihat</button>` : 
                            `<button class="btn btn-sm btn-primary"
                            onclick="mulaiPeriksa('${k.id_pendaftaran}', '${k.id_pasien}', '${k.nama_pasien.replace(/'/g, "\\'")}', '${k.nik_pasien || '-'}', '${k.umur_pasien}', '${k.jk_pasien}', '${k.risk_pasien || '-'}', '${k.kategori}')">
                            <i class="fas fa-stethoscope me-1"></i>Periksa
                            </button>`
                        }
                    </td>
                </tr>
            `;
            tbody.append(row);
        });
    }
};

// --- FUNGSI PERIKSA
window.mulaiPeriksa = function(idPendaftaran, idPasien, nama, nik, umur, jk, risk, kategori) {
    sessionStorage.setItem('activePasien', JSON.stringify({
        id_pendaftaran: idPendaftaran,
        id_pasien: idPasien,
        nama: nama,
        nik: nik,
        umur: umur,
        jk: jk,
        risk: risk, // <-- Sekarang 'risk' sudah dikenali dari parameter di atas
        kategori: kategori
    }));
    loadPage('periksa', 'Pemeriksaan Pasien');
}

// --- HALAMAN PEMERIKSAAN ---
window.init_periksa = function() {
    // 1. Ambil Data Pasien Aktif dari Session
    const pasienActive = JSON.parse(sessionStorage.getItem('activePasien'));
    if (!pasienActive) {
        Swal.fire('Error', 'Data kunjungan tidak ditemukan.', 'error')
            .then(() => loadPage('pendaftaran'));
        return;
    }

    // 2. Render Info Pasien di Header
    $('#periksaNamaPasien').text(pasienActive.nama);
    $('#periksaNikPasien').text(pasienActive.nik);
    $('#periksaUmur').text(pasienActive.umur + " Tahun");
    $('#periksaJk').text(pasienActive.jk);
    $('#periksaKategori').text(pasienActive.kategori);
    $('#currentIdPendaftaran').val(pasienActive.id_pendaftaran);

    // --- FUNGSI BARU: LOAD EXISTING DATA ---
    async function loadExistingData() {
        // Tampilkan loading halus di form (opsional, bisa pakai spinner kecil)
        // $('#formRutin').css('opacity', '0.5');

        try {
            const response = await callApi('getPemeriksaanRutin', { 
                id_pendaftaran: pasienActive.id_pendaftaran 
            });

            if (response.status === 'success' && response.data) {
                // DATA DITEMUKAN DI SERVER!
                const d = response.data;
                
                // 1. Isi Form
                $('#inputBB').val(d.bb);
                $('#inputTB').val(d.tb);
                $('#inputLK').val(d.lk);
                $('#inputLP').val(d.lp);
                $('#inputLILA').val(d.lila);
                $('#inputSistole').val(d.td_sistole);
                $('#inputDiastole').val(d.td_diastole);
                $('#inputGula').val(d.gula_darah);
                
                // 2. Trigger perhitungan agar status warna muncul
                hitungOtomatis();

                // 3. Ubah Tombol jadi UPDATE
                setButtonMode('#btnSimpanRutin', 'update');
                
                //console.log("Data pemeriksaan rutin dimuat dari server.");
            } else {
                // Belum ada data di server, coba cek draft lokal
                muatDraftLokal();
            }
        } catch (e) {
            console.error("Gagal load data rutin:", e);
             // Fallback ke draft lokal jika server error
            muatDraftLokal();
        } finally {
            // $('#formRutin').css('opacity', '1');
        }
    }

    // Panggil fungsi load ini SAAT INI JUGA
    loadExistingData();

    // --- AKTIFKAN TAB TBC ---
    $('#tab-tbc').removeClass('disabled'); // Aktifkan tab karena wajib semua usia

    // --- LOGIKA TAB TBC ---
    // 1. Auto-Calculate Hasil TBC saat radio button berubah
    $('#formTBC input[type=radio]').on('change', function() {
        hitungHasilTBC();
    });

    function hitungHasilTBC() {
        // Cek apakah ada salah satu yang "Ya"
        const isGejala = $('input[name="tbc_batuk"]:checked').val() === 'Ya' ||
                         $('input[name="tbc_demam"]:checked').val() === 'Ya' ||
                         $('input[name="tbc_bb"]:checked').val() === 'Ya' ||
                         $('input[name="tbc_kontak"]:checked').val() === 'Ya';
        
        const hasilBadge = $('#hasilTBC');
        if (isGejala) {
            hasilBadge.text('Terduga TBC').removeClass('bg-secondary bg-success').addClass('bg-danger');
            // Bisa tambah alert rujukan di sini jika mau
        } else {
            hasilBadge.text('Normal').removeClass('bg-secondary bg-danger').addClass('bg-success');
        }
    }

    // 2. Load Data TBC (jika ada)
    async function loadTBCHistory() {
        try {
             const response = await callApi('getSkriningTBC', { 
                id_pendaftaran: pasienActive.id_pendaftaran 
            });
            if (response.status === 'success' && response.data) {
                const d = response.data;
                // Set Radio Buttons
                $(`input[name="tbc_batuk"][value="${d.batuk}"]`).prop('checked', true);
                $(`input[name="tbc_demam"][value="${d.demam}"]`).prop('checked', true);
                $(`input[name="tbc_bb"][value="${d.bb_turun}"]`).prop('checked', true);
                $(`input[name="tbc_kontak"][value="${d.kontak}"]`).prop('checked', true);
                
                hitungHasilTBC(); // Update badge hasil
                setButtonMode('#btnSimpanTBC', 'update'); // Ubah tombol jadi oranye
            }
        } catch (e) { console.error("Gagal load TBC:", e); }
    }
    // Panggil saat tab TBC diklik agar hemat bandwidth (lazy load)
    $('#tab-tbc').one('shown.bs.tab', function(){ // .one() agar cuma dipanggil sekali
        loadTBCHistory();
    });

    // --- LOGIKA TAB INDERA ---
    // Hanya aktif untuk usia >= 6 tahun
    if (parseInt(pasienActive.umur) >= 6) {
        $('#tab-indera').removeClass('disabled');
    }

    // 1. Auto-Calculate Hasil Indera
    $('#formIndera input[type=radio]').on('change', function() {
        hitungHasilIndera();
    });

    function hitungHasilIndera() {
        const isGangguan = 
            $('input[name="mata_kanan"]:checked').val() === 'Gangguan' ||
            $('input[name="mata_kiri"]:checked').val() === 'Gangguan' ||
            $('input[name="telinga_kanan"]:checked').val() === 'Gangguan' ||
            $('input[name="telinga_kiri"]:checked').val() === 'Gangguan';
        
        const hasilBadge = $('#hasilIndera');
        if (isGangguan) {
            hasilBadge.text('Disarankan Rujuk').removeClass('bg-success').addClass('bg-danger');
        } else {
            hasilBadge.text('Normal').removeClass('bg-danger').addClass('bg-success');
        }
    }

    // 2. Load Data Indera (Lazy Load saat tab diklik)
    $('#tab-indera').one('shown.bs.tab', async function(){
        try {
            const response = await callApi('getSkriningIndera', { 
                id_pendaftaran: pasienActive.id_pendaftaran 
            });
            if (response.status === 'success' && response.data) {
                const d = response.data;
                $(`input[name="mata_kanan"][value="${d.mata_kanan}"]`).prop('checked', true);
                $(`input[name="mata_kiri"][value="${d.mata_kiri}"]`).prop('checked', true);
                $(`input[name="telinga_kanan"][value="${d.telinga_kanan}"]`).prop('checked', true);
                $(`input[name="telinga_kiri"][value="${d.telinga_kiri}"]`).prop('checked', true);
                
                hitungHasilIndera();
                setButtonMode('#btnSimpanIndera', 'update'); // <-- TOMBOL BERUBAH JADI UPDATE
            }
        } catch (e) { console.error("Gagal load Indera:", e); }
    });

    // --- LOGIKA TAB PPOK (USIA >= 40 TAHUN && PEROKOK) ---
    const umurPasien = parseInt(pasienActive.umur);
    // Cek apakah string risiko mengandung kata 'Merokok'
    const isPerokok = pasienActive.risk && pasienActive.risk.includes('Merokok');

    if (umurPasien >= 40 && isPerokok) { // <-- SYARAT GANDA
        $('#tab-ppok').removeClass('disabled');
        
        // Hitung Skor Dasar (Demografi) saat inisialisasi
        let skorJK = (pasienActive.jk === 'Laki-laki') ? 1 : 0;
        let skorUsia = 0;
        if (umurPasien >= 50 && umurPasien <= 59) skorUsia = 1;
        else if (umurPasien >= 60) skorUsia = 2;
        
        $('#skorJK').text(skorJK);
        $('#skorUsia').text(skorUsia);
    }

    // 1. Auto-Calculate Skor PUMA (Real-time)
    $('#formPPOK input[type=radio]').on('change', function() {
        hitungSkorPUMA();
    });

    function hitungSkorPUMA() {
        let totalSkor = parseInt($('#skorJK').text()) + parseInt($('#skorUsia').text());
        
        // Tambah skor dari jawaban kuesioner
        totalSkor += parseInt($('input[name="puma_rokok"]:checked').val() || 0);
        if ($('input[name="puma_napas"]:checked').val() === 'Ya') totalSkor += 1;
        if ($('input[name="puma_dahak"]:checked').val() === 'Ya') totalSkor += 1;
        if ($('input[name="puma_batuk"]:checked').val() === 'Ya') totalSkor += 1;
        if ($('input[name="puma_spiro"]:checked').val() === 'Ya') totalSkor += 1;

        $('#totalSkorPUMA').text(totalSkor);

        // Tentukan Hasil Visual (Skor > 6 Berisiko [cite: 759])
        const badge = $('#badgeHasilPUMA');
        const card = $('#cardHasilPUMA');
        if (totalSkor > 6) {
            badge.text('Berisiko PPOK').removeClass('bg-success').addClass('bg-danger');
            card.addClass('border-danger');
        } else {
            badge.text('Tidak Berisiko PPOK').removeClass('bg-danger').addClass('bg-success');
            card.removeClass('border-danger');
        }
    }

    // 2. Load Data PPOK (Lazy Load)
    $('#tab-ppok').one('shown.bs.tab', async function(){
        // Trigger hitung awal agar skor demografi langsung masuk total
        hitungSkorPUMA(); 
        
        try {
            const response = await callApi('getSkriningPPOK', { 
                id_pendaftaran: pasienActive.id_pendaftaran 
            });
            if (response.status === 'success' && response.data) {
                const d = response.data;
                // Set Radio Buttons dari data server
                $(`input[name="puma_rokok"][value="${d.merokok}"]`).prop('checked', true);
                $(`input[name="puma_napas"][value="${d.napas_pendek}"]`).prop('checked', true);
                $(`input[name="puma_dahak"][value="${d.dahak}"]`).prop('checked', true);
                $(`input[name="puma_batuk"][value="${d.batuk}"]`).prop('checked', true);
                $(`input[name="puma_spiro"][value="${d.spirometri}"]`).prop('checked', true);
                
                hitungSkorPUMA(); // Update total skor dengan data yang dimuat
                setButtonMode('#btnSimpanPPOK', 'update');
            }
        } catch (e) { console.error("Gagal load PPOK:", e); }
    });

    // --- LOGIKA TAB LANSIA (USIA >= 60 TAHUN) ---
    if (parseInt(pasienActive.umur) >= 60) {
        $('#tab-lansia').removeClass('disabled');
    }

    // 1. Auto-Calculate AKS
    $('#accordionAKS input[type=radio]').on('change', function() {
        hitungSkorAKS();
    });

    function hitungSkorAKS() {
        let total = 0;
        // Loop semua radio yang checked di dalam accordion AKS
        $('#accordionAKS input[type=radio]:checked').each(function() {
            total += parseInt($(this).val());
        });
        
        $('#totalSkorAKS').text(total);
        
        let hasil = '';
        let bg = '';
        if (total === 20) { hasil = 'Mandiri (A)'; bg = 'bg-success'; }
        else if (total >= 12) { hasil = 'Ketergantungan Ringan (B)'; bg = 'bg-warning'; }
        else if (total >= 9) { hasil = 'Ketergantungan Sedang (B)'; bg = 'bg-warning'; }
        else if (total >= 5) { hasil = 'Ketergantungan Berat (C)'; bg = 'bg-danger'; }
        else { hasil = 'Ketergantungan Total (C)'; bg = 'bg-danger'; }

        $('#hasilAKS').text(hasil).removeClass('bg-secondary bg-success bg-warning bg-danger').addClass(bg);
    }

    // 2. Auto-Calculate SKILAS
    $('#formLansia select').on('change', function() {
        hitungHasilSKILAS();
    });

    function hitungHasilSKILAS() {
        let isRujuk = false;
        // Cek semua dropdown SKILAS, jika ada satu saja yang value-nya TIDAK 'Normal'
        $('#formLansia select').each(function() {
            if ($(this).val() && $(this).val() !== 'Normal') {
                isRujuk = true;
                return false; // break loop
            }
        });

        const badge = $('#hasilSKILAS');
        if (isRujuk) {
            badge.text('Disarankan Rujuk').removeClass('bg-success').addClass('bg-danger');
        } else {
            badge.text('Normal').removeClass('bg-danger').addClass('bg-success');
        }
    }

    // 3. Load Data Lansia (Lazy Load)
    $('#tab-lansia').one('shown.bs.tab', async function(){
        try {
            const response = await callApi('getSkriningLansia', { 
                id_pendaftaran: pasienActive.id_pendaftaran 
            });
            if (response.status === 'success' && response.data) {
                const d = response.data;
                // Set AKS Radio Buttons
                $(`input[name="aks_bab"][value="${d.aks_bab}"]`).prop('checked', true);
                $(`input[name="aks_bak"][value="${d.aks_bak}"]`).prop('checked', true);
                $(`input[name="aks_diri"][value="${d.aks_diri}"]`).prop('checked', true);
                $(`input[name="aks_wc"][value="${d.aks_wc}"]`).prop('checked', true);
                $(`input[name="aks_makan"][value="${d.aks_makan}"]`).prop('checked', true);
                $(`input[name="aks_gerak"][value="${d.aks_gerak}"]`).prop('checked', true);
                $(`input[name="aks_jalan"][value="${d.aks_jalan}"]`).prop('checked', true);
                $(`input[name="aks_pakai"][value="${d.aks_pakai}"]`).prop('checked', true);
                $(`input[name="aks_tangga"][value="${d.aks_tangga}"]`).prop('checked', true);
                $(`input[name="aks_mandi"][value="${d.aks_mandi}"]`).prop('checked', true);

                // Set SKILAS Dropdowns
                $('[name="skilas_kognitif"]').val(d.skilas_kognitif);
                $('[name="skilas_mobilitas"]').val(d.skilas_mobilitas);
                $('[name="skilas_nutrisi"]').val(d.skilas_nutrisi);
                $('[name="skilas_mata"]').val(d.skilas_mata);
                $('[name="skilas_telinga"]').val(d.skilas_telinga);
                $('[name="skilas_depresi"]').val(d.skilas_depresi);
                
                hitungSkorAKS();
                hitungHasilSKILAS();
                setButtonMode('#btnSimpanLansia', 'update');
            }
        } catch (e) { console.error("Gagal load Lansia:", e); }
    });

    // --- LOGIKA TAB BALITA (0-5 TAHUN) ---
    if (parseInt(pasienActive.umur) <= 5) {
        $('#tab-balita').removeClass('disabled');
    }

    // Load Data Balita (Lazy Load)
    $('#tab-balita').one('shown.bs.tab', async function(){
        try {
            const response = await callApi('getPelayananBalita', { 
                id_pendaftaran: pasienActive.id_pendaftaran 
            });
            if (response.status === 'success' && response.data) {
                const d = response.data;
                $('[name="plot_bbu"]').val(d.plot_bbu);
                $('[name="plot_tbu"]').val(d.plot_tbu);
                $('[name="plot_bbtb"]').val(d.plot_bbtb);
                $('[name="plot_lk"]').val(d.plot_lk);
                
                $(`input[name="asi_eksklusif"][value="${d.asi_eksklusif}"]`).prop('checked', true);
                $(`input[name="mpasi"][value="${d.mpasi}"]`).prop('checked', true);
                $(`input[name="imunisasi"][value="${d.imunisasi}"]`).prop('checked', true);
                $(`input[name="vitamin_a"][value="${d.vitamin_a}"]`).prop('checked', true);
                $(`input[name="obat_cacing"][value="${d.obat_cacing}"]`).prop('checked', true);
                $(`input[name="mt_pemulihan"][value="${d.mt_pemulihan}"]`).prop('checked', true);

                setButtonMode('#btnSimpanBalita', 'update');
            }
        } catch (e) { console.error("Gagal load Balita:", e); }
    });

    // --- LOGIKA TAB IBU (HAMIL / NIFAS) ---
    if (pasienActive.kategori === 'Ibu Hamil' || pasienActive.kategori === 'Ibu Nifas') {
        $('#tab-ibu').removeClass('disabled');
        
        // Auto-select status berdasarkan kategori saat pendaftaran
        if (pasienActive.kategori === 'Ibu Hamil') {
             $('#sts_hamil').prop('checked', true).trigger('change');
        } else {
             $('#sts_nifas').prop('checked', true).trigger('change');
        }
    }

    // Event Listener: Ganti Status Ibu
    $('input[name="status_ibu"]').on('change', function() {
        const status = $(this).val();
        if (status === 'Hamil') {
            $('#sectionHamil').removeClass('d-none');
            $('#sectionNifas').addClass('d-none');
            // Ambil nilai LILA dari Tab 1 untuk referensi
            const lilaVal = $('#inputLILA').val();
            if (lilaVal) {
                $('#refLilaIbu').val(lilaVal + " cm (" + (parseFloat(lilaVal) < 23.5 ? "KEK" : "Normal") + ")");
            }
        } else {
            $('#sectionHamil').addClass('d-none');
            $('#sectionNifas').removeClass('d-none');
        }
    });

    // Load Data Ibu (Lazy Load)
    $('#tab-ibu').one('shown.bs.tab', async function(){
        // Update referensi LILA saat tab dibuka
        $('input[name="status_ibu"]:checked').trigger('change'); 

        try {
            const response = await callApi('getPelayananIbu', { 
                id_pendaftaran: pasienActive.id_pendaftaran 
            });
            if (response.status === 'success' && response.data) {
                const d = response.data;
                $(`input[name="status_ibu"][value="${d.status_ibu}"]`).prop('checked', true).trigger('change');
                $('[name="usia_kehamilan"]').val(d.usia_kehamilan);
                $('[name="ttd_diberikan"]').val(d.ttd_diberikan);
                $('[name="ttd_konsumsi"]').val(d.ttd_konsumsi);
                $('[name="pmt_bumil_kek"]').val(d.pmt_bumil_kek);
                $('[name="vitamin_a_nifas"]').val(d.vitamin_a_nifas);

                setButtonMode('#btnSimpanIbu', 'update');
            }
        } catch (e) { console.error("Gagal load Ibu:", e); }
    });

    // --- LOGIKA TAB REMATRI (PEREMPUAN 10-18 TAHUN) ---
    // Kita pakai rentang agak longgar 10-19 tahun untuk WUS muda
    const umurRematri = parseInt(pasienActive.umur);
    if (pasienActive.jk === 'Perempuan' && umurRematri >= 10 && umurRematri <= 19) {
        $('#tab-rematri').removeClass('disabled');
    }

    // Auto-Calculate Status Anemia
    $('#inputHB').on('input', function() {
        const hb = parseFloat($(this).val());
        const badge = $('#hasilAnemia');
        if (!isNaN(hb) && hb > 0) {
            if (hb < 12.0) {
                badge.text('Anemia').removeClass('bg-secondary bg-success').addClass('bg-danger');
            } else {
                badge.text('Normal').removeClass('bg-secondary bg-danger').addClass('bg-success');
            }
        } else {
            badge.text('-').removeClass('bg-success bg-danger').addClass('bg-secondary');
        }
    });

    // Load Data Rematri (Lazy Load)
    $('#tab-rematri').one('shown.bs.tab', async function(){
        try {
            const response = await callApi('getPelayananRematri', { 
                id_pendaftaran: pasienActive.id_pendaftaran 
            });
            if (response.status === 'success' && response.data) {
                $('#inputHB').val(response.data.nilai_hb).trigger('input');
                setButtonMode('#btnSimpanRematri', 'update');
            }
        } catch (e) { console.error("Gagal load Rematri:", e); }
    });

    // 3. Atur Tampilan Form Sesuai Kategori
    const kat = pasienActive.kategori;
    if (kat === 'Balita') {
        $('.input-balita').removeClass('d-none');
    } else {
        $('.input-dewasa').removeClass('d-none'); // Default untuk Remaja, Dewasa, Lansia
    }
    if (kat === 'Ibu Hamil' || kat === 'Ibu Nifas' || (pasienActive.jk === 'Perempuan' && parseInt(pasienActive.umur) >= 15)) {
        $('.input-wus').removeClass('d-none');
    }

    // 4. FITUR AUTO-CALCULATE (IMT, Tensi, Gula)
    $('#formRutin input').on('input change', function() {
        hitungOtomatis();
        simpanDraftLokal(); // <--- AUTO-SAVE DRAFT SETIAP KETIK
    });

    // VERSI FINAL: PERBAIKAN UI/WARNA
    function hitungOtomatis() {
        // --- 1. HITUNG IMT ---
        const bbVal = $('#inputBB').val();
        const tbVal = $('#inputTB').val();
        const bb = parseFloat(bbVal);
        const tb = parseFloat(tbVal);
        
        // Reset tampilan ke default (abu-abu)
        $('#hasilIMT').val('');
        $('#statusGizi')
            .val('')
            .removeClass('bg-success bg-warning bg-danger text-white')
            .addClass('bg-light'); // Default abu-abu

        if (!isNaN(bb) && !isNaN(tb) && bb > 0 && tb > 0) {
            const imt = bb / Math.pow(tb / 100, 2);
            $('#hasilIMT').val(imt.toFixed(1));

            let stGizi = '';
            let bgClass = 'bg-light'; // Default

            if (imt < 18.5) {
                stGizi = 'Kurus';
                bgClass = 'bg-warning';
            } else if (imt <= 25.0) {
                stGizi = 'Normal';
                bgClass = 'bg-success text-white';
            } else if (imt <= 27.0) {
                stGizi = 'Gemuk';
                bgClass = 'bg-warning';
            } else {
                stGizi = 'Obesitas';
                bgClass = 'bg-danger text-white';
            }
            
            // Hapus bg-light dulu, baru tambah warna baru
            $('#statusGizi')
                .val(stGizi)
                .removeClass('bg-light bg-success bg-warning bg-danger text-white')
                .addClass(bgClass);
        }

        // --- 2. HITUNG TENSI ---
        const sisVal = $('#inputSistole').val();
        const diaVal = $('#inputDiastole').val();
        const sis = parseInt(sisVal);
        const dia = parseInt(diaVal);

        // Reset tampilan ke default
        $('#statusTD')
            .val('')
            .removeClass('bg-success bg-warning bg-danger text-white')
            .addClass('bg-light');

        if (!isNaN(sis) && !isNaN(dia) && sis > 0 && dia > 0) {
            let stTD = '';
            let bgClassTD = 'bg-light';

            if (sis >= 140 || dia >= 90) {
                stTD = 'Hipertensi';
                bgClassTD = 'bg-danger text-white';
            } else if (sis >= 130 || dia >= 85) {
                stTD = 'Normal Tinggi';
                bgClassTD = 'bg-warning';
            } else {
                stTD = 'Normal';
                bgClassTD = 'bg-success text-white';
            }
            
            // Hapus bg-light dulu, baru tambah warna baru
            $('#statusTD')
                .val(stTD)
                .removeClass('bg-light bg-success bg-warning bg-danger text-white')
                .addClass(bgClassTD);
        }
        
        // --- 3. STATUS GULA (Sudah Oke, kita rapikan saja) ---
        const gulaVal = $('#inputGula').val();
        
        // Reset tampilan
        $('#statusGula')
            .text('-')
            .removeClass('bg-success bg-warning bg-danger text-white')
            .addClass('bg-light');

        if (gulaVal !== '' && !isNaN(parseInt(gulaVal))) {
             const gula = parseInt(gulaVal);
             let stGula = '';
             let bgClassGula = 'bg-light';

             if (gula >= 200) {
                 stGula = 'Diabetes';
                 bgClassGula = 'bg-danger text-white';
             } else if (gula >= 140) {
                 stGula = 'Pre-Diabetes';
                 bgClassGula = 'bg-warning';
             } else {
                 stGula = 'Normal';
                 bgClassGula = 'bg-success text-white';
             }

             $('#statusGula')
                .text(stGula)
                .removeClass('bg-light bg-success bg-warning bg-danger text-white')
                .addClass(bgClassGula);
        }
    }

    // 5. FITUR AUTO-SAVE DRAFT (LOCAL STORAGE)
    const DRAFT_KEY = 'draft_rutin_' + pasienActive.id_pendaftaran;
    
    function simpanDraftLokal() {
        const draftData = {
             bb: $('#inputBB').val(),
             tb: $('#inputTB').val(),
             lk: $('#inputLK').val(),
             lp: $('#inputLP').val(),
             lila: $('#inputLILA').val(),
             sis: $('#inputSistole').val(),
             dia: $('#inputDiastole').val(),
             gula: $('#inputGula').val()
        };
        localStorage.setItem(DRAFT_KEY, JSON.stringify(draftData));
        $('#autoSaveStatus').html('<i class="fas fa-check-circle text-success me-1"></i>Draft tersimpan di perangkat ini');
    }

    function muatDraftLokal() {
        const draftJson = localStorage.getItem(DRAFT_KEY);
        if (draftJson) {
            const draft = JSON.parse(draftJson);
            $('#inputBB').val(draft.bb);
            $('#inputTB').val(draft.tb);
            $('#inputLK').val(draft.lk);
            $('#inputLP').val(draft.lp);
            $('#inputLILA').val(draft.lila);
            $('#inputSistole').val(draft.sis);
            $('#inputDiastole').val(draft.dia);
            $('#inputGula').val(draft.gula);
            
            // Trigger perhitungan setelah muat draft
            hitungOtomatis();
            //console.log("Draft lokal dimuat untuk ID:", pasienActive.id_pendaftaran);
        }
    }

    // Jalankan muat draft saat halaman terbuka
    muatDraftLokal();

    // 6. LISTENER TOMBOL SIMPAN (KE SERVER)
    // ... (Akan kita buat setelah Anda tes UI & Auto-calculate ini dulu) ...
}

// --- GLOBAL LISTENER: SIMPAN PEMERIKSAAN RUTIN (TAB 1) ---
$(document).on('click', '#btnSimpanRutin', async function(e) {
    e.preventDefault();

    // 1. Validasi Form HTML5 (hanya untuk input yang visible/wajib)
    const form = document.getElementById('formRutin');
    if (!form.checkValidity()) {
        form.reportValidity();
        return;
    }

    // 2. Ambil Data dari Input
    const dataRutin = {
        id_pendaftaran: $('#currentIdPendaftaran').val(),
        // Input Manual
        bb: $('#inputBB').val(),
        tb: $('#inputTB').val(),
        lk: $('#inputLK').val(),
        lp: $('#inputLP').val(),
        lila: $('#inputLILA').val(),
        td_sistole: $('#inputSistole').val(),
        td_diastole: $('#inputDiastole').val(),
        gula_darah: $('#inputGula').val(),
        // Hasil Otomatis (ambil dari value input readonly)
        imt: $('#hasilIMT').val(),
        status_gizi: $('#statusGizi').val(),
        status_td: $('#statusTD').val(),
        status_gula: $('#statusGula').text() // Karena ini pakai tag <span> atau text(), bukan .val()
    };

    // Bersihkan status gula jika isinya masih strip '-'
    if (dataRutin.status_gula === '-') dataRutin.status_gula = '';

    //console.log("[DEBUG Rutin] Data yang dikirim:", dataRutin);

    // 3. Loading UI
    const btn = $(this);
    const originalHtml = btn.html();
    btn.prop('disabled', true).html('<i class="fas fa-spinner fa-spin me-2"></i>Menyimpan...');

    try {
        // 4. Panggil API
        const response = await callApi('savePemeriksaanRutin', { data: dataRutin });

        if (response.status === 'success') {
            Swal.fire({
                icon: 'success',
                title: 'Tersimpan!',
                text: 'Data pemeriksaan rutin berhasil disimpan.',
                timer: 1500,
                showConfirmButton: false
            });
            
            // Ubah tombol menjadi mode UPDATE
            setButtonMode('#btnSimpanRutin', 'update');
            // -----------------------------

            // Hapus draft lokal karena sudah tersimpan di server
            const DRAFT_KEY = 'draft_rutin_' + dataRutin.id_pendaftaran;
            localStorage.removeItem(DRAFT_KEY);
            $('#autoSaveStatus').html(''); // Kosongkan status autosave

            // TODO: Nanti di sini kita bisa otomatis pindah ke Tab 2 (TBC)
            // $('[data-bs-target="#content-tbc"]').tab('show');

        } else {
            Swal.fire('Gagal', response.message, 'error');
        }

    } catch (error) {
        console.error("[DEBUG Rutin] Error:", error);
        Swal.fire('Error', 'Terjadi kesalahan sistem.', 'error');
    } finally {
        btn.prop('disabled', false).html(originalHtml);
    }
});

// --- GLOBAL LISTENER: SIMPAN SKRINING TBC (TAB 2) ---
$(document).on('click', '#btnSimpanTBC', async function(e) {
    e.preventDefault();

    // 1. Ambil Data Pasien Aktif dari Session
    const activeData = JSON.parse(sessionStorage.getItem('activePasien'));
    if (!activeData || !activeData.id_pasien) {
        Swal.fire('Error', 'Data sesi pasien hilang. Silakan kembali ke dashboard.', 'error');
        return;
    }

    // 2. Validasi HTML5 (Pastikan semua radio terpilih)
    const form = document.getElementById('formTBC');
    if (!form.checkValidity()) {
        form.reportValidity();
        return;
    }

    // 3. Siapkan Data
    const dataTBC = {
        id_pendaftaran: activeData.id_pendaftaran,
        id_pasien: activeData.id_pasien,
        tanggal_skrining: getTodayDate(),
        // Ambil value dari radio button yang terpilih (:checked)
        batuk: $('input[name="tbc_batuk"]:checked').val(),
        demam: $('input[name="tbc_demam"]:checked').val(),
        bb_turun: $('input[name="tbc_bb"]:checked').val(),
        kontak: $('input[name="tbc_kontak"]:checked').val()
    };

    //console.log("[DEBUG TBC] Sending:", dataTBC);

    // 4. Loading UI
    const btn = $(this);
    const originalHtml = btn.html();
    btn.prop('disabled', true).html('<i class="fas fa-spinner fa-spin me-2"></i>Menyimpan...');

    try {
        // 5. Panggil API
        const response = await callApi('saveSkriningTBC', { data: dataTBC });

        if (response.status === 'success') {
            // Tampilkan notifikasi sukses
            Swal.fire({
                icon: 'success',
                title: 'Tersimpan!',
                text: 'Hasil Skrining TBC: ' + response.data.hasil,
                timer: 2000,
                showConfirmButton: false
            });

            // --- UPDATE UI OTOMATIS (TANPA RELOAD) ---
            
            // 1. Ubah tombol jadi 'UPDATE'
            setButtonMode('#btnSimpanTBC', 'update');

            // 2. Update Badge Hasil langsung dari respon server agar akurat
            const hasilBadge = $('#hasilTBC');
            if (response.data.hasil === 'Terduga TBC') {
                hasilBadge.text('Terduga TBC')
                    .removeClass('bg-secondary bg-success')
                    .addClass('bg-danger');
            } else {
                hasilBadge.text('Normal')
                    .removeClass('bg-secondary bg-danger')
                    .addClass('bg-success');
            }

        } else {
            Swal.fire('Gagal', response.message, 'error');
        }

    } catch (error) {
        console.error("[DEBUG TBC] Error:", error);
        Swal.fire('Error', 'Terjadi kesalahan sistem.', 'error');
    } finally {
        // Kembalikan tombol (jika tadi error/selesai)
        // Note: Jika sukses, setButtonMode sudah mengubah teksnya jadi 'UPDATE',
        // jadi kita hanya perlu enable lagi, jangan timpa HTML-nya jika sudah mode update.
        btn.prop('disabled', false);
        if (!btn.hasClass('btn-warning')) { // Jika masih mode SIMPAN (biru), kembalikan teks aslinya
             btn.html(originalHtml);
        }
    }
});

// --- GLOBAL LISTENER: SIMPAN SKRINING INDERA (TAB 3) ---
$(document).on('click', '#btnSimpanIndera', async function(e) {
    e.preventDefault();
    const activeData = JSON.parse(sessionStorage.getItem('activePasien'));
    if(!activeData) return;

    const dataIndera = {
        id_pendaftaran: activeData.id_pendaftaran,
        id_pasien: activeData.id_pasien,
        tanggal_skrining: getTodayDate(),
        mata_kanan: $('input[name="mata_kanan"]:checked').val(),
        mata_kiri: $('input[name="mata_kiri"]:checked').val(),
        telinga_kanan: $('input[name="telinga_kanan"]:checked').val(),
        telinga_kiri: $('input[name="telinga_kiri"]:checked').val()
    };

    //console.log("[DEBUG INDERA] Sending:", dataIndera);

    const btn = $(this);
    const originalHtml = btn.html();
    // Nonaktifkan tombol dan ubah teks saat proses
    btn.prop('disabled', true).html('<i class="fas fa-spinner fa-spin me-2"></i>Menyimpan...');

    try {
        const response = await callApi('saveSkriningIndera', { data: dataIndera });
        
        if (response.status === 'success') {
            Swal.fire({
                icon: 'success',
                title: 'Tersimpan!',
                text: 'Hasil Skrining Indera: ' + response.data.hasil,
                timer: 1500,
                showConfirmButton: false
            });
            
            // SUKSES: Ubah jadi mode UPDATE dan aktifkan kembali
            setButtonMode('#btnSimpanIndera', 'update');
            btn.prop('disabled', false);
            
            // Update badge hasil
            const hasilBadge = $('#hasilIndera');
            if (response.data.hasil !== 'Normal') {
                 hasilBadge.text(response.data.hasil).removeClass('bg-success').addClass('bg-danger');
            } else {
                 hasilBadge.text('Normal').removeClass('bg-danger').addClass('bg-success');
            }

        } else {
            // GAGAL DARI SERVER: Kembalikan tombol ke semula
            Swal.fire('Gagal', response.message, 'error');
            btn.prop('disabled', false).html(originalHtml);
        }
    } catch (error) {
        // ERROR SISTEM: Kembalikan tombol ke semula
        console.error("[DEBUG INDERA] Error:", error);
        Swal.fire('Error', 'Terjadi kesalahan sistem.', 'error');
        btn.prop('disabled', false).html(originalHtml);
    }
});

// --- GLOBAL LISTENER: SIMPAN SKRINING PPOK (TAB 4) ---
$(document).on('click', '#btnSimpanPPOK', async function(e) {
    e.preventDefault();
    const activeData = JSON.parse(sessionStorage.getItem('activePasien'));
    if(!activeData) return;

    const dataPPOK = {
        id_pendaftaran: activeData.id_pendaftaran,
        id_pasien: activeData.id_pasien,
        tanggal_skrining: getTodayDate(),
        merokok: $('input[name="puma_rokok"]:checked').val(),
        napas_pendek: $('input[name="puma_napas"]:checked').val(),
        dahak: $('input[name="puma_dahak"]:checked').val(),
        batuk: $('input[name="puma_batuk"]:checked').val(),
        spirometri: $('input[name="puma_spiro"]:checked').val()
    };

    //console.log("[DEBUG PPOK] Sending:", dataPPOK);
    const btn = $(this);
    const originalHtml = btn.html();
    btn.prop('disabled', true).html('<i class="fas fa-spinner fa-spin me-2"></i>Menyimpan...');

    try {
        const response = await callApi('saveSkriningPPOK', { data: dataPPOK });
        if (response.status === 'success') {
            Swal.fire({
                icon: 'success',
                title: 'Tersimpan!',
                // Tampilkan skor final dari server untuk konfirmasi
                html: `Total Skor PUMA: <b>${response.data.skor}</b><br>Hasil: <b>${response.data.hasil}</b>`,
                timer: 2000,
                showConfirmButton: false
            });
            setButtonMode('#btnSimpanPPOK', 'update');
        } else {
            Swal.fire('Gagal', response.message, 'error');
            btn.prop('disabled', false).html(originalHtml);
        }
    } catch (error) {
        console.error("[DEBUG PPOK] Error:", error);
        Swal.fire('Error', 'Terjadi kesalahan sistem.', 'error');
        btn.prop('disabled', false).html(originalHtml);
    }
});

// --- GLOBAL LISTENER: SIMPAN LANSIA (TAB 5) ---
$(document).on('click', '#btnSimpanLansia', async function(e) {
    e.preventDefault();
    const activeData = JSON.parse(sessionStorage.getItem('activePasien'));
    if(!activeData) return;

    // Kumpulkan data menggunakan serializeArray agar otomatis mengambil semua input yang ada 'name'-nya
    const formData = {};
    $('#formLansia').serializeArray().forEach(item => {
        formData[item.name] = item.value;
    });
    
    // Tambahan data wajib
    formData.id_pendaftaran = activeData.id_pendaftaran;
    formData.id_pasien = activeData.id_pasien;
    formData.tanggal_skrining = getTodayDate();

    //console.log("[DEBUG Lansia] Sending:", formData);

    const btn = $(this);
    const originalHtml = btn.html();
    btn.prop('disabled', true).html('<i class="fas fa-spinner fa-spin me-2"></i>Menyimpan...');

    try {
        const response = await callApi('saveSkriningLansia', { data: formData });
        if (response.status === 'success') {
             Swal.fire({
                icon: 'success',
                title: 'Tersimpan!',
                html: `Skor AKS: <b>${response.data.skor_aks}</b> (${response.data.hasil_aks})<br>SKILAS: <b>${response.data.hasil_skilas}</b>`,
                timer: 2500,
                showConfirmButton: false
            });
            setButtonMode('#btnSimpanLansia', 'update');
        } else {
            Swal.fire('Gagal', response.message, 'error');
             btn.prop('disabled', false).html(originalHtml);
        }
    } catch (error) {
        console.error("[DEBUG Lansia] Error:", error);
        Swal.fire('Error', 'Terjadi kesalahan sistem.', 'error');
         btn.prop('disabled', false).html(originalHtml);
    }
});

// --- GLOBAL LISTENER: SIMPAN BALITA (TAB 6) ---
$(document).on('click', '#btnSimpanBalita', async function(e) {
    e.preventDefault();
    const activeData = JSON.parse(sessionStorage.getItem('activePasien'));
    if(!activeData) return;

    const formData = {};
    $('#formBalita').serializeArray().forEach(item => {
        formData[item.name] = item.value;
    });
    
    formData.id_pendaftaran = activeData.id_pendaftaran;
    formData.id_pasien = activeData.id_pasien;
    formData.tanggal_pelayanan = getTodayDate();

    //console.log("[DEBUG Balita] Sending:", formData);
    const btn = $(this); const originalHtml = btn.html();
    btn.prop('disabled', true).html('<i class="fas fa-spinner fa-spin me-2"></i>Menyimpan...');

    try {
        const response = await callApi('savePelayananBalita', { data: formData });
        if (response.status === 'success') {
            Swal.fire({icon: 'success', title: 'Tersimpan!', timer: 1500, showConfirmButton: false});
            setButtonMode('#btnSimpanBalita', 'update');
        } else {
            Swal.fire('Gagal', response.message, 'error');
            btn.prop('disabled', false).html(originalHtml);
        }
    } catch (error) {
        console.error("[DEBUG Balita] Error:", error);
        Swal.fire('Error', 'Terjadi kesalahan sistem.', 'error');
        btn.prop('disabled', false).html(originalHtml);
    }
});

// --- GLOBAL LISTENER: SIMPAN IBU (TAB 7) ---
$(document).on('click', '#btnSimpanIbu', async function(e) {
    e.preventDefault();
    const activeData = JSON.parse(sessionStorage.getItem('activePasien'));
    if(!activeData) return;

    const formData = {};
    $('#formIbu').serializeArray().forEach(item => { formData[item.name] = item.value; });
    formData.id_pendaftaran = activeData.id_pendaftaran;
    formData.id_pasien = activeData.id_pasien;
    formData.tanggal_pelayanan = getTodayDate();

    //console.log("[DEBUG Ibu] Sending:", formData);
    const btn = $(this); const originalHtml = btn.html();
    btn.prop('disabled', true).html('<i class="fas fa-spinner fa-spin me-2"></i>Menyimpan...');

    try {
        const response = await callApi('savePelayananIbu', { data: formData });
        if (response.status === 'success') {
            Swal.fire({icon: 'success', title: 'Tersimpan!', timer: 1500, showConfirmButton: false});
            setButtonMode('#btnSimpanIbu', 'update');
        } else {
            Swal.fire('Gagal', response.message, 'error');
            btn.prop('disabled', false).html(originalHtml);
        }
    } catch (error) {
        console.error("[DEBUG Ibu] Error:", error);
        Swal.fire('Error', 'Terjadi kesalahan sistem.', 'error');
        btn.prop('disabled', false).html(originalHtml);
    }
});

// --- GLOBAL LISTENER: SIMPAN REMATRI (TAB 8) ---
$(document).on('click', '#btnSimpanRematri', async function(e) {
    e.preventDefault();
    const activeData = JSON.parse(sessionStorage.getItem('activePasien'));
    if(!activeData) return;

    const hbVal = $('#inputHB').val();
    if (!hbVal) {
        Swal.fire('Peringatan', 'Harap isi nilai Hb.', 'warning');
        return;
    }

    const dataRematri = {
        id_pendaftaran: activeData.id_pendaftaran,
        id_pasien: activeData.id_pasien,
        tanggal_pelayanan: getTodayDate(),
        nilai_hb: hbVal
    };

    //console.log("[DEBUG Rematri] Sending:", dataRematri);
    const btn = $(this); const originalHtml = btn.html();
    btn.prop('disabled', true).html('<i class="fas fa-spinner fa-spin me-2"></i>Menyimpan...');

    try {
        const response = await callApi('savePelayananRematri', { data: dataRematri });
        if (response.status === 'success') {
            Swal.fire({
                icon: 'success',
                title: 'Tersimpan!',
                text: 'Status: ' + response.data.status_anemia,
                timer: 1500,
                showConfirmButton: false
            });
            setButtonMode('#btnSimpanRematri', 'update');
        } else {
            Swal.fire('Gagal', response.message, 'error');
            btn.prop('disabled', false).html(originalHtml);
        }
    } catch (error) {
        console.error("[DEBUG Rematri] Error:", error);
        Swal.fire('Error', 'Terjadi kesalahan sistem.', 'error');
        btn.prop('disabled', false).html(originalHtml);
    }
});

// --- GLOBAL LISTENER: SELESAI PELAYANAN ---
$(document).on('click', '#btnSelesaiPelayanan', function(e) {
    e.preventDefault();
    const activeData = JSON.parse(sessionStorage.getItem('activePasien'));
    if(!activeData) return;

    Swal.fire({
        title: 'Selesaikan Pelayanan?',
        text: "Pastikan semua pemeriksaan yang diperlukan sudah tersimpan.",
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: '#198754', // Warna hijau sukses Bootstrap
        cancelButtonColor: '#6c757d',
        confirmButtonText: 'Ya, Selesai',
        cancelButtonText: 'Belum'
    }).then(async (result) => {
        if (result.isConfirmed) {
            // Tampilkan loading
            Swal.fire({title: 'Memproses...', allowOutsideClick: false, didOpen: () => Swal.showLoading()});

            try {
                const response = await callApi('selesaikanPelayanan', { 
                    id_pendaftaran: activeData.id_pendaftaran 
                });

                if (response.status === 'success') {
                    Swal.fire({
                        icon: 'success',
                        title: 'Pelayanan Selesai!',
                        text: 'Pasien telah selesai dilayani.',
                        timer: 2000,
                        showConfirmButton: false
                    }).then(() => {
                        // Kembali ke halaman antrian
                        loadPage('pendaftaran', 'Kunjungan Hari Ini');
                    });
                    
                    // Hapus data sesi pasien aktif karena sudah selesai
                    sessionStorage.removeItem('activePasien');

                } else {
                    Swal.fire('Gagal', response.message, 'error');
                }
            } catch (error) {
                Swal.fire('Error', 'Terjadi kesalahan sistem.', 'error');
            }
        }
    });
});

window.viewResume = function(idPendaftaran) {
    sessionStorage.setItem('resumeId', idPendaftaran);
    loadPage('resume', 'Resume Kunjungan');
}

// --- HELPER: UBAH STATUS TOMBOL SIMPAN/UPDATE ---
function setButtonMode(btnSelector, mode) {
    const btn = $(btnSelector);
    if (mode === 'update') {
        // Mode Update: Warna Oranye (Warning di Bootstrap biasanya kuning/oranye)
        btn.removeClass('btn-primary btn-success').addClass('btn-warning text-dark fw-bold');
        // Ganti ikon dan teks
        const originalText = btn.text().trim().replace('SIMPAN', 'UPDATE'); 
        btn.html(`<i class="fas fa-edit me-2"></i>${originalText}`);
    } else {
        // Mode Simpan Awal: Warna Biru (Primary)
        btn.removeClass('btn-warning text-dark fw-bold').addClass('btn-primary');
        const originalText = btn.text().trim().replace('UPDATE', 'SIMPAN');
        btn.html(`<i class="fas fa-save me-2"></i>${originalText}`);
    }
}

// --- HALAMAN RESUME ---
window.init_resume = async function() {
    const resumeId = sessionStorage.getItem('resumeId');
    if (!resumeId) { loadPage('pendaftaran'); return; }

    // Set tanggal cetak
    $('#printDate').text(new Date().toLocaleString('id-ID'));

    try {
        const response = await callApi('getResumeKunjungan', { id_pendaftaran: resumeId });
        if (response.status === 'success') {
            const d = response.data;
            
            // 1. Render Identitas
            $('#resumeTanggal').text(d.pendaftaran.tanggal);
            $('#resNama').text(d.pasien.nama);
            $('#resNIK').text(d.pasien.nik);
            $('#resUmurJK').text(`${d.pasien.umur} Thn / ${d.pasien.jk}`);
            $('#resKategori').text(d.pendaftaran.kategori);

            // 2. Render TTV
            $('#resBBTB').text(`${d.pendaftaran.bb} kg / ${d.pendaftaran.tb} cm`);
            $('#resIMT').html(`${d.pendaftaran.imt || '-'} <br> <span class="badge bg-secondary">${d.pendaftaran.status_gizi || '-'}</span>`);
            $('#resTD').html(`${d.pendaftaran.td} <br> <span class="badge bg-secondary">${d.pendaftaran.status_td || '-'}</span>`);
            $('#resGula').html(`${d.pendaftaran.gula || '-'} <br> <span class="badge bg-secondary">${d.pendaftaran.status_gula || '-'}</span>`);

            // 3. Render Tabel Skrining (Dinamis)
            const tbody = $('#resumeSkriningBody');
            tbody.empty();
            let hasSkrining = false;

            // Helper untuk baris tabel
            const addRow = (nama, hasil, catatan) => {
                hasSkrining = true;
                const badgeColor = (hasil === 'Normal' || hasil === 'Mandiri (A)' || hasil === 'Tidak Berisiko' || hasil === 'Kadar HB Normal') ? 'success' : 'danger';
                tbody.append(`
                    <tr>
                        <td class="fw-bold">${nama}</td>
                        <td><span class="badge bg-${badgeColor}">${hasil}</span></td>
                        <td class="small text-muted">${catatan || '-'}</td>
                    </tr>
                `);
            };

            if (d.skrining.tbc) addRow('TBC', d.skrining.tbc.hasil, d.skrining.tbc.detail);
            if (d.skrining.indera) addRow('Indera (Mata/Telinga)', d.skrining.indera.hasil, `Mata: ${d.skrining.indera.mata}, Telinga: ${d.skrining.indera.telinga}`);
            if (d.skrining.ppok) addRow('PPOK (PUMA)', d.skrining.ppok.hasil, `Skor: ${d.skrining.ppok.skor}`);
            if (d.skrining.lansia) {
                addRow('Lansia - AKS', d.skrining.lansia.aks_hasil, `Skor Barthel: ${d.skrining.lansia.aks_skor}`);
                addRow('Lansia - SKILAS', d.skrining.lansia.skilas_hasil, 'Skrining Geriatri');
            }
            if (d.skrining.rematri) addRow('Anemia Rematri', d.skrining.rematri.status_anemia, `Hb: ${d.skrining.rematri.hb} g/dL`);
            // ... tambahkan untuk balita/ibu jika perlu ...

            if (!hasSkrining) {
                tbody.html('<tr><td colspan="3" class="text-center text-muted">Tidak ada skrining tambahan dilakukan.</td></tr>');
            }

        } else {
            Swal.fire('Error', 'Gagal memuat resume.', 'error');
        }
    } catch (e) {
        console.error(e);
        Swal.fire('Error', 'Gagal terhubung ke server.', 'error');
    }
}

// Helper: Ambil nilai semua checkbox yang dicentang berdasarkan 'name'
function getCheckedValues(name) {
    return $(`input[name="${name}[]"]:checked`).map(function() {
        return $(this).val();
    }).get();
}


// --- HALAMAN DASHBOARD ---
window.init_dashboard = async function() {
    try {
        const response = await callApi('getDashboardStats');

        if (response.status === 'success') {
            const d = response.data;

            // --- DEBUG LOGGING ---
            if (d.debug_info && d.debug_info.length > 0) {
                console.group("🕵️ DASHBOARD INVESTIGATION REPORT");
                //console.log("Backend membaca data berikut dari 5 kunjungan pertama bulan ini:");
                console.table(d.debug_info);
                console.groupEnd();
            } else {
                //console.log("🕵️ Dashboard: Tidak ada kunjungan bulan ini untuk diinvestigasi.");
            }
            // ---------------------
            
            // 1. Isi Kartu Statistik
            $('#dashKunjungan').text(d.card.kunjungan_bulan_ini);
            $('#dashPasien').text(d.card.total_pasien);
            $('#dashBalita').text(d.card.balita_bulan_ini);
            $('#dashRujukan').text(d.card.rujukan_bulan_ini);

            // 2. Render Grafik Tren (Line Chart)
            const trenCtx = document.getElementById('chartTren').getContext('2d');
            new Chart(trenCtx, {
                type: 'line',
                data: {
                    // Object.keys(d.chart_tren) akan menghasilkan ["2025-06", "2025-07", ...]
                    labels: Object.keys(d.chart_tren),
                    datasets: [{
                        label: 'Jumlah Kunjungan',
                        data: Object.values(d.chart_tren),
                        borderColor: '#7DB9B6',
                        backgroundColor: 'rgba(125, 185, 182, 0.1)',
                        tension: 0.3,
                        fill: true
                    }]
                },
                options: { 
                    responsive: true, 
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } }
                }
            });

            // 3. Render Grafik Kategori (Doughnut Chart)
            const katCtx = document.getElementById('chartKategori').getContext('2d');
            // Warna-warni untuk kategori
            const colors = ['#4D455D', '#E96479', '#7DB9B6', '#F5E9CF', '#FFB84C'];
            
            new Chart(katCtx, {
                type: 'doughnut',
                data: {
                    labels: Object.keys(d.chart_kategori),
                    datasets: [{
                        data: Object.values(d.chart_kategori),
                        backgroundColor: colors.slice(0, Object.keys(d.chart_kategori).length),
                        borderWidth: 2
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { position: 'bottom' } }
                }
            });

        } else {
             $('#app-content').html(`<div class="alert alert-danger">${response.message}</div>`);
        }

    } catch (e) {
        console.error(e);
        $('#app-content').html('<div class="alert alert-danger">Gagal memuat dashboard.</div>');
    }
}

// --- HALAMAN LAPORAN ---
window.init_laporan = function() {
    const today = new Date().toISOString().split('T')[0];
    
    // 1. Set Default Tanggal (Hari ini)
    $('#tglAwal').val(today);
    $('#tglAkhir').val(today);
    // Set max date agar tidak bisa pilih tanggal masa depan
    $('#tglAwal').attr('max', today);
    $('#tglAkhir').attr('max', today);

    // 2. Validasi Pintar Tanggal
    $('#tglAwal, #tglAkhir').on('change', function() {
        validasiTanggal();
    });

    function validasiTanggal() {
        const tglAwal = new Date($('#tglAwal').val());
        const tglAkhir = new Date($('#tglAkhir').val());
        const btnUnduh = $('#btnUnduhCSV');
        const errMssg = $('#tglError');

        // Reset state
        btnUnduh.prop('disabled', true);
        errMssg.addClass('d-none');

        // Validasi dasar
        if (!isValidDate(tglAwal) || !isValidDate(tglAkhir)) return;

        // Validasi 1: Tanggal Akhir tidak boleh kurang dari Tanggal Awal
        if (tglAkhir < tglAwal) {
            $('#tglAkhir').val($('#tglAwal').val()); // Auto-koreksi
            validasiTanggal(); // Re-validate
            return;
        }

        // Validasi 2: Maksimal 30 Hari
        const diffTime = Math.abs(tglAkhir - tglAwal);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 

        if (diffDays > 30) {
            errMssg.removeClass('d-none').text(`Rentang dipilih: ${diffDays} hari. Maksimal 30 hari.`);
        } else {
            // Semua oke, aktifkan tombol jika jenis laporan sudah dipilih
            if ($('#jenisLaporan').val()) {
                btnUnduh.prop('disabled', false);
            }
        }
    }

    // Helper cek valid date
    function isValidDate(d) { return d instanceof Date && !isNaN(d); }

    // Event Listener Jenis Laporan
    $('#jenisLaporan').on('change', function() {
        validasiTanggal();
    });

    // --- 3. PROSES UNDUH CSV ---
    $('#btnUnduhCSV').on('click', async function() {
        const jenis = $('#jenisLaporan').val();
        const tglAwal = $('#tglAwal').val();
        const tglAkhir = $('#tglAkhir').val();
        const btn = $(this);
        const originalHtml = btn.html();

        btn.prop('disabled', true).html('<i class="fas fa-spinner fa-spin me-2"></i>Memproses Data...');

        try {
            // Panggil API
            const response = await callApi('getLaporanData', {
                jenis_laporan: jenis,
                tgl_awal: tglAwal,
                tgl_akhir: tglAkhir
            });

            if (response.status === 'success') {
                if (response.data.length === 0) {
                     Swal.fire('Info', 'Tidak ada data pada rentang tanggal tersebut.', 'info');
                } else {
                    // Konversi JSON ke CSV dan Download
                    downloadCSV(response.data, `Laporan_${jenis}_${tglAwal}_${tglAkhir}.csv`);
                }
            } else {
                Swal.fire('Gagal', response.message, 'error');
            }

        } catch (error) {
            console.error(error);
            Swal.fire('Error', 'Gagal memuat data laporan.', 'error');
        } finally {
            btn.prop('disabled', false).html(originalHtml);
        }
    });

    // --- HELPER: DOWNLOAD CSV ---
    function downloadCSV(jsonData, filename) {
        if (jsonData.length === 0) return;

        // Ambil header dari key objek pertama
        const headers = Object.keys(jsonData[0]);
        const csvRows = [];
        
        // Tambahkan header ke baris pertama
        csvRows.push(headers.join(','));

        // Loop data
        for (const row of jsonData) {
            const values = headers.map(header => {
                const escaped = ('' + row[header]).replace(/"/g, '\\"'); // Escape tanda kutip
                return `"${escaped}"`; // Bungkus setiap nilai dengan tanda kutip
            });
            csvRows.push(values.join(','));
        }

        // Buat file blob
        const csvString = csvRows.join('\n');
        const blob = new Blob([csvString], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        
        // Buat link download sementara
        const a = document.createElement('a');
        a.setAttribute('hidden', '');
        a.setAttribute('href', url);
        a.setAttribute('download', filename);
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    }
}

// --- GLOBAL: LIHAT RIWAYAT PASIEN ---
window.showRiwayat = async function(idPasien, namaPasien) {
    $('#riwayatNamaPasien').text("Riwayat: " + namaPasien);
    const tbody = $('#tabelRiwayatBody');
    tbody.html('<tr><td colspan="4" class="text-center py-3"><div class="spinner-border spinner-border-sm text-info" role="status"></div> Memuat riwayat...</td></tr>');
    
    new bootstrap.Modal(document.getElementById('modalRiwayat')).show();

    try {
        const response = await callApi('getRiwayatPasien', { id: idPasien });
        if (response.status === 'success') {
            tbody.empty();
            if (response.data.length === 0) {
                tbody.html('<tr><td colspan="4" class="text-center text-muted fst-italic">Belum ada riwayat kunjungan.</td></tr>');
                return;
            }

            response.data.forEach(r => {
                // Cek apakah ada rujukan
                let statusBadge = '';
                if (r.status_rujukan === 'Ya') {
                    statusBadge = '<span class="badge bg-danger me-1">Dirujuk</span>';
                }
                
                // Badge status layanan
                let layananBadge = 'bg-warning text-dark';
                if (r.status_layanan === 'Selesai') layananBadge = 'bg-success';
                statusBadge += `<span class="badge ${layananBadge}">${r.status_layanan}</span>`;

                tbody.append(`
                    <tr>
                        <td>${r.tanggal}</td>
                        <td>${r.kategori}</td>
                        <td>${statusBadge}</td>
                        <td class="text-end">
                            <button class="btn btn-sm btn-outline-primary" onclick="tutupModalRiwayatDanBukaResume('${r.id_pendaftaran}')">
                                <i class="fas fa-file-medical-alt me-1"></i>Detail
                            </button>
                        </td>
                    </tr>
                `);
            });

        } else {
             tbody.html(`<tr><td colspan="4" class="text-danger text-center">${response.message}</td></tr>`);
        }
    } catch (e) {
        tbody.html(`<tr><td colspan="4" class="text-danger text-center">Gagal memuat data.</td></tr>`);
    }
}

// Helper kecil agar modal riwayat tertutup dulu sebelum pindah halaman ke Resume
window.tutupModalRiwayatDanBukaResume = function(idPendaftaran) {
    bootstrap.Modal.getInstance(document.getElementById('modalRiwayat')).hide();
    // Beri jeda sedikit agar animasi modal selesai
    setTimeout(() => {
        viewResume(idPendaftaran);
    }, 300);
}

// --- HALAMAN PENGATURAN ---
window.init_pengaturan = function() {
    // 1. Cek Role untuk Tampilan Tab Admin
    if (currentUser.role === 'admin' || currentUser.role === 'admin_posyandu' || currentUser.role === 'admin_puskesmas') {
        $('.admin-only').removeClass('d-none');
    }

    // --- A. LOGIKA GANTI PASSWORD (SEMUA USER) ---
    $('#formGantiPass').on('submit', async function(e) {
        e.preventDefault();
        
        const oldPass = $('#oldPass').val();
        const newPass = $('#newPass').val();
        const confirmPass = $('#confirmPass').val();

        // Validasi Frontend Sederhana
        if (newPass.length < 6) {
            Swal.fire('Peringatan', 'Password baru minimal 6 karakter.', 'warning');
            return;
        }
        if (newPass !== confirmPass) {
            Swal.fire('Peringatan', 'Konfirmasi password baru tidak cocok.', 'warning');
            return;
        }

        // Loading UI
        const btn = $('#btnSubmitPass');
        const originalText = btn.html();
        btn.prop('disabled', true).html('<i class="fas fa-spinner fa-spin me-2"></i>Memproses...');

        try {
            // Panggil API changePassword
            const response = await callApi('changePassword', {
                oldPass: oldPass,
                newPass: newPass
            });

            if (response.status === 'success') {
                Swal.fire({
                    icon: 'success',
                    title: 'Berhasil!',
                    text: 'Password Anda telah diubah. Silakan login ulang dengan password baru.',
                    confirmButtonText: 'OK, Logout'
                }).then(() => {
                    logout(); // Paksa logout agar aman
                });
            } else {
                Swal.fire('Gagal', response.message, 'error');
            }
        } catch (error) {
            console.error(error);
            Swal.fire('Error', 'Terjadi kesalahan sistem.', 'error');
        } finally {
            btn.prop('disabled', false).html(originalText);
        }
    });

    // --- B. MANAJEMEN POSYANDU ---
    let curPagePos = 1;
    let curSearchPos = '';

    $('#tab-posyandu').on('shown.bs.tab', () => loadPosyanduTable(1));
    
    // Listener Search Posyandu (Debounce sederhana)
    let debouncePos;
    $('#searchPosyandu').on('keyup', function() {
        clearTimeout(debouncePos);
        debouncePos = setTimeout(() => {
            curSearchPos = $(this).val().trim();
            loadPosyanduTable(1);
        }, 500);
    });

    async function loadPosyanduTable(page) {
        curPagePos = page;
        $('#tbodyPosyandu').html('<tr><td colspan="5" class="text-center py-4"><div class="spinner-border text-primary mb-2" role="status"></div><p class="mb-0">Memuat...</p></td></tr>');
        
        try {
            const res = await callApi('getPaginatedPosyandu', { page: page, search: curSearchPos });
            if (res.status === 'success') {
                const tbody = $('#tbodyPosyandu');
                tbody.empty();
                if (res.data.posyandu.length === 0) {
                    tbody.html('<tr><td colspan="5" class="text-center text-muted fst-italic py-4">Tidak ada data ditemukan.</td></tr>');
                } else {
                    res.data.posyandu.forEach(p => {
                        tbody.append(`
                            <tr>
                                <td class="ps-4 fw-bold">${p.id}</td>
                                <td>${p.nama}</td>
                                <td>${p.desa}</td>
                                <td><code class="small">${p.spreadsheet_id ? p.spreadsheet_id.substring(0, 10) + '...' : '-'}</code></td>
                                <td class="text-end pe-4">
                                    <button class="btn btn-sm btn-outline-primary me-1" onclick="editPosyandu('${p.id}', '${p.nama}', '${p.desa}', '${p.spreadsheet_id}')"><i class="fas fa-edit"></i></button>
                                    <button class="btn btn-sm btn-outline-danger" onclick="hapusPosyandu('${p.id}', '${p.nama}')"><i class="fas fa-trash"></i></button>
                                </td>
                            </tr>
                        `);
                    });
                }
                // Render Pagination
                renderPaginationUniversal(res.data.pagination, '#pagContainerPos', '#pagInfoPos', '#pagLinksPos', loadPosyanduTable);

            } else { $('#tbodyPosyandu').html(`<tr><td colspan="5" class="text-danger text-center py-4">${res.message}</td></tr>`); }
        } catch (e) { $('#tbodyPosyandu').html(`<tr><td colspan="5" class="text-danger text-center py-4">Gagal terhubung.</td></tr>`); }
    }

    // 3. Listener Tombol Simpan Posyandu (Modal)
    $('#btnSimpanPosyandu').on('click', async function() {
        const id = $('#editPosyanduId').val();
        const nama = $('#inputNamaPos').val().trim();
        const desa = $('#inputDesaPos').val().trim();
        const ssid = $('#inputSpreadsheetId').val().trim();

        if (!nama || !desa || !ssid) {
            Swal.fire('Peringatan', 'Semua field harus diisi.', 'warning');
            return;
        }

        const btn = $(this);
        const originalText = btn.html();
        btn.prop('disabled', true).html('<i class="fas fa-spinner fa-spin me-2"></i>Menyimpan...');

        try {
            const response = await callApi('savePosyandu', {
                data: { id: id, nama: nama, desa: desa, spreadsheet_id: ssid }
            });

            if (response.status === 'success') {
                bootstrap.Modal.getInstance(document.getElementById('modalPosyandu')).hide();
                Swal.fire({ icon: 'success', title: 'Berhasil', text: response.message, timer: 1500, showConfirmButton: false });
                loadPosyanduTable(); // Reload tabel
            } else {
                Swal.fire('Gagal', response.message, 'error');
            }
        } catch (e) {
            Swal.fire('Error', 'Terjadi kesalahan sistem.', 'error');
        } finally {
            btn.prop('disabled', false).html(originalText);
        }
    });

    // --- C. MANAJEMEN USER ---
    let curPageUser = 1;
    let curSearchUser = '';

    // Saat tab Users dibuka: Load Tabel User DAN Load Dropdown Posyandu
    $('#tab-users').on('shown.bs.tab', async function() {
        loadUserTable(1);
        loadUnitKerjaDropdown();
    });

    // Fungsi untuk mengisi dropdown Unit Kerja di Modal User
    async function loadUnitKerjaDropdown() {
        const dropdown = $('#inputUnitKerja');
        // Jangan muat ulang jika sudah ada isinya > 2 (Pilih... + GLOBAL + data)
        if (dropdown.children('option').length > 2) return; 

        try {
             // PANGGIL API BARU YANG TIDAK TER-PAGINASI
             const response = await callApi('getAllPosyanduDropdown');
             
             if (response.status === 'success') {
                 // Reset tapi sisakan opsi default
                 dropdown.html('<option value="">Pilih...</option><option value="GLOBAL">GLOBAL (Khusus Admin)</option>');
                 
                 response.data.forEach(pos => {
                     // pos.display_name sudah kita format di backend tadi
                     dropdown.append(new Option(pos.display_name, pos.id));
                 });
             }
        } catch (e) {
            console.error("Gagal load dropdown posyandu", e);
        }
    }

    let debounceUser;
    $('#searchUser').on('keyup', function() {
        clearTimeout(debounceUser);
        debounceUser = setTimeout(() => {
            curSearchUser = $(this).val().trim();
            loadUserTable(1);
        }, 500);
    });

    async function loadUserTable(page) {
        curPageUser = page;
        $('#tbodyUsers').html('<tr><td colspan="6" class="text-center py-4"><div class="spinner-border text-primary mb-2" role="status"></div><p class="mb-0">Memuat...</p></td></tr>');

        try {
            const res = await callApi('getPaginatedUsers', { page: page, search: curSearchUser });
            if (res.status === 'success') {
                const tbody = $('#tbodyUsers');
                tbody.empty();
                if (res.data.users.length === 0) {
                    tbody.html('<tr><td colspan="6" class="text-center text-muted fst-italic py-4">Tidak ada data user.</td></tr>');
                } else {
                    res.data.users.forEach(u => {
                        let badgeStatus = u.status === 'active' || u.status === 'Aktif' ? 'bg-success' : 'bg-secondary';
                        tbody.append(`
                            <tr>
                                <td class="ps-4 fw-bold">${u.username}</td>
                                <td>${u.nama_lengkap}</td>
                                <td><span class="badge bg-info text-dark">${u.role}</span></td>
                                <td>${u.posyandu_id}</td>
                                <td><span class="badge ${badgeStatus}">${u.status}</span></td>
                                <td class="text-end pe-4">
                                     <button class="btn btn-sm btn-outline-primary" onclick="editUser('${u.id}', '${u.username}', '${u.role}', '${u.posyandu_id}', '${u.nama_lengkap}', '${u.status}')"><i class="fas fa-user-edit"></i></button>
                                </td>
                            </tr>
                        `);
                    });
                }
                renderPaginationUniversal(res.data.pagination, '#pagContainerUser', '#pagInfoUser', '#pagLinksUser', loadUserTable);
            } else { $('#tbodyUsers').html(`<tr><td colspan="6" class="text-danger text-center">${res.message}</td></tr>`); }
        } catch (e) { $('#tbodyUsers').html(`<tr><td colspan="6" class="text-danger text-center">Gagal terhubung.</td></tr>`); }
    }

    // Listener Tombol Simpan User (Modal)
    $('#btnSimpanUser').on('click', async function() {
        // Ambil data dari form
        const userData = {
            id: $('#editUserId').val(),
            username: $('#inputUsername').val().trim(),
            role: $('#inputRole').val(),
            posyandu_id: $('#inputUnitKerja').val(),
            nama_lengkap: $('#inputNamaLengkap').val().trim(),
            password: $('#inputUserPass').val(), // Bisa kosong jika edit
            status: $('#inputStatus').val()
        };

        // Validasi sederhana
        if (!userData.username || !userData.role || !userData.posyandu_id || !userData.nama_lengkap) {
            Swal.fire('Peringatan', 'Semua field bertanda * wajib diisi.', 'warning');
            return;
        }
        // Validasi khusus user baru wajib ada password
        if (!userData.id && !userData.password) {
             Swal.fire('Peringatan', 'User baru wajib memiliki password.', 'warning');
             return;
        }

        const btn = $(this);
        const originalText = btn.html();
        btn.prop('disabled', true).html('<i class="fas fa-spinner fa-spin me-2"></i>Menyimpan...');

        try {
            const response = await callApi('saveUser', { data: userData });

            if (response.status === 'success') {
                bootstrap.Modal.getInstance(document.getElementById('modalUser')).hide();
                Swal.fire({ icon: 'success', title: 'Berhasil', text: response.message, timer: 1500, showConfirmButton: false });
                loadUserTable(curPageUser); // Reload tabel user
            } else {
                Swal.fire('Gagal', response.message, 'error');
            }
        } catch (e) {
            Swal.fire('Error', 'Terjadi kesalahan sistem.', 'error');
        } finally {
            btn.prop('disabled', false).html(originalText);
        }
    });
}



// Helper: Render Pagination Universal (DIPERBAIKI: Menggunakan data-page-num agar tidak bentrok dengan router)
function renderPaginationUniversal(pagination, containerId, infoId, linksId, onClickCallback) {
    const container = $(containerId);
    const info = $(infoId);
    const links = $(linksId);

    if (pagination.totalRows === 0) {
        container.css('visibility', 'hidden');
        return;
    }
    container.css('visibility', 'visible');
    
    const start = (pagination.currentPage - 1) * 10 + 1; 
    const end = Math.min(start + 9, pagination.totalRows);
    info.text(`Menampilkan ${start}-${end} dari ${pagination.totalRows} data`);

    links.empty();
    
    // Prev Button
    // Perhatikan perubahan dari data-page menjadi data-page-num
    links.append(`
        <li class="page-item ${pagination.currentPage === 1 ? 'disabled' : ''}">
            <a class="page-link" href="#" data-page-num="${pagination.currentPage - 1}">Prev</a>
        </li>
    `);

    // Page Numbers
    for (let i = 1; i <= pagination.totalPages; i++) {
         links.append(`
            <li class="page-item ${i === pagination.currentPage ? 'active' : ''}">
                <a class="page-link" href="#" data-page-num="${i}">${i}</a>
            </li>
         `);
    }

    // Next Button
    links.append(`
        <li class="page-item ${pagination.currentPage === pagination.totalPages ? 'disabled' : ''}">
            <a class="page-link" href="#" data-page-num="${pagination.currentPage + 1}">Next</a>
        </li>
    `);

    // Event Listener (Updated selector to data-page-num)
    // Kita gunakan .off() dulu untuk memastikan tidak ada listener ganda saat render ulang
    links.find('.page-link').off('click').on('click', function(e) {
        e.preventDefault();
        e.stopPropagation(); // Penting agar tidak 'bubbling' ke atas
        
        const page = $(this).data('page-num'); // Ambil dari atribut baru
        if (page && page !== pagination.currentPage) {
            onClickCallback(page);
        }
    });
}

// --- FUNGSI GLOBAL MANAJEMEN POSYANDU ---
window.tambahPosyandu = function() {
    $('#formPosyandu')[0].reset();
    $('#editPosyanduId').val('');
    $('#modalPosyanduTitle').text('Tambah Posyandu Baru');
    new bootstrap.Modal(document.getElementById('modalPosyandu')).show();
}

window.editPosyandu = function(id, nama, desa, ssid) {
    $('#editPosyanduId').val(id);
    $('#inputNamaPos').val(nama);
    $('#inputDesaPos').val(desa);
    $('#inputSpreadsheetId').val(ssid);
    $('#modalPosyanduTitle').text('Edit Posyandu: ' + nama);
    new bootstrap.Modal(document.getElementById('modalPosyandu')).show();
}

window.hapusPosyandu = function(id, nama) {
    Swal.fire({
        title: 'Hapus Posyandu?',
        text: `Anda yakin ingin menghapus ${nama}? Data yang sudah ada mungkin akan menjadi yatim piatu.`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        confirmButtonText: 'Ya, Hapus'
    }).then(async (result) => {
        if (result.isConfirmed) {
            Swal.fire({title: 'Menghapus...', didOpen: () => Swal.showLoading()});
            try {
                const response = await callApi('deletePosyandu', { id: id });
                if (response.status === 'success') {
                    Swal.fire('Terhapus!', response.message, 'success');
                    // Kita perlu cara untuk me-reload tabel. 
                    // Cara termudah: trigger klik tab lagi jika sedang aktif
                    if ($('#tab-posyandu').hasClass('active')) {
                         $('#tab-posyandu').trigger('shown.bs.tab');
                    }
                } else {
                    Swal.fire('Gagal', response.message, 'error');
                }
            } catch (e) {
                Swal.fire('Error', 'Gagal menghubungi server.', 'error');
            }
        }
    });
}

// --- FUNGSI GLOBAL MANAJEMEN USER ---
window.tambahUser = function() {
    $('#formUser')[0].reset();
    $('#editUserId').val('');
    $('#modalUserTitle').text('Tambah User Baru');
    $('#inputUsername').prop('readonly', false); // Username bisa diedit saat tambah baru
    $('#helpPassword').text('Password wajib diisi untuk user baru.');
    new bootstrap.Modal(document.getElementById('modalUser')).show();
}

window.editUser = function(id, username, role, posyanduId, namaLengkap, status) {
    $('#editUserId').val(id);
    $('#inputUsername').val(username).prop('readonly', true); // Username tidak boleh diganti saat edit
    $('#inputRole').val(role);
    $('#inputUnitKerja').val(posyanduId);
    $('#inputNamaLengkap').val(namaLengkap);
    $('#inputStatus').val(status);
    
    $('#modalUserTitle').text('Edit User: ' + username);
    $('#helpPassword').text('Kosongkan jika tidak ingin mengubah password user ini.');
    new bootstrap.Modal(document.getElementById('modalUser')).show();
}

// Tambahan: Fungsi Hapus User (Opsional, tapi baik untuk kelengkapan)
// Note: Di backend kita belum buat deleteUser, tapi kita bisa pakai changeStatus jadi 'inactive'
// Untuk sekarang kita pending dulu deleteUser fisik, fokus ke Add/Edit dulu.

// --- HALAMAN WELCOME (BERANDA) ---
window.init_welcome = function() {
    // Pastikan data user tersedia
    if (currentUser) {
        // Format: "Posyandu Mawar desa Sukamaju"
        const unitText = `POSYANDU : ${currentUser.namaPosyandu} Desa ${currentUser.namaDesa}`;
        $('#welcomeUnit').text(unitText);
    }
}