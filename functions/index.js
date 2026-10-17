import { randomUUID } from 'node:crypto';
import { initializeApp } from 'firebase-admin/app';
import { FieldValue, Timestamp, getFirestore } from 'firebase-admin/firestore';
import { HttpsError, onCall, onRequest } from 'firebase-functions/v2/https';
import { defineSecret, defineString } from 'firebase-functions/params';
import { logger } from 'firebase-functions';
import {
  getNotificationResource,
  getPayerEmail,
  getPreapprovalNextPaymentDate,
  isMissingMercadoPagoResource,
  isSuccessfulAuthorizedPayment,
  shouldReplacePendingCheckout,
  shouldAcceptVerifiedPaidSubscription,
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
const mercadoPagoTestMode = defineString('MERCADOPAGO_TEST_MODE', { default: 'false' });
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
    const log = response.status === 404 ? logger.warn : logger.error;
    log('Mercado Pago API request failed', {
      path,
      status: response.status,
      providerError: responseBody?.message ?? responseBody?.error ?? 'unknown',
    });
    throw Object.assign(new Error(`Mercado Pago returned HTTP ${response.status}`), {
      status: response.status,
    });
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
    const testMode = mercadoPagoTestMode.value().trim().toLowerCase() === 'true';
    let payerEmail;
    try {
      payerEmail = getPayerEmail({
        testMode,
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
    const testPayerEmail = mercadoPagoTestPayerEmail.value().trim();

    logger.info('Preparing Mercado Pago subscription request', {
      testModeEnabled: testMode,
      testPayerConfigured: Boolean(testPayerEmail),
      payerMatchesConfiguredTestBuyer: payerEmail === testPayerEmail,
      payerUsesTestUserDomain: payerEmail.endsWith('@testuser.com'),
    });

    try {
      const result = await db.runTransaction(async (transaction) => {
        const snapshot = await transaction.get(ref);
        const existing = snapshot.data();
        if (existing?.status === 'active' && hasUnexpiredAccess(existing)) {
          throw new HttpsError('already-exists', 'Tu suscripción ya está activa.');
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
          replacingProviderSubscriptionId: existing?.providerSubscriptionId ?? null,
          providerSubscriptionId: FieldValue.delete(),
          initPoint: FieldValue.delete(),
          updatedAt: FieldValue.serverTimestamp(),
        }, { merge: true });

        return {
          reused: false,
          lockId,
          email,
          staleProviderId: existing?.providerSubscriptionId,
        };
      });

      if (result.reused) {
        checkoutUrl = result.initPoint;
      } else {
        const requestLockId = result.lockId;
        if (result.staleProviderId) {
          try {
            const stale = await fetchPreapproval(result.staleProviderId);
            if (stale.status === 'pending' && !(stale.summarized?.charged_quantity > 0)) {
              await mercadoPagoRequest(
                `/preapproval/${encodeURIComponent(result.staleProviderId)}`,
                { method: 'PUT', body: { status: 'cancelled' } }
              );
            }
          } catch {
            // Ignorar errores al limpiar preapproval obsoleto
          }
        }
        const baseUrl = getAppBaseUrl();
        // Firebase Functions v2 (Gen 2) runs on Cloud Run. The .cloudfunctions.net
        // URL is an alias that may not accept inbound POST requests from Mercado Pago.
        // The direct Cloud Run service URI is the reliable endpoint.
        const webhookUrl = `https://mercadopagowebhook-ggjzv7ouxa-rj.a.run.app`;
        logger.info('Registering Mercado Pago webhook URL', { webhookUrl });
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
            payerEmail,
            externalReference: uid,
            amount: SUBSCRIPTION_PRICE_COP,
            currency: 'COP',
            createLockId: FieldValue.delete(),
            createStartedAt: FieldValue.delete(),
            checkoutEmail: FieldValue.delete(),
            replacingProviderSubscriptionId: FieldValue.delete(),
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
          replacingProviderSubscriptionId: FieldValue.delete(),
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
  if (current?.replacingProviderSubscriptionId === preapproval.id) {
    logger.info('Ignoring webhook for replaced Mercado Pago test subscription', {
      uid,
      providerId: preapproval.id,
    });
    return;
  }

  const webhookArrivedBeforeCheckoutWasStored = current?.status === 'creating'
    && typeof current.createLockId === 'string';

  const providerAuthorized = preapproval.status === 'authorized';
  const nextPaymentDate = getPreapprovalNextPaymentDate(preapproval);
  const accessUntilDate = nextPaymentDate ? new Date(nextPaymentDate) : null;
  const validAccessUntil = accessUntilDate && !Number.isNaN(accessUntilDate.getTime())
    ? Timestamp.fromDate(accessUntilDate)
    : null;
  const hasFutureAccess = validAccessUntil && validAccessUntil.toMillis() > Date.now();
  const paymentSucceeded = isSuccessfulAuthorizedPayment(paymentStatus)
    || preapproval.summarized?.semaphore === 'green'
    || (preapproval.summarized?.charged_quantity ?? 0) > 0
    || (providerAuthorized && hasFutureAccess);

  const verifiedPaidSubscriptionCanReplacePendingCheckout = shouldAcceptVerifiedPaidSubscription({
    storedSubscriptionId: current?.providerSubscriptionId,
    incomingSubscriptionId: preapproval.id,
    storedStatus: current?.status,
    providerStatus: preapproval.status,
    paymentStatus: paymentSucceeded ? 'approved' : paymentStatus,
    amount: preapproval.auto_recurring?.transaction_amount,
    currency: preapproval.auto_recurring?.currency_id,
  });

  if ((!webhookArrivedBeforeCheckoutWasStored
      && current?.providerSubscriptionId !== preapproval.id
      && !verifiedPaidSubscriptionCanReplacePendingCheckout)
    || (current?.externalReference && current.externalReference !== uid)) {
    logger.warn('Ignoring Mercado Pago event that does not match the stored subscription', {
      uid,
      providerId: preapproval.id,
    });
    return;
  }

  const currentAccessUntil = hasUnexpiredAccess(current) ? current.accessUntil : null;
  const subscriptionWasCancelledLocally = current?.status === 'cancelled';

  let status = 'pending';
  if (preapproval.status === 'cancelled') {
    status = hasFutureAccess ? 'active' : 'cancelled';
  } else if (preapproval.status === 'paused') {
    status = 'paused';
  } else if (subscriptionWasCancelledLocally) {
    status = hasFutureAccess ? 'active' : 'cancelled';
  } else if (providerAuthorized && (paymentSucceeded || currentAccessUntil || hasFutureAccess)) {
    status = 'active';
  } else if (paymentStatus && !paymentSucceeded) {
    status = 'past_due';
  }

  const renewedAccessUntil = (paymentSucceeded || hasFutureAccess) ? validAccessUntil : currentAccessUntil;
  if (verifiedPaidSubscriptionCanReplacePendingCheckout
    && current?.providerSubscriptionId
    && current.providerSubscriptionId !== preapproval.id) {
    const staleSubscription = await fetchPreapproval(current.providerSubscriptionId);
    if (staleSubscription.status !== 'cancelled') {
      await mercadoPagoRequest(
        `/preapproval/${encodeURIComponent(current.providerSubscriptionId)}`,
        { method: 'PUT', body: { status: 'cancelled' } }
      );
      logger.info('Cancelled stale Mercado Pago subscription after verified payment', {
        uid,
        paidProviderId: preapproval.id,
      });
    }
  }

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
    nextPaymentAt: (paymentSucceeded || hasFutureAccess) ? (validAccessUntil ?? FieldValue.delete()) : FieldValue.delete(),
    lastPaymentStatus: paymentStatus ?? (paymentSucceeded ? 'approved' : current?.lastPaymentStatus ?? null),
    initPoint: status === 'pending' && typeof preapproval.init_point === 'string'
      ? preapproval.init_point
      : FieldValue.delete(),
    createLockId: FieldValue.delete(),
    createStartedAt: FieldValue.delete(),
    checkoutEmail: FieldValue.delete(),
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });

  logger.info('Reconciled Mercado Pago subscription', { uid, providerId: preapproval.id, status });
}

export const syncMercadoPagoSubscription = onCall(
  { region, secrets: [mercadoPagoAccessToken] },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Inicia sesión para continuar.');
    }
    const uid = request.auth.uid;
    const ref = subscriptionRef(uid);
    const snap = await ref.get();
    const data = snap.data();
    let preapproval = null;

    if (data?.providerSubscriptionId) {
      try {
        preapproval = await fetchPreapproval(data.providerSubscriptionId);
      } catch (err) {
        logger.warn('Failed to fetch stored providerSubscriptionId', { err });
      }
    }

    if (!preapproval || preapproval.status !== 'authorized') {
      const searchRes = await mercadoPagoRequest(
        `/preapproval/search?external_reference=${encodeURIComponent(uid)}&status=authorized`
      );
      if (searchRes?.results?.length > 0) {
        preapproval = searchRes.results[0];
      }
    }

    if (!preapproval) {
      return { status: data?.status ?? 'inactive', synced: false };
    }

    await reconcilePreapproval(preapproval, 'approved');
    const updatedSnap = await ref.get();
    return { status: updatedSnap.data()?.status ?? 'active', synced: true };
  }
);

