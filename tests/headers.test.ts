import { describe, expect, it } from 'vitest'
import { filterSuggestions, headerValues } from '../src/shared/headers'

describe('header value suggestions', () => {
  it('keeps MIME candidates beyond the initial eight available for browsing and searching', () => {
    const options = headerValues('  CoNtEnT-TyPe  ')
    expect(filterSuggestions(options, '')).toContain('image/jpeg')
    expect(filterSuggestions(options, '')).toContain('video/webm')
    expect(filterSuggestions(options, 'JSON')).toContain('application/json')
    expect(filterSuggestions(options, 'PROBLEM')).toEqual(['application/problem+json'])
    expect(filterSuggestions(options, 'charset=utf-8')).toContain('text/plain; charset=utf-8')
    expect(filterSuggestions(options, '{{customType}}')).toEqual([])
  })

  it('selects candidates for the current header and treats arbitrary names as manual fields', () => {
    expect(headerValues('Accept')).toContain('*/*')
    expect(headerValues('Content-Type')).not.toContain('*/*')
    expect(headerValues('Cache-Control')).toContain('no-store')
    expect(headerValues('Authorization')).toEqual(['Bearer ', 'Basic '])
    for (const name of ['', 'X-Custom', 'constructor', '__proto__', 'hasOwnProperty'])
      expect(headerValues(name)).toEqual([])
  })
})
