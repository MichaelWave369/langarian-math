"""Safe Langarian DSL parser (v0.3).

Turns a restricted text program into a Program instance.
No eval, no exec, no dynamic code generation.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Any

from .program import Program, ProgramStep, empty_program
from .state import ResonantState

DSL_VERSION = "dsl:v0.3.0"
MAX_DIM = 256
MAX_STEPS = 128
MAX_TEXT_BYTES = 64 * 1024


class DSLError(Exception):
    def __init__(self, message: str, line: int | None = None):
        self.line = line
        prefix = f"line {line}: " if line is not None else ""
        super().__init__(prefix + message)


@dataclass
class _Token:
    kind: str
    value: str
    line: int


def _tokenize(text: str) -> list[_Token]:
    if len(text.encode("utf-8")) > MAX_TEXT_BYTES:
        raise DSLError(f"Program exceeds {MAX_TEXT_BYTES} byte limit.")

    token_spec = [
        ("COMMENT", r"#[^\n]*"),
        ("NUMBER", r"[-+]?\d+(?:\.\d+)?(?:[eE][-+]?\d+)?"),
        ("STRING", r'"(?:\\.|[^"\\])*"|\'(?:\\.|[^\'\\])*\''),
        ("IDENT", r"[A-Za-z_][A-Za-z0-9_]*"),
        ("OP", r"[=\[\]\(\),+\-]"),
        ("SKIP", r"[ \t]+"),
        ("NEWLINE", r"\n"),
        ("MISMATCH", r"."),
    ]
    regex = "|".join(f"(?P<{name}>{pattern})" for name, pattern in token_spec)
    tokens: list[_Token] = []
    line = 1
    for match in re.finditer(regex, text):
        kind = match.lastgroup or "MISMATCH"
        value = match.group()
        if kind == "NEWLINE":
            line += 1
            continue
        if kind == "SKIP" or kind == "COMMENT":
            continue
        if kind == "MISMATCH":
            raise DSLError(f"Unexpected character {value!r}", line)
        tokens.append(_Token(kind, value, line))
    return tokens


class _Parser:
    def __init__(self, tokens: list[_Token]):
        self.tokens = tokens
        self.pos = 0

    def peek(self) -> _Token | None:
        if self.pos < len(self.tokens):
            return self.tokens[self.pos]
        return None

    def consume(self, expected: str | None = None) -> _Token:
        tok = self.peek()
        if tok is None:
            raise DSLError("Unexpected end of input")
        if expected and tok.kind != expected and tok.value != expected:
            raise DSLError(f"Expected {expected}, got {tok.value!r}", tok.line)
        self.pos += 1
        return tok

    def parse_program(self, program_id: str = "dsl_program") -> Program:
        prog = empty_program(program_id)
        defined: set[str] = set()

        while self.peek() is not None:
            tok = self.peek()
            assert tok is not None
            if tok.kind == "IDENT" and tok.value == "state":
                self._parse_state_decl(prog, defined)
            elif tok.kind == "IDENT" and tok.value == "bridge":
                self._parse_bridge(prog, defined)
            elif tok.kind == "IDENT":
                self._parse_assignment(prog, defined)
            else:
                raise DSLError(f"Unexpected token {tok.value!r}", tok.line)

            if len(prog.steps) > MAX_STEPS:
                raise DSLError(f"Exceeded maximum step count ({MAX_STEPS})")

        return prog

    def _parse_state_decl(self, prog: Program, defined: set[str]) -> None:
        self.consume()  # state
        name_tok = self.consume("IDENT")
        name = name_tok.value
        if name in defined:
            raise DSLError(f"State {name!r} already defined", name_tok.line)
        self.consume("=")
        vector = self._parse_vector()
        glyph = None
        label = None
        while self.peek() and self.peek().kind == "IDENT" and self.peek().value in {"glyph", "label"}:
            key = self.consume().value
            val_tok = self.consume("STRING")
            val = val_tok.value[1:-1]
            if key == "glyph":
                glyph = val
            else:
                label = val
        if len(vector) > MAX_DIM:
            raise DSLError(f"Dimension {len(vector)} exceeds limit {MAX_DIM}", name_tok.line)
        state = ResonantState.from_pairs(vector, glyph=glyph, label=label or name)
        prog.initial_states[name] = state
        defined.add(name)

    def _parse_vector(self) -> list[list[float]]:
        self.consume("[")
        pairs: list[list[float]] = []
        while True:
            pairs.append(self._parse_complex())
            if self.peek() and self.peek().value == ",":
                self.consume(",")
                continue
            break
        self.consume("]")
        return pairs

    def _parse_complex(self) -> list[float]:
        # Supports: 3, 3i, 3+4i, 3-4i, -2.5+0i, etc.
        real = 0.0
        imag = 0.0
        tok = self.consume("NUMBER")
        num = float(tok.value)
        nxt = self.peek()
        if nxt and nxt.value == "i":
            self.consume()
            imag = num
        elif nxt and nxt.value in {"+", "-"}:
            sign = 1.0 if nxt.value == "+" else -1.0
            self.consume()
            imag_tok = self.consume("NUMBER")
            if self.peek() and self.peek().value == "i":
                self.consume()
                real = num
                imag = sign * float(imag_tok.value)
            else:
                raise DSLError("Expected 'i' after imaginary part", imag_tok.line)
        else:
            real = num
        return [real, imag]

    def _parse_assignment(self, prog: Program, defined: set[str]) -> None:
        name_tok = self.consume("IDENT")
        name = name_tok.value
        self.consume("=")
        op_tok = self.consume("IDENT")
        op = op_tok.value
        self.consume("(")
        args: list[Any] = []
        if self.peek() and self.peek().value != ")":
            args.append(self._parse_arg())
            while self.peek() and self.peek().value == ",":
                self.consume(",")
                args.append(self._parse_arg())
        self.consume(")")

        if op not in {"phase_shift", "attenuated_phase_shift", "phi_scale", "harmonic_sum", "bridge"}:
            raise DSLError(f"Unknown operator {op!r}", op_tok.line)

        # Basic arity checks
        if op == "phase_shift" and len(args) != 2:
            raise DSLError("phase_shift expects (state, angle)", op_tok.line)
        if op == "phi_scale" and len(args) not in (1, 2):
            raise DSLError("phi_scale expects (state [, n])", op_tok.line)
        if op == "attenuated_phase_shift" and len(args) != 4:
            raise DSLError("attenuated_phase_shift expects (state, angle, attenuation, cost)", op_tok.line)
        if op == "harmonic_sum" and len(args) != 2:
            raise DSLError("harmonic_sum expects (state_a, state_b)", op_tok.line)

        input_refs = []
        parameters: dict[str, Any] = {}
        if op in {"phase_shift", "phi_scale", "attenuated_phase_shift"}:
            ref = args[0]
            if not isinstance(ref, str) or ref not in defined:
                raise DSLError(f"Undefined state/reference {ref!r}", op_tok.line)
            input_refs = [ref]
            if op == "phase_shift":
                parameters["angle_radians"] = float(args[1])
            elif op == "phi_scale":
                parameters["n"] = int(args[1]) if len(args) > 1 else 1
            else:
                parameters["angle_radians"] = float(args[1])
                parameters["attenuation"] = float(args[2])
                parameters["cost_label"] = str(args[3])
        elif op == "harmonic_sum":
            for a in args:
                if not isinstance(a, str) or a not in defined:
                    raise DSLError(f"Undefined state/reference {a!r}", op_tok.line)
            input_refs = list(args)

        step = ProgramStep(
            step_id=name,
            operator=op,
            input_refs=input_refs,
            parameters=parameters,
            label=name,
        )
        prog.add_step(step)
        defined.add(name)

    def _parse_bridge(self, prog: Program, defined: set[str]) -> None:
        self.consume()  # bridge
        self.consume("(")
        a = self._parse_arg()
        self.consume(",")
        b = self._parse_arg()
        self.consume(")")
        if not isinstance(a, str) or a not in defined:
            raise DSLError(f"Undefined reference {a!r}")
        if not isinstance(b, str) or b not in defined:
            raise DSLError(f"Undefined reference {b!r}")
        step_id = f"bridge_{a}_{b}"
        step = ProgramStep(
            step_id=step_id,
            operator="bridge",
            input_refs=[a, b],
            parameters={"cost": 0.0},
            label=step_id,
        )
        prog.add_step(step)

    def _parse_arg(self) -> Any:
        tok = self.peek()
        if tok is None:
            raise DSLError("Unexpected end of arguments")
        if tok.kind == "IDENT":
            return self.consume().value
        if tok.kind == "NUMBER":
            return float(self.consume().value)
        if tok.kind == "STRING":
            return self.consume().value[1:-1]
        if tok.value == "[":
            return self._parse_vector()
        raise DSLError(f"Unexpected argument token {tok.value!r}", tok.line)


def parse_dsl(text: str, program_id: str = "dsl_program") -> Program:
    """Parse restricted Langarian text into a Program. Raises DSLError on failure."""
    tokens = _tokenize(text)
    parser = _Parser(tokens)
    prog = parser.parse_program(program_id)
    prog.schema_version = f"{prog.schema_version}+{DSL_VERSION}"
    return prog
