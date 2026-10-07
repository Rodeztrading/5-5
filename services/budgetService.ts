import {
    collection,
    addDoc,
    getDocs,
    doc,
    updateDoc,
    deleteDoc,
    query,
    orderBy,
    where,
    Timestamp,
    writeBatch,
    getDoc,
    runTransaction
} from 'firebase/firestore';
import { db } from '../config/firebase';
import {
    Account,
    AccountType,
    Transaction,
    MonthlyBudget,
    FinancialSummary,
    TransactionType,
    Category,
    Subcategory,
    ExpenseCategory,
    RecurringDebt,
    BudgetBucket
} from '../types';

// ============================================
// CATEGORIES
// ============================================

export const initializeDefaultCategories = async (userId: string): Promise<void> => {
    const categoriesRef = collection(db, `users/${userId}/categories`);
    const q = query(categoriesRef);
    const snapshot = await getDocs(q);

    if (!snapshot.empty) return;

    const defaultCategories: Omit<Category, 'id'>[] = [
        {
            name: 'Facturas',
            type: TransactionType.EXPENSE,
            icon: 'FileText',
            color: '#FF5252',
            isDefault: true,
            subcategories: [
                { id: 'servicios', name: 'Servicios Públicos', isDefault: true },
                { id: 'arriendo', name: 'Arriendo', isDefault: true },
                { id: 'internet', name: 'Internet', isDefault: true },
                { id: 'celular', name: 'Celular', isDefault: true },
                { id: 'tarjeta', name: 'Tarjeta de Crédito', isDefault: true },
            ]
        },
        {
            name: 'Inversión',
            type: TransactionType.EXPENSE,
            icon: 'TrendingUp',
            color: '#4CAF50',
            isDefault: true,
            bucketId: BudgetBucket.INVESTMENT,
            subcategories: [
                { id: 'trading', name: 'Trading', isDefault: true },
                { id: 'wink', name: 'Wink', isDefault: true },
                { id: 'propiedad', name: 'Casa en el poblado', isDefault: true },
            ]
        },
        {
            name: 'Gastos Diarios',
            type: TransactionType.EXPENSE,
            icon: 'ShoppingCart',
            color: '#FFC107',
            isDefault: true,
            bucketId: BudgetBucket.ESSENTIAL,
            subcategories: [
                { id: 'comida', name: 'Comida', isDefault: true },
                { id: 'transporte', name: 'Transporte', isDefault: true },
                { id: 'supermercado', name: 'Supermercado', isDefault: true },
            ]
        },
        {
            name: 'Fondo de Estabilidad',
            type: TransactionType.EXPENSE,
            icon: 'PiggyBank',
            color: '#9C27B0',
            isDefault: true,
            bucketId: BudgetBucket.STABILITY,
            subcategories: [
                { id: 'general', name: 'General', isDefault: true },
                { id: 'emergencia', name: 'Fondo de Emergencia', isDefault: true },
            ]
        },
        {
            name: 'Recompensas',
            type: TransactionType.EXPENSE,
            icon: 'Smile',
            color: '#E91E63',
            isDefault: true,
            bucketId: BudgetBucket.REWARDS,
            subcategories: [
                { id: 'gustos', name: 'Gustos Personales', isDefault: true },
                { id: 'viajes', name: 'Viajes / Salidas', isDefault: true },
                { id: 'ocio', name: 'Ocio / Entretenimiento', isDefault: true },
            ]
        },
        {
            name: 'Ingresos',
            type: TransactionType.INCOME,
            icon: 'DollarSign',
            color: '#8BC34A',
            isDefault: true,
            subcategories: [
                { id: 'salario', name: 'Salario', isDefault: true },
                { id: 'ventas', name: 'Ventas', isDefault: true },
            ]
        }
    ];

    const batch = writeBatch(db);
    defaultCategories.forEach(cat => {
        const docRef = doc(categoriesRef);
        batch.set(docRef, cat);
    });

    await batch.commit();
};

export const getEffectiveCategoryBucket = (category: Category): BudgetBucket => {
    if (category.bucketId) return category.bucketId;
    const name = (category.name || '').toLowerCase();
    if (name.includes('invers')) return BudgetBucket.INVESTMENT;
    if (name.includes('ahorro') || name.includes('estabilidad') || name.includes('emergencia')) return BudgetBucket.STABILITY;
    if (name.includes('recompensa') || name.includes('ocio') || name.includes('gusto')) return BudgetBucket.REWARDS;
    return BudgetBucket.ESSENTIAL;
};

