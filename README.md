# Beaki website

Public landing page for [Beaki](https://www.beaki.app), hosted with GitHub Pages. The Liquid Glass design follows the October 2026 design handoff, including all ten sections, illustrative app previews and the interactive Lucía / Ana profile switch.

The production site uses semantic HTML, responsive CSS and vanilla JavaScript. Fonts, logos, the kiwi spinner and MIT-licensed Ionicons are served locally. There are no production dependencies or scroll-driven animations. Legal content is preserved in English and Spanish.

## Local preview

From this directory, run `python3 -m http.server 8080` and open `http://localhost:8080/`. Absolute asset paths require the repository to be the server root.

## Languages and accessibility

Use the ES / EN buttons in the header, or open `/?lang=es` and `/?lang=en`. Legal pages accept the same parameter. Explicit language URLs override saved preferences; otherwise the site uses the saved choice or browser language. Links carry the language between pages, including when local storage is unavailable.

The mobile navigation closes after selecting a section and on Escape. Profile tabs support arrow keys, Home and End. The site honours reduced-motion preferences, and the Spanish content remains available without JavaScript.

## Browser checks

```sh
npm ci
npx playwright install chromium webkit
npm test
PLAYWRIGHT_ENGINE=webkit npm test
```

To use an installed Google Chrome browser, run `PLAYWRIGHT_CHANNEL=chrome npm test`.

The checks cover English and Spanish on the landing and legal pages at widths from 320px to 1440px; horizontal overflow; clipped preview text; translations; images and anchors; WCAG accessibility scans; profile and language switching; mobile navigation; saved and explicit language preferences; blocked storage; reduced motion; and rendering without JavaScript. Test dependencies are only needed for development.

## Deployment

GitHub Pages publishes the repository root of the `main` branch. Push verified changes to `origin/main` to publish. The `CNAME` file binds the site to `www.beaki.app`; DNS for the apex and `www` is managed in the private Beaki infrastructure repository.
