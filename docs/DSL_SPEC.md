# DSL Specification — `langarian-dsl:v0.3`

Normative specification per SPEC §5. **Status at HEAD 5dedaf1: implemented**
in `web/src/dsl/` (TypeScript lexer/parser, JSON program form, SSA/DAG
executor with step/token/depth caps and structured errors), covered by the
`web/test/dsl/` suites (parser, JSON program, executor tests). No DSL
parser/executor exists in the Python kernel; this document remains the
contract any Python executor must satisfy.

The DSL compiles text syntax to the same AST as the JSON program form. Both
forms execute the five stable kernel operators only; the DSL cannot express
anything outside the kernel's stable surface.

## 1. Example

```text
A = state([[3,0],[6,0],[9,0]], label="A")
B = phase_shift(A, pi/3)
C = phi_scale(B, 2)
D = attenuated_phase_shift(C, pi/9, 0.75, cost="declared attenuation")
bridge(A, D, cost=0)
```

## 2. Grammar

- **Statements:** `assignment | expression-statement`, one per line.
  - `assignment`: `IDENT = call`
  - `expression-statement`: `call` (result is emitted as a program step without
    a binding).
- **Identifiers:** `[A-Za-z_][A-Za-z0-9_]*`. Single-assignment (SSA): an
  identifier may be bound exactly once.
- **Numeric expressions:** decimal literals, the constant `pi`, and binary
  operators `+ - * /` with usual precedence (`*`/`/` bind tighter than
  `+`/`-`), plus parentheses. Numeric expressions are **constant-folded at
  parse time**; they may not reference identifiers.
- **Complex pair literal:** `[re, im]` where `re`, `im` are numeric
  expressions.
- **Vector literal:** `[[re, im], ...]` — a non-empty list of complex pairs.
- **Calls:** only from the registry below; positional arguments per the kernel
  signatures plus named arguments.
- **Named args:** `label="..."`, `glyph="..."`, `cost=...`, `metadata={...}`
  where applicable per operator.
- **Comments/whitespace:** implementation-defined but must not change
  semantics; recommended `#` line comments.

### Operator registry (closed)

| Name | Positional args | Named args | Kernel function |
|---|---|---|---|
| `state` | vector literal | `label`, `glyph`, `metadata` | `ResonantState.from_pairs` |
| `harmonic_sum` | `a, b` | `label`, `glyph` | `operators.harmonic_sum` |
| `phase_shift` | `state, angle` | `label` | `operators.phase_shift` |
| `attenuated_phase_shift` | `state, angle, attenuation` | `cost` (required when attenuation < 1 in practice — I3), `label` | `operators.attenuated_phase_shift` |
| `phi_scale` | `state, n` | `label` | `operators.phi_scale` |
| `bridge` | `source, target` | `cost`, `label` | `operators.bridge` |

No other callable names are valid. The registry is an allowlist; unknown names
are parse errors, never dynamic lookups.

## 3. Semantics

- Each call is one **program step** producing per-step states plus an
  `OperationReceipt` (schema: `docs/RECEIPT_SCHEMA_vNEXT.md`) and any
  warnings. Steps execute in topological order; SSA + no cycles make the
  dependency graph a DAG by construction.
- Values are kernel states; numbers are IEEE-754 doubles exactly as in the
  kernel.
- `cost` on `bridge`/`attenuated_phase_shift` is a **caller-declared,
  unverified annotation**. It is not computed, checked for adequacy, or
  related to any metric. Any UI rendering a DSL program must say so
  (SPEC §5).
- All kernel limits and typed errors apply at execution (`MAX_DIM=64`,
  finite-parameter checks, `|n| ≤ 64` for `phi_scale`, metadata caps, etc.).
  A step that raises a typed kernel error produces a FAILED receipt where the
  kernel supports that path, or a structured step error — never an unhandled
  traceback.

## 4. Errors

Parse/validation errors are structured:

```json
{"line": 3, "column": 14, "code": "UNKNOWN_OPERATOR", "message": "..."}
```

Required error codes (minimum set): unexpected token, unterminated literal,
unknown identifier, unknown operator, duplicate binding (SSA violation),
arity mismatch, invalid named argument, non-constant numeric expression,
limit exceeded (`MAX_DSL_TOKENS=4096`, `MAX_AST_DEPTH=32`,
`MAX_PROGRAM_STEPS=64`).

## 5. JSON program form

Equivalent AST serialization:

```json
{
  "dsl_version": "langarian-dsl:v0.3",
  "limits": {"max_steps": 64, "max_dim": 64},
  "steps": [
    {"id": "A", "op": "state", "vector": [[3, 0], [6, 0], [9, 0]], "label": "A"},
    {"id": "B", "op": "phase_shift", "args": ["A", 1.0471975511965976]},
    {"id": "C", "op": "phi_scale", "args": ["B", 2]}
  ]
}
```

- Same registry, same validation, same receipts as the text form.
- `dsl_version` must be `langarian-dsl:v0.3`; unknown versions are rejected
  (no silent downgrade), mirroring the receipt version allowlist policy.
- Import handling (TS side, SPEC §4): reject `__proto__`, `constructor`,
  `prototype` keys; enforce depth/size caps before parsing; no `eval`, no
  `new Function`, no dynamic import of user strings.

## 6. Resource limits

| Limit | Value | Enforcement point |
|---|---|---|
| `MAX_PROGRAM_STEPS` | 64 | Executor step budget (explicit counter) |
| `MAX_DSL_TOKENS` | 4096 | Lexer |
| `MAX_AST_DEPTH` | 32 | Parser (before evaluation) |
| `MAX_DIM` | 64 | Kernel state construction |
| `MAX_LABEL_CHARS` / `MAX_GLYPH_CHARS` | 120 / 16 | Kernel state construction |
| `MAX_METADATA_BYTES` | 4096 | Kernel metadata validation |

Exceeding any limit is a typed error or FAILED receipt, never a traceback.

## 7. Non-goals for v0.3

- No user-defined functions, loops, conditionals, or variables beyond SSA
  bindings.
- No operator extensibility from DSL text (registry is closed).
- No proof-gate semantics inside the DSL; receipts feed the Proof Gate
  separately.
