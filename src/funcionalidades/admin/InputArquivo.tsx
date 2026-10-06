import { useRef, type ChangeEvent } from 'react'

type Props = {
  accept: string
  disabled?: boolean
  arquivo?: File | null
  onChange: (evento: ChangeEvent<HTMLInputElement>) => void
  'aria-label': string
  'aria-describedby'?: string
}

/** Input de arquivo com rótulos em português (o nativo fica em inglês no browser). */
export function InputArquivo({
  accept,
  disabled,
  arquivo,
  onChange,
  'aria-label': ariaLabel,
  'aria-describedby': ariaDescribedBy,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null)

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-2">
      <input
        ref={inputRef}
        className="sr-only"
        type="file"
        accept={accept}
        disabled={disabled}
        aria-label={ariaLabel}
        aria-describedby={ariaDescribedBy}
        onChange={(e) => {
          onChange(e)
          // Permite reescolher o mesmo arquivo depois.
          e.target.value = ''
        }}
      />
      <button
        type="button"
        className="btn btn--ghost shrink-0"
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
      >
        Escolher arquivo
      </button>
      <span className="min-w-0 truncate text-sm text-muted" aria-live="polite">
        {arquivo?.name ?? 'Nenhum arquivo escolhido'}
      </span>
    </div>
  )
}
