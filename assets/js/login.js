// --- 0. Cek Apakah Sudah Login? (Redirect jika ya) ---
(function checkAlreadyLoggedIn() {
    const token = localStorage.getItem('sessionToken');
    const userStr = localStorage.getItem('sessionUser');
    const loginTime = localStorage.getItem('loginTime');

    // Jika semua data sesi ada
    if (token && userStr && loginTime) {
        // Cek apakah sesi masih valid (belum expired 60 menit)
        const now = new Date().getTime();
        const sixtyMinutes = 60 * 60 * 1000; // 60 menit dalam milidetik

        if (now - parseInt(loginTime) < sixtyMinutes) {
            // Sesi masih valid, redirect ke index
            window.location.replace('index.html'); // Gunakan .replace agar tidak bisa di-back
            return;
        } else {
            // Sesi sudah expired, bersihkan sekalian agar bersih
            localStorage.clear();
        }
    }
})();

$(document).ready(function() {
    // --- 1. Inisialisasi UI ---
    
    // Inisialisasi Select2 agar dropdown lebih bagus dan bisa di-search
    $('.select2').select2({
        theme: 'bootstrap-5',
        width: '100%'
    });

    // Toggle Show/Hide Password
    $('#togglePassword').on('click', function() {
        const passwordInput = $('#password');
        const icon = $(this).find('i');
        if (passwordInput.attr('type') === 'password') {
            passwordInput.attr('type', 'text');
            icon.removeClass('fa-eye').addClass('fa-eye-slash');
        } else {
            passwordInput.attr('type', 'password');
            icon.removeClass('fa-eye-slash').addClass('fa-eye');
        }
    });

    // --- 2. Memuat Data Wilayah ---

    // Load Daftar Desa saat halaman dibuka
    loadDesa();

    async function loadDesa() {
        try {
            // Panggil API getDaftarDesa
            const response = await callApi('getDaftarDesa');
            
            if (response.status === 'success') {
                const desaSelect = $('#desa');
                // Isi dropdown desa
                response.data.forEach(desa => {
                    desaSelect.append(new Option(desa, desa));
                });
            } else {
                Swal.fire('Error', 'Gagal memuat data desa.', 'error');
            }
        } catch (error) {
            Swal.fire('Connection Error', 'Gagal terhubung ke server.', 'error');
        }
    }

    // Saat Desa dipilih, load Posyandu
    $('#desa').on('change', async function() {
        const selectedDesa = $(this).val();
        const posyanduSelect = $('#posyandu');

        // Reset dan disable dropdown posyandu dulu
        posyanduSelect.empty().append(new Option('Pilih Posyandu...', '')).prop('disabled', true);

        if (selectedDesa) {
            try {
                // Tampilkan loading di dropdown posyandu
                posyanduSelect.append(new Option('Memuat...', '', false, false)).trigger('change');
                
                // Panggil API getPosyanduByDesa
                const response = await callApi('getPosyanduByDesa', { desa: selectedDesa });

                // Hapus loading
                posyanduSelect.empty().append(new Option('Pilih Posyandu...', ''));

                if (response.status === 'success') {
                    // Isi dropdown posyandu
                    response.data.forEach(pos => {
                        posyanduSelect.append(new Option(pos.nama, pos.id));
                    });
                    posyanduSelect.prop('disabled', false); // Aktifkan dropdown
                }
            } catch (error) {
                Swal.fire('Error', 'Gagal memuat data posyandu.', 'error');
            }
        }
    });

    // --- 3. Proses Login ---

    $('#loginForm').on('submit', async function(e) {
        e.preventDefault();

        // Ambil data dari form
        const posyanduId = $('#posyandu').val();
        const username = $('#username').val().trim();
        const password = $('#password').val();

        // Validasi sederhana
        if (!posyanduId) {
            Swal.fire('Peringatan', 'Silakan pilih Posyandu terlebih dahulu.', 'warning');
            return;
        }

        // Tampilkan loading state
        const btnLogin = $('#btnLogin');
        const originalText = btnLogin.html();
        btnLogin.prop('disabled', true).html('<i class="fas fa-spinner fa-spin me-2"></i>Memproses...');

        try {
            // Panggil API Login
            const response = await callApi('login', {
                username: username,
                password: password,
                posyanduId: posyanduId
            });

            if (response.status === 'success') {
                // LOGIN SUKSES!
                
                // 1. Simpan Token dan Info User ke LocalStorage
                localStorage.setItem('sessionToken', response.data.token);
                localStorage.setItem('sessionUser', JSON.stringify(response.data.user));
                // Simpan timestamp login untuk fitur auto-logout nanti
                localStorage.setItem('loginTime', new Date().getTime()); 

                // 2. Tampilkan pesan sukses sejenak
                Swal.fire({
                    icon: 'success',
                    title: 'Login Berhasil!',
                    text: 'Selamat datang, ' + response.data.user.namaLengkap,
                    timer: 1500,
                    showConfirmButton: false
                }).then(() => {
                    // 3. Redirect ke halaman utama
                    window.location.href = 'index.html';
                });

            } else {
                // Login Gagal (Password salah, dll)
                Swal.fire('Login Gagal', response.message, 'error');
            }

        } catch (error) {
            Swal.fire('Error', 'Terjadi kesalahan jaringan.', 'error');
        } finally {
            // Kembalikan tombol ke keadaan semula
            btnLogin.prop('disabled', false).html(originalText);
        }
    });
});