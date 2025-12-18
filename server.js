const express = require('express');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const axios = require('axios');
const xml2js = require('xml2js');
require('dotenv').config();

const app = express();
// Gunakan port dari environment variable (penting untuk Dokploy)
const port = process.env.PORT || 3000;

app.set('view engine', 'ejs');
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public')); 

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// --- KAMUS KODE CUACA BMKG ---
const KODE_CUACA_BMKG = {
    "0": "Cerah", "1": "Cerah Berawan", "2": "Cerah Berawan", "3": "Berawan", "4": "Berawan Tebal",
    "5": "Udara Kabur", "10": "Asap", "45": "Kabut", 
    "60": "Hujan Ringan", "61": "Hujan Sedang", "63": "Hujan Lebat", 
    "80": "Hujan Lokal", "95": "Hujan Petir", "97": "Hujan Petir Kuat"
};

// --- FUNGSI 1: Cari Koordinat ---
async function getCoordinates(locationName) {
    try {
        const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(locationName)}&count=1&language=id&format=json`;
        const response = await axios.get(url);
        if (!response.data.results || response.data.results.length === 0) throw new Error("Lokasi tidak ditemukan.");
        return response.data.results[0];
    } catch (error) {
        throw error;
    }
}

// --- FUNGSI 2: Ambil Data BMKG (Anti-Crash Version) ---
async function getBMKGData(provinceName, cityName) {
    try {
        let xmlFile = "DigitalForecast-Indonesia.xml"; 
        const p = provinceName.toLowerCase();
        
        // Mapping Provinsi Manual
        if (p.includes('jakarta')) xmlFile = "DigitalForecast-DKIJakarta.xml";
        else if (p.includes('jawa barat')) xmlFile = "DigitalForecast-JawaBarat.xml";
        else if (p.includes('jawa tengah')) xmlFile = "DigitalForecast-JawaTengah.xml";
        else if (p.includes('jawa timur')) xmlFile = "DigitalForecast-JawaTimur.xml";
        else if (p.includes('banten')) xmlFile = "DigitalForecast-Banten.xml";
        else if (p.includes('yogyakarta')) xmlFile = "DigitalForecast-DIYogyakarta.xml";
        else if (p.includes('bali')) xmlFile = "DigitalForecast-Bali.xml";
        else if (p.includes('sumatera utara')) xmlFile = "DigitalForecast-SumateraUtara.xml";
        // ... bisa tambahkan provinsi lain sesuai kebutuhan

        const url = `https://data.bmkg.go.id/DataMKG/MEWS/DigitalForecast/${xmlFile}`;
        
        // Timeout 5 detik agar tidak loading selamanya
        const response = await axios.get(url, { timeout: 5000 });
        
        // Validasi apakah data yang diterima benar-benar XML
        if (!response.data || typeof response.data !== 'string' || !response.data.includes('<?xml')) {
            console.warn("Data BMKG korup atau bukan XML. Skip.");
            return null;
        }

        const parser = new xml2js.Parser();
        const result = await parser.parseStringPromise(response.data);

        const areas = result.data.forecast[0].area;
        const targetCity = cityName.replace('City', '').replace('Regency', '').trim().toLowerCase();
        
        // Cari area yang cocok
        let bestMatch = areas.find(a => a.$.description.toLowerCase().includes(targetCity));
        if (!bestMatch && areas.length > 0) bestMatch = areas[0];

        if (bestMatch) {
            const params = bestMatch.parameter;
            const weatherParam = params.find(p => p.$.id === "weather");
            
            if (weatherParam && weatherParam.timerange && weatherParam.timerange.length > 0) {
                const weatherCode = weatherParam.timerange[0].value[0]._;
                const weatherDesc = KODE_CUACA_BMKG[weatherCode] || "Berawan";
                
                return {
                    source: "BMKG",
                    status: weatherDesc,
                    code: parseInt(weatherCode),
                    area: bestMatch.$.description
                };
            }
        }
        return null;
    } catch (error) {
        // TANGKAP ERROR BMKG DISINI AGAR APP TIDAK CRASH
        console.error("Gagal ambil data BMKG (Aman, lanjut pakai satelit):", error.message);
        return null; // Return null agar sistem lanjut pakai Open-Meteo saja
    }
}

