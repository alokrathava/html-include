# `<html-include>`

A lightweight, zero-dependency Web Component for loading reusable HTML partials into a webpage.

Use `<html-include>` to reuse headers, footers, navigation bars, sidebars, and other shared HTML fragments without introducing a frontend framework, server-side template engine, or build pipeline.

---

## Overview

Traditional multi-page websites often duplicate common markup across several `.html` files. For example, the same header or footer may appear on every page.

This duplication creates maintenance problems:

* Site-wide changes must be repeated across multiple files.
* Pages can become inconsistent.
* Small updates are more likely to introduce errors.
* Lightweight projects may require unnecessary tooling just to reuse HTML.

Modern frameworks and static-site generators solve this problem, but they may introduce more complexity than a small static website needs.

`<html-include>` provides declarative HTML composition using standard browser APIs.

```html
<html-include src="partials/header.html"></html-include>
```

The component fetches the specified partial and inserts its markup directly into the element.

---

## Why Use `<html-include>`?

Frameworks such as React and Vue, and static-site generators such as Next.js and Astro, provide component-based development. However, they may be excessive for projects that only need reusable static HTML.

Using these tools can introduce:

* Node.js and package-manager requirements
* Bundlers such as Vite or Webpack
* Large dependency trees
* Additional security and maintenance concerns
* Client-side JavaScript runtime overhead
* More complex project configuration and deployment

`<html-include>` avoids this overhead by using platform-native browser features:

* Custom Elements
* `fetch()`
* `AbortController`
* `<template>`
* `DocumentFragment`
* `replaceChildren()`

No dependencies, package manager, transpiler, or build process are required.

---

## Features

* Built with the native Custom Elements API
* Zero runtime dependencies
* No build step required
* Supports fallback content
* Exposes loading, ready, and error states
* Automatically reloads when `src` changes
* Cancels obsolete requests to prevent race conditions
* Removes `<script>` elements by default
* Supports explicit trusted-script execution
* Includes an optional fade transition
* Supports layout-space reservation to reduce layout shifts
* Inserts content into the light DOM for normal stylesheet access

---

## Quick Start

### 1. Add the component script

Copy `html-include.js` into your project and load it from the document `<head>`:

```html
<script src="./html-include.js"></script>
```

### 2. Create an HTML partial

A partial should contain only the markup that will be inserted. It should not contain a complete HTML document.

```html
<!-- partials/header.html -->

<header class="site-header">
    <a href="/">Home</a>
</header>
```

Do not include elements such as:

```html
<!DOCTYPE html>
<html>
<head></head>
<body></body>
</html>
```

### 3. Include the partial

```html
<html-include
    src="partials/header.html"
    min-height="65px"
    fade
>
    <p>Loading header...</p>
</html-include>
```

The initial child content acts as fallback content before loading begins and when JavaScript is unavailable.

When the request succeeds, the fallback content is replaced by the loaded partial.

When the request fails, the component displays an accessible error message.

---

## Running the Example

HTML partials are loaded through `fetch()`. Browsers normally block these requests when a page is opened directly through a `file://` URL.

Serve the project over HTTP instead.

From the project directory, run:

```bash
python3 -m http.server 8000
```

Then open:

```text
http://localhost:8000
```

---

## Attributes

| Attribute       | Required | Description                                                                                                                                                                                         |
| --------------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src`           | Yes      | URL of the HTML partial. Relative URLs are resolved against the main document URL. Changing the value loads the new partial. Removing it cancels pending work without deleting the current content. |
| `min-height`    | No       | Sets a CSS `min-height`, such as `65px` or `4rem`, to reserve layout space while the partial is loading.                                                                                            |
| `fade`          | No       | Enables the built-in 180 ms opacity transition. The component remains transparent while `data-state="loading"`.                                                                                     |
| `allow-scripts` | No       | Allows recognized JavaScript scripts from a trusted partial to execute. Without this attribute, all `<script>` elements are removed.                                                                |

Boolean attributes are enabled by their presence:

```html
<html-include
    src="trusted-widget.html"
    allow-scripts
></html-include>
```

---

## Tables and Other Restricted Parents

`<html-include>` is a custom element, and the HTML parser only allows specific
element types as direct children of `<table>` (`<thead>`, `<tbody>`, `<tr>`,
etc.). A `<html-include>` written directly inside a `<table>` is not valid
table content, so the parser "foster-parents" it: the element (and anything
it would render) is moved to just *before* the table instead of inside it.

For this case, include a small hydration script instead of the custom
element, and hydrate an existing `<tbody>` (or other table section) in place:

```html
<table>
    <tbody data-include="partials/table-rows.html">
        <tr><td colspan="4">Loading…</td></tr>
    </tbody>
</table>

