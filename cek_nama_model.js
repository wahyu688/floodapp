require('dotenv').config();

async function cekModel() {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
        console.log("❌ API KEY TIDAK DITEMUKAN DI .env");
        return;
    }

    console.log("sedang menghubungi Google untuk meminta daftar model...");
    
    // Kita tembak langsung ke endpoint API Google
    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`);
        const data = await response.json();

        if (data.error) {
            console.error("❌ Error dari Google:", data.error.message);
        } else if (data.models) {
            console.log("\n✅ BERHASIL! INI DAFTAR MODEL YANG BISA KAMU PAKAI:");
            console.log("==================================================");
            data.models.forEach(m => {
                // Kita hanya cari model yang support 'generateContent'
                if (m.supportedGenerationMethods && m.supportedGenerationMethods.includes("generateContent")) {
                    console.log(`👉 ${m.name}`); // Contoh output: models/gemini-1.5-flash-001
                }
            });
            console.log("==================================================");
            console.log("Tips: Salin salah satu nama di atas (tanpa 'models/') ke server.js");
        } else {
            console.log("⚠️ Tidak ada model yang ditemukan. Cek kuota atau billing.");
        }
    } catch (e) {
        console.error("❌ Gagal koneksi:", e.message);
    }
}

cekModel();