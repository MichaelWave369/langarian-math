import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

import { validateConformanceSuite, type ContractConformanceSuite } from '../../src/theory/conformance.js'
import { BUNDLED_THEORY_PACKAGES } from '../../src/theory/packages.js'

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
const specimenPath = join(repoRoot, 'examples', 'conformance', 'langarian-contract-conformance.partial.json')
const langarian = BUNDLED_THEORY_PACKAGES.find((item) => item.theory.id === 'langarian-finite-complex')!

describe('public conformance specimen', () => {
  it('parses and validates against the active Langarian package', () => {
    const specimen = JSON.parse(readFileSync(specimenPath, 'utf8')) as ContractConformanceSuite
    const result = validateConformanceSuite(langarian, specimen)
    expect(result.issues).toEqual([])
    expect(result.ok).toBe(true)
  })

  it('contains no private research identifiers', () => {
    const text = readFileSync(specimenPath, 'utf8').toLowerCase()
    expect(text).not.toContain('saasy')
    expect(text).not.toContain('reduced-hamiltonian')
  })
})
