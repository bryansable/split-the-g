import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Rule } from './icons'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'

const base =
  'inline-flex items-center justify-center gap-2 rounded-md font-display tracking-wide uppercase text-[0.82em] transition active:scale-[0.98] disabled:opacity-40 disabled:pointer-events-none'
const variants: Record<Variant, string> = {
  primary: 'bg-gold text-ink border border-gold shadow-[inset_0_1px_0_rgba(255,255,255,.35)] hover:bg-[#d7b45a]',
  secondary: 'bg-wood text-cream border border-gold/40 hover:border-gold/80',
  ghost: 'text-gold hover:text-cream hover:bg-white/5',
  danger: 'bg-claret/30 text-cream border border-claret/60 hover:bg-claret/45',
}
const sizes = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-5 py-2.5 text-base',
  lg: 'px-7 py-3.5 text-lg',
}

export function Button({
  variant = 'primary',
  size = 'md',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: keyof typeof sizes }) {
  return <button className={`${base} ${variants[variant]} ${sizes[size]} ${className}`} {...props} />
}

export function LinkButton({
  to,
  variant = 'primary',
  size = 'md',
  className = '',
  children,
}: {
  to: string
  variant?: Variant
  size?: keyof typeof sizes
  className?: string
  children: ReactNode
}) {
  return (
    <Link to={to} className={`${base} ${variants[variant]} ${sizes[size]} ${className}`}>
      {children}
    </Link>
  )
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-lg bg-wood/80 border border-gold/25 p-4 shadow-[0_1px_0_rgba(201,164,71,.15)] ${className}`}>{children}</div>
}

export function PageTitle({ children, sub }: { children: ReactNode; sub?: ReactNode }) {
  return (
    <div className="mb-4">
      <h1 className="font-display text-2xl tracking-wider text-gold uppercase">{children}</h1>
      <Rule className="my-2" />
      {sub && <p className="text-cream/65 text-sm">{sub}</p>}
    </div>
  )
}

/** A plain figure with a small gold label; put several in a flex row with dividers. */
export function Figure({ label, value, size = 'lg' }: { label: string; value: ReactNode; size?: 'md' | 'lg' }) {
  return (
    <div className="flex-1 text-center">
      <div className={`font-display text-cream leading-none ${size === 'lg' ? 'text-3xl' : 'text-2xl'}`}>{value}</div>
      <div className="mt-1 text-[10px] uppercase tracking-[0.2em] text-gold/80">{label}</div>
    </div>
  )
}

/** Hairline separator between sections. */
export function Hr({ className = '' }: { className?: string }) {
  return <hr className={`border-0 border-t border-gold/20 ${className}`} />
}

/** A screen's scrolling body with consistent gutters. */
export function Page({ children }: { children: ReactNode }) {
  return <div className="px-5 pt-4 pb-8">{children}</div>
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full rounded-md bg-stout border border-gold/30 px-4 py-3 text-cream placeholder:text-cream/30 outline-none focus:border-gold ${props.className ?? ''}`}
    />
  )
}

export function Notice({ children, tone = 'info' }: { children: ReactNode; tone?: 'info' | 'warn' | 'ok' }) {
  const t =
    tone === 'warn'
      ? 'border-gold/60 text-gold bg-gold/10'
      : tone === 'ok'
        ? 'border-emerald/70 text-cream bg-emerald/15'
        : 'border-gold/25 text-cream/85 bg-wood/60'
  return <div className={`rounded-md border px-4 py-3 text-sm ${t}`}>{children}</div>
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return <div className="text-gold/80 text-[11px] uppercase tracking-[0.18em] mb-2">{children}</div>
}
