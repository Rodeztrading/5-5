import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import test from 'node:test';
import { getNotificationResource, verifyMercadoPagoSignature } from './subscription.js';

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
