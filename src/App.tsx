import React, { useState, useEffect } from 'react';
import { AlertTriangle, Droplets, Thermometer, Activity, TrendingUp, Calendar, Database } from 'lucide-react';
import SensorInput from './components/SensorInput';
import PredictionDisplay from './components/PredictionDisplay';
import HistoryChart from './components/HistoryChart';
import ForecastChart from './components/ForecastChart';
import AlertSystem from './components/AlertSystem';
import ReportButton from './components/ReportButton';
import { apiService } from './services/api';
import { databaseService } from './services/database';

export interface SensorData {
  rainfall: number;
  temperature: number;
  waterContent: number;
}

export interface Prediction {
  id: string;
  timestamp: string;
  premiseIndex: number;
  rainfall: number;
  temperature: number;
  waterContent: number;
  riskLevel: 'low' | 'medium' | 'high';
  confidence?: number;
}

export interface ForecastData {
  date: string;
  premiseIndex: number;
}

function App() {
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [currentPrediction, setCurrentPrediction] = useState<Prediction | null>(null);
  const [forecast, setForecast] = useState<ForecastData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [alerts, setAlerts] = useState<string[]>([]);
  const [backendStatus, setBackendStatus] = useState<'connected' | 'disconnected' | 'checking'>('checking');
  const [isSavingToDb, setIsSavingToDb] = useState(false);

  // Check backend health on component mount
  useEffect(() => {
    checkBackendHealth();
    loadForecast();
    loadPredictionsFromDatabase();
  }, []);

  const loadPredictionsFromDatabase = async () => {
    try {
      const savedPredictions = await databaseService.getAllPredictions();
      setPredictions(savedPredictions.slice(0, 10)); // Keep last 10 predictions
    } catch (error) {
      console.error('Error loading predictions from database:', error);
      setAlerts(prev => ['Failed to load prediction history from database.', ...prev.slice(0, 4)]);
    }
  };
  const checkBackendHealth = async () => {
    try {
      const health = await apiService.getModelHealth();
      setBackendStatus(health.models_loaded ? 'connected' : 'disconnected');
      if (!health.models_loaded) {
        setAlerts(prev => ['Backend models not loaded. Please check your model files.', ...prev.slice(0, 4)]);
      }
    } catch (error) {
      setBackendStatus('disconnected');
      setAlerts(prev => ['Cannot connect to backend server. Please ensure it is running.', ...prev.slice(0, 4)]);
    }
  };

  const handlePrediction = async (data: SensorData) => {
    setIsLoading(true);
    
    try {
      // Use real ML model prediction from backend
      const result = await apiService.predictPremiseIndex(data);
      
      const newPrediction: Prediction = {
        id: Date.now().toString(),
        timestamp: new Date().toLocaleString(),
        premiseIndex: result.premiseIndex,
        rainfall: data.rainfall,
        temperature: data.temperature,
        waterContent: data.waterContent,
        riskLevel: result.riskLevel,
        confidence: result.confidence
      };
      
      setCurrentPrediction(newPrediction);
      setPredictions(prev => [newPrediction, ...prev.slice(0, 9)]); // Keep last 10 predictions
      
      // Save to Firebase database
      try {
        setIsSavingToDb(true);
        await databaseService.savePrediction(newPrediction);
      } catch (error) {
        console.error('Error saving to database:', error);
        setAlerts(prev => ['Failed to save prediction to database.', ...prev.slice(0, 4)]);
      } finally {
        setIsSavingToDb(false);
      }
      
      // Generate alert if high risk
      if (result.riskLevel === 'high') {
        const alertMessage = `High breeding risk detected! Premise Index: ${result.premiseIndex.toFixed(2)}% (Confidence: ${(result.confidence * 100).toFixed(1)}%)`;
        setAlerts(prev => [alertMessage, ...prev.slice(0, 4)]);
      }
      
    } catch (error) {
      console.error('Prediction error:', error);
      setAlerts(prev => [`Prediction failed: ${error instanceof Error ? error.message : 'Unknown error'}`, ...prev.slice(0, 4)]);
      
      // Fallback to local calculation if backend fails
      const fallbackPrediction = calculateFallbackPrediction(data);
      setCurrentPrediction(fallbackPrediction);
      setPredictions(prev => [fallbackPrediction, ...prev.slice(0, 9)]);
    } finally {
      setIsLoading(false);
    }
  };

  const calculateFallbackPrediction = (data: SensorData): Prediction => {
    // Fallback calculation when backend is unavailable
    const rainfallWeight = 0.4;
    const temperatureWeight = 0.35;
    const waterContentWeight = 0.25;
    
    const normalizedRainfall = Math.min(data.rainfall / 200 * 100, 100);
    const normalizedTemp = Math.min((data.temperature - 20) / 15 * 100, 100);
    const normalizedWater = Math.min(data.waterContent * 10, 100);
    
    const premiseIndex = (
      normalizedRainfall * rainfallWeight +
      normalizedTemp * temperatureWeight +
      normalizedWater * waterContentWeight
    );
    
    const variation = (Math.random() - 0.5) * 20;
    const finalIndex = Math.max(0, Math.min(100, premiseIndex + variation));
    
    const getRiskLevel = (index: number): 'low' | 'medium' | 'high' => {
      if (index < 30) return 'low';
      if (index < 60) return 'medium';
      return 'high';
    };

    return {
      id: Date.now().toString(),
      timestamp: new Date().toLocaleString(),
      premiseIndex: Math.round(finalIndex * 100) / 100,
      rainfall: data.rainfall,
      temperature: data.temperature,
      waterContent: data.waterContent,
      riskLevel: getRiskLevel(finalIndex),
      confidence: 0.6 // Lower confidence for fallback
    };
  };

  const loadForecast = async () => {
    try {
      const result = await apiService.getTimeSeriesForecast(90);
      const forecastData: ForecastData[] = result.dates.map((date, index) => ({
        date,
        premiseIndex: result.predictions[index]
      }));
      setForecast(forecastData);
    } catch (error) {
      console.warn('Backend forecast unavailable, using fallback data:', error);
      // Generate fallback forecast
      generateFallbackForecast();
    }
  };

  const generateFallbackForecast = () => {
    const forecastData: ForecastData[] = [];
    const today = new Date();
    
    for (let i = 0; i < 90; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() + i);
      
      const seasonalFactor = Math.sin((i / 365) * 2 * Math.PI) * 15 + 45;
      const randomVariation = (Math.random() - 0.5) * 20;
      const premiseIndex = Math.max(10, Math.min(90, seasonalFactor + randomVariation));
      
      forecastData.push({
        date: date.toISOString().split('T')[0],
        premiseIndex: Math.round(premiseIndex * 100) / 100
      });
    }
    
    setForecast(forecastData);
  };

  const handleReportGenerated = async () => {
    try {
      // Clear all predictions from database
      await databaseService.clearAllPredictions();
      
      // Clear local state
      setPredictions([]);
      setCurrentPrediction(null);
      setAlerts(prev => ['Report generated successfully. All prediction data has been cleared.', ...prev.slice(0, 4)]);
      
    } catch (error) {
      console.error('Error clearing data after report generation:', error);
      setAlerts(prev => ['Report generated but failed to clear data. Please try manually.', ...prev.slice(0, 4)]);
    }
  };
  const dismissAlert = (index: number) => {
    setAlerts(prev => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-4">
            <div className="bg-blue-600 p-3 rounded-full mr-4">
              <Activity className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-4xl font-bold text-gray-800">
              Dengue Breeding Prediction System
            </h1>
          </div>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Advanced AI-powered system for predicting dengue breeding conditions using environmental sensor data
          </p>
          
          {/* Backend Status Indicator */}
          <div className="mt-4 flex items-center justify-center">
            <div className={`flex items-center px-3 py-1 rounded-full text-sm ${
              backendStatus === 'connected' ? 'bg-green-100 text-green-800' :
              backendStatus === 'disconnected' ? 'bg-red-100 text-red-800' :
              'bg-yellow-100 text-yellow-800'
            }`}>
              <div className={`w-2 h-2 rounded-full mr-2 ${
                backendStatus === 'connected' ? 'bg-green-600' :
                backendStatus === 'disconnected' ? 'bg-red-600' :
                'bg-yellow-600'
              }`}></div>
              {backendStatus === 'connected' ? 'ML Models Connected' :
               backendStatus === 'disconnected' ? 'Backend Disconnected' :
               'Checking Connection...'}
            </div>
            
            {/* Database Status */}
            {isSavingToDb && (
              <div className="ml-3 flex items-center px-3 py-1 rounded-full text-sm bg-blue-100 text-blue-800">
                <div className="w-2 h-2 rounded-full mr-2 bg-blue-600 animate-pulse"></div>
                Saving to Database...
              </div>
            )}
          </div>
          
          {/* Report Generation Button */}
          <div className="mt-6 flex justify-center">
            <ReportButton 
              predictions={predictions} 
              onReportGenerated={handleReportGenerated}
            />
          </div>
        </div>

        {/* Alert System */}
        <AlertSystem alerts={alerts} onDismiss={dismissAlert} />

        {/* Main Dashboard Grid */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8 mb-8">
          {/* Sensor Input */}
          <div className="xl:col-span-1">
            <SensorInput onSubmit={handlePrediction} isLoading={isLoading} />
          </div>

          {/* Current Prediction */}
          <div className="xl:col-span-2">
            <PredictionDisplay 
              prediction={currentPrediction} 
              isLoading={isLoading} 
            />
          </div>
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* History Chart */}
          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="flex items-center mb-6">
              <TrendingUp className="w-6 h-6 text-blue-600 mr-3" />
              <h2 className="text-2xl font-semibold text-gray-800">Prediction History</h2>
            </div>
            <HistoryChart predictions={predictions} />
          </div>

          {/* Forecast Chart */}
          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="flex items-center mb-6">
              <Calendar className="w-6 h-6 text-indigo-600 mr-3" />
              <h2 className="text-2xl font-semibold text-gray-800">3-Month Forecast</h2>
            </div>
            <ForecastChart forecast={forecast} />
          </div>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-white rounded-xl shadow-lg p-6 text-center">
            <Database className="w-8 h-8 text-blue-600 mx-auto mb-3" />
            <h3 className="text-lg font-semibold text-gray-800">Total Predictions</h3>
            <p className="text-3xl font-bold text-blue-600">{predictions.length}</p>
          </div>
          
          <div className="bg-white rounded-xl shadow-lg p-6 text-center">
            <AlertTriangle className="w-8 h-8 text-red-600 mx-auto mb-3" />
            <h3 className="text-lg font-semibold text-gray-800">High Risk Alerts</h3>
            <p className="text-3xl font-bold text-red-600">
              {predictions.filter(p => p.riskLevel === 'high').length}
            </p>
          </div>
          
          <div className="bg-white rounded-xl shadow-lg p-6 text-center">
            <Thermometer className="w-8 h-8 text-orange-600 mx-auto mb-3" />
            <h3 className="text-lg font-semibold text-gray-800">Avg Temperature</h3>
            <p className="text-3xl font-bold text-orange-600">
              {predictions.length > 0 
                ? `${(predictions.reduce((acc, p) => acc + p.temperature, 0) / predictions.length).toFixed(1)}°C`
                : '0°C'
              }
            </p>
          </div>
          
          <div className="bg-white rounded-xl shadow-lg p-6 text-center">
            <Droplets className="w-8 h-8 text-cyan-600 mx-auto mb-3" />
            <h3 className="text-lg font-semibold text-gray-800">Avg Rainfall</h3>
            <p className="text-3xl font-bold text-cyan-600">
              {predictions.length > 0 
                ? `${(predictions.reduce((acc, p) => acc + p.rainfall, 0) / predictions.length).toFixed(1)}mm`
                : '0mm'
              }
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;