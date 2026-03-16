import React, { useState, useEffect } from 'react';
import {
    Account,
    Transaction,
    FinancialSummary,
    AccountType,
    TransactionType,
    BudgetBucket
} from '../types';
import {
    getAllAccounts,
    createAccount,
    getAllTransactions,
    createTransaction,
    getFinancialSummary
} from '../services/budgetService';
import { useAuth } from '../hooks/useAuth';
import { AddAccountModal } from './AddAccountModal';
import { AddTransactionModal } from './AddTransactionModal';
import { CategoriesView } from './CategoriesView';
import { BillsView } from './BillsView';
import { MonthlyTransactionsModal } from './MonthlyTransactionsModal';
import {
    Wallet,
    TrendingUp,
    TrendingDown,
    PiggyBank,
    CreditCard,
    Plus,
    DollarSign,
    Calendar,
    ArrowUpRight,
    ArrowDownRight,
    ArrowLeft,
    List,
    FileText,
    X
} from 'lucide-react';

interface BudgetViewProps { }

type Tab = 'ACCOUNTS' | 'CATEGORIES' | 'BILLS';

export const BudgetView: React.FC<BudgetViewProps> = () => {
    const { user } = useAuth();
    const [activeTab, setActiveTab] = useState<Tab>('ACCOUNTS');
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [summary, setSummary] = useState<FinancialSummary | null>(null);
    const [loading, setLoading] = useState(true);
    const [showAddAccount, setShowAddAccount] = useState(false);
    const [showAddTransaction, setShowAddTransaction] = useState(false);
    const [showMonthlyModal, setShowMonthlyModal] = useState(false);
    const [monthlyModalType, setMonthlyModalType] = useState<TransactionType>(TransactionType.INCOME);
    const [selectedBucket, setSelectedBucket] = useState<BudgetBucket | null>(null);
    const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
    const [showInvestmentModal, setShowInvestmentModal] = useState(false);
    const [showBucketDetailModal, setShowBucketDetailModal] = useState(false);
    const [selectedAssetForHistory, setSelectedAssetForHistory] = useState<string | null>(null);

    // Load data
    useEffect(() => {
        if (user && activeTab === 'ACCOUNTS') {
            loadData();
        }
    }, [user, activeTab, selectedMonth]);

    const loadData = async () => {
        if (!user) return;
        try {
            setLoading(true);
            const [accountsData, transactionsData, summaryData] = await Promise.all([
                getAllAccounts(user.uid),
                getAllTransactions(user.uid),
                getFinancialSummary(user.uid, selectedMonth),
            ]);

            setAccounts(accountsData);
            setTransactions(transactionsData);
            setSummary(summaryData);
        } catch (error) {
            console.error('Error loading budget data:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleAddAccount = async (accountData: Omit<Account, 'id' | 'createdAt'>) => {
        if (!user) return;
        try {
            await createAccount(accountData, user.uid);
            await loadData();
            setShowAddAccount(false);
        } catch (error) {
            console.error('Error adding account:', error);
            alert('Error al crear la cuenta');
        }
    };

    const handleAddTransaction = async (transactionData: Omit<Transaction, 'id' | 'createdAt'>) => {
        if (!user) return;
        try {
            await createTransaction(transactionData, user.uid);
            await loadData();
            setShowAddTransaction(false);
        } catch (error) {
            console.error('Error adding transaction:', error);
            alert('Error al crear la transacción');
        }
    };

    const getAccountIcon = (type: AccountType) => {
        switch (type) {
            case AccountType.CASH:
                return <Wallet className="w-5 h-5" />;
            case AccountType.BANK:
                return <CreditCard className="w-5 h-5" />;
            case AccountType.SAVINGS:
                return <PiggyBank className="w-5 h-5" />;
            case AccountType.CREDIT_CARD:
                return <CreditCard className="w-5 h-5" />;
            default:
                return <DollarSign className="w-5 h-5" />;
        }
    };

    const getAccountTypeName = (type: AccountType) => {
        switch (type) {
            case AccountType.CASH:
                return 'Efectivo';
            case AccountType.BANK:
                return 'Banco';
            case AccountType.SAVINGS:
                return 'Ahorros';
            case AccountType.CREDIT_CARD:
                return 'Tarjeta de Crédito';
            default:
                return type;
        }
    };

    const renderAccountsTab = () => {
        const months = [
            'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
            'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
        ];

        if (loading) {
            return (
                <div className="flex items-center justify-center py-12">
                    <div className="text-gray-400">Cargando...</div>
                </div>
            );
        }

        const bucketInfo = [
            { id: BudgetBucket.ESSENTIAL, label: 'Gastos Esenciales', pct: 50, color: 'from-blue-900/40 to-blue-800/20 border-blue-700/30', icon: <DollarSign className="w-5 h-5 text-blue-400" /> },
            { id: BudgetBucket.INVESTMENT, label: 'Inversión', pct: 25, color: 'from-green-900/40 to-green-800/20 border-green-700/30', icon: <TrendingUp className="w-5 h-5 text-green-400" /> },
            { id: BudgetBucket.STABILITY, label: 'Fondo Estabilidad', pct: 15, color: 'from-purple-900/40 to-purple-800/20 border-purple-700/30', icon: <PiggyBank className="w-5 h-5 text-purple-400" /> },
            { id: BudgetBucket.REWARDS, label: 'Recompensas', pct: 10, color: 'from-pink-900/40 to-pink-800/20 border-pink-700/30', icon: <DollarSign className="w-5 h-5 text-pink-400" /> },
        ];

        return (
            <div className="space-y-6">
                {/* Month Selector & Main Actions */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center space-x-3 bg-gray-900 border border-gray-800 rounded-xl px-4 py-2 w-fit">
                        <Calendar className="w-5 h-5 text-rodez-red" />
                        <input
                            type="month"
                            value={selectedMonth}
                            onChange={(e) => setSelectedMonth(e.target.value)}
                            className="bg-transparent text-white border-none focus:ring-0 font-bold"
                        />
                    </div>
                </div>

                {/* Bucket Dashboard */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                    {bucketInfo.map((bucket) => {
                        const balance = summary?.bucketBalances?.[bucket.id] || 0;
                        return (
                            <div
                                key={bucket.id}
                                onClick={() => {
                                    setSelectedBucket(bucket.id);
                                    if (bucket.id === BudgetBucket.INVESTMENT) {
                                        setShowInvestmentModal(true);
                                    } else {
                                        setShowBucketDetailModal(true);
                                    }
                                }}
                                className={`bg-gradient-to-br ${bucket.color} border rounded-xl p-4 md:p-5 transition-all hover:scale-[1.02] cursor-pointer hover:border-white/20`}
                            >
                                <div className="flex items-center justify-between mb-3 text-white/70">
                                    <span className="text-xs font-bold uppercase tracking-wider">{bucket.label} ({bucket.pct}%)</span>
                                    {bucket.icon}
                                </div>
                                <div className="text-2xl font-bold text-white mb-1">
                                    ${balance.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                                </div>
                                <div className="text-[10px] text-white/40 flex items-center">
                                    <List className="w-3 h-3 mr-1" />
                                    Gestionado por cubeta
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Financial Summary */}
                {summary && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        {/* Total Balance */}
                        <div className="bg-gradient-to-br from-blue-900/50 to-blue-800/30 border border-blue-700/50 rounded-xl p-6">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-blue-300 text-sm font-medium">Balance Total</span>
                                <DollarSign className="w-5 h-5 text-blue-400" />
                            </div>
                            <div className="text-3xl font-bold text-white">
                                ${summary.totalBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </div>
                        </div>

                        {/* Monthly Income */}
                        <div
                            onClick={() => {
                                setMonthlyModalType(TransactionType.INCOME);
                                setShowMonthlyModal(true);
                            }}
                            className="bg-gradient-to-br from-green-900/50 to-green-800/30 border border-green-700/50 rounded-xl p-6 cursor-pointer hover:border-green-500 transition-all group relative overflow-hidden"
                        >
                            <div className="absolute inset-0 bg-green-500/5 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                            <div className="flex items-center justify-between mb-2 relative z-10">
                                <span className="text-green-300 text-sm font-medium group-hover:text-green-200">Ingresos del Mes</span>
                                <ArrowUpRight className="w-5 h-5 text-green-400 group-hover:scale-110 transition-transform" />
                            </div>
                            <div className="text-3xl font-bold text-white relative z-10">
                                +${summary.monthlyIncome.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </div>
                            <div className="text-xs text-green-400/70 mt-2 flex items-center relative z-10">
                                <Calendar className="w-3 h-3 mr-1" />
                                Ver detalle mensual
                            </div>
                        </div>

                        {/* Monthly Expenses */}
                        <div
                            onClick={() => {
                                setMonthlyModalType(TransactionType.EXPENSE);
                                setShowMonthlyModal(true);
                            }}
                            className="bg-gradient-to-br from-red-900/50 to-red-800/30 border border-red-700/50 rounded-xl p-6 cursor-pointer hover:border-red-500 transition-all group relative overflow-hidden"
                        >
                            <div className="absolute inset-0 bg-red-500/5 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                            <div className="flex items-center justify-between mb-2 relative z-10">
                                <span className="text-red-300 text-sm font-medium group-hover:text-red-200">Gastos del Mes</span>
                                <ArrowDownRight className="w-5 h-5 text-red-400 group-hover:scale-110 transition-transform" />
                            </div>
                            <div className="text-3xl font-bold text-white relative z-10">
                                -${summary.monthlyExpenses.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </div>
                            <div className="text-xs text-red-400/70 mt-2 flex items-center relative z-10">
                                <Calendar className="w-3 h-3 mr-1" />
                                Ver detalle mensual
                            </div>
                        </div>

                        {/* Net Balance */}
                        <div className={`bg-gradient-to-br ${summary.netBalance >= 0 ? 'from-purple-900/50 to-purple-800/30 border-purple-700/50' : 'from-orange-900/50 to-orange-800/30 border-orange-700/50'} border rounded-xl p-6`}>
                            <div className="flex items-center justify-between mb-2">
                                <span className={`${summary.netBalance >= 0 ? 'text-purple-300' : 'text-orange-300'} text-sm font-medium`}>
                                    Balance Neto
                                </span>
                                <TrendingUp className={`w-5 h-5 ${summary.netBalance >= 0 ? 'text-purple-400' : 'text-orange-400'}`} />
                            </div>
                            <div className="text-3xl font-bold text-white">
                                {summary.netBalance >= 0 ? '+' : ''}${summary.netBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </div>
                        </div>
                    </div>
                )}

                {/* Accounts */}
                <div>
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-xl font-bold text-white">Cuentas</h2>
                        <button
                            onClick={() => setShowAddAccount(true)}
                            className="text-sm text-rodez-red hover:text-blue-400 transition-colors"
                        >
                            + Agregar Cuenta
                        </button>
                    </div>

                    {accounts.length === 0 ? (
                        <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 text-center">
                            <Wallet className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                            <p className="text-gray-400">No tienes cuentas registradas</p>
                            <button
                                onClick={() => setShowAddAccount(true)}
                                className="mt-4 px-4 py-2 bg-rodez-red hover:bg-blue-600 text-white rounded-lg transition-colors"
                            >
                                Crear Primera Cuenta
                            </button>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {accounts.map(account => (
                                <div
                                    key={account.id}
                                    className="bg-gray-900 border border-gray-800 hover:border-gray-700 rounded-xl p-6 transition-all"
                                >
                                    <div className="flex items-center justify-between mb-4">
                                        <div className="flex items-center space-x-3">
                                            <div className={`p-2 rounded-lg ${account.color || 'bg-gray-800'}`}>
                                                {getAccountIcon(account.type)}
                                            </div>
                                            <div>
                                                <h3 className="font-semibold text-white">{account.name}</h3>
                                                <p className="text-xs text-gray-500">{getAccountTypeName(account.type)}</p>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="text-2xl font-bold text-white">
                                        ${account.balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </div>
                                    <div className="text-xs text-gray-500 mt-1">{account.currency}</div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>


            </div>
        );
    };

    return (
        <div className="h-full overflow-y-auto bg-gray-950 p-4 md:p-6">
            <div className="max-w-7xl mx-auto space-y-6">
                {/* Header */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                        <h1 className="text-3xl font-bold text-white">Presupuesto</h1>
                        <p className="text-gray-400 mt-1">Gestión de finanzas personales</p>
                    </div>
                    <div className="flex space-x-3 w-full md:w-auto">
                        {activeTab === 'ACCOUNTS' && (
                            <button
                                onClick={() => setShowAddTransaction(true)}
                                className="px-4 py-2 bg-rodez-red hover:bg-blue-600 text-white rounded-lg flex items-center justify-center space-x-2 transition-colors w-full md:w-auto"
                                disabled={accounts.length === 0}
                            >
                                <Plus className="w-4 h-4" />
                                <span>Nueva Transacción</span>
                            </button>
                        )}
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex space-x-1 bg-gray-900 p-1 rounded-lg w-full md:w-fit overflow-x-auto">
                    <button
                        onClick={() => setActiveTab('ACCOUNTS')}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center space-x-2 whitespace-nowrap ${activeTab === 'ACCOUNTS' ? 'bg-gray-800 text-white shadow-sm' : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
                            }`}
                    >
                        <Wallet className="w-4 h-4" />
                        <span>Cuentas</span>
                    </button>
                    <button
                        onClick={() => setActiveTab('CATEGORIES')}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center space-x-2 whitespace-nowrap ${activeTab === 'CATEGORIES' ? 'bg-gray-800 text-white shadow-sm' : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
                            }`}
                    >
                        <List className="w-4 h-4" />
                        <span>Categorías</span>
                    </button>
                    <button
                        onClick={() => setActiveTab('BILLS')}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center space-x-2 whitespace-nowrap ${activeTab === 'BILLS' ? 'bg-gray-800 text-white shadow-sm' : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
                            }`}
                    >
                        <FileText className="w-4 h-4" />
                        <span>Facturas</span>
                    </button>
                </div>

                {/* Content */}
                <div className="mt-6">
                    {activeTab === 'ACCOUNTS' && renderAccountsTab()}
                    {activeTab === 'CATEGORIES' && <CategoriesView />}
                    {activeTab === 'BILLS' && <BillsView accounts={accounts} onRefresh={loadData} />}
                </div>
            </div>

            {/* Modals */}
            {showAddAccount && (
                <AddAccountModal
                    onClose={() => setShowAddAccount(false)}
                    onSave={handleAddAccount}
                />
            )}

            {showAddTransaction && (
                <AddTransactionModal
                    accounts={accounts}
                    onClose={() => setShowAddTransaction(false)}
                    onSave={handleAddTransaction}
                    existingInvestments={Array.from(new Set(transactions
                        .filter(t => t.investmentName)
                        .map(t => t.investmentName as string)
                    ))}
                />
            )}

            <MonthlyTransactionsModal
                isOpen={showMonthlyModal}
                onClose={() => setShowMonthlyModal(false)}
                initialType={monthlyModalType}
            />

            {/* Investment Detail Modal/View Placeholder */}
            {showInvestmentModal && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
                    <div className="bg-gray-900 border border-gray-800 rounded-xl w-full max-w-2xl shadow-2xl max-h-[90vh] flex flex-col">
                        <div className="flex justify-between items-center p-6 border-b border-gray-800">
                            <div className="flex items-center space-x-4">
                                {selectedAssetForHistory && (
                                    <button
                                        onClick={() => setSelectedAssetForHistory(null)}
                                        className="p-2 hover:bg-gray-800 rounded-lg text-gray-400 hover:text-white transition-colors"
                                    >
                                        <ArrowLeft className="w-5 h-5" />
                                    </button>
                                )}
                                <div>
                                    <h2 className="text-xl font-bold text-white">
                                        {selectedAssetForHistory ? `Historial: ${selectedAssetForHistory}` : 'Resumen de Inversiones'}
                                    </h2>
                                    <p className="text-sm text-gray-400">
                                        {selectedAssetForHistory ? 'Movimientos detallados del activo' : 'Rendimiento por activo'}
                                    </p>
                                </div>
                            </div>
                            <button onClick={() => {
                                setShowInvestmentModal(false);
                                setSelectedAssetForHistory(null);
                            }} className="text-gray-400 hover:text-white transition-colors">
                                <X className="w-6 h-6" />
                            </button>
                        </div>

                        <div className="p-6 overflow-y-auto flex-1 bg-gray-950">
                            {selectedAssetForHistory ? (
                                /* Drill-down History View */
                                <div className="space-y-4">
                                    {transactions
                                        .filter(t => t.investmentName === selectedAssetForHistory)
                                        .sort((a, b) => b.date - a.date)
                                        .map(t => (
                                            <div key={t.id} className="flex items-center justify-between p-4 bg-gray-900 border border-gray-800 rounded-xl">
                                                <div className="flex items-center space-x-4">
                                                    <div className={`p-2 rounded-lg ${t.type === TransactionType.INCOME ? 'bg-green-500/10' : 'bg-red-500/10'}`}>
                                                        {t.type === TransactionType.INCOME ? <ArrowUpRight className="w-5 h-5 text-green-400" /> : <ArrowDownRight className="w-5 h-5 text-red-400" />}
                                                    </div>
                                                    <div>
                                                        <p className="font-bold text-white mb-0.5">{t.description}</p>
                                                        <div className="flex items-center space-x-2">
                                                            <span className="text-[10px] text-gray-500 uppercase font-bold">{new Date(t.date).toLocaleDateString()}</span>
                                                            {t.isInvestmentReturn && <span className="text-[10px] font-bold text-green-500 bg-green-500/10 px-1.5 py-0.5 rounded uppercase tracking-tighter">Retorno</span>}
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className={`text-lg font-black ${t.type === TransactionType.INCOME ? 'text-green-400' : 'text-white'}`}>
                                                    {t.type === TransactionType.INCOME ? '+' : '-'}${t.amount.toLocaleString()}
                                                </div>
                                            </div>
                                        ))}
                                </div>
                            ) : (
                                /* Main Dashboard View */
                                <div className="grid grid-cols-1 gap-6">
                                    {Object.entries(
                                        transactions
                                            .filter(t => {
                                                const isInvestment = t.bucketId === BudgetBucket.INVESTMENT || t.categoryName?.toLowerCase().includes('invers');
                                                if (!isInvestment) return false;

                                                // History view: Only show up to the selected month, or exactly selected month?
                                                // Usually history is all-time, but the user said "si quiero ver noviembre solo salga noviembre".
                                                // Let's stick to "up to selected month" for cumulative funds, or "selected month" if they want strict filtering.
                                                // Given "cada mes inicie en cero menos inversión", they probably want to see the performance AS OF that month.
                                                const tMonth = new Date(t.date).toISOString().slice(0, 7);
                                                return tMonth <= selectedMonth;
                                            })
                                            .reduce((acc, t) => {
                                                const name = t.investmentName || 'Otras Inversiones';
                                                if (!acc[name]) acc[name] = { name, cost: 0, returns: 0, count: 0, lastDate: 0, items: [] };
                                                if (t.type === TransactionType.EXPENSE) acc[name].cost += t.amount;
                                                if (t.type === TransactionType.INCOME) acc[name].returns += t.amount;
                                                acc[name].count++;
                                                acc[name].lastDate = Math.max(acc[name].lastDate, t.date);
                                                acc[name].items.push(t);
                                                return acc;
                                            }, {} as Record<string, { name: string, cost: number, returns: number, count: number, lastDate: number, items: Transaction[] }>)
                                    ).map(([name, stats]) => {
                                        const profit = stats.returns - stats.cost;
                                        const isProfitable = profit >= 0;
                                        return (
                                            <div
                                                key={name}
                                                onClick={() => setSelectedAssetForHistory(name)}
                                                className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden shadow-lg cursor-pointer hover:border-rodez-red/50 transition-all hover:scale-[1.01] active:scale-[0.99]"
                                            >
                                                <div className="p-5 border-b border-gray-800 flex justify-between items-center bg-gray-900/50">
                                                    <div>
                                                        <h3 className="text-lg font-bold text-white">{name}</h3>
                                                        <p className="text-xs text-gray-500">{stats.count} transacciones • Última: {new Date(stats.lastDate).toLocaleDateString()}</p>
                                                    </div>
                                                    <div className={`px-3 py-1 rounded-full text-xs font-bold ${isProfitable ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
                                                        {isProfitable ? 'EN GANANCIAS' : 'EN RECUPERACIÓN'}
                                                    </div>
                                                </div>

                                                <div className="p-5 grid grid-cols-3 gap-4 bg-gray-800/20">
                                                    <div>
                                                        <p className="text-[10px] text-gray-500 uppercase font-bold tracking-wider mb-1">Invertido</p>
                                                        <p className="text-lg font-bold text-white">${stats.cost.toLocaleString()}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-[10px] text-gray-500 uppercase font-bold tracking-wider mb-1">Retornos</p>
                                                        <p className="text-lg font-bold text-green-400">${stats.returns.toLocaleString()}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-[10px] text-gray-500 uppercase font-bold tracking-wider mb-1">Utilidad Neta</p>
                                                        <p className={`text-lg font-bold ${profit >= 0 ? 'text-green-500' : 'text-red-400'}`}>
                                                            {profit >= 0 ? '+' : ''}${profit.toLocaleString()}
                                                        </p>
                                                    </div>
                                                </div>

                                                {/* Mini Hint */}
                                                <div className="px-5 py-2 bg-gray-800/10 flex items-center justify-center space-x-2 text-[10px] text-gray-500 font-bold uppercase tracking-widest border-t border-gray-800/50">
                                                    <span>Ver Historial Detallado</span>
                                                    <ArrowUpRight className="w-3 h-3" />
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
            {/* Generic Bucket Detail Modal (Essential, Stability, Rewards) */}
            {showBucketDetailModal && selectedBucket && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
                    <div className="bg-gray-900 border border-gray-800 rounded-xl w-full max-w-2xl shadow-2xl max-h-[90vh] flex flex-col">
                        <div className="flex justify-between items-center p-6 border-b border-gray-800">
                            <div>
                                <h2 className="text-xl font-bold text-white">
                                    Historial: {
                                        selectedBucket === BudgetBucket.ESSENTIAL ? 'Gastos Esenciales' :
                                            selectedBucket === BudgetBucket.STABILITY ? 'Fondo de Estabilidad' :
                                                selectedBucket === BudgetBucket.REWARDS ? 'Recompensas' : 'Otros'
                                    }
                                </h2>
                                <p className="text-sm text-gray-400">
                                    {selectedBucket === BudgetBucket.ESSENTIAL ? 'Transacciones asignadas a tu cubeta del 50%' :
                                        selectedBucket === BudgetBucket.STABILITY ? 'Fondo acumulado para emergencias y estabilidad' :
                                            'Dinero destinado a ocio y recompensas personalizadas'}
                                </p>
                            </div>
                            <button onClick={() => setShowBucketDetailModal(false)} className="text-gray-400 hover:text-white transition-colors">
                                <X className="w-6 h-6" />
                            </button>
                        </div>

                        <div className="p-6 overflow-y-auto flex-1 bg-gray-950">
                            <div className="space-y-4">
                                {transactions
                                    .filter(t => {
                                        // Filter by bucket and selected month
                                        // Use date key or date object to get YYYY-MM
                                        const tDate = new Date(t.date);
                                        const tMonthKey = `${tDate.getFullYear()}-${String(tDate.getMonth() + 1).padStart(2, '0')}`;

                                        if (tMonthKey !== selectedMonth) return false;

                                        if (selectedBucket === BudgetBucket.ESSENTIAL) {
                                            // Essential includes explicit or default expenses
                                            return t.bucketId === BudgetBucket.ESSENTIAL || (!t.bucketId && t.type === TransactionType.EXPENSE);
                                        }

                                        return t.bucketId === selectedBucket;
                                    })
                                    .sort((a, b) => b.date - a.date)
                                    .map(t => (
                                        <div key={t.id} className="flex items-center justify-between p-4 bg-gray-900 border border-gray-800 rounded-xl">
                                            <div className="flex items-center space-x-4">
                                                <div className={`p-2 rounded-lg ${t.type === TransactionType.INCOME ? 'bg-green-500/10' : 'bg-blue-500/10'}`}>
                                                    {t.type === TransactionType.INCOME ? <ArrowUpRight className="w-5 h-5 text-green-400" /> : <ArrowDownRight className="w-5 h-5 text-blue-400" />}
                                                </div>
                                                <div>
                                                    <p className="font-bold text-white mb-0.5">{t.description}</p>
                                                    <div className="flex items-center space-x-2">
                                                        <span className="text-[10px] text-gray-500 uppercase font-bold">{new Date(t.date).toLocaleDateString()}</span>
                                                        <span className="text-[10px] text-gray-400">{t.categoryName || 'General'}</span>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className={`text-lg font-black ${t.type === TransactionType.INCOME ? 'text-green-400' : 'text-white'}`}>
                                                {t.type === TransactionType.INCOME ? '+' : '-'}${t.amount.toLocaleString()}
                                            </div>
                                        </div>
                                    ))}
                                {transactions.filter(t => {
                                    const tDate = new Date(t.date);
                                    const tMonthKey = `${tDate.getFullYear()}-${String(tDate.getMonth() + 1).padStart(2, '0')}`;
                                    if (tMonthKey !== selectedMonth) return false;

                                    if (selectedBucket === BudgetBucket.ESSENTIAL) {
                                        return t.bucketId === BudgetBucket.ESSENTIAL || (!t.bucketId && t.type === TransactionType.EXPENSE);
                                    }
                                    return t.bucketId === selectedBucket;
                                }).length === 0 && (
                                        <div className="text-center py-12 text-gray-500">No hay transacciones registradas en esta cubeta para el mes seleccionado.</div>
                                    )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
