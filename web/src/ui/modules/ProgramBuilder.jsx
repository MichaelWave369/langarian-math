/**
 * Program Builder: DSL editor over langarian-dsl:v0.3.
 *
 * - default source is the SPEC §5 golden program;
 * - structured line/column errors from the parser, never tracebacks;
 * - AST and canonical JSON-program views;
 * - execution via WorkbenchSession with per-step list, warnings, and budget
 *   counters (steps vs limits);
 * - export/import of the JSON program form.
 */

import { useMemo, useState } from 'react'
import { parseDsl } from '../../dsl/parser.js'
import { exportProgramJson } from '../../dsl/jsonProgram.js'
import { DslError } from '../../dsl/errors.js'
import { MAX_PROGRAM_STEPS } from '../../kernel/limits.js'
import { StatusBadge } from '../components/Badges.jsx'
import { GOLDEN_PROGRAM } from '../data/examples.js'
import { downloadText } from '../util/format.js'
import { sanitizeFilename, stripIngest } from '../util/sanitize.js'
import { useWorkbench } from '../WorkbenchContext.jsx'

function errorToLines(exc, ast) {
  if (exc instanceof DslError) {
    return [{ line: exc.line, column: exc.column, code: exc.code, message: exc.message }]
  }
  return [{ line: 0, column: 0, code: exc.name ?? 'ERROR', message: exc.message ?? String(exc) }]
}

