'use client';

import Link from 'next/link';
import { useOrderStatus } from '@/hooks/useOrderStatus';
import { Spinner } from '@/components/ui/spinner/Spinner';
import { CHECKOUT_LABELS } from '@/lib/checkout-labels';
import styles from './CheckoutReturnStatus.module.css';

const L = CHECKOUT_LABELS.return;

type CheckoutReturnStatusProps = {
  orderId: string | null;
};

export const CheckoutReturnStatus = ({ orderId }: CheckoutReturnStatusProps) => {
  const { status, error } = useOrderStatus(orderId);

  if (!orderId) {
    return (
      <main className={styles.wrapper}>
        <p role="alert">{L.missingOrder}</p>
        <Link href="/">{L.backHome}</Link>
      </main>
    );
  }

  const isFailed = status === 'FAILED' || status === 'EXPIRED';
  const isPaid = status === 'PAID';
  const isProcessing = !isFailed && !isPaid;

  return (
    <main className={styles.wrapper}>
      <p aria-live="polite" className={[styles.message, isPaid && styles.success, isFailed && styles.failed].filter(Boolean).join(' ')}>
        {error && !status
          ? L.networkError
          : isPaid
            ? L.success
            : isFailed
              ? L.failed
              : L.processing}
      </p>
      {isProcessing && !error && <Spinner label={L.processing} />}
      {(isPaid || isFailed) && <Link href="/">{L.backHome}</Link>}
    </main>
  );
};