export const getCategories = async (userId: string): Promise<Category[]> => {
    try {
        const q = query(collection(db, `users/${userId}/categories`));
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            await initializeDefaultCategories(userId);
            return getCategories(userId); // Retry after init
        }

        return querySnapshot.docs.map(doc => ({
            ...doc.data(),
            id: doc.id
        } as Category));
    } catch (error) {
        console.error('Error getting categories:', error);
        throw new Error('Failed to get categories');
    }
};

export const saveCategory = async (category: Omit<Category, 'id'>, userId: string): Promise<Category> => {
    try {
        const docRef = await addDoc(collection(db, `users/${userId}/categories`), category);
        return { ...category, id: docRef.id };
    } catch (error) {
        console.error('Error saving category:', error);
        throw new Error('Failed to save category');
    }
};

export const updateCategory = async (categoryId: string, updates: Partial<Category>, userId: string): Promise<void> => {
    try {
        const ref = doc(db, `users/${userId}/categories`, categoryId);
        await updateDoc(ref, updates);
    } catch (error) {
        console.error('Error updating category:', error);
        throw new Error('Failed to update category');
    }
};

export const deleteCategory = async (categoryId: string, userId: string): Promise<void> => {
    try {
        const ref = doc(db, `users/${userId}/categories`, categoryId);
        await deleteDoc(ref);
    } catch (error) {
        console.error('Error deleting category:', error);
        throw new Error('Failed to delete category');
    }
};

// ============================================
// ACCOUNTS
// ============================================

export const createAccount = async (account: Omit<Account, 'id' | 'createdAt'>, userId: string): Promise<Account> => {
    try {
        const accountData = {
            ...account,
            createdAt: Timestamp.fromMillis(Date.now()),
        };

        const docRef = await addDoc(collection(db, `users/${userId}/accounts`), accountData);

        return {
            ...account,
            id: docRef.id,
            createdAt: Date.now(),
        };
    } catch (error) {
        console.error('Error creating account:', error);
        throw new Error('Failed to create account');
    }
};

export const getAllAccounts = async (userId: string): Promise<Account[]> => {
    try {
        const q = query(collection(db, `users/${userId}/accounts`), orderBy('createdAt', 'asc'));
        const querySnapshot = await getDocs(q);

        const accounts: Account[] = querySnapshot.docs.map(doc => {
            const data = doc.data();
            return {
                ...data,
                id: doc.id,
                createdAt: data.createdAt.toMillis(),
            } as Account;
        });

        return accounts;
    } catch (error) {
        console.error('Error getting accounts:', error);
        throw new Error('Failed to get accounts');
    }
};

export const updateAccount = async (
    accountId: string,
    updates: Partial<Omit<Account, 'id' | 'createdAt'>>,
    userId: string
): Promise<void> => {
    try {
        const accountRef = doc(db, `users/${userId}/accounts`, accountId);
        await updateDoc(accountRef, updates);
    } catch (error) {
        console.error('Error updating account:', error);
        throw new Error('Failed to update account');
    }
};

export const deleteAccount = async (accountId: string, userId: string): Promise<void> => {
    try {
        const accountRef = doc(db, `users/${userId}/accounts`, accountId);
        await deleteDoc(accountRef);
    } catch (error) {
        console.error('Error deleting account:', error);
        throw new Error('Failed to delete account');
    }
};

// ============================================
// TRANSACTIONS
// ============================================

