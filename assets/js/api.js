// assets/js/api.js

// URL Backend Apps Script Anda
const API_URL = "https://script.google.com/macros/s/AKfycbwDu_d4I6IpTVOP3eAOmrih2mpg3DGOmDtBQ7ODjK29LOZkwjA1GkhdmpMvyyCSQe2S0w/exec";

async function callApi(action, payload = {}) {
    const token = localStorage.getItem('sessionToken');
    const dataToSend = {
        action: action,
        token: token,
        ...payload
    };

    //console.log(`[API REQ] ${action}:`, dataToSend);

    try {
        const response = await fetch(API_URL, {
            method: "POST",
            headers: { "Content-Type": "text/plain;charset=utf-8" },
            body: JSON.stringify(dataToSend)
        });

        if (!response.ok) {
            throw new Error(`HTTP Error! Status: ${response.status} ${response.statusText}`);
        }

        // --- DEBUGGING TAMBAHAN ---
        const textResult = await response.text(); // Ambil respons sebagai teks dulu
        // console.log(`[API RAW RES]`, textResult); // Uncomment jika ingin lihat mentahannya

        try {
            // Coba ubah teks tadi ke JSON
            const jsonResult = JSON.parse(textResult);
            //console.log(`[API RES] ${action}:`, jsonResult);
            return jsonResult;
        } catch (e) {
            // JIKA GAGAL PARSE JSON, BERARTI SERVER KIRIM HTML ERROR
            console.error("[API FATAL ERROR] Server mengirim bukan JSON:\n", textResult);
            throw new Error("Terjadi kesalahan fatal di server (Cek Konsol untuk detail).");
        }

    } catch (error) {
        console.error(`[API ERR] ${action}:`, error);
        return { 
            status: 'error', 
            message: error.message || 'Gagal terhubung ke server.'
        };
    }
}