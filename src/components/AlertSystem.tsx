import React from 'react';
import { AlertTriangle, X } from 'lucide-react';

interface AlertSystemProps {
  alerts: string[];
  onDismiss: (index: number) => void;
}

const AlertSystem: React.FC<AlertSystemProps> = ({ alerts, onDismiss }) => {
  if (alerts.length === 0) {
    return null;
  }

  return (
    <div className="fixed top-4 right-4 space-y-2 z-50 max-w-md">
      {alerts.map((alert, index) => (
        <div
          key={index}
          className="bg-red-600 text-white p-4 rounded-lg shadow-lg animate-fade-in flex items-start space-x-3"
        >
          <AlertTriangle className="w-5 h-5 mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <p className="font-semibold">High Risk Alert</p>
            <p className="text-sm opacity-90">{alert}</p>
          </div>
          <button
            onClick={() => onDismiss(index)}
            className="text-white hover:text-red-200 transition-colors flex-shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
      
      <style jsx>{`
        @keyframes fade-in {
          from {
            opacity: 0;
            transform: translateX(100%);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
        
        .animate-fade-in {
          animation: fade-in 0.3s ease-out;
        }
      `}</style>
    </div>
  );
};

export default AlertSystem;