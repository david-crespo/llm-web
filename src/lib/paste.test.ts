import { describe, expect, test } from 'vitest'
import { estimateTokens, joinComposer, pasteLabel, splitComposer, splitSegments } from './paste'

describe('estimateTokens', () => {
  test('rounds up chars/4', () => expect(estimateTokens('abcde')).toBe(2))
  test('empty', () => expect(estimateTokens('')).toBe(0))
})

describe('pasteLabel', () => {
  test('formats with a thousands separator', () =>
    expect(pasteLabel('x'.repeat(5000))).toBe('Pasted content (~1,250 tokens)'))
})

describe('splitSegments', () => {
  test('plain text', () =>
    expect(splitSegments('hello')).toEqual([{ kind: 'text', text: 'hello' }]))
  test('paste then text', () =>
    expect(splitSegments('<pasted>\nlong text\n</pasted>\n\nsummarize')).toEqual([
      { kind: 'pasted', text: 'long text' },
      { kind: 'text', text: 'summarize' },
    ]))
  test('multiple pastes with text between', () =>
    expect(splitSegments('<pasted>\na\n</pasted>\nmid\n<pasted>\nb\n</pasted>\nend')).toEqual([
      { kind: 'pasted', text: 'a' },
      { kind: 'text', text: '\nmid\n' },
      { kind: 'pasted', text: 'b' },
      { kind: 'text', text: '\nend' },
    ]))
  test('preserves inner whitespace and blank lines', () =>
    expect(splitSegments('<pasted>\n  x\n\n  y\n</pasted>')).toEqual([
      { kind: 'pasted', text: '  x\n\n  y' },
    ]))
})

describe('composer round trip', () => {
  test('join then split', () => {
    const joined = joinComposer('do this', ['one', 'two'])
    expect(joined).toBe('<pasted>\none\n</pasted>\n\n<pasted>\ntwo\n</pasted>\n\ndo this')
    expect(splitComposer(joined)).toEqual({ text: 'do this', pastes: ['one', 'two'] })
  })
  test('paste with no typed text', () => {
    expect(joinComposer('', ['only'])).toBe('<pasted>\nonly\n</pasted>')
    expect(splitComposer('<pasted>\nonly\n</pasted>')).toEqual({ text: '', pastes: ['only'] })
  })
  test('typed text keeps surrounding whitespace while a chip is present', () => {
    const joined = joinComposer(' hi ', ['p'])
    expect(splitComposer(joined).text).toBe(' hi ')
  })
  test('no pastes', () => {
    expect(joinComposer('hi', [])).toBe('hi')
    expect(splitComposer('hi')).toEqual({ text: 'hi', pastes: [] })
  })
})
