'use client';

import { type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes, useId } from 'react';

type Shared = {
  label: string;
  hint?: string;
  error?: string | null;
  optional?: boolean;
  className?: string;
};

function Wrapper({
  id,
  label,
  hint,
  error,
  optional,
  className,
  children,
}: Shared & { id: string; children: ReactNode }) {
  return (
    <div className={`z-field ${className ?? ''}`}>
      <label className="z-label" htmlFor={id}>
        {label}
        {optional ? <span className="z-label__optional"> · optionnel</span> : null}
      </label>
      {children}
      {hint && !error ? (
        <span className="z-help" id={`${id}-hint`}>
          {hint}
        </span>
      ) : null}
      {error ? (
        <span className="z-error" id={`${id}-error`} role="alert">
          {error}
        </span>
      ) : null}
    </div>
  );
}

export function Input({
  label,
  hint,
  error,
  optional,
  className,
  ...rest
}: Shared & InputHTMLAttributes<HTMLInputElement>) {
  const generated = useId();
  const id = rest.id ?? generated;
  return (
    <Wrapper id={id} label={label} hint={hint} error={error} optional={optional} className={className}>
      <input
        {...rest}
        id={id}
        className="z-input"
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
      />
    </Wrapper>
  );
}

export function Textarea({
  label,
  hint,
  error,
  optional,
  className,
  ...rest
}: Shared & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const generated = useId();
  const id = rest.id ?? generated;
  return (
    <Wrapper id={id} label={label} hint={hint} error={error} optional={optional} className={className}>
      <textarea
        {...rest}
        id={id}
        className="z-textarea"
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
      />
    </Wrapper>
  );
}

export function Select({
  label,
  hint,
  error,
  optional,
  className,
  children,
  ...rest
}: Shared & SelectHTMLAttributes<HTMLSelectElement>) {
  const generated = useId();
  const id = rest.id ?? generated;
  return (
    <Wrapper id={id} label={label} hint={hint} error={error} optional={optional} className={className}>
      <select
        {...rest}
        id={id}
        className="z-select"
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
      >
        {children}
      </select>
    </Wrapper>
  );
}
