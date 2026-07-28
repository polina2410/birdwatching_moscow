import styles from './Spinner.module.css';

type SpinnerProps = {
  size?: 'sm' | 'md';
  label?: string;
};

export const Spinner = ({ size = 'md', label = 'Загрузка…' }: SpinnerProps) => (
  <span role="status" aria-label={label} className={[styles.spinner, styles[size]].join(' ')} />
);