export const createTransaction = async (
    transaction: Omit<Transaction, 'id' | 'createdAt'>,
    userId: string
): Promise<Transaction> => {
    try {
        if (!Number.isFinite(transaction.amount) || transaction.amount <= 0) {
            throw new Error('El monto debe ser mayor que cero.');
        }

        // Remove undefined fields to avoid Firestore errors
        const cleanTransaction: any = {
            type: transaction.type,
            amount: transaction.amount,
            description: transaction.description,
            accountId: transaction.accountId,
            date: Timestamp.fromMillis(transaction.date),
            isPaid: transaction.isPaid || false,
            createdAt: Timestamp.fromMillis(Date.now()),
        };

        // Add optional fields only if they have values
        if (transaction.toAccountId) cleanTransaction.toAccountId = transaction.toAccountId;
        if (transaction.categoryId) cleanTransaction.categoryId = transaction.categoryId;
        if (transaction.subcategoryId) cleanTransaction.subcategoryId = transaction.subcategoryId;
        if (transaction.categoryName) cleanTransaction.categoryName = transaction.categoryName;
        if (transaction.isPending !== undefined) cleanTransaction.isPending = transaction.isPending;
        if (transaction.dueDate) cleanTransaction.dueDate = Timestamp.fromMillis(transaction.dueDate);
        if (transaction.bucketId) cleanTransaction.bucketId = transaction.bucketId;
        if (transaction.investmentName) cleanTransaction.investmentName = transaction.investmentName;
        if (transaction.isInvestmentReturn !== undefined) cleanTransaction.isInvestmentReturn = transaction.isInvestmentReturn;
        if (transaction.bucketAllocations) cleanTransaction.bucketAllocations = transaction.bucketAllocations;

        const transactionRef = doc(collection(db, `users/${userId}/transactions`));
        const accountRef = doc(db, `users/${userId}/accounts`, transaction.accountId);
        const toAccountRef = transaction.toAccountId
            ? doc(db, `users/${userId}/accounts`, transaction.toAccountId)
            : undefined;

        await runTransaction(db, async firestoreTransaction => {
            const shouldUpdateBalance = !transaction.isPending || transaction.isPaid;
            const accountSnapshot = shouldUpdateBalance
                ? await firestoreTransaction.get(accountRef)
                : undefined;
            const toAccountSnapshot = transaction.type === TransactionType.TRANSFER && toAccountRef
                ? await firestoreTransaction.get(toAccountRef)
                : undefined;

            if (shouldUpdateBalance && !accountSnapshot?.exists()) {
                throw new Error('La cuenta seleccionada no existe. No se pudo completar la transacción.');
            }
            if (transaction.type === TransactionType.TRANSFER && !toAccountSnapshot?.exists()) {
                throw new Error('La cuenta de destino no existe. No se pudo completar la transferencia.');
            }

            const currentBalance = Number(accountSnapshot?.data()?.balance) || 0;
            const accountData = accountSnapshot?.data();
            const isCreditCard = accountData?.type === AccountType.CREDIT_CARD;
            const currentCreditAvailable = Number(accountData?.creditAvailable ?? (Number(accountData?.creditLimit) - currentBalance)) || 0;
            const spendsFromAccount = transaction.type === TransactionType.EXPENSE || transaction.type === TransactionType.TRANSFER;
            const spendableBalance = isCreditCard ? currentCreditAvailable : currentBalance;
            if (shouldUpdateBalance && spendsFromAccount && spendableBalance < transaction.amount) {
                throw new Error(`Saldo insuficiente: disponible $${spendableBalance.toLocaleString()}, gasto $${transaction.amount.toLocaleString()}.`);
            }

            firestoreTransaction.set(transactionRef, cleanTransaction);

            if (transaction.type === TransactionType.EXPENSE && transaction.bucketId === BudgetBucket.STABILITY && !transaction.isPending) {
                const debtTransactionRef = doc(collection(db, `users/${userId}/transactions`));
                firestoreTransaction.set(debtTransactionRef, {
                    type: TransactionType.EXPENSE,
                    amount: transaction.amount,
                    description: `Reponer: ${transaction.description}`,
                    accountId: transaction.accountId,
                    date: Timestamp.fromMillis(transaction.date),
                    isPaid: false,
                    isPending: true,
                    dueDate: Timestamp.fromMillis(transaction.date + (30 * 24 * 60 * 60 * 1000)),
                    categoryName: 'Deuda a Fondo de Estabilidad',
                    createdAt: Timestamp.fromMillis(Date.now()),
                });
            }

            if (shouldUpdateBalance) {
                let newBalance = currentBalance;
                if (isCreditCard) {
                    const creditLimit = Number(accountData?.creditLimit) || currentCreditAvailable + currentBalance;
                    let newCreditAvailable = currentCreditAvailable;
                    if (spendsFromAccount) {
                        newBalance += transaction.amount;
                        newCreditAvailable -= transaction.amount;
                    } else if (transaction.type === TransactionType.INCOME) {
                        newBalance = Math.max(0, newBalance - transaction.amount);
                        newCreditAvailable = Math.min(creditLimit, newCreditAvailable + transaction.amount);
                    }
                    firestoreTransaction.update(accountRef, {
                        balance: newBalance,
                        creditAvailable: newCreditAvailable,
                    });
                } else {
                    if (transaction.type === TransactionType.INCOME) {
                        newBalance += transaction.amount;
                    } else if (spendsFromAccount) {
                        newBalance -= transaction.amount;
                    }
                    firestoreTransaction.update(accountRef, { balance: newBalance });
                }

                if (transaction.type === TransactionType.TRANSFER && toAccountRef && toAccountSnapshot?.exists()) {
                    const destinationData = toAccountSnapshot.data();
                    const destinationBalance = Number(destinationData.balance) || 0;
                    if (destinationData.type === AccountType.CREDIT_CARD) {
                        const destinationLimit = Number(destinationData.creditLimit) || 0;
                        const destinationAvailable = Number(destinationData.creditAvailable ?? (destinationLimit - destinationBalance)) || 0;
                        const appliedPayment = Math.min(transaction.amount, destinationBalance);
                        firestoreTransaction.update(toAccountRef, {
                            balance: Math.max(0, destinationBalance - transaction.amount),
                            creditAvailable: Math.min(destinationLimit, destinationAvailable + appliedPayment),
                        });
                    } else {
                        firestoreTransaction.update(toAccountRef, { balance: destinationBalance + transaction.amount });
                    }
                }
            }
        });

        return {
            ...transaction,
            id: transactionRef.id,
            createdAt: Date.now(),
        };
    } catch (error) {
        console.error('Error creating transaction:', error);
        throw error;
    }
};

