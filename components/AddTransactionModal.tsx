import React, { useState, useEffect } from 'react';
import { X, TrendingUp, TrendingDown, ArrowRightLeft, Calendar, AlertCircle } from 'lucide-react';
import { TransactionType, Transaction, Account, Category, BudgetBucket } from '../types';
import { getCategories } from '../services/budgetService';
import { useAuth } from '../hooks/useAuth';

interface AddTransactionModalProps {
    accounts: Account[];
    onClose: () => void;
    onSave: (transaction: Omit<Transaction, 'id' | 'createdAt'>) => Promise<void>;
    existingInvestments?: string[];
}

export const AddTransactionModal: React.FC<AddTransactionModalProps> = ({ accounts, onClose, onSave, existingInvestments = [] }) => {
    const { user } = useAuth();
    const [type, setType] = useState<TransactionType>(TransactionType.EXPENSE);
    const [amount, setAmount] = useState('');
    const [description, setDescription] = useState('');

    // Category State
    const [categories, setCategories] = useState<Category[]>([]);
    const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');
    const [selectedSubcategoryId, setSelectedSubcategoryId] = useState<string>('');

    const [accountId, setAccountId] = useState(accounts[0]?.id || '');
    const [toAccountId, setToAccountId] = useState(accounts.length > 1 ? accounts[1].id : '');
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);

    // Pending Bills State
    const [isPending, setIsPending] = useState(false);
    const [dueDate, setDueDate] = useState('');
    const [bucketId, setBucketId] = useState<BudgetBucket>(BudgetBucket.ESSENTIAL);

    // Investment/Asset Tracking State
    const [isInvestmentReturn, setIsInvestmentReturn] = useState(false);
    const [investmentName, setInvestmentName] = useState('');
    const [isNewInvestment, setIsNewInvestment] = useState(false);

    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (user) {
            loadCategories();
        }
    }, [user]);

    const loadCategories = async () => {
        if (!user) return;
        try {
            const data = await getCategories(user.uid);
            setCategories(data);
        } catch (error) {
            console.error('Error loading categories:', error);
        }
    };

    // Filter categories by transaction type
    const availableCategories = categories.filter(c => c.type === type);

    // Get selected category object
    const selectedCategory = categories.find(c => c.id === selectedCategoryId);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!amount || !description || !accountId) return;

        try {
            setLoading(true);

            const transactionData: Omit<Transaction, 'id' | 'createdAt'> = {
                type,
                amount: parseFloat(amount),
                description,
                accountId,
                toAccountId: type === TransactionType.TRANSFER ? toAccountId : undefined,
                date: new Date(date).getTime(),
                categoryId: type !== TransactionType.TRANSFER && selectedCategoryId ? selectedCategoryId : undefined,
                subcategoryId: type !== TransactionType.TRANSFER && selectedSubcategoryId ? selectedSubcategoryId : undefined,
                categoryName: selectedCategory?.name, // For legacy/display support
                isPending: type === TransactionType.EXPENSE ? isPending : false,
                dueDate: isPending && dueDate ? new Date(dueDate).getTime() : undefined,
                isPaid: false,
                bucketId: type === TransactionType.EXPENSE ? bucketId : (isInvestmentReturn ? BudgetBucket.INVESTMENT : undefined),
                investmentName: investmentName.trim() || undefined,
                isInvestmentReturn: type === TransactionType.INCOME ? isInvestmentReturn : false
            };

            await onSave(transactionData);
            onClose();
        } catch (error) {
            console.error('Error saving transaction:', error);
            alert('Error al guardar la transacción. Por favor intenta de nuevo.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
            <div className="bg-gray-900 border border-gray-800 rounded-xl w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto">
                <div className="flex justify-between items-center p-6 border-b border-gray-800 sticky top-0 bg-gray-900 z-10">
                    <h2 className="text-xl font-bold text-white">Nueva Transacción</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-6">
                    {/* Transaction Type */}
                    <div className="flex bg-gray-800 p-1 rounded-lg">
                        {[
                            { type: TransactionType.INCOME, icon: TrendingUp, label: 'Ingreso', color: 'text-green-400' },
                            { type: TransactionType.EXPENSE, icon: TrendingDown, label: 'Gasto', color: 'text-red-400' },
                            { type: TransactionType.TRANSFER, icon: ArrowRightLeft, label: 'Transferencia', color: 'text-blue-400' },
                        ].map((item) => (
                            <button
                                key={item.type}
                                type="button"
                                onClick={() => {
                                    setType(item.type);
                                    setSelectedCategoryId('');
                                    setSelectedSubcategoryId('');
                                }}
                                className={`flex-1 flex items-center justify-center space-x-2 py-2 rounded-md transition-all ${type === item.type ? 'bg-gray-700 shadow-sm' : 'hover:bg-gray-700/50'
                                    }`}
                            >
                                <item.icon className={`w-4 h-4 ${item.color}`} />
                                <span className={`text-sm font-medium ${type === item.type ? 'text-white' : 'text-gray-400'}`}>
                                    {item.label}
                                </span>
                            </button>
                        ))}
                    </div>

                    {/* Amount */}
                    <div>
                        <label className="block text-sm font-medium text-gray-400 mb-2">Monto</label>
                        <div className="relative">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">$</span>
                            <input
                                type="number"
                                value={amount}
                                onChange={(e) => setAmount(e.target.value)}
                                placeholder="0.00"
                                step="0.01"
                                className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-8 pr-4 py-3 text-white focus:ring-2 focus:ring-rodez-red focus:border-transparent outline-none transition-all text-lg font-bold"
                                required
                            />
                        </div>
                    </div>

                    {/* Description */}
                    <div>
                        <label className="block text-sm font-medium text-gray-400 mb-2">Descripción</label>
                        <input
                            type="text"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder={type === TransactionType.INCOME ? "Ej. Salario" : "Ej. Supermercado"}
                            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-rodez-red focus:border-transparent outline-none transition-all"
                            required
                        />
                    </div>

                    {/* Investment Return Checkbox (Only for Income) */}
                    {type === TransactionType.INCOME && (
                        <div className="bg-gray-800/50 p-4 rounded-lg border border-gray-700">
                            <div className="flex items-center space-x-3">
                                <input
                                    type="checkbox"
                                    id="isReturn"
                                    checked={isInvestmentReturn}
                                    onChange={(e) => setIsInvestmentReturn(e.target.checked)}
                                    className="w-5 h-5 rounded border-gray-600 text-green-500 focus:ring-green-500 bg-gray-700"
                                />
                                <label htmlFor="isReturn" className="text-sm font-medium text-white flex items-center cursor-pointer">
                                    <TrendingUp className="w-4 h-4 mr-2 text-green-400" />
                                    Es Retorno de Inversión
                                </label>
                            </div>
                        </div>
                    )}

                    {/* Investment Name (For returns OR Investment bucket) */}
                    {(isInvestmentReturn || (type === TransactionType.EXPENSE && bucketId === BudgetBucket.INVESTMENT)) && (
                        <div className="animate-in fade-in slide-in-from-top-2 duration-200 space-y-3">
                            <div>
                                <label className="block text-sm font-medium text-gray-400 mb-2">Seleccionar Inversión / Activo</label>
                                <select
                                    value={isNewInvestment ? 'NEW' : investmentName}
                                    onChange={(e) => {
                                        if (e.target.value === 'NEW') {
                                            setIsNewInvestment(true);
                                            setInvestmentName('');
                                        } else {
                                            setIsNewInvestment(false);
                                            setInvestmentName(e.target.value);
                                        }
                                    }}
                                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-rodez-red focus:border-transparent outline-none transition-all"
                                    required
                                >
                                    <option value="" disabled>Selecciona una opción</option>
                                    <option value="NEW">+ Nueva Inversión...</option>
                                    {existingInvestments.map(inv => (
                                        <option key={inv} value={inv}>{inv}</option>
                                    ))}
                                </select>
                            </div>

                            {isNewInvestment && (
                                <div className="animate-in slide-in-from-left-2 duration-200">
                                    <label className="block text-xs font-medium text-rodez-red uppercase tracking-wider mb-2">Nombre de la Nueva Inversión</label>
                                    <input
                                        type="text"
                                        value={investmentName}
                                        onChange={(e) => setInvestmentName(e.target.value)}
                                        placeholder="Ej: Trading, Apartamento, Bitcoin"
                                        className="w-full bg-gray-800 border-2 border-rodez-red/30 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-rodez-red focus:border-transparent outline-none transition-all"
                                        required
                                    />
                                </div>
                            )}
                        </div>
                    )}

                    {/* Category Selection (Not for Transfer) */}
                    {type !== TransactionType.TRANSFER && (
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-400 mb-2">Categoría (Opcional)</label>
                                <select
                                    value={selectedCategoryId}
                                    onChange={(e) => {
                                        setSelectedCategoryId(e.target.value);
                                        setSelectedSubcategoryId('');
                                    }}
                                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-rodez-red focus:border-transparent outline-none transition-all"
                                >
                                    <option value="">Sin categoría</option>
                                    {availableCategories.map((cat) => (
                                        <option key={cat.id} value={cat.id}>{cat.name}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-400 mb-2">Subcategoría</label>
                                <select
                                    value={selectedSubcategoryId}
                                    onChange={(e) => setSelectedSubcategoryId(e.target.value)}
                                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-rodez-red focus:border-transparent outline-none transition-all"
                                    disabled={!selectedCategoryId || !selectedCategory?.subcategories?.length}
                                >
                                    <option value="">Opcional</option>
                                    {selectedCategory?.subcategories?.map((sub) => (
                                        <option key={sub.id} value={sub.id}>{sub.name}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    )}

                    {/* Bucket Selection (Only for Expense) */}
                    {type === TransactionType.EXPENSE && (
                        <div>
                            <label className="block text-sm font-medium text-gray-400 mb-2">Distribución (Cubeta)</label>
                            <div className="grid grid-cols-2 gap-2">
                                {[
                                    { id: BudgetBucket.ESSENTIAL, label: 'Esencial (50%)' },
                                    { id: BudgetBucket.INVESTMENT, label: 'Inversión (25%)' },
                                    { id: BudgetBucket.STABILITY, label: 'Estabilidad (15%)' },
                                    { id: BudgetBucket.REWARDS, label: 'Recompensas (10%)' },
                                ].map((b) => (
                                    <button
                                        key={b.id}
                                        type="button"
                                        onClick={() => setBucketId(b.id)}
                                        className={`px-3 py-2 rounded-lg border text-xs font-medium transition-all ${bucketId === b.id
                                            ? 'bg-rodez-red border-rodez-red text-white'
                                            : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-600'
                                            }`}
                                    >
                                        {b.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Pending Bill Option (Only for Expense) */}
                    {type === TransactionType.EXPENSE && (
                        <div className="bg-gray-800/50 p-4 rounded-lg border border-gray-700">
                            <div className="flex items-center space-x-3 mb-3">
                                <input
                                    type="checkbox"
                                    id="isPending"
                                    checked={isPending}
                                    onChange={(e) => setIsPending(e.target.checked)}
                                    className="w-5 h-5 rounded border-gray-600 text-rodez-red focus:ring-rodez-red bg-gray-700"
                                />
                                <label htmlFor="isPending" className="text-sm font-medium text-white flex items-center cursor-pointer">
                                    <AlertCircle className="w-4 h-4 mr-2 text-yellow-500" />
                                    Pendiente de Pago (Factura)
                                </label>
                            </div>

                            {isPending && (
                                <div>
                                    <label className="block text-xs text-gray-400 mb-1">Fecha de Vencimiento</label>
                                    <input
                                        type="date"
                                        value={dueDate}
                                        onChange={(e) => setDueDate(e.target.value)}
                                        className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-rodez-red"
                                        required={isPending}
                                    />
                                </div>
                            )}
                        </div>
                    )}

                    {/* Accounts */}
                    <div className="grid grid-cols-1 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-400 mb-2">
                                {type === TransactionType.TRANSFER ? 'Desde Cuenta' : 'Cuenta'}
                            </label>
                            <select
                                value={accountId}
                                onChange={(e) => setAccountId(e.target.value)}
                                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-rodez-red focus:border-transparent outline-none transition-all"
                                required
                            >
                                {accounts.map((acc) => (
                                    <option key={acc.id} value={acc.id}>{acc.name} (${acc.balance})</option>
                                ))}
                            </select>
                        </div>

                        {type === TransactionType.TRANSFER && (
                            <div>
                                <label className="block text-sm font-medium text-gray-400 mb-2">Hacia Cuenta</label>
                                <select
                                    value={toAccountId}
                                    onChange={(e) => setToAccountId(e.target.value)}
                                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-rodez-red focus:border-transparent outline-none transition-all"
                                    required
                                >
                                    {accounts.filter(a => a.id !== accountId).map((acc) => (
                                        <option key={acc.id} value={acc.id}>{acc.name} (${acc.balance})</option>
                                    ))}
                                </select>
                            </div>
                        )}
                    </div>

                    {/* Date */}
                    <div>
                        <label className="block text-sm font-medium text-gray-400 mb-2">Fecha</label>
                        <input
                            type="date"
                            value={date}
                            onChange={(e) => setDate(e.target.value)}
                            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-rodez-red focus:border-transparent outline-none transition-all"
                            required
                        />
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
                            className={`flex-1 px-4 py-3 text-white rounded-lg transition-colors font-medium flex items-center justify-center ${type === TransactionType.INCOME ? 'bg-green-600 hover:bg-green-700' :
                                type === TransactionType.EXPENSE ? 'bg-red-600 hover:bg-red-700' :
                                    'bg-blue-600 hover:bg-blue-700'
                                }`}
                        >
                            {loading ? (
                                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                            ) : (
                                'Guardar'
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
