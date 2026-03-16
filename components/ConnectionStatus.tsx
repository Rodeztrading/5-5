import React from 'react';
import { WifiOff, Wifi } from 'lucide-react';

interface ConnectionStatusProps {
    isOnline: boolean;
}

export const ConnectionStatus: React.FC<ConnectionStatusProps> = ({ isOnline }) => {
    if (isOnline) return null; // Don't show anything when online

    return (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom duration-300">
            <div className="bg-orange-500/90 backdrop-blur-sm text-white px-6 py-3 rounded-full shadow-lg border border-orange-400 flex items-center space-x-3">
                <WifiOff className="w-5 h-5 animate-pulse" />
                <span className="font-semibold text-sm">Modo Offline - Los datos se sincronizarán cuando vuelva la conexión</span>
            </div>
        </div>
    );
};
