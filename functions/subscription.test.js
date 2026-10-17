import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import test from 'node:test';
import {
  getNotificationResource,
  getPayerEmail,
  getPreapprovalNextPaymentDate,
  isMissingMercadoPagoResource,
  isSuccessfulAuthorizedPayment,
  shouldReplacePendingCheckout,
  shouldAcceptVerifiedPaidSubscription,
  verifyMercadoPagoSignature,
} from './subscription.js';

const secret = 'test-webhook-secret';
const requestId = 'request-123';
const dataId = '987654321';
const timestamp = '1729000000';
const signature = createHmac('sha256', secret)
  .update(`id:${dataId};request-id:${requestId};ts:${timestamp};`)
  .digest('hex');

test('accepts a valid Mercado Pago signature', () => {
  assert.equal(verifyMercadoPagoSignature({
    signatureHeader: `ts=${timestamp},v1=${signature}`,
    requestId,
    dataId,
    secret,
  }), true);
});

test('rejects a changed resource ID or malformed signature', () => {
  assert.equal(verifyMercadoPagoSignature({
    signatureHeader: `ts=${timestamp},v1=${signature}`,
    requestId,
    dataId: 'different-id',
    secret,
  }), false);
  assert.equal(verifyMercadoPagoSignature({
    signatureHeader: 'ts=1,v1=invalid',
    requestId,
    dataId,
    secret,
  }), false);
});

test('reads subscription webhooks from query parameters and rejects mismatched IDs', () => {
  assert.deepEqual(getNotificationResource({
    query: { type: 'subscription_preapproval', 'data.id': dataId },
    body: { type: 'subscription_preapproval', data: { id: dataId } },
  }), { type: 'subscription_preapproval', id: dataId });

  assert.equal(getNotificationResource({
    query: { type: 'subscription_preapproval', 'data.id': dataId },
    body: { data: { id: 'another-id' } },
  }), null);
});

test('uses the configured Mercado Pago buyer only in explicit test mode', () => {
  assert.equal(getPayerEmail({
    testMode: true,
    authenticatedEmail: 'google@example.com',
    testPayerEmail: 'buyer@testuser.com',
  }), 'buyer@testuser.com');
  assert.equal(getPayerEmail({
    testMode: false,
    authenticatedEmail: 'customer@example.com',
    testPayerEmail: 'buyer@testuser.com',
  }), 'customer@example.com');
  assert.throws(() => getPayerEmail({
    testMode: true,
    authenticatedEmail: 'google@example.com',
    testPayerEmail: '',
  }));
});

test('replaces a pending checkout when its test buyer email changes', () => {
  assert.equal(shouldReplacePendingCheckout({
    testMode: true,
    payerEmail: 'new-buyer@testuser.com',
    existingPayerEmail: undefined,
  }), true);
  assert.equal(shouldReplacePendingCheckout({
    testMode: true,
    payerEmail: 'buyer@testuser.com',
    existingPayerEmail: 'buyer@testuser.com',
  }), false);
  assert.equal(shouldReplacePendingCheckout({
    testMode: false,
    payerEmail: 'customer@example.com',
    existingPayerEmail: 'previous@example.com',
  }), false);
});

test('recognizes processed authorized payments as successful', () => {
  assert.equal(isSuccessfulAuthorizedPayment('approved'), true);
  assert.equal(isSuccessfulAuthorizedPayment('processed'), true);
  assert.equal(isSuccessfulAuthorizedPayment('pending'), false);
  assert.equal(isSuccessfulAuthorizedPayment('rejected'), false);
});

test('reads the next payment date from Mercado Pago response shapes', () => {
  assert.equal(getPreapprovalNextPaymentDate({
    next_payment_date: '2026-11-15T22:58:23.000-04:00',
  }), '2026-11-15T22:58:23.000-04:00');
  assert.equal(getPreapprovalNextPaymentDate({
    auto_recurring: { next_payment_date: '2026-11-15T22:58:23.000-04:00' },
    next_payment_date: '2026-12-15T22:58:23.000-04:00',
  }), '2026-11-15T22:58:23.000-04:00');
  assert.equal(getPreapprovalNextPaymentDate({}), null);
});

test('recognizes nonexistent Mercado Pago resources without masking server failures', () => {
  assert.equal(isMissingMercadoPagoResource({ status: 404 }), true);
  assert.equal(isMissingMercadoPagoResource({ status: 500 }), false);
  assert.equal(isMissingMercadoPagoResource(new Error('network failure')), false);
});

test('accepts a provider-verified paid subscription that replaced a stale pending checkout', () => {
  assert.equal(shouldAcceptVerifiedPaidSubscription({
    storedSubscriptionId: 'stale-subscription',
    incomingSubscriptionId: 'paid-subscription',
    storedStatus: 'pending',
    providerStatus: 'authorized',
    paymentStatus: 'processed',
    amount: 9900,
    currency: 'COP',
  }), true);
  assert.equal(shouldAcceptVerifiedPaidSubscription({
    storedSubscriptionId: 'stale-subscription',
    incomingSubscriptionId: 'paid-subscription',
    storedStatus: 'pending',
    providerStatus: 'authorized',
    paymentStatus: 'processed',
    amount: 9901,
    currency: 'COP',
  }), false);
  assert.equal(shouldAcceptVerifiedPaidSubscription({
    storedSubscriptionId: 'current-subscription',
    incomingSubscriptionId: 'other-subscription',
    storedStatus: 'active',
    providerStatus: 'authorized',
    paymentStatus: 'processed',
    amount: 9900,
    currency: 'COP',
  }), false);
});
