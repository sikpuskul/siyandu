// assets/js/api.js

// URL Backend Apps Script Anda (Pastikan ini URL Deployment terbaru)
const API_URL = "https://script.google.com/macros/s/AKfycbwDu_d4I6IpTVOP3eAOmrih2mpg3DGOmDtBQ7ODjK29LOZkwjA1GkhdmpMvyyCSQe2S0w/exec";

/**
 * Fungsi Generik untuk Memanggil API
 * Otomatis menyertakan token sesi jika ada.
 * @param {string} action - Nama aksi (misal: 'searchPasien')
 * @param {object} payload - Data tambahan (misal: {keyword: 'feri', page: 1})
 */
async function callApi(action, payload = {}) {
    // 1. Ambil TOKEN dari Local Storage
    const token = localStorage.getItem('sessionToken');

    // 2. Siapkan paket data yang akan dikirim
    const dataToSend = {
        action: action,
        token: token, // <-- PENTING: Token selalu disertakan di sini
        ...payload    // Menggabungkan data tambahan ke objek utama
    };

    console.log(`[API REQ] ${action}:`, dataToSend);

    try {
        const response = await fetch(API_URL, {
            method: "POST",
            // Menggunakan text/plain agar tidak terkena preflight CORS
            headers: { "Content-Type": "text/plain;charset=utf-8" },
            body: JSON.stringify(dataToSend)
        });

        if (!response.ok) {
            throw new Error(`HTTP Error! Status: ${response.status}`);
        }

        const result = await response.json();
        console.log(`[API RES] ${action}:`, result);

        // 3. Cek Global: Jika token ditolak backend (kadaluarsa/tidak valid)
        if (result.status === 'error' && result.message && result.message.includes('Sesi')) {
             // Opsional: Auto-logout jika sesi backend sudah hangus tapi frontend masih nyangkut
             // Swal.fire('Sesi Berakhir', 'Silakan login ulang.', 'warning').then(() => {
             //    localStorage.clear();
             //    window.location.href = 'login.html';
             // });
        }

        return result;

    } catch (error) {
        console.error(`[API ERR] ${action}:`, error);
        return { 
            status: 'error', 
            message: 'Gagal terhubung ke server. Periksa koneksi internet Anda.',
            error: error.toString()
        };
    }
}