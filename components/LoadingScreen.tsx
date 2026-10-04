import React from 'react';
import { Target } from 'lucide-react';

export const LoadingScreen: React.FC = () => {
    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 flex items-center justify-center">
            <div className="text-center">
                <div className="mb-4">
                    <h1 className="text-4xl font-black tracking-tight text-white leading-none mb-1">
                        5-5 <span className="text-rodez-red">FINANZAS</span>
                    </h1>
                    <span className="text-xs text-gray-400 font-semibold tracking-wider uppercase">
                        Control de Presupuesto
                    </span>
                </div>
                <p className="text-gray-400 mt-2 text-sm">Cargando...</p>
            </div>
        </div>
    );
};
