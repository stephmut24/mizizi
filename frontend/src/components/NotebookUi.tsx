import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useNotebook } from '../api/notebook';
import { Icon, type IconName } from './Icon';

export function PageHeading({
  eyebrow,
  title,
  children,
  aside,
}: {
  eyebrow: string;
  title: string;
  children?: ReactNode;
  aside?: ReactNode;
}) {
  return (
    <header className="page-heading">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        {children && <p className="page-intro">{children}</p>}
      </div>
      {aside}
    </header>
  );
}

export function DataGate({ children }: { children: ReactNode }) {
  const { status, error, reload } = useNotebook();
  if (status === 'loading')
    return (
      <div className="empty-state" role="status">
        <Icon name="book" size={36} />
        <h2>Opening your notebook…</h2>
        <p>Your records are being read from the local computer.</p>
      </div>
    );
  if (status === 'error')
    return (
      <div className="empty-state" role="alert">
        <Icon name="info" size={36} />
        <h2>Let’s reconnect your notebook</h2>
        <p>{error}</p>
        <button className="button" onClick={reload}>
          Try again
        </button>
      </div>
    );
  return children;
}

export function EmptyState({
  title,
  children,
  to,
  action,
  icon = 'leaf',
}: {
  title: string;
  children: ReactNode;
  to?: string;
  action?: string;
  icon?: IconName;
}) {
  return (
    <section className="empty-state panel">
      <span className="round-motif">
        <Icon name={icon} size={36} />
      </span>
      <h2>{title}</h2>
      <p>{children}</p>
      {to && (
        <Link className="button" to={to}>
          <Icon name="plus" />
          {action}
        </Link>
      )}
    </section>
  );
}

export function SafetyNotice({ name }: { name: string }) {
  return (
    <p className="safety-notice">
      <Icon name="book" size={16} />
      <span>Traditional knowledge shared by {name}. Not medical advice.</span>
    </p>
  );
}

export function VisibilityBadge({
  visibility,
}: {
  visibility: 'private' | 'shareable';
}) {
  return (
    <span
      className={`badge ${visibility === 'private' ? 'badge-private' : 'badge-green'}`}
    >
      <Icon name={visibility === 'private' ? 'lock' : 'leaf'} size={14} />
      {visibility === 'private' ? 'Private' : 'Shareable'}
    </span>
  );
}

export function SpecimenPlaceholder({
  folio,
  large = false,
}: {
  folio?: number;
  large?: boolean;
}) {
  return (
    <div
      className={`specimen-placeholder ${large ? 'specimen-large' : ''}`}
      role="img"
      aria-label="Plant photo placeholder. No photo recorded."
    >
      {folio !== undefined && (
        <span className="folio">Folio {String(folio).padStart(2, '0')}</span>
      )}
      <svg
        className="specimen-drawing"
        viewBox="0 0 180 180"
        fill="none"
        aria-hidden="true"
      >
        <g
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M82 156c7-32 11-69 8-122M89 91C67 94 46 73 41 54c26 1 48 16 48 37Zm2-18c23 1 41-18 47-37-27 2-44 16-47 37ZM85 120c-22 1-39-13-44-29 23-2 41 12 44 29Zm3-12c22 3 38-10 46-26-23-3-44 9-46 26ZM90 47c-15-7-18-21-14-35 16 9 20 20 14 35Z" />
          <path d="m43 56 46 35m48-53-46 35m-49 19 43 28m48-36-45 24M82 156l-9 9m10-10 3 11" />
        </g>
      </svg>
      <span className="placeholder-caption">A place for your plant photo</span>
    </div>
  );
}

export function Field({
  id,
  label,
  hint,
  error,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {children}
      {hint && (
        <p className="field-hint" id={`${id}-hint`}>
          {hint}
        </p>
      )}
      {error && (
        <p className="field-error" id={`${id}-error`}>
          {error}
        </p>
      )}
    </div>
  );
}

export function FormError({ message }: { message: string }) {
  return message ? (
    <p className="error-banner" role="alert">
      <Icon name="info" />
      <span>{message}</span>
    </p>
  ) : null;
}
