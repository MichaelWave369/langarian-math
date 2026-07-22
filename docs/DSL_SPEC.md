# Langarian Expression Language (DSL) Specification v0.3

**DSL version:** `dsl:v0.3.0`  
**Status:** Foundation (parser + executor implemented)  
**Maxim:** Parser-based, typed, deterministic, resource-bounded, no arbitrary code execution.

## Design Goals

1. Compile a small, readable calculation into a `Program` instance.
2. Every state-changing step produces a receipt.
3. Same internal model whether the user writes text or structured JSON/YAML.
4. Line-specific, helpful errors.
5. Hard resource limits (dimension, step count, nesting).
6. Versioned syntax so future extensions do not break existing programs.

## Two Equivalent Representations

### A. Structured (JSON / YAML)
Directly maps to `Program.to_dict()`. Preferred for machine interchange and saved programs.

### B. Text Syntax (human-friendly)
A deliberately small grammar that the parser lowers into the same `Program` model.

## Text Grammar (v0.3.0)

```
program        := statement*
statement      := state_decl | assignment | bridge_stmt | comment
state_decl     := "state" IDENT "=" vector_lit ["glyph" STRING] ["label" STRING]
assignment     := IDENT "=" operator_call
operator_call  := op_name "(" arg_list ")"
op_name        := "phase_shift" | "attenuated_phase_shift" | "phi_scale" | "harmonic_sum" | "bridge"
arg_list       := expr ("," expr)*
expr           := IDENT | number | STRING | vector_lit
vector_lit     := "[" complex ("," complex)* "]"
complex        := number ["+" | "-"] number "i" | number "i" | number
comment        := "#" ...
```

Supported operators and required parameters match the Python kernel exactly.

### Example

```
# basic 3-6-9 harmonic demonstration
state A = [3+0i, 6+0i, 9+0i] label "seed369"
B = phase_shift(A, 1.0471975511965976)          # π/3
C = phi_scale(B, 2)
D = attenuated_phase_shift(C, 0.3490658503988659, 0.75, "declared attenuation")
bridge(A, D)
```

## Typed AST Rules

- Every identifier that is used must be previously defined (state or prior step).
- Operator argument counts and types are checked statically by the parser.
- `attenuated_phase_shift` requires a cost string when attenuation ≠ 1.
- Vector literals are parsed into lists of (real, imag) pairs; dimension is taken from length.
- No function calls other than the registered operator set.
- No attribute access, no imports, no Python expressions, no `eval`/`exec`.

## Resource Bounds (enforced by parser + executor)

| Resource              | Limit (v0.3) |
|-----------------------|--------------|
| Maximum dimension     | 256          |
| Maximum steps         | 128          |
| Maximum program size  | 64 KiB text  |
| Nesting depth         | 1 (flat)     |

Exceeding a bound produces a clear error; the program is rejected before any execution.

## Error Reporting

Errors include:
- line number (text form)
- offending token or identifier
- expected vs actual argument count/type
- undefined reference
- resource limit violation

## Versioning

Programs carry `dsl_version` and `kernel_version`. A program written for `dsl:v0.3.0` will refuse to run under an incompatible future major version without an explicit migration step.

## Security Notes

- Labels, glyphs, cost strings, and notes are treated as untrusted data.
- No code is ever executed from user text; only data is interpreted against a fixed operator registry.
- Imported programs are validated against the same schema and bounds.

---
*The language is small so the receipts stay large.*
