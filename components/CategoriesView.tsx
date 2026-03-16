import React, { useState, useEffect } from 'react';
import { Category, Subcategory, TransactionType } from '../types';
import { getCategories, saveCategory, updateCategory } from '../services/budgetService';
import { useAuth } from '../hooks/useAuth';
import { Plus, Edit2, Trash2, ChevronDown, ChevronRight, Save, X, Check } from 'lucide-react';

const PRESET_COLORS = [
    '#FF5252', '#E91E63', '#9C27B0', '#673AB7',
    '#3F51B5', '#2196F3', '#03A9F4', '#00BCD4',
    '#009688', '#4CAF50', '#8BC34A', '#CDDC39',
    '#FFC107', '#FF9800', '#FF5722', '#795548'
];

export const CategoriesView: React.FC = () => {
    const { user } = useAuth();
    const [categories, setCategories] = useState<Category[]>([]);
    const [loading, setLoading] = useState(true);
    const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
    const [editingCategory, setEditingCategory] = useState<string | null>(null);
    const [editingCategoryName, setEditingCategoryName] = useState('');
    const [editingCategoryColor, setEditingCategoryColor] = useState('');
    const [newSubcategoryName, setNewSubcategoryName] = useState('');
    const [addingSubcategoryTo, setAddingSubcategoryTo] = useState<string | null>(null);
    const [showAddCategory, setShowAddCategory] = useState(false);
    const [newCategoryName, setNewCategoryName] = useState('');
    const [newCategoryType, setNewCategoryType] = useState<TransactionType>(TransactionType.EXPENSE);
    const [newCategoryColor, setNewCategoryColor] = useState(PRESET_COLORS[0]);

    useEffect(() => {
        if (user) {
            loadCategories();
        }
    }, [user]);

    const loadCategories = async () => {
        if (!user) return;
        try {
            const data = await getCategories(user.uid);
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
        setEditingCategory(category.id);
        setEditingCategoryName(category.name);
        setEditingCategoryColor(category.color || PRESET_COLORS[0]);
    };

    const handleSaveCategory = async (categoryId: string) => {
        if (!user || !editingCategoryName.trim()) return;

        try {
            await updateCategory(categoryId, {
                name: editingCategoryName.trim(),
                color: editingCategoryColor
            }, user.uid);

            setCategories(prev => prev.map(c =>
                c.id === categoryId ? { ...c, name: editingCategoryName.trim(), color: editingCategoryColor } : c
            ));

            setEditingCategory(null);
            setEditingCategoryName('');
            setEditingCategoryColor('');
        } catch (error) {
            console.error('Error updating category:', error);
            alert('Error al actualizar la categoría');
        }
    };

    const handleAddNewCategory = async () => {
        if (!user || !newCategoryName.trim()) return;

        try {
            const newCategory: Omit<Category, 'id'> = {
                name: newCategoryName.trim(),
                type: newCategoryType,
                color: newCategoryColor,
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
        if (!user || !newSubcategoryName.trim()) return;

        try {
            const category = categories.find(c => c.id === categoryId);
            if (!category) return;

            const newSubcategory: Subcategory = {
                id: crypto.randomUUID(),
                name: newSubcategoryName.trim(),
                isDefault: false
            };

            const updatedSubcategories = [...category.subcategories, newSubcategory];

            await updateCategory(categoryId, { subcategories: updatedSubcategories }, user.uid);

            setCategories(prev => prev.map(c =>
                c.id === categoryId ? { ...c, subcategories: updatedSubcategories } : c
            ));

            setNewSubcategoryName('');
            setAddingSubcategoryTo(null);
        } catch (error) {
            console.error('Error adding subcategory:', error);
        }
    };

    const handleDeleteSubcategory = async (categoryId: string, subcategoryId: string) => {
        if (!user || !confirm('¿Estás seguro de eliminar esta subcategoría?')) return;

        try {
            const category = categories.find(c => c.id === categoryId);
            if (!category) return;

            const updatedSubcategories = category.subcategories.filter(s => s.id !== subcategoryId);

            await updateCategory(categoryId, { subcategories: updatedSubcategories }, user.uid);

            setCategories(prev => prev.map(c =>
                c.id === categoryId ? { ...c, subcategories: updatedSubcategories } : c
            ));
        } catch (error) {
            console.error('Error deleting subcategory:', error);
        }
    };

    if (loading) {
        return <div className="text-center py-8 text-gray-400">Cargando categorías...</div>;
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold text-white">Gestión de Categorías</h2>
                {/* Botón deshabilitado - Solo 5 categorías fijas permitidas */}
                {/* <button
                onClick={() => setShowAddCategory(true)}
                className="px-4 py-2 bg-rodez-red hover:bg-blue-600 text-white rounded-lg flex items-center space-x-2 transition-colors text-sm"
            >
                <Plus className="w-4 h-4" />
                <span>Nueva Categoría</span>
            </button> */}
            </div>

            {/* Add Category Modal */}
            {showAddCategory && (
                <div className="bg-gray-800 rounded-lg p-4 border border-gray-700 space-y-4">
                    <div className="flex justify-between items-center">
                        <h3 className="font-semibold text-white">Nueva Categoría</h3>
                        <button onClick={() => setShowAddCategory(false)} className="text-gray-400 hover:text-white">
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm text-gray-400 mb-2">Nombre</label>
                            <input
                                type="text"
                                value={newCategoryName}
                                onChange={(e) => setNewCategoryName(e.target.value)}
                                placeholder="Ej. Entretenimiento"
                                className="w-full bg-gray-900 border border-gray-600 rounded px-3 py-2 text-white focus:outline-none focus:border-rodez-red"
                                autoFocus
                            />
                        </div>

                        <div>
                            <label className="block text-sm text-gray-400 mb-2">Tipo</label>
                            <select
                                value={newCategoryType}
                                onChange={(e) => setNewCategoryType(e.target.value as TransactionType)}
                                className="w-full bg-gray-900 border border-gray-600 rounded px-3 py-2 text-white focus:outline-none focus:border-rodez-red"
                            >
                                <option value={TransactionType.EXPENSE}>Gasto</option>
                                <option value={TransactionType.INCOME}>Ingreso</option>
                            </select>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm text-gray-400 mb-2">Color</label>
                        <div className="grid grid-cols-4 md:grid-cols-8 gap-2">
                            {PRESET_COLORS.map(color => (
                                <button
                                    key={color}
                                    onClick={() => setNewCategoryColor(color)}
                                    className={`w-8 h-8 rounded-full transition-all ${newCategoryColor === color ? 'ring-2 ring-white ring-offset-2 ring-offset-gray-800' : ''}`}
                                    style={{ backgroundColor: color }}
                                />
                            ))}
                        </div>
                    </div>

                    <div className="flex justify-end space-x-2">
                        <button
                            onClick={() => setShowAddCategory(false)}
                            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded transition-colors"
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={handleAddNewCategory}
                            className="px-4 py-2 bg-rodez-red hover:bg-blue-600 text-white rounded transition-colors"
                        >
                            Crear
                        </button>
                    </div>
                </div>
            )}

            <div className="grid gap-4">
                {categories.map(category => (
                    <div key={category.id} className="bg-gray-800 rounded-lg overflow-hidden border border-gray-700">
                        <div className="p-4">
                            <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center space-x-3 flex-1">
                                    <button
                                        onClick={() => toggleExpand(category.id)}
                                        className="text-gray-400 hover:text-white transition-colors"
                                    >
                                        {expandedCategories.has(category.id) ? (
                                            <ChevronDown className="w-5 h-5" />
                                        ) : (
                                            <ChevronRight className="w-5 h-5" />
                                        )}
                                    </button>

                                    {editingCategory === category.id ? (
                                        <div className="flex items-center space-x-2 flex-1">
                                            <input
                                                type="text"
                                                value={editingCategoryName}
                                                onChange={(e) => setEditingCategoryName(e.target.value)}
                                                className="flex-1 bg-gray-900 border border-gray-600 rounded px-3 py-1.5 text-white focus:outline-none focus:border-rodez-red"
                                                autoFocus
                                            />
                                            <div className="flex space-x-1">
                                                {PRESET_COLORS.slice(0, 8).map(color => (
                                                    <button
                                                        key={color}
                                                        onClick={() => setEditingCategoryColor(color)}
                                                        className={`w-6 h-6 rounded-full transition-all ${editingCategoryColor === color ? 'ring-2 ring-white' : ''}`}
                                                        style={{ backgroundColor: color }}
                                                    />
                                                ))}
                                            </div>
                                            <button
                                                onClick={() => handleSaveCategory(category.id)}
                                                className="p-1.5 bg-green-600 text-white rounded hover:bg-green-700"
                                            >
                                                <Check className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => setEditingCategory(null)}
                                                className="p-1.5 text-gray-400 hover:text-white"
                                            >
                                                <X className="w-4 h-4" />
                                            </button>
                                        </div>
                                    ) : (
                                        <>
                                            <div
                                                className="w-8 h-8 rounded-full flex items-center justify-center"
                                                style={{ backgroundColor: `${category.color}20`, color: category.color }}
                                            >
                                                <div className="w-4 h-4 rounded-full bg-current" />
                                            </div>
                                            <span className="font-medium text-white">{category.name}</span>
                                            <span className="text-xs px-2 py-1 rounded bg-gray-700 text-gray-300">
                                                {category.type === TransactionType.INCOME ? 'Ingreso' : 'Gasto'}
                                            </span>
                                        </>
                                    )}
                                </div>

                                {editingCategory !== category.id && (
                                    <div className="flex items-center space-x-2">
                                        <button
                                            onClick={() => handleEditCategory(category)}
                                            className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-full transition-colors"
                                            title="Editar Categoría"
                                        >
                                            <Edit2 className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={() => {
                                                setAddingSubcategoryTo(category.id);
                                                setExpandedCategories(prev => new Set(prev).add(category.id));
                                            }}
                                            className="p-2 text-rodez-red hover:bg-gray-700 rounded-full transition-colors"
                                            title="Agregar Subcategoría"
                                        >
                                            <Plus className="w-4 h-4" />
                                        </button>
                                        {!category.isDefault && (
                                            <button
                                                onClick={async () => {
                                                    if (!user || !confirm(`¿Eliminar la categoría "${category.name}"?`)) return;
                                                    try {
                                                        const { deleteCategory } = await import('../services/budgetService');
                                                        await deleteCategory(category.id, user.uid);
                                                        setCategories(prev => prev.filter(c => c.id !== category.id));
                                                    } catch (error) {
                                                        console.error('Error deleting category:', error);
                                                        alert('Error al eliminar la categoría');
                                                    }
                                                }}
                                                className="p-2 text-gray-400 hover:text-red-400 hover:bg-gray-700 rounded-full transition-colors"
                                                title="Eliminar Categoría"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>

                            {expandedCategories.has(category.id) && (
                                <div className="mt-3 ml-8 space-y-2">
                                    {category.subcategories.map(sub => (
                                        <div key={sub.id} className="flex items-center justify-between py-2 px-3 rounded hover:bg-gray-700/50 group">
                                            <span className="text-gray-300 text-sm">{sub.name}</span>
                                            <button
                                                onClick={() => handleDeleteSubcategory(category.id, sub.id)}
                                                className="text-gray-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                                                title="Eliminar subcategoría"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    ))}

                                    {addingSubcategoryTo === category.id && (
                                        <div className="flex items-center space-x-2 pt-2">
                                            <input
                                                type="text"
                                                value={newSubcategoryName}
                                                onChange={(e) => setNewSubcategoryName(e.target.value)}
                                                placeholder="Nombre de subcategoría..."
                                                className="flex-1 bg-gray-900 border border-gray-600 rounded px-3 py-1.5 text-sm text-white focus:outline-none focus:border-rodez-red"
                                                autoFocus
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') handleAddSubcategory(category.id);
                                                    if (e.key === 'Escape') {
                                                        setAddingSubcategoryTo(null);
                                                        setNewSubcategoryName('');
                                                    }
                                                }}
                                            />
                                            <button
                                                onClick={() => handleAddSubcategory(category.id)}
                                                className="p-1.5 bg-rodez-red text-white rounded hover:bg-blue-600"
                                            >
                                                <Save className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => {
                                                    setAddingSubcategoryTo(null);
                                                    setNewSubcategoryName('');
                                                }}
                                                className="p-1.5 text-gray-400 hover:text-white"
                                            >
                                                <X className="w-4 h-4" />
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};
