import {
  defaultAppearance,
  koreanFonts,
  latinFonts,
  type Appearance,
} from '../../shared/appearance'
import { Modal } from './components'

export function AppearanceSettings({
  value,
  onChange,
  onSave,
  onClose,
  saving,
}: {
  value: Appearance
  onChange: (appearance: Appearance) => void
  onSave: () => void
  onClose: () => void
  saving: boolean
}) {
  return (
    <Modal title="앱 설정" onClose={onClose} className="appearance-modal">
      <div className="appearance-content">
        <p className="modal-description">
          변경 내용을 바로 미리 볼 수 있습니다. 저장하면 다음 실행에도 적용됩니다.
        </p>
        <fieldset className="appearance-fields" disabled={saving}>
          <div className="appearance-fonts">
            <label className="field-label">
              영문 글꼴
              <select
                className="field-input"
                value={value.latinFont}
                onChange={(event) =>
                  onChange({ ...value, latinFont: event.target.value as Appearance['latinFont'] })
                }
              >
                {Object.entries(latinFonts).map(([key, font]) => (
                  <option key={key} value={key}>
                    {font.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="field-label">
              한글 글꼴
              <select
                className="field-input"
                value={value.koreanFont}
                onChange={(event) =>
                  onChange({ ...value, koreanFont: event.target.value as Appearance['koreanFont'] })
                }
              >
                {Object.entries(koreanFonts).map(([key, font]) => (
                  <option key={key} value={key}>
                    {font.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <p className="field-hint">
            기본 글꼴 2종은 앱에 포함되어 있습니다. 다른 글꼴이 이 PC에 없으면 기본 글꼴로
            표시됩니다.
          </p>
          <div className="field-label">
            <span className="appearance-scale-label">
              <label htmlFor="content-font-scale">요청·응답 글자 크기</label>
              <output htmlFor="content-font-scale">{value.scale}%</output>
            </span>
            <div className="appearance-scale-controls">
              <button
                type="button"
                className="secondary-button"
                aria-label="글자 크기 줄이기"
                disabled={value.scale <= 80}
                onClick={() => onChange({ ...value, scale: Math.max(80, value.scale - 5) })}
              >
                −
              </button>
              <input
                id="content-font-scale"
                type="range"
                min={80}
                max={150}
                step={5}
                value={value.scale}
                onChange={(event) => onChange({ ...value, scale: Number(event.target.value) })}
              />
              <button
                type="button"
                className="secondary-button"
                aria-label="글자 크기 키우기"
                disabled={value.scale >= 150}
                onClick={() => onChange({ ...value, scale: Math.min(150, value.scale + 5) })}
              >
                +
              </button>
            </div>
          </div>
          <div className="appearance-scale-label field-hint">
            <span>80%</span>
            <span>본문 {Number(((17 * value.scale) / 100).toFixed(2))}px · 기본 17px</span>
            <span>150%</span>
          </div>
          <p className="field-hint">
            요청 입력과 응답 본문·헤더에 적용됩니다. 메뉴와 버튼 크기는 유지됩니다.
          </p>
          <div className="appearance-preview" aria-label="글꼴 미리보기">
            <strong>응답 미리보기</strong>
            <pre>
              <code>{'{\n  "status": 200,\n  "message": "요청이 완료되었습니다."\n}'}</code>
            </pre>
          </div>
        </fieldset>
      </div>
      <div className="modal-actions appearance-actions">
        <button
          className="secondary-button"
          disabled={saving}
          onClick={() => onChange({ ...defaultAppearance })}
        >
          기본값 복원
        </button>
        <button className="secondary-button" disabled={saving} onClick={onClose}>
          취소
        </button>
        <button className="primary-button" disabled={saving} onClick={onSave}>
          {saving ? '저장 중…' : '설정 저장'}
        </button>
      </div>
    </Modal>
  )
}
