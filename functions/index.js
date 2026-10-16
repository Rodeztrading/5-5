import { randomUUID } from 'node:crypto';
import { initializeApp } from 'firebase-admin/app';
import { FieldValue, Timestamp, getFirestore } from 'firebase-admin/firestore';
import { HttpsError, onCall, onRequest } from 'firebase-functions/v2/https';
import { defineSecret, defineString } from 'firebase-functions/params';
import { logger } from 'firebase-functions';
import {
  getNotificationResource,
  getPayerEmail,
  SUBSCRIPTION_DOCUMENT_ID,
  SUBSCRIPTION_PRICE_COP,
  verifyMercadoPagoSignature,
} from './subscription.js';

initializeApp();

const db = getFirestore();
const region = 'southamerica-east1';
const mercadoPagoAccessToken = defineSecret('MERCADOPAGO_ACCESS_TOKEN');
const mercadoPagoWebhookSecret = defineSecret('MERCADOPAGO_WEBHOOK_SECRET');
const appBaseUrl = defineString('APP_BASE_URL');
const mercadoPagoTestPayerEmail = defineString('MERCADOPAGO_TEST_PAYER_EMAIL', { default: '' });

function subscriptionRef(uid) {
  return db.doc(`users/${uid}/subscriptions/${SUBSCRIPTION_DOCUMENT_ID}`);
}

function getAppBaseUrl() {
  let url;
  try {
    url = new URL(appBaseUrl.value());
  } catch {
    throw new HttpsError('failed-precondition', 'La URL de la aplicación no está configurada.');
  }

  if (url.protocol !== 'https:' && url.hostname !== 'localhost' && url.hostname !== '127.0.0.1') {
    throw new HttpsError('failed-precondition', 'La URL pública debe usar HTTPS.');
  }

  return url.origin;
}

