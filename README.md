# `<html-include>`

## Motivation & Architecture

### Problem Statement
In traditional multi-page web development, reusing common UI fragments—such as headers, footers, or navigation bars—presents a recurring maintenance challenge. Without component abstractions, developers are forced to duplicate markup across multiple `.html` files, making site-wide updates tedious and error-prone.

### Why Avoid Framework Over-Engineering?
Modern single-page application (SPA) frameworks (e.g., React, Vue) and Static Site Generators (e.g., Next.js, Astro) address component reusability, but often at the cost of unnecessary architectural complexity for lightweight projects:

- **Build Pipeline Overhead:** Introduces Node.js runtime environments, package managers (`npm`), and bundlers (`Vite`, `Webpack`) for projects that only require static file delivery.
- **Dependency Churn:** Increases security surface area and maintenance requirements across heavy `node_modules` trees.
- **Client-Side Footprint:** Ships large JavaScript runtime bundles to the client simply to compose static HTML structures.

### The `<html-include>` Solution
`<html-include>` restores **declarative layout composition** directly to vanilla HTML without build steps, server-side template engines, or heavy framework runtimes.

It addresses key technical challenges associated with client-side partial fetching:

- **Layout Stability:** Mitigates Cumulative Layout Shift (CLS) during network fetches via CSS layout reservation (`min-height`) and block-level default display modes.
- **Request Lifecycle Control:** Employs native `AbortController` pipelines to cancel obsolete network requests when `src` attributes change dynamically, preventing race conditions.
- **Controlled Script Execution:** Enforces secure default behavior by stripping `<script>` tags, while offering explicit, opt-in execution (`allow-scripts`) for trusted first-party partials.
- **Platform-Native Execution:** Built strictly on standardized Web APIs (`CustomElements`, `fetch`, and `<template>` fragments) for maximum browser compatibility and zero third-party runtime overhead.

A small, zero-dependency Web Component for loading reusable HTML partials into a page.

Use it for shared headers, footers, navigation, or other fragments when a full frontend framework or server-side template system would be unnecessary.

## Features

- Uses the native Custom Elements API.
- Has no runtime dependencies or build step.
- Supports fallback content while the component initializes.
- Exposes loading, ready, and error states for custom styling.
- Reloads automatically when `src` changes.
- Cancels obsolete requests so an older response cannot replace newer content.
- Removes `<script>` elements by default.
- Provides optional trusted-script execution and a built-in fade effect.

## Quick start

Add `html-include.js` to your project, then load it from the document `<head>`:

```html
<script src="./html-include.js"></script>
```

Create an HTML partial. A partial should contain only the markup that will be inserted, not a complete HTML document:

```html
<!-- partials/header.html -->
<header class="site-header">
    <a href="/">Home</a>
</header>
```

Reference the partial with `<html-include>`:

```html
<html-include src="partials/header.html" min-height="65px" fade>
    <p>Loading header...</p>
</html-include>
```

The initial children provide fallback content before loading begins and when JavaScript is unavailable. A successful request replaces them with the partial. A failed request replaces them with an accessible error message.

## Run the example

HTML partials are fetched by the browser, so serve the project over HTTP instead of opening `index.html` through a `file://` URL.

For example, from the project directory:

```bash
python3 -m http.server 8000
```

Then open [http://localhost:8000](http://localhost:8000) in a browser.

## Attributes

| Attribute | Required | Description |
| --- | --- | --- |
| `src` | Yes | URL of the HTML partial. Relative URLs are resolved against the main document URL. Changing the value starts a new request. Removing it cancels pending work without deleting the current content. |
| `min-height` | No | Any valid CSS `min-height` value, such as `65px` or `4rem`. It reserves layout space when the component connects. |
| `fade` | No | Boolean attribute that applies the built-in 180 ms opacity transition. The component is transparent while `data-state="loading"`. |
| `allow-scripts` | No | Boolean attribute that allows recognized JavaScript scripts in a trusted partial to execute. All scripts are removed when this attribute is absent. |

Boolean attributes are enabled by their presence:

```html
<html-include src="trusted-widget.html" allow-scripts></html-include>
```

## Loading states

The component exposes its current status through `data-state`:

| State | Meaning |
| --- | --- |
| `loading` | The partial is being fetched and processed. |
| `ready` | The markup has been inserted and allowed scripts have been scheduled. External scripts may still be loading. |
| `error` | The request or rendering operation failed. An element with `role="alert"` is displayed and the underlying error is logged to the console. |

The attribute is absent when the component has no `src`. These states can be styled directly:

```css
html-include[data-state="loading"] {
    pointer-events: none;
}

html-include[data-state="error"] {
    border: 1px solid #f87171;
}
```

## Changing or refreshing a partial

Changing `src` on a connected element automatically loads the new partial:

```js
const include = document.querySelector('html-include');
include.setAttribute('src', 'partials/footer.html');
```

Call the public `load()` method to retry or refresh the current URL without changing `src`:

```js
await include.load();

if (include.dataset.state === 'error') {
    console.log('The partial could not be refreshed.');
}
```

Expected loading failures are handled inside the component and reflected through `data-state`. Calling `load()` again cancels any request that is still active.

## Styles and DOM behavior

Loaded content is inserted into the component's light DOM rather than a Shadow DOM. This means:

- Styles in the main document can target the included markup.
- `<style>` elements inside a partial apply to the main document.
- IDs and class names share the same namespace as the rest of the page.
- Relative URLs inside the included markup resolve against the main document, not the partial's location.

The component injects only these base rules:

```css
html-include { display: block; }
html-include[fade] { opacity: 0; transition: opacity 180ms ease-out; }
html-include[fade]:not([data-state="loading"]) { opacity: 1; }
```

## Script handling

Scripts are disabled by default. Without `allow-scripts`, every `<script>` element is removed before the partial is inserted.

When `allow-scripts` is present, scripts with no `type`, `type="module"`, `type="text/javascript"`, or `type="application/javascript"` are recreated so the browser executes them. Non-executable script types, such as JSON data blocks, remain in the DOM without being executed.

`data-state="ready"` means scripts have been scheduled; it does not guarantee that external scripts have finished downloading or running.

## Security

Only load HTML from sources you trust.

Removing `<script>` elements is not HTML sanitization. Included markup may still contain inline event handlers, iframes, embedded resources, dangerous URLs, or other active content. The `allow-scripts` attribute increases that risk and should never be enabled for user-provided or otherwise untrusted HTML.

Normal browser fetch and CORS rules apply to cross-origin partials.

## Browser support

The component targets modern browsers with support for:

- Custom Elements
- `fetch()` and `AbortController`
- `<template>` and `DocumentFragment`
- `Element.replaceChildren()`

No legacy-browser polyfills are included.

## Project files

```text
html-include.js       Component implementation
index.html            Basic working example
partials/header.html  Example HTML partial
style.css             Optional project stylesheet
```
