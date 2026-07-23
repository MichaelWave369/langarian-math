/**
 * langarian-dsl:v0.3 — safe hand-written DSL front end.
 *
 * No eval, no new Function, no dynamic import of user strings. The text and
 * JSON program forms compile to the same typed AST and execute the five
 * stable kernel operators only.
 */

export * from './errors.js'
export * from './ast.js'
export * from './registry.js'
export * from './lexer.js'
export * from './parser.js'
export * from './jsonProgram.js'
export * from './executor.js'