export const updateTransaction = async (
    transactionId: string,
    updates: Partial<Omit<Transaction, 'id' | 'createdAt'>>,
    userId: string
): Promise<void> => {
    try {
        const transactionRef = doc(db, `users/${userId}/transactions`, transactionId);
        const cleanUpdates: any = {};

        // Only add defined fields
        Object.keys(updates).forEach(key => {
            const value = (updates as any)[key];
            if (value !== undefined) {
                if (key === 'date' && typeof value === 'number') {
                    cleanUpdates[key] = Timestamp.fromMillis(value);
                } else if (key === 'dueDate' && typeof value === 'number') {
                    cleanUpdates[key] = Timestamp.fromMillis(value);
                } else {
                    cleanUpdates[key] = value;
                }
            }
        });

        await updateDoc(transactionRef, cleanUpdates);
    } catch (error) {
        console.error('Error updating transaction:', error);
        throw new Error('Failed to update transaction');
    }
};

export const getAllTransactions = async (userId: string): Promise<Transaction[]> => {
    try {
        const q = query(collection(db, `users/${userId}/transactions`), orderBy('date', 'desc'));
        const querySnapshot = await getDocs(q);

        const transactions: Transaction[] = querySnapshot.docs.map(doc => {
            const data = doc.data();
            return {
                ...data,
                id: doc.id,
                date: data.date.toMillis(),
                createdAt: data.createdAt.toMillis(),
            } as Transaction;
        });

        return transactions;
    } catch (error) {
        console.error('Error getting transactions:', error);
        throw new Error('Failed to get transactions');
    }
};

export const getTransactionsByMonth = async (month: string, userId: string): Promise<Transaction[]> => {
    try {
        const [year, mon] = month.split('-').map(Number);
        const startDate = new Date(year, mon - 1, 1);
        const endDate = new Date(year, mon, 0, 23, 59, 59);

        const transactionsRef = collection(db, `users/${userId}/transactions`);
        const q = query(
            transactionsRef,
            where('date', '>=', Timestamp.fromDate(startDate)),
            where('date', '<=', Timestamp.fromDate(endDate)),
            orderBy('date', 'desc')
        );

        const querySnapshot = await getDocs(q);
        return querySnapshot.docs.map(doc => {
            const data = doc.data();
            return {
                ...data,
                id: doc.id,
                date: data.date.toMillis(),
                createdAt: data.createdAt.toMillis(),
            } as Transaction;
        });
    } catch (error) {
        console.error('Error getting transactions by month:', error);
        throw new Error('Failed to get transactions by month');
    }
};

export const getTransactionsByRange = async (userId: string, endDate: Date): Promise<Transaction[]> => {
    try {
        const transactionsRef = collection(db, `users/${userId}/transactions`);
        const q = query(
            transactionsRef,
            where('date', '<=', Timestamp.fromDate(endDate)),
            orderBy('date', 'desc')
        );

        const querySnapshot = await getDocs(q);
        return querySnapshot.docs.map(doc => {
            const data = doc.data();
            return {
                ...data,
                id: doc.id,
                date: data.date.toMillis(),
                createdAt: data.createdAt.toMillis(),
            } as Transaction;
        });
    } catch (error) {
        console.error('Error getting transactions by range:', error);
        throw new Error('Failed to get transactions by range');
    }
};