<script>
    document.addEventListener('DOMContentLoaded', () => {
        document.querySelectorAll('[data-include]').forEach(el => {
            fetch(el.dataset.include)
                .then(r => r.ok ? r.text() : Promise.reject(new Error(`HTTP ${r.status}`)))
                .then(html => {
                    const t = document.createElement('template');
                    t.innerHTML = html;
                    t.content.querySelectorAll('script').forEach(s => s.remove());
                    el.replaceChildren(t.content);
                    el.dataset.state = 'ready';
                })
                .catch(error => {
                    el.dataset.state = 'error';
                    console.error(`Failed to load "${el.dataset.include}".`, error);
                });
        });
    });
</script>
```

This `data-include` pattern is a page-level snippet, not part of
`html-include.js`. It intentionally has less behavior than the component:
no `allow-scripts` support, no request cancellation, and it does not reload
when the attribute changes later. See
[`examples/03-data-table/`](examples/03-data-table) for a full working copy.

---

## Loading States

The component exposes its current status through the `data-state` attribute.

| State     | Meaning                                                                                                                               |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `loading` | The partial is being fetched and processed.                                                                                           |
| `ready`   | The markup has been inserted and allowed scripts have been scheduled. External scripts may still be loading.                          |
| `error`   | The request or rendering process failed. An accessible error message is displayed, and the underlying error is logged to the console. |

The `data-state` attribute is absent when the component does not have a `src` value.

States can be styled using standard CSS:

```css
html-include[data-state="loading"] {
    pointer-events: none;
}

html-include[data-state="error"] {
    border: 1px solid #f87171;
}
```

---

## Layout Stability

Fetching a partial takes time. Without reserved space, content below the component may move when the partial is inserted, contributing to Cumulative Layout Shift.

Use the `min-height` attribute to reserve an appropriate amount of space:

```html
<html-include
    src="partials/header.html"
    min-height="65px"
></html-include>
```

The component also uses `display: block` by default, making its layout behavior more predictable.

---

## Changing a Partial

Changing the `src` attribute on a connected component automatically starts a new request.

```js
const include = document.querySelector('html-include');

include.setAttribute(
    'src',
    'partials/footer.html'
);
```

If another request is already active, it is cancelled before the new request begins.

This prevents an older response from replacing newer content.

---

## Refreshing a Partial

Call the public `load()` method to retry or refresh the current partial without changing the `src` attribute.

```js
const include = document.querySelector('html-include');

await include.load();

if (include.dataset.state === 'error') {
    console.log('The partial could not be refreshed.');
}
```

Calling `load()` while another request is active cancels the existing request before starting a new one.

Expected loading failures are handled internally and reflected through `data-state`.

---

## Request Lifecycle

The component uses `AbortController` to manage fetch requests.

When any of the following occurs, obsolete work is cancelled:

* The `src` attribute changes
* The `src` attribute is removed
* `load()` is called again
* A newer request replaces an older request

This prevents race conditions where a slower, outdated response could overwrite the result of a newer request.

---

## DOM and Styling Behavior

Loaded content is inserted into the component's light DOM rather than a Shadow DOM.

This means:

* Styles from the main document can target included elements.
* `<style>` elements inside a partial affect the main document.
* IDs and class names share the same namespace as the rest of the page.
* JavaScript can query included elements normally.
* Global CSS rules may affect the loaded markup.

For example:

```css
.site-header {
    display: flex;
    align-items: center;
    min-height: 65px;
}
```

This stylesheet can target `.site-header` even when the element was loaded from a partial.

---

## Relative URLs

Relative URLs inside an included partial are resolved against the main document URL, not the partial file's location.

Given the following structure:

```text
index.html
partials/
    header.html
images/
    logo.svg
```

This markup inside `partials/header.html`:

```html
<img src="images/logo.svg" alt="Logo">
```

is resolved relative to `index.html`.

It is not automatically resolved relative to `partials/header.html`.

Account for this behavior when referencing:

* Images
* Stylesheets
* Links
* Scripts
* Fonts
* Other embedded resources

---

## Built-In Styles

The component injects only the following base rules:

```css
html-include {
    display: block;
}

html-include[fade] {
    opacity: 0;
    transition: opacity 180ms ease-out;
}

html-include[fade]:not([data-state="loading"]) {
    opacity: 1;
}
```

The `fade` attribute is optional.

Example:

```html
<html-include
    src="partials/navigation.html"
    fade
></html-include>
```

---

## Script Handling

Scripts are disabled by default.

When `allow-scripts` is absent, every `<script>` element is removed before the partial is inserted.

```html
<html-include src="partials/header.html"></html-include>
```

This behavior prevents JavaScript in the partial from executing, but it does not fully sanitize the HTML.

### Enabling scripts

For trusted first-party partials, add the `allow-scripts` attribute:

```html
<html-include
    src="partials/trusted-widget.html"
    allow-scripts
></html-include>
```

When enabled, recognized executable scripts are recreated so the browser can execute them.

Supported executable script types include:

* No `type` attribute
* `type="module"`
* `type="text/javascript"`
* `type="application/javascript"`

Example:

```html
<script>
    console.log('Partial loaded');
