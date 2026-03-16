import React, { useState } from 'react';
import { X, Wallet, CreditCard, PiggyBank, DollarSign } from 'lucide-react';
import { AccountType, Account } from '../types';

interface AddAccountModalProps {
    onClose: () => void;
    onSave: (account: Omit<Account, 'id' | 'createdAt'>) => Promise<void>;
}

export const AddAccountModal: React.FC<AddAccountModalProps> = ({ onClose, onSave }) => {
    const [name, setName] = useState('');
    const [type, setType] = useState<AccountType>(AccountType.CASH);
    const [balance, setBalance] = useState('');
    const [currency, setCurrency] = useState('USD');
    const [color, setColor] = useState('bg-blue-600');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name || !balance) return;

        try {
            setLoading(true);
            await onSave({
                name,
                type,
                balance: parseFloat(balance),
                currency,
                color,
            });
            onClose();
        } catch (error) {
            console.error('Error saving account:', error);
        } finally {
            setLoading(false);
        }
    };

    const colors = [
        'bg-blue-600', 'bg-green-600', 'bg-red-600', 'bg-yellow-600',
        'bg-purple-600', 'bg-pink-600', 'bg-indigo-600', 'bg-gray-600'
    ];

    return (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
            <div className="bg-gray-900 border border-gray-800 rounded-xl w-full max-w-md shadow-2xl">
                <div className="flex justify-between items-center p-6 border-b border-gray-800">
                    <h2 className="text-xl font-bold text-white">Nueva Cuenta</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-6">
                    {/* Account Type Selection */}
                    <div className="grid grid-cols-4 gap-2">
                        {[
                            { type: AccountType.CASH, icon: Wallet, label: 'Efectivo' },
                            { type: AccountType.BANK, icon: DollarSign, label: 'Banco' },
                            { type: AccountType.SAVINGS, icon: PiggyBank, label: 'Ahorro' },
                            { type: AccountType.CREDIT_CARD, icon: CreditCard, label: 'Tarjeta' },
                        ].map((item) => (
                            <button
                                key={item.type}
                                type="button"
                                onClick={() => setType(item.type)}
                                className={`flex flex-col items-center p-3 rounded-lg border transition-all ${type === item.type
                                    ? 'bg-rodez-red/20 border-rodez-red text-white'
                                    : 'bg-gray-800 border-gray-700 text-gray-400 hover:bg-gray-700'
                                    }`}
                            >
                                <item.icon className={`w-6 h-6 mb-2 ${type === item.type ? 'text-rodez-red' : ''}`} />
                                <span className="text-xs">{item.label}</span>
                            </button>
                        ))}
                    </div>

                    {/* Name Input */}
                    <div>
                        <label className="block text-sm font-medium text-gray-400 mb-2">Nombre de la Cuenta</label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="Ej. Billetera Principal, Banco X"
                            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-rodez-red focus:border-transparent outline-none transition-all"
                            required
                        />
                    </div>

                    {/* Balance & Currency */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-400 mb-2">Balance Inicial</label>
                            <input
                                type="number"
                                value={balance}
                                onChange={(e) => setBalance(e.target.value)}
                                placeholder="0.00"
                                step="0.01"
                                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-rodez-red focus:border-transparent outline-none transition-all"
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-400 mb-2">Moneda</label>
                            <select
                                value={currency}
                                onChange={(e) => setCurrency(e.target.value)}
                                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-rodez-red focus:border-transparent outline-none transition-all"
                            >
                                <option value="USD">USD ($)</option>
                                <option value="EUR">EUR (€)</option>
                                <option value="COP">COP ($)</option>
                                <option value="MXN">MXN ($)</option>
                            </select>
                        </div>
                    </div>

                    {/* Color Selection */}
                    <div>
                        <label className="block text-sm font-medium text-gray-400 mb-2">Color Identificativo</label>
                        <div className="flex space-x-2">
                            {colors.map((c) => (
                                <button
                                    key={c}
                                    type="button"
                                    onClick={() => setColor(c)}
                                    className={`w-8 h-8 rounded-full ${c} transition-transform ${color === c ? 'ring-2 ring-white scale-110' : 'opacity-70 hover:opacity-100'
                                        }`}
                                />
                            ))}
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="flex space-x-3 pt-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-4 py-3 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition-colors font-medium"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="flex-1 px-4 py-3 bg-rodez-red hover:bg-blue-600 text-white rounded-lg transition-colors font-medium flex items-center justify-center"
                        >
                            {loading ? (
                                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                            ) : (
                                'Crear Cuenta'
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
