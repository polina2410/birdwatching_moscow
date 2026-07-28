import styles from './Alert.module.css';

type AlertProps = {
  variant: 'error' | 'success' | 'info';
  children: React.ReactNode;
};

export const Alert = ({ variant, children }: AlertProps) => (
  <div role="alert" className={[styles.alert, styles[variant]].join(' ')}>
    {children}
  </div>
);