</script>
```

Module scripts are also supported:

```html
<script type="module">
    console.log('Module partial loaded');
</script>
```

Non-executable script types remain in the DOM without being executed.

For example:

```html
<script type="application/json">
{
    "name": "Example"
}
</script>
```

### Script readiness

When the component enters the `ready` state, allowed scripts have been inserted and scheduled.

This does not guarantee that external scripts have finished downloading or executing.

---

## Security

Only load HTML from trusted sources.

Removing `<script>` elements is not equivalent to sanitizing HTML.

A partial may still contain active or potentially dangerous content, including:

* Inline event handlers such as `onclick`
* `<iframe>` elements
* Embedded external resources
* Dangerous URL schemes
* Malicious forms
* Tracking content
* Styles that modify the surrounding page
* Other active HTML elements

The `allow-scripts` attribute increases the security risk and must not be enabled for:

* User-generated content
* Third-party HTML
* Unverified remote content
* Data received from untrusted APIs

Normal browser security rules still apply, including:

* Same-origin policy
* Cross-Origin Resource Sharing
* Content Security Policy
* Mixed-content restrictions

---

## Error Handling

When a request or rendering operation fails, the component:

1. Sets `data-state="error"`.
2. Displays an accessible error message.
3. Adds `role="alert"` to the error message.
4. Logs the underlying error to the browser console.

Error-state styling can be customized:

```css
html-include[data-state="error"] {
    padding: 1rem;
    border: 1px solid #f87171;
    background: #fef2f2;
}
```

To retry the request:

```js
const include = document.querySelector('html-include');

await include.load();
```

---

## Fallback Content

Content placed inside `<html-include>` before the partial loads acts as fallback content.

```html
<html-include src="partials/sidebar.html">
    <nav aria-label="Temporary navigation">
        <p>Loading navigation...</p>
    </nav>
</html-include>
```

Fallback content is useful for:

* Loading messages
* Skeleton placeholders
* Basic no-JavaScript navigation
* Reserved layout structures
* Progressive enhancement

After a successful request, the fallback content is replaced by the loaded partial.

---

## Browser Support

The component targets modern browsers that support:

* Custom Elements
* `fetch()`
* `AbortController`
* `<template>`
* `DocumentFragment`
* `Element.replaceChildren()`

No legacy-browser polyfills are included.

---

## Project Structure

```text
html-include.js
index.html
style.css
partials/
    header.html
```

### Files

| File                   | Description                   |
| ---------------------- | ----------------------------- |
| `html-include.js`      | Web Component implementation  |
| `index.html`           | Basic usage example           |
| `partials/header.html` | Example reusable HTML partial |
| `style.css`            | Optional project stylesheet   |

See [`examples/`](examples) for six standalone sample projects covering
layout sharing, scripts, tables, dynamic `src` switching, error handling,
and asset/data-script resolution.

---

## Example

### `index.html`

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta
        name="viewport"
        content="width=device-width, initial-scale=1.0"
    >

    <title>HTML Include Example</title>

    <link rel="stylesheet" href="./style.css">
    <script src="./html-include.js"></script>
</head>

<body>
    <html-include
        src="partials/header.html"
        min-height="65px"
        fade
    >
        <p>Loading header...</p>
    </html-include>

    <main>
        <h1>Welcome</h1>
        <p>This page uses a reusable HTML partial.</p>
    </main>
</body>
</html>
```

### `partials/header.html`

```html
<header class="site-header">
    <a href="/">Home</a>

    <nav aria-label="Main navigation">
        <a href="/about.html">About</a>
        <a href="/contact.html">Contact</a>
    </nav>
</header>
```

### `style.css`

```css
body {
    margin: 0;
    font-family: system-ui, sans-serif;
}

.site-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    min-height: 65px;
    padding-inline: 1rem;
    border-bottom: 1px solid #e5e7eb;
}

html-include[data-state="loading"] {
    pointer-events: none;
}

html-include[data-state="error"] {
    padding: 1rem;
    border: 1px solid #f87171;
}
```

---

## Recommended Use Cases

`<html-include>` works well for:

* Small static websites
* Documentation websites
* Prototypes
* Internal tools
* Marketing pages
* Multi-page sites with shared navigation
* Projects that do not require a full component framework

It may not be appropriate when the application requires:

* Complex reactive state
* Server-side rendering
* Advanced routing
* Large-scale component composition
* Strong style encapsulation
* Extensive client-side interactivity
* HTML from untrusted sources

---

## Summary

`<html-include>` provides a simple way to reuse HTML fragments while keeping a project close to the browser platform.

It offers:

* Declarative HTML partial loading
* No framework or build tooling
* Stable request lifecycle handling
* Automatic reloading
* Loading and error states
* Optional fade transitions
* Safer default script handling
* Light-DOM styling compatibility

For lightweight websites that need reusable HTML without adopting an entire frontend architecture, `<html-include>` provides a focused, platform-native solution.
