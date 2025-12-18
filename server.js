const express = require('express');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const axios = require('axios');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

app.set('view engine', 'ejs');
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public')); 

// Setup Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// --- HELPER: Format Waktu ---
function formatTime(isoString) {
    const date = new Date(isoString);
    return date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
}

// --- FUNGSI 1: Cari Koordinat ---
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
            admin1: response.data.results[0].admin1
        };
    } catch (error) {
        console.error("Geocoding Error:", error.message);
        throw error;
    }
}

// --- FUNGSI 2: Ambil Data Cuaca Detail (Per Jam) ---
async function getRealWeatherData(lat, lon) {
    try {
        // Minta data hourly untuk 1 hari terakhir agar kita bisa ambil 6 jam ke belakang
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=precipitation,cloud_cover&hourly=precipitation,soil_moisture_0_to_1cm&daily=precipitation_sum,precipitation_probability_max&timezone=auto&past_days=1&forecast_days=1`;
        
        const response = await axios.get(url);
        return response.data;
    } catch (error) {
        console.error("Weather API Error:", error.message);
        throw new Error("Gagal mengambil data cuaca real-time.");
    }
}

// --- FUNGSI 3: Analisis AI + Data Processing ---
async function analyzeFloodRisk(locationInput) {
    // 1. Dapatkan Data Mentah dari Open-Meteo
    const geo = await getCoordinates(locationInput);
    const weather = await getRealWeatherData(geo.lat, geo.lon);

    // 2. PROSES DATA GRAFIK (INI BAGIAN KRUSIAL AGAR TIDAK ASAL)
    // Kita cari indeks jam sekarang di array 'hourly'
    const now = new Date();
    // Format waktu Open-Meteo: "2023-12-18T14:00"
    // Kita cari string jam yang paling mendekati jam sekarang
    const currentHourStr = now.toISOString().slice(0, 13); // Ambil sampai jam (YYYY-MM-DDTHH)
    
    // Cari index di mana waktunya mirip dengan jam sekarang
    // Karena timezone auto, kita cari manual berdasarkan jam lokal server/klien logic
    // Cara gampang: Ambil array dari belakang (karena past_days=1 + forecast=1)
    // Array hourly biasanya panjangnya 48 (24 jam kemarin + 24 jam hari ini)
    // Kita asumsikan "current" time di API adalah patokan.
    
    // LOGIKA MANUAL: Ambil 6 data terakhir yang BUKAN prediksi masa depan
    // Kita filter data yang waktunya <= waktu sekarang
    const validTimes = [];
    const validRain = [];
    
    const hourlyTimes = weather.hourly.time;
    const hourlyRain = weather.hourly.precipitation;
    
    // Cari index jam saat ini
    let currentIndex = 0;
    const currentIsoFull = weather.current.time; // Waktu server meteo saat ini
    
    // Loop untuk mencari posisi index jam sekarang
    for(let i=0; i < hourlyTimes.length; i++) {
        if (hourlyTimes[i] >= currentIsoFull) {
            currentIndex = i;
            break;
        }
    }
    
    // Jika tidak ketemu (misal jam 23:59), ambil index terakhir
    if (currentIndex === 0 && hourlyTimes.length > 0) currentIndex = hourlyTimes.length - 1;

    // Ambil 6 poin ke belakang (T-5, T-4, T-3, T-2, T-1, Sekarang)
    const chartData = [];
    for (let i = 5; i >= 0; i--) {
        const idx = currentIndex - i;
        if (idx >= 0) {
            chartData.push({
                timestamp: formatTime(hourlyTimes[idx]), // Jam:Misal 14:00
                rainfall_mm: hourlyRain[idx], // INI ANGKA ASLI
                water_level_cm: 0 // Nanti diisi logika estimasi
            });
        }
    }

    // Hitung rata-rata hujan 6 jam terakhir untuk estimasi tinggi air
    const totalRain6h = chartData.reduce((sum, item) => sum + item.rainfall_mm, 0);
    
    // LOGIKA ESTIMASI TINGGI AIR (Karena tidak ada sensor IoT)
    // Kita buat simulasi: Base level 50cm. Setiap 1mm hujan menambah 2cm air (misal).
    chartData.forEach(d => {
        let baseLevel = 50; 
        if (totalRain6h > 10) baseLevel = 100; // Jika hujan deras, air naik
        if (totalRain6h > 50) baseLevel = 200; // Banjir
        
        // Variasi sedikit agar grafik air tidak datar
        d.water_level_cm = baseLevel + (d.rainfall_mm * 5); 
    });

    // 3. Masukkan ke AI (Hanya untuk analisis teks, bukan grafik)
    const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });

    const prompt = `
    Lokasi: ${geo.name}, ${geo.admin1}.
    Data 6 Jam Terakhir (FAKTA):
    ${chartData.map(d => `- Jam ${d.timestamp}: Hujan ${d.rainfall_mm}mm`).join('\n')}
    
    Kondisi Langit Sekarang: ${weather.current.cloud_cover}% Berawan.
    Total Hujan Hari Ini: ${weather.daily.precipitation_sum[1]}mm.
    
    Tugas:
    Analisis risiko banjir berdasarkan data di atas.
    Jika hujan 0mm dalam 6 jam terakhir, status AMAN.
    Jika hujan terus menerus atau ada lonjakan mm, status WASPADA/BAHAYA.
    
    Format JSON:
    {
      "location": "${geo.name}, ${geo.admin1}",
      "riskLevel": "AMAN" | "WASPADA" | "BAHAYA",
      "probability": number (0-100),
      "description": "Narasi kondisi cuaca real-time.",
      "factors": { "rainfall": "Ringkasan hujan...", "drainage": "...", "history": "..." },
      "recommendation": "...",
      "forecasts": [
        { "period": "Hari Ini", "riskLevel": "AUTO", "probability": ${weather.daily.precipitation_probability_max[1]}, "reasoning": "Data Open-Meteo" },
        { "period": "Besok", "riskLevel": "AUTO", "probability": 0, "reasoning": "Prediksi AI" },
        { "period": "Lusa", "riskLevel": "AUTO", "probability": 0, "reasoning": "Prediksi AI" }
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
        const aiData = JSON.parse(text.substring(jsonStart, jsonEnd));
        
        // 4. OVERRIDE SENSOR DATA (PENTING!)
        // Kita buang data sensor karangan AI, ganti dengan data ASLI yang kita hitung di atas
        aiData.sensorData = chartData;
        aiData.sources = [{ web: { title: "Open-Meteo Hourly API", uri: "https://open-meteo.com/" } }];

        return aiData;
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
        let msg = "Gagal mengambil data.";
        if (error.response && error.response.status === 429) msg = "Terlalu banyak request (AI Quota). Tunggu sebentar.";
        res.render('index', { data: null, error: msg, location: location });
    }
});

app.listen(port, () => {
    console.log(`Server berjalan di http://localhost:${port}`);
});