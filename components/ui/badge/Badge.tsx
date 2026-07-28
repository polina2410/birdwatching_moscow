import styles from './Badge.module.css';

type BadgeProps = {
  variant: 'warning' | 'success';
  children: string;
};

export const Badge = ({ variant, children }: BadgeProps) => (
  <span className={[styles.badge, styles[variant]].join(' ')}>
    {children}
  </span>
);
