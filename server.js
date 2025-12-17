const express = require('express');
const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.set('view engine', 'ejs');
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public')); 

// Setup Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function analyzeFloodRisk(location) {
    // FIX: Gunakan 'gemini-flash-latest' agar otomatis dapat versi Flash yang GRATIS & STABIL
    const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });

    const prompt = `
    Bertindaklah sebagai ahli hidrologi. Lakukan analisis risiko banjir untuk wilayah "${location}, Indonesia".
    
    PENTING: Jawab HANYA dengan format JSON valid. Jangan ada teks lain sebelum atau sesudah JSON.
    
    Format JSON Wajib:
    {
      "location": "${location}",
      "riskLevel": "AMAN" | "WASPADA" | "BAHAYA",
      "probability": 75,
      "description": "Narasi singkat kondisi cuaca dan risiko.",
      "factors": { "rainfall": "Analisis hujan", "drainage": "Kondisi sungai", "history": "Riwayat banjir" },
      "recommendation": "Saran keselamatan.",
      "sensorData": [
        { "timestamp": "T-5", "rainfall_mm": 10, "water_level_cm": 50 },
        { "timestamp": "T-4", "rainfall_mm": 20, "water_level_cm": 60 },
        { "timestamp": "T-3", "rainfall_mm": 15, "water_level_cm": 55 },
        { "timestamp": "T-2", "rainfall_mm": 40, "water_level_cm": 80 },
        { "timestamp": "T-1", "rainfall_mm": 30, "water_level_cm": 70 },
        { "timestamp": "Sekarang", "rainfall_mm": 10, "water_level_cm": 65 }
      ],
      "forecasts": [
        { "period": "1 Hari", "riskLevel": "WASPADA", "probability": 60, "reasoning": "Hujan lokal." },
        { "period": "3 Hari", "riskLevel": "AMAN", "probability": 30, "reasoning": "Cuaca cerah." },
        { "period": "1 Tahun", "riskLevel": "BAHAYA", "probability": 80, "reasoning": "Musim hujan tahunan." }
      ]
    }
    `;

    try {
        const result = await model.generateContent(prompt);
        const response = await result.response;
        let text = response.text();

        text = text.replace(/```json/g, '').replace(/```/g, '').trim();
        
        const jsonStart = text.indexOf('{');
        const jsonEnd = text.lastIndexOf('}') + 1;
        
        if (jsonStart === -1) throw new Error("AI tidak mengembalikan JSON valid");
        
        const jsonString = text.substring(jsonStart, jsonEnd);
        const data = JSON.parse(jsonString);
        
        data.sources = []; 

        return data;
    } catch (error) {
        console.error("Error AI:", error);
        throw error;
    }
}

app.get('/', (req, res) => {
    res.render('index', { data: null, error: null, location: '' });
});

app.post('/analyze', async (req, res) => {
    const location = req.body.location;
    try {
        const data = await analyzeFloodRisk(location);
        res.render('index', { data: data, error: null, location: location });
    } catch (error) {
        // Tampilkan pesan error yang lebih ramah di UI
        let errorMsg = "Gagal menganalisis. Coba lagi nanti.";
        if (error.status === 429) errorMsg = "Terlalu banyak request. Tunggu sebentar lagi.";
        
        res.render('index', { 
            data: null, 
            error: errorMsg, 
            location: location 
        });
    }
});

app.listen(port, () => {
    console.log(`Server berjalan di http://localhost:${port}`);
});