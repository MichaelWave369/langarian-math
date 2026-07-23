# DSL Specification — `langarian-dsl:v0.3`

Normative specification for the implemented TypeScript lexer, parser, JSON program form, and SSA/DAG executor in `web/src/dsl/`.

The DSL compiles text syntax to the same AST as the JSON program form. Both forms execute only the closed registry below; unknown names are parse errors and never dynamic lookups.

## 1. Foundation example

The default program deliberately uses an ordinary complex vector rather than a branded number sequence:

```text
A = state([[1,1],[3,-2],[0,-4]], label="A")
B = phase_shift(A, pi/7)
C = harmonic_sum(B, B)
D = attenuated_phase_shift(C, pi/11, 0.75, cost="declared edge-local attenuation")
bridge(A, D, cost=0, label="comparison edge only")
```

This is a deterministic demonstration fixture, not theoretical evidence that these particular coordinates or angles are privileged.

## 2. Grammar

- **Statements:** `assignment | expression-statement`, one per line.
  - `assignment`: `IDENT = call`
  - `expression-statement`: `call`
- **Identifiers:** `[A-Za-z_][A-Za-z0-9_]*`. Single-assignment (SSA): an identifier may be bound exactly once.
- **Numeric expressions:** decimal literals, the constant `pi`, and binary operators `+ - * /` with usual precedence, plus parentheses. Numeric expressions are constant-folded at parse time and may not reference identifiers.
- **Complex pair literal:** `[re, im]` where both values are numeric expressions.
- **Vector literal:** `[[re, im], ...]`, a non-empty list of complex pairs.
- **Calls:** only from the registry below; positional arguments follow kernel signatures.
- **Named args:** `label="..."`, `glyph="..."`, `cost=...`, and `metadata={...}` where allowed.
- **Comments/whitespace:** implementation-defined but must not change semantics; `#` comments are recommended.

### Operator registry (closed)

| Name | Positional args | Named args | Kernel function | Foundation status |
|---|---|---|---|---|
| `state` | vector literal | `label`, `glyph`, `metadata` | `ResonantState.from_pairs` | Core genesis construction |
| `harmonic_sum` | `a, b` | `label`, `glyph` | `operators.harmonic_sum` | Core implemented operator |
| `phase_shift` | `state, angle` | `label` | `operators.phase_shift` | Core implemented operator |
| `attenuated_phase_shift` | `state, angle, attenuation` | `cost`, `label` | `operators.attenuated_phase_shift` | Core implemented operator; permits amplification when factor > 1 |
| `phi_scale` | `state, n` | `label` | `operators.phi_scale` | Implemented symbolic compatibility extension; **non-foundational** |
| `bridge` | `source, target` | `cost`, `label` | `operators.bridge` | Implemented relation/transition candidate; semantics remain under audit |

No other callable names are valid.

`phi_scale` is not generic scalar multiplication. It applies `phi^n` and a reflex golden-angle phase convention. Its presence in the implementation does not make the golden ratio a law of the native Langarian foundation.

## 3. Execution semantics

- Calls execute in topological order. SSA plus no cycles makes the dependency graph a DAG by construction.
- Operator calls produce per-step values, an `OperationReceipt`, and warnings.
- `state()` constructs a root value but emits no operation receipt in v0.3. The interface must describe this as an open genesis-custody boundary, not as complete lineage.
- Values are kernel states; numbers are IEEE-754 doubles.
- All kernel limits and typed errors apply at execution (`MAX_DIM=64`, finite-parameter checks, `|n| <= 64` for `phi_scale`, metadata caps, and other declared limits).
- A step that raises a typed kernel error produces a failed outcome or structured step error, never an unhandled traceback.

## 4. Input-generality and fixture governance

The native foundation is stated for arbitrary admissible states:

```text
x in C^n, 1 <= n <= 64
```

No theorem or invariant may be inferred from a preferred demonstration sequence alone.

Required test classes include:

