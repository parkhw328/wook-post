import { useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { filterSuggestions } from '../../shared/headers'

export function AutocompleteInput({
  label,
  value,
  placeholder,
  options,
  onChange,
}: {
  label: string
  value: string
  placeholder: string
  options: string[]
  onChange: (value: string) => void
}) {
  const id = useId()
  const input = useRef<HTMLInputElement>(null)
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const [position, setPosition] = useState({ top: 0, left: 0, width: 0, maxHeight: 240 })
  const suggestions = filterSuggestions(options, value)
  const visible = open && suggestions.length > 0
  const selected = Math.min(active, suggestions.length - 1)
  useLayoutEffect(() => {
    if (!visible) return
    const reposition = () => {
      const rect = input.current!.getBoundingClientRect()
      const below = window.innerHeight - rect.bottom - 12
      const maxHeight = Math.min(240, Math.max(below, rect.top - 12))
      const width = Math.min(Math.max(rect.width, 220), window.innerWidth - 24)
      setPosition({
        top:
          below >= Math.min(240, suggestions.length * 38 + 8)
            ? rect.bottom + 4
            : Math.max(8, rect.top - maxHeight - 4),
        left: Math.min(rect.left, window.innerWidth - width - 12),
        width,
        maxHeight,
      })
    }
    reposition()
    window.addEventListener('resize', reposition)
    window.addEventListener('scroll', reposition, true)
    return () => {
      window.removeEventListener('resize', reposition)
      window.removeEventListener('scroll', reposition, true)
    }
  }, [visible, suggestions.length])
  useLayoutEffect(() => {
    if (visible) document.getElementById(`${id}-${selected}`)?.scrollIntoView({ block: 'nearest' })
  }, [visible, selected, id])
  const choose = (suggestion: string) => {
    onChange(suggestion)
    setOpen(false)
    setActive(0)
  }
  return (
    <>
      <input
        ref={input}
        role="combobox"
        aria-label={label}
        aria-autocomplete="list"
        aria-expanded={visible}
        aria-controls={visible ? id : undefined}
        aria-activedescendant={visible ? `${id}-${selected}` : undefined}
        value={value}
        placeholder={placeholder}
        autoComplete="off"
        spellCheck={false}
        onFocus={() => {
          setOpen(true)
          setActive(0)
        }}
        onBlur={() => setOpen(false)}
        onChange={(event) => {
          onChange(event.target.value)
          setOpen(true)
          setActive(0)
        }}
        onKeyDown={(event) => {
          if (event.ctrlKey || event.metaKey || event.altKey) return
          if (event.key === 'Escape') {
            setOpen(false)
            return
          }
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            if (!suggestions.length) return
            event.preventDefault()
            setOpen(true)
            setActive(
              open
                ? (selected + (event.key === 'ArrowDown' ? 1 : -1) + suggestions.length) %
                    suggestions.length
                : 0,
            )
          } else if (visible && (event.key === 'Enter' || event.key === 'Tab')) {
            if (event.key === 'Enter') event.preventDefault()
            choose(suggestions[selected])
          }
        }}
      />
      {visible &&
        createPortal(
          <div
            id={id}
            className="autocomplete-menu"
            role="listbox"
            aria-label={`${label} 추천`}
            style={position}
          >
            {suggestions.map((suggestion, index) => (
              <button
                id={`${id}-${index}`}
                key={suggestion}
                type="button"
                role="option"
                aria-selected={selected === index}
                tabIndex={-1}
                onMouseDown={(event) => event.preventDefault()}
                onMouseEnter={() => setActive(index)}
                onClick={() => choose(suggestion)}
              >
                {suggestion}
              </button>
            ))}
          </div>,
          document.body,
        )}
    </>
  )
}
