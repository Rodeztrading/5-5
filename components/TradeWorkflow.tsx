import React, { useState } from 'react';
import { VisualTrade } from '../types';
import { ImageUploader } from './ImageUploader';
import { ArrowUpCircle, ArrowDownCircle, DollarSign, Percent, Save, X } from 'lucide-react';

interface TradeWorkflowProps {
    onSave: (trade: Omit<VisualTrade, 'id' | 'createdAt'>) => void;
    onCancel: () => void;
}

export const TradeWorkflow: React.FC<TradeWorkflowProps> = ({ onSave, onCancel }) => {
    const [tradeImage, setTradeImage] = useState<{ base64: string; mimeType: string } | null>(null);
    const [userAction, setUserAction] = useState<'CALL' | 'PUT' | null>(null);
    const [outcome, setOutcome] = useState<'WIN' | 'LOSS' | null>(null);
    const [amount, setAmount] = useState<string>('');
    const [payout, setPayout] = useState<string>('85');

    const handleSave = () => {
        if (!tradeImage || !userAction || !outcome || !amount) return;

        onSave({
            tradeImage,
            userAction,
            outcome,
            amountInvested: parseFloat(amount),
            payout: parseFloat(payout),
        });
    };

    // Fix: Corrected variable declaration typo (was constisReady)
    const isReady = tradeImage && userAction && outcome && amount && payout;

    return (
        <div className="bg-gray-900 border border-gray-700 rounded-2xl overflow-hidden shadow-2xl flex flex-col md:flex-row max-w-4xl w-full max-h-[90vh]">

            {/* Left: Image Upload */}
            <div className="w-full md:w-1/2 p-6 bg-black/20 border-r border-gray-800 flex flex-col">
                <h3 className="text-lg font-bold text-white mb-4 flex items-center">
                    <span className="w-6 h-6 rounded-full bg-rodez-red text-black flex items-center justify-center text-xs mr-2">1</span>
                    Captura del Gráfico
                </h3>
                <div className="flex-1 flex items-center">
                    <ImageUploader onImageUpload={(base64, mimeType) => setTradeImage({ base64, mimeType })} />
                </div>
            </div>

            {/* Right: Details */}
            <div className="w-full md:w-1/2 p-6 flex flex-col overflow-y-auto">
                <div className="flex justify-between items-start mb-6">
                    <h3 className="text-lg font-bold text-white flex items-center">
                        <span className="w-6 h-6 rounded-full bg-rodez-red text-black flex items-center justify-center text-xs mr-2">2</span>
                        Detalles de Operación
                    </h3>
                    <button onClick={onCancel} className="text-gray-500 hover:text-white">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                <div className="space-y-6">
                    {/* Action Selection */}
                    <div>
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 block">Dirección</label>
                        <div className="grid grid-cols-2 gap-3">
                            <button
                                onClick={() => setUserAction('CALL')}
                                className={`p-4 rounded-xl border flex flex-col items-center justify-center transition-all ${userAction === 'CALL'
                                        ? 'bg-green-500/10 border-green-500 text-green-400'
                                        : 'bg-gray-800 border-gray-700 text-gray-400 hover:bg-gray-750'
                                    }`}
                            >
                                <ArrowUpCircle className="w-6 h-6 mb-2" />
                                <span className="font-bold">COMPRA (Call)</span>
                            </button>
                            <button
                                onClick={() => setUserAction('PUT')}
                                className={`p-4 rounded-xl border flex flex-col items-center justify-center transition-all ${userAction === 'PUT'
                                        ? 'bg-red-500/10 border-red-500 text-red-400'
                                        : 'bg-gray-800 border-gray-700 text-gray-400 hover:bg-gray-750'
                                    }`}
                            >
                                <ArrowDownCircle className="w-6 h-6 mb-2" />
                                <span className="font-bold">VENTA (Put)</span>
                            </button>
                        </div>
                    </div>

                    {/* Money Management */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 block">Inversión ($)</label>
                            <div className="relative">
                                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                                <input
                                    type="number"
                                    value={amount}
                                    onChange={e => setAmount(e.target.value)}
                                    className="w-full bg-gray-800 border border-gray-700 rounded-lg py-3 pl-9 pr-4 text-white focus:border-rodez-red focus:ring-1 focus:ring-rodez-red outline-none transition-all font-mono"
                                    placeholder="10.00"
                                />
                            </div>
                        </div>
                        <div>
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 block">Payout (%)</label>
                            <div className="relative">
                                <Percent className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                                <input
                                    type="number"
                                    value={payout}
                                    onChange={e => setPayout(e.target.value)}
                                    className="w-full bg-gray-800 border border-gray-700 rounded-lg py-3 pl-9 pr-4 text-white focus:border-rodez-red focus:ring-1 focus:ring-rodez-red outline-none transition-all font-mono"
                                    placeholder="85"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Outcome */}
                    <div>
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 block">Resultado</label>
                        <div className="grid grid-cols-2 gap-3">
                            <button
                                onClick={() => setOutcome('WIN')}
                                className={`p-3 rounded-lg border font-bold text-sm transition-all ${outcome === 'WIN'
                                        ? 'bg-green-500 text-black border-green-500'
                                        : 'bg-gray-800 border-gray-700 text-gray-400 hover:bg-gray-750'
                                    }`}
                            >
                                ITM (Ganada)
                            </button>
                            <button
                                onClick={() => setOutcome('LOSS')}
                                className={`p-3 rounded-lg border font-bold text-sm transition-all ${outcome === 'LOSS'
                                        ? 'bg-red-500 text-black border-red-500'
                                        : 'bg-gray-800 border-gray-700 text-gray-400 hover:bg-gray-750'
                                    }`}
                            >
                                OTM (Perdida)
                            </button>
                        </div>
                    </div>
                </div>

                <div className="mt-8 pt-6 border-t border-gray-800">
                    <button
                        onClick={handleSave}
                        disabled={!isReady}
                        className={`w-full py-4 rounded-xl font-bold flex items-center justify-center transition-all ${isReady
                                ? 'bg-rodez-red text-gray-900 hover:bg-blue-400 shadow-lg shadow-blue-500/20'
                                : 'bg-gray-800 text-gray-600 cursor-not-allowed'
                            }`}
                    >
                        <Save className="w-5 h-5 mr-2" />
                        Registrar Operación
                    </button>
                </div>
            </div>
        </div>
    );
};