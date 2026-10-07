import { Account, Transaction, TransactionType } from '../types';

export const calculateAccruedSavingsYield = (
    account: Account,
    transactions: Transaction[],
    asOf = Date.now()
): number => {
    const annualRate = Number(account.savingsYieldRateAnnual) || 0;
    if (account.type !== 'SAVINGS' || annualRate <= 0 || account.createdAt > asOf) return 0;

    const dayKey = (timestamp: number) => {
        const date = new Date(timestamp);
        return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
    };
    const movementsByDay = new Map<string, number>();
    const accountStartDay = dayKey(account.createdAt);

    transactions.forEach(transaction => {
        if ((transaction.isPending && !transaction.isPaid) || transaction.date > asOf) return;
        const movementDay = dayKey(transaction.date);
        if (new Date(transaction.date).getTime() < new Date(account.createdAt).setHours(0, 0, 0, 0)) return;

        let movement = 0;
        if (transaction.accountId === account.id) {
            if (transaction.type === TransactionType.INCOME) movement += transaction.amount;
            if (transaction.type === TransactionType.EXPENSE || transaction.type === TransactionType.TRANSFER) movement -= transaction.amount;
        }
        if (transaction.type === TransactionType.TRANSFER && transaction.toAccountId === account.id) {
            movement += transaction.amount;
        }

        if (movement !== 0) movementsByDay.set(movementDay, (movementsByDay.get(movementDay) || 0) + movement);
    });

    const start = new Date(account.createdAt);
    start.setHours(0, 0, 0, 0);
    const end = new Date(asOf);
    end.setHours(0, 0, 0, 0);
    const dailyRate = Math.pow(1 + annualRate / 100, 1 / 365) - 1;
    let principal = 0;
    let accrued = 0;

    for (const date = new Date(start); date <= end; date.setDate(date.getDate() + 1)) {
        const movement = movementsByDay.get(dayKey(date.getTime())) || 0;
        principal = Math.max(0, principal + movement);
        accrued += (principal + accrued) * dailyRate;
    }

    return accrued;
};