export const deleteTransaction = async (transactionId: string, userId: string): Promise<void> => {
    try {
        const transactionRef = doc(db, `users/${userId}/transactions`, transactionId);
        await deleteDoc(transactionRef);
    } catch (error) {
        console.error('Error deleting transaction:', error);
        throw new Error('Failed to delete transaction');
    }
};

// ============================================
// FINANCIAL SUMMARY
// ============================================

export const getFinancialSummary = async (userId: string, month?: string): Promise<FinancialSummary> => {
    try {
        const accounts = await getAllAccounts(userId);
        const totalBalance = accounts.reduce((sum, account) => {
            if (account.type !== AccountType.CREDIT_CARD) return sum + account.balance;
            return sum + (account.balance > 0 ? -account.balance : account.balance);
        }, 0);

        const currentMonth = month || new Date().toISOString().slice(0, 7);
        const [year, mon] = currentMonth.split('-').map(Number);
        const targetMonthDate = new Date(year, mon - 1, 1);
        const endOfTargetMonth = new Date(year, mon, 0, 23, 59, 59);

        // Fetch ALL transactions up to end of selected month for cumulative balances
        const allTransactions = await getTransactionsByRange(userId, endOfTargetMonth);

        // Month specific transactions for monthly stats
        const monthlyTransactions = allTransactions.filter(t => {
            const tDate = new Date(t.date);
            return tDate.getFullYear() === year && tDate.getMonth() === (mon - 1);
        });

        // Current month active stats (excluding pending)
        const activeMonthly = monthlyTransactions.filter(t => !t.isPending || t.isPaid);

        const monthlyIncome = activeMonthly
            .filter(t => t.type === TransactionType.INCOME)
            .reduce((sum, t) => sum + t.amount, 0);

        const monthlyExpenses = activeMonthly
            .filter(t => t.type === TransactionType.EXPENSE)
            .reduce((sum, t) => sum + t.amount, 0);

        const netBalance = monthlyIncome - monthlyExpenses;

        // Calculate pending bills (only for this month)
        const pendingBillsAmount = monthlyTransactions
            .filter(t => t.isPending && !t.isPaid)
            .reduce((sum, t) => sum + t.amount, 0);

        // Calculate bucket balances
        const bucketBalances: Record<BudgetBucket, number> = {
            [BudgetBucket.ESSENTIAL]: 0,
            [BudgetBucket.INVESTMENT]: 0,
            [BudgetBucket.STABILITY]: 0,
            [BudgetBucket.REWARDS]: 0,
            [BudgetBucket.OTHER]: 0,
        };

        // DUAL LOGIC DISTRIBUTION
        allTransactions.forEach(t => {
            if (t.isPending && !t.isPaid) return;
            const tDate = new Date(t.date);
            const isTargetMonth = tDate.getFullYear() === year && tDate.getMonth() === (mon - 1);

            if (t.type === TransactionType.INCOME) {
                if (t.isInvestmentReturn) {
                    // Cumulative always
                    bucketBalances[BudgetBucket.INVESTMENT] += t.amount;
                } else {
                    // Use custom allocations if set, otherwise fallback to default 50/25/15/10
                    const alloc = t.bucketAllocations;
                    const essentialPct  = alloc ? ((alloc[BudgetBucket.ESSENTIAL]  ?? 0) / 100) : 0.50;
                    const investPct     = alloc ? ((alloc[BudgetBucket.INVESTMENT]  ?? 0) / 100) : 0.25;
                    const stabilityPct  = alloc ? ((alloc[BudgetBucket.STABILITY]   ?? 0) / 100) : 0.15;
                    const rewardsPct    = alloc ? ((alloc[BudgetBucket.REWARDS]     ?? 0) / 100) : 0.10;

                    // Essential is monthly (only current month)
                    if (isTargetMonth) bucketBalances[BudgetBucket.ESSENTIAL] += t.amount * essentialPct;

                    // The rest accumulate cumulatively
                    bucketBalances[BudgetBucket.INVESTMENT] += t.amount * investPct;
                    bucketBalances[BudgetBucket.STABILITY]  += t.amount * stabilityPct;
                    bucketBalances[BudgetBucket.REWARDS]    += t.amount * rewardsPct;
                }
            } else if (t.type === TransactionType.EXPENSE) {
                const bId = t.bucketId || BudgetBucket.ESSENTIAL;

                if (bId === BudgetBucket.ESSENTIAL) {
                    // Essential expenses only substracted in the month they occur
                    if (isTargetMonth) bucketBalances[bId] -= t.amount;
                } else {
                    // Others substract from cumulative
                    bucketBalances[bId] -= t.amount;
                }
            }
        });

        return {
            totalBalance,
            monthlyIncome,
            monthlyExpenses,
            netBalance,
            pendingBillsAmount,
            expensesByCategory: [],
            bucketBalances
        };
    } catch (error) {
        console.error('Error getting financial summary:', error);
        throw new Error('Failed to get financial summary');
    }
};

