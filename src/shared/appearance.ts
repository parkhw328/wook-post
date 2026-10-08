import { z } from 'zod'

export const appearanceSchema = z.object({
  scale: z.number().int().min(80).max(150),
  latinFont: z.enum(['jetbrains', 'consolas', 'cascadia', 'arial']),
  koreanFont: z.enum(['noto', 'malgun', 'dotum']),
})
export type Appearance = z.infer<typeof appearanceSchema>
export const defaultAppearance: Appearance = {
  scale: 100,
  latinFont: 'jetbrains',
  koreanFont: 'noto',
}

export const latinFonts = {
  jetbrains: { label: 'JetBrains Mono · 기본', family: "'JetBrains Mono'" },
  consolas: { label: 'Consolas', family: 'Consolas' },
  cascadia: { label: 'Cascadia Code', family: "'Cascadia Code'" },
  arial: { label: 'Arial', family: "Arial, 'Liberation Sans'" },
} as const
export const koreanFonts = {
  noto: { label: 'Noto Sans KR · 기본', family: "'Noto Sans KR'" },
  malgun: { label: '맑은 고딕', family: "'Malgun Gothic'" },
  dotum: { label: '돋움', family: 'Dotum' },
} as const

export function appearanceFontFamily(appearance: Appearance) {
  return `${latinFonts[appearance.latinFont].family}, 'JetBrains Mono', ${koreanFonts[appearance.koreanFont].family}, 'Noto Sans KR', sans-serif`
}
