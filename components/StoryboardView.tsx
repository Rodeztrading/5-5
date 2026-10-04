import React, { useState, useEffect, useRef } from 'react';
import { StoryboardItem } from '../types';
import {
  getStoryboardItems,
  saveStoryboardItem,
  updateStoryboardItem,
  deleteStoryboardItem,
  exportStoryboardBackup,
  importStoryboardBackup
} from '../services/storyboardService';
import {
  Plus,
  Trash2,
  Maximize2,
  Minimize2,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  X,
  ChevronLeft,
  ChevronRight,
  Upload,
  Download,
  FileText,
  Edit2,
  Check,
  Sparkles
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

export interface CategoryDefinition {
  id: string;
  name: string;
  rules: string;
  color: string;
}

const INITIAL_CATEGORIES: CategoryDefinition[] = [
  {
    id: 'reversion',
    name: 'Reversión',
    color: 'bg-red-500/20 text-red-400 border-red-500/40 hover:bg-red-500/30',
    rules: '• Esperar agotamiento del precio en zona de soporte o resistencia institucional.\n• La vela debe dejar mecha de rechazo superior o inferior > 50% del tamaño total.\n• Confirmar con cambio de color o vela envolvente previa.\n• Operar a favor del rechazo (1 minuto de expiración).'
  },
  {
    id: 'continuacion',
    name: 'Continuación',
    color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40 hover:bg-emerald-500/30',
    rules: '• Identificar tendencia fuerte y clara con máximos y mínimos alineados.\n• Esperar retroceso ordenado (Pullback) hacia la EMA de 20 periodos o nivel roto.\n• Vela de confirmación con mecha de rechazo a favor de la tendencia.\n• Entrada en la apertura de la siguiente vela.'
  },
  {
    id: 'rompimiento',
    name: 'Rompimiento',
    color: 'bg-blue-500/20 text-blue-400 border-blue-500/40 hover:bg-blue-500/30',
    rules: '• El precio se comprime contra una zona clave probada varias veces.\n• Vela de intención con cuerpo sólido que rompe y cierra por fuera del nivel.\n• Esperar un leve retesteo a la zona para entrar con mejor punto de entrada.\n• Operar a favor de la dirección del quiebre.'
  },
  {
    id: 'soporte_resistencia',
    name: 'Soporte / Resistencia',
    color: 'bg-purple-500/20 text-purple-400 border-purple-500/40 hover:bg-purple-500/30',
    rules: '• Zona institucional probada con al menos 2 toques previos.\n• Esperar que el precio llegue sin fuerza (velas pequeñas o mechas continuas).\n• Entrar en el punto exacto de reacción del nivel.'
  },
  {
    id: 'patron_velas',
    name: 'Patrón de Velas',
    color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/40 hover:bg-yellow-500/30',
    rules: '• Identificar patrones de alta efectividad: Martillo, Estrella Fugaz, Doji en zona, Vela Envolvente.\n• El patrón debe formarse obligatoriamente en un nivel relevante.\n• Esperar confirmación de la siguiente vela antes de entrar.'
  }
];

export const StoryboardView: React.FC = () => {
  const { user } = useAuth();
  const [items, setItems] = useState<StoryboardItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>('Todos');
  const [gridCols, setGridCols] = useState<1 | 2 | 3 | 4>(2);
  const [isFullscreenMode, setIsFullscreenMode] = useState(false);

  // Categories with customizable rules
  const [categories, setCategories] = useState<CategoryDefinition[]>(() => {
    try {
      const saved = localStorage.getItem('rodez_custom_categories');
      return saved ? JSON.parse(saved) : INITIAL_CATEGORIES;
    } catch {
      return INITIAL_CATEGORIES;
    }
  });

  // Modal State for New Image Upload (Ultra clean: only image + category)
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [modalImageBase64, setModalImageBase64] = useState<string | null>(null);
  const [modalCategory, setModalCategory] = useState<string>('Reversión');
  const [isSaving, setIsSaving] = useState(false);

  // Modal / Popover State for Category Rules
  const [rulesCategory, setRulesCategory] = useState<CategoryDefinition | null>(null);
  const [editingCategoryName, setEditingCategoryName] = useState('');
  const [editingCategoryRules, setEditingCategoryRules] = useState('');
  const [isEditingCategory, setIsEditingCategory] = useState(false);

  // Lightbox Zoom State
  const [lightboxItem, setLightboxItem] = useState<StoryboardItem | null>(null);
  const [zoomScale, setZoomScale] = useState(1);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const importInputRef = useRef<HTMLInputElement>(null);

  // Save categories to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('rodez_custom_categories', JSON.stringify(categories));
  }, [categories]);

  // Load items on mount and when user changes
  useEffect(() => {
    loadItems();
  }, [user]);

  const loadItems = async () => {
    setLoading(true);
    try {
      const data = await getStoryboardItems(user?.uid);
      setItems(data);
    } catch (err) {
      console.error('[Storyboard] Error loading items:', err);
    } finally {
      setLoading(false);
    }
  };

  // Global Paste Handler (Ctrl + V)
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;

      const clipboardItems = e.clipboardData?.items;
      if (!clipboardItems) return;

      for (let i = 0; i < clipboardItems.length; i++) {
        if (clipboardItems[i].type.startsWith('image/')) {
          const file = clipboardItems[i].getAsFile();
          if (file) {
            e.preventDefault();
            processImageFile(file);
            break;
          }
        }
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [selectedCategory]);

  // Fullscreen change listener
  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreenMode(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  // Lightbox Keyboard Navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!lightboxItem) return;
      if (e.key === 'Escape') {
        setLightboxItem(null);
        setZoomScale(1);
      } else if (e.key === 'ArrowLeft') {
        navigateLightbox('prev');
      } else if (e.key === 'ArrowRight') {
        navigateLightbox('next');
      } else if (e.key === '+' || e.key === '=') {
        setZoomScale(prev => Math.min(prev + 0.25, 3));
      } else if (e.key === '-') {
        setZoomScale(prev => Math.max(prev - 0.25, 0.5));
      } else if (e.key === '0') {
        setZoomScale(1);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [lightboxItem, items]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {
        setIsFullscreenMode(prev => !prev);
      });
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
    }
  };

  const processImageFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUri = reader.result as string;
      setModalImageBase64(dataUri);
      // Pre-select current filtered category if it's not 'Todos'
      if (selectedCategory !== 'Todos') {
        setModalCategory(selectedCategory);
      }
      setIsUploadModalOpen(true);
    };
    reader.readAsDataURL(file);
  };

  const handleSaveUpload = async () => {
    if (!modalImageBase64) {
      alert('Por favor pega o carga una captura de gráfico.');
      return;
    }

    setIsSaving(true);
    try {
      await saveStoryboardItem({
        title: modalCategory,
        category: modalCategory,
        imageUrl: modalImageBase64
      }, user?.uid);

      await loadItems();
      setIsUploadModalOpen(false);
      setModalImageBase64(null);
    } catch (err) {
      console.error('[Storyboard] Error saving image:', err);
      alert('Error al guardar la imagen. Intenta de nuevo.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteItem = async (item: StoryboardItem, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm('¿Eliminar esta imagen del tablero?')) return;
    try {
      await deleteStoryboardItem(item.id, item.imageUrl, user?.uid);
      if (lightboxItem?.id === item.id) setLightboxItem(null);
      await loadItems();
    } catch (err) {
      console.error('[Storyboard] Error deleting item:', err);
    }
  };

  const navigateLightbox = (direction: 'next' | 'prev') => {
    if (!lightboxItem || filteredItems.length === 0) return;
    const currentIndex = filteredItems.findIndex(i => i.id === lightboxItem.id);
    if (currentIndex === -1) return;

    if (direction === 'next' && currentIndex < filteredItems.length - 1) {
      setLightboxItem(filteredItems[currentIndex + 1]);
      setZoomScale(1);
    } else if (direction === 'prev' && currentIndex > 0) {
      setLightboxItem(filteredItems[currentIndex - 1]);
      setZoomScale(1);
    }
  };

  // Open Category Rules modal
  const handleOpenRules = (cat: CategoryDefinition, e: React.MouseEvent) => {
    e.stopPropagation();
    setRulesCategory(cat);
    setEditingCategoryName(cat.name);
    setEditingCategoryRules(cat.rules);
    setIsEditingCategory(false);
  };

  // Save modified category name and rules
  const handleSaveCategoryChanges = () => {
    if (!rulesCategory) return;
    const trimmedName = editingCategoryName.trim();
    if (!trimmedName) {
      alert('El nombre de la categoría no puede estar vacío.');
      return;
    }

    const oldName = rulesCategory.name;
    const updatedCategories = categories.map(c => {
      if (c.id === rulesCategory.id) {
        return {
          ...c,
          name: trimmedName,
          rules: editingCategoryRules
        };
      }
      return c;
    });

    setCategories(updatedCategories);

    // If the category name changed, update existing items with the new name
    if (oldName !== trimmedName) {
      items.forEach(async (item) => {
        if (item.category === oldName) {
          await updateStoryboardItem({ ...item, category: trimmedName }, user?.uid);
        }
      });
      if (selectedCategory === oldName) setSelectedCategory(trimmedName);
      loadItems();
    }

    setRulesCategory(null);
    setIsEditingCategory(false);
  };

  const handleExport = async () => {
    try {
      const json = await exportStoryboardBackup();
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `RODEZ_Graficos_${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert('Error al exportar.');
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const count = await importStoryboardBackup(reader.result as string, user?.uid);
        alert(`¡Se importaron ${count} gráficos correctamente!`);
        await loadItems();
      };
      reader.readAsText(file);
    } catch {
      alert('Error al importar archivo.');
    }
  };

  // Seed sample setups
  const handleSeedExamples = async () => {
    const sampleSetups = [
      {
        title: 'Reversión',
        category: 'Reversión',
        imageUrl: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="900" height="500" viewBox="0 0 900 500" fill="%230d1117"><rect width="900" height="500" fill="%23090d12"/><line x1="50" y1="120" x2="850" y2="120" stroke="%23ef4444" stroke-width="3" stroke-dasharray="8,6"/><text x="70" y="105" fill="%23ef4444" font-family="sans-serif" font-weight="900" font-size="18">ZONA DE RESISTENCIA CLAVE</text><line x1="160" y1="380" x2="160" y2="260" stroke="%2322c55e" stroke-width="3"/><rect x="145" y="270" width="30" height="90" fill="%2322c55e" rx="3"/><line x1="260" y1="310" x2="260" y2="170" stroke="%2322c55e" stroke-width="3"/><rect x="245" y="180" width="30" height="110" fill="%2322c55e" rx="3"/><line x1="390" y1="120" x2="390" y2="260" stroke="%23ef4444" stroke-width="4"/><rect x="375" y="220" width="30" height="35" fill="%23ef4444" rx="3"/><circle cx="390" cy="120" r="14" fill="none" stroke="%23f59e0b" stroke-width="4"/><text x="420" y="145" fill="%23f59e0b" font-family="sans-serif" font-weight="bold" font-size="16">RECHAZO DE MECHA > 60%</text><line x1="500" y1="230" x2="500" y2="380" stroke="%23ef4444" stroke-width="3"/><rect x="485" y="245" width="30" height="115" fill="%23ef4444" rx="3"/><text x="535" y="310" fill="%2322c55e" font-family="sans-serif" font-weight="900" font-size="18">ENTRADA PUT (1 MINUTO)</text></svg>'
      },
      {
        title: 'Continuación',
        category: 'Continuación',
        imageUrl: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="900" height="500" viewBox="0 0 900 500" fill="%230d1117"><rect width="900" height="500" fill="%23090d12"/><path d="M 60 400 Q 350 350 850 140" stroke="%2338bdf8" stroke-width="4" fill="none"/><text x="80" y="380" fill="%2338bdf8" font-family="sans-serif" font-weight="900" font-size="18">EMA 20 PERIODOS (SOPORTE DINAMICO)</text><line x1="220" y1="360" x2="220" y2="230" stroke="%2322c55e" stroke-width="3"/><rect x="205" y="240" width="30" height="100" fill="%2322c55e" rx="3"/><line x1="360" y1="310" x2="360" y2="240" stroke="%23ef4444" stroke-width="3"/><rect x="345" y="250" width="30" height="50" fill="%23ef4444" rx="3"/><line x1="470" y1="305" x2="470" y2="190" stroke="%2322c55e" stroke-width="3"/><rect x="455" y="200" width="30" height="85" fill="%2322c55e" rx="3"/><circle cx="470" cy="300" r="14" fill="none" stroke="%2300ff9d" stroke-width="4"/><text x="510" y="250" fill="%2300ff9d" font-family="sans-serif" font-weight="900" font-size="18">PULLBACK + CONFIRMACION (CALL 1M)</text></svg>'
      }
    ];

    for (const s of sampleSetups) {
      await saveStoryboardItem(s, user?.uid);
    }
    await loadItems();
  };

  // Filter items purely by category
  const filteredItems = items.filter(item => {
    if (selectedCategory === 'Todos') return true;
    return item.category === selectedCategory;
  });

  const getCategoryColor = (categoryName: string) => {
    const found = categories.find(c => c.name.toLowerCase() === categoryName.toLowerCase());
    return found ? found.color : 'bg-gray-800 text-gray-300 border-gray-700';
  };

  return (
    <div className={`flex flex-col h-full w-full bg-[#090d12] text-gray-100 overflow-hidden relative ${isFullscreenMode ? 'p-1' : ''}`}>

      {/* ULTRA CLEAN TOP BAR: CATEGORY FILTER CHIPS + MINIMAL CONTROLS (NO EXTRA HEADER) */}
      <div className="px-3 md:px-5 py-2.5 bg-gray-950/95 border-b border-gray-800/80 flex items-center justify-between gap-3 shrink-0 z-20 backdrop-blur-md">
        
        {/* Categories Chips with Rules Notes Icon */}
        <div className="flex items-center space-x-1.5 overflow-x-auto custom-scrollbar py-0.5 flex-1 min-w-0">
          
          {/* 'Todos' Chip */}
          <button
            onClick={() => setSelectedCategory('Todos')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all border ${
              selectedCategory === 'Todos'
                ? 'bg-rodez-red text-white border-rodez-red shadow-md shadow-red-900/40'
                : 'bg-gray-900 text-gray-400 border-gray-800 hover:text-white hover:bg-gray-850'
            }`}
          >
            Todos ({items.length})
          </button>

          {/* Dynamic Categories Chips */}
          {categories.map((cat) => {
            const isSelected = selectedCategory === cat.name;
            const count = items.filter(i => i.category === cat.name).length;

            return (
              <div
                key={cat.id}
                className={`inline-flex items-center rounded-xl border transition-all ${
                  isSelected
                    ? 'bg-gray-800 border-rodez-red text-white ring-1 ring-rodez-red shadow-md'
                    : `${cat.color}`
                }`}
              >
                {/* Select Category Button */}
                <button
                  onClick={() => setSelectedCategory(cat.name)}
                  className="px-3 py-1.5 text-xs font-bold whitespace-nowrap flex items-center"
                >
                  <span>{cat.name}</span>
                  <span className="ml-1.5 opacity-60 font-mono text-[11px]">({count})</span>
                </button>

                {/* Notes Icon 📝 to view / edit category rules */}
                <button
                  onClick={(e) => handleOpenRules(cat, e)}
                  className="pr-2 pl-1 py-1.5 opacity-60 hover:opacity-100 hover:text-amber-400 transition-opacity"
                  title={`Ver y editar reglas de ${cat.name}`}
                >
                  <FileText className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })}
        </div>

        {/* Right Side Minimal Controls: Columns, Fullscreen, Upload */}
        <div className="flex items-center space-x-2 shrink-0">
          
          {/* Column selector */}
          <div className="hidden sm:flex items-center bg-gray-900 border border-gray-800 rounded-xl p-0.5">
            {[1, 2, 3, 4].map(num => (
              <button
                key={num}
                onClick={() => setGridCols(num as 1 | 2 | 3 | 4)}
                className={`px-2.5 py-1 text-xs font-mono font-bold rounded-lg transition-colors ${
                  gridCols === num ? 'bg-gray-800 text-white shadow' : 'text-gray-500 hover:text-gray-300'
                }`}
                title={`${num} columna${num > 1 ? 's' : ''}`}
              >
                {num}
              </button>
            ))}
          </div>

          {/* Monitor Fullscreen Button (F11) */}
          <button
            onClick={toggleFullscreen}
            className={`flex items-center px-3 py-1.5 rounded-xl border text-xs font-bold transition-all active:scale-95 ${
              isFullscreenMode
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/50'
                : 'bg-gray-900 hover:bg-gray-800 text-gray-300 border-gray-800'
            }`}
            title="Pantalla Completa para operar en tu monitor (F11)"
          >
            {isFullscreenMode ? (
              <>
                <Minimize2 className="w-3.5 h-3.5 mr-1 text-amber-400" />
                <span className="hidden md:inline">Salir</span>
              </>
            ) : (
              <>
                <Maximize2 className="w-3.5 h-3.5 mr-1 text-rodez-red" />
                <span className="hidden md:inline">F11</span>
              </>
            )}
          </button>

          {/* Backup Options */}
          <button
            onClick={handleExport}
            className="p-1.5 text-gray-400 hover:text-white bg-gray-900 hover:bg-gray-800 rounded-xl border border-gray-800"
            title="Exportar respaldo de imágenes (JSON)"
          >
            <Download className="w-3.5 h-3.5" />
          </button>

          <label
            className="p-1.5 text-gray-400 hover:text-white bg-gray-900 hover:bg-gray-800 rounded-xl border border-gray-800 cursor-pointer"
            title="Importar respaldo (JSON)"
          >
            <Upload className="w-3.5 h-3.5" />
            <input
              type="file"
              ref={importInputRef}
              accept=".json"
              onChange={handleImport}
              className="hidden"
            />
          </label>

          {/* Add Image Button */}
          <button
            onClick={() => {
              setModalImageBase64(null);
              if (selectedCategory !== 'Todos') setModalCategory(selectedCategory);
              setIsUploadModalOpen(true);
            }}
            className="flex items-center px-3 py-1.5 bg-rodez-red hover:bg-red-600 text-white font-bold text-xs rounded-xl shadow-lg shadow-red-900/30 active:scale-95 transition-all"
            title="Agregar Imagen (o pulsa Ctrl + V)"
          >
            <Plus className="w-4 h-4 md:mr-1" />
            <span className="hidden md:inline">Subir Imagen</span>
          </button>
        </div>
      </div>

      {/* MAIN CHART WALL (CLEAN, 100% FULL IMAGE PRIORITY) */}
      <div className="flex-1 overflow-y-auto p-3 md:p-5 custom-scrollbar">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-500 space-y-3">
            <div className="w-7 h-7 border-2 border-rodez-red border-t-transparent rounded-full animate-spin"></div>
            <p className="text-xs uppercase tracking-wider font-semibold">Cargando gráficos...</p>
          </div>
        ) : filteredItems.length > 0 ? (
          <div
            className={`grid gap-4 md:gap-5 ${
              gridCols === 1
                ? 'grid-cols-1 max-w-5xl mx-auto'
                : gridCols === 2
                ? 'grid-cols-1 md:grid-cols-2'
                : gridCols === 3
                ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'
                : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
            }`}
          >
            {filteredItems.map((item) => {
              const imgSrc = item.imageUrl || item.imageBase64 || '';
              return (
                <div
                  key={item.id}
                  className="group bg-[#0e131b] border border-gray-800/80 hover:border-gray-600 rounded-2xl overflow-hidden transition-all duration-200 flex flex-col shadow-xl hover:shadow-2xl relative"
                >
                  {/* Floating Minimal Category Badge */}
                  <div className="absolute top-2.5 left-2.5 z-10 pointer-events-none">
                    <span className={`px-2.5 py-1 rounded-lg text-[11px] font-black uppercase tracking-wider border shadow-md backdrop-blur-md ${getCategoryColor(item.category)}`}>
                      {item.category}
                    </span>
                  </div>

                  {/* Floating Action Buttons (Delete, Maximize) */}
                  <div className="absolute top-2.5 right-2.5 z-10 flex items-center space-x-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => {
                        setLightboxItem(item);
                        setZoomScale(1);
                      }}
                      className="p-1.5 rounded-lg bg-black/70 backdrop-blur-md text-white hover:bg-rodez-red transition-all shadow-md"
                      title="Ver en pantalla completa"
                    >
                      <Maximize2 className="w-4 h-4" />
                    </button>

                    <button
                      onClick={(e) => handleDeleteItem(item, e)}
                      className="p-1.5 rounded-lg bg-black/70 backdrop-blur-md text-gray-300 hover:text-white hover:bg-red-600 transition-all shadow-md"
                      title="Eliminar imagen"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  {/* FULL CHART IMAGE CONTAINER (NO CROPPING) */}
                  <div
                    onClick={() => {
                      setLightboxItem(item);
                      setZoomScale(1);
                    }}
                    className="w-full bg-black/90 cursor-pointer flex items-center justify-center p-1 overflow-hidden"
                  >
                    <img
                      src={imgSrc}
                      alt={item.category}
                      className="w-full h-auto max-h-[75vh] object-contain select-none rounded-lg group-hover:brightness-105 transition-all"
                      loading="lazy"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* EMPTY STATE */
          <div className="flex flex-col items-center justify-center py-20 px-4 text-center max-w-md mx-auto">
            <div className="w-14 h-14 rounded-2xl bg-gray-900 border border-gray-800 flex items-center justify-center mb-3 text-gray-500">
              <Upload className="w-6 h-6 text-rodez-red" />
            </div>
            <h3 className="text-base font-bold text-white mb-1.5">No hay gráficos en {selectedCategory}</h3>
            <p className="text-xs text-gray-400 mb-5 leading-relaxed">
              Toma un pantallazo con <kbd className="px-1.5 py-0.5 bg-gray-800 border border-gray-700 rounded text-[10px] text-white font-mono">Win + Shift + S</kbd> y pulsa <kbd className="px-1.5 py-0.5 bg-gray-800 border border-gray-700 rounded text-[10px] text-white font-mono">Ctrl + V</kbd> aquí para guardarlo directamente en esta categoría.
            </p>
            <div className="flex flex-wrap gap-2.5 justify-center">
              <button
                onClick={() => {
                  setModalImageBase64(null);
                  if (selectedCategory !== 'Todos') setModalCategory(selectedCategory);
                  setIsUploadModalOpen(true);
                }}
                className="px-4 py-2 bg-rodez-red hover:bg-red-600 text-white font-bold text-xs rounded-xl shadow-lg shadow-red-900/30 transition-all flex items-center"
              >
                <Plus className="w-4 h-4 mr-1.5" /> Subir Imagen
              </button>
              <button
                onClick={handleSeedExamples}
                className="px-4 py-2 bg-gray-900 hover:bg-gray-800 text-gray-300 font-bold text-xs rounded-xl border border-gray-800 transition-all flex items-center"
              >
                <Sparkles className="w-4 h-4 mr-1.5 text-amber-400" /> Cargar Ejemplos
              </button>
            </div>
          </div>
        )}
      </div>

      {/* MODAL: CATEGORY RULES & EDIT NAME (Accessible via 📝 Icon) */}
      {rulesCategory && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setRulesCategory(null)}
        >
          <div
            className="bg-gray-900 border border-gray-800 rounded-3xl max-w-lg w-full p-6 shadow-2xl flex flex-col space-y-4 animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-gray-800">
              <div className="flex items-center space-x-2">
                <FileText className="w-5 h-5 text-amber-400" />
                <h3 className="text-base font-bold text-white">
                  Reglas de la Categoría
                </h3>
              </div>
              <button
                onClick={() => setRulesCategory(null)}
                className="p-1 text-gray-400 hover:text-white rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Category Name (Editable) */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-1.5">
                Nombre de la Categoría
              </label>
              <div className="flex items-center space-x-2">
                <input
                  type="text"
                  value={editingCategoryName}
                  onChange={(e) => setEditingCategoryName(e.target.value)}
                  className="w-full bg-gray-950 border border-gray-800 rounded-xl p-2.5 text-sm text-white focus:outline-none focus:border-rodez-red font-bold"
                  placeholder="Ej: Reversión Institucional"
                />
              </div>
            </div>

            {/* Category Rules (Editable) */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-1.5">
                Reglas y Criterios que debes ver para operar
              </label>
              <textarea
                rows={6}
                value={editingCategoryRules}
                onChange={(e) => setEditingCategoryRules(e.target.value)}
                placeholder="Escribe aquí las reglas obligatorias antes de tomar una entrada..."
                className="w-full bg-gray-950 border border-gray-800 rounded-xl p-3 text-xs text-gray-200 focus:outline-none focus:border-rodez-red font-sans leading-relaxed custom-scrollbar"
              />
            </div>

            {/* Actions */}
            <div className="flex justify-end space-x-2 pt-3 border-t border-gray-800">
              <button
                onClick={() => setRulesCategory(null)}
                className="px-4 py-2 rounded-xl border border-gray-800 text-gray-400 text-xs font-bold hover:bg-gray-850"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveCategoryChanges}
                className="px-5 py-2 rounded-xl bg-rodez-red hover:bg-red-600 text-white text-xs font-bold shadow-lg shadow-red-900/30 flex items-center"
              >
                <Check className="w-4 h-4 mr-1.5" />
                Guardar Reglas
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ULTRA CLEAN UPLOAD MODAL: ONLY IMAGE + CATEGORY */}
      {isUploadModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setIsUploadModalOpen(false)}
        >
          <div
            className="bg-gray-900 border border-gray-800 rounded-3xl max-w-lg w-full p-6 shadow-2xl flex flex-col space-y-4 animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-gray-800">
              <h3 className="text-base font-bold text-white flex items-center">
                <Plus className="w-5 h-5 text-rodez-red mr-2" />
                Agregar Gráfico a Base Visual
              </h3>
              <button
                onClick={() => setIsUploadModalOpen(false)}
                className="p-1 text-gray-400 hover:text-white rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Image Preview / Paste Zone */}
            <div
              onClick={() => fileInputRef.current?.click()}
              className={`w-full max-h-[45vh] aspect-video rounded-2xl border-2 border-dashed flex flex-col items-center justify-center cursor-pointer overflow-hidden transition-all relative ${
                modalImageBase64
                  ? 'border-rodez-red/50 bg-black'
                  : 'border-gray-700 bg-gray-950 hover:border-rodez-red'
              }`}
            >
              {modalImageBase64 ? (
                <>
                  <img
                    src={modalImageBase64}
                    alt="Preview"
                    className="w-full h-full object-contain"
                  />
                  <div className="absolute inset-0 bg-black/50 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center">
                    <span className="text-xs font-bold text-white bg-gray-800/90 px-3 py-1.5 rounded-lg border border-gray-700">
                      Cambiar Imagen (o pega con Ctrl+V)
                    </span>
                  </div>
                </>
              ) : (
                <div className="p-6 text-center text-gray-500">
                  <Upload className="w-10 h-10 mx-auto mb-2 opacity-50 text-rodez-red" />
                  <p className="font-bold text-sm text-gray-200">Clic aquí para cargar imagen</p>
                  <p className="text-xs text-gray-500 mt-1">O simplemente presiona Ctrl + V con tu pantallazo</p>
                </div>
              )}
              <input
                type="file"
                ref={fileInputRef}
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) processImageFile(file);
                }}
                className="hidden"
              />
            </div>

            {/* Category Selector ONLY */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">
                Selecciona la Categoría:
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {categories.map((cat) => {
                  const isSelected = modalCategory === cat.name;
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setModalCategory(cat.name)}
                      className={`p-2.5 rounded-xl text-xs font-bold border transition-all text-center ${
                        isSelected
                          ? 'bg-rodez-red text-white border-rodez-red shadow-md shadow-red-900/40 ring-1 ring-white/30'
                          : `${cat.color} opacity-70 hover:opacity-100`
                      }`}
                    >
                      {cat.name}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end space-x-2 pt-3 border-t border-gray-800">
              <button
                type="button"
                onClick={() => setIsUploadModalOpen(false)}
                className="px-4 py-2 rounded-xl border border-gray-800 text-gray-400 text-xs font-bold hover:bg-gray-850"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveUpload}
                disabled={isSaving}
                className="px-6 py-2.5 rounded-xl bg-rodez-red hover:bg-red-600 text-white text-xs font-bold shadow-lg shadow-red-900/30 transition-all disabled:opacity-50"
              >
                {isSaving ? 'Guardando...' : 'Guardar Gráfico'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FULLSCREEN LIGHTBOX / ZOOM / THEATER */}
      {lightboxItem && (
        <div
          className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-md flex flex-col justify-between p-3 md:p-6 animate-in fade-in duration-150 select-none"
          onClick={() => {
            setLightboxItem(null);
            setZoomScale(1);
          }}
        >
          {/* Top HUD Controls */}
          <div
            className="flex items-center justify-between z-50 bg-gray-900/90 border border-gray-800 px-4 py-2 rounded-2xl backdrop-blur-md"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center space-x-3">
              <span className={`px-2.5 py-1 rounded-lg text-xs font-black uppercase tracking-wider border ${getCategoryColor(lightboxItem.category)}`}>
                {lightboxItem.category}
              </span>
            </div>

            <div className="flex items-center space-x-2">
              <button
                onClick={() => setZoomScale(prev => Math.min(prev + 0.25, 3))}
                className="p-2 text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700 rounded-lg border border-gray-700"
                title="Acercar (+)"
              >
                <ZoomIn className="w-4 h-4" />
              </button>

              <button
                onClick={() => setZoomScale(prev => Math.max(prev - 0.25, 0.5))}
                className="p-2 text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700 rounded-lg border border-gray-700"
                title="Alejar (-)"
              >
                <ZoomOut className="w-4 h-4" />
              </button>

              <button
                onClick={() => setZoomScale(1)}
                className="p-2 text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700 rounded-lg border border-gray-700 text-xs font-mono"
                title="Restablecer Zoom (100%)"
              >
                <RotateCcw className="w-4 h-4" />
              </button>

              <button
                onClick={() => {
                  setLightboxItem(null);
                  setZoomScale(1);
                }}
                className="p-2 text-white bg-red-600 hover:bg-red-700 rounded-lg shadow-lg ml-2"
                title="Cerrar (Esc)"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Center Image Canvas (100% Complete Image) */}
          <div className="relative flex-1 flex items-center justify-center overflow-hidden my-2">
            {/* Prev Arrow */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                navigateLightbox('prev');
              }}
              disabled={filteredItems.indexOf(lightboxItem) === 0}
              className="absolute left-2 md:left-6 top-1/2 -translate-y-1/2 z-40 p-3 rounded-full bg-gray-900/80 hover:bg-rodez-red text-white border border-gray-700 transition-all disabled:opacity-0 active:scale-95"
              title="Anterior Gráfico"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>

            {/* Next Arrow */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                navigateLightbox('next');
              }}
              disabled={filteredItems.indexOf(lightboxItem) === filteredItems.length - 1}
              className="absolute right-2 md:right-6 top-1/2 -translate-y-1/2 z-40 p-3 rounded-full bg-gray-900/80 hover:bg-rodez-red text-white border border-gray-700 transition-all disabled:opacity-0 active:scale-95"
              title="Siguiente Gráfico"
            >
              <ChevronRight className="w-6 h-6" />
            </button>

            {/* Main Full Image */}
            <div
              className="transition-transform duration-150 ease-out flex items-center justify-center max-w-full max-h-full"
              style={{ transform: `scale(${zoomScale})` }}
              onClick={(e) => e.stopPropagation()}
            >
              <img
                src={lightboxItem.imageUrl || lightboxItem.imageBase64 || ''}
                alt={lightboxItem.category}
                className="max-h-[82vh] max-w-[95vw] object-contain rounded-xl shadow-2xl border border-gray-800 bg-black cursor-grab select-none"
              />
            </div>
          </div>

          {/* Bottom HUD: Shows Category Rules */}
          {(() => {
            const currentCatDef = categories.find(c => c.name.toLowerCase() === lightboxItem.category.toLowerCase());
            if (!currentCatDef || !currentCatDef.rules) return null;
            return (
              <div
                className="z-50 max-w-3xl mx-auto w-full bg-gray-900/90 border border-gray-800 px-6 py-2.5 rounded-2xl backdrop-blur-md shadow-2xl text-xs text-gray-200"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="text-[10px] font-bold text-amber-400 uppercase tracking-wider mb-1 flex items-center">
                  <FileText className="w-3 h-3 mr-1.5" />
                  Reglas de {currentCatDef.name}:
                </div>
                <div className="leading-relaxed whitespace-pre-line font-mono text-gray-300 text-[11px]">
                  {currentCatDef.rules}
                </div>
              </div>
            );
          })()}
        </div>
      )}

    </div>
  );
};