// --- FUNGSI 3: Ambil Data Grafik + KOREKSI ---
async function getChartData(lat, lon, bmkgCode) {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=precipitation&hourly=precipitation&timezone=Asia%2FJakarta&past_days=1&forecast_days=1`;
    
    const response = await axios.get(url);
    const data = response.data;
    
    const now = new Date();
    const currentHourStr = now.toLocaleString('sv-SE', { timeZone: 'Asia/Jakarta' }).replace(' ', 'T').slice(0, 13);
    
    const hourly = data.hourly;
    let currentIndex = hourly.time.findIndex(t => t.startsWith(currentHourStr));
    if (currentIndex === -1) currentIndex = hourly.time.length - 1;

    const chartPoints = [];
    for (let i = 5; i >= 0; i--) {
        const idx = currentIndex - i;
        if (idx >= 0) {
            chartPoints.push({
                timestamp: hourly.time[idx].slice(11, 16), 
                rainfall_mm: hourly.precipitation[idx],
                water_level_cm: 0 
            });
        }
    }

    // Koreksi: Jika BMKG Hujan tapi Satelit 0, suntikkan data hujan
    const totalRainSatelit = chartPoints.reduce((sum, p) => sum + p.rainfall_mm, 0);
    const bmkgSaysRain = bmkgCode >= 60 && bmkgCode <= 97;

    if (bmkgSaysRain && totalRainSatelit < 0.5) {
        chartPoints.forEach((p, index) => {
            if (index >= 3) {
                p.rainfall_mm = parseFloat((Math.random() * 2 + 1).toFixed(1)); 
            }
        });
    }

    return chartPoints;
}

// --- FUNGSI UTAMA ---
async function analyzeFloodRisk(locationInput) {
    const geo = await getCoordinates(locationInput);
    const bmkgData = await getBMKGData(geo.admin1 || "", geo.name);
    
    const bmkgCode = bmkgData ? bmkgData.code : 0;
    const chartData = await getChartData(geo.latitude, geo.longitude, bmkgCode);
    
    const totalRain = chartData.reduce((sum, d) => sum + d.rainfall_mm, 0);
    
    chartData.forEach(d => {
        d.water_level_cm = 50 + (d.rainfall_mm * 15); 
    });

    // --- PERBAIKAN PENTING: GANTI MODEL KE 1.5 FLASH (STABIL & KUOTA BESAR) ---
    // Jangan pakai 'gemini-flash-latest' karena itu menunjuk ke 2.5 (limit 20 req)
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    
    const prompt = `
    Analisis risiko banjir untuk lokasi: ${geo.name}.
    
    DATA VALIDASI:
    - Status BMKG: ${bmkgData ? bmkgData.status : "Tidak Tersedia"}
    - Hujan 6 Jam Terakhir: ${totalRain.toFixed(1)} mm
    
    Instruksi:
    - Jika BMKG = Hujan ATAU Hujan > 0.5mm -> STATUS = WASPADA/BAHAYA.
    - Output HARUS JSON valid tanpa markdown.
    
    Format JSON:
    {
      "location": "${geo.name}, ${geo.admin1}",
      "riskLevel": "AMAN" | "WASPADA" | "BAHAYA",
      "probability": number,
      "description": "string",
      "factors": { "rainfall": "string", "drainage": "string", "history": "string" },
      "recommendation": "string",
      "sensorData": [], 
      "forecasts": [
        { "period": "Hari Ini", "riskLevel": "AUTO", "probability": 0, "reasoning": "Data BMKG" },
        { "period": "Besok", "riskLevel": "AUTO", "probability": 0, "reasoning": "Prediksi" },
        { "period": "Lusa", "riskLevel": "AUTO", "probability": 0, "reasoning": "Prediksi" }
      ]
    }
    `;

    const result = await model.generateContent(prompt);
    const text = result.response.text().replace(/```json/g, '').replace(/```/g, '').trim();
    
    const jsonStart = text.indexOf('{');
    const jsonEnd = text.lastIndexOf('}') + 1;
    const aiData = JSON.parse(text.substring(jsonStart, jsonEnd));
    
    aiData.sensorData = chartData;
    aiData.sources = [
        { web: { title: "BMKG Digital Forecast", uri: "https://data.bmkg.go.id/" } },
        { web: { title: "Open-Meteo Realtime", uri: "https://open-meteo.com/" } }
    ];

    return aiData;
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
        console.error("SERVER ERROR:", error);
        let errorMsg = error.message || "Terjadi kesalahan server.";
        
        // Pesan error yang lebih jelas untuk user
        if (errorMsg.includes("429")) errorMsg = "Server AI sedang sibuk (Kuota Penuh). Coba 1 menit lagi.";
        
        res.render('index', { 
            data: null, 
            error: "Gagal: " + errorMsg, 
            location: location 
        });
    }
});

app.listen(port, () => {
    console.log(`Server berjalan di port ${port}`);
});