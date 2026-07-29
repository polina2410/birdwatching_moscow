import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { DevYooKassaStub } from '@/components/checkout/DevYooKassaStub';

type DevYooKassaStubPageProps = {
  params: Promise<{ paymentId: string }>;
};

export default async function DevYooKassaStubPage({ params }: DevYooKassaStubPageProps) {
  if (process.env.YOOKASSA_MODE !== 'stub') {
    notFound();
  }

  const { paymentId } = await params;

  return (
    <Suspense>
      <DevYooKassaStub paymentId={paymentId} />
    </Suspense>
  );
}
