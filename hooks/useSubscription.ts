import { useEffect, useState } from 'react';
import { onSnapshot, Timestamp, doc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { app, db, functions } from '../config/firebase';

export interface Subscription {
  status: 'creating' | 'pending' | 'active' | 'cancelled' | 'paused' | 'past_due' | 'inactive';
  accessUntil?: Timestamp;
  nextPaymentAt?: Timestamp;
  amount?: number;
  currency?: string;
}

interface SubscriptionCheckoutResponse {
  checkoutUrl: string;
  created: boolean;
}

export function useSubscription(uid: string) {
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);

    if (!uid) {
      setSubscription(null);
      setLoading(false);
      return;
    }

    return onSnapshot(
      doc(db, `users/${uid}/subscriptions/mercadopago`),
      (snapshot) => {
        setSubscription(snapshot.exists() ? snapshot.data() as Subscription : null);
        setLoading(false);
      },
      (snapshotError) => {
        console.error('Unable to read subscription status:', snapshotError);
        setError('No pudimos comprobar el estado de tu suscripción.');
        setLoading(false);
      }
    );
  }, [uid]);

  const startCheckout = async () => {
    setError(null);
    const createCheckout = httpsCallable<Record<string, never>, SubscriptionCheckoutResponse>(
      functions,
      'createMercadoPagoSubscription'
    );
    const result = await createCheckout({});
    if (!result.data.checkoutUrl.startsWith('https://')) {
      throw new Error('Mercado Pago devolvió un enlace de pago no válido.');
    }
    window.location.assign(result.data.checkoutUrl);
  };

  const cancel = async () => {
    setError(null);
    const cancelSubscription = httpsCallable<Record<string, never>, { cancelled: boolean }>(
      functions,
      'cancelMercadoPagoSubscription'
    );
    await cancelSubscription({});
  };

  return { subscription, loading, error, setError, startCheckout, cancel };
}