- ordinary real vectors;
- signed vectors;
- complex vectors;
- zero-containing vectors;
- the entire zero vector where defined;
- repeated or degenerate vectors;
- random vectors;
- extreme finite magnitudes;
- adversarial dimensions and parameters.

The historical `(3,6,9)` fixture and Phi/golden-angle demonstrations may remain visible only when clearly labeled non-foundational.

## 5. Cost semantics

### Attenuated phase shift

`cost` is a caller-declared, unverified annotation. The implementation does not compute its adequacy or magnitude.

### Bridge

`bridge(..., cost=k)` records a caller-declared **edge-local** annotation:

```text
c_edge(source, target) = k
```

It does not compute or assert accumulated path cost:

```text
c_path(source -> ... -> target)
```

Therefore `bridge(A, D, cost=0)` means only that the newly declared bridge edge adds zero declared cost. It must not be interpreted as saying that the historical transformation path from `A` to `D` had zero cost.

## 6. Bridge boundary

The current command records a typed source/target relation with coherence and a declared edge cost. It does not establish:

- category-theoretic naturality;
- state equality;
- path equivalence;
- provenance completeness;
- zero accumulated cost;
- a unique parent chain.

Recovery work must determine whether future APIs should split `bridge` into separate comparison, provenance-link, declared-correspondence, and transformation concepts.

## 7. Errors

Parse and validation errors are structured:

```json
{"line": 3, "column": 14, "code": "UNKNOWN_OPERATOR", "message": "..."}
```

Required error classes include unexpected token, unterminated literal, unknown identifier, unknown operator, duplicate binding, arity mismatch, invalid named argument, non-constant numeric expression, and limit exceeded.

Resource limits:

| Limit | Value | Enforcement point |
|---|---:|---|
| `MAX_PROGRAM_STEPS` | 64 | Executor step budget |
| `MAX_DSL_TOKENS` | 4096 | Lexer |
| `MAX_AST_DEPTH` | 32 | Parser |
| `MAX_DIM` | 64 | Kernel state construction |
| `MAX_LABEL_CHARS` | 120 | State construction |
| `MAX_GLYPH_CHARS` | 16 | State construction |
| `MAX_METADATA_BYTES` | 4096 | Metadata validation |

Exceeding a limit is a typed error or failed receipt, never a traceback.

## 8. JSON program form

Equivalent AST serialization:

```json
{
  "dsl_version": "langarian-dsl:v0.3",
  "limits": {"max_steps": 64, "max_dim": 64},
  "steps": [
    {"id": "A", "op": "state", "vector": [[1, 1], [3, -2], [0, -4]], "label": "A"},
    {"id": "B", "op": "phase_shift", "args": ["A", 0.4487989505128276]},
    {"id": "C", "op": "harmonic_sum", "args": ["B", "B"]}
  ]
}
```

- Same registry, validation, receipts, and claim boundaries as the text form.
- `dsl_version` must be `langarian-dsl:v0.3`; unknown versions are rejected with no silent downgrade.
- Import handling rejects `__proto__`, `constructor`, and `prototype` keys, enforces depth and size caps before parsing, and uses no `eval`, `new Function`, or dynamic import of user strings.

## 9. Claim boundary

A theorem from ordinary complex linear algebra and a software conformance check are different artifacts.

For example, the general identity

```text
||exp(i theta) x|| = ||x||
```

supplies expected behavior. A successful `phase_shift` run checks that this implementation instance conforms within its declared numerical policy. The run does not prove the theorem.

Likewise, a receipt proves only that a particular recorded computation, check, and status were emitted under declared versions. It is not empirical evidence that the model describes nature.

## 10. Non-goals for v0.3

- No user-defined functions, loops, conditionals, or mutable variables.
- No operator extensibility from DSL text.
- No claim that Phi, Fibonacci, shells, spirals, or 3-6-9 are foundational mathematics.
- No proof-gate semantics inside the DSL; receipts feed the Formal Eligibility Gate separately.
- No genesis receipt yet for `state()`.
- No computed path-cost algebra.
- No completed formal semantics for `bridge`.
