import React, { useState } from 'react';
import { Check, CreditCard, Loader2, LogOut, ShieldCheck, XCircle } from 'lucide-react';
import type { User } from 'firebase/auth';
import type { Subscription } from '../hooks/useSubscription';

interface SubscriptionAccessProps {
  user: User;
  subscription: Subscription | null;
  error: string | null;
  startCheckout: () => Promise<void>;
  cancel: () => Promise<void>;
  logout: () => Promise<void>;
  onError: (message: string | null) => void;
  canAccess: boolean;
  compact?: boolean;
}

const formatDate = (value?: Subscription['accessUntil']) => {
  if (!value) return null;
  return value.toDate().toLocaleDateString('es-CO', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
};

export const SubscriptionAccess: React.FC<SubscriptionAccessProps> = ({
  user,
  subscription,
  error,
  startCheckout,
  cancel,
  logout,
  onError,
  canAccess,
  compact = false,
}) => {
  const [busy, setBusy] = useState(false);
  const [confirmCancellation, setConfirmCancellation] = useState(false);
  const active = canAccess && subscription?.status === 'active';
  const cancelled = subscription?.status === 'cancelled';

  const runAction = async (action: () => Promise<void>) => {
    setBusy(true);
    onError(null);
    try {
      await action();
    } catch (actionError) {
      console.error('Subscription action failed:', actionError);
      onError(actionError instanceof Error
        ? actionError.message
        : 'No pudimos completar la acción. Inténtalo nuevamente.');
    } finally {
      setBusy(false);
    }
  };

  const Wrapper = compact ? 'div' : 'main';
  return (
    <Wrapper className={compact ? 'text-white' : 'min-h-screen bg-gray-950 px-4 py-10 text-white'}>
      <div className={compact ? 'w-full' : 'mx-auto max-w-lg'}>
        {!compact && <header className="mb-8 flex items-center justify-between">
          <div>
            <p className="text-sm font-black tracking-tight">5-5 <span className="text-rodez-red">FINANZAS</span></p>
            <p className="mt-1 text-xs text-gray-400">{user.email}</p>
          </div>
          <button
            type="button"
            onClick={logout}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-700 px-3 py-2 text-sm text-gray-300 hover:bg-gray-800"
          >
            <LogOut className="h-4 w-4" />
            Salir
          </button>
        </header>}

        <section className={`rounded-2xl border border-gray-800 bg-gray-900 p-6 shadow-2xl ${compact ? '' : 'sm:p-8'}`}>
          <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-xl bg-rodez-red/15 text-rodez-red">
            {canAccess ? <Check className="h-6 w-6" /> : <CreditCard className="h-6 w-6" />}
          </div>
          <h1 className="text-2xl font-bold">
            {canAccess ? 'Tu suscripción' : 'Activa 5-5 Finanzas'}
          </h1>
          <p className="mt-2 text-gray-400">
            {canAccess
              ? cancelled
                ? `Tu suscripción fue cancelada. Mantendrás acceso hasta ${formatDate(subscription?.accessUntil) ?? 'el final del período pagado'}.`
                : 'Tu suscripción está activa.'
              : 'Accede a tus cuentas, presupuestos, transacciones e inversiones con una suscripción mensual.'}
          </p>

          {!canAccess && (
            <div className="my-6 rounded-xl border border-gray-800 bg-gray-950 p-5">
              <div className="flex items-baseline justify-between gap-3">
                <span className="font-semibold">Plan mensual</span>
                <span className="text-2xl font-black">$9.900 <span className="text-sm font-medium text-gray-400">COP/mes</span></span>
              </div>
              <ul className="mt-4 space-y-2 text-sm text-gray-300">
                <li className="flex items-center gap-2"><Check className="h-4 w-4 text-emerald-400" /> Sin período de prueba</li>
                <li className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-emerald-400" /> Pago recurrente procesado por Mercado Pago</li>
                <li className="flex items-center gap-2"><XCircle className="h-4 w-4 text-gray-500" /> Puedes cancelar la renovación</li>
              </ul>
            </div>
          )}

          {subscription?.status === 'pending' && !canAccess && (
            <p className="mb-4 rounded-lg border border-amber-700/50 bg-amber-950/30 p-3 text-sm text-amber-200">
              Hay una suscripción pendiente. Puedes continuar el proceso de pago de forma segura.
            </p>
          )}

          {error && (
            <p role="alert" className="mb-4 rounded-lg border border-red-800 bg-red-950/40 p-3 text-sm text-red-200">
              {error}
            </p>
          )}

          {!canAccess && (
            <button
              type="button"
              onClick={() => void runAction(startCheckout)}
              disabled={busy || !user.email}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-rodez-red px-5 py-3 font-semibold text-white transition hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <CreditCard className="h-5 w-5" />}
              {subscription?.status === 'pending' ? 'Continuar con Mercado Pago' : 'Suscribirme con Mercado Pago'}
            </button>
          )}

          {active && (
            <div className="mt-5 rounded-lg border border-emerald-900/60 bg-emerald-950/20 p-4 text-sm text-emerald-200">
              Próximo cobro: {formatDate(subscription?.nextPaymentAt) ?? 'pendiente de confirmación'}
            </div>
          )}

          {canAccess && !cancelled && (
            confirmCancellation ? (
              <div className="mt-5 rounded-xl border border-gray-700 bg-gray-950 p-4">
                <p className="text-sm text-gray-300">Se detendrán los próximos cobros y conservarás el acceso hasta el final del período pagado.</p>
                <div className="mt-4 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setConfirmCancellation(false)}
                    disabled={busy}
                    className="flex-1 rounded-lg border border-gray-700 px-3 py-2 text-sm text-gray-300 hover:bg-gray-800"
                  >
                    Mantener
                  </button>
                  <button
                    type="button"
                    onClick={() => void runAction(cancel)}
                    disabled={busy}
                    className="flex-1 rounded-lg bg-red-700 px-3 py-2 text-sm font-medium text-white hover:bg-red-600 disabled:opacity-60"
                  >
                    {busy ? 'Procesando...' : 'Confirmar cancelación'}
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmCancellation(true)}
                disabled={busy}
                className="mt-5 w-full rounded-xl border border-gray-700 px-5 py-3 text-sm font-medium text-gray-300 hover:bg-gray-800 disabled:opacity-60"
              >
                Cancelar renovación
              </button>
            )
          )}

          <p className="mt-5 text-center text-xs leading-relaxed text-gray-500">
            No guardamos los datos de tu tarjeta. El pago y los cobros recurrentes se gestionan en Mercado Pago.
          </p>
        </section>
      </div>
    </Wrapper>
  );
};
