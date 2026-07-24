import { sha256EvidenceDigest } from './custody.js'
import type { TheoryPackage } from './packages.js'
import {
  verifyPackageReleaseArchive,
  type PackageReleaseArchive,
  type ReleaseArchiveVerification,
} from './releaseArchive.js'

export const REPOSITORY_WRITER_POLICY_SCHEMA_VERSION = 'repository-writer-policy:v0.1' as const
export const REPOSITORY_WRITER_PLAN_SCHEMA_VERSION = 'repository-writer-plan:v0.1' as const
export const REPOSITORY_APPLICATION_RECEIPT_SCHEMA_VERSION = 'repository-application-receipt:v0.1' as const
export const REPOSITORY_REPLAY_LEDGER_SCHEMA_VERSION = 'repository-replay-ledger:v0.1' as const

export interface RepositoryWriterTarget {
  package_id: string
  path: string
  allowed_actions: Array<'PROMOTION' | 'ROLLBACK'>
}

export interface RepositoryWriterPolicy {
  schema_version: typeof REPOSITORY_WRITER_POLICY_SCHEMA_VERSION
  allowed_targets: RepositoryWriterTarget[]
  replay_ledger_path: string
  application_receipt_directory: string
  release_branch_prefix: string
  require_pull_request: boolean
  prohibit_direct_main_write: boolean
  metadata: Record<string, unknown>
}

export interface RepositoryWriterPreflight {
  package_id: string
  target_path: string | null
  live_manifest_hash: string
  archived_before_hash: string | null
  replay_key: string | null
  release_receipt_id: string | null
  archive_verification: ReleaseArchiveVerification | null
  blockers: string[]
  warnings: string[]
  status: 'NOT_EVALUATED' | 'READY_FOR_CONTROLLED_WORKFLOW' | 'BLOCKED'
}

export const PUBLIC_REPOSITORY_WRITER_POLICY: RepositoryWriterPolicy = {
  schema_version: REPOSITORY_WRITER_POLICY_SCHEMA_VERSION,
  allowed_targets: [
    {
      package_id: 'langarian-finite-complex',
      path: 'examples/theory-packages/langarian-finite-complex.json',
      allowed_actions: ['PROMOTION', 'ROLLBACK'],
    },
    {
      package_id: 'generic-provenance-workflow',
      path: 'examples/theory-packages/generic-provenance-workflow.json',
      allowed_actions: ['PROMOTION', 'ROLLBACK'],
    },
  ],
  replay_ledger_path: '.parallax/release-replay-ledger.json',
  application_receipt_directory: 'artifacts/repository-applications',
  release_branch_prefix: 'controlled-release/',
  require_pull_request: true,
  prohibit_direct_main_write: true,
  metadata: {
    boundary: 'The browser performs preflight only. GitHub Actions may create a review branch and pull request, never a direct main-branch write.',
  },
}

export async function buildRepositoryWriterPreflight(
  liveManifest: TheoryPackage,
  archive: PackageReleaseArchive | null,
  consumedReplayKeys: string[] = [],
  now = new Date().toISOString(),
  policy = PUBLIC_REPOSITORY_WRITER_POLICY,
): Promise<RepositoryWriterPreflight> {
  const target = policy.allowed_targets.find((item) => item.package_id === liveManifest.theory.id) ?? null
  const liveHash = await sha256EvidenceDigest(liveManifest)
  const warnings = [
    'Browser preflight cannot create branches, consume the repository replay ledger, or attest a commit.',
    'Declared review-branch status does not mean a pull request was merged.',
    'Repository application does not prove mathematical or empirical truth.',
  ]
  if (!archive) {
    return {
      package_id: liveManifest.theory.id,
      target_path: target?.path ?? null,
      live_manifest_hash: liveHash,
      archived_before_hash: null,
      replay_key: null,
      release_receipt_id: null,
      archive_verification: null,
      blockers: ['Import a public package-release archive to begin repository-writer preflight.'],
      warnings,
      status: 'NOT_EVALUATED',
    }
  }

  const verification = await verifyPackageReleaseArchive(archive, undefined, now)
  const receipt = archive.release_bundle.receipt
  const proposal = archive.release_bundle.proposal
  const blockers: string[] = []
  if (!target) blockers.push('Package id is not registered in the public repository-writer target policy.')
  if (!target?.allowed_actions.includes(proposal.action)) blockers.push(`Action ${proposal.action} is not registered for this target.`)
  if (!verification.accepted) blockers.push(...verification.issues.map((item) => `${item.code}: ${item.message}`))
  if (receipt.status !== 'AUTHORIZED_NOT_COMMITTED') blockers.push('Release receipt is not AUTHORIZED_NOT_COMMITTED.')
  if (receipt.repository_commit_status !== 'NOT_COMMITTED') blockers.push('Release receipt no longer represents an unapplied release artifact.')
  if (proposal.package_id !== liveManifest.theory.id) blockers.push('Archive package id does not match the selected live manifest.')
  if (proposal.before_manifest_hash !== liveHash) blockers.push('Live manifest hash does not match the archive before-manifest hash.')
  if (consumedReplayKeys.includes(receipt.integrity.replay_key)) blockers.push('Replay key is already present in the supplied repository ledger view.')

  return {
    package_id: liveManifest.theory.id,
    target_path: target?.path ?? null,
    live_manifest_hash: liveHash,
    archived_before_hash: proposal.before_manifest_hash,
    replay_key: receipt.integrity.replay_key,
    release_receipt_id: receipt.receipt_id,
    archive_verification: verification,
    blockers,
    warnings,
    status: blockers.length === 0 ? 'READY_FOR_CONTROLLED_WORKFLOW' : 'BLOCKED',
  }
}