async function mercadoPagoRequest(path, { method = 'GET', body, idempotencyKey } = {}) {
  const response = await fetch(`https://api.mercadopago.com${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${mercadoPagoAccessToken.value()}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(idempotencyKey ? { 'X-Idempotency-Key': idempotencyKey } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  const responseBody = await response.json().catch(() => null);
  if (!response.ok) {
    logger.error('Mercado Pago API request failed', {
      path,
      status: response.status,
      providerError: responseBody?.message ?? responseBody?.error ?? 'unknown',
    });
    throw new Error(`Mercado Pago returned HTTP ${response.status}`);
  }

  return responseBody;
}

function hasUnexpiredAccess(subscription) {
  const accessUntil = subscription?.accessUntil;
  return accessUntil instanceof Timestamp && accessUntil.toMillis() > Date.now();
}

export const createMercadoPagoSubscription = onCall(
  { region, secrets: [mercadoPagoAccessToken] },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Inicia sesión para continuar.');
    }

    const email = request.auth.token.email;
    if (typeof email !== 'string' || !email.includes('@')) {
      throw new HttpsError('failed-precondition', 'Tu cuenta necesita un correo electrónico válido.');
    }

    const accessToken = mercadoPagoAccessToken.value();
    let payerEmail;
    try {
      payerEmail = getPayerEmail({
        accessToken,
        authenticatedEmail: email,
        testPayerEmail: mercadoPagoTestPayerEmail.value(),
      });
    } catch {
      throw new HttpsError(
        'failed-precondition',
        'Falta configurar el correo de un comprador de prueba de Mercado Pago para continuar.'
      );
    }
    const uid = request.auth.uid;
    const ref = subscriptionRef(uid);
    const lockId = randomUUID();
    let activeLockId = lockId;
    let checkoutUrl;
    let createdSubscription = false;

    try {
      const result = await db.runTransaction(async (transaction) => {
        const snapshot = await transaction.get(ref);
        const existing = snapshot.data();
        if (existing?.status === 'active' && hasUnexpiredAccess(existing)) {
          throw new HttpsError('already-exists', 'Tu suscripción ya está activa.');
        }

        if (existing?.status === 'pending' && existing.initPoint) {
          return { initPoint: existing.initPoint, reused: true };
        }

        if (existing?.status === 'creating' && typeof existing.createLockId === 'string') {
          return {
            reused: false,
            lockId: existing.createLockId,
            email: existing.checkoutEmail ?? email,
          };
        }

        if (existing?.status === 'cancelled' && hasUnexpiredAccess(existing)) {
          throw new HttpsError('failed-precondition', 'Tu acceso actual sigue activo hasta finalizar el período pagado.');
        }

        transaction.set(ref, {
          provider: 'mercadopago',
          status: 'creating',
          createLockId: lockId,
          createStartedAt: Timestamp.now(),
          checkoutEmail: email,
          updatedAt: FieldValue.serverTimestamp(),
        }, { merge: true });

        return { reused: false, lockId, email };
      });

      if (result.reused) {
        checkoutUrl = result.initPoint;
      } else {
        const requestLockId = result.lockId;
        activeLockId = requestLockId;
        const baseUrl = getAppBaseUrl();
        const projectId = process.env.GCLOUD_PROJECT;
        const webhookUrl = `https://${region}-${projectId}.cloudfunctions.net/mercadoPagoWebhook`;
        const preapproval = await mercadoPagoRequest('/preapproval', {
          method: 'POST',
          idempotencyKey: requestLockId,
          body: {
            reason: 'Suscripción mensual 5-5 Finanzas',
            payer_email: payerEmail,
            back_url: `${baseUrl}/?subscription=return`,
            notification_url: webhookUrl,
            external_reference: uid,
            auto_recurring: {
              frequency: 1,
              frequency_type: 'months',
              transaction_amount: SUBSCRIPTION_PRICE_COP,
              currency_id: 'COP',
            },
          },
        });

        if (typeof preapproval?.init_point !== 'string' || typeof preapproval?.id !== 'string') {
          throw new Error('Mercado Pago returned an invalid subscription response');
        }

        await db.runTransaction(async (transaction) => {
          const snapshot = await transaction.get(ref);
          const current = snapshot.data();
          if (current?.createLockId !== requestLockId
            && current?.providerSubscriptionId === preapproval.id
            && current?.status === 'active') {
            return;
          }

          transaction.set(ref, {
            provider: 'mercadopago',
            providerSubscriptionId: preapproval.id,
            status: 'pending',
            initPoint: preapproval.init_point,
            externalReference: uid,
            amount: SUBSCRIPTION_PRICE_COP,
            currency: 'COP',
            createLockId: FieldValue.delete(),
            createStartedAt: FieldValue.delete(),
            checkoutEmail: FieldValue.delete(),
            updatedAt: FieldValue.serverTimestamp(),
          }, { merge: true });
        });

        checkoutUrl = preapproval.init_point;
        createdSubscription = true;
      }
    } catch (error) {
      if (error instanceof HttpsError) {
        throw error;
      }

      const snapshot = await ref.get();
      if (snapshot.data()?.createLockId === activeLockId) {
        await ref.set({
          status: 'inactive',
          createLockId: FieldValue.delete(),
          createStartedAt: FieldValue.delete(),
          checkoutEmail: FieldValue.delete(),
          updatedAt: FieldValue.serverTimestamp(),
        }, { merge: true });
      }

      logger.error('Could not create Mercado Pago subscription', { uid, error });
      throw new HttpsError('internal', 'No pudimos iniciar el pago. Inténtalo de nuevo.');
    }

    return { checkoutUrl, created: createdSubscription };
  }
);

export const cancelMercadoPagoSubscription = onCall(
  { region, secrets: [mercadoPagoAccessToken] },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Inicia sesión para continuar.');
    }

    const ref = subscriptionRef(request.auth.uid);
    const snapshot = await ref.get();
    const subscription = snapshot.data();
    const providerId = subscription?.providerSubscriptionId;

    if (!providerId || subscription?.externalReference !== request.auth.uid) {
      throw new HttpsError('failed-precondition', 'No encontramos una suscripción cancelable.');
    }

    try {
      await mercadoPagoRequest(`/preapproval/${encodeURIComponent(providerId)}`, {
        method: 'PUT',
        body: { status: 'cancelled' },
      });

      await ref.set({
        status: 'cancelled',
        initPoint: FieldValue.delete(),
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
    } catch (error) {
      logger.error('Could not cancel Mercado Pago subscription', {
        uid: request.auth.uid,
        providerId,
        error,
      });
      throw new HttpsError('internal', 'No pudimos cancelar la suscripción. Inténtalo de nuevo.');
    }

    return { cancelled: true };
  }
);

async function fetchPreapproval(id) {
  return mercadoPagoRequest(`/preapproval/${encodeURIComponent(id)}`);
}

async function fetchAuthorizedPayment(id) {
  return mercadoPagoRequest(`/authorized_payments/${encodeURIComponent(id)}`);
}

