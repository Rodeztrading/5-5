// BillsView.tsx - Gestión de facturas y deudas simples
import React, { useState, useEffect } from 'react';
import { Transaction, Account, AccountType, RecurringDebt } from '../types';
import {
    createRecurringDebt,
    deleteRecurringDebt,
    ensureRecurringDebtBills,
    getAllRecurringDebts,
    getAllTransactions,
    payPendingBill,
} from '../services/budgetService';
import { useAuth } from '../hooks/useAuth';
import { AlertCircle, Calendar, Check, Plus, Trash2, CreditCard, X } from 'lucide-react';

interface BillsViewProps {
    accounts: Account[];
    onRefresh: () => void;
}

export const BillsView: React.FC<BillsViewProps> = ({ accounts, onRefresh }) => {
    const { user } = useAuth();
    const [pendingBills, setPendingBills] = useState<Transaction[]>([]);
    const [debts, setDebts] = useState<RecurringDebt[]>([]);
    const [loading, setLoading] = useState(true);
    const [showAddDebt, setShowAddDebt] = useState(false);
    const [billToPay, setBillToPay] = useState<Transaction | null>(null);
    const [paymentAccountId, setPaymentAccountId] = useState('');
    const [payingBill, setPayingBill] = useState(false);

    // Form state
    const [debtName, setDebtName] = useState('');
    const [debtAmount, setDebtAmount] = useState('');
    const [monthlyPayment, setMonthlyPayment] = useState('');
    const [totalInstallments, setTotalInstallments] = useState('');
    const [dueDay, setDueDay] = useState('15');
    const [debtAccountId, setDebtAccountId] = useState(accounts[0]?.id || '');

    useEffect(() => {
        if (!debtAccountId && accounts.length > 0) setDebtAccountId(accounts[0].id);
    }, [accounts, debtAccountId]);

    useEffect(() => {
        if (user) {
            loadData();
        }
    }, [user]);

    const loadData = async () => {
        if (!user) return;
        try {
            setLoading(true);
            await ensureRecurringDebtBills(user.uid);
            const [transactions, debtData] = await Promise.all([
                getAllTransactions(user.uid),
                getAllRecurringDebts(user.uid),
            ]);
            const pending = transactions.filter(t => t.isPending && !t.isPaid);
            setPendingBills(pending);
            setDebts(debtData);
        } catch (e) {
            console.error('Error loading data', e);
        } finally {
            setLoading(false);
        }
    };

    const handlePayBill = async () => {
        if (!user || !billToPay || !paymentAccountId) return;
        try {
            setPayingBill(true);
            await payPendingBill(billToPay.id, paymentAccountId, user.uid);
            setBillToPay(null);
            await loadData();
            onRefresh();
        } catch (e) {
            console.error('Error pagando factura', e);
            alert(e instanceof Error ? e.message : 'Error al pagar la factura');
        } finally {
            setPayingBill(false);
        }
    };

    const openPaymentDialog = (bill: Transaction) => {
        setBillToPay(bill);
        setPaymentAccountId(bill.accountId || accounts[0]?.id || '');
    };

    const handleAddDebt = async () => {
        const principal = Number(debtAmount);
        const payment = Number(monthlyPayment);
        const installmentCount = Number(totalInstallments);
        const dueDayNumber = Number(dueDay);
        if (
            !user || !debtName.trim() || principal <= 0 || payment <= 0 ||
            !Number.isInteger(installmentCount) || installmentCount <= 0 ||
            !Number.isInteger(dueDayNumber) || dueDayNumber < 1 || dueDayNumber > 31 || !debtAccountId
        ) {
            alert('Por favor completa todos los campos');
            return;
        }
        try {
            await createRecurringDebt({
                name: debtName.trim(),
                totalAmount: principal,
                remainingAmount: principal,
                monthlyPayment: payment,
                totalInstallments: installmentCount,
                installmentsPaid: 0,
                accountId: debtAccountId,
                startDate: Date.now(),
                dueDay: dueDayNumber,
                isActive: true,
            }, user.uid);

            await ensureRecurringDebtBills(user.uid);
            await loadData();
            setDebtName('');
            setDebtAmount('');
            setMonthlyPayment('');
            setTotalInstallments('');
            setDueDay('15');
            setShowAddDebt(false);
            onRefresh();
        } catch (e) {
            console.error('Error añadiendo deuda', e);
            alert('Error al crear la deuda');
        }
    };

    const handleDeleteDebt = async (id: string) => {
        if (!user || !confirm('¿Eliminar esta deuda y todas sus facturas vinculadas? Si ya pagaste cuotas, esos importes se devolverán a las cuentas usadas.')) return;
        try {
            await deleteRecurringDebt(id, user.uid);
            await loadData();
            onRefresh();
        } catch (e) {
            console.error('Error eliminando deuda', e);
            alert(e instanceof Error ? e.message : 'Error al eliminar la deuda');
        }
    };

    const totalPendingBills = pendingBills.reduce((a, b) => a + b.amount, 0);
    const totalDebts = debts.reduce((sum, debt) => sum + (Number(debt.remainingAmount) || 0), 0);
    const scheduledTotal = (Number(monthlyPayment) || 0) * (Number(totalInstallments) || 0);
    const selectedPaymentAccount = accounts.find(account => account.id === paymentAccountId);
    const paymentAvailable = selectedPaymentAccount?.type === AccountType.CREDIT_CARD
        ? Number(selectedPaymentAccount.creditAvailable) || 0
        : selectedPaymentAccount?.balance || 0;
    const hasEnoughBalance = !!selectedPaymentAccount && paymentAvailable >= (billToPay?.amount || 0);

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Facturas */}
            <div className="min-w-0 rounded-lg border border-gray-700 bg-gray-800/70 p-4 sm:p-6">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-3 border-b border-gray-700/70 pb-4">
                    <div>
                        <h2 className="text-xl font-bold text-white flex items-center">
                            <AlertCircle className="w-5 h-5 mr-2 text-yellow-500" /> Facturas Pendientes
                        </h2>
                        <p className="text-sm text-gray-400 mt-1">Pagos pendientes de este mes</p>
                    </div>
                    <div className="text-right">
                        <p className="text-sm text-gray-400">Total por Pagar</p>
                        <p className="text-2xl font-bold text-red-400">${totalPendingBills.toLocaleString()}</p>
                    </div>
                </div>
                {loading ? (
                    <div className="text-center py-8 text-gray-500">Cargando facturas...</div>
                ) : pendingBills.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                        <Check className="w-12 h-12 mx-auto mb-2 text-green-500" />
                        <p>No tienes facturas pendientes</p>
                        <p className="text-sm mt-2 text-gray-600">Crea una transacción de tipo "Gasto" y marca "Pendiente de Pago"</p>
                    </div>
                ) : (
                    <div className="divide-y divide-gray-700/70">
                        {pendingBills.map(bill => (
                            <div key={bill.id} className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 py-3 first:pt-1 last:pb-1">
                                <div className="flex min-w-0 items-start gap-3">
                                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-yellow-500" />
                                    <div className="min-w-0">
                                        <h3 className="truncate text-sm font-medium text-white">{bill.description}</h3>
                                        <div className="mt-1 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-400">
                                        {bill.date && (
                                                <span className="flex items-center"><Calendar className="mr-1 h-3.5 w-3.5 shrink-0" /> {new Date(typeof bill.date === 'object' ? (bill.date as any).toMillis() : bill.date).toLocaleDateString('es-CO')}</span>
                                        )}
                                        {bill.categoryName && (
                                                <span className="break-words">{bill.categoryName}</span>
                                        )}
                                        </div>
                                    </div>
                                </div>
                                <div className="flex shrink-0 flex-col items-end gap-2 sm:flex-row sm:items-center">
                                    <span className="whitespace-nowrap text-sm font-semibold text-red-400">${bill.amount.toLocaleString()}</span>
                                    <button onClick={() => openPaymentDialog(bill)} className="rounded bg-green-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-green-700 sm:px-4 sm:py-2 sm:text-sm">Pagar</button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Deudas */}
            <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
                <div className="flex justify-between items-center mb-4">
                    <div>
                        <h2 className="text-xl font-bold text-white flex items-center">
                            <CreditCard className="w-5 h-5 mr-2 text-blue-500" /> Deudas Generales
                        </h2>
                        <p className="text-sm text-gray-400 mt-1">Registro de deudas a largo plazo</p>
                    </div>
                    <button onClick={() => setShowAddDebt(true)} className="px-4 py-2 bg-rodez-red hover:bg-blue-600 text-white rounded-lg flex items-center space-x-2 text-sm"><Plus className="w-4 h-4" /> <span>Nueva Deuda</span></button>
                </div>

                {/* Formulario */}
                {showAddDebt && (
                    <div className="bg-gray-900/50 rounded-lg p-4 mb-4 border border-gray-700">
                        <h3 className="font-semibold text-white mb-3">Registrar Nueva Deuda</h3>
                        <div className="space-y-3">
                            <div>
                                <label className="block text-sm text-gray-400 mb-1">Nombre de la Deuda</label>
                                <input type="text" value={debtName} onChange={e => setDebtName(e.target.value)} placeholder="Ej: Préstamo Carro" className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-rodez-red" />
                            </div>
                            <div>
                                <label className="block text-sm text-gray-400 mb-1">Monto Total</label>
                                <input type="number" min="1" value={debtAmount} onChange={e => setDebtAmount(e.target.value)} placeholder="9000000" className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-rodez-red" />
                            </div>
                            <div>
                                <label className="block text-sm text-gray-400 mb-1">Cuota del mes</label>
                                <input type="number" min="1" value={monthlyPayment} onChange={e => setMonthlyPayment(e.target.value)} placeholder="500000" className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-rodez-red" />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-sm text-gray-400 mb-1">Número de cuotas</label>
                                    <input type="number" min="1" step="1" value={totalInstallments} onChange={e => setTotalInstallments(e.target.value)} placeholder="30" className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-rodez-red" />
                                </div>
                                <div>
                                    <label className="block text-sm text-gray-400 mb-1">Día límite de pago</label>
                                    <input type="number" min="1" max="31" step="1" value={dueDay} onChange={e => setDueDay(e.target.value)} className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-rodez-red" />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm text-gray-400 mb-1">Cuenta para pagar</label>
                                <select value={debtAccountId} onChange={e => setDebtAccountId(e.target.value)} className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-rodez-red" required>
                                    <option value="" disabled>Selecciona una cuenta</option>
                                    {accounts.map(account => <option key={account.id} value={account.id}>{account.name}</option>)}
                                </select>
                            </div>
                        </div>
                        {(debtAmount || monthlyPayment || totalInstallments) && (
                            <div className="mt-3 rounded border border-gray-700 bg-gray-800/70 p-3 text-sm">
                                <p className="text-gray-300">M.t. <strong className="text-white">${(Number(debtAmount) || 0).toLocaleString()}</strong></p>
                                <p className="text-gray-300">C.m. <strong className="text-white">${(Number(monthlyPayment) || 0).toLocaleString()}</strong> x <strong className="text-white">{Number(totalInstallments) || 0} cuotas</strong></p>
                                <p className="mt-1 text-gray-300">Total programado: <strong className="text-rodez-red">${scheduledTotal.toLocaleString()}</strong></p>
                            </div>
                        )}
                        <div className="flex justify-end space-x-2 mt-3">
                            <button onClick={() => setShowAddDebt(false)} className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-white rounded text-sm">Cancelar</button>
                            <button onClick={handleAddDebt} disabled={!accounts.length} className="px-3 py-1.5 bg-rodez-red hover:bg-blue-600 disabled:opacity-50 text-white rounded text-sm">Guardar</button>
                        </div>
                    </div>
                )}

                {/* Resumen */}
                {debts.length > 0 && (
                    <div className="bg-gray-900/50 rounded-lg p-4 mb-4">
                        <p className="text-sm text-gray-400">Saldo pendiente de deudas</p>
                        <p className="text-3xl font-bold text-red-400">${totalDebts.toLocaleString()}</p>
                    </div>
                )}

                {/* Lista de deudas */}
                {loading ? (
                    <div className="text-center py-8 text-gray-500">Cargando deudas...</div>
                ) : debts.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                        <CreditCard className="w-12 h-12 mx-auto mb-2 text-gray-600" />
                        <p>No tienes deudas registradas</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {debts.map(debt => (
                            <div key={debt.id} className="bg-gray-900/50 rounded-lg p-4 hover:bg-gray-900 transition-colors">
                                <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                        <h3 className="font-medium text-white text-lg">{debt.name}</h3>
                                        {debt.investmentName && <p className="text-sm text-green-300 mt-1">Inversión asociada: {debt.investmentName}</p>}
                                        <p className="text-sm text-gray-400 mt-1">Registrada el {new Date(debt.createdAt).toLocaleDateString()}</p>
                                        <p className="text-sm text-gray-300 mt-2">Monto inicial: <strong className="text-white">${debt.totalAmount.toLocaleString()}</strong></p>
                                        <p className="text-sm text-gray-300">Cuota: <strong className="text-white">${debt.monthlyPayment.toLocaleString()}</strong> x <strong className="text-white">{debt.totalInstallments || 1} cuotas</strong></p>
                                        <p className="text-sm text-gray-300">Pagadas: {debt.installmentsPaid || 0}/{debt.totalInstallments || 1} · Vence el día {debt.dueDay}</p>
                                        <p className="text-sm text-gray-300">Total programado: <strong className="text-rodez-red">${(debt.monthlyPayment * (debt.totalInstallments || 1)).toLocaleString()}</strong></p>
                                        <p className="text-xl font-bold text-red-400 mt-2">Saldo deuda: ${debt.remainingAmount.toLocaleString()}</p>
                                    </div>
                                    <button onClick={() => handleDeleteDebt(debt.id)} title="Eliminar deuda y sus facturas vinculadas" className="text-gray-500 hover:text-red-400 transition-colors p-2"><Trash2 className="w-5 h-5" /></button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
            {billToPay && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" role="presentation">
                    <div className="w-full max-w-md rounded-lg border border-gray-700 bg-gray-900 p-6 shadow-2xl" role="dialog" aria-modal="true" aria-labelledby="payment-dialog-title">
                        <div className="mb-5 flex items-center justify-between">
                            <h2 id="payment-dialog-title" className="text-lg font-semibold text-white">Pagar factura</h2>
                            <button type="button" onClick={() => setBillToPay(null)} disabled={payingBill} className="text-gray-400 hover:text-white" aria-label="Cerrar">
                                <X className="h-5 w-5" />
                            </button>
                        </div>
                        <p className="mb-1 text-sm text-gray-300">{billToPay.description}</p>
                        <p className="mb-4 text-xl font-bold text-red-400">${billToPay.amount.toLocaleString()}</p>
                        <label htmlFor="payment-account" className="mb-2 block text-sm text-gray-300">Medio de pago</label>
                        <select
                            id="payment-account"
                            value={paymentAccountId}
                            onChange={event => setPaymentAccountId(event.target.value)}
                            className="w-full rounded border border-gray-600 bg-gray-800 px-3 py-2 text-white focus:border-rodez-red focus:outline-none"
                            required
                        >
                            <option value="" disabled>Selecciona una cuenta</option>
                            {accounts.map(account => (
                                <option key={account.id} value={account.id}>
                                    {account.name} · Disponible ${(
                                        account.type === AccountType.CREDIT_CARD ? account.creditAvailable || 0 : account.balance
                                    ).toLocaleString()}
                                </option>
                            ))}
                        </select>
                        {selectedPaymentAccount && !hasEnoughBalance && (
                            <p className="mt-2 text-sm text-red-400" role="alert">
                                Saldo insuficiente: disponible ${paymentAvailable.toLocaleString()}, factura ${billToPay.amount.toLocaleString()}.
                            </p>
                        )}
                        <div className="mt-6 flex justify-end gap-3">
                            <button type="button" onClick={() => setBillToPay(null)} disabled={payingBill} className="rounded bg-gray-700 px-4 py-2 text-sm text-white hover:bg-gray-600 disabled:opacity-50">Cancelar</button>
                            <button type="button" onClick={handlePayBill} disabled={!paymentAccountId || !hasEnoughBalance || payingBill} className="rounded bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50">
                                {payingBill ? 'Procesando...' : 'Confirmar pago'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
