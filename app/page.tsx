import { auth } from '@/lib/auth';
import { Main } from '@/components/Main';

export default async function Home() {
  const session = await auth();
  const role = session?.user?.role;
  const isAdmin = role === 'ADMIN' || role === 'SUPERADMIN';

  return (
    <>
      {isAdmin && <a href="/admin/">Админка</a>}
      <Main />
    </>
  );
}
