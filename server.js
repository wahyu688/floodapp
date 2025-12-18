const express = require('express');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const axios = require('axios'); // Library untuk request ke Open-Meteo
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

app.set('view engine', 'ejs');
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public')); 

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// --- FUNGSI 1: Cari Koordinat dari Nama Kota (Geocoding) ---
async function getCoordinates(locationName) {
    try {
        const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(locationName)}&count=1&language=id&format=json`;
        const response = await axios.get(url);
        
        if (!response.data.results || response.data.results.length === 0) {
            throw new Error("Lokasi tidak ditemukan di peta.");
        }
        
        return {
            lat: response.data.results[0].latitude,
            lon: response.data.results[0].longitude,
            name: response.data.results[0].name,
            admin1: response.data.results[0].admin1 // Provinsi/Wilayah
        };
    } catch (error) {
        console.error("Geocoding Error:", error.message);
        throw error;
    }
}

// --- FUNGSI 2: Ambil Data Cuaca Real-time (Open-Meteo) ---
async function getRealWeatherData(lat, lon) {
    try {
        // Mengambil data curah hujan (precipitation), hujan (rain), dan tutupan awan
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=precipitation,rain,cloud_cover&hourly=precipitation_probability,rain&daily=precipitation_sum,precipitation_probability_max&timezone=auto&past_days=1`;
        
        const response = await axios.get(url);
        return response.data;
    } catch (error) {
        console.error("Weather API Error:", error.message);
        throw new Error("Gagal mengambil data cuaca real-time.");
    }
}

// --- FUNGSI 3: Analisis AI berdasarkan Data Fakta ---
async function analyzeFloodRisk(locationInput) {
    // 1. Dapatkan Data Fakta dulu
    const geo = await getCoordinates(locationInput);
    const weather = await getRealWeatherData(geo.lat, geo.lon);

    // Siapkan data fakta untuk disuapi ke AI
    const factData = {
        location: `${geo.name}, ${geo.admin1 || ''}`,
        current_rain_mm: weather.current.precipitation, // Hujan saat ini
        cloud_cover: weather.current.cloud_cover, // Berawan %
        rain_today_mm: weather.daily.precipitation_sum[1], // Total hujan hari ini (estimasi)
        rain_yesterday_mm: weather.daily.precipitation_sum[0], // Hujan kemarin (penting untuk saturasi tanah)
        rain_prob_max: weather.daily.precipitation_probability_max[1] // Peluang hujan tertinggi hari ini
    };

    console.log("Data Fakta Open-Meteo:", factData); // Debugging di terminal

    const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });

    const prompt = `
    Bertindaklah sebagai ahli hidrologi. Saya memberikan DATA CUACA ASLI & FAKTUAL dari sensor Open-Meteo untuk wilayah "${factData.location}".
    
    DATA FAKTA (JANGAN DIUBAH, GUNAKAN INI UNTUK ANALISIS):
    - Curah Hujan SAAT INI (Realtime): ${factData.current_rain_mm} mm
    - Total Hujan KEMARIN: ${factData.rain_yesterday_mm} mm (Jika tinggi, tanah mungkin jenuh air)
    - Estimasi Total Hujan HARI INI: ${factData.rain_today_mm} mm
    - Persentase Tutupan Awan: ${factData.cloud_cover}%
    
    Tugas:
    Analisis risiko banjir berdasarkan angka-angka di atas. 
    Jika curah hujan saat ini 0 mm dan kemarin rendah, maka risiko kemungkinan AMAN.
    Jika curah hujan tinggi (>20mm) atau kemarin hujan deras, risiko naik.
    
    Format JSON Wajib:
    {
      "location": "${factData.location}",
      "riskLevel": "AMAN" | "WASPADA" | "BAHAYA",
      "probability": number (0-100),
      "description": "Jelaskan kondisi berdasarkan data curah hujan di atas.",
      "factors": { 
          "rainfall": "Sebutkan data mm hujan dari data di atas", 
          "drainage": "Asumsi kondisi drainase umum kota tersebut", 
          "history": "Analisis singkat topografi wilayah ini" 
      },
      "recommendation": "Saran spesifik.",
      "sensorData": [
        { "timestamp": "Kemarin", "rainfall_mm": ${factData.rain_yesterday_mm}, "water_level_cm": 0 },
        { "timestamp": "Hari Ini (Total)", "rainfall_mm": ${factData.rain_today_mm}, "water_level_cm": 0 },
        { "timestamp": "Saat Ini", "rainfall_mm": ${factData.current_rain_mm}, "water_level_cm": 0 }
      ],
      "forecasts": [
        { "period": "Hari Ini", "riskLevel": "AUTO", "probability": ${factData.rain_prob_max}, "reasoning": "Berdasarkan probabilitas hujan Open-Meteo." },
        { "period": "3 Hari", "riskLevel": "AUTO", "probability": 0, "reasoning": "Prediksi AI." },
        { "period": "Musiman", "riskLevel": "AUTO", "probability": 0, "reasoning": "Tren tahunan." }
      ]
    }
    
    Catatan: Karena tidak ada sensor sungai IoT fisik, isi 'water_level_cm' dengan estimasi logis:
    - Jika hujan 0mm, water_level_cm rendah (misal 50-100).
    - Jika hujan deras, water_level_cm naik (misal 150-300).
    `;

    try {
        const result = await model.generateContent(prompt);
        const response = await result.response;
        let text = response.text();

        text = text.replace(/```json/g, '').replace(/```/g, '').trim();
        const jsonStart = text.indexOf('{');
        const jsonEnd = text.lastIndexOf('}') + 1;
        
        if (jsonStart === -1) throw new Error("Format JSON AI rusak");
        
        const data = JSON.parse(text.substring(jsonStart, jsonEnd));
        data.sources = [{ web: { title: "Open-Meteo Realtime API", uri: "https://open-meteo.com/" } }];

        return data;
    } catch (error) {
        console.error("Error AI Processing:", error);
        throw error;
    }
}

// Routes
app.get('/', (req, res) => {
    res.render('index', { data: null, error: null, location: '' });
});

app.post('/analyze', async (req, res) => {
    const location = req.body.location;
    try {
        const data = await analyzeFloodRisk(location);
        res.render('index', { data: data, error: null, location: location });
    } catch (error) {
        console.error(error);
        let msg = "Gagal mengambil data. Pastikan nama kota benar.";
        if (error.response && error.response.status === 429) msg = "Terlalu banyak request ke AI. Tunggu sebentar.";
        
        res.render('index', { 
            data: null, 
            error: msg, 
            location: location 
        });
    }
});

app.listen(port, () => {
    console.log(`Server berjalan di http://localhost:${port}`);
});