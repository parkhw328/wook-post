import { useEffect, useRef, type ReactNode } from 'react'
import { Plus, Trash2, X } from 'lucide-react'
import type { Pair } from '../../shared/contracts'
import { newPair } from '../../shared/models'

export function Modal({
  title,
  children,
  onClose,
  wide = false,
}: {
  title: string
  children: ReactNode
  onClose: () => void
  wide?: boolean
}) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    ref.current?.showModal()
  }, [])
  return (
    <dialog
      ref={ref}
      className={wide ? 'modal wide' : 'modal'}
      onCancel={(event) => {
        event.preventDefault()
        onClose()
      }}
      aria-label={title}
    >
      <div className="modal-heading">
        <h2>{title}</h2>
        <button className="icon-button" onClick={onClose} aria-label="닫기">
          <X size={18} />
        </button>
      </div>
      {children}
    </dialog>
  )
}

export function PairEditor({
  pairs,
  onChange,
  label,
  keyPlaceholder = 'Key',
  valuePlaceholder = 'Value',
}: {
  pairs: Pair[]
  onChange: (pairs: Pair[]) => void
  label: string
  keyPlaceholder?: string
  valuePlaceholder?: string
}) {
  const update = (index: number, patch: Partial<Pair>) =>
    onChange(pairs.map((pair, position) => (position === index ? { ...pair, ...patch } : pair)))
  return (
    <div className="pair-editor" aria-label={label}>
      <div className="pair-heading">
        <span />
        <span>KEY</span>
        <span>VALUE</span>
        <span />
      </div>
      {pairs.map((pair, index) => (
        <div className={`pair-row ${!pair.enabled ? 'disabled-row' : ''}`} key={pair.id}>
          <input
            type="checkbox"
            checked={pair.enabled}
            onChange={(event) => update(index, { enabled: event.target.checked })}
            aria-label={`${label} ${index + 1} 활성화`}
          />
          <input
            aria-label={`${label} ${index + 1} 키`}
            value={pair.key}
            placeholder={keyPlaceholder}
            onChange={(event) => update(index, { key: event.target.value })}
            spellCheck={false}
          />
          <input
            aria-label={`${label} ${index + 1} 값`}
            value={pair.value}
            placeholder={valuePlaceholder}
            onChange={(event) => update(index, { value: event.target.value })}
            spellCheck={false}
          />
          <button
            className="icon-button"
            onClick={() => onChange(pairs.filter((_, position) => position !== index))}
            aria-label={`${label} ${index + 1} 삭제`}
          >
            <Trash2 size={14} />
          </button>
        </div>
      ))}
      <button className="add-row" onClick={() => onChange([...pairs, newPair()])}>
        <Plus size={14} />
        {label} 추가
      </button>
    </div>
  )
}

export function formatBytes(size: number) {
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
  return `${(size / 1024 / 1024).toFixed(1)} MB`
}

export function JsonView({ text, pretty }: { text: string; pretty: boolean }) {
  let rendered = text
  if (pretty) {
    try {
      rendered = JSON.stringify(JSON.parse(text), null, 2)
    } catch {
      /* Plain text stays as received. */
    }
  }
  // Only the visible preview is capped. Raw bytes remain available through the export action.
  const preview = rendered.slice(0, 100_000)
  const tokens = preview.split(
    /("(?:\\.|[^"\\])*"\s*:|"(?:\\.|[^"\\])*"|\b(?:true|false|null)\b|-?\b\d+(?:\.\d+)?(?:[eE][+-]?\d+)?\b)/g,
  )
  return (
    <>
      <pre className="response-code" tabIndex={0} aria-label="응답 본문">
        <code>
          {pretty
            ? tokens.map((token, index) => {
                const color = /^".*:\s*$/.test(token)
                  ? 'json-key'
                  : token.startsWith('"')
                    ? 'json-string'
                    : /^(true|false|null)$/.test(token)
                      ? 'json-keyword'
                      : /^-?\d/.test(token)
                        ? 'json-number'
                        : ''
                return (
                  <span key={index} className={color}>
                    {token}
                  </span>
                )
              })
            : preview}
        </code>
      </pre>
      {rendered.length > 100_000 && (
        <p className="preview-note">
          화면에는 처음 100,000자만 표시합니다. 저장된 전체 본문은 내보내기로 확인하세요.
        </p>
      )}
    </>
  )
}
