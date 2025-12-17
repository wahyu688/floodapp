import React from 'react';
import { Calendar, Clock, TrendingUp } from 'lucide-react';
import { Forecast } from '../types';

interface ForecastCardsProps {
  forecasts: Forecast[];
}

export const ForecastCards: React.FC<ForecastCardsProps> = ({ forecasts }) => {
  const getRiskColor = (level: string) => {
    switch (level) {
      case 'BAHAYA': return 'text-red-600 bg-red-50 border-red-100';
      case 'WASPADA': return 'text-yellow-600 bg-yellow-50 border-yellow-100';
      default: return 'text-green-600 bg-green-50 border-green-100';
    }
  };

  const getIcon = (period: string) => {
    if (period.includes('Hari')) return <Clock size={18} />;
    return <Calendar size={18} />;
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {forecasts.map((f, i) => (
        <div key={i} className={`p-5 rounded-2xl border ${getRiskColor(f.riskLevel)} shadow-sm transition-transform hover:scale-[1.02]`}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 font-bold uppercase text-xs tracking-wider opacity-80">
              {getIcon(f.period)}
              {f.period}
            </div>
            <span className="text-xs font-black px-2 py-0.5 rounded-full bg-white bg-opacity-50">
              {f.probability}%
            </span>
          </div>
          <div className="text-xl font-black mb-1">{f.riskLevel}</div>
          <p className="text-xs leading-relaxed opacity-90">{f.reasoning}</p>
        </div>
      ))}
    </div>
  );
};