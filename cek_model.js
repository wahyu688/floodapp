const { GoogleGenerativeAI } = require("@google/generative-ai");
require('dotenv').config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function checkAvailableModels() {
  try {
    // Kita coba panggil 'gemini-1.5-flash' yang paling standar
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    
    console.log("Sedang mencoba menghubungi Google AI...");
    const result = await model.generateContent("Tes koneksi. Jawab 'OK' jika berhasil.");
    const response = await result.response;
    console.log("✅ BERHASIL! Model 'gemini-1.5-flash' bisa digunakan.");
    console.log("Respon AI:", response.text());
  } catch (error) {
    console.log("❌ Gagal dengan gemini-1.5-flash.");
    console.error("Detail Error:", error.message);
    
    // Jika gagal, kita coba lihat list model (jika SDK mendukung)
    console.log("\n--- Saran ---");
    console.log("Pastikan kamu sudah menjalankan: npm install @google/generative-ai@latest");
  }
}

checkAvailableModels();