import React, { useState, useEffect } from 'react';
import { RodezView } from './components/RodezView';
import { BudgetView } from './components/BudgetView';
import { LoginScreen } from './components/LoginScreen';
import { LoadingScreen } from './components/LoadingScreen';
import { DominicView } from './components/DominicView';
import { ViewState, VisualTrade } from './types';
import { LayoutDashboard, Target, Settings, BarChart2, Wallet, LogOut, User, Download, Smartphone, Share, Users } from 'lucide-react';
import { getAllTrades, saveTrade, migrateLocalTradesToFirebase, resetUserData, uploadTradeImageFromBase64, hasLegacyData, runFullMigration } from './services/firebaseService';
import { resetBudgetData } from './services/budgetService';
import { useAuth } from './hooks/useAuth';
import { usePWAInstall } from './hooks/usePWAInstall';

const App: React.FC = () => {
  const { user, loading: authLoading, logout } = useAuth();
  const { isInstallable, installApp } = usePWAInstall();
  const [view, setView] = useState<ViewState>(ViewState.BUDGET); // Set initial view to BudgetView as requested
  const [trades, setTrades] = useState<VisualTrade[]>([]);
  const [loading, setLoading] = useState(true);
  const [showBudgetResetConfirm, setShowBudgetResetConfirm] = useState(false);

  const loadTrades = async () => {
    if (!user) {
      console.log('[App] No user logged in, skipping loadTrades');
      setLoading(false);
      return;
    }

    console.log('[App] Loading trades for user:', user.email, 'UID:', user.uid);
    try {
      // 1. Migrate localStorage trades if they exist (only once)
      const savedTrades = localStorage.getItem('jf_rodez_trades');
      if (savedTrades) {
        try {
          const localTrades: VisualTrade[] = JSON.parse(savedTrades);
          console.log('Migrating', localTrades.length, 'trades from localStorage to Firebase...');
          await migrateLocalTradesToFirebase(localTrades, user.uid);
          localStorage.removeItem('jf_rodez_trades');
          console.log('LocalStorage migration completed and cleared!');
        } catch (parseError) {
          console.error('Error parsing local trades:', parseError);
          localStorage.removeItem('jf_rodez_trades'); // Clear corrupted data
        }
      }

      // 2. Migrate legacy global Firestore data if it exists (only once)
      try {
        const hasLegacy = await hasLegacyData(user.uid);
        if (hasLegacy) {
          console.log('[App] Legacy data detected, initiating full migration...');
          const results = await runFullMigration(user.uid);
          console.log('[App] Migration completed successfully:', results);
          if (results.total > 0) {
            alert(`Se han migrado ${results.total} registros antiguos a tu cuenta personal con éxito.`);
          }
        }
      } catch (migrationError) {
        console.warn('[App] Legacy migration failed or restricted:', migrationError);
      }

      // 3. Load all trades from user's private collection
      const firebaseTrades = await getAllTrades(user.uid);
      setTrades(firebaseTrades);
    } catch (error) {
      console.error('Error loading trades from Firebase:', error);
      // Don't fallback to localStorage - it was already migrated and cleared
      setTrades([]);
    } finally {
      setLoading(false);
    }
  };

  // Load trades from Firebase on mount and migrate from localStorage if needed
  useEffect(() => {
    loadTrades();
  }, [user]);

  const handleSaveTrade = async (tradeData: Omit<VisualTrade, 'id' | 'createdAt'>) => {
    if (!user) return;
    try {
      const tradeId = crypto.randomUUID();
      let imageUrl = '';

      // Upload image if it's base64 and not already a URL
      if (tradeData.tradeImage.base64) {
        imageUrl = await uploadTradeImageFromBase64(
          tradeData.tradeImage.base64,
          tradeData.tradeImage.mimeType,
          tradeId
        );
      }

      const tradeImageToSave = { ...tradeData.tradeImage };
      if (tradeImageToSave.base64 === undefined) {
        delete tradeImageToSave.base64;
      }

      const newTrade: VisualTrade = {
        ...tradeData,
        id: tradeId,
        createdAt: Date.now(),
        tradeImage: {
          ...tradeImageToSave,
          url: imageUrl,
        }
      };

      // Save to Firebase
      await saveTrade(newTrade, user.uid);

      // Reload trades from Firebase to ensure single source of truth and avoid duplication
      await loadTrades();
    } catch (error) {
      console.error('Error saving trade:', error);
      alert('Error al guardar el trade. Por favor, intenta de nuevo.');
    }
  };

  // Show loading screen while checking authentication
  if (authLoading) {
    return <LoadingScreen />;
  }

  // Show login screen if not authenticated
  if (!user) {
    return <LoginScreen />;
  }

  return (
    <div className="flex flex-col h-screen bg-gray-950 text-white font-sans selection:bg-rodez-red selection:text-white">
      {/* Top Navigation */}
      <nav className="w-full h-16 md:h-20 bg-gray-900 border-b border-gray-800 flex items-center justify-between shrink-0 px-4 md:px-6">
        <div className="flex items-center h-full">
          {/* Logo */}
          <div className="h-full flex items-center mr-6 md:mr-10">
            <div className="relative h-12 w-24 md:h-16 md:w-32 flex items-center justify-center overflow-hidden">
              <img
                src="/logo_rodez.png"
                alt="RODEZ"
                className="h-24 md:h-32 w-auto object-contain scale-[1.3] md:scale-[1.5] transform origin-center"
              />
            </div>
          </div>

          {/* Navigation Links */}
          <div className="flex items-center space-x-1 md:space-x-2">
            <button
              onClick={() => setView(ViewState.SNIPER)}
              className={`flex items-center justify-center px-3 py-2 md:px-4 md:py-2.5 rounded-lg transition-all ${view === ViewState.SNIPER ? 'bg-gray-800 text-rodez-red shadow-inner' : 'text-gray-400 hover:text-white hover:bg-gray-800/50'}`}
              title="RODEZ"
            >
              <BarChart2 className="w-5 h-5 md:mr-2" />
              <span className="hidden md:block font-medium">RODEZ</span>
            </button>

            <button
              onClick={() => setView(ViewState.BUDGET)}
              className={`flex items-center justify-center px-3 py-2 md:px-4 md:py-2.5 rounded-lg transition-all ${view === ViewState.BUDGET ? 'bg-gray-800 text-rodez-red shadow-inner' : 'text-gray-400 hover:text-white hover:bg-gray-800/50'}`}
              title="Presupuesto"
            >
              <Wallet className="w-5 h-5 md:mr-2" />
              <span className="hidden md:block font-medium">Presupuesto</span>
            </button>

            <button
              onClick={() => setView(ViewState.DOMINIC)}
              className={`flex items-center justify-center px-3 py-2 md:px-4 md:py-2.5 rounded-lg transition-all ${view === ViewState.DOMINIC ? 'bg-gray-800 text-rodez-red shadow-inner' : 'text-gray-400 hover:text-white hover:bg-gray-800/50'}`}
              title="Dominic"
            >
              <Users className="w-5 h-5 md:mr-2" />
              <span className="hidden md:block font-medium">Dominic</span>
            </button>

            <button
              onClick={() => setView(ViewState.SETTINGS)}
              className={`flex items-center justify-center px-3 py-2 md:px-4 md:py-2.5 rounded-lg transition-all ${view === ViewState.SETTINGS ? 'bg-gray-800 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-800/50'}`}
              title="Settings"
            >
              <Settings className="w-5 h-5 md:mr-2" />
              <span className="hidden md:block font-medium">Ajustes</span>
            </button>
          </div>
        </div>

        {/* User Profile and Logout */}
        <div className="flex items-center space-x-4">
          <div className="hidden lg:flex flex-col text-right mr-2 justify-center">
            <span className="text-sm font-semibold text-white leading-tight">{user.displayName || 'Usuario'}</span>
            <span className="text-xs text-gray-500">{user.email}</span>
          </div>
          {user.photoURL ? (
            <img
              src={user.photoURL}
              alt={user.displayName || 'User'}
              className="w-10 h-10 rounded-full border-2 border-rodez-red"
            />
          ) : (
            <div className="w-10 h-10 rounded-full bg-rodez-red flex items-center justify-center">
              <User className="w-5 h-5 text-white" />
            </div>
          )}
          <div className="w-px h-8 bg-gray-800 mx-2 hidden sm:block"></div>
          <button
            onClick={logout}
            className="flex items-center justify-center p-2 rounded-lg text-gray-400 hover:text-red-400 hover:bg-red-900/20 transition-all"
            title="Cerrar Sesión"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </nav>

      {/* Main Content Area */}
      <main className="flex-1 relative overflow-hidden flex flex-col min-w-0">
        {view === ViewState.SNIPER && (
          <RodezView trades={trades} onSaveTrade={handleSaveTrade} />
        )}

        {view === ViewState.BUDGET && (
          <BudgetView />
        )}

        {view === ViewState.DOMINIC && (
          <DominicView />
        )}



        {view === ViewState.SETTINGS && (
          <div className="h-full overflow-y-auto">
            <div className="max-w-2xl mx-auto py-8 px-4">
            <div className="text-center mb-8">
              <Settings className="w-16 h-16 mx-auto mb-4 text-gray-700" />
              <h2 className="text-2xl font-bold text-white mb-2">Ajustes</h2>
              <p className="text-gray-400">Configuración de tu cuenta y aplicación</p>
            </div>

            {/* Mobile App Section */}
            <div className="bg-gray-800/30 rounded-xl p-6 mb-6 border border-gray-800">
              <h3 className="text-lg font-semibold mb-4 flex items-center text-white">
                <Smartphone className="w-5 h-5 mr-2 text-rodez-red" />
                Aplicación Móvil RODEZ
              </h3>

              <div className="space-y-4">
                <p className="text-gray-400 text-sm">
                  Instala RODEZ en tu dispositivo para un acceso más rápido y mejor experiencia.
                </p>

                {isInstallable ? (
                  <button
                    onClick={installApp}
                    className="w-full sm:w-auto flex items-center justify-center px-6 py-3 bg-rodez-red hover:bg-red-600 text-white rounded-lg transition-all shadow-lg shadow-red-900/20 font-medium"
                  >
                    <Download className="w-5 h-5 mr-2" />
                    Instalar Aplicación
                  </button>
                ) : (
                  <div className="bg-gray-900/50 rounded-lg p-4 border border-gray-800">
                    <p className="text-sm text-gray-300 font-medium mb-2">¿Cómo instalar?</p>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div>
                        <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Android / Chrome</p>
                        <p className="text-sm text-gray-400">Si no ves el botón, usa el menú del navegador y selecciona "Instalar aplicación".</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">iOS (iPhone/iPad)</p>
                        <p className="text-sm text-gray-400 flex flex-col gap-1">
                          <span>1. Toca el botón <Share className="w-3 h-3 inline mx-1" /> Compartir</span>
                          <span>2. Selecciona "Agregar a Inicio"</span>
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Danger Zone */}
            <div className="bg-red-900/10 rounded-xl p-6 border border-red-900/20">
              <h3 className="text-lg font-semibold mb-4 flex items-center text-red-400">
                <LogOut className="w-5 h-5 mr-2" />
                Zona de Peligro
              </h3>

              <p className="text-gray-400 text-sm mb-4">
                Estas acciones son destructivas y no se pueden deshacer.
              </p>

              {/* Budget Reset Button */}
              {/* Budget Reset Button */}
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  setShowBudgetResetConfirm(true);
                }}
                className="w-full sm:w-auto px-4 py-2 mb-3 bg-orange-900/20 text-orange-400 rounded hover:bg-orange-900/40 border border-orange-900/50 transition-colors text-sm flex items-center justify-center"
              >
                <Wallet className="w-4 h-4 mr-2" />
                Reiniciar Datos de Presupuesto
              </button>

              {/* Custom Budget Reset Confirmation Modal */}
              {showBudgetResetConfirm && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
                  <div className="bg-gray-900 border border-gray-800 rounded-xl max-w-md w-full p-6 shadow-2xl">
                    <h3 className="text-xl font-bold text-white mb-4 flex items-center">
                      <Wallet className="w-6 h-6 mr-2 text-orange-500" />
                      ¿Borrar datos de Presupuesto?
                    </h3>
                    <div className="space-y-4 text-gray-300 text-sm mb-6">
                      <p>Estás a punto de eliminar permanentemente:</p>
                      <ul className="list-disc pl-5 space-y-1 text-orange-400">
                        <li>Cuentas y saldos</li>
                        <li>Todas las transacciones</li>
                        <li>Categorías personalizadas</li>
                        <li>Deudas recurrentes</li>
                      </ul>
                      <p className="font-medium text-white">Esta acción NO afectará tus Trades ni el calendario de Dominic.</p>
                      <p className="bg-red-900/20 border border-red-900/50 p-3 rounded text-red-400">
                        Esta acción no se puede deshacer.
                      </p>
                    </div>

                    <div className="flex gap-3">
                      <button
                        onClick={() => setShowBudgetResetConfirm(false)}
                        className="flex-1 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded transition-colors"
                        disabled={loading}
                      >
                        Cancelar
                      </button>
                      <button
                        onClick={async () => {
                          try {
                            setLoading(true);
                            await resetBudgetData(user.uid);
                            alert("Datos eliminados correctamente. Recargando...");
                            window.location.reload();
                          } catch (error) {
                            console.error("Error resetting budget:", error);
                            alert("Hubo un error al eliminar los datos.");
                            setLoading(false);
                            setShowBudgetResetConfirm(false);
                          }
                        }}
                        className="flex-1 px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded transition-colors flex items-center justify-center"
                        disabled={loading}
                      >
                        {loading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'Confirmar Eliminación'}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Full Account Reset Button */}
              <button
                onClick={async () => {
                  if (confirm("ADVERTENCIA: ¿Estás seguro de que quieres borrar TODOS tus datos? Esta acción eliminará permanentemente todos tus trades, cuentas y configuraciones de la nube y no se puede deshacer.")) {
                    try {
                      setLoading(true);
                      await resetUserData(user.uid);
                      setTrades([]);
                      localStorage.removeItem('jf_rodez_trades');
                      alert("Cuenta reiniciada correctamente. La aplicación se recargará.");
                      window.location.reload();
                    } catch (error) {
                      console.error("Error resetting account:", error);
                      alert("Error al reiniciar la cuenta. Por favor intenta de nuevo.");
                      setLoading(false);
                    }
                  }
                }}
                className="w-full sm:w-auto px-4 py-2 bg-red-900/20 text-red-400 rounded hover:bg-red-900/40 border border-red-900/50 transition-colors text-sm flex items-center justify-center"
              >
                <LogOut className="w-4 h-4 mr-2" />
                Reinicio Total de Cuenta
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
    </div>
  );
};

export default App;