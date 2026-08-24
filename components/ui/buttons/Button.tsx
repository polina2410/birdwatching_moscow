'use client';

import Link from 'next/link';
import styles from './Button.module.css';

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';
type ButtonSize = 'sm' | 'md' | 'lg';

type BaseProps = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  disabled?: boolean;
  className?: string;
  children: React.ReactNode;
};

type AsButton = BaseProps & { as?: 'button' } & React.ButtonHTMLAttributes<HTMLButtonElement>;
type AsLink   = BaseProps & { as: 'a'; href: string } & React.AnchorHTMLAttributes<HTMLAnchorElement>;

type ButtonProps = AsButton | AsLink;

export const Button = ({ variant = 'primary', size = 'md', loading = false, disabled, className, children, ...rest }: ButtonProps) => {
  const cls = [styles.button, styles[variant], styles[size], className].filter(Boolean).join(' ');
  const isDisabled = disabled || loading;

  if (rest.as === 'a') {
    const { as: _as, href, ...linkRest } = rest as AsLink;
    return (
      <Link href={href} className={cls} aria-disabled={isDisabled} {...linkRest}>
        {children}
      </Link>
    );
  }

  const { as: _as, ...btnRest } = rest as AsButton;
  return (
    <button className={cls} disabled={isDisabled} {...btnRest}>
      {children}
    </button>
  );
};
