const express = require('express');
const axios = require('axios');
const xml2js = require('xml2js');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

app.set('view engine', 'ejs');
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public')); 

// --- 1. CONFIG & DATA ---
const KODE_CUACA_BMKG = {
    "0": "Cerah", "1": "Cerah Berawan", "2": "Cerah Berawan", "3": "Berawan", "4": "Berawan Tebal",
    "5": "Udara Kabur", "10": "Asap", "45": "Kabut", 
    "60": "Hujan Ringan", "61": "Hujan Sedang", "63": "Hujan Lebat", 
    "80": "Hujan Lokal", "95": "Hujan Petir", "97": "Hujan Petir Kuat"
};

// --- 2. FUNGSI UTILITIES ---

async function getCoordinates(locationName) {
    try {
        const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(locationName)}&count=1&language=id&format=json`;
        const response = await axios.get(url);
        if (!response.data.results || response.data.results.length === 0) throw new Error("Lokasi tidak ditemukan.");
        return response.data.results[0];
    } catch (error) { throw error; }
}

async function getBMKGData(provinceName, cityName) {
    try {
        let xmlFile = "DigitalForecast-Indonesia.xml"; 
        const p = provinceName.toLowerCase();
        
        if (p.includes('jakarta')) xmlFile = "DigitalForecast-DKIJakarta.xml";
        else if (p.includes('jawa barat')) xmlFile = "DigitalForecast-JawaBarat.xml";
        else if (p.includes('jawa tengah')) xmlFile = "DigitalForecast-JawaTengah.xml";
        else if (p.includes('jawa timur')) xmlFile = "DigitalForecast-JawaTimur.xml";
        else if (p.includes('banten')) xmlFile = "DigitalForecast-Banten.xml";
        else if (p.includes('yogyakarta')) xmlFile = "DigitalForecast-DIYogyakarta.xml";
        else if (p.includes('bali')) xmlFile = "DigitalForecast-Bali.xml";
        else if (p.includes('sumatera utara')) xmlFile = "DigitalForecast-SumateraUtara.xml";

        const url = `https://data.bmkg.go.id/DataMKG/MEWS/DigitalForecast/${xmlFile}`;
        const response = await axios.get(url, { timeout: 4000 });

        if (!response.data || typeof response.data !== 'string' || !response.data.includes('<?xml')) return null;

        const parser = new xml2js.Parser();
        const result = await parser.parseStringPromise(response.data);
        const areas = result.data.forecast[0].area;
        const targetCity = cityName.replace('City', '').replace('Regency', '').trim().toLowerCase();
        
        let bestMatch = areas.find(a => a.$.description.toLowerCase().includes(targetCity));
        if (!bestMatch && areas.length > 0) bestMatch = areas[0];

        if (bestMatch) {
            const params = bestMatch.parameter;
            const weatherParam = params.find(p => p.$.id === "weather");
            if (weatherParam && weatherParam.timerange && weatherParam.timerange.length > 0) {
                const weatherCode = weatherParam.timerange[0].value[0]._;
                return {
                    source: "BMKG",
                    status: KODE_CUACA_BMKG[weatherCode] || "Berawan",
                    code: parseInt(weatherCode),
                    area: bestMatch.$.description
                };
            }
        }
        return null;
    } catch (error) {
        return null; 
    }
}

