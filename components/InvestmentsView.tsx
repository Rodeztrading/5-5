import React from 'react';
import { Account, RecurringDebt, Transaction, TransactionType, BudgetBucket } from '../types';
import { ArrowDownToLine, ArrowUpFromLine, Building2, Plus, TrendingUp } from 'lucide-react';

interface InvestmentsViewProps {
    accounts: Account[];
    transactions: Transaction[];
    debts: RecurringDebt[];
    onAddContribution: (investmentName: string) => void;
    onAddIncome: (investmentName: string) => void;
    onCreateInvestment: () => void;
}

const money = (amount: number) => `$${amount.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;

export const InvestmentsView: React.FC<InvestmentsViewProps> = ({
    accounts,
    transactions,
    debts,
    onAddContribution,
    onAddIncome,
    onCreateInvestment,
}) => {
    const investmentNames = Array.from(new Set([
        ...transactions
            .filter(transaction => transaction.investmentName && (
                transaction.type === TransactionType.INCOME && transaction.isInvestmentReturn ||
                transaction.type === TransactionType.EXPENSE && transaction.bucketId === BudgetBucket.INVESTMENT
            ))
            .map(transaction => transaction.investmentName as string),
        ...debts.map(debt => debt.investmentName).filter((name): name is string => !!name),
    ])).sort((a, b) => a.localeCompare(b));

    const currentMonth = new Date().toISOString().slice(0, 7);

    return (
        <section className="space-y-5">
            <header className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-800 pb-4">
                <div>
                    <h2 className="flex items-center gap-2 text-xl font-bold text-white">
                        <Building2 className="h-5 w-5 text-green-400" /> Inversiones
                    </h2>
                    <p className="mt-1 text-sm text-gray-400">Aportes, ingresos y obligaciones por activo</p>
                </div>
                <button onClick={onCreateInvestment} disabled={!accounts.length} className="flex items-center gap-2 rounded bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-40">
                    <Plus className="h-4 w-4" /> Nueva inversión
                </button>
            </header>

            {investmentNames.length === 0 ? (
                <div className="border border-dashed border-gray-700 px-6 py-12 text-center">
                    <Building2 className="mx-auto mb-3 h-10 w-10 text-gray-600" />
                    <h3 className="font-semibold text-white">Todavía no hay inversiones</h3>
                    <p className="mt-1 text-sm text-gray-400">Registra un aporte para crear la primera ficha del activo.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                    {investmentNames.map(name => {
                        const investmentTransactions = transactions.filter(transaction => transaction.investmentName === name);
                        const contributions = investmentTransactions.filter(transaction =>
                            transaction.type === TransactionType.EXPENSE && transaction.bucketId === BudgetBucket.INVESTMENT
                        );
                        const returns = investmentTransactions.filter(transaction =>
                            transaction.type === TransactionType.INCOME && transaction.isInvestmentReturn
                        );
                        const linkedDebts = debts.filter(debt => debt.investmentName === name);
                        const linkedDebtIds = new Set(linkedDebts.map(debt => debt.id));
                        const installmentTransactions = transactions.filter(transaction =>
                            transaction.recurringDebtId && linkedDebtIds.has(transaction.recurringDebtId)
                        );
                        const recentMovements = [...contributions, ...returns, ...installmentTransactions]
                            .sort((a, b) => b.date - a.date)
                            .slice(0, 4);
                        const currentMonthIncome = returns
                            .filter(transaction => new Date(transaction.date).toISOString().slice(0, 7) === currentMonth)
                            .reduce((sum, transaction) => sum + transaction.amount, 0);
                        const monthlyInstallments = linkedDebts
                            .filter(debt => debt.isActive)
                            .reduce((sum, debt) => sum + debt.monthlyPayment, 0);
                        const totalContribution = contributions.reduce((sum, transaction) => sum + transaction.amount, 0);
                        const totalIncome = returns.reduce((sum, transaction) => sum + transaction.amount, 0);
                        const totalFinancing = linkedDebts.reduce((sum, debt) => sum + debt.totalAmount, 0);
                        const outstandingDebt = linkedDebts.reduce((sum, debt) => sum + debt.remainingAmount, 0);

                        return (
                            <article key={name} className="border border-gray-800 bg-gray-900/70 p-5">
                                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-gray-800 pb-4">
                                    <div>
                                        <h3 className="text-lg font-semibold text-white">{name}</h3>
                                        <p className="mt-1 text-xs text-gray-500">
                                            {contributions.length} {contributions.length === 1 ? 'aporte' : 'aportes'} · {returns.length} {returns.length === 1 ? 'ingreso' : 'ingresos'} · {linkedDebts.length} {linkedDebts.length === 1 ? 'deuda' : 'deudas'}
                                        </p>
                                    </div>
                                    <div className="flex gap-2">
                                        <button onClick={() => onAddContribution(name)} disabled={!accounts.length} title="Agregar aporte" aria-label={`Agregar aporte a ${name}`} className="rounded border border-gray-700 p-2 text-green-400 hover:bg-gray-800 disabled:opacity-40">
                                            <ArrowDownToLine className="h-4 w-4" />
                                        </button>
                                        <button onClick={() => onAddIncome(name)} disabled={!accounts.length} title="Registrar ingreso" aria-label={`Registrar ingreso de ${name}`} className="rounded border border-gray-700 p-2 text-blue-400 hover:bg-gray-800 disabled:opacity-40">
                                            <ArrowUpFromLine className="h-4 w-4" />
                                        </button>
                                    </div>
                                </div>

                                <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-4">
                                    <div>
                                        <dt className="text-xs text-gray-400">Aportes acumulados</dt>
                                        <dd className="mt-1 text-base font-semibold text-white">{money(totalContribution)}</dd>
                                    </div>
                                    <div>
                                        <dt className="text-xs text-gray-400">Capital aplicado (aportes + financiación)</dt>
                                        <dd className="mt-1 text-base font-semibold text-white">{money(totalContribution + totalFinancing)}</dd>
                                    </div>
                                    <div>
                                        <dt className="text-xs text-gray-400">Ingresos acumulados</dt>
                                        <dd className="mt-1 text-base font-semibold text-green-400">{money(totalIncome)}</dd>
                                    </div>
                                    <div>
                                        <dt className="text-xs text-gray-400">Deuda pendiente</dt>
                                        <dd className="mt-1 text-base font-semibold text-red-400">{money(outstandingDebt)}</dd>
                                    </div>
                                    <div>
                                        <dt className="text-xs text-gray-400">Cuotas mensuales activas</dt>
                                        <dd className="mt-1 text-base font-semibold text-white">{money(monthlyInstallments)}</dd>
                                    </div>
                                </dl>

                                <div className="mt-4 flex items-center justify-between border-t border-gray-800 pt-3">
                                    <span className="flex items-center gap-2 text-sm text-gray-300">
                                        <TrendingUp className="h-4 w-4 text-green-400" /> Flujo estimado este mes
                                    </span>
                                    <strong className={currentMonthIncome - monthlyInstallments >= 0 ? 'text-green-400' : 'text-red-400'}>
                                        {money(currentMonthIncome - monthlyInstallments)}
                                    </strong>
                                </div>

                                <div className="mt-3 space-y-1 text-xs text-gray-500">
                                    {linkedDebts.map(debt => (
                                        <p key={debt.id}>
                                            {debt.name}: {debt.installmentsPaid || 0}/{debt.totalInstallments || 1} cuotas pagadas
                                        </p>
                                    ))}
                                </div>

                                {recentMovements.length > 0 && (
                                    <div className="mt-4 border-t border-gray-800 pt-3">
                                        <h4 className="mb-2 text-xs font-semibold uppercase text-gray-400">Actividad reciente</h4>
                                        <ul className="space-y-2">
                                            {recentMovements.map(movement => (
                                                <li key={movement.id} className="flex items-center justify-between gap-3 text-xs">
                                                    <span className="min-w-0 truncate text-gray-300">
                                                        {movement.description}
                                                        <span className="ml-2 text-gray-500">{new Date(movement.date).toLocaleDateString()}</span>
                                                    </span>
                                                    <strong className={movement.type === TransactionType.INCOME ? 'shrink-0 text-green-400' : 'shrink-0 text-gray-300'}>
                                                        {movement.type === TransactionType.INCOME ? '+' : '-'}{money(movement.amount)}
                                                    </strong>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                            </article>
                        );
                    })}
                </div>
            )}
        </section>
    );
};