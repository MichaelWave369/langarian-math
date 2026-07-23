/**
 * Hand-written lexer for langarian-dsl:v0.3.
 *
 * - Enforces MAX_DSL_TOKENS at lex time (docs/DSL_SPEC.md §6).
 * - `#` starts a line comment.
 * - Newlines inside brackets/parens/braces are continuation lines and do not
 *   terminate a statement; top-level newlines are NEWLINE tokens.
 * - No eval / new Function / dynamic import: tokens are recognized by explicit
 *   character classes only.
 */

import { MAX_DSL_TOKENS } from '../kernel/limits.js'
import { DslError } from './errors.js'

export type TokenType = 'ident' | 'number' | 'string' | 'punct' | 'newline' | 'eof'

export interface Token {
  type: TokenType
  /** Raw text for ident/number/punct; decoded value for string; '' otherwise. */
  value: string
  line: number
  column: number
}

const PUNCT = new Set(['=', '(', ')', '[', ']', '{', '}', ',', ':', '+', '-', '*', '/'])

function isIdentStart(ch: string): boolean {
  return (ch >= 'A' && ch <= 'Z') || (ch >= 'a' && ch <= 'z') || ch === '_'
}

function isIdentPart(ch: string): boolean {
  return isIdentStart(ch) || (ch >= '0' && ch <= '9')
}

function isDigit(ch: string): boolean {
  return ch >= '0' && ch <= '9'
}

export function tokenize(source: string): Token[] {
  const tokens: Token[] = []
  let pos = 0
  let line = 1
  let column = 1
  let bracketDepth = 0

  const push = (type: TokenType, value: string, tokLine: number, tokColumn: number): void => {
    tokens.push({ type, value, line: tokLine, column: tokColumn })
    if (tokens.length > MAX_DSL_TOKENS) {
      throw new DslError(
        'LIMIT_EXCEEDED',
        `token count exceeds MAX_DSL_TOKENS=${MAX_DSL_TOKENS}.`,
        tokLine,
        tokColumn,
      )
    }
  }

  const advance = (): string => {
    const ch = source[pos]!
    pos++
    if (ch === '\n') {
      line++
      column = 1
    } else {
      column++
    }
    return ch
  }

  const lexString = (startLine: number, startColumn: number): void => {
    // Opening quote already current.
    advance()
    let out = ''
    for (;;) {
      if (pos >= source.length) {
        throw new DslError('UNTERMINATED_STRING', 'string literal is not terminated.', startLine, startColumn)
      }
      const ch = source[pos]!
      if (ch === '\n') {
        throw new DslError('UNTERMINATED_STRING', 'string literal is not terminated.', startLine, startColumn)
      }
      if (ch === '"') {
        advance()
        push('string', out, startLine, startColumn)
        return
      }
      if (ch === '\\') {
        advance()
        if (pos >= source.length) {
          throw new DslError('UNTERMINATED_STRING', 'string literal is not terminated.', startLine, startColumn)
        }
        const esc = advance()
        switch (esc) {
          case '"':
            out += '"'
            break
          case '\\':
            out += '\\'
            break
          case '/':
            out += '/'
            break
          case 'b':
            out += '\b'
            break
          case 'f':
            out += '\f'
            break
          case 'n':
            out += '\n'
            break
          case 'r':
            out += '\r'
            break
          case 't':
            out += '\t'
            break
          case 'u': {
            const hex = source.slice(pos, pos + 4)
            if (!/^[0-9a-fA-F]{4}$/.test(hex)) {
              throw new DslError('UNEXPECTED_TOKEN', `invalid \\u escape in string literal.`, line, column)
            }
            out += String.fromCharCode(parseInt(hex, 16))
            for (let i = 0; i < 4; i++) advance()
            break
          }
          default:
            throw new DslError('UNEXPECTED_TOKEN', `invalid escape '\\${esc}' in string literal.`, line, column)
        }
        continue
      }
      const code = ch.codePointAt(0)!
      if (code < 0x20) {
        throw new DslError('UNEXPECTED_TOKEN', 'unescaped control character in string literal.', line, column)
      }
      out += ch
      advance()
    }
  }

  for (;;) {
    if (pos >= source.length) {
      push('eof', '', line, column)
      return tokens
    }
    const ch = source[pos]!
    if (ch === ' ' || ch === '\t' || ch === '\r') {
      advance()
      continue
    }
    if (ch === '\n') {
      const tokLine = line
      const tokColumn = column
      advance()
      if (bracketDepth === 0) {
        // Collapse consecutive blank lines into a single NEWLINE token.
        if (tokens.length > 0 && tokens[tokens.length - 1]!.type !== 'newline') {
          push('newline', '', tokLine, tokColumn)
        }
      }
      continue
    }
    if (ch === '#') {
      while (pos < source.length && source[pos] !== '\n') advance()
      continue
    }
    const tokLine = line
    const tokColumn = column
    if (isIdentStart(ch)) {
      let text = ''
      while (pos < source.length && isIdentPart(source[pos]!)) text += advance()
      push('ident', text, tokLine, tokColumn)
      continue
    }
    if (isDigit(ch)) {
      let text = ''
      while (pos < source.length && isDigit(source[pos]!)) text += advance()
      if (source[pos] === '.') {
        text += advance()
        if (pos >= source.length || !isDigit(source[pos]!)) {
          throw new DslError('UNEXPECTED_TOKEN', 'malformed number: missing digits after decimal point.', line, column)
        }
        while (pos < source.length && isDigit(source[pos]!)) text += advance()
      }
      if (source[pos] === 'e' || source[pos] === 'E') {
        text += advance()
        if (source[pos] === '+' || source[pos] === '-') text += advance()
        if (pos >= source.length || !isDigit(source[pos]!)) {
          throw new DslError('UNEXPECTED_TOKEN', 'malformed number: missing exponent digits.', line, column)
        }
        while (pos < source.length && isDigit(source[pos]!)) text += advance()
      }
      push('number', text, tokLine, tokColumn)
      continue
    }
    if (ch === '"') {
      lexString(tokLine, tokColumn)
      continue
    }
    if (PUNCT.has(ch)) {
      if (ch === '(' || ch === '[' || ch === '{') bracketDepth++
      if (ch === ')' || ch === ']' || ch === '}') bracketDepth = Math.max(0, bracketDepth - 1)
      push('punct', advance(), tokLine, tokColumn)
      continue
    }
    throw new DslError('UNEXPECTED_TOKEN', `unexpected character ${JSON.stringify(ch)}.`, tokLine, tokColumn)
  }
}
