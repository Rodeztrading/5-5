import React, { useState } from 'react';
import { BudgetView } from './components/BudgetView';
import { LoginScreen } from './components/LoginScreen';
import { LoadingScreen } from './components/LoadingScreen';
import { Settings, LogOut, User, Download, Smartphone, Share, Trash2, X } from 'lucide-react';
import { resetBudgetData } from './services/budgetService';
import { useAuth } from './hooks/useAuth';
import { usePWAInstall } from './hooks/usePWAInstall';

type AppView = 'BUDGET' | 'SETTINGS';

const App: React.FC = () => {
  const { user, loading: authLoading, logout } = useAuth();
  const { isInstallable, installApp } = usePWAInstall();
  const [view, setView] = useState<AppView>('BUDGET');
  const [loading, setLoading] = useState(false);
  const [showBudgetResetConfirm, setShowBudgetResetConfirm] = useState(false);

  if (authLoading) {
    return <LoadingScreen />;
  }

  if (!user) {
    return <LoginScreen />;
  }

  return (
    <div className="flex flex-col h-screen h-[100dvh] w-full overflow-hidden bg-gray-950 text-white font-sans selection:bg-rodez-red selection:text-white">

      {/* Top Navigation */}
      <nav className="w-full h-16 md:h-20 bg-gray-900 border-b border-gray-800 flex items-center justify-between shrink-0 px-4 md:px-6">
        <div className="flex items-center h-full">

          {/* Logo 5-5 Finanzas */}
          <div className="h-full flex items-center mr-6 md:mr-10">
            <div className="flex flex-col cursor-pointer" onClick={() => setView('BUDGET')}>
              <span className="text-sm md:text-base font-black tracking-tight text-white leading-none">
                5-5 <span className="text-rodez-red">FINANZAS</span>
              </span>
              <span className="text-[9px] md:text-[10px] text-gray-400 font-semibold tracking-wider uppercase leading-tight mt-0.5">
                Control de Presupuesto
              </span>
            </div>
          </div>

          {/* Navigation Links */}
          <div className="flex items-center space-x-1 md:space-x-2">
            <button
              onClick={() => setView('SETTINGS')}
              className={`flex items-center justify-center px-3 py-2 md:px-4 md:py-2.5 rounded-lg transition-all ${view === 'SETTINGS' ? 'bg-gray-800 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-800/50'}`}
              title="Ajustes"
            >
              <Settings className="w-5 h-5 md:mr-2" />
              <span className="hidden md:block font-medium">Ajustes</span>
            </button>
          </div>
        </div>

        {/* User Info & Logout */}
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

      {/* Main Content */}
      <main className="flex-1 relative overflow-hidden flex flex-col min-w-0">

        {view === 'BUDGET' && <BudgetView />}

        {view === 'SETTINGS' && (
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
                  Aplicación Móvil 5-5 Finanzas
                </h3>
                <div className="space-y-4">
                  <p className="text-gray-400 text-sm">
                    Instala 5-5 Finanzas en tu dispositivo para un acceso más rápido y mejor experiencia.
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
                          <p className="text-sm text-gray-400">Usa el menú del navegador y selecciona "Instalar aplicación".</p>
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

                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    setShowBudgetResetConfirm(true);
                  }}
                  className="w-full sm:w-auto px-4 py-2 bg-orange-900/20 text-orange-400 rounded hover:bg-orange-900/40 border border-orange-900/50 transition-colors text-sm flex items-center justify-center"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Reiniciar Datos de Presupuesto
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Budget Reset Confirmation Modal */}
      {showBudgetResetConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md overflow-hidden rounded-xl border border-gray-800 bg-gray-900 shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-800 px-5 py-4">
              <h2 className="text-sm font-bold text-white">
                5-5 <span className="text-rodez-red">FINANZAS</span>
              </h2>
              <button
                type="button"
                onClick={() => setShowBudgetResetConfirm(false)}
                disabled={loading}
                className="rounded p-1 text-gray-400 hover:bg-gray-800 hover:text-white disabled:opacity-50"
                aria-label="Cerrar confirmación"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-6">
              <h3 className="mb-4 flex items-center text-xl font-bold text-white">
                <Trash2 className="mr-2 h-6 w-6 text-orange-500" />
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
                    alert('Datos eliminados correctamente. Recargando...');
                    window.location.reload();
                  } catch (error) {
                    console.error('Error resetting budget:', error);
                    alert('Hubo un error al eliminar los datos.');
                    setLoading(false);
                    setShowBudgetResetConfirm(false);
                  }
                }}
                className="flex-1 px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded transition-colors flex items-center justify-center"
                disabled={loading}
              >
                {loading
                  ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  : 'Confirmar Eliminación'}
              </button>
            </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;