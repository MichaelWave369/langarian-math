# Usage

Run the base 3-6-9 example:

```bash
langarian run examples/basic_369.yaml --receipts-dir receipts
```

Run the reduced-domain boundary scan:

```bash
langarian run examples/boundary_domain_scan.yaml --receipts-dir receipts
```

Check a receipt file:

```bash
langarian validate receipts/basic_369_bridge.json
langarian validate receipts/boundary_domain_scan.json
```

Print a readable receipt summary:

```bash
langarian explain receipts/basic_369_bridge.json
langarian explain receipts/boundary_domain_scan.json
```

These commands support the public Ledger workflow while keeping interpretive and model claims out of formal proof contexts.
