const express = require('express');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const axios = require('axios');
const xml2js = require('xml2js'); // Library baru untuk baca data BMKG
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

app.set('view engine', 'ejs');
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public')); 

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// --- LIST KODE CUACA BMKG (Untuk Mapping) ---
const KODE_CUACA_BMKG = {
    "0": "Cerah", "1": "Cerah Berawan", "2": "Cerah Berawan", "3": "Berawan", "4": "Berawan Tebal",
    "5": "Udara Kabur", "10": "Asap", "45": "Kabut", "60": "Hujan Ringan", "61": "Hujan Sedang",
    "63": "Hujan Lebat", "80": "Hujan Petir", "95": "Hujan Petir", "97": "Hujan Petir"
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

// --- FUNGSI 2: Ambil Data BMKG (Resmi Indonesia) ---
async function getBMKGData(provinceName, cityName) {
    try {
        // Mapping nama provinsi dari OpenMeteo ke Filename BMKG (Sederhana)
        // Kita default ke DKI Jakarta jika inputnya sekitar Jakarta, atau coba cari file provinsinya
        let xmlFile = "DigitalForecast-Indonesia.xml"; // Default Nasional
        
        // Logika sederhana mendeteksi provinsi (Bisa dikembangkan lagi)
        const p = provinceName.toLowerCase();
        if (p.includes('jakarta')) xmlFile = "DigitalForecast-DKIJakarta.xml";
        else if (p.includes('jawa barat')) xmlFile = "DigitalForecast-JawaBarat.xml";
        else if (p.includes('jawa tengah')) xmlFile = "DigitalForecast-JawaTengah.xml";
        else if (p.includes('jawa timur')) xmlFile = "DigitalForecast-JawaTimur.xml";
        else if (p.includes('banten')) xmlFile = "DigitalForecast-Banten.xml";
        else if (p.includes('bali')) xmlFile = "DigitalForecast-Bali.xml";
        else if (p.includes('yogyakarta')) xmlFile = "DigitalForecast-DIYogyakarta.xml";
        
        const url = `https://data.bmkg.go.id/DataMKG/MEWS/DigitalForecast/${xmlFile}`;
        console.log(`Mengambil data BMKG dari: ${url}`);

        const response = await axios.get(url);
        const parser = new xml2js.Parser();
        const result = await parser.parseStringPromise(response.data);

        // Cari kota yang cocok di dalam XML BMKG
        const areas = result.data.forecast[0].area;
        let bestMatch = null;
        
        // Cari area yang namanya mirip dengan input user
        // BMKG pakai format "Jakarta Timur", "Bandung", dll.
        const targetCity = cityName.replace('City', '').replace('Regency', '').trim().toLowerCase();
        
        for (const area of areas) {
            const areaName = area.$.description.toLowerCase();
            // Cek kemiripan nama
            if (areaName.includes(targetCity) || targetCity.includes(areaName)) {
                bestMatch = area;
                break;
            }
        }

        // Jika tidak ketemu kota spesifik, ambil data pertama (biasanya ibukota provinsi)
        if (!bestMatch && areas.length > 0) bestMatch = areas[0];

        if (bestMatch) {
            // Ambil parameter cuaca (id="weather")
            const params = bestMatch.parameter;
            const weatherParam = params.find(p => p.$.id === "weather");
            
            // Ambil cuaca jam ini (BMKG update per 6 jam, kita ambil yang terdekat)
            // Ini simplifikasi, mengambil status cuaca slot pertama (hari ini)
            const weatherCode = weatherParam.timerange[0].value[0]._;
            const weatherDesc = KODE_CUACA_BMKG[weatherCode] || "Tidak Diketahui";
            
            return {
                source: "BMKG (Badan Meteorologi, Klimatologi, dan Geofisika)",
                status: weatherDesc,
                code: weatherCode,
                area: bestMatch.$.description
            };
        }
        return null;

    } catch (error) {
        console.error("Gagal ambil data BMKG:", error.message);
        return null; // Fallback jika gagal
    }
}

// --- FUNGSI 3: Ambil Data Grafik (Open-Meteo dengan Timezone FIX) ---
async function getChartData(lat, lon) {
    // FIX PENTING: Tambahkan '&timezone=Asia%2FJakarta' agar grafik sesuai jam WIB
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=precipitation,rain,showers&hourly=precipitation&timezone=Asia%2FJakarta&past_days=1&forecast_days=1`;
    
    const response = await axios.get(url);
    const data = response.data;
    
    // Ambil waktu sekarang (WIB)
    const now = new Date();
    const currentHourStr = now.toLocaleString('sv-SE', { timeZone: 'Asia/Jakarta' }).replace(' ', 'T').slice(0, 13);
    
    const hourly = data.hourly;
    let currentIndex = hourly.time.findIndex(t => t.startsWith(currentHourStr));
    
    if (currentIndex === -1) currentIndex = hourly.time.length - 1;

    // Ambil 6 jam ke belakang
    const chartPoints = [];
    for (let i = 5; i >= 0; i--) {
        const idx = currentIndex - i;
        if (idx >= 0) {
            chartPoints.push({
                timestamp: hourly.time[idx].slice(11, 16), // Ambil jamnya saja "14:00"
                rainfall_mm: hourly.precipitation[idx],
                water_level_cm: 0 // Placeholder
            });
        }
    }
    return chartPoints;
}

// --- FUNGSI UTAMA: Analisis AI ---
async function analyzeFloodRisk(locationInput) {
    const geo = await getCoordinates(locationInput);
    
    // 1. Ambil Data BMKG (Status Resmi)
    const bmkgData = await getBMKGData(geo.admin1 || "", geo.name);
    
    // 2. Ambil Data Grafik (Angka Curah Hujan)
    const chartData = await getChartData(geo.latitude, geo.longitude);
    
    // Hitung total hujan 6 jam terakhir
    const totalRain = chartData.reduce((sum, d) => sum + d.rainfall_mm, 0);
    
    // Logika Estimasi Tinggi Air (Simulasi Fisika Sederhana)
    chartData.forEach(d => {
        // Base level sungai normal = 50cm
        // Setiap 1mm hujan menambah beban air. Akumulasi hujan mempengaruhi tinggi air.
        // Jika hujan > 5mm (deras), level naik drastis.
        let riskFactor = d.rainfall_mm * 10; 
        if (totalRain > 20) riskFactor *= 1.5; // Tanah jenuh
        d.water_level_cm = 50 + riskFactor; 
    });

    const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });
    
    // Prompt yang Menggabungkan BMKG & Data Sensor
    const prompt = `
    Anda adalah sistem AI peringatan dini banjir.
    
    SUMBER DATA UTAMA (RESMI):
    - Sumber: ${bmkgData ? bmkgData.source : "Satelit Meteo"}
    - Lokasi Terdeteksi: ${bmkgData ? bmkgData.area : geo.name}
    - STATUS CUACA RESMI SAAT INI: "${bmkgData ? bmkgData.status : "Tidak Tersedia"}"
    
    DATA SENSOR REAL-TIME (6 Jam Terakhir):
    ${chartData.map(d => `- Pukul ${d.timestamp}: Hujan ${d.rainfall_mm}mm`).join('\n')}
    
    Total Hujan 6 Jam: ${totalRain.toFixed(1)} mm.
    
    TUGAS:
    Analisis risiko banjir.
    1. Jika Status BMKG mengatakan "Hujan" ATAU Data Sensor menunjukkan angka > 0mm, maka hujan TERKONFIRMASI.
    2. Jika BMKG bilang "Hujan Petir/Lebat", naikkan status risiko ke WASPADA/BAHAYA.
    3. Abaikan jika data sensor 0mm TAPI BMKG bilang Hujan (mungkin sensor satelit delay, percaya BMKG).
    
    Format JSON:
    {
      "location": "${geo.name}, ${geo.admin1}",
      "riskLevel": "AMAN" | "WASPADA" | "BAHAYA",
      "probability": number (0-100),
      "description": "Sebutkan Status Cuaca BMKG dalam penjelasanmu. Contoh: 'Berdasarkan data BMKG, saat ini Hujan Ringan...'",
      "factors": { "rainfall": "Analisis mm hujan...", "drainage": "...", "history": "..." },
      "recommendation": "...",
      "forecasts": [
        { "period": "Hari Ini", "riskLevel": "AUTO", "probability": 0, "reasoning": "Sesuai Data BMKG" },
        { "period": "Besok", "riskLevel": "AUTO", "probability": 0, "reasoning": "Prediksi" },
        { "period": "Lusa", "riskLevel": "AUTO", "probability": 0, "reasoning": "Prediksi" }
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
        
        // Override data sensor dengan data chart yang sudah kita fix timezone-nya
        aiData.sensorData = chartData;
        
        // Masukkan Sumber Data ke Response
        aiData.sources = [
            { web: { title: "Data.BMKG.go.id (Official)", uri: "https://data.bmkg.go.id/" } },
            { web: { title: "Open-Meteo (Satellite)", uri: "https://open-meteo.com/" } }
        ];

        return aiData;
    } catch (error) {
        console.error("AI Error:", error);
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
        console.error(error);
        res.render('index', { 
            data: null, 
            error: "Gagal mengambil data BMKG/Meteo. Coba nama kota yang lebih spesifik.", 
            location: location 
        });
    }
});

app.listen(port, () => {
    console.log(`Server berjalan di http://localhost:${port}`);
});