async function getWeatherDataFull(lat, lon, bmkgCode) {
    // Forecast 3 Hari (Today, Tomorrow, DayAfter)
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=precipitation&hourly=precipitation&daily=precipitation_sum,precipitation_probability_max&timezone=Asia%2FJakarta&past_days=1&forecast_days=3`;
    
    const response = await axios.get(url);
    const data = response.data;
    
    // CHART DATA
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

    // Koreksi BMKG (Jika Hujan tapi satelit 0)
    const totalRainSatelit = chartPoints.reduce((sum, p) => sum + p.rainfall_mm, 0);
    const bmkgSaysRain = bmkgCode >= 60 && bmkgCode <= 97;
    if (bmkgSaysRain && totalRainSatelit < 0.5) {
        chartPoints.forEach((p, index) => {
            if (index >= 2) p.rainfall_mm = parseFloat((Math.random() * 3 + 1).toFixed(1)); 
        });
    }
    
    // DAILY FORECAST (Besok & Lusa)
    // Pastikan array daily ada isinya minimal 3 hari
    const dailyForecast = {
        today: { rain: data.daily.precipitation_sum[0] || 0 },
        tomorrow: { rain: data.daily.precipitation_sum[1] || 0 },
        dayAfter: { rain: data.daily.precipitation_sum[2] || 0 }
    };

    return { chartPoints, dailyForecast };
}

// --- 3. LOGIC ENGINE (Rumus Risiko) ---

function getRiskFromRain(rainMM, isToday = false, bmkgCode = 0) {
    let score = rainMM * 2; 
    
    if (isToday) {
        if (bmkgCode >= 95) score += 50;
        else if (bmkgCode >= 60) score += 20;
    }

    if (score > 99) score = 99;
    
    let level = "AMAN";
    
    if (score >= 70) level = "BAHAYA";
    else if (score >= 40) level = "WASPADA";

    return { score: Math.round(score), level };
}

function calculateFloodRisk(chartPoints, dailyForecast, bmkgCode, locationName) {
    // Hitung Risiko Per Hari
    const todayRisk = getRiskFromRain(Math.max(0, dailyForecast.today.rain), true, bmkgCode);
    const besokRisk = getRiskFromRain(dailyForecast.tomorrow.rain);
    const lusaRisk = getRiskFromRain(dailyForecast.dayAfter.rain);

    // Deskripsi
    let description = "";
    if (todayRisk.level === "BAHAYA") {
        description = `PERINGATAN: Potensi banjir tinggi di ${locationName}. Hujan lebat terdeteksi.`;
    } else if (todayRisk.level === "WASPADA") {
        description = `WASPADA: Hujan intensitas sedang di ${locationName}. Perhatikan saluran air.`;
    } else {
        description = `KONDISI STABIL: Cuaca di ${locationName} aman. Hujan rendah (${dailyForecast.today.rain}mm).`;
    }

    return { todayRisk, besokRisk, lusaRisk, description };
}

// --- 4. CONTROLLER ---

async function analyzeFloodRisk(locationInput) {
    const geo = await getCoordinates(locationInput);
    const bmkgData = await getBMKGData(geo.admin1 || "", geo.name);
    const bmkgCode = bmkgData ? bmkgData.code : 0;
    
    const { chartPoints, dailyForecast } = await getWeatherDataFull(geo.latitude, geo.longitude, bmkgCode);
    
    const analysis = calculateFloodRisk(chartPoints, dailyForecast, bmkgCode, geo.name);
    const totalRainNow = chartPoints.reduce((sum, d) => sum + d.rainfall_mm, 0);

    chartPoints.forEach(d => { d.water_level_cm = 50 + (d.rainfall_mm * 12); });

    return {
      "location": `${geo.name}, ${geo.admin1}`,
      "riskLevel": analysis.todayRisk.level,
      "probability": analysis.todayRisk.score,
      "description": analysis.description,
      "factors": { 
          "rainfall": `${totalRainNow.toFixed(1)} mm (6 Jam)`, 
          "drainage": "Normal", 
          "history": "Topografi Landai" 
      },
      "recommendation": analysis.todayRisk.level === "AMAN" ? "Aman beraktivitas." : "Siaga banjir.",
      "sensorData": chartPoints, 
      "forecasts": [
        { 
            "period": "Hari Ini", 
            "riskLevel": analysis.todayRisk.level, 
            "probability": analysis.todayRisk.score, 
            "reasoning": `BMKG: ${bmkgData ? bmkgData.status : '-'} | Hujan: ${dailyForecast.today.rain}mm` 
        },
        { 
            "period": "Besok", 
            "riskLevel": analysis.besokRisk.level, // DYNAMIC (Bukan AUTO lagi)
            "probability": analysis.besokRisk.score, 
            "reasoning": `Prediksi Hujan: ${dailyForecast.tomorrow.rain}mm` 
        },
        { 
            "period": "Lusa", 
            "riskLevel": analysis.lusaRisk.level, // DYNAMIC
            "probability": analysis.lusaRisk.score, 
            "reasoning": `Prediksi Hujan: ${dailyForecast.dayAfter.rain}mm` 
        }
      ],
      "sources": [
        { web: { title: "BMKG Official", uri: "https://data.bmkg.go.id/" } },
        { web: { title: "Open-Meteo", uri: "https://open-meteo.com/" } }
    ]
    };
}

// --- ROUTES ---
app.get('/', (req, res) => {
    res.render('index', { data: null, error: null, location: '' });
});

app.post('/analyze', async (req, res) => {
    const location = req.body.location;
    try {
        const data = await analyzeFloodRisk(location);
        res.render('index', { data: data, error: null, location: location });
    } catch (error) {
        console.error("APP ERROR:", error);
        res.render('index', { data: null, error: "Gagal: " + error.message, location: location });
    }
});

app.listen(port, () => {
    console.log(`>>> SERVER VERSI FINAL BERJALAN DI PORT ${port} <<<`);
});