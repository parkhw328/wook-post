import { useState } from 'react'
import { Paperclip, Plus, Trash2, X } from 'lucide-react'
import type { Attachment, MultipartField } from '../../shared/contracts'
import { MAX_UPLOAD_FILES, newMultipartField } from '../../shared/models'
import { formatBytes } from './components'

export function FilePicker({
  files,
  multiple = false,
  label,
  onChange,
  onError,
}: {
  files: Attachment[]
  multiple?: boolean
  label: string
  onChange: (files: Attachment[]) => void
  onError: (error: unknown) => void
}) {
  const [selecting, setSelecting] = useState(false)
  const select = async () => {
    setSelecting(true)
    try {
      const selected = await window.wook.selectFiles(multiple)
      if (!selected) return
      const next = multiple ? [...files, ...selected] : selected
      if (next.length > MAX_UPLOAD_FILES)
        throw new Error('첨부 파일은 요청당 100개까지 지원합니다.')
      onChange(next)
    } catch (error) {
      onError(error)
    } finally {
      setSelecting(false)
    }
  }
  return (
    <div
      className={`file-picker ${multiple ? 'multiple-files' : 'single-file'}`}
      aria-label={label}
    >
      <button
        type="button"
        className="secondary-button"
        onClick={() => void select()}
        disabled={selecting}
        aria-label={`${label} 파일 선택`}
      >
        <Paperclip size={14} />
        {selecting
          ? '선택 중…'
          : files.length
            ? multiple
              ? '파일 추가'
              : '파일 변경'
            : '파일 선택'}
      </button>
      {!files.length && <span className="file-placeholder">선택한 파일 없음</span>}
      {files.map((file, index) => (
        <div className="attachment" key={`${file.path}-${index}`}>
          <span className="attachment-name" title={file.path}>
            {file.name}
            {file.size !== null && <small>{formatBytes(file.size)}</small>}
          </span>
          <button
            type="button"
            className="icon-button"
            aria-label={`${label} ${file.name} 제거`}
            onClick={() => onChange(files.filter((_, position) => position !== index))}
          >
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  )
}

export function UploadEditor({
  fields,
  onChange,
  onError,
}: {
  fields: MultipartField[]
  onChange: (fields: MultipartField[]) => void
  onError: (error: unknown) => void
}) {
  const update = (id: string, patch: Partial<MultipartField>) =>
    onChange(fields.map((field) => (field.id === id ? { ...field, ...patch } : field)))
  return (
    <div className="pair-editor multipart-editor" aria-label="폼 데이터">
      <div className="pair-heading">
        <span />
        <span>KEY</span>
        <span>유형</span>
        <span>VALUE / FILE</span>
        <span />
      </div>
      {fields.map((field, index) => {
        const label = `폼 데이터 ${index + 1}`
        return (
          <div className={`pair-row ${field.enabled ? '' : 'disabled-row'}`} key={field.id}>
            <input
              type="checkbox"
              aria-label={`${label} 활성화`}
              checked={field.enabled}
              onChange={(event) => update(field.id, { enabled: event.target.checked })}
            />
            <input
              aria-label={`${label} 키`}
              placeholder="필드 이름"
              value={field.key}
              spellCheck={false}
              onChange={(event) => update(field.id, { key: event.target.value })}
            />
            <select
              aria-label={`${label} 유형`}
              value={field.type}
              onChange={(event) =>
                update(field.id, { type: event.target.value as MultipartField['type'] })
              }
            >
              <option value="text">Text</option>
              <option value="file">File</option>
            </select>
            {field.type === 'text' ? (
              <input
                aria-label={`${label} 값`}
                placeholder="값 또는 {{변수}}"
                value={field.value}
                spellCheck={false}
                onChange={(event) => update(field.id, { value: event.target.value })}
              />
            ) : (
              <FilePicker
                label={label}
                files={field.files}
                multiple
                onChange={(files) => update(field.id, { files })}
                onError={onError}
              />
            )}
            <button
              type="button"
              className="icon-button"
              aria-label={`${label} 삭제`}
              onClick={() => onChange(fields.filter((item) => item.id !== field.id))}
            >
              <Trash2 size={14} />
            </button>
          </div>
        )
      })}
      <div className="multipart-actions">
        <button
          type="button"
          className="add-row"
          disabled={fields.length >= 200}
          onClick={() => onChange([...fields, newMultipartField()])}
        >
          <Plus size={14} />
          텍스트 필드 추가
        </button>
        <button
          type="button"
          className="add-row"
          disabled={fields.length >= 200}
          onClick={() => onChange([...fields, newMultipartField('file')])}
        >
          <Paperclip size={14} />
          파일 필드 추가
        </button>
      </div>
    </div>
  )
}
