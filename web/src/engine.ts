/**
 * Langarian Math Workbench v0.3 — DSL + receipt ledger engine facade.
 *
 * Orchestrates the DSL front end (text/JSON program -> typed AST ->
 * topological SSA execution over the kernel) and the session receipt
 * ledger. Every executed step that emits a receipt is recorded in the
 * session ledger with the produced state hash (ledger falls back to the
 * receipt output_hash per the documented deviation). state() steps emit a
 * state but no receipt, so they add nothing to the ledger.
 *
 * This module performs no UI work and never bypasses kernel validation:
 * attenuation < 1 without a declared cost surfaces as a FAIL receipt from
 * the kernel's I3 invariant, and ledger verification always reports the
 * four validation levels distinctly.
 */

import type { ProgramAst } from './dsl/ast.js'
import { executeProgram, type ExecuteOptions, type ExecutionResult } from './dsl/executor.js'
import { DEFAULT_PROGRAM_LIMITS, parseJsonProgram, type JsonProgram } from './dsl/jsonProgram.js'
import { parseDsl } from './dsl/parser.js'
import { ReceiptLedger } from './ledger/ledger.js'

export * from './dsl/index.js'
export * from './ledger/index.js'

export interface SessionRun {
  /** Parsed program (AST plus effective limits for the JSON form). */
  program: JsonProgram
  execution: ExecutionResult
  /** Ledger seqs of receipts recorded by this run, in execution order. */
  ledgerSeqs: number[]
}

export class WorkbenchSession {
  readonly ledger = new ReceiptLedger()

  /** Parse DSL text, execute it, and record emitted receipts in the ledger. */
  runText(source: string, options: ExecuteOptions = {}): SessionRun {
    const ast = parseDsl(source)
    return this.runAst(ast, options)
  }

  /** Parse a JSON program document, execute it, and record receipts. */
  runJson(json: string, options: ExecuteOptions = {}): SessionRun {
    const program = parseJsonProgram(json)
    const execution = executeProgram(program.ast, { ...options, limits: program.limits })
    return { program, execution, ledgerSeqs: this.record(execution) }
  }

  /** Execute an already-parsed AST and record receipts. */
  runAst(ast: ProgramAst, options: ExecuteOptions = {}): SessionRun {
    const execution = executeProgram(ast, options)
    // Text-form runs use the kernel default limits; JSON runs report their
    // parsed (possibly tightened) limits via runJson.
    const program: JsonProgram = { ast, limits: { ...DEFAULT_PROGRAM_LIMITS } }
    return { program, execution, ledgerSeqs: this.record(execution) }
  }

  private record(execution: ExecutionResult): number[] {
    const seqs: number[] = []
    for (const step of execution.steps) {
      if (step.receipt === null) continue
      const produced = step.state !== null ? step.state.stateHash() : undefined
      const entry = this.ledger.add(
        step.receipt,
        produced !== undefined ? { producedStateHash: produced } : {},
      )
      seqs.push(entry.seq)
    }
    return seqs
  }
}

/** Convenience one-shot: parse DSL text, execute, return a fresh session. */
export function runProgram(source: string, options: ExecuteOptions = {}): { session: WorkbenchSession; run: SessionRun } {
  const session = new WorkbenchSession()
  return { session, run: session.runText(source, options) }
}
