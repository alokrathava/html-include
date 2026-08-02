/*!
 * <html-include> v2 — zero-dependency HTML partials
 *
 * Loads a trusted HTML file and replaces the element's children with the
 * returned markup. Existing children act as fallback content until a request
 * succeeds.
 *
 * Basic usage:
 *   <html-include src="partials/header.html" min-height="65px" fade>
 *     Loading header...
 *   </html-include>
 *
 * Supported attributes:
 *   src           Required URL of the HTML partial. Changing it reloads the
 *                 element; removing it cancels any pending request.
 *   min-height    Optional CSS minimum height used to reserve layout space.
 *   fade          Fades the element in after loading finishes.
 *   allow-scripts Recreates JavaScript <script> elements so trusted scripts
 *                 can execute. Scripts are removed by default.
 *
 * Loading state is exposed as data-state="loading", "ready", or "error" so
 * applications can add their own status styling. A missing src has no state.
 *
 * Security: only include markup from sources you trust. Removing <script>
 * elements is not HTML sanitization; event handlers, embedded resources, and
 * other active content may still be present in the returned markup.
 */
(() => {
    'use strict';

    const ELEMENT_NAME = 'html-include';

    // Loading this file more than once should not throw by defining the same
    // custom element twice or inject duplicate copies of the base stylesheet.
    if (customElements.get(ELEMENT_NAME)) return;

    const DEFAULTS = Object.freeze({ allowScripts: false });
    const EXECUTABLE_TYPES = new Set(['', 'module', 'text/javascript', 'application/javascript']);

    // These small base rules make the element behave like a normal block and
    // provide the optional fade effect without requiring a separate CSS file.
    const style = document.createElement('style');
    style.textContent = `
    html-include { display: block; }
    html-include[fade] { opacity: 0; transition: opacity 180ms ease-out; }
    html-include[fade]:not([data-state="loading"]) { opacity: 1; }
  `;

    // documentElement is available while an early <head> is still being
    // parsed, so it provides a safe fallback when document.head is absent.
    (document.head || document.documentElement).prepend(style);

    /**
     * Custom element that fetches and renders an HTML partial in the light DOM.
     * Light DOM is intentional: styles and IDs in the partial behave exactly
     * as if that markup had been written directly into the host document.
     */
    class HtmlInclude extends HTMLElement {
        constructor() {
            super();

            // Each instance owns at most one request. Keeping its controller
            // lets a newer src supersede an older request without a race.
            this.requestController = null;

            // This flag tracks whether connectedCallback has run. It is more
            // precise than isConnected during the upgrade of existing markup,
            // when the element can already be in the document before its first
            // connectedCallback is delivered.
            this.lifecycleConnected = false;
        }

        /**
         * Ask the Custom Elements API to call attributeChangedCallback whenever
         * src changes. Other attributes are read when the element connects or
         * when load() runs and do not need lifecycle notifications.
         */
        static get observedAttributes() {
            return ['src'];
        }

        /**
         * Apply layout reservation and begin loading when the element enters
         * the document. Reconnecting the same element deliberately reloads it.
         */
        connectedCallback() {
            this.lifecycleConnected = true;
            const reservedHeight = this.getAttribute('min-height');
            this.style.minHeight = reservedHeight || '';
            void this.load();
        }

        /**
         * Reload a connected element when its source changes. During initial
         * HTML parsing this callback can run before connectedCallback, so the
         * lifecycle flag prevents the same partial from being fetched twice.
         */
        attributeChangedCallback(name, previousValue, currentValue) {
            if (name === 'src' && previousValue !== currentValue && this.lifecycleConnected) {
                void this.load();
            }
        }

        /**
         * Stop work that can no longer update the page when the host is removed.
         */
        disconnectedCallback() {
            this.lifecycleConnected = false;
            this.cancelActiveRequest();
        }

        /**
         * Fetch, parse, and render the URL in src.
         *
         * The method is public on the element, so callers may invoke load() to
         * retry or refresh the current partial. All expected request failures
         * are handled here and represented through data-state.
         *
         * @returns {Promise<void>}
         */
        async load() {
            // A source change or manual refresh always makes the prior request
            // obsolete. Aborting first also handles removal of the src attribute.
            this.cancelActiveRequest();

            const src = this.getAttribute('src');
            if (!src) {
                delete this.dataset.state;
                return;
            }

            const controller = new AbortController();
            this.requestController = controller;
            this.dataset.state = 'loading';

            try {
                const response = await fetch(src, { signal: controller.signal });
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status} ${response.statusText}`.trim());
                }

                const html = await response.text();

                // Parsing in a <template> creates an inert DocumentFragment.
                // This allows scripts to be removed before anything is inserted.
                const template = document.createElement('template');
                template.innerHTML = html;
                const fragment = template.content;

                const allowScripts = this.hasAttribute('allow-scripts') || DEFAULTS.allowScripts;
                if (!allowScripts) {
                    // Script removal is a safe default, but it does not sanitize
                    // other potentially active or untrusted HTML features.
                    fragment.querySelectorAll('script').forEach(script => script.remove());
                }

                // AbortController prevents most stale work. This identity check
                // is a final guard against an older request updating the element
                // after a newer load() call has installed its own controller.
                if (controller.signal.aborted || this.requestController !== controller) return;

                this.replaceChildren(fragment);

                if (allowScripts) {
                    this.activateScripts();
                }

                // "ready" means the markup has been inserted and executable
                // scripts have been scheduled. External scripts may finish later.
                // An inline script can synchronously change src or disconnect
                // this host, so confirm request ownership once more afterward.
                if (controller.signal.aborted || this.requestController !== controller) return;
                this.dataset.state = 'ready';
            } catch (error) {
                // Aborts are expected during src changes and disconnection. An
                // obsolete request must not replace newer content with an error.
                if (controller.signal.aborted || this.requestController !== controller) return;

                this.dataset.state = 'error';
                this.renderError(src);
                console.error(`[${ELEMENT_NAME}] Failed to load "${src}".`, error);
            } finally {
                if (this.requestController === controller) {
                    this.requestController = null;
                }
            }
        }

        /**
         * Abort the current fetch, if one exists. abort() is idempotent, so this
         * helper is safe to call before every load and during disconnection.
         */
        cancelActiveRequest() {
            if (this.requestController) {
                this.requestController.abort();
                this.requestController = null;
            }
        }

        /**
         * Scripts parsed through template.innerHTML are inert. Replacing each
         * JavaScript script with a newly created node asks the browser to execute
         * it. Non-executable script types, such as JSON data blocks, stay intact.
         */
        activateScripts() {
            for (const oldScript of this.querySelectorAll('script')) {
                const type = (oldScript.getAttribute('type') || '').trim().toLowerCase();
                if (!EXECUTABLE_TYPES.has(type)) continue;

                const newScript = document.createElement('script');
                for (const attribute of oldScript.attributes) {
                    newScript.setAttribute(attribute.name, attribute.value);
                }
                newScript.textContent = oldScript.textContent;
                oldScript.replaceWith(newScript);
            }
        }

        /**
         * Show a visible and accessible failure message. textContent is required
         * here because src is author-controlled and must never be parsed as HTML.
         */
        renderError(src) {
            const message = document.createElement('div');
            message.setAttribute('role', 'alert');
            message.style.padding = '10px';
            message.style.color = '#f87171';
            message.style.backgroundColor = '#450a0a';
            message.textContent = `Failed to load ${src}`;
            this.replaceChildren(message);
        }
    }

    // Registering upgrades any matching elements that the parser created before
    // this script ran and enables all future <html-include> elements.
    customElements.define(ELEMENT_NAME, HtmlInclude);
})();
