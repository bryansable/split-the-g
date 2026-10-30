/**
 * Shared chrome for the crawlable pages: <head>, the site-wide nav and the
 * footer. Used for the static pages and injected around the app on the home page.
 */

export const SITE_URL = 'https://pintsplit.com'
export const SITE_NAME = 'Split The G'
export const CONTACT_EMAIL = 'bryansable52@gmail.com'

const NAV = [
  { href: '/', label: 'Home' },
  { href: '/blog', label: 'Blog' },
  { href: '/about', label: 'About' },
  { href: '/contact', label: 'Contact' },
  { href: '/privacy', label: 'Privacy' },
  { href: '/terms', label: 'Terms' },
]

export function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

/** AdSense account meta and loader, so every page carries them in raw HTML. */
export function adsenseTags(client: string | undefined): string {
  const id = client?.trim()
  if (!id) return ''
  return `<meta name="google-adsense-account" content="${id}" />
    <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${id}" crossorigin="anonymous"></script>`
}

export function siteHeader(current: string): string {
  const links = NAV.map(
    (n) => `<a href="${n.href}"${n.href === current ? ' aria-current="page"' : ''}>${n.label}</a>`,
  ).join('')
  return `<header class="site-header">
      <a class="site-brand" href="/"><span class="site-g">G</span> Split The G</a>
      <nav class="site-nav" aria-label="Site">${links}</nav>
    </header>`
}

export function siteFooter(): string {
  const links = NAV.map((n) => `<a href="${n.href}">${n.label}</a>`).join('')
  return `<footer class="site-footer">
      <nav aria-label="Footer">${links}</nav>
      <p>For people of legal drinking age. Please drink responsibly. An alcohol-free sparkling edition is built in.</p>
      <p>Split The G is an independent fan project and is not affiliated with or endorsed by any brewery. &copy; ${new Date().getFullYear()} pintsplit.com</p>
    </footer>`
}

export interface PageMeta {
  path: string
  title: string
  description: string
  /** Canonical path, when it differs from path (aliases). */
  canonical?: string
  type?: 'website' | 'article'
  jsonLd?: object
}

export function renderPage(meta: PageMeta, body: string, adsenseClient: string | undefined): string {
  const url = SITE_URL + (meta.canonical ?? meta.path)
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="theme-color" content="#0d0906" />
    <title>${esc(meta.title)}</title>
    <meta name="description" content="${esc(meta.description)}" />
    <link rel="canonical" href="${url}" />
    <meta property="og:type" content="${meta.type ?? 'website'}" />
    <meta property="og:site_name" content="${SITE_NAME}" />
    <meta property="og:title" content="${esc(meta.title)}" />
    <meta property="og:description" content="${esc(meta.description)}" />
    <meta property="og:url" content="${url}" />
    <meta property="og:image" content="${SITE_URL}/hero.jpg" />
    <link rel="icon" href="/icon.svg" type="image/svg+xml" />
    <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@500;700;900&display=swap" rel="stylesheet" />
    <link rel="stylesheet" href="/site.css" />
    ${meta.jsonLd ? `<script type="application/ld+json">${JSON.stringify(meta.jsonLd)}</script>` : ''}
    ${adsenseTags(adsenseClient)}
  </head>
  <body class="site-page">
    ${siteHeader(meta.canonical ?? meta.path)}
    <main class="site-main">
${body}
    </main>
    ${siteFooter()}
  </body>
</html>
`
}

/** The call to action that sends readers from any page back to the game. */
export function ctaBox(): string {
  return `<aside class="cta">
        <p class="cta-title">Think you can split it?</p>
        <p>Point your phone at your glass, take one sip and get a score out of 100. Free, in your browser, any glass.</p>
        <a class="button" href="/">Score your sip</a>
      </aside>`
}
