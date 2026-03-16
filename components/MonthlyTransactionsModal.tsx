import React, { useEffect, useState } from 'react';
import { Transaction, TransactionType } from '../types';
import { getTransactionsByMonth } from '../services/budgetService';
import { useAuth } from '../hooks/useAuth';
import { X, ChevronLeft, ChevronRight, TrendingUp, TrendingDown, Calendar, DollarSign, ArrowUpRight, ArrowDownRight } from 'lucide-react';

interface MonthlyTransactionsModalProps {
    isOpen: boolean;
    onClose: () => void;
    initialType: TransactionType; // INCOME or EXPENSE
}

export const MonthlyTransactionsModal: React.FC<MonthlyTransactionsModalProps> = ({ isOpen, onClose, initialType }) => {
    const { user } = useAuth();
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [loading, setLoading] = useState(false);
    const [activeType, setActiveType] = useState<TransactionType>(initialType);

    useEffect(() => {
        if (isOpen) {
            setActiveType(initialType);
            loadTransactions();
        }
    }, [isOpen, currentMonth, initialType]);

    // Reload when activeType changes manually by user (if we allow switching tabs inside modal)
    useEffect(() => {
        if (isOpen) {
            loadTransactions();
        }
    }, [activeType]);

    const loadTransactions = async () => {
        if (!user) return;
        setLoading(true);
        try {
            const monthStr = currentMonth.toISOString().slice(0, 7); // YYYY-MM
            const allTransactions = await getTransactionsByMonth(monthStr, user.uid);

            // Filter by active type
            const filtered = allTransactions.filter(t => t.type === activeType);
            setTransactions(filtered);
        } catch (error) {
            console.error('Error loading transactions:', error);
        } finally {
            setLoading(false);
        }
    };

    const handlePrevMonth = () => {
        const newDate = new Date(currentMonth);
        newDate.setMonth(newDate.getMonth() - 1);
        setCurrentMonth(newDate);
    };

    const handleNextMonth = () => {
        const newDate = new Date(currentMonth);
        newDate.setMonth(newDate.getMonth() + 1);
        setCurrentMonth(newDate);
    };

    const formatMonth = (date: Date) => {
        return date.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
    };

    const totalAmount = transactions.reduce((sum, t) => sum + t.amount, 0);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-gray-950 border border-gray-800 rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl">
                {/* Header */}
                <div className="p-6 border-b border-gray-800 flex justify-between items-start">
                    <div>
                        <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                            {activeType === TransactionType.INCOME ? (
                                <ArrowUpRight className="text-green-400 w-6 h-6" />
                            ) : (
                                <ArrowDownRight className="text-red-400 w-6 h-6" />
                            )}
                            {activeType === TransactionType.INCOME ? 'Ingresos Mensuales' : 'Gastos Mensuales'}
                        </h2>
                        <p className="text-gray-400 text-sm mt-1">Detalle de movimientos por mes</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-gray-800 rounded-full text-gray-400 hover:text-white transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Month Selector */}
                <div className="bg-gray-900/50 p-4 flex items-center justify-between border-b border-gray-800">
                    <button
                        onClick={handlePrevMonth}
                        className="p-2 hover:bg-gray-800 rounded-full text-gray-400 hover:text-white transition-colors"
                    >
                        <ChevronLeft size={24} />
                    </button>

                    <div className="flex flex-col items-center">
                        <span className="text-lg font-bold text-white capitalize">{formatMonth(currentMonth)}</span>
                        <span className="text-xs text-gray-500 font-mono">
                            {currentMonth.toISOString().slice(0, 7)}
                        </span>
                    </div>

                    <button
                        onClick={handleNextMonth}
                        className="p-2 hover:bg-gray-800 rounded-full text-gray-400 hover:text-white transition-colors"
                    >
                        <ChevronRight size={24} />
                    </button>
                </div>

                {/* Summary Card for Selected Month */}
                <div className="p-6 bg-gray-900/30 border-b border-gray-800">
                    <div className="flex justify-between items-center">
                        <span className="text-gray-400 text-sm uppercase tracking-wider">Total {activeType === TransactionType.INCOME ? 'Ingresos' : 'Gastos'}</span>
                        <span className={`text-3xl font-bold font-mono ${activeType === TransactionType.INCOME ? 'text-green-400' : 'text-red-400'}`}>
                            {activeType === TransactionType.INCOME ? '+' : '-'}${totalAmount.toLocaleString()}
                        </span>
                    </div>
                </div>

                {/* Transactions List */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                    {loading ? (
                        <div className="flex justify-center py-10">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-rodez-red"></div>
                        </div>
                    ) : transactions.length > 0 ? (
                        transactions.map((t) => (
                            <div key={t.id} className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex items-center justify-between hover:bg-gray-800/50 transition-colors group">
                                <div className="flex items-center space-x-4">
                                    <div className={`p-3 rounded-full ${t.type === TransactionType.INCOME ? 'bg-green-900/20 text-green-400' : 'bg-red-900/20 text-red-400'}`}>
                                        {t.type === TransactionType.INCOME ? <TrendingUp size={18} /> : <TrendingDown size={18} />}
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-white group-hover:text-rodez-red transition-colors">{t.description}</h3>
                                        <div className="flex items-center text-sm text-gray-500 space-x-2">
                                            <span className="flex items-center">
                                                <Calendar className="w-3 h-3 mr-1" />
                                                {new Date(t.date).toLocaleDateString()}
                                            </span>
                                            <span>•</span>
                                            <span className="bg-gray-800 px-2 py-0.5 rounded text-xs text-gray-300">
                                                {t.categoryName || 'Sin categoría'}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                                <div className={`text-lg font-bold font-mono ${t.type === TransactionType.INCOME ? 'text-green-400' : 'text-red-400'}`}>
                                    {t.type === TransactionType.INCOME ? '+' : '-'}${t.amount.toLocaleString()}
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="text-center py-12 opacity-40">
                            <DollarSign className="w-16 h-16 mx-auto mb-4 text-gray-600" />
                            <p className="text-lg text-gray-400">No hay registros para este mes</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
