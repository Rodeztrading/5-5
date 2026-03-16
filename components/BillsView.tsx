// BillsView.tsx - Gestión de facturas y deudas simples
import React, { useState, useEffect } from 'react';
import { Transaction, Account, Subcategory } from '../types';
import { getAllTransactions, updateTransaction, getCategories, updateCategory } from '../services/budgetService';
import { useAuth } from '../hooks/useAuth';
import { AlertCircle, Calendar, Check, Plus, Trash2, CreditCard } from 'lucide-react';

interface BillsViewProps {
    accounts: Account[];
    onRefresh: () => void;
}

interface SimpleDebt {
    id: string;
    name: string;
    totalAmount: number;
    createdAt: number;
}

export const BillsView: React.FC<BillsViewProps> = ({ accounts, onRefresh }) => {
    const { user } = useAuth();
    const [pendingBills, setPendingBills] = useState<Transaction[]>([]);
    const [debts, setDebts] = useState<SimpleDebt[]>([]);
    const [loading, setLoading] = useState(true);
    const [showAddDebt, setShowAddDebt] = useState(false);

    // Form state
    const [debtName, setDebtName] = useState('');
    const [debtAmount, setDebtAmount] = useState('');

    useEffect(() => {
        if (user) {
            loadData();
        }
    }, [user]);

    const loadData = async () => {
        if (!user) return;
        try {
            setLoading(true);
            const transactions = await getAllTransactions(user.uid);
            const pending = transactions.filter(t => t.isPending && !t.isPaid);
            setPendingBills(pending);


        } catch (e) {
            console.error('Error loading data', e);
        } finally {
            setLoading(false);
        }
    };

    const handlePayBill = async (bill: Transaction) => {
        if (!user || !confirm(`¿Pagar factura de $${bill.amount.toLocaleString()}?`)) return;
        try {
            await updateTransaction(bill.id, { isPaid: true, isPending: false }, user.uid);
            await loadData();
            onRefresh();
        } catch (e) {
            console.error('Error pagando factura', e);
            alert('Error al pagar la factura');
        }
    };

    const handleAddDebt = async () => {
        if (!user || !debtName.trim() || !debtAmount) {
            alert('Por favor completa todos los campos');
            return;
        }
        try {
            const newDebt: SimpleDebt = {
                id: crypto.randomUUID(),
                name: debtName.trim(),
                totalAmount: parseFloat(debtAmount),
                createdAt: Date.now(),
            };
            const updated = [...debts, newDebt];
            setDebts(updated);


            // Crear subcategoría en Facturas
            const categories = await getCategories(user.uid);
            const facturas = categories.find(c => c.name === 'Facturas');
            if (facturas) {
                const newSub: Subcategory = {
                    id: `debt_${newDebt.id}`,
                    name: newDebt.name,
                    isDefault: false,
                };
                const subs = [...facturas.subcategories, newSub];
                await updateCategory(facturas.id, { subcategories: subs }, user.uid);
                console.log('Subcategoría de deuda creada');
            }

            setDebtName('');
            setDebtAmount('');
            setShowAddDebt(false);
            onRefresh();
        } catch (e) {
            console.error('Error añadiendo deuda', e);
            alert('Error al crear la deuda');
        }
    };

    const handleDeleteDebt = async (id: string) => {
        if (!user || !confirm('¿Eliminar esta deuda?')) return;
        try {
            const updated = debts.filter(d => d.id !== id);
            setDebts(updated);


            // Eliminar subcategoría de Facturas
            const categories = await getCategories(user.uid);
            const facturas = categories.find(c => c.name === 'Facturas');
            if (facturas) {
                const subs = facturas.subcategories.filter(sc => sc.id !== `debt_${id}`);
                await updateCategory(facturas.id, { subcategories: subs }, user.uid);
                console.log('Subcategoría de deuda eliminada');
            }

            onRefresh();
        } catch (e) {
            console.error('Error eliminando deuda', e);
            alert('Error al eliminar la deuda');
        }
    };

    const totalPendingBills = pendingBills.reduce((a, b) => a + b.amount, 0);
    const totalDebts = debts.reduce((a, b) => a + b.totalAmount, 0);

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Facturas */}
            <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
                <div className="flex justify-between items-center mb-4">
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
                    <div className="space-y-3">
                        {pendingBills.map(bill => (
                            <div key={bill.id} className="bg-gray-900/50 rounded-lg p-4 flex items-center justify-between hover:bg-gray-900 transition-colors">
                                <div className="flex-1">
                                    <h3 className="font-medium text-white">{bill.description}</h3>
                                    <div className="flex items-center space-x-4 mt-1 text-sm text-gray-400">
                                        {bill.date && (
                                            <span className="flex items-center"><Calendar className="w-4 h-4 mr-1" /> {new Date(typeof bill.date === 'object' ? (bill.date as any).toMillis() : bill.date).toLocaleDateString()}</span>
                                        )}
                                        {bill.categoryName && (
                                            <span className="px-2 py-0.5 bg-gray-700 rounded text-xs">{bill.categoryName}</span>
                                        )}
                                    </div>
                                </div>
                                <div className="flex items-center space-x-4">
                                    <span className="text-lg font-bold text-red-400">${bill.amount.toLocaleString()}</span>
                                    <button onClick={() => handlePayBill(bill)} className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors text-sm font-medium">Pagar</button>
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
                                <input type="number" value={debtAmount} onChange={e => setDebtAmount(e.target.value)} placeholder="200000000" className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-rodez-red" />
                            </div>
                        </div>
                        <div className="flex justify-end space-x-2 mt-3">
                            <button onClick={() => setShowAddDebt(false)} className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-white rounded text-sm">Cancelar</button>
                            <button onClick={handleAddDebt} className="px-3 py-1.5 bg-rodez-red hover:bg-blue-600 text-white rounded text-sm">Guardar</button>
                        </div>
                    </div>
                )}

                {/* Resumen */}
                {debts.length > 0 && (
                    <div className="bg-gray-900/50 rounded-lg p-4 mb-4">
                        <p className="text-sm text-gray-400">Deuda Total Registrada</p>
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
                                        <p className="text-sm text-gray-400 mt-1">Registrada el {new Date(debt.createdAt).toLocaleDateString()}</p>
                                        <p className="text-2xl font-bold text-red-400 mt-2">${debt.totalAmount.toLocaleString()}</p>
                                    </div>
                                    <button onClick={() => handleDeleteDebt(debt.id)} className="text-gray-500 hover:text-red-400 transition-colors p-2"><Trash2 className="w-5 h-5" /></button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};
