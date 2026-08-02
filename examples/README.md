# Examples

Six standalone sample projects, each runnable on its own — every folder
carries its own copy of `html-include.js`.

```bash
cd examples/01-basic-layout
python3 -m http.server 8000
# then open http://localhost:8000
```

| Folder | Demonstrates | Attributes / states exercised |
| --- | --- | --- |
| [`01-basic-layout`](01-basic-layout) | Sharing a header and footer across static pages | `min-height`, `fade`, fallback content |
| [`02-interactive-widget`](02-interactive-widget) | A partial with an embedded `<script>` | `allow-scripts` |
| [`03-data-table`](03-data-table) | Hydrating a `<tbody>` without triggering foster-parenting | `data-include` (page-level pattern, not a component attribute) |
| [`04-dynamic-tabs`](04-dynamic-tabs) | Switching `src` at runtime and the request-race guard | `src` reload, `data-state="loading"`, `AbortController` behavior |
| [`05-error-retry`](05-error-retry) | A failed fetch and recovering from it | `data-state="error"`, `load()` |
| [`06-assets-and-data`](06-assets-and-data) | Relative-URL resolution and mixed `<script>` types | `allow-scripts`, non-executable script types |
