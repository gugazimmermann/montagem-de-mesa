import { useState, type ChangeEvent } from 'react'
import * as ui from './adminClasses'

type CampoSenhaProps = {
  label: string
  name: string
  value: string
  onChange: (e: ChangeEvent<HTMLInputElement>) => void
  onBlur?: () => void
  autoComplete?: string
  required?: boolean
  minLength?: number
  disabled?: boolean
  dica?: string
  invalido?: boolean
  mensagemErro?: string | null
}

function IconeOlho() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}

function IconeOlhoRiscado() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 3l18 18" />
      <path d="M10.6 10.6a2 2 0 0 0 2.8 2.8" />
      <path d="M9.9 5.1A10.4 10.4 0 0 1 12 5c6.5 0 10 7 10 7a18.4 18.4 0 0 1-2.2 3.1" />
      <path d="M6.1 6.1C3.8 7.8 2 12 2 12s3.5 7 10 7a9.8 9.8 0 0 0 4.3-1" />
    </svg>
  )
}

export function CampoSenha({
  label,
  name,
  value,
  onChange,
  onBlur,
  autoComplete,
  required,
  minLength,
  disabled,
  dica,
  invalido,
  mensagemErro,
}: CampoSenhaProps) {
  const [visivel, setVisivel] = useState(false)
  const erroId = `${name}-erro`
  const dicaId = `${name}-dica`

  return (
    <label className={ui.field}>
      <span className={ui.fieldLabel}>{label}</span>
      <div className={ui.fieldSenha}>
        <input
          type={visivel ? 'text' : 'password'}
          name={name}
          className={ui.fieldSenhaInput}
          autoComplete={autoComplete}
          value={value}
          onChange={onChange}
          onBlur={onBlur}
          required={required}
          minLength={minLength}
          disabled={disabled}
          aria-invalid={invalido || undefined}
          aria-describedby={
            [mensagemErro ? erroId : null, dica ? dicaId : null].filter(Boolean).join(' ') ||
            undefined
          }
        />
        <button
          type="button"
          className={ui.fieldSenhaToggle}
          onClick={() => setVisivel((v) => !v)}
          aria-label={visivel ? 'Ocultar senha' : 'Mostrar senha'}
          aria-pressed={visivel}
          disabled={disabled}
        >
          {visivel ? <IconeOlhoRiscado /> : <IconeOlho />}
        </button>
      </div>
      {dica && !mensagemErro && (
        <span id={dicaId} className={ui.fieldDica}>
          {dica}
        </span>
      )}
      {mensagemErro && (
        <span id={erroId} className={ui.fieldErro} role="alert">
          {mensagemErro}
        </span>
      )}
    </label>
  )
}
