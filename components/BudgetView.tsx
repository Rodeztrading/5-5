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
    getCategories,
    deleteAccount,
    isProtectedRewardsCategory
} from '../services/budgetService';
import { useAuth } from '../hooks/useAuth';
import { AddAccountModal } from './AddAccountModal';
import { AddTransactionModal } from './AddTransactionModal';
import { CategoriesView } from './CategoriesView';
import { BillsView } from './BillsView';
import { InvestmentsView } from './InvestmentsView';
import { MonthlyTransactionsModal } from './MonthlyTransactionsModal';
import { useBrandedConfirm } from './BrandedConfirmDialog';
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
    X,
    Building2,
    Trash2
} from 'lucide-react';

interface BudgetViewProps { }

type Tab = 'ACCOUNTS' | 'CATEGORIES' | 'INVESTMENTS';

export const BudgetView: React.FC<BudgetViewProps> = () => {
    const { user } = useAuth();
    const { confirm: confirmAction, dialog: confirmDialog } = useBrandedConfirm();
    const [activeTab, setActiveTab] = useState<Tab>('ACCOUNTS');
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [recurringDebts, setRecurringDebts] = useState<RecurringDebt[]>([]);
    const [summary, setSummary] = useState<FinancialSummary | null>(null);
    const [loading, setLoading] = useState(true);
    const [showAddAccount, setShowAddAccount] = useState(false);
    const [newDebtFormRequest, setNewDebtFormRequest] = useState(0);
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

    const handleDeleteAccount = async (account: Account) => {
        if (!user) return;
        if (account.defaultKey) return;
        const confirmed = await confirmAction({
            title: 'Eliminar cuenta',
            message: `¿Eliminar la cuenta "${account.name}"? Sus movimientos históricos se conservarán, pero esta acción no se puede deshacer.`,
            confirmLabel: 'Eliminar cuenta',
        });
        if (!confirmed) return;

        try {
            await deleteAccount(account.id, user.uid);
            await loadData();
        } catch (error) {
            console.error('Error deleting account:', error);
            alert('No se pudo eliminar la cuenta. Intenta de nuevo.');
        }
    };

    const handleDeleteRecurringDebt = async (debt: RecurringDebt) => {
        if (!user) return;
        const confirmed = await confirmAction({
            title: 'Eliminar deuda general',
            message: `¿Eliminar la deuda "${debt.name}" y todas sus facturas vinculadas? Si ya pagaste cuotas, esos importes se devolverán a las cuentas usadas.`,
            confirmLabel: 'Eliminar deuda',
        });
        if (!confirmed) return;

        try {
            await deleteRecurringDebt(debt.id, user.uid);
            await loadData();
        } catch (error) {
            console.error('Error deleting recurring debt:', error);
            alert(error instanceof Error ? error.message : 'Error al eliminar la deuda');
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

    const getBucketHistoryTransactions = (bucket: BudgetBucket): Transaction[] => transactions
        .filter(transaction => {
            if (transaction.isPending && !transaction.isPaid) return false;
            const transactionDate = new Date(transaction.date);
            const transactionMonth = `${transactionDate.getFullYear()}-${String(transactionDate.getMonth() + 1).padStart(2, '0')}`;
            if (transactionMonth !== selectedMonth) return false;

            if (bucket === BudgetBucket.REWARDS) {
                if (transaction.type !== TransactionType.EXPENSE) return false;
                const category = categories.find(item => item.id === transaction.categoryId);
                if (category && isProtectedRewardsCategory(category)) return true;
                return (transaction.categoryName || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim() === 'recompensas';
            }
            if (bucket === BudgetBucket.ESSENTIAL) {
                return transaction.bucketId === BudgetBucket.ESSENTIAL ||
                    (!transaction.bucketId && transaction.type === TransactionType.EXPENSE);
            }
            return transaction.bucketId === bucket;
        })
        .sort((a, b) => b.date - a.date);

    const renderAccountsTab = () => {
        if (loading) {
            return (
                <div className="flex items-center justify-center py-12">
                    <div className="text-gray-400">Cargando...</div>
                </div>
            );
        }

        const bucketInfo = [
            { id: BudgetBucket.INVESTMENT, label: 'Inversión', icon: <TrendingUp className="h-4 w-4 text-green-400" /> },
            { id: BudgetBucket.STABILITY, label: 'Fondo de estabilidad', icon: <PiggyBank className="h-4 w-4 text-blue-400" /> },
            { id: BudgetBucket.REWARDS, label: 'Recompensas', icon: <DollarSign className="h-4 w-4 text-amber-400" /> },
        ];
        const defaultAccountOrder = { CASH: 0, INVESTMENT: 1, STABILITY: 2 };
        const orderedAccounts = [...accounts].sort((a, b) => {
            if (a.defaultKey && !b.defaultKey) return 1;
            if (!a.defaultKey && b.defaultKey) return -1;
            if (a.defaultKey && b.defaultKey) return defaultAccountOrder[a.defaultKey] - defaultAccountOrder[b.defaultKey];
            return b.createdAt - a.createdAt;
        });
        const activeDebts = recurringDebts.filter(debt => debt.isActive);
        const totalDebtBalance = activeDebts.reduce((total, debt) => total + (Number(debt.remainingAmount) || 0), 0);

        return (
            <div className="grid grid-cols-1 gap-3 lg:min-h-full lg:grid-cols-12 lg:grid-rows-[auto_auto_auto_auto]">
                {/* Month Selector & Main Actions */}
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between lg:col-span-full">
                    <h1 className="text-lg font-bold text-white">Resumen del mes</h1>
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

                {summary && (
                    <section className="rounded-lg border border-gray-800 bg-gray-900/50 lg:col-span-full">
                        <h2 className="sr-only">Resumen del mes</h2>
                        <div className="grid grid-cols-3 gap-1.5 p-1.5 sm:gap-2 sm:p-2">
                            <div className="flex min-w-0 flex-col justify-between gap-2 rounded-md border border-gray-800 px-2 py-2 sm:px-3">
                                <span className="flex min-w-0 items-center gap-1 whitespace-nowrap text-[10px] text-gray-300 sm:gap-2 sm:text-sm"><TrendingUp className="hidden h-4 w-4 shrink-0 text-rodez-red sm:block" /><span className="truncate">Balance neto</span></span>
                                <strong className={`whitespace-nowrap text-[11px] sm:text-lg ${summary.netBalance >= 0 ? 'text-white' : 'text-red-300'}`}>{summary.netBalance >= 0 ? '+' : ''}${summary.netBalance.toLocaleString('es-CO', { maximumFractionDigits: 0 })}</strong>
                            </div>
                            <button
                                type="button"
                                onClick={() => { setMonthlyModalType(TransactionType.INCOME); setShowMonthlyModal(true); }}
                                className="flex min-w-0 flex-col justify-between gap-2 rounded-md border border-gray-800 px-2 py-2 text-left transition-colors hover:bg-gray-800/50 sm:px-3"
                            >
                                <span className="flex min-w-0 items-center gap-1 whitespace-nowrap text-[10px] text-gray-300 sm:gap-2 sm:text-sm"><ArrowUpRight className="hidden h-4 w-4 shrink-0 text-green-400 sm:block" /><span className="truncate"><span className="sm:hidden">Ingresos</span><span className="hidden sm:inline">Ingresos del mes</span></span></span>
                                <strong className="whitespace-nowrap text-[11px] text-green-300 sm:text-lg">+${summary.monthlyIncome.toLocaleString('es-CO', { maximumFractionDigits: 0 })}</strong>
                            </button>
                            <button
                                type="button"
                                onClick={() => { setMonthlyModalType(TransactionType.EXPENSE); setShowMonthlyModal(true); }}
                                className="flex min-w-0 flex-col justify-between gap-2 rounded-md border border-gray-800 px-2 py-2 text-left transition-colors hover:bg-gray-800/50 sm:px-3"
                            >
                                <span className="flex min-w-0 items-center gap-1 whitespace-nowrap text-[10px] text-gray-300 sm:gap-2 sm:text-sm"><ArrowDownRight className="hidden h-4 w-4 shrink-0 text-red-400 sm:block" /><span className="truncate"><span className="sm:hidden">Gastos</span><span className="hidden sm:inline">Gastos del mes</span></span></span>
                                <strong className="whitespace-nowrap text-[11px] text-red-300 sm:text-lg">-${summary.monthlyExpenses.toLocaleString('es-CO', { maximumFractionDigits: 0 })}</strong>
                            </button>
                        </div>
                    </section>
                )}

                <section className="rounded-lg border border-gray-800 bg-gray-900/50 p-3 lg:col-span-full">
                    <div className="mb-1 flex items-center justify-between">
                        <h2 className="flex items-center gap-2 text-sm font-semibold text-white"><Wallet className="h-4 w-4 text-rodez-red" /> Cuentas</h2>
                        <button onClick={() => setShowAddAccount(true)} className="rounded p-1 text-gray-400 hover:bg-gray-800 hover:text-white" title="Agregar cuenta" aria-label="Agregar cuenta"><Plus className="h-4 w-4" /></button>
                    </div>
                    {accounts.length === 0 ? (
                        <button onClick={() => setShowAddAccount(true)} className="flex items-center gap-2 py-2 text-xs text-gray-400 hover:text-white"><Plus className="h-4 w-4" /> Crear cuenta</button>
                    ) : (
                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
                            {orderedAccounts.map(account => (
                                <div key={account.id} className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-2 rounded-md border border-gray-800 bg-gray-950/50 px-2 py-2">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setModalInitialAccountId(account.id);
                                            setModalInitialType(TransactionType.EXPENSE);
                                            setModalAllowedTypes([TransactionType.INCOME, TransactionType.EXPENSE, TransactionType.TRANSFER]);
                                            setModalInitialBucket(undefined);
                                            setModalLockedBucket(false);
                                            setShowAddTransaction(true);
                                        }}
                                        className="flex min-w-0 items-center gap-2 text-left"
                                        title={`Registrar movimiento en ${account.name}`}
                                    >
                                        <span className="shrink-0 text-gray-300">{getAccountIcon(account.type)}</span>
                                        <span className="truncate text-xs text-gray-200">{account.name}</span>
                                    </button>
                                    <strong className="whitespace-nowrap text-xs text-white">{account.type === AccountType.CREDIT_CARD ? '−' : ''}${Math.abs(account.balance).toLocaleString('es-CO', { maximumFractionDigits: 0 })}</strong>
                                    {account.defaultKey ? (
                                        <span className="px-1 text-[10px] text-gray-600" title="Cuenta predeterminada protegida" aria-label="Cuenta predeterminada protegida">Fija</span>
                                    ) : (
                                        <button type="button" onClick={() => void handleDeleteAccount(account)} className="rounded p-1 text-gray-500 hover:text-red-400" title={`Eliminar ${account.name}`} aria-label={`Eliminar cuenta ${account.name}`}><Trash2 className="h-3 w-3" /></button>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </section>

                <div className="grid grid-cols-1 gap-3 lg:col-span-full lg:min-h-0 lg:grid-cols-3">
                    <BillsView
                        accounts={accounts}
                        onRefresh={loadData}
                        mode="monthly"
                        month={selectedMonth}
                        newDebtFormRequest={newDebtFormRequest}
                    />

                    {/* General debts */}
                    <section className="flex min-w-0 flex-col rounded-lg border border-gray-800 bg-gray-900/40 p-4 lg:min-h-0">
                        <div className="mb-2 flex items-center justify-between gap-2">
                            <div className="flex min-w-0 items-center gap-2">
                                <CreditCard className="h-4 w-4 shrink-0 text-rodez-red" />
                                <h2 className="truncate text-sm font-semibold text-white">Facturas generales</h2>
                            </div>
                            <button
                                type="button"
                                onClick={() => setNewDebtFormRequest(request => request + 1)}
                                className="flex shrink-0 items-center gap-1 rounded bg-rodez-red px-2 py-1.5 text-xs font-medium text-white hover:bg-red-600"
                            >
                                <Plus className="h-3.5 w-3.5" />
                                <span>Nueva deuda</span>
                            </button>
                        </div>
                        {activeDebts.length === 0 ? (
                            <p className="py-6 text-center text-sm text-gray-500">No hay deudas generales activas</p>
                        ) : (
                            <div className="min-h-0 flex-1 divide-y divide-gray-800 overflow-y-auto custom-scrollbar">
                                {activeDebts.map(debt => (
                                    <div key={debt.id} className="flex items-center justify-between gap-3 py-2.5">
                                        <span className="min-w-0 truncate text-sm text-gray-200">{debt.name}</span>
                                        <div className="flex shrink-0 items-center gap-2">
                                            <strong className="whitespace-nowrap text-sm text-red-300">${debt.remainingAmount.toLocaleString('es-CO', { maximumFractionDigits: 0 })}</strong>
                                            <button
                                                type="button"
                                                onClick={() => void handleDeleteRecurringDebt(debt)}
                                                className="rounded p-1 text-gray-500 hover:bg-red-500/10 hover:text-red-400"
                                                title={`Eliminar deuda ${debt.name}`}
                                                aria-label={`Eliminar deuda ${debt.name}`}
                                            >
                                                <Trash2 className="h-3.5 w-3.5" />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                        <div className="mt-2 flex items-center justify-between border-t border-gray-800 pt-2 text-xs text-gray-400">
                            <span>Saldo pendiente</span>
                            <strong className="text-white">${totalDebtBalance.toLocaleString('es-CO', { maximumFractionDigits: 0 })}</strong>
                        </div>
                    </section>
                    <section className="flex min-w-0 flex-col rounded-lg border border-gray-800 bg-gray-900/40 p-4 lg:min-h-0">
                        <h2 className="mb-1 flex items-center gap-2 text-sm font-semibold text-white"><List className="h-4 w-4 text-rodez-red" /> Distribución 5-5</h2>
                        <div className="divide-y divide-gray-800">
                            {bucketInfo.map(bucket => {
                                const amount = summary?.bucketBalances?.[bucket.id] || 0;
                                const percentage = summary?.monthlyBucketPercentages?.[bucket.id] || 0;
                                return (
                                    <button
                                        key={bucket.id}
                                        type="button"
                                        onClick={() => { setSelectedBucket(bucket.id); setShowBucketDetailModal(true); }}
                                        className="grid w-full min-w-0 grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3 py-2 text-left hover:bg-gray-800/30 sm:grid-cols-[minmax(0,1fr)_auto_auto_auto]"
                                    >
                                        <span className="flex min-w-0 items-center gap-2">
                                            {bucket.icon}
                                            <span className="truncate text-sm font-medium text-white">{bucket.label} {percentage.toLocaleString('es-CO', { maximumFractionDigits: 1 })}%</span>
                                        </span>
                                        <strong className="whitespace-nowrap text-sm text-white">${amount.toLocaleString('es-CO', { maximumFractionDigits: 0 })}</strong>
                                        <span className="col-span-3 flex items-center justify-end gap-1 px-1 py-1 text-xs text-gray-400 sm:col-span-1" title={`Ver historial de ${bucket.label}`}>
                                            <List className="h-3.5 w-3.5" /><span>Historial</span>
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    </section>
                </div>

            </div>
        );
    };

    return (
        <div className="h-full min-h-0 overflow-hidden bg-gray-950 p-4 md:p-6">
            <div className="mx-auto flex h-full min-h-0 max-w-7xl flex-col gap-4">

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
                        onClick={() => setActiveTab('INVESTMENTS')}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center space-x-2 whitespace-nowrap ${activeTab === 'INVESTMENTS' ? 'bg-gray-800 text-white shadow-sm' : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
                            }`}
                    >
                        <Building2 className="w-4 h-4" />
                        <span>Inversiones</span>
                    </button>
                </div>

                {/* Content */}
                <div className="min-h-0 flex-1 overflow-y-auto">
                    {activeTab === 'ACCOUNTS' && renderAccountsTab()}
                    {activeTab === 'CATEGORIES' && <CategoriesView />}
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
                                {getBucketHistoryTransactions(selectedBucket).map(t => (
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
                                {getBucketHistoryTransactions(selectedBucket).length === 0 && (
                                    <div className="py-12 text-center text-sm text-gray-500">No hay transacciones registradas en esta cubeta para el mes seleccionado.</div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
            {confirmDialog}
        </div>
    );
};
