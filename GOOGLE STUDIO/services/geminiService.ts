import { GoogleGenAI } from "@google/genai";
import { RiskAnalysis } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const analyzeFloodRisk = async (location: string): Promise<RiskAnalysis> => {
  const model = "gemini-3-flash-preview"; 
  
  const systemInstruction = `
    Anda adalah sistem AI ahli hidrologi dan manajemen bencana untuk seluruh wilayah Indonesia. 
    Tugas Anda adalah memprediksi risiko banjir menggunakan logika yang menyerupai 'Random Forest Classifier' dan 'Time Series Forecasting'.
    
    Analisis input lokasi berdasarkan:
    1. Cuaca saat ini di wilayah tersebut (Data Real-time via Google Search).
    2. Prediksi cuaca 3 hari ke depan di provinsi/kota terkait.
    3. Tren musiman tahunan berdasarkan data historis banjir di wilayah tersebut.
    
    PENTING: Anda HARUS mengembalikan output HANYA dalam format JSON mentah tanpa blok kode markdown (tanpa \`\`\`json).
    Gunakan data Google Search untuk memvalidasi kondisi lapangan saat ini di area spesifik di Indonesia.
  `;

  const prompt = `
    Lakukan analisis risiko banjir komprehensif untuk "${location}, Indonesia".
    
    Berikan prediksi untuk 3 horizon waktu:
    1. "1 Hari": Fokus pada curah hujan hari ini di lokasi tersebut.
    2. "3 Hari": Fokus pada akumulasi hujan jangka pendek.
    3. "1 Tahun": Fokus pada risiko musiman wilayah tersebut (misal: puncak musim hujan lokal).
    
    Untuk "sensorData", Anda HARUS menghasilkan tepat 6 data points (T-5, T-4, T-3, T-2, T-1, dan Sekarang) agar visualisasi chart stabil. Pastikan nilai curah hujan dan tinggi air adalah angka (number).
    
    Format JSON:
    {
      "location": "${location}",
      "riskLevel": "AMAN" | "WASPADA" | "BAHAYA",
      "probability": number,
      "description": "string",
      "factors": { "rainfall": "string", "drainage": "string", "history": "string" },
      "recommendation": "string",
      "sensorData": [
        { "timestamp": "T-5", "rainfall_mm": number, "water_level_cm": number, "soil_saturation_pct": number },
        { "timestamp": "T-4", "rainfall_mm": number, "water_level_cm": number, "soil_saturation_pct": number },
        { "timestamp": "T-3", "rainfall_mm": number, "water_level_cm": number, "soil_saturation_pct": number },
        { "timestamp": "T-2", "rainfall_mm": number, "water_level_cm": number, "soil_saturation_pct": number },
        { "timestamp": "T-1", "rainfall_mm": number, "water_level_cm": number, "soil_saturation_pct": number },
        { "timestamp": "Sekarang", "rainfall_mm": number, "water_level_cm": number, "soil_saturation_pct": number }
      ],
      "forecasts": [
        { "period": "1 Hari", "riskLevel": "AMAN" | "WASPADA" | "BAHAYA", "probability": number, "reasoning": "string" },
        { "period": "3 Hari", "riskLevel": "AMAN" | "WASPADA" | "BAHAYA", "probability": number, "reasoning": "string" },
        { "period": "1 Tahun", "riskLevel": "AMAN" | "WASPADA" | "BAHAYA", "probability": number, "reasoning": "string" }
      ]
    }
  `;

  try {
    const response = await ai.models.generateContent({
      model: model,
      contents: prompt,
      config: {
        systemInstruction: systemInstruction,
        tools: [{ googleSearch: {} }],
      }
    });

    const text = response.text || "";
    const jsonStart = text.indexOf('{');
    const jsonEnd = text.lastIndexOf('}') + 1;
    
    if (jsonStart === -1 || jsonEnd === -1) throw new Error("Format respons AI tidak valid (JSON tidak ditemukan)");

    const jsonString = text.substring(jsonStart, jsonEnd);
    const result = JSON.parse(jsonString);
    const sources = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];

    return { ...result, sources } as RiskAnalysis;
  } catch (error) {
    console.error("Flood analysis failed:", error);
    throw error;
  }
};