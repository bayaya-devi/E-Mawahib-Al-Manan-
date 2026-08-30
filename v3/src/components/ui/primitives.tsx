import type { LucideIcon } from "lucide-react";
import { AlertTriangle, Inbox, LoaderCircle } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import type {
  ButtonHTMLAttributes,
  ComponentProps,
  HTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
} from "react";

import { cn } from "@/lib/ui/cn";

type ButtonVariant = "primary" | "secondary" | "quiet" | "danger";
type ButtonSize = "sm" | "md" | "icon";

export function Button({
  className,
  variant = "primary",
  size = "md",
  loading = false,
  children,
  disabled,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
}) {
  return (
    <button
      className={cn("ui-button", `ui-button--${variant}`, `ui-button--${size}`, className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? <LoaderCircle aria-hidden="true" className="ui-spin" size={18} /> : null}
      {children}
    </button>
  );
}

export function ButtonLink({
  className,
  variant = "primary",
  size = "md",
  ...props
}: ComponentProps<typeof Link> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
}) {
  return (
    <Link className={cn("ui-button", `ui-button--${variant}`, `ui-button--${size}`, className)} {...props} />
  );
}

export function IconButton({ label, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return <Button size="icon" variant="quiet" aria-label={label} title={label} {...props} />;
}

type FieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  hint?: string;
  error?: string;
  icon?: LucideIcon;
};

export function Input({ label, hint, error, icon: Icon, className, id, ...props }: FieldProps) {
  const inputId = id ?? `field-${props.name ?? label}`;
  const descriptionId = `${inputId}-description`;
  return (
    <label className="ui-field" htmlFor={inputId}>
      <span className="ui-field__label">{label}</span>
      <span className={cn("ui-control", error && "ui-control--error")}>
        {Icon ? <Icon aria-hidden="true" size={19} /> : null}
        <input
          id={inputId}
          className={cn("ui-control__input", className)}
          aria-invalid={Boolean(error)}
          aria-describedby={hint || error ? descriptionId : undefined}
          {...props}
        />
      </span>
      {hint || error ? (
        <span id={descriptionId} className={cn("ui-field__hint", error && "ui-field__hint--error")}>
          {error ?? hint}
        </span>
      ) : null}
    </label>
  );
}

export function Select({
  label,
  hint,
  children,
  id,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { label: string; hint?: string }) {
  const selectId = id ?? `select-${props.name ?? label}`;
  return (
    <label className="ui-field" htmlFor={selectId}>
      <span className="ui-field__label">{label}</span>
      <select id={selectId} className="ui-select" {...props}>
        {children}
      </select>
      {hint ? <span className="ui-field__hint">{hint}</span> : null}
    </label>
  );
}

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("ui-card", className)} {...props} />;
}

export function Badge({
  tone = "neutral",
  className,
  ...props
}: HTMLAttributes<HTMLSpanElement> & {
  tone?: "neutral" | "success" | "warning" | "danger" | "brand";
}) {
  return <span className={cn("ui-badge", `ui-badge--${tone}`, className)} {...props} />;
}

export function Avatar({ name, src, size = "md" }: { name: string; src?: string; size?: "sm" | "md" | "lg" }) {
  const initials = name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join("");
  return (
    <span className={cn("ui-avatar", `ui-avatar--${size}`)} aria-label={name}>
      {src ? <Image src={src} alt="" width={58} height={58} unoptimized /> : <span aria-hidden="true">{initials}</span>}
    </span>
  );
}

export function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("ui-skeleton", className)} aria-hidden="true" {...props} />;
}

export function EmptyState({
  title,
  description,
  action,
  icon: Icon = Inbox,
}: {
  title: string;
  description: string;
  action?: ReactNode;
  icon?: LucideIcon;
}) {
  return (
    <section className="ui-state" aria-labelledby="empty-title">
      <span className="ui-state__icon"><Icon aria-hidden="true" size={25} /></span>
      <h2 id="empty-title">{title}</h2>
      <p>{description}</p>
      {action}
    </section>
  );
}

export function ErrorState({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return (
    <section className="ui-state ui-state--error" role="alert">
      <span className="ui-state__icon"><AlertTriangle aria-hidden="true" size={25} /></span>
      <h2>{title}</h2>
      <p>{description}</p>
      {action}
    </section>
  );
}

export function Table({ children, caption }: { children: ReactNode; caption: string }) {
  return (
    <div className="ui-table-wrap" tabIndex={0} role="region" aria-label={caption}>
      <table className="ui-table">
        <caption>{caption}</caption>
        {children}
      </table>
    </div>
  );
}
