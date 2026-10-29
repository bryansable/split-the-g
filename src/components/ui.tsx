import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Link } from 'react-router-dom'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'

const base = 'inline-flex items-center justify-center gap-2 rounded-full font-semibold transition active:scale-[0.98] disabled:opacity-40 disabled:pointer-events-none'
const variants: Record<Variant, string> = {
  primary: 'bg-cream text-ink hover:bg-cream/90',
  secondary: 'bg-white/10 text-cream hover:bg-white/15',
  ghost: 'text-cream/80 hover:text-cream hover:bg-white/5',
  danger: 'bg-red-500/20 text-red-300 hover:bg-red-500/30',
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
  return <div className={`rounded-2xl bg-white/5 border border-white/10 p-4 ${className}`}>{children}</div>
}

export function PageTitle({ children, sub }: { children: ReactNode; sub?: ReactNode }) {
  return (
    <div className="mb-4">
      <h1 className="font-serif text-3xl text-cream">{children}</h1>
      {sub && <p className="text-cream/60 text-sm mt-1">{sub}</p>}
    </div>
  )
}

export function Stat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-xl bg-white/5 px-3 py-2 text-center">
      <div className="font-serif text-2xl text-cream">{value}</div>
      <div className="text-[11px] uppercase tracking-wider text-cream/50">{label}</div>
    </div>
  )
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full rounded-xl bg-white/5 border border-white/15 px-4 py-3 text-cream placeholder:text-cream/30 outline-none focus:border-cream/50 ${props.className ?? ''}`}
    />
  )
}

export function Notice({ children, tone = 'info' }: { children: ReactNode; tone?: 'info' | 'warn' | 'ok' }) {
  const t = tone === 'warn' ? 'border-amber-400/40 text-amber-200' : tone === 'ok' ? 'border-green-400/40 text-green-200' : 'border-white/15 text-cream/80'
  return <div className={`rounded-xl border bg-white/5 px-4 py-3 text-sm ${t}`}>{children}</div>
}