// ============================================
// MONTHLY BUDGET
// ============================================

export const getMonthlyBudget = async (month: string, userId: string): Promise<MonthlyBudget | null> => {
    try {
        const q = query(collection(db, `users/${userId}/budgets`), where('month', '==', month));
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            return null;
        }

        const doc = querySnapshot.docs[0];
        const data = doc.data();

        return {
            ...data,
            id: doc.id,
        } as MonthlyBudget;
    } catch (error) {
        console.error('Error getting monthly budget:', error);
        throw new Error('Failed to get monthly budget');
    }
};

export const saveMonthlyBudget = async (
    budget: Omit<MonthlyBudget, 'id'>,
    userId: string
): Promise<MonthlyBudget> => {
    try {
        const existing = await getMonthlyBudget(budget.month, userId);

        if (existing) {
            const budgetRef = doc(db, `users/${userId}/budgets`, existing.id);
            await updateDoc(budgetRef, budget);
            return { ...budget, id: existing.id };
        } else {
            const docRef = await addDoc(collection(db, `users/${userId}/budgets`), budget);
            return { ...budget, id: docRef.id };
        }
    } catch (error) {
        console.error('Error saving monthly budget:', error);
        throw new Error('Failed to save monthly budget');
    }
};

// ============================================
// RECURRING DEBTS
// ============================================

export const createRecurringDebt = async (
    debt: Omit<RecurringDebt, 'id' | 'createdAt'>,
    userId: string
): Promise<RecurringDebt> => {
    try {
        const debtData = {
            ...debt,
            createdAt: Timestamp.fromMillis(Date.now()),
            startDate: Timestamp.fromMillis(debt.startDate),
        };

        const docRef = await addDoc(collection(db, `users/${userId}/recurringDebts`), debtData);

        return {
            ...debt,
            id: docRef.id,
            createdAt: Date.now(),
        };
    } catch (error) {
        console.error('Error creating recurring debt:', error);
        throw new Error('Failed to create recurring debt');
    }
};

export const getAllRecurringDebts = async (userId: string): Promise<RecurringDebt[]> => {
    try {
        const q = query(
            collection(db, `users/${userId}/recurringDebts`),
            orderBy('createdAt', 'desc')
        );
        const querySnapshot = await getDocs(q);

        return querySnapshot.docs.map(doc => {
            const data = doc.data();
            return {
                ...data,
                id: doc.id,
                startDate: data.startDate.toMillis(),
                createdAt: data.createdAt.toMillis(),
            } as RecurringDebt;
        });
    } catch (error) {
        console.error('Error getting recurring debts:', error);
        throw new Error('Failed to get recurring debts');
    }
};

export const updateRecurringDebt = async (
    debtId: string,
    updates: Partial<Omit<RecurringDebt, 'id' | 'createdAt'>>,
    userId: string
): Promise<void> => {
    try {
        const debtRef = doc(db, `users/${userId}/recurringDebts`, debtId);
        const cleanUpdates: any = { ...updates };

        // Convert dates to Timestamps if present
        if (updates.startDate) {
            cleanUpdates.startDate = Timestamp.fromMillis(updates.startDate);
        }

        await updateDoc(debtRef, cleanUpdates);
    } catch (error) {
        console.error('Error updating recurring debt:', error);
        throw new Error('Failed to update recurring debt');
    }
};

export const payMonthlyDebt = async (
    debtId: string,
    userId: string
): Promise<void> => {
    try {
        const debts = await getAllRecurringDebts(userId);
        const debt = debts.find(d => d.id === debtId);

        if (!debt) throw new Error('Debt not found');

        const newRemainingAmount = debt.remainingAmount - debt.monthlyPayment;
        const isActive = newRemainingAmount > 0;

        await updateRecurringDebt(debtId, {
            remainingAmount: Math.max(0, newRemainingAmount),
            isActive
        }, userId);
    } catch (error) {
        console.error('Error paying monthly debt:', error);
        throw new Error('Failed to pay monthly debt');
    }
};

