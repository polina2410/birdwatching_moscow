import styles from './Spinner.module.css';

interface SpinnerProps {
  label?: string;
}

export const Spinner = ({ label }: SpinnerProps) => (
  <div className={styles.wrapper} role="status" aria-label={label}>
    <div className={styles.ring} />
  </div>
);
