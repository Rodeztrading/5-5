import React from 'react';
import { Target } from 'lucide-react';

export const LoadingScreen: React.FC = () => {
    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 flex items-center justify-center">
            <div className="text-center">
                <div className="w-64 h-32 md:w-96 md:h-48 mx-auto mb-6 overflow-hidden flex items-center justify-center">
                    <img
                        src="/logo_rodez.png"
                        alt="RODEZ Logo"
                        className="w-full h-full object-contain scale-[1.8] transform origin-center"
                    />
                </div>
                <p className="text-gray-400 mt-4">Cargando...</p>
            </div>
        </div>
    );
};
