import { useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown } from 'lucide-react'
import { filterSuggestions } from '../../shared/headers'

export function AutocompleteInput({
  label,
  value,
  placeholder,
  options,
  onChange,
  browseValues = false,
}: {
  label: string
  value: string
  placeholder: string
  options: string[]
  onChange: (value: string) => void
  browseValues?: boolean
}) {
  const id = useId()
  const input = useRef<HTMLInputElement>(null)
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const [showAll, setShowAll] = useState(false)
  const [acceptOnTab, setAcceptOnTab] = useState(false)
  const [position, setPosition] = useState({ top: 0, left: 0, width: 0, maxHeight: 240 })
  const suggestions = filterSuggestions(options, browseValues && showAll ? '' : value)
  const visible = open && suggestions.length > 0
  const selected = Math.min(active, suggestions.length - 1)
  useLayoutEffect(() => {
    if (!visible) return
    const reposition = () => {
      const rect = input.current!.parentElement!.getBoundingClientRect()
      const below = window.innerHeight - rect.bottom - 12
      const maxHeight = Math.min(280, suggestions.length * 42 + 8, Math.max(below, rect.top - 12))
      const width = Math.min(Math.max(rect.width, 220), window.innerWidth - 24)
      setPosition({
        top: below >= maxHeight ? rect.bottom + 4 : Math.max(8, rect.top - maxHeight - 4),
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
    setAcceptOnTab(false)
  }
  const browse = () => {
    setOpen(true)
    setShowAll(browseValues)
    setActive(0)
    setAcceptOnTab(false)
  }
  return (
    <>
      <div className="autocomplete-input">
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
          onFocus={browse}
          onClick={() => {
            if (browseValues) browse()
          }}
          onBlur={() => setOpen(false)}
          onChange={(event) => {
            onChange(event.target.value)
            setOpen(true)
            setActive(0)
            setShowAll(false)
            setAcceptOnTab(true)
          }}
          onKeyDown={(event) => {
            if (event.ctrlKey || event.metaKey || event.altKey) return
            if (event.nativeEvent.isComposing) return
            if (event.key === 'Escape') {
              setOpen(false)
              setAcceptOnTab(false)
              return
            }
            if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
              if (!visible && browseValues && options.length) {
                event.preventDefault()
                browse()
                setAcceptOnTab(true)
                return
              }
              if (!suggestions.length) return
              event.preventDefault()
              setOpen(true)
              setAcceptOnTab(true)
              setActive(
                open
                  ? (selected + (event.key === 'ArrowDown' ? 1 : -1) + suggestions.length) %
                      suggestions.length
                  : 0,
              )
            } else if (
              visible &&
              (event.key === 'Enter' || (event.key === 'Tab' && acceptOnTab && !event.shiftKey))
            ) {
              if (event.key === 'Enter') event.preventDefault()
              choose(suggestions[selected])
            }
          }}
        />
        {browseValues && options.length > 0 && (
          <button
            type="button"
            className="autocomplete-toggle"
            aria-label={`${label} 추천 목록`}
            title="추천 값 전체 보기"
            aria-expanded={visible}
            aria-controls={visible ? id : undefined}
            tabIndex={-1}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => {
              const close = visible && showAll
              input.current?.focus()
              browse()
              if (close) setOpen(false)
            }}
          >
            <ChevronDown size={16} />
          </button>
        )}
      </div>
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
