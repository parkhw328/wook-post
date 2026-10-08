import { describe, expect, it } from 'vitest'
import { formatJson } from '../src/shared/json'

describe('lossless JSON formatting', () => {
  it('preserves large integers, decimal precision, exponents and negative zero', () => {
    const source = '{"id":9007199254740993,"decimal":1.2300,"exponent":1e+1000,"zero":-0}'
    const formatted = formatJson(source)
    expect(formatted).toContain('"id": 9007199254740993')
    expect(formatted).toContain('"decimal": 1.2300')
    expect(formatted).toContain('"exponent": 1e+1000')
    expect(formatted).toContain('"zero": -0')
  })
  it('retains duplicate keys, escaped strings, Korean and nested empty containers', () => {
    const source = '{"key":1,"key":2,"text":"한글 { [ , : \\\" \\n","items":[{},[],true,null]}'
    const formatted = formatJson(source)
    expect(formatted.match(/"key":/g)).toHaveLength(2)
    expect(formatted).toContain('"text": "한글 { [ , : \\\" \\n"')
    expect(formatted).toContain('{}')
    expect(formatted).toContain('[]')
    expect(JSON.parse(formatted)).toEqual(JSON.parse(source))
  })
  it('supports scalar JSON and rejects invalid JSON before replacing editor contents', () => {
    for (const source of ['"hello"', '9007199254740993', '-0', 'null', 'true'])
      expect(formatJson(source)).toBe(source)
    for (const source of ['', '{"a":}', '[1,]', 'undefined'])
      expect(() => formatJson(source)).toThrow()
  })
  it('bounds whitespace growth for deeply nested responses without changing their content', () => {
    const source = '['.repeat(500) + '9007199254740993' + ']'.repeat(500)
    const formatted = formatJson(source)
    expect(formatted.length).toBeLessThan(90_000)
    expect(formatted.replace(/\s/g, '')).toBe(source)
  })
})
