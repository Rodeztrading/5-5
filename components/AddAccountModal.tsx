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
    const [currency, setCurrency] = useState('COP');
    const [color, setColor] = useState('bg-blue-600');
    const [savingsYieldRateAnnual, setSavingsYieldRateAnnual] = useState('9.35');
    const [creditLimit, setCreditLimit] = useState('');
    const [creditAvailable, setCreditAvailable] = useState('');
    const [creditCutoffDay, setCreditCutoffDay] = useState('');
    const [creditPaymentDueDay, setCreditPaymentDueDay] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name) return;
        const yieldRate = Number(savingsYieldRateAnnual);
        if (type === AccountType.SAVINGS && (!Number.isFinite(yieldRate) || yieldRate < 0 || yieldRate > 100)) {
            alert('Ingresa una tasa E.A. entre 0% y 100%.');
            return;
        }
        const totalCredit = Number(creditLimit);
        const availableCredit = Number(creditAvailable);
        const cutoffDay = Number(creditCutoffDay);
        const paymentDueDay = Number(creditPaymentDueDay);
        if (type === AccountType.CREDIT_CARD && (
            !Number.isFinite(totalCredit) || totalCredit <= 0 ||
            !Number.isFinite(availableCredit) || availableCredit < 0 || availableCredit > totalCredit ||
            !Number.isInteger(cutoffDay) || cutoffDay < 1 || cutoffDay > 31 ||
            !Number.isInteger(paymentDueDay) || paymentDueDay < 1 || paymentDueDay > 31
        )) {
            alert('Verifica el cupo total, el cupo disponible y los días de corte y pago.');
            return;
        }

        try {
            setLoading(true);
            await onSave({
                name,
                type,
                balance: type === AccountType.CREDIT_CARD ? totalCredit - availableCredit : 0,
                ...(type === AccountType.SAVINGS ? { savingsYieldRateAnnual: yieldRate } : {}),
                ...(type === AccountType.CREDIT_CARD ? {
                    creditLimit: totalCredit,
                    creditAvailable: availableCredit,
                    creditCutoffDay: cutoffDay,
                    creditPaymentDueDay: paymentDueDay,
                } : {}),
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
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-3 sm:p-4 backdrop-blur-sm">
            <div className="bg-gray-900 border border-gray-800 rounded-xl w-full max-w-md shadow-2xl max-h-[calc(100dvh-1.5rem)] flex flex-col overflow-hidden">
                <div className="flex justify-between items-center p-4 sm:p-6 border-b border-gray-800 shrink-0">
                    <h2 className="text-xl font-bold text-white">Nueva Cuenta</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-5 overflow-y-auto min-h-0 overscroll-contain">
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

                    {type === AccountType.SAVINGS && (
                        <div>
                            <label htmlFor="savings-yield-rate" className="mb-2 block text-sm font-medium text-gray-400">
                                Rendimiento anual efectivo (E.A.)
                            </label>
                            <div className="relative">
                                <input
                                    id="savings-yield-rate"
                                    type="number"
                                    min="0"
                                    max="100"
                                    step="0.01"
                                    value={savingsYieldRateAnnual}
                                    onChange={event => setSavingsYieldRateAnnual(event.target.value)}
                                    className="w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-3 pr-10 text-white outline-none transition-all focus:border-transparent focus:ring-2 focus:ring-rodez-red"
                                    required
                                />
                                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400">%</span>
                            </div>
                            <p className="mt-2 text-xs text-gray-500">La utilidad se estima diariamente sobre el saldo de esta cuenta.</p>
                        </div>
                    )}

                    {type === AccountType.CREDIT_CARD && (
                        <div className="space-y-4 rounded-lg border border-gray-700 bg-gray-800/50 p-4">
                            <div>
                                <label htmlFor="credit-limit" className="mb-2 block text-sm font-medium text-gray-400">Cupo total</label>
                                <input id="credit-limit" type="number" min="0.01" step="0.01" value={creditLimit} onChange={event => setCreditLimit(event.target.value)} placeholder="5000000" className="w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-3 text-white outline-none focus:ring-2 focus:ring-rodez-red" required />
                            </div>
                            <div>
                                <label htmlFor="credit-available" className="mb-2 block text-sm font-medium text-gray-400">Saldo disponible</label>
                                <input id="credit-available" type="number" min="0" step="0.01" max={creditLimit || undefined} value={creditAvailable} onChange={event => setCreditAvailable(event.target.value)} placeholder={creditLimit || '5000000'} className="w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-3 text-white outline-none focus:ring-2 focus:ring-rodez-red" required />
                                <p className="mt-1 text-xs text-gray-500">La diferencia entre el cupo total y el disponible será la deuda inicial.</p>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label htmlFor="credit-cutoff-day" className="mb-2 block text-sm font-medium text-gray-400">Día de corte</label>
                                    <input id="credit-cutoff-day" type="number" min="1" max="31" step="1" value={creditCutoffDay} onChange={event => setCreditCutoffDay(event.target.value)} placeholder="20" className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-3 text-white outline-none focus:ring-2 focus:ring-rodez-red" required />
                                </div>
                                <div>
                                    <label htmlFor="credit-payment-day" className="mb-2 block text-sm font-medium text-gray-400">Día límite de pago</label>
                                    <input id="credit-payment-day" type="number" min="1" max="31" step="1" value={creditPaymentDueDay} onChange={event => setCreditPaymentDueDay(event.target.value)} placeholder="5" className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-3 text-white outline-none focus:ring-2 focus:ring-rodez-red" required />
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Currency */}
                    <div>
                        <label className="block text-sm font-medium text-gray-400 mb-2">Moneda</label>
                        <select
                            value={currency}
                            onChange={(e) => setCurrency(e.target.value)}
                            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-rodez-red focus:border-transparent outline-none transition-all"
                        >
                            <option value="COP">COP ($)</option>
                            <option value="USD">USD ($)</option>
                            <option value="EUR">EUR (€)</option>
                            <option value="MXN">MXN ($)</option>
                        </select>
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