export const syncSubscriptionManual = onRequest(
  { region, secrets: [mercadoPagoAccessToken] },
  async (request, response) => {
    try {
      const searchRes = await mercadoPagoRequest('/preapproval/search?sort=date_created:desc&limit=50');
      const results = searchRes?.results ?? [];
      const updated = [];
      const processedUids = new Set();

      for (const preapproval of results) {
        const uid = preapproval.external_reference;
        if (!uid || typeof uid !== 'string' || processedUids.has(uid)) {
          continue;
        }

        const isPaid = (preapproval.summarized?.charged_quantity ?? 0) > 0
          || preapproval.summarized?.semaphore === 'green';
        const isAuthorized = preapproval.status === 'authorized';

        if (isPaid || isAuthorized) {
          await reconcilePreapproval(preapproval, isPaid ? 'approved' : null);
          updated.push({
            uid,
            id: preapproval.id,
            status: 'active',
            nextPayment: preapproval.next_payment_date,
            charged: preapproval.summarized?.charged_amount ?? 9900,
          });
          processedUids.add(uid);
        }
      }
      response.json({ success: true, updatedCount: updated.length, updated });
    } catch (error) {
      logger.error('syncSubscriptionManual failed', error);
      response.status(500).json({ success: false, error: error.message });
    }
  }
);

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
      if (isMissingMercadoPagoResource(error)) {
        logger.warn('Acknowledging Mercado Pago webhook for a missing provider resource', {
          type: notification.type,
          resourceId: notification.id,
        });
        response.status(200).send('Resource not found');
        return;
      }

      logger.error('Mercado Pago webhook processing failed', { type: notification.type, error });
      response.status(500).send('Webhook processing failed');
    }
  }
);
