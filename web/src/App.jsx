const operators = [
  ['Harmonic Sum', 'z = Σ zᵢ', 'Combine finite complex states with receipts.'],
  ['Phase Shift', "z' = z e^{iθ}", 'Pure rotation preserves resonance.'],
  ['Attenuated Shift', "z' = αz e^{iθ}", 'Decrease requires declared cost.'],
  ['Phi Scale', "z' = Φⁿz", 'Golden-ratio scaling, receipt tracked.'],
  ['Bridge', 'B(x, y)', 'Typed transition candidate, not proof magic.'],
]

const tags = ['FORMAL', 'COMPUTED', 'MODEL', 'INTERPRETIVE', 'METAPHOR', 'OBSERVED', 'FAILED']

function App() {
  return (
    <main className="shell">
      <section className="hero">
        <p className="eyebrow">Public Python reference repo · v0.2 FKC trunk · v0.2.1 epistemic receipt patch</p>
        <h1>Langarian Math</h1>
        <h2>Claim-Safe Formal Kernel Candidate</h2>
        <p className="lede">
          A finite-dimensional symbolic computation kernel for resonance-style state transformations,
          invariant checks, epistemic tags, and traceable receipts.
        </p>
        <div className="heroActions">
          <a href="https://github.com/MichaelWave369/langarian-math">GitHub Repo</a>
          <a href="https://github.com/MichaelWave369/langarian-math/blob/main/docs/RECEIPT_SCHEMA.md">Receipt Schema</a>
        </div>
      </section>

      <section className="grid two">
        <article className="card formula">
          <span className="number">01</span>
          <h3>Formal Kernel</h3>
          <code>z = a + bi ∈ ℂⁿ</code>
          <code>R(z) = ||z||</code>
          <code>φ = arg(Σ zᵢ)</code>
          <code>C(x,y) = |&lt;x,y&gt;|² / (||x||² ||y||²)</code>
          <p>Finite-dimensional by design. Deeper math later, once receipts justify promotion.</p>
        </article>

        <article className="card glow">
          <span className="number">02</span>
          <h3>Ledger / Validator Discipline</h3>
          <ul>
            <li>Input hashes + output hash</li>
            <li>Invariant checks</li>
            <li>PASS / WARN / FAIL</li>
            <li>Coherence before / after</li>
            <li>Declared cost when change decreases</li>
          </ul>
        </article>
      </section>

      <section className="card">
        <span className="number">03</span>
        <h3>Core Operators</h3>
        <div className="operators">
          {operators.map(([name, math, note]) => (
            <div className="op" key={name}>
              <strong>{name}</strong>
              <code>{math}</code>
              <p>{note}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="grid two">
        <article className="card">
          <span className="number">04</span>
          <h3>Epistemic Tags</h3>
          <div className="tags">
            {tags.map((tag) => <span key={tag} className={`tag ${tag.toLowerCase()}`}>{tag}</span>)}
          </div>
          <p className="rule">Interpretive claims cannot be used as proof.</p>
        </article>

        <article className="card">
          <span className="number">05</span>
          <h3>Proof Gate</h3>
          <p>The Proof Gate blocks MODEL, INTERPRETIVE, METAPHOR, OBSERVED, and FAILED claims from formal proof contexts.</p>
          <pre>{`require_proof_eligible(claims)\n# PASS or ProofGateError`}</pre>
        </article>
      </section>

      <section className="card repo">
        <span className="number">06</span>
        <h3>Public Repo Snapshot</h3>
        <pre>{`langarian-math/\n├─ src/langarian/\n├─ examples/\n├─ tests/\n├─ docs/\n├─ web/\n├─ .github/workflows/\n├─ README.md\n├─ LICENSE\n└─ pyproject.toml`}</pre>
        <p>MIT licensed · pytest workflow · GitHub Pages scaffold · Kimi harvest quarantined</p>
      </section>
    </main>
  )
}

export default App
