import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const workflow = readFileSync(resolve('../.github/workflows/reconcile-controlled-release.yml'), 'utf8')
const policy = readFileSync(resolve('../.parallax/repository-reconciliation-policy.json'), 'utf8')
const phase = readFileSync(resolve('../docs/MERGE_RECONCILIATION_PHASE.md'), 'utf8')

describe('merge reconciliation workflow constitution', () => {
  it('runs trusted main code and only auto-observes controlled application merges', () => {
    expect(workflow).toContain('pull_request_target:')
    expect(workflow).toContain("startsWith(github.event.pull_request.head.ref, 'controlled-release/')")
    expect(workflow).toContain('ref: main')
    expect(workflow).toContain('Check out trusted reconciliation code')
    expect(workflow).not.toContain('ref: ${{ inputs.request_ref }}')
  })

  it('verifies application provenance and replays the signed release chain', () => {
    expect(workflow).toContain('gh attestation verify')
    expect(workflow).toContain('controlled-repository-writer.mjs plan')
    expect(workflow).toContain('cmp /tmp/reconcile/reverified-plan.canonical /tmp/reconcile/attested-plan.canonical')
    expect(workflow).toContain('merge_tree_matches_head:true')
  })

  it('records reconciliation through a separate pull request rather than direct main mutation', () => {
    expect(workflow).toContain('BRANCH="release-reconciliation/')
    expect(workflow).toContain('gh pr create')
    expect(workflow).toContain('--base main')
    expect(workflow).not.toContain('git push origin main')
    expect(workflow).not.toContain('git push --force')
  })

  it('keeps the rollback anchor non-authoritative and the public tree private-research-free', () => {
    expect(phase).toContain('A rollback anchor is a coordinate, not authority.')
    expect(policy).toContain('record_via_pull_request')
    const publicText = `${workflow}\n${policy}\n${phase}`.toLowerCase()
    expect(publicText).not.toContain('saasy')
  })
})
