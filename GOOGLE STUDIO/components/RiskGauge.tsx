import React from 'react';

interface RiskGaugeProps {
  level: 'AMAN' | 'WASPADA' | 'BAHAYA';
  probability: number;
}

export const RiskGauge: React.FC<RiskGaugeProps> = ({ level, probability }) => {
  let colorClass = 'bg-green-500';
  let textColor = 'text-green-700';
  let bgColor = 'bg-green-100';

  if (level === 'WASPADA') {
    colorClass = 'bg-yellow-500';
    textColor = 'text-yellow-700';
    bgColor = 'bg-yellow-100';
  } else if (level === 'BAHAYA') {
    colorClass = 'bg-red-600';
    textColor = 'text-red-700';
    bgColor = 'bg-red-100';
  }

  return (
    <div className={`p-6 rounded-2xl ${bgColor} border border-opacity-20 shadow-sm flex flex-col items-center justify-center text-center`}>
      <h3 className="text-gray-600 font-medium mb-2 uppercase tracking-wide text-sm">Status Risiko</h3>
      <div className={`text-4xl font-extrabold ${textColor} mb-2`}>{level}</div>
      <div className="w-full bg-gray-200 rounded-full h-4 mb-2 overflow-hidden">
        <div 
          className={`h-4 rounded-full ${colorClass} transition-all duration-1000 ease-out`} 
          style={{ width: `${probability}%` }}
        ></div>
      </div>
      <p className="text-sm text-gray-500">Probabilitas Banjir: <span className="font-bold">{probability}%</span></p>
      <p className="text-xs text-gray-400 mt-2">Model: Random Forest Ensemble (AI Simulated)</p>
    </div>
  );
};