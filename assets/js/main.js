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
    $(".list-group-item-action[data-page]").click(function (e) {
        e.preventDefault();
        
        // Hapus kelas active dari semua menu
        $(".list-group-item-action").removeClass("active");
        // Tambahkan kelas active ke menu yang diklik
        $(this).addClass("active");

        const page = $(this).data("page");
        const title = $(this).text().trim();
        
        // Muat halaman
        loadPage(page, title);

        // Di mobile, otomatis tutup sidebar setelah klik menu
        if ($(window).width() <= 768) {
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

// --- GLOBAL LISTENER: TOMBOL SIMPAN/UPDATE (MODAL) ---
$(document).on('click', '#btnSavePasien', async function(e) {
    e.preventDefault();

    // 1. Validasi Form HTML5
    const form = document.getElementById('formPasien');
    if (!form.checkValidity()) {
        form.reportValidity();
        return;
    }

    // 2. Siapkan Data dari Form
    const formData = {
        nik: $('[name="nik"]').val().trim(),
        nama: $('[name="nama"]').val().trim(),
        tgl_lahir: $('[name="tgl_lahir"]').val(),
        jk: $('[name="jk"]').val(),
        no_hp: $('[name="no_hp"]').val().trim(),
        rt: $('[name="rt"]').val().trim(),
        rw: $('[name="rw"]').val().trim(),
        nama_ibu: $('[name="nama_ibu"]').val().trim()
    };

    // 3. Cek Mode (Tambah atau Edit?)
    const editId = $('#editPasienId').val();
    const isEditMode = editId !== "" && editId !== null && editId !== undefined;

    // Tentukan Action dan Payload berdasarkan mode
    const action = isEditMode ? 'updatePasien' : 'savePasien';
    const payload = isEditMode ? { id: editId, data: formData } : { data: formData };

    // 4. Tampilkan Loading di Tombol
    const btn = $(this);
    const originalText = btn.html();
    btn.prop('disabled', true).html('<i class="fas fa-spinner fa-spin me-2"></i>Memproses...');

    try {
        // 5. Panggil API
        const response = await callApi(action, payload);

        if (response.status === 'success') {
            // Tutup Modal
            const modalEl = document.getElementById('modalPasien');
            const modal = bootstrap.Modal.getInstance(modalEl);
            if (modal) {
                modal.hide();
            } else {
                 // Fallback jika instance tidak terdeteksi
                $(modalEl).modal('hide');
                $('.modal-backdrop').remove();
            }

            // Tampilkan Pesan Sukses Berbeda Tergantung Mode
            if (isEditMode) {
                // Mode Edit: Cukup notifikasi sukses sederhana
                Swal.fire({
                    icon: 'success',
                    title: 'Berhasil',
                    text: 'Data pasien berhasil diperbarui.',
                    timer: 1500,
                    showConfirmButton: false
                });
            } else {
                // Mode Simpan Baru: Tawarkan pendaftaran langsung
                Swal.fire({
                    title: 'Berhasil Disimpan!',
                    text: 'Apakah ingin mendaftarkan pasien ini ke pelayanan hari ini?',
                    icon: 'success',
                    showCancelButton: true,
                    confirmButtonText: 'Ya, Daftarkan',
                    cancelButtonText: 'Nanti Saja',
                    reverseButtons: true
                }).then((result) => {
                    if (result.isConfirmed) {
                        // TODO: Arahkan ke modul pendaftaran (Fase berikutnya)
                        Swal.fire('Info', 'Fitur Pendaftaran akan segera hadir. ID Pasien: ' + response.data.id, 'info');
                    }
                });
            }

            // Refresh tabel data (jika sedang di halaman pasien)
            // Kita trigger klik tombol cari yang sudah ada untuk memuat ulang data terbaru
            if ($('#btnSearch').length) {
                $('#btnSearch').click();
            }

        } else {
            // Jika Backend mengembalikan status 'error'
            Swal.fire('Gagal', response.message, 'error');
        }

    } catch (error) {
        // Error jaringan atau error tak terduga lainnya
        console.error('Error submit pasien:', error);
        Swal.fire('Error', 'Gagal menghubungi server.', 'error');
    } finally {
        // 6. Kembalikan Tombol ke Semula
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

    // Muat halaman default (Welcome)
    loadPage('welcome', 'Beranda');
}

function updateUserUI(user) {
    $("#user-fullname").text(user.namaLengkap);
    $("#user-posyandu-info").text("Unit: " + user.posyanduId);
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

    // Tampilkan loading di area konten
    $("#app-content").html(`
        <div class="d-flex justify-content-center align-items-center" style="height: 60vh;">
            <div class="spinner-border text-primary" style="width: 3rem; height: 3rem;" role="status">
                <span class="visually-hidden">Loading...</span>
            </div>
        </div>
    `);

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
             console.log(`Memanggil fungsi: ${initFunctionName}`);
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

    // 1. Event Listener: Tombol Cari
    $('#btnSearch').on('click', function() {
        currentKeyword = $('#searchInput').val().trim();
        currentPage = 1; // Reset ke halaman 1 setiap cari baru
        loadPasienData(currentKeyword, currentPage);
    });

    // 2. Event Listener: Enter di Input Cari
    $('#searchInput').on('keypress', function(e) {
        if (e.which === 13) { // Tombol Enter
            $('#btnSearch').click();
        }
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
            const row = `
                <tr>
                    <td class="ps-4 fw-bold">${p.nama}</td>
                    <td><span class="badge bg-light text-dark border">${p.nik}</span></td>
                    <td>${p.jk}</td>
                    <td>${p.umur} Thn</td>
                    <td>${p.alamat}</td>
                    <td class="text-end pe-4">
                        <button class="btn btn-sm btn-outline-primary me-1" onclick="editPasien('${p.id}')" title="Edit">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn btn-sm btn-outline-danger" onclick="hapusPasien('${p.id}', '${p.nama}')" title="Hapus">
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