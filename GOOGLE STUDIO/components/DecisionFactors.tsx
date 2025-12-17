import React from 'react';
import { CloudRain, Activity, History } from 'lucide-react';

interface DecisionFactorsProps {
  factors: {
    rainfall: string;
    drainage: string;
    history: string;
  };
}

export const DecisionFactors: React.FC<DecisionFactorsProps> = ({ factors }) => {
  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
      <h3 className="text-lg font-semibold text-gray-800 mb-4">Faktor Penentu (Decision Nodes)</h3>
      <div className="space-y-4">
        <div className="flex items-start gap-4 p-3 bg-blue-50 rounded-lg">
          <div className="p-2 bg-blue-100 rounded-full text-blue-600">
            <CloudRain size={20} />
          </div>
          <div>
            <h4 className="font-medium text-gray-900">Intensitas Hujan</h4>
            <p className="text-sm text-gray-600">{factors.rainfall}</p>
          </div>
        </div>
        
        <div className="flex items-start gap-4 p-3 bg-indigo-50 rounded-lg">
          <div className="p-2 bg-indigo-100 rounded-full text-indigo-600">
            <Activity size={20} />
          </div>
          <div>
            <h4 className="font-medium text-gray-900">Kapasitas Drainase</h4>
            <p className="text-sm text-gray-600">{factors.drainage}</p>
          </div>
        </div>

        <div className="flex items-start gap-4 p-3 bg-orange-50 rounded-lg">
          <div className="p-2 bg-orange-100 rounded-full text-orange-600">
            <History size={20} />
          </div>
          <div>
            <h4 className="font-medium text-gray-900">Histori & Topografi</h4>
            <p className="text-sm text-gray-600">{factors.history}</p>
          </div>
        </div>
      </div>
    </div>
  );
};