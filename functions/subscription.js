import { createHmac, timingSafeEqual } from 'node:crypto';

export const SUBSCRIPTION_PRICE_COP = 9900;
export const SUBSCRIPTION_DOCUMENT_ID = 'mercadopago';

export function getPayerEmail({ testMode, authenticatedEmail, testPayerEmail }) {
  if (testMode) {
    const email = testPayerEmail?.trim();
    if (!email || !email.includes('@')) {
      throw new Error('A valid Mercado Pago test buyer email is required.');
    }
    return email;
  }

  return authenticatedEmail;
}

export function shouldReplacePendingCheckout({ testMode, payerEmail, existingPayerEmail }) {
  return testMode && existingPayerEmail !== payerEmail;
}

export function isSuccessfulAuthorizedPayment(status) {
  return status === 'approved' || status === 'processed';
}

export function getPreapprovalNextPaymentDate(preapproval) {
  return preapproval?.auto_recurring?.next_payment_date
    ?? preapproval?.next_payment_date
    ?? null;
}

export function isMissingMercadoPagoResource(error) {
  return error?.status === 404;
}

export function shouldAcceptVerifiedPaidSubscription({
  storedSubscriptionId,
  incomingSubscriptionId,
  storedStatus,
  providerStatus,
  paymentStatus,
  amount,
  currency,
}) {
  if (storedSubscriptionId === incomingSubscriptionId) {
    return true;
  }

  return storedStatus !== 'active'
    && providerStatus === 'authorized'
    && isSuccessfulAuthorizedPayment(paymentStatus)
    && amount === SUBSCRIPTION_PRICE_COP
    && currency === 'COP';
}

export function verifyMercadoPagoSignature({ signatureHeader, requestId, dataId, secret }) {
  if (!signatureHeader || !requestId || !dataId || !secret) {
    return false;
  }

  const signatureParts = Object.fromEntries(
    signatureHeader.split(',').map((part) => {
      const separator = part.indexOf('=');
      return separator < 0
        ? [part.trim(), '']
        : [part.slice(0, separator).trim(), part.slice(separator + 1).trim()];
    })
  );

  const timestamp = signatureParts.ts;
  const receivedSignature = signatureParts.v1;
  if (!timestamp || !receivedSignature || !/^[a-f0-9]{64}$/i.test(receivedSignature)) {
    return false;
  }

  const manifest = `id:${dataId.toLowerCase()};request-id:${requestId};ts:${timestamp};`;
  const expectedSignature = createHmac('sha256', secret).update(manifest).digest();
  const receivedBuffer = Buffer.from(receivedSignature, 'hex');

  return receivedBuffer.length === expectedSignature.length
    && timingSafeEqual(receivedBuffer, expectedSignature);
}

export function getNotificationResource(request) {
  const queryId = request.query?.['data.id'] ?? request.query?.id;
  const bodyId = request.body?.data?.id ?? request.body?.id;
  if (queryId != null && bodyId != null && String(queryId) !== String(bodyId)) {
    return null;
  }

  const type = String(
    request.query?.type
      ?? request.body?.type
      ?? request.query?.topic
      ?? request.body?.topic
      ?? ''
  );
  const id = queryId ?? bodyId;

  return type && id != null ? { type, id: String(id) } : null;
}
