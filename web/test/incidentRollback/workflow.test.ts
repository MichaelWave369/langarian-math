import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('governed rollback materialization workflow', () => {
  const workflow = readFileSync(resolve('../.github/workflows/materialize-governed-rollback.yml'), 'utf8')

  it('runs from trusted base code behind an incident-response environment', () => {
    expect(workflow).toContain('ref: ${{ inputs.base_ref }}')
    expect(workflow).toContain('environment: rollback-incident-response')
    expect(workflow).toContain('materialize-governed-rollback.mjs')
    expect(workflow).toContain('controlled-repository-writer.mjs plan')
  })

  it('opens a record PR and never applies the package directly', () => {
    expect(workflow).toContain('BRANCH="governed-rollback/')
    expect(workflow).toContain('gh pr create')
    expect(workflow).not.toContain('git push origin HEAD:main')
    expect(workflow).not.toContain('cp /tmp/rollback/output/package-release-archive.json "${{ inputs.target_manifest_path }}"')
  })

  it('attests the materialization bundle and hands off to the existing writer', () => {
    expect(workflow).toContain('actions/attest-build-provenance@v3')
    expect(workflow).toContain('controlled_writer_inputs')
    expect(workflow).toContain('expected_release_receipt_id')
  })
})
