export interface SensorData {
  timestamp: string;
  rainfall_mm: number;
  water_level_cm: number;
  soil_saturation_pct: number;
}

export interface GroundingSource {
  web?: {
    uri: string;
    title: string;
  };
}

export interface Forecast {
  period: string; // "1 Hari", "3 Hari", "1 Tahun"
  riskLevel: 'AMAN' | 'WASPADA' | 'BAHAYA';
  probability: number;
  reasoning: string;
}

export interface RiskAnalysis {
  location: string;
  riskLevel: 'AMAN' | 'WASPADA' | 'BAHAYA';
  probability: number;
  description: string;
  factors: {
    rainfall: string;
    drainage: string;
    history: string;
  };
  recommendation: string;
  sensorData: SensorData[];
  forecasts: Forecast[];
  sources?: GroundingSource[];
}

export enum AnalysisStatus {
  IDLE = 'IDLE',
  ANALYZING = 'ANALYZING',
  COMPLETED = 'COMPLETED',
  ERROR = 'ERROR'
}