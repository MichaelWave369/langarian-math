/**
 * Workbench session context: the single source of UI state for all modules.
 *
 * Holds the WorkbenchSession (DSL executor + receipt ledger), the session
 * state table, the current Result Inspector payload, navigation, and the
 * technical/plain explanation toggle. The ledger mutates inside the session
 * object, so every mutation is paired with a tick bump to re-render.
 */

import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react'
import { WorkbenchSession } from '../engine.js'
import { MAX_STATES } from '../kernel/limits.js'
import { stripIngest } from './util/sanitize.js'

export const MODULES = [
  { id: 'state', label: 'State Builder', icon: 'z' },
  { id: 'operators', label: 'Operator Lab', icon: 'ƒ' },
  { id: 'program', label: 'Program Builder', icon: 'λ' },
  { id: 'result', label: 'Result Inspector', icon: '◫' },
  { id: 'ledger', label: 'Receipt Ledger', icon: '≣' },
  { id: 'gate', label: 'Proof Gate', icon: '⊢' },
  { id: 'viz', label: 'Visualizations', icon: '∿' },
  { id: 'examples', label: 'Example Library', icon: '❖' },
]

const WorkbenchContext = createContext(null)

let stateCounter = 0

export function WorkbenchProvider({ children }) {
  const sessionRef = useRef(null)
  if (sessionRef.current === null) sessionRef.current = new WorkbenchSession()

  const [module, setModule] = useState('state')
  const [states, setStates] = useState([])
  const [ledgerTick, setLedgerTick] = useState(0)
  const [inspection, setInspection] = useState(null)
  const [plainLanguage, setPlainLanguage] = useState(false)
  const [notice, setNotice] = useState(null)

  const bumpLedger = useCallback(() => setLedgerTick((tick) => tick + 1), [])

  const addStates = useCallback((items) => {
    setStates((current) => {
      const room = MAX_STATES - current.length
      const accepted = items.slice(0, Math.max(0, room)).map((item) => ({
        key: `${item.state.stateHash()}:${stateCounter++}`,
        state: item.state,
        origin: item.origin ?? 'builder',
        note: item.note ?? '',
      }))
      if (items.length > accepted.length) {
        setNotice(
          `Session state table holds at most MAX_STATES=${MAX_STATES} entries; ` +
            `${items.length - accepted.length} state(s) were not added.`,
        )
      }
      return [...current, ...accepted]
    })
  }, [])

  const removeState = useCallback((key) => {
    setStates((current) => current.filter((entry) => entry.key !== key))
  }, [])

  /** Record a kernel operation result into the ledger, states, and inspector. */
  const recordOperation = useCallback(
    (payload) => {
      const producedHash = payload.output ? payload.output.stateHash() : undefined
      sessionRef.current.ledger.add(
        payload.receipt,
        producedHash !== undefined ? { producedStateHash: producedHash } : {},
      )
      if (payload.output) {
        addStates([{ state: payload.output, origin: 'operator', note: payload.op }])
      }
      bumpLedger()
      setInspection({ kind: 'operation', ...payload })
    },
    [addStates, bumpLedger],
  )

  /** Run DSL text through the session and register produced states. */
  const runProgramText = useCallback(
    (source, options = {}) => {
      const run = sessionRef.current.runText(stripIngest(source), options)
      const produced = run.execution.steps
        .filter((step) => step.state !== null)
        .map((step) => ({ state: step.state, origin: 'program', note: step.id ?? step.op }))
      addStates(produced)
      bumpLedger()
      const lastReceiptStep = [...run.execution.steps].reverse().find((step) => step.receipt !== null)
      if (lastReceiptStep) {
        setInspection({
          kind: 'operation',
          op: lastReceiptStep.op,
          output: lastReceiptStep.state,
          receipt: lastReceiptStep.receipt,
          inputs: [],
          stepId: lastReceiptStep.id,
        })
      }
      return run
    },
    [addStates, bumpLedger],
  )

  /** Run a JSON program document through the session and register produced states. */
  const runProgramJson = useCallback(
    (json, options = {}) => {
      const run = sessionRef.current.runJson(stripIngest(json), options)
      const produced = run.execution.steps
        .filter((step) => step.state !== null)
        .map((step) => ({ state: step.state, origin: 'program', note: step.id ?? step.op }))
      addStates(produced)
      bumpLedger()
      return run
    },
    [addStates, bumpLedger],
  )

  /** Show a payload in the Result Inspector and navigate to it. */
  const inspect = useCallback((payload, navigate = true) => {
    setInspection(payload)
    if (navigate) setModule('result')
  }, [])

  const resetSession = useCallback(() => {
    sessionRef.current = new WorkbenchSession()
    setStates([])
    setInspection(null)
    bumpLedger()
    setNotice('Session reset: states, ledger, and inspector cleared.')
  }, [bumpLedger])

  const value = useMemo(
    () => ({
      session: sessionRef.current,
      module,
      setModule,
      states,
      addStates,
      removeState,
      ledgerTick,
      bumpLedger,
      inspection,
      inspect,
      recordOperation,
      runProgramText,
      runProgramJson,
      resetSession,
      plainLanguage,
      setPlainLanguage,
      notice,
      setNotice,
    }),
    [module, states, ledgerTick, inspection, plainLanguage, notice, addStates, removeState, inspect, recordOperation, runProgramText, runProgramJson, resetSession, bumpLedger],
  )

  return <WorkbenchContext.Provider value={value}>{children}</WorkbenchContext.Provider>
}

export function useWorkbench() {
  const ctx = useContext(WorkbenchContext)
  if (ctx === null) throw new Error('useWorkbench must be used inside WorkbenchProvider')
  return ctx
}