export const ensureRecurringDebtBills = async (userId: string): Promise<void> => {
    const debts = (await getAllRecurringDebts(userId)).filter(debt => debt.isActive);
    const now = new Date();
    const currentMonthIndex = now.getFullYear() * 12 + now.getMonth();
    const pendingWrites: { ref: ReturnType<typeof doc>; data: Record<string, unknown> }[] = [];

    for (const debt of debts) {
        const installmentCount = Math.max(1, debt.totalInstallments || 1);
        const start = new Date(debt.startDate);
        const firstMonthIndex = start.getFullYear() * 12 + start.getMonth();
        const dueInstallments = Math.min(installmentCount, currentMonthIndex - firstMonthIndex + 1);

        for (let installmentNumber = 1; installmentNumber <= dueInstallments; installmentNumber += 1) {
            const monthIndex = firstMonthIndex + installmentNumber - 1;
            const year = Math.floor(monthIndex / 12);
            const month = monthIndex % 12;
            const lastDay = new Date(year, month + 1, 0).getDate();
            const dueDate = new Date(year, month, Math.min(debt.dueDay, lastDay), 12, 0, 0);
            const billRef = doc(db, `users/${userId}/transactions`, `${debt.id}_${installmentNumber}`);
            const billSnapshot = await getDoc(billRef);

            if (!billSnapshot.exists()) {
                pendingWrites.push({
                    ref: billRef,
                    data: {
                        type: TransactionType.EXPENSE,
                        amount: debt.monthlyPayment,
                        description: `${debt.investmentName ? `${debt.investmentName} - ` : ''}${debt.name} - Cuota ${installmentNumber}/${installmentCount}`,
                        accountId: debt.accountId,
                        date: Timestamp.fromDate(dueDate),
                        dueDate: Timestamp.fromDate(dueDate),
                        isPaid: false,
                        isPending: true,
                        categoryName: `Deuda: ${debt.investmentName ? `${debt.investmentName} - ` : ''}${debt.name}`,
                        recurringDebtId: debt.id,
                        installmentNumber,
                        createdAt: Timestamp.fromMillis(Date.now()),
                    },
                });
            }
        }
    }

    for (let offset = 0; offset < pendingWrites.length; offset += 450) {
        const batch = writeBatch(db);
        pendingWrites.slice(offset, offset + 450).forEach(({ ref, data }) => batch.set(ref, data));
        await batch.commit();
    }
};

export const payPendingBill = async (transactionId: string, paymentAccountId: string, userId: string): Promise<void> => {
    const billRef = doc(db, `users/${userId}/transactions`, transactionId);

    await runTransaction(db, async firestoreTransaction => {
        const billSnapshot = await firestoreTransaction.get(billRef);
        if (!billSnapshot.exists()) throw new Error('La factura no existe.');

        const bill = billSnapshot.data();
        if (!bill.isPending || bill.isPaid) throw new Error('Esta factura ya fue pagada.');

        const accountRef = doc(db, `users/${userId}/accounts`, paymentAccountId);
        const accountSnapshot = await firestoreTransaction.get(accountRef);
        if (!accountSnapshot.exists()) throw new Error('No se encontró la cuenta asociada a esta factura.');

        let debtRef;
        let debtSnapshot;
        if (bill.recurringDebtId) {
            debtRef = doc(db, `users/${userId}/recurringDebts`, bill.recurringDebtId);
            debtSnapshot = await firestoreTransaction.get(debtRef);
        }

        const accountData = accountSnapshot.data();
        const accountBalance = Number(accountData.balance) || 0;
        const billAmount = Number(bill.amount) || 0;
        const isCreditCard = accountData.type === AccountType.CREDIT_CARD;
        const creditLimit = Number(accountData.creditLimit) || 0;
        const creditAvailable = Number(accountData.creditAvailable ?? (creditLimit - accountBalance)) || 0;
        const availableToPay = isCreditCard ? creditAvailable : accountBalance;
        if (availableToPay < billAmount) {
            throw new Error(`Saldo insuficiente. La cuenta tiene $${availableToPay.toLocaleString()} disponibles y la factura requiere $${billAmount.toLocaleString()}.`);
        }
        if (isCreditCard) {
            firestoreTransaction.update(accountRef, {
                balance: accountBalance + billAmount,
                creditAvailable: creditAvailable - billAmount,
            });
        } else {
            firestoreTransaction.update(accountRef, { balance: accountBalance - billAmount });
        }
        firestoreTransaction.update(billRef, {
            isPaid: true,
            isPending: false,
            accountId: paymentAccountId,
        });

        if (debtRef && debtSnapshot?.exists()) {
            const debt = debtSnapshot.data();
            const installmentsPaid = (Number(debt.installmentsPaid) || 0) + 1;
            const totalInstallments = Math.max(1, Number(debt.totalInstallments) || 1);
            firestoreTransaction.update(debtRef, {
                remainingAmount: Math.max(0, (Number(debt.remainingAmount) || 0) - Number(bill.amount)),
                installmentsPaid,
                isActive: installmentsPaid < totalInstallments,
            });
        }
    });
};