async function reconcilePreapproval(preapproval, paymentStatus) {
  const uid = preapproval?.external_reference;
  if (typeof uid !== 'string' || !uid || typeof preapproval?.id !== 'string') {
    logger.warn('Ignoring Mercado Pago event without a valid external reference');
    return;
  }

  const ref = subscriptionRef(uid);
  const currentSnapshot = await ref.get();
  const current = currentSnapshot.data();
  const webhookArrivedBeforeCheckoutWasStored = current?.status === 'creating'
    && typeof current.createLockId === 'string';
  if ((!webhookArrivedBeforeCheckoutWasStored && current?.providerSubscriptionId !== preapproval.id)
    || (current?.externalReference && current.externalReference !== uid)) {
    logger.warn('Ignoring Mercado Pago event that does not match the stored subscription', {
      uid,
      providerId: preapproval.id,
    });
    return;
  }

  const providerAuthorized = preapproval.status === 'authorized';
  const paymentApproved = paymentStatus === 'approved';
  const accessUntilDate = preapproval.auto_recurring?.next_payment_date
    ? new Date(preapproval.auto_recurring.next_payment_date)
    : null;
  const validAccessUntil = accessUntilDate && !Number.isNaN(accessUntilDate.getTime())
    ? Timestamp.fromDate(accessUntilDate)
    : null;
  const currentAccessUntil = hasUnexpiredAccess(current) ? current.accessUntil : null;
  const subscriptionWasCancelledLocally = current?.status === 'cancelled';

  let status = 'pending';
  if (preapproval.status === 'cancelled') {
    status = 'cancelled';
  } else if (preapproval.status === 'paused') {
    status = 'paused';
  } else if (subscriptionWasCancelledLocally) {
    status = 'cancelled';
  } else if (providerAuthorized && (paymentApproved || currentAccessUntil)) {
    status = 'active';
  } else if (paymentStatus && paymentStatus !== 'approved') {
    status = 'past_due';
  }

  const renewedAccessUntil = paymentApproved ? validAccessUntil : currentAccessUntil;
  await ref.set({
    provider: 'mercadopago',
    providerSubscriptionId: preapproval.id,
    externalReference: uid,
    providerStatus: preapproval.status ?? 'unknown',
    status,
    amount: preapproval.auto_recurring?.transaction_amount ?? SUBSCRIPTION_PRICE_COP,
    currency: preapproval.auto_recurring?.currency_id ?? 'COP',
    accessUntil: status === 'active'
      ? (renewedAccessUntil ?? FieldValue.delete())
      : (currentAccessUntil ?? FieldValue.delete()),
    nextPaymentAt: paymentApproved ? (validAccessUntil ?? FieldValue.delete()) : FieldValue.delete(),
    lastPaymentStatus: paymentStatus ?? current?.lastPaymentStatus ?? null,
    initPoint: status === 'pending' && typeof preapproval.init_point === 'string'
      ? preapproval.init_point
      : FieldValue.delete(),
    createLockId: FieldValue.delete(),
    createStartedAt: FieldValue.delete(),
    checkoutEmail: FieldValue.delete(),
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });
}

export const mercadoPagoWebhook = onRequest(
  { region, secrets: [mercadoPagoAccessToken, mercadoPagoWebhookSecret] },
  async (request, response) => {
    if (request.method !== 'POST') {
      response.status(405).send('Method not allowed');
      return;
    }

    const notification = getNotificationResource(request);
    if (!notification) {
      response.status(400).send('Invalid notification');
      return;
    }

    const signatureValid = verifyMercadoPagoSignature({
      signatureHeader: request.get('x-signature'),
      requestId: request.get('x-request-id'),
      dataId: notification.id,
      secret: mercadoPagoWebhookSecret.value(),
    });
    if (!signatureValid) {
      logger.warn('Rejected Mercado Pago webhook with invalid signature');
      response.status(401).send('Invalid signature');
      return;
    }

    try {
      if (notification.type === 'subscription_preapproval') {
        await reconcilePreapproval(await fetchPreapproval(notification.id));
      } else if (notification.type === 'subscription_authorized_payment') {
        const payment = await fetchAuthorizedPayment(notification.id);
        if (typeof payment?.preapproval_id === 'string') {
          const preapproval = await fetchPreapproval(payment.preapproval_id);
          await reconcilePreapproval(preapproval, payment.status);
        } else {
          logger.warn('Ignoring authorized payment without a subscription ID', {
            paymentId: notification.id,
          });
        }
      }

      response.status(200).send('OK');
    } catch (error) {
      logger.error('Mercado Pago webhook processing failed', { type: notification.type, error });
      response.status(500).send('Webhook processing failed');
    }
  }
);