export default function ProgramBuilder() {
  const { runProgramText, runProgramJson, inspect, plainLanguage } = useWorkbench()
  const [source, setSource] = useState(GOLDEN_PROGRAM)
  const [view, setView] = useState('steps')
  const [run, setRun] = useState(null)
  const [errors, setErrors] = useState(null)
  const [importText, setImportText] = useState('')
  const [importNote, setImportNote] = useState(null)

  const parsed = useMemo(() => {
    try {
      return { ast: parseDsl(stripIngest(source)) }
    } catch (exc) {
      return { error: exc }
    }
  }, [source])

  const doRun = () => {
    try {
      const result = runProgramText(source)
      setRun(result)
      if (!result.execution.ok && result.execution.error) {
        const stepError = result.execution.error
        const statement = result.program.ast.statements[stepError.statementIndex]
        setErrors([{
          line: statement?.line ?? 0,
          column: statement?.column ?? 0,
          code: stepError.code,
          message: `step "${stepError.id ?? stepError.op}": ${stepError.message}`,
        }])
      } else {
        setErrors(null)
      }
    } catch (exc) {
      setRun(null)
      setErrors(errorToLines(exc))
    }
  }

  const doExport = () => {
    if (!parsed.ast) {
      setErrors(errorToLines(parsed.error))
      return
    }
    try {
      const json = exportProgramJson(parsed.ast)
      downloadText(`${sanitizeFilename('langarian-program')}.json`, json + '\n')
      setErrors(null)
    } catch (exc) {
      setErrors(errorToLines(exc))
    }
  }

  const doImportRun = () => {
    try {
      const result = runProgramJson(importText)
      setRun(result)
      setImportNote(
        `Imported JSON program: ${result.execution.steps.length} step(s) executed ` +
          `(limits maxSteps=${result.program.limits.maxSteps}, maxDim=${result.program.limits.maxDim}).`,
      )
      setErrors(null)
    } catch (exc) {
      setErrors(errorToLines(exc))
      setImportNote(null)
    }
  }

  const stepsUsed = run?.execution.steps.length ?? 0
  const limits = run?.program.limits ?? null

  return (
    <div className="two-col">
      <div>
        <section className="panel panel-formal" aria-labelledby="dsl-editor-heading">
          <h2 id="dsl-editor-heading">DSL editor <span className="dim-text">(langarian-dsl:v0.3)</span></h2>
          <p className="panel-sub">
            Grammar: assignment or expression statements; calls restricted to the five-operator registry plus
            state(). Numeric expressions are decimal literals, pi, and + − * /, constant-folded at parse time.
            No eval anywhere in the pipeline.
          </p>
          <textarea
            rows={10}
            className="code"
            value={source}
            onChange={(event) => setSource(event.target.value)}
            aria-label="DSL program source"
            spellCheck={false}
          />
          <div className="btn-row" style={{ marginTop: 8 }}>
            <button type="button" className="btn btn-primary" onClick={doRun}>Run program</button>
            <button type="button" className="btn" onClick={doExport} disabled={!parsed.ast}>Export JSON program</button>
            <button type="button" className="btn btn-ghost" onClick={() => setSource(GOLDEN_PROGRAM)}>Reset to golden example</button>
          </div>
          {errors !== null && (
            <div className="error-box" role="alert" aria-label="program errors">
              {errors.map((err, i) => (
                <div key={i}>
                  {err.line > 0 ? `line ${err.line}, column ${err.column}: ` : ''}[{err.code}] {err.message}
                </div>
              ))}
            </div>
          )}
          {parsed.error && errors === null && (
            <div className="error-box" role="alert">
              {errorToLines(parsed.error).map((err, i) => (
                <div key={i}>{err.line > 0 ? `line ${err.line}, column ${err.column}: ` : ''}[{err.code}] {err.message}</div>
              ))}
            </div>
          )}
        </section>

        <section className="panel panel-formal" aria-labelledby="import-heading">
          <h2 id="import-heading">Import JSON program</h2>
          <textarea
            rows={4}
            className="code"
            placeholder='{"dsl_version":"langarian-dsl:v0.3","limits":{...},"steps":[...]}'
            value={importText}
            onChange={(event) => setImportText(event.target.value)}
            aria-label="import a JSON program"
            spellCheck={false}
          />
          <div className="btn-row" style={{ marginTop: 8 }}>
            <button type="button" className="btn" onClick={doImportRun} disabled={importText.trim() === ''}>
              Validate &amp; run import
            </button>
          </div>
          {importNote !== null && <p className="dim-text" role="status">{importNote}</p>}
        </section>
      </div>

      <div>
        <section className="panel panel-formal" aria-labelledby="run-view-heading">
          <h2 id="run-view-heading">Run output</h2>
          <div className="btn-row" role="tablist" aria-label="run output view" style={{ marginBottom: 10 }}>
            {['steps', 'ast', 'json'].map((name) => (
              <button
                key={name}
                type="button"
                role="tab"
                aria-selected={view === name}
                className={`btn btn-small ${view === name ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => setView(name)}
              >
                {name === 'steps' ? 'Steps' : name === 'ast' ? 'AST view' : 'JSON view'}
              </button>
            ))}
          </div>

          <dl className="kv" aria-label="budget counters" style={{ marginBottom: 12 }}>
            <dt>statements (parsed)</dt><dd>{parsed.ast ? parsed.ast.statements.length : '—'}</dd>
            <dt>steps executed</dt><dd>{run ? `${stepsUsed} / ${limits?.maxSteps ?? MAX_PROGRAM_STEPS} (budget)` : '—'}</dd>
            <dt>dimension cap</dt><dd>{limits?.maxDim ?? 64}</dd>
            <dt>status</dt>
            <dd>{run ? (run.execution.ok ? 'completed' : 'halted on step error') : 'not run yet'}</dd>
          </dl>

          {view === 'steps' && (
            run === null ? (
              <p className="dim-text">Run the program to see per-step states, receipts, and warnings.</p>
            ) : (
              <>
                <ol className="step-list" aria-label="execution steps">
                  {run.execution.steps.map((step) => (
                    <li key={step.index} className="step-item">
                      <div className="btn-row">
                        <strong className="mono">#{step.index} {step.id ?? '(statement)'}</strong>
                        <span className="mono dim-text">{step.op}</span>
                        {step.receipt !== null
                          ? <StatusBadge status={step.receipt.status} />
                          : <span className="dim-text">no receipt (state() construction is not an operation)</span>}
                        {step.receipt !== null && (
                          <button
                            type="button"
                            className="btn btn-ghost btn-small"
                            onClick={() =>
                              inspect({
                                kind: 'operation',
                                op: step.op,
                                output: step.state,
                                inputs: [],
                                receipt: step.receipt,
                                stepId: step.id,
                              })
                            }
                          >
                            inspect →
                          </button>
                        )}
                      </div>
                      {step.state !== null && (
                        <div className="mono dim-text" style={{ fontSize: 12 }}>
                          dim {step.state.dim} · hash {step.state.stateHash()}
                        </div>
                      )}
                      {step.warnings.map((warning, i) => (
                        <div key={i} className="warn-text" role="status">⚠ {warning}</div>
                      ))}
                    </li>
                  ))}
                </ol>
                {run.execution.warnings.length > 0 && (
                  <div className="error-box" style={{ borderColor: 'var(--warn)', background: 'rgba(251,191,36,0.07)' }}>
                    {run.execution.warnings.map((warning, i) => <div key={i} className="warn-text">⚠ {warning}</div>)}
                  </div>
                )}
                {plainLanguage && (
                  <p className="panel-sub">
                    Each step either creates a state (no receipt — creation is not an operation) or applies an
                    operator (receipt with checks). Steps run in dependency order with a hard budget.
                  </p>
                )}
              </>
            )
          )}

          {view === 'ast' && (
            parsed.ast
              ? <pre className="json" aria-label="typed AST">{JSON.stringify(parsed.ast, null, 2)}</pre>
              : <p className="fail-text">Fix the parse errors to see the AST.</p>
          )}

          {view === 'json' && (
            parsed.ast
              ? <JsonView ast={parsed.ast} />
              : <p className="fail-text">Fix the parse errors to see the JSON program form.</p>
          )}
        </section>
      </div>
    </div>
  )
}

function JsonView({ ast }) {
  const text = useMemo(() => {
    try {
      return exportProgramJson(ast)
    } catch (exc) {
      return `export failed: ${exc.message}`
    }
  }, [ast])
  return <pre className="json" aria-label="canonical JSON program">{text}</pre>
}