export const deleteRecurringDebt = async (debtId: string, userId: string): Promise<void> => {
    try {
        const debtRef = doc(db, `users/${userId}/recurringDebts`, debtId);
        const linkedBillsQuery = query(
            collection(db, `users/${userId}/transactions`),
            where('recurringDebtId', '==', debtId)
        );
        const [debtSnapshot, linkedBillsSnapshot, accounts] = await Promise.all([
            getDoc(debtRef),
            getDocs(linkedBillsQuery),
            getAllAccounts(userId),
        ]);
        if (!debtSnapshot.exists()) return;

        const refundsByAccount = new Map<string, number>();
        linkedBillsSnapshot.docs.forEach(billDoc => {
            const bill = billDoc.data();
            if (bill.isPaid && bill.accountId) {
                refundsByAccount.set(
                    bill.accountId,
                    (refundsByAccount.get(bill.accountId) || 0) + Number(bill.amount || 0)
                );
            }
        });

        const accountById = new Map(accounts.map(account => [account.id, account]));
        const linkedBillDocs = linkedBillsSnapshot.docs;
        for (let offset = 0; offset < linkedBillDocs.length; offset += 450) {
            const batch = writeBatch(db);
            linkedBillDocs.slice(offset, offset + 450).forEach(billDoc => batch.delete(billDoc.ref));
            await batch.commit();
        }

        const batch = writeBatch(db);
        refundsByAccount.forEach((amount, accountId) => {
            const account = accountById.get(accountId);
            if (account) {
                batch.update(doc(db, `users/${userId}/accounts`, accountId), {
                    balance: (Number(account.balance) || 0) + amount,
                });
            }
        });
        batch.delete(debtRef);
        await batch.commit();
    } catch (error) {
        console.error('Error deleting recurring debt:', error);
        throw error;
    }
};

/**
 * Reset all budget data for a user
 * Deletes: accounts, transactions, categories, recurring debts
 * Does NOT delete: trades, custody_overrides (Dominic calendar)
 */
export const resetBudgetData = async (userId: string): Promise<void> => {
    try {
        console.log('[resetBudgetData] Starting budget data reset for user:', userId);

        // Helper function to delete documents in batches (Firebase limit: 500 operations per batch)
        const deleteInBatches = async (collectionPath: string, collectionName: string) => {
            const snapshot = await getDocs(collection(db, collectionPath));
            const docs = snapshot.docs;
            console.log(`[resetBudgetData] Found ${docs.length} ${collectionName} to delete`);

            if (docs.length === 0) return;

            // Process in chunks of 500
            const BATCH_SIZE = 500;
            for (let i = 0; i < docs.length; i += BATCH_SIZE) {
                const batch = writeBatch(db);
                const chunk = docs.slice(i, i + BATCH_SIZE);

                chunk.forEach(doc => {
                    batch.delete(doc.ref);
                });

                await batch.commit();
                console.log(`[resetBudgetData] Deleted ${chunk.length} ${collectionName} (batch ${Math.floor(i / BATCH_SIZE) + 1})`);
            }
        };

        // Delete all collections
        await deleteInBatches(`users/${userId}/accounts`, 'accounts');
        await deleteInBatches(`users/${userId}/transactions`, 'transactions');
        await deleteInBatches(`users/${userId}/categories`, 'categories');
        await deleteInBatches(`users/${userId}/recurringDebts`, 'recurring debts');

        console.log('[resetBudgetData] Budget data reset completed successfully');
    } catch (error) {
        console.error('[resetBudgetData] Error resetting budget data:', error);
        throw error; // Re-throw the original error for better debugging
    }
};
