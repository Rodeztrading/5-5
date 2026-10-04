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
    writeBatch
} from 'firebase/firestore';
import { db } from '../config/firebase';
import {
    Account,
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

        const docRef = await addDoc(collection(db, `users/${userId}/transactions`), cleanTransaction);

        // EXTRA LOGIC for 50/25/15/10 Strategy
        // If it's an expense from the STABILITY bucket, create a pending debt/bill automatically
        if (transaction.type === TransactionType.EXPENSE && transaction.bucketId === BudgetBucket.STABILITY && !transaction.isPending) {
            const debtTransaction: any = {
                type: TransactionType.EXPENSE,
                amount: transaction.amount,
                description: `Reponer: ${transaction.description}`,
                accountId: transaction.accountId,
                date: Timestamp.fromMillis(transaction.date),
                isPaid: false,
                isPending: true,
                dueDate: Timestamp.fromMillis(transaction.date + (30 * 24 * 60 * 60 * 1000)), // 30 days later
                categoryName: 'Deuda a Fondo de Estabilidad',
                createdAt: Timestamp.fromMillis(Date.now()),
            };
            await addDoc(collection(db, `users/${userId}/transactions`), debtTransaction);
        }

        // Update account balance ONLY if it's not a pending bill or if it is paid
        if (!transaction.isPending || transaction.isPaid) {
            const accounts = await getAllAccounts(userId);
            const account = accounts.find(a => a.id === transaction.accountId);

            if (account) {
                let newBalance = account.balance;

                if (transaction.type === TransactionType.INCOME) {
                    newBalance += transaction.amount;
                } else if (transaction.type === TransactionType.EXPENSE) {
                    newBalance -= transaction.amount;
                } else if (transaction.type === TransactionType.TRANSFER && transaction.toAccountId) {
                    newBalance -= transaction.amount;
                    // Update destination account
                    const toAccount = accounts.find(a => a.id === transaction.toAccountId);
                    if (toAccount) {
                        const toNewBalance = (toAccount.balance || 0) + transaction.amount;
                        await updateAccount(transaction.toAccountId, {
                            balance: toNewBalance,
                        }, userId);
                    } else {
                        console.error('Destination account not found:', transaction.toAccountId);
                        throw new Error('La cuenta de destino no existe. No se pudo completar la transferencia.');
                    }
                }

                await updateAccount(transaction.accountId, { balance: newBalance }, userId);
            }
        }

        return {
            ...transaction,
            id: docRef.id,
            createdAt: Date.now(),
        };
    } catch (error) {
        console.error('Error creating transaction:', error);
        throw new Error('Failed to create transaction');
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
        const totalBalance = accounts.reduce((sum, acc) => sum + acc.balance, 0);

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

export const deleteRecurringDebt = async (debtId: string, userId: string): Promise<void> => {
    try {
        const debtRef = doc(db, `users/${userId}/recurringDebts`, debtId);
        await deleteDoc(debtRef);
    } catch (error) {
        console.error('Error deleting recurring debt:', error);
        throw new Error('Failed to delete recurring debt');
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
