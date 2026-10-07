import React, { useState, useEffect } from 'react';
import {
    Account,
    Transaction,
    FinancialSummary,
    AccountType,
    TransactionType,
    BudgetBucket,
    RecurringDebt,
    Category
} from '../types';
import {
    getAllAccounts,
    createAccount,
    getAllTransactions,
    createTransaction,
    getFinancialSummary,
    createRecurringDebt,
    ensureRecurringDebtBills,
    deleteRecurringDebt,
    getAllRecurringDebts,
    getCategories
} from '../services/budgetService';
import { useAuth } from '../hooks/useAuth';
import { AddAccountModal } from './AddAccountModal';
import { AddTransactionModal } from './AddTransactionModal';
import { CategoriesView } from './CategoriesView';
import { BillsView } from './BillsView';
import { InvestmentsView } from './InvestmentsView';
import { MonthlyTransactionsModal } from './MonthlyTransactionsModal';
import { calculateAccruedSavingsYield } from '../utils/savingsYield';
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
    List,
    FileText,
    X,
    Building2
} from 'lucide-react';

interface BudgetViewProps { }

type Tab = 'ACCOUNTS' | 'CATEGORIES' | 'BILLS' | 'INVESTMENTS';

export const BudgetView: React.FC<BudgetViewProps> = () => {
    const { user } = useAuth();
    const [activeTab, setActiveTab] = useState<Tab>('ACCOUNTS');
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [recurringDebts, setRecurringDebts] = useState<RecurringDebt[]>([]);
    const [yieldAsOf, setYieldAsOf] = useState(Date.now());
    const [summary, setSummary] = useState<FinancialSummary | null>(null);
    const [loading, setLoading] = useState(true);
    const [showAddAccount, setShowAddAccount] = useState(false);
    const [showAddTransaction, setShowAddTransaction] = useState(false);
    const [modalInitialBucket, setModalInitialBucket] = useState<BudgetBucket | undefined>(undefined);
    const [modalLockedBucket, setModalLockedBucket] = useState(false);
    const [modalInitialAccountId, setModalInitialAccountId] = useState<string | undefined>(undefined);
    const [modalInitialType, setModalInitialType] = useState<TransactionType | undefined>(undefined);
    const [modalAllowedTypes, setModalAllowedTypes] = useState<TransactionType[] | undefined>(undefined);
    const [modalInitialInvestmentName, setModalInitialInvestmentName] = useState<string | undefined>(undefined);
    const [showMonthlyModal, setShowMonthlyModal] = useState(false);
    const [monthlyModalType, setMonthlyModalType] = useState<TransactionType>(TransactionType.INCOME);
    const [selectedBucket, setSelectedBucket] = useState<BudgetBucket | null>(null);
    const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
    const [showBucketDetailModal, setShowBucketDetailModal] = useState(false);

    useEffect(() => {
        const timer = window.setInterval(() => setYieldAsOf(Date.now()), 60_000);
        return () => window.clearInterval(timer);
    }, []);

    // Load data
    useEffect(() => {
        if (user && (activeTab === 'ACCOUNTS' || activeTab === 'INVESTMENTS')) {
            loadData();
        }
    }, [user, activeTab, selectedMonth]);

    const loadData = async () => {
        if (!user) return;
        try {
            setLoading(true);
            const [accountsData, transactionsData, summaryData, debtData, categoriesData] = await Promise.all([
                getAllAccounts(user.uid),
                getAllTransactions(user.uid),
                getFinancialSummary(user.uid, selectedMonth),
                getAllRecurringDebts(user.uid),
                getCategories(user.uid),
            ]);

            setAccounts(accountsData);
            setTransactions(transactionsData);
            setSummary(summaryData);
            setRecurringDebts(debtData);
            setCategories(categoriesData);
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

    const handleAddTransaction = async (
        transactionData: Omit<Transaction, 'id' | 'createdAt'>,
        investmentDebt?: Omit<RecurringDebt, 'id' | 'createdAt'>
    ) => {
        if (!user) return;
        let createdDebtId: string | undefined;
        try {
            if (investmentDebt) {
                const debt = await createRecurringDebt(investmentDebt, user.uid);
                createdDebtId = debt.id;
                await ensureRecurringDebtBills(user.uid);
            }
            await createTransaction(transactionData, user.uid);
            await loadData();
            setShowAddTransaction(false);
        } catch (error) {
            if (createdDebtId) {
                try {
                    await deleteRecurringDebt(createdDebtId, user.uid);
                } catch (cleanupError) {
                    console.error('Error reverting linked investment debt:', cleanupError);
                }
            }
            console.error('Error adding transaction:', error);
            throw error;
        }
    };

    const openInvestmentContribution = (investmentName?: string) => {
        setModalInitialBucket(BudgetBucket.INVESTMENT);
        setModalLockedBucket(true);
        setModalInitialType(TransactionType.EXPENSE);
        setModalAllowedTypes([TransactionType.EXPENSE]);
        setModalInitialInvestmentName(investmentName);
        setShowAddTransaction(true);
    };

    const openInvestmentIncome = (investmentName: string) => {
        setModalInitialBucket(undefined);
        setModalLockedBucket(false);
        setModalInitialType(TransactionType.INCOME);
        setModalAllowedTypes([TransactionType.INCOME]);
        setModalInitialInvestmentName(investmentName);
        setShowAddTransaction(true);
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
                                    setModalInitialBucket(bucket.id);
                                    setModalLockedBucket(true);
                                    setShowAddTransaction(true);
                                }}
                                className={`bg-gradient-to-br ${bucket.color} border rounded-xl p-4 md:p-5 transition-all hover:scale-[1.02] cursor-pointer hover:border-white/30 group relative shadow-lg`}
                            >
                                <div className="flex items-center justify-between mb-3 text-white/70">
                                    <span className="text-xs font-bold uppercase tracking-wider">{bucket.label} ({bucket.pct}%)</span>
                                    {bucket.icon}
                                </div>
                                <div className="text-2xl font-bold text-white mb-2">
                                    ${balance.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                                </div>
                                <div className="flex items-center justify-between pt-2 border-t border-white/10 text-[11px]">
                                    <span className="text-white font-medium flex items-center group-hover:underline">
                                        <Plus className="w-3.5 h-3.5 mr-1 text-white" />
                                        Registrar Gasto
                                    </span>
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setSelectedBucket(bucket.id);
                                            if (bucket.id === BudgetBucket.INVESTMENT) {
                                                setActiveTab('INVESTMENTS');
                                            } else {
                                                setShowBucketDetailModal(true);
                                            }
                                        }}
                                        className="text-white/60 hover:text-white flex items-center hover:underline transition-colors px-1 py-0.5 rounded"
                                        title="Ver historial de movimientos"
                                    >
                                        <List className="w-3.5 h-3.5 mr-1" />
                                        Historial
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Financial Summary */}
                {summary && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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
                                    onClick={() => {
                                        setModalInitialAccountId(account.id);
                                        setModalInitialType(TransactionType.INCOME);
                                        setModalAllowedTypes([TransactionType.INCOME, TransactionType.TRANSFER]);
                                        setModalInitialBucket(undefined);
                                        setModalLockedBucket(false);
                                        setShowAddTransaction(true);
                                    }}
                                    className="bg-gray-900 border border-gray-800 hover:border-rodez-red/50 hover:bg-gray-900/80 rounded-xl p-5 md:p-6 transition-all cursor-pointer group shadow-lg hover:scale-[1.01]"
                                    title={`Click para registrar ${account.type === AccountType.CREDIT_CARD ? 'abono o transferencia' : 'ingreso o transferencia'} en ${account.name}`}
                                >
                                    <div className="flex items-center justify-between mb-4">
                                        <div className="flex items-center space-x-3">
                                            <div className={`p-2.5 rounded-xl ${account.color || 'bg-gray-800'} transition-transform group-hover:scale-105`}>
                                                {getAccountIcon(account.type)}
                                            </div>
                                            <div>
                                                <h3 className="font-bold text-white group-hover:text-rodez-red transition-colors">{account.name}</h3>
                                                <p className="text-xs text-gray-500">{getAccountTypeName(account.type)}</p>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="text-2xl font-bold text-white mb-1">
                                        {account.type === AccountType.CREDIT_CARD ? 'Deuda actual: ' : ''}${account.balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </div>
                                    {account.type === AccountType.CREDIT_CARD && (
                                        <div className="mb-3 space-y-1 text-xs">
                                            <p className="font-medium text-green-400">Disponible: ${(account.creditAvailable || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} / ${(account.creditLimit || 0).toLocaleString()}</p>
                                            <p className="text-gray-400">Corte: día {account.creditCutoffDay} · Pago: día {account.creditPaymentDueDay}</p>
                                        </div>
                                    )}
                                    {account.type === AccountType.SAVINGS && (account.savingsYieldRateAnnual || 0) > 0 && (
                                        <div className="mb-3 space-y-1 text-xs">
                                            <p className="text-gray-400">Tasa: {account.savingsYieldRateAnnual}% E.A.</p>
                                            <p className="font-medium text-green-400">
                                                Utilidad estimada: +${calculateAccruedSavingsYield(account, transactions, yieldAsOf).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </p>
                                        </div>
                                    )}
                                    <div className="flex items-center justify-between pt-3 border-t border-gray-800/80 text-[11px] text-gray-400">
                                        <span className="text-green-400 font-semibold flex items-center group-hover:underline">
                                            <Plus className="w-3.5 h-3.5 mr-1" />
                                            {account.type === AccountType.CREDIT_CARD ? 'Abonar / Transferir' : 'Ingreso / Transferir'}
                                        </span>
                                        <span className="text-gray-500 uppercase tracking-wider text-[10px] font-bold">{account.currency}</span>
                                    </div>
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
                    <button
                        onClick={() => setActiveTab('INVESTMENTS')}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center space-x-2 whitespace-nowrap ${activeTab === 'INVESTMENTS' ? 'bg-gray-800 text-white shadow-sm' : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
                            }`}
                    >
                        <Building2 className="w-4 h-4" />
                        <span>Inversiones</span>
                    </button>
                </div>

                {/* Content */}
                <div className="mt-6">
                    {activeTab === 'ACCOUNTS' && renderAccountsTab()}
                    {activeTab === 'CATEGORIES' && <CategoriesView />}
                    {activeTab === 'BILLS' && <BillsView accounts={accounts} onRefresh={loadData} />}
                    {activeTab === 'INVESTMENTS' && (
                        <InvestmentsView
                            accounts={accounts}
                            transactions={transactions}
                            debts={recurringDebts}
                            onAddContribution={openInvestmentContribution}
                            onAddIncome={openInvestmentIncome}
                            onCreateInvestment={() => openInvestmentContribution()}
                        />
                    )}
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
                    onClose={() => {
                        setShowAddTransaction(false);
                        setModalInitialBucket(undefined);
                        setModalLockedBucket(false);
                        setModalInitialAccountId(undefined);
                        setModalInitialType(undefined);
                        setModalAllowedTypes(undefined);
                        setModalInitialInvestmentName(undefined);
                    }}
                    onSave={handleAddTransaction}
                    initialBucket={modalInitialBucket}
                    lockedBucket={modalLockedBucket}
                    initialAccountId={modalInitialAccountId}
                    initialType={modalInitialType}
                    allowedTypes={modalAllowedTypes}
                    initialInvestmentName={modalInitialInvestmentName}
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

                        <div className="overflow-y-auto flex-1 bg-gray-950 px-6">
                            <div className="divide-y divide-gray-800">
                                {transactions
                                    .filter(t => {
                                        if (t.isPending && !t.isPaid) return false;
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
                                        <div key={t.id} className="grid grid-cols-[20px_minmax(0,1fr)_auto] items-center gap-3 py-3 text-sm">
                                            <span className={t.type === TransactionType.INCOME ? 'text-green-400' : 'text-gray-400'} aria-label={t.type === TransactionType.INCOME ? 'Ingreso' : 'Gasto'}>
                                                {t.type === TransactionType.INCOME ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
                                            </span>
                                            <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                                                <span className="truncate text-gray-100">{t.description}</span>
                                                <span className="text-gray-500">{new Date(t.date).toLocaleDateString('es-CO', { day: 'numeric', month: 'numeric', year: '2-digit' })}</span>
                                                <span className="text-gray-400">
                                                    {categories
                                                        .find(category => category.id === t.categoryId)
                                                        ?.subcategories.find(subcategory => subcategory.id === t.subcategoryId)?.name
                                                        || categories.find(category => category.id === t.categoryId)?.name
                                                        || t.categoryName
                                                        || 'General'}
                                                </span>
                                            </div>
                                            <div className={`whitespace-nowrap text-sm font-medium ${t.type === TransactionType.INCOME ? 'text-green-400' : 'text-gray-100'}`}>
                                                {t.type === TransactionType.INCOME ? '+' : '-'}${t.amount.toLocaleString()}
                                            </div>
                                        </div>
                                    ))}
                                {transactions.filter(t => {
                                    if (t.isPending && !t.isPaid) return false;
                                    const tDate = new Date(t.date);
                                    const tMonthKey = `${tDate.getFullYear()}-${String(tDate.getMonth() + 1).padStart(2, '0')}`;
                                    if (tMonthKey !== selectedMonth) return false;
                                    if (selectedBucket === BudgetBucket.ESSENTIAL) {
                                        return t.bucketId === BudgetBucket.ESSENTIAL || (!t.bucketId && t.type === TransactionType.EXPENSE);
                                    }
                                    return t.bucketId === selectedBucket;
                                }).length === 0 && (
                                    <div className="py-12 text-center text-sm text-gray-500">No hay transacciones registradas en esta cubeta para el mes seleccionado.</div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
