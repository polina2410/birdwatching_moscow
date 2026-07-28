import styles from './FormField.module.css';

type FormFieldProps = {
  label: string;
  id: string;
  error?: string;
  required?: boolean;
  children: React.ReactNode;
};

export const FormField = ({ label, id, error, required, children }: FormFieldProps) => (
  <div className={styles.field}>
    <label htmlFor={id} className={styles.label}>
      {label}
      {required && <span className={styles.required} aria-hidden="true">*</span>}
    </label>
    {children}
    {error && <span role="alert" className={styles.error}>{error}</span>}
  </div>
);
