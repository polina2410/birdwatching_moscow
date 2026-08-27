import styles from './layout.module.css'

export const dynamic = 'force-dynamic'

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <div className={styles.container}>{children}</div>
}
