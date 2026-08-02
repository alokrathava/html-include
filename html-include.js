/*! <html-include> v2 — zero-dependency HTML partials */
(() => {
    'use strict';
    if (customElements.get('html-include')) return;

    const CONFIG = { allowScripts: false, maxDepth: 10, timeout: 10000, cache: true };
    const EXECUTABLE_TYPES = new Set(['', 'module', 'text/javascript', 'application/javascript']);

    // Pre-inject base CSS rules
    const style = document.createElement('style');
    style.textContent = `
    html-include { display: block; }
    html-include[fade] { opacity: 0; transition: opacity 180ms ease-out; }
    html-include[fade]:not([data-state="loading"]) { opacity: 1; }
  `;
    (document.head || document.documentElement).prepend(style);

    class HtmlInclude extends HTMLElement {
        static get observedAttributes() { return ['src']; }

        connectedCallback() {
            const reserved = this.getAttribute('min-height');
            if (reserved) this.style.minHeight = reserved;
            this.load();
        }

        async load() {
            const src = this.getAttribute('src');
            if (!src) return;

            this.dataset.state = 'loading';

            try {
                const res = await fetch(src);
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const html = await res.text();

                const template = document.createElement('template');
                template.innerHTML = html;
                const fragment = template.content;

                // Strip scripts unless allow-scripts attribute is present
                const allowScripts = this.hasAttribute('allow-scripts') || CONFIG.allowScripts;
                if (!allowScripts) {
                    fragment.querySelectorAll('script').forEach(s => s.remove());
                }

                this.replaceChildren(fragment);

                // Re-create scripts so they execute dynamically
                if (allowScripts) {
                    for (const oldScript of this.querySelectorAll('script')) {
                        const newScript = document.createElement('script');
                        Array.from(oldScript.attributes).forEach(attr => newScript.setAttribute(attr.name, attr.value));
                        newScript.textContent = oldScript.textContent;
                        oldScript.replaceWith(newScript);
                    }
                }

                this.dataset.state = 'ready';
            } catch (err) {
                this.dataset.state = 'error';
                this.innerHTML = `<div style="padding:10px; color:#f87171; background:#450a0a;">Failed to load ${src}</div>`;
            }
        }
    }

    customElements.define('html-include', HtmlInclude);
})();