'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { CheckoutReturnStatus } from '@/components/checkout/CheckoutReturnStatus';

function CheckoutReturnContent() {
  const searchParams = useSearchParams();
  const orderId = searchParams.get('orderId');

  return <CheckoutReturnStatus orderId={orderId} />;
}

export default function CheckoutReturnPage() {
  return (
    <Suspense>
      <CheckoutReturnContent />
    </Suspense>
  );
}
