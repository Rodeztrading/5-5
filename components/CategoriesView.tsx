import React, { useState, useEffect } from 'react';
import { Category, Subcategory, TransactionType, BudgetBucket } from '../types';
import { getCategories, saveCategory, updateCategory, deleteCategory, getEffectiveCategoryBucket, isProtectedRewardsCategory } from '../services/budgetService';
import { useAuth } from '../hooks/useAuth';
import { Plus, Edit2, Trash2, ChevronDown, ChevronRight, Save, X, Check, DollarSign, TrendingUp, PiggyBank, Smile } from 'lucide-react';
import { useBrandedConfirm } from './BrandedConfirmDialog';

const PRESET_COLORS = [
    '#FF5252', '#E91E63', '#9C27B0', '#673AB7',
    '#3F51B5', '#2196F3', '#03A9F4', '#00BCD4',
    '#009688', '#4CAF50', '#8BC34A', '#CDDC39',
    '#FFC107', '#FF9800', '#FF5722', '#795548'
];

type CategoryFilterTab = BudgetBucket.ESSENTIAL | BudgetBucket.INVESTMENT | BudgetBucket.STABILITY | BudgetBucket.REWARDS | 'INCOME';

const BUCKET_CONFIG: Record<BudgetBucket, { label: string; pct: number; color: string; bg: string; border: string }> = {
    [BudgetBucket.ESSENTIAL]: { label: 'Gastos Esenciales', pct: 50, color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/30' },
    [BudgetBucket.INVESTMENT]: { label: 'Inversión', pct: 25, color: 'text-green-400', bg: 'bg-green-500/10', border: 'border-green-500/30' },
    [BudgetBucket.STABILITY]: { label: 'Fondo de Estabilidad', pct: 15, color: 'text-yellow-400', bg: 'bg-yellow-500/10', border: 'border-yellow-500/30' },
    [BudgetBucket.REWARDS]: { label: 'Recompensas', pct: 10, color: 'text-purple-400', bg: 'bg-purple-500/10', border: 'border-purple-500/30' },
    [BudgetBucket.OTHER]: { label: 'Otro', pct: 0, color: 'text-gray-400', bg: 'bg-gray-500/10', border: 'border-gray-500/30' },
};

interface CategoriesViewProps {
    canManage: boolean;
    onRequireSubscription: () => void;
}

export const CategoriesView: React.FC<CategoriesViewProps> = ({ canManage, onRequireSubscription }) => {
    const { user } = useAuth();
    const { confirm: confirmAction, dialog: confirmDialog } = useBrandedConfirm();
    const [categories, setCategories] = useState<Category[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeFilterTab, setActiveFilterTab] = useState<CategoryFilterTab>(BudgetBucket.ESSENTIAL);

    const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
    const [editingCategory, setEditingCategory] = useState<string | null>(null);
    const [editingCategoryName, setEditingCategoryName] = useState('');
    const [editingCategoryColor, setEditingCategoryColor] = useState('');
    const [editingCategoryBucket, setEditingCategoryBucket] = useState<BudgetBucket>(BudgetBucket.ESSENTIAL);

    const [newSubcategoryName, setNewSubcategoryName] = useState('');
    const [addingSubcategoryTo, setAddingSubcategoryTo] = useState<string | null>(null);
    const [newSubcategoryIsFixed, setNewSubcategoryIsFixed] = useState(false);
    const [newSubcategoryAmount, setNewSubcategoryAmount] = useState('');
    const [newSubcategoryDueDay, setNewSubcategoryDueDay] = useState('15');
    const [editingFixedSubcategoryId, setEditingFixedSubcategoryId] = useState<string | null>(null);

    // Add category state
    const [showAddCategory, setShowAddCategory] = useState(false);
    const [newCategoryName, setNewCategoryName] = useState('');
    const [newCategoryType, setNewCategoryType] = useState<TransactionType>(TransactionType.EXPENSE);
    const [newCategoryBucket, setNewCategoryBucket] = useState<BudgetBucket>(BudgetBucket.ESSENTIAL);
    const [newCategoryColor, setNewCategoryColor] = useState(PRESET_COLORS[0]);

    useEffect(() => {
        if (user) {
            loadCategories();
        }
    }, [user, canManage]);

    const loadCategories = async () => {
        if (!user) return;
        try {
            const data = await getCategories(user.uid, canManage);
            setCategories(data);
        } catch (error) {
            console.error('Error loading categories:', error);
        } finally {
            setLoading(false);
        }
    };

    const toggleExpand = (categoryId: string) => {
        const newExpanded = new Set(expandedCategories);
        if (newExpanded.has(categoryId)) {
            newExpanded.delete(categoryId);
        } else {
            newExpanded.add(categoryId);
        }
        setExpandedCategories(newExpanded);
    };

    const handleEditCategory = (category: Category) => {
        if (!canManage) {
            onRequireSubscription();
            return;
        }
        setEditingCategory(category.id);
        setEditingCategoryName(isProtectedRewardsCategory(category) ? 'Recompensas' : category.name);
        setEditingCategoryColor(category.color || PRESET_COLORS[0]);
        setEditingCategoryBucket(getEffectiveCategoryBucket(category));
    };

    const handleSaveCategory = async (categoryId: string) => {
        if (!canManage) {
            onRequireSubscription();
            return;
        }
        const category = categories.find(item => item.id === categoryId);
        if (!user || !category || !editingCategoryName.trim()) return;

        try {
            const updates: Partial<Category> = {
                name: isProtectedRewardsCategory(category)
                    ? 'Recompensas'
                    : editingCategoryName.trim(),
                color: editingCategoryColor,
                bucketId: isProtectedRewardsCategory(category)
                    ? BudgetBucket.REWARDS
                    : editingCategoryBucket
            };

            await updateCategory(categoryId, updates, user.uid);

            setCategories(prev => prev.map(c =>
                c.id === categoryId ? { ...c, ...updates } : c
            ));

            setEditingCategory(null);
            setEditingCategoryName('');
            setEditingCategoryColor('');
        } catch (error) {
            console.error('Error updating category:', error);
            alert('Error al actualizar la categoría');
        }
    };

    const openCreateModal = () => {
        if (!canManage) {
            onRequireSubscription();
            return;
        }
        if (activeFilterTab === 'INCOME') {
            setNewCategoryType(TransactionType.INCOME);
            setNewCategoryBucket(BudgetBucket.ESSENTIAL);
        } else {
            setNewCategoryType(TransactionType.EXPENSE);
            setNewCategoryBucket(activeFilterTab);
        }
        setShowAddCategory(true);
    };

    const handleAddNewCategory = async () => {
        if (!canManage) {
            onRequireSubscription();
            return;
        }
        if (!user || !newCategoryName.trim()) return;

        try {
            const newCategory: Omit<Category, 'id'> = {
                name: newCategoryName.trim(),
                type: newCategoryType,
                color: newCategoryColor,
                bucketId: newCategoryType === TransactionType.EXPENSE ? newCategoryBucket : undefined,
                subcategories: [],
                isDefault: false
            };

            const savedCategory = await saveCategory(newCategory, user.uid);
            setCategories(prev => [...prev, savedCategory]);

            setShowAddCategory(false);
            setNewCategoryName('');
            setNewCategoryType(TransactionType.EXPENSE);
            setNewCategoryColor(PRESET_COLORS[0]);
        } catch (error) {
            console.error('Error adding category:', error);
            alert('Error al crear la categoría');
        }
    };

    const handleAddSubcategory = async (categoryId: string) => {
        if (!canManage) {
            onRequireSubscription();
            return;
        }
        if (!user || !newSubcategoryName.trim()) return;

        try {
            const category = categories.find(c => c.id === categoryId);
            if (!category) return;

            const fixedAmount = Number(newSubcategoryAmount);
            const dueDay = Number(newSubcategoryDueDay);
            const isFixedExpense = category.type === TransactionType.EXPENSE && newSubcategoryIsFixed;
            if (isFixedExpense && (
                !Number.isFinite(fixedAmount) || fixedAmount <= 0 ||
                !Number.isInteger(dueDay) || dueDay < 1 || dueDay > 31
            )) {
                alert('Ingresa un monto fijo y un día de vencimiento entre 1 y 31.');
                return;
            }

            const newSubcategory: Subcategory = {
                id: crypto.randomUUID(),
                name: newSubcategoryName.trim(),
                isDefault: false,
                ...(isFixedExpense ? { isFixedExpense: true, fixedAmount, dueDay } : {})
            };

            const updatedSubcategories = [...(category.subcategories || []), newSubcategory];

            await updateCategory(categoryId, { subcategories: updatedSubcategories }, user.uid);

            setCategories(prev => prev.map(c =>
                c.id === categoryId ? { ...c, subcategories: updatedSubcategories } : c
            ));

            setNewSubcategoryName('');
            setAddingSubcategoryTo(null);
            setNewSubcategoryIsFixed(false);
            setNewSubcategoryAmount('');
            setNewSubcategoryDueDay('15');
        } catch (error) {
            console.error('Error adding subcategory:', error);
        }
    };

    const handleSaveFixedSubcategory = async (category: Category, subcategory: Subcategory) => {
        if (!canManage) {
            onRequireSubscription();
            return;
        }
        if (!user) return;
        const fixedAmount = Number(newSubcategoryAmount);
        const dueDay = Number(newSubcategoryDueDay);
        if (newSubcategoryIsFixed && (
            !Number.isFinite(fixedAmount) || fixedAmount <= 0 ||
            !Number.isInteger(dueDay) || dueDay < 1 || dueDay > 31
        )) {
            alert('Ingresa un monto fijo y un día de vencimiento entre 1 y 31.');
            return;
        }

        const subcategoryData: Subcategory = { ...subcategory };
        delete subcategoryData.fixedAmount;
        delete subcategoryData.dueDay;
        const updatedSubcategory: Subcategory = newSubcategoryIsFixed
            ? { ...subcategoryData, isFixedExpense: true, fixedAmount, dueDay }
            : { ...subcategoryData, isFixedExpense: false };
        const updatedSubcategories = (category.subcategories || []).map(item =>
            item.id === subcategory.id ? updatedSubcategory : item
        );

        try {
            await updateCategory(category.id, { subcategories: updatedSubcategories }, user.uid);
            setCategories(prev => prev.map(item => item.id === category.id ? { ...item, subcategories: updatedSubcategories } : item));
            setEditingFixedSubcategoryId(null);
        } catch (error) {
            console.error('Error updating fixed expense:', error);
            alert('No se pudo guardar la configuración del gasto fijo.');
        }
    };

    const handleDeleteSubcategory = async (categoryId: string, subcategoryId: string) => {
        if (!canManage) {
            onRequireSubscription();
            return;
        }
        if (!user) return;
        const category = categories.find(c => c.id === categoryId);
        const subcategory = category?.subcategories?.find(item => item.id === subcategoryId);
        const confirmed = await confirmAction({
            title: 'Eliminar subcategoría',
            message: `¿Eliminar la subcategoría "${subcategory?.name || ''}"?`,
            confirmLabel: 'Eliminar subcategoría',
        });
        if (!confirmed) return;

        try {
            if (!category) return;

            const updatedSubcategories = (category.subcategories || []).filter(s => s.id !== subcategoryId);

            await updateCategory(categoryId, { subcategories: updatedSubcategories }, user.uid);

            setCategories(prev => prev.map(c =>
                c.id === categoryId ? { ...c, subcategories: updatedSubcategories } : c
            ));
        } catch (error) {
            console.error('Error deleting subcategory:', error);
        }
    };

    const handleDeleteCategory = async (category: Category) => {
        if (!canManage) {
            onRequireSubscription();
            return;
        }
        if (!user) return;
        if (isProtectedRewardsCategory(category)) return;
        const confirmed = await confirmAction({
            title: 'Eliminar categoría',
            message: `¿Eliminar la categoría "${category.name}"?`,
            confirmLabel: 'Eliminar categoría',
        });
        if (!confirmed) return;

        try {
            await deleteCategory(category.id, user.uid);
            setCategories(prev => prev.filter(c => c.id !== category.id));
        } catch (error) {
            console.error('Error deleting category:', error);
            alert('Error al eliminar la categoría');
        }
    };

    // Filter categories based on active tab
    const filteredCategories = categories.filter(category => {
        if (activeFilterTab === 'INCOME') return category.type === TransactionType.INCOME;
        if (category.type !== TransactionType.EXPENSE) return false;
        return getEffectiveCategoryBucket(category) === activeFilterTab;
    });

    if (loading) {
        return <div className="text-center py-8 text-gray-400">Cargando categorías...</div>;
    }

    return (
        <div className="space-y-6">
            {/* Header & Main Action */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h2 className="text-xl font-bold text-white">Gestión de Categorías</h2>
                    <p className="text-sm text-gray-400">Organiza tus categorías por cubeta para que aparezcan automáticamente en cada gasto.</p>
                </div>
                <button
                    onClick={openCreateModal}
                    className="px-4 py-2 bg-rodez-red hover:bg-blue-600 text-white rounded-lg flex items-center space-x-2 transition-colors text-sm font-medium shadow-md shadow-red-900/20"
                >
                    <Plus className="w-4 h-4" />
                    <span>Nueva Categoría</span>
                </button>
            </div>

            {/* Filter Tabs by Bucket */}
            <div className="flex space-x-2 bg-gray-900/80 p-1.5 rounded-xl border border-gray-800 overflow-x-auto">
                <button
                    onClick={() => setActiveFilterTab(BudgetBucket.ESSENTIAL)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all flex items-center space-x-1.5 ${activeFilterTab === BudgetBucket.ESSENTIAL
                        ? 'bg-blue-600/30 text-blue-300 border border-blue-500/40'
                        : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
                        }`}
                >
                    <DollarSign className="w-3.5 h-3.5 text-blue-400" />
                    <span>Esenciales (50%)</span>
                </button>

                <button
                    onClick={() => setActiveFilterTab(BudgetBucket.INVESTMENT)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all flex items-center space-x-1.5 ${activeFilterTab === BudgetBucket.INVESTMENT
                        ? 'bg-green-600/30 text-green-300 border border-green-500/40'
                        : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
                        }`}
                >
                    <TrendingUp className="w-3.5 h-3.5 text-green-400" />
                    <span>Inversión (25%)</span>
                </button>

                <button
                    onClick={() => setActiveFilterTab(BudgetBucket.STABILITY)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all flex items-center space-x-1.5 ${activeFilterTab === BudgetBucket.STABILITY
                        ? 'bg-yellow-600/30 text-yellow-300 border border-yellow-500/40'
                        : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
                        }`}
                >
                    <PiggyBank className="w-3.5 h-3.5 text-yellow-400" />
                    <span>Estabilidad (15%)</span>
                </button>

                <button
                    onClick={() => setActiveFilterTab(BudgetBucket.REWARDS)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all flex items-center space-x-1.5 ${activeFilterTab === BudgetBucket.REWARDS
                        ? 'bg-purple-600/30 text-purple-300 border border-purple-500/40'
                        : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
                        }`}
                >
                    <Smile className="w-3.5 h-3.5 text-purple-400" />
                    <span>Recompensas (10%)</span>
                </button>

                <button
                    onClick={() => setActiveFilterTab('INCOME')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all flex items-center space-x-1.5 ${activeFilterTab === 'INCOME'
                        ? 'bg-emerald-600/30 text-emerald-300 border border-emerald-500/40'
                        : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
                        }`}
                >
                    <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Ingresos</span>
                </button>
            </div>

            {/* Add Category Form/Modal */}
            {showAddCategory && (
                <div className="bg-gray-900 rounded-xl p-5 border border-gray-700 shadow-2xl space-y-4">
                    <div className="flex justify-between items-center pb-2 border-b border-gray-800">
                        <h3 className="font-bold text-white flex items-center gap-2">
                            <Plus className="w-4 h-4 text-rodez-red" />
                            Nueva Categoría
                        </h3>
                        <button onClick={() => setShowAddCategory(false)} className="text-gray-400 hover:text-white">
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Nombre</label>
                            <input
                                type="text"
                                value={newCategoryName}
                                onChange={(e) => setNewCategoryName(e.target.value)}
                                placeholder="Ej. Criptomonedas, Gimnasio..."
                                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-rodez-red text-sm"
                                autoFocus
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Tipo</label>
                            <select
                                value={newCategoryType}
                                onChange={(e) => setNewCategoryType(e.target.value as TransactionType)}
                                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-rodez-red text-sm"
                            >
                                <option value={TransactionType.EXPENSE}>Gasto</option>
                                <option value={TransactionType.INCOME}>Ingreso</option>
                            </select>
                        </div>

                        {newCategoryType === TransactionType.EXPENSE && (
                            <div>
                                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Cubeta Asignada</label>
                                <select
                                    value={newCategoryBucket}
                                    onChange={(e) => setNewCategoryBucket(e.target.value as BudgetBucket)}
                                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-rodez-red text-sm font-medium"
                                >
                                    <option value={BudgetBucket.ESSENTIAL}>Gastos Esenciales (50%)</option>
                                    <option value={BudgetBucket.INVESTMENT}>Inversión (25%)</option>
                                    <option value={BudgetBucket.STABILITY}>Fondo de Estabilidad (15%)</option>
                                    <option value={BudgetBucket.REWARDS}>Recompensas (10%)</option>
                                </select>
                            </div>
                        )}
                    </div>

                    <div>
                        <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Color Distintivo</label>
                        <div className="flex flex-wrap gap-2">
                            {PRESET_COLORS.map(color => (
                                <button
                                    key={color}
                                    type="button"
                                    onClick={() => setNewCategoryColor(color)}
                                    className={`w-7 h-7 rounded-full transition-all ${newCategoryColor === color ? 'ring-2 ring-white ring-offset-2 ring-offset-gray-900 scale-110' : 'hover:scale-105'}`}
                                    style={{ backgroundColor: color }}
                                />
                            ))}
                        </div>
                    </div>

                    <div className="flex justify-end space-x-2 pt-2 border-t border-gray-800">
                        <button
                            type="button"
                            onClick={() => setShowAddCategory(false)}
                            className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition-colors text-sm"
                        >
                            Cancelar
                        </button>
                        <button
                            type="button"
                            onClick={handleAddNewCategory}
                            className="px-4 py-2 bg-rodez-red hover:bg-blue-600 text-white rounded-lg transition-colors text-sm font-semibold"
                        >
                            Guardar Categoría
                        </button>
                    </div>
                </div>
            )}

            {/* Categories List */}
            {filteredCategories.length === 0 ? (
                <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-8 text-center">
                    <p className="text-gray-400 text-sm">No hay categorías configuradas para este filtro.</p>
                    <button
                        onClick={openCreateModal}
                        className="mt-3 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-white text-xs rounded-lg transition-colors inline-flex items-center space-x-1"
                    >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Crear la primera categoría aquí</span>
                    </button>
                </div>
            ) : (
                <div className="grid gap-3">
                    {filteredCategories.map(category => {
                        const isExpense = category.type === TransactionType.EXPENSE;
                        const bucket = getEffectiveCategoryBucket(category);
                        const bucketInfo = BUCKET_CONFIG[bucket];

                        return (
                            <div key={category.id} className="bg-gray-900 border border-gray-800 hover:border-gray-700 rounded-xl overflow-hidden transition-all shadow-md">
                                <div className="p-4">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center space-x-3 flex-1 min-w-0">
                                            <button
                                                onClick={() => toggleExpand(category.id)}
                                                className="text-gray-400 hover:text-white transition-colors"
                                                title={expandedCategories.has(category.id) ? 'Colapsar' : 'Ver subcategorías'}
                                            >
                                                {expandedCategories.has(category.id) ? (
                                                    <ChevronDown className="w-5 h-5" />
                                                ) : (
                                                    <ChevronRight className="w-5 h-5" />
                                                )}
                                            </button>

                                            {editingCategory === category.id ? (
                                                <div className="flex flex-wrap items-center gap-2 flex-1">
                                                    <input
                                                        type="text"
                                                        value={editingCategoryName}
                                                        onChange={(e) => setEditingCategoryName(e.target.value)}
                                                        readOnly={isProtectedRewardsCategory(category)}
                                                        className="bg-gray-800 border border-gray-600 rounded px-3 py-1.5 text-white text-sm focus:outline-none focus:border-rodez-red"
                                                        autoFocus
                                                    />
                                                    {isProtectedRewardsCategory(category) && (
                                                        <span className="text-xs text-gray-500">Nombre vinculado a Distribución 5-5</span>
                                                    )}

                                                    {isExpense && (
                                                        <select
                                                            value={editingCategoryBucket}
                                                            onChange={(e) => setEditingCategoryBucket(e.target.value as BudgetBucket)}
                                                            disabled={isProtectedRewardsCategory(category)}
                                                            className="bg-gray-800 border border-gray-600 rounded px-2.5 py-1.5 text-xs text-white"
                                                        >
                                                            <option value={BudgetBucket.ESSENTIAL}>Gastos Esenciales (50%)</option>
                                                            <option value={BudgetBucket.INVESTMENT}>Inversión (25%)</option>
                                                            <option value={BudgetBucket.STABILITY}>Fondo de Estabilidad (15%)</option>
                                                            <option value={BudgetBucket.REWARDS}>Recompensas (10%)</option>
                                                        </select>
                                                    )}

                                                    <div className="flex space-x-1">
                                                        {PRESET_COLORS.slice(0, 6).map(color => (
                                                            <button
                                                                key={color}
                                                                type="button"
                                                                onClick={() => setEditingCategoryColor(color)}
                                                                className={`w-5 h-5 rounded-full transition-all ${editingCategoryColor === color ? 'ring-2 ring-white scale-110' : ''}`}
                                                                style={{ backgroundColor: color }}
                                                            />
                                                        ))}
                                                    </div>

                                                    <button
                                                        onClick={() => handleSaveCategory(category.id)}
                                                        className="p-1.5 bg-green-600 text-white rounded hover:bg-green-700"
                                                        title="Guardar cambios"
                                                    >
                                                        <Check className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        onClick={() => setEditingCategory(null)}
                                                        className="p-1.5 text-gray-400 hover:text-white"
                                                        title="Cancelar"
                                                    >
                                                        <X className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            ) : (
                                                <div className="flex items-center space-x-3 flex-wrap gap-y-1">
                                                    <div
                                                        className="w-4 h-4 rounded-full"
                                                        style={{ backgroundColor: category.color || '#4CAF50' }}
                                                    />
                                                    <span className="font-semibold text-white text-sm md:text-base">{category.name}</span>

                                                    {isExpense && bucketInfo && (
                                                        <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${bucketInfo.bg} ${bucketInfo.color} ${bucketInfo.border}`}>
                                                            {bucketInfo.label} ({bucketInfo.pct}%)
                                                        </span>
                                                    )}

                                                    {!isExpense && (
                                                        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                                                            Ingreso
                                                        </span>
                                                    )}

                                                    <span className="text-xs text-gray-500">
                                                        ({category.subcategories?.length || 0} subcategorías)
                                                    </span>
                                                </div>
                                            )}
                                        </div>

                                        {editingCategory !== category.id && (
                                            <div className="flex items-center space-x-1">
                                                <button
                                                    onClick={() => handleEditCategory(category)}
                                                    className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
                                                    title="Editar Categoría"
                                                >
                                                    <Edit2 className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        if (!canManage) {
                                                            onRequireSubscription();
                                                            return;
                                                        }
                                                        setAddingSubcategoryTo(category.id);
                                                        setEditingFixedSubcategoryId(null);
                                                        setExpandedCategories(prev => new Set(prev).add(category.id));
                                                        setNewSubcategoryIsFixed(false);
                                                        setNewSubcategoryAmount('');
                                                        setNewSubcategoryDueDay('15');
                                                    }}
                                                    className="p-2 text-rodez-red hover:bg-gray-800 rounded-lg transition-colors"
                                                    title="Agregar Subcategoría"
                                                >
                                                    <Plus className="w-4 h-4" />
                                                </button>
                                                {!category.isDefault && (
                                                    <button
                                                        onClick={() => void handleDeleteCategory(category)}
                                                        className="p-2 text-gray-400 hover:text-red-400 hover:bg-gray-800 rounded-lg transition-colors"
                                                        title="Eliminar Categoría"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    {/* Subcategories list */}
                                    {expandedCategories.has(category.id) && (
                                        <div className="mt-3 ml-7 pt-3 border-t border-gray-800/80 space-y-2">
                                            {(category.subcategories || []).map(sub => (
                                                <div key={sub.id} className="flex flex-wrap items-center justify-between gap-3 py-1.5 px-3 rounded-lg bg-gray-800/40 hover:bg-gray-800 group">
                                                    <span className="min-w-0 truncate text-gray-300 text-sm font-medium">{sub.name}</span>
                                                    {sub.isFixedExpense && <span className="shrink-0 text-xs text-amber-300">Fijo · ${Number(sub.fixedAmount || 0).toLocaleString('es-CO')} · vence día {sub.dueDay}</span>}
                                                    <span className="flex shrink-0 items-center">
                                                        {isExpense && <button
                                                            type="button"
                                                            onClick={() => {
                                                                if (!canManage) {
                                                                    onRequireSubscription();
                                                                    return;
                                                                }
                                                                setAddingSubcategoryTo(null);
                                                                setEditingFixedSubcategoryId(editingFixedSubcategoryId === sub.id ? null : sub.id);
                                                                setNewSubcategoryIsFixed(Boolean(sub.isFixedExpense));
                                                                setNewSubcategoryAmount(sub.fixedAmount ? String(sub.fixedAmount) : '');
                                                                setNewSubcategoryDueDay(String(sub.dueDay || 15));
                                                            }}
                                                            className="p-1 text-gray-500 hover:text-amber-300"
                                                            title="Configurar gasto fijo mensual"
                                                            aria-label={`Configurar gasto fijo para ${sub.name}`}
                                                        ><Edit2 className="h-3.5 w-3.5" /></button>}
                                                        <button
                                                            onClick={() => handleDeleteSubcategory(category.id, sub.id)}
                                                            className="p-1 text-gray-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                                                            title="Eliminar subcategoría"
                                                        >
                                                            <Trash2 className="w-3.5 h-3.5" />
                                                        </button>
                                                    </span>
                                                    {editingFixedSubcategoryId === sub.id && (
                                                        <div className="basis-full space-y-2 rounded-md border border-gray-700/70 p-3">
                                                            <label className="flex items-center gap-2 text-sm text-gray-300">
                                                                <input type="checkbox" checked={newSubcategoryIsFixed} onChange={event => setNewSubcategoryIsFixed(event.target.checked)} className="accent-red-500" />
                                                                Gasto fijo mensual
                                                            </label>
                                                            {newSubcategoryIsFixed && (
                                                                <div className="grid grid-cols-2 gap-2">
                                                                    <label className="text-xs text-gray-400">Monto mensual
                                                                        <input type="number" min="1" step="1" value={newSubcategoryAmount} onChange={event => setNewSubcategoryAmount(event.target.value)} className="mt-1 w-full rounded border border-gray-700 bg-gray-800 px-2 py-1.5 text-sm text-white" />
                                                                    </label>
                                                                    <label className="text-xs text-gray-400">Día de vencimiento
                                                                        <input type="number" min="1" max="31" step="1" value={newSubcategoryDueDay} onChange={event => setNewSubcategoryDueDay(event.target.value)} className="mt-1 w-full rounded border border-gray-700 bg-gray-800 px-2 py-1.5 text-sm text-white" />
                                                                    </label>
                                                                </div>
                                                            )}
                                                            <div className="flex justify-end gap-2">
                                                                <button type="button" onClick={() => setEditingFixedSubcategoryId(null)} className="rounded px-2 py-1 text-xs text-gray-400 hover:text-white">Cancelar</button>
                                                                <button type="button" onClick={() => handleSaveFixedSubcategory(category, sub)} className="rounded bg-rodez-red px-2 py-1 text-xs font-medium text-white">Guardar</button>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            ))}

                                            {addingSubcategoryTo === category.id && (
                                                <div className="space-y-2 pt-2">
                                                    <div className="flex items-center gap-2">
                                                        <input
                                                            type="text"
                                                            value={newSubcategoryName}
                                                            onChange={(e) => setNewSubcategoryName(e.target.value)}
                                                            placeholder="Nombre de subcategoría..."
                                                            className="min-w-0 flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-rodez-red"
                                                            autoFocus
                                                            onKeyDown={(e) => {
                                                                if (e.key === 'Enter') handleAddSubcategory(category.id);
                                                                if (e.key === 'Escape') {
                                                                    setAddingSubcategoryTo(null);
                                                                    setNewSubcategoryName('');
                                                                }
                                                            }}
                                                        />
                                                        <button onClick={() => handleAddSubcategory(category.id)} className="p-1.5 bg-rodez-red text-white rounded-lg hover:bg-blue-600 transition-colors" title="Guardar">
                                                            <Save className="w-4 h-4" />
                                                        </button>
                                                        <button onClick={() => { setAddingSubcategoryTo(null); setNewSubcategoryName(''); }} className="p-1.5 text-gray-400 hover:text-white" title="Cancelar">
                                                            <X className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                    {category.type === TransactionType.EXPENSE && (
                                                        <div className="space-y-2 rounded-md border border-gray-700/70 p-3">
                                                            <label className="flex items-center gap-2 text-sm text-gray-300">
                                                                <input type="checkbox" checked={newSubcategoryIsFixed} onChange={event => setNewSubcategoryIsFixed(event.target.checked)} className="accent-red-500" />
                                                                Gasto fijo mensual
                                                            </label>
                                                            {newSubcategoryIsFixed && (
                                                                <div className="grid grid-cols-2 gap-2">
                                                                    <label className="text-xs text-gray-400">
                                                                        Monto mensual
                                                                        <input type="number" min="1" step="1" value={newSubcategoryAmount} onChange={event => setNewSubcategoryAmount(event.target.value)} className="mt-1 w-full rounded border border-gray-700 bg-gray-800 px-2 py-1.5 text-sm text-white" placeholder="Ej. 1200000" />
                                                                    </label>
                                                                    <label className="text-xs text-gray-400">
                                                                        Día de vencimiento
                                                                        <input type="number" min="1" max="31" step="1" value={newSubcategoryDueDay} onChange={event => setNewSubcategoryDueDay(event.target.value)} className="mt-1 w-full rounded border border-gray-700 bg-gray-800 px-2 py-1.5 text-sm text-white" />
                                                                    </label>
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
            {confirmDialog}
        </div>
    );
};
