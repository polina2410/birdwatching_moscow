'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/buttons/Button';
import { CHECKOUT_LABELS } from '@/lib/checkout-labels';
import type { YooKassaNotificationEvent } from '@/lib/payments/yookassa/types';
import { HTTP_METHOD, JSON_HEADERS } from '@/lib/constants';
import styles from './DevYooKassaStub.module.css';

const L = CHECKOUT_LABELS.devStub;

type DevYooKassaStubProps = {
  paymentId: string;
};

export const DevYooKassaStub = ({ paymentId }: DevYooKassaStubProps) => {
  const searchParams = useSearchParams();
  const orderId = searchParams.get('orderId') ?? '';
  const amount = searchParams.get('amount') ?? '0.00';

  const [pending, setPending] = useState<YooKassaNotificationEvent | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function sendNotification(event: YooKassaNotificationEvent) {
    setPending(event);
    setMessage(null);
    try {
      const res = await fetch('/api/payments/yookassa/webhook', {
        method: HTTP_METHOD.POST,
        headers: JSON_HEADERS,
        body: JSON.stringify({
          type: 'notification',
          event,
          object: {
            id: paymentId,
            status: event === 'payment.succeeded' ? 'succeeded' : 'canceled',
            amount: { value: amount, currency: 'RUB' },
            metadata: { orderId },
          },
        }),
      });
      setMessage(res.ok ? L.result : L.error);
    } catch {
      setMessage(L.error);
    } finally {
      setPending(null);
    }
  }

  return (
    <main className={styles.wrapper}>
      <h1>{L.title}</h1>
      <p>{L.description}</p>
      <div className={styles.actions}>
        <Button
          onClick={() => sendNotification('payment.succeeded')}
          loading={pending === 'payment.succeeded'}
          disabled={pending !== null}
        >
          {L.pay}
        </Button>
        <Button
          variant="secondary"
          onClick={() => sendNotification('payment.canceled')}
          loading={pending === 'payment.canceled'}
          disabled={pending !== null}
        >
          {L.cancel}
        </Button>
      </div>
      {message && <p role="status">{message}</p>}
    </main>
  );
};
