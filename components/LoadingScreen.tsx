import React from 'react';
import { Target } from 'lucide-react';

export const LoadingScreen: React.FC = () => {
    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 flex items-center justify-center">
            <div className="text-center">
                <div className="inline-flex items-center justify-center space-x-3 mb-4">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-red-600 to-red-800 flex items-center justify-center font-black text-white text-2xl tracking-tight shadow-xl shadow-red-900/40 border border-red-500/40 animate-pulse">
                        5-5
                    </div>
                    <div className="text-left">
                        <h1 className="text-2xl font-black tracking-tight text-white leading-none">
                            5-5 <span className="text-rodez-red">FINANZAS</span>
                        </h1>
                        <span className="text-xs text-gray-400 font-semibold tracking-wider uppercase">
                            Control Financiero
                        </span>
                    </div>
                </div>
                <p className="text-gray-400 mt-2 text-sm">Cargando...</p>
            </div>
        </div>
    );
};
