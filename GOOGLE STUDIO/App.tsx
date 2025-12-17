import React, { useState } from 'react';
import { Search, MapPin, AlertTriangle, Info, ExternalLink, CalendarDays } from 'lucide-react';
import { analyzeFloodRisk } from './services/geminiService';
import { RiskAnalysis, AnalysisStatus } from './types';
import { RiskGauge } from './components/RiskGauge';
import { DecisionFactors } from './components/DecisionFactors';
import { SensorChart } from './components/SensorChart';
import { ForecastCards } from './components/ForecastCards';

const App: React.FC = () => {
  const [location, setLocation] = useState<string>('');
  const [status, setStatus] = useState<AnalysisStatus>(AnalysisStatus.IDLE);
  const [result, setResult] = useState<RiskAnalysis | null>(null);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!location.trim()) return;

    setStatus(AnalysisStatus.ANALYZING);
    setResult(null);

    try {
      const data = await analyzeFloodRisk(location);
      setResult(data);
      setStatus(AnalysisStatus.COMPLETED);
    } catch (error) {
      console.error(error);
      setStatus(AnalysisStatus.ERROR);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-12">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-blue-600 p-2 rounded-lg text-white">
              <MapPin size={24} />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900 leading-tight tracking-tight">Indonesia FloodGuard AI</h1>
              <p className="text-[10px] text-gray-500 uppercase font-bold tracking-widest">Nationwide Risk Prediction</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        <section className="mb-10 max-w-2xl mx-auto text-center">
          <h2 className="text-3xl font-extrabold mb-4 text-gray-800 tracking-tight">Deteksi Banjir Seluruh Indonesia</h2>
          <p className="text-gray-600 mb-8">Analisis risiko banjir 24 jam, 3 hari, hingga 1 tahun ke depan untuk wilayah mana pun di Indonesia.</p>
          
          <form onSubmit={handleSearch} className="relative flex items-center shadow-2xl rounded-full bg-white p-2 transition-all focus-within:ring-4 ring-blue-100 border border-gray-100">
            <div className="pl-4 text-gray-400">
              <Search size={20} />
            </div>
            <input
              type="text"
              placeholder="Masukkan Kota/Daerah (Contoh: Bandung, Makassar, Semarang...)"
              className="w-full px-4 py-3 bg-transparent outline-none text-lg text-gray-800 placeholder-gray-400 font-medium"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              disabled={status === AnalysisStatus.ANALYZING}
            />
            <button 
              type="submit"
              disabled={status === AnalysisStatus.ANALYZING}
              className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-full font-bold transition-all disabled:bg-blue-400 shadow-md active:scale-95"
            >
              {status === AnalysisStatus.ANALYZING ? 'Menganalisis...' : 'Analisis Lokasi'}
            </button>
          </form>
        </section>

        {status === AnalysisStatus.ERROR && (
          <div className="max-w-2xl mx-auto bg-red-50 border border-red-200 rounded-2xl p-6 flex items-start gap-4 mb-8">
            <AlertTriangle className="text-red-600 shrink-0" size={32} />
            <div>
              <h4 className="font-bold text-red-800 text-lg">Gagal Menganalisis</h4>
              <p className="text-red-600 text-sm">Pastikan input adalah area yang valid di Indonesia. Terjadi kendala teknis pada mesin AI.</p>
            </div>
          </div>
        )}

        {status === AnalysisStatus.COMPLETED && result && (
          <div className="animate-fade-in space-y-8">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
              <div>
                <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-[10px] font-black uppercase tracking-widest mb-2 inline-block">Wilayah Terdeteksi</span>
                <h2 className="text-4xl font-black text-gray-900 tracking-tight">{result.location}</h2>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-2 font-bold text-gray-700">
                <CalendarDays size={20} className="text-blue-600" />
                Prediksi Lintas Horizon (Indonesia Wide)
              </div>
              <ForecastCards forecasts={result.forecasts} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="space-y-6">
                <RiskGauge level={result.riskLevel} probability={result.probability} />
                
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                  <div className="flex items-center gap-2 mb-3 text-blue-600">
                    <Info size={20} />
                    <h3 className="font-bold">Protokol Keselamatan</h3>
                  </div>
                  <p className="text-gray-700 text-sm leading-relaxed">{result.recommendation}</p>
                </div>

                {result.sources && result.sources.length > 0 && (
                  <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                    <h3 className="text-xs font-black text-gray-400 mb-3 uppercase tracking-widest flex items-center gap-2">
                      <ExternalLink size={14} /> Referensi Wilayah Terkait
                    </h3>
                    <ul className="space-y-3">
                      {result.sources.map((source, idx) => (
                        source.web && (
                          <li key={idx}>
                            <a 
                              href={source.web.uri} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-xs text-blue-600 hover:text-blue-800 font-medium block truncate decoration-blue-200"
                              title={source.web.title}
                            >
                              • {source.web.title || source.web.uri}
                            </a>
                          </li>
                        )
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              <div className="md:col-span-2 space-y-6">
                <div className="bg-indigo-600 p-6 rounded-3xl shadow-xl shadow-indigo-100 text-white">
                  <h3 className="font-bold text-indigo-100 mb-2 uppercase text-[10px] tracking-widest">Executive Summary</h3>
                  <p className="text-lg font-medium leading-relaxed">{result.description}</p>
                </div>

                <DecisionFactors factors={result.factors} />

                <SensorChart data={result.sensorData} />
              </div>
            </div>
          </div>
        )}

        {status === AnalysisStatus.ANALYZING && (
          <div className="max-w-4xl mx-auto space-y-8 animate-pulse">
            <div className="h-10 bg-gray-200 rounded-full w-1/2 mb-8"></div>
            <div className="grid grid-cols-3 gap-4">
               <div className="h-32 bg-gray-200 rounded-2xl"></div>
               <div className="h-32 bg-gray-200 rounded-2xl"></div>
               <div className="h-32 bg-gray-200 rounded-2xl"></div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="h-96 bg-gray-200 rounded-3xl"></div>
              <div className="md:col-span-2 space-y-6">
                <div className="h-32 bg-gray-200 rounded-3xl"></div>
                <div className="h-48 bg-gray-200 rounded-3xl"></div>
                <div className="h-64 bg-gray-200 rounded-3xl"></div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;