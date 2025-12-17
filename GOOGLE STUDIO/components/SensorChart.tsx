import React from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { SensorData } from '../types';

interface SensorChartProps {
  data: SensorData[];
}

export const SensorChart: React.FC<SensorChartProps> = ({ data }) => {
  if (!data || data.length === 0) {
    return (
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 h-80 flex items-center justify-center">
        <p className="text-gray-400 italic">Data sensor tidak tersedia untuk lokasi ini.</p>
      </div>
    );
  }

  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
      <h3 className="text-lg font-bold text-gray-800 mb-6">Monitoring Real-time (Simulasi Sensor)</h3>
      <div className="h-[300px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={data}
            margin={{
              top: 10,
              right: 10,
              left: -20,
              bottom: 0,
            }}
          >
            <defs>
              <linearGradient id="colorRain" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.1}/>
                <stop offset="95%" stopColor="#3B82F6" stopOpacity={0}/>
              </linearGradient>
              <linearGradient id="colorLevel" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#EF4444" stopOpacity={0.1}/>
                <stop offset="95%" stopColor="#EF4444" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
            <XAxis 
              dataKey="timestamp" 
              tick={{fontSize: 10, fill: '#94a3b8'}} 
              axisLine={false} 
              tickLine={false}
              dy={10}
            />
            <YAxis 
              tick={{fontSize: 10, fill: '#94a3b8'}} 
              axisLine={false} 
              tickLine={false} 
            />
            <Tooltip 
              contentStyle={{ 
                borderRadius: '12px', 
                border: 'none', 
                boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
                fontSize: '12px'
              }}
            />
            <Legend verticalAlign="top" height={36} iconType="circle" wrapperStyle={{fontSize: '12px', fontWeight: 'bold'}} />
            <Area 
              type="monotone" 
              dataKey="rainfall_mm" 
              stroke="#3B82F6" 
              fillOpacity={1} 
              fill="url(#colorRain)" 
              name="Curah Hujan (mm)" 
              strokeWidth={3}
            />
            <Area 
              type="monotone" 
              dataKey="water_level_cm" 
              stroke="#EF4444" 
              fillOpacity={1} 
              fill="url(#colorLevel)" 
              name="Tinggi Air (cm)" 
              strokeWidth={3}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-4 text-[10px] text-gray-400 text-center uppercase font-bold tracking-widest">
        Data simulasi berdasarkan parameter input hidrologi
      </p>
    </div>
  );
};