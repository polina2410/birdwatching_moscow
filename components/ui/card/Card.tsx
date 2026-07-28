import styles from './Card.module.css';

type CardProps = {
  as?: 'div' | 'article' | 'li';
  className?: string;
  children: React.ReactNode;
};

export const Card = ({ as: Tag = 'div', className, children }: CardProps) => (
  <Tag className={[styles.card, className].filter(Boolean).join(' ')}>
    {children}
  </Tag>
);
