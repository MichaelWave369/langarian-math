import { createHash } from 'node:crypto'
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const webRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const repoRoot = resolve(webRoot, '..')
const outputRoot = resolve(process.argv[2] ?? join(repoRoot, 'dist-evidence-custody'))

const sourcePaths = [
  'examples/conformance/langarian-contract-conformance.partial.json',
  'schemas/contract-conformance-suite.schema.json',
  'schemas/evidence-custody-bundle.schema.json',
  'docs/CONTRACT_CONFORMANCE_PHASE.md',
  'docs/EVIDENCE_CUSTODY_PHASE.md',
]

function sha256(bytes) {
  return `sha256:${createHash('sha256').update(bytes).digest('hex')}`
}

await mkdir(outputRoot, { recursive: true })

const subjects = []
for (const path of sourcePaths.sort()) {
  const source = join(repoRoot, path)
  const target = join(outputRoot, path)
  await mkdir(dirname(target), { recursive: true })
  const bytes = await readFile(source)
  await copyFile(source, target)
  subjects.push({
    path,
    digest: sha256(bytes),
    size_bytes: bytes.byteLength,
  })
}

const manifest = {
  schema_version: 'ci-evidence-custody-manifest:v0.1',
  repository: process.env.GITHUB_REPOSITORY ?? 'MichaelWave369/langarian-math',
  commit_sha: process.env.GITHUB_SHA ?? 'LOCAL_BUILD',
  git_ref: process.env.GITHUB_REF ?? 'LOCAL_BUILD',
  workflow: process.env.GITHUB_WORKFLOW ?? 'local',
  workflow_run_id: process.env.GITHUB_RUN_ID ?? 'local',
  workflow_run_attempt: process.env.GITHUB_RUN_ATTEMPT ?? 'local',
  generated_at_utc: new Date().toISOString(),
  subjects,
  claim_boundary: [
    'The manifest records byte-level hashes and build context.',
    'The GitHub attestation binds the archive to workflow identity and artifact digest.',
    'Neither the manifest nor attestation proves mathematical or empirical truth.',
  ],
}

const manifestPath = join(outputRoot, 'ci-evidence-custody-manifest.json')
await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8')

const relativeOutput = relative(repoRoot, outputRoot) || '.'
console.log(`Built evidence custody directory: ${relativeOutput}`)
console.log(`Manifest: ${relative(repoRoot, manifestPath)}`)
console.log(`Subjects: ${subjects.length}`)
