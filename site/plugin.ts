import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import type { Plugin } from 'vite'
import { SITE_URL, adsenseTags, ctaBox, esc, renderPage, siteFooter, siteHeader, type PageMeta } from './layout'
import { TIER_COLOR, TIER_TITLE, tierFor } from '../src/engine/score'

/**
 * The crawlable half of pintsplit.com. The game is a client-side React app, so
 * everything a search engine or ad reviewer should read is plain HTML built
 * here: the home page text around the app, the info pages, the blog, a
 * sitemap and robots.txt.
 *
 * Pages are emitted as `name.html`; GitHub Pages serves them at `/name` with a 200.
 */

const DIR = join(process.cwd(), 'site')

interface Doc {
  slug: string
  title: string
  description: string
  date: string
  html: string
}

/** A content file: a `<!-- key: value -->` header, then an HTML fragment. */
function readDoc(file: string, slug: string): Doc {
  const raw = readFileSync(file, 'utf8').replace(/^﻿/, '')
  const m = raw.match(/^\s*<!--([\s\S]*?)-->/)
  if (!m) throw new Error(`${file}: missing metadata comment`)
  const meta: Record<string, string> = {}
  for (const line of m[1].split(/\r?\n/)) {
    const i = line.indexOf(':')
    if (i > 0) meta[line.slice(0, i).trim()] = line.slice(i + 1).trim()
  }
  for (const k of ['title', 'description', 'date']) if (!meta[k]) throw new Error(`${file}: missing ${k}`)
  return { slug, title: meta.title, description: meta.description, date: meta.date, html: raw.slice(m[0].length).trim() }
}

function readDir(dir: string): Doc[] {
  return readdirSync(join(DIR, dir))
    .filter((f) => f.endsWith('.html'))
    .map((f) => readDoc(join(DIR, dir, f), f.replace(/\.html$/, '')))
}

/** Blog posts in a fixed reading order (the order of this list), then any others by date. */
const ORDER = [
  'what-is-split-the-g',
  'how-to-split-the-g',
  'two-part-pour',
  'why-stout-is-creamy',
  'tulip-pint-glass',
  'how-the-app-scores',
  'photograph-your-pint',
  'host-a-g-off',
  'split-the-g-etiquette',
  'alcohol-free-split-the-g',
  'drink-responsibly-pub-games',
  'pint-sizes-around-the-world',
]

function posts(): Doc[] {
  const rank = (s: string) => (ORDER.includes(s) ? ORDER.indexOf(s) : ORDER.length)
  return readDir('blog').sort((a, b) => rank(a.slug) - rank(b.slug) || b.date.localeCompare(a.date))
}

function words(html: string): number {
  return html.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length
}

function niceDate(iso: string): string {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
}

function postList(list: Doc[]): string {
  return `<ul class="post-list">${list
    .map(
      (p) => `
        <li><a href="/blog/${p.slug}"><span class="post-title">${esc(p.title)}</span><span class="post-desc">${esc(p.description)}</span></a></li>`,
    )
    .join('')}
      </ul>`
}

function articlePage(p: Doc, all: Doc[]): string {
  const i = all.findIndex((x) => x.slug === p.slug)
  const more = [1, 2, 3].map((k) => all[(i + k) % all.length]).filter((x) => x.slug !== p.slug)
  const minutes = Math.max(1, Math.round(words(p.html) / 220))
  return `      <nav class="crumbs" aria-label="Breadcrumb"><a href="/">Home</a> › <a href="/blog">Blog</a></nav>
      <article class="prose">
        <h1>${esc(p.title)}</h1>
        <p class="byline">${niceDate(p.date)} · ${minutes} min read</p>
        ${p.html}
      </article>
      ${ctaBox()}
      <section class="more">
        <h2>Keep reading</h2>
        ${postList(more)}
      </section>`
}

interface Built {
  path: string
  file: string
  html: string
}

/** Every generated page, keyed by URL path. Read fresh each call so dev picks up edits. */
export function buildPages(adsenseClient: string | undefined): Built[] {
  const out: Built[] = []
  const page = (meta: PageMeta, body: string) =>
    out.push({ path: meta.path, file: `${meta.path.slice(1)}.html`, html: renderPage(meta, body, adsenseClient) })

  for (const d of readDir('pages')) {
    const body = `      <article class="prose">
        <h1>${esc(d.title.split(' | ')[0])}</h1>
        <p class="byline">Last updated ${niceDate(d.date)}</p>
        ${d.html}
      </article>`
    page({ path: `/${d.slug}`, title: d.title, description: d.description }, body)
    // /privacy-policy is a common guess; serve the same policy there, canonical to /privacy.
    if (d.slug === 'privacy') page({ path: '/privacy-policy', canonical: '/privacy', title: d.title, description: d.description }, body)
  }

  const all = posts()
  page(
    {
      path: '/blog',
      title: 'Blog: Split the G Technique, Pints and Pub Games | Split The G',
      description: 'Guides to splitting the G: technique, the two-part pour, glassware, hosting a G-off, photographing your pint and playing responsibly.',
    },
    `      <article class="prose">
        <h1>The Split The G blog</h1>
        <p>Everything around the one sip: how to land it, why the stout behaves the way it does, how to run a G-off with friends, and how to play without annoying the bar or overdoing it. Written by the person who builds the app.</p>
      </article>
      ${postList(all)}
      ${ctaBox()}`,
  )
  for (const p of all) {
    page(
      {
        path: `/blog/${p.slug}`,
        title: `${p.title} | Split The G`,
        description: p.description,
        type: 'article',
        jsonLd: {
          '@context': 'https://schema.org',
          '@type': 'Article',
          headline: p.title,
          description: p.description,
          datePublished: p.date,
          dateModified: p.date,
          mainEntityOfPage: `${SITE_URL}/blog/${p.slug}`,
          image: `${SITE_URL}/hero.jpg`,
          publisher: { '@type': 'Organization', name: 'Split The G', url: SITE_URL },
        },
      },
      articlePage(p, all),
    )
  }

  page(
    { path: '/404', title: 'Page not found | Split The G', description: 'That page does not exist on pintsplit.com.' },
    `      <article class="prose">
        <h1>That one missed the G</h1>
        <p>The page you asked for isn't here. It may have moved, or the link may have a typo.</p>
        <p><a href="/">Go to the game</a> or <a href="/blog">read the blog</a>.</p>
      </article>`,
  )
  return out
}

function sitemap(pages: Built[]): string {
  const today = new Date().toISOString().slice(0, 10)
  const urls = ['/', ...pages.map((p) => p.path).filter((p) => p !== '/404' && p !== '/privacy-policy')]
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url><loc>${SITE_URL}${u === '/' ? '/' : u}</loc><lastmod>${today}</lastmod></url>`).join('\n')}
</urlset>
`
}

/*
 * Challenge links: /c/<score> for every score 0-100. Each page carries a link
 * preview made for that score (title and a 1200x630 image), so a link pasted
 * into a chat or a post says "Can you beat 87?". People are sent straight on
 * to the app's #/challenge screen with the same query; link-preview bots
 * don't run scripts, so they read the tags.
 */
const SCORES = Array.from({ length: 101 }, (_, i) => i)

function challengePage(score: number, adsenseClient: string | undefined): string {
  const title = `Can you beat ${score}/100? | Split The G`
  const desc = 'A friend took one sip and scored ' + score + '. Your turn: point your phone at your glass, take one sip and land the line on the G.'
  const img = `${SITE_URL}/og/${score}.png`
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="robots" content="noindex" />
    <title>${title}</title>
    <meta name="description" content="${desc}" />
    <link rel="canonical" href="${SITE_URL}/" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="Split The G" />
    <meta property="og:title" content="Can you beat ${score}/100?" />
    <meta property="og:description" content="${desc}" />
    <meta property="og:url" content="${SITE_URL}/c/${score}" />
    <meta property="og:image" content="${img}" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:image:alt" content="Split The G challenge: ${score} out of 100" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="Can you beat ${score}/100?" />
    <meta name="twitter:description" content="${desc}" />
    <meta name="twitter:image" content="${img}" />
    <link rel="icon" href="/icon.svg" type="image/svg+xml" />
    <link rel="stylesheet" href="/site.css" />
    <script>location.replace('/#/challenge?' + new URLSearchParams(Object.assign({ s: '${score}' }, Object.fromEntries(new URLSearchParams(location.search)))))</script>
    ${adsenseTags(adsenseClient)}
  </head>
  <body class="site-page">
    <main class="site-main">
      <article class="prose">
        <h1>Can you beat ${score}/100?</h1>
        <p>A friend took one sip and scored ${score} on Split The G. <a href="/#/challenge?s=${score}">Take the challenge</a>.</p>
      </article>
    </main>
  </body>
</html>
`
}

/** The preview image for one score, as SVG for resvg (Cinzel only; no system fonts in CI). */
function challengeSvg(score: number): string {
  const tier = tierFor(score)
  const color = TIER_COLOR[tier]
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="#0d0906"/>
  <ellipse cx="330" cy="315" rx="230" ry="250" fill="#1c130d"/>
  <rect x="18" y="18" width="1164" height="594" fill="none" stroke="#c9a447" stroke-width="5"/>
  <rect x="32" y="32" width="1136" height="566" fill="none" stroke="#c9a447" stroke-opacity="0.35" stroke-width="1.5"/>
  <ellipse cx="330" cy="315" rx="230" ry="250" fill="none" stroke="#c9a447" stroke-opacity="0.18" stroke-width="10"/>
  <text x="330" y="370" text-anchor="middle" font-family="Cinzel" font-weight="700" font-size="${score === 100 ? 200 : 230}" fill="${color}">${score}</text>
  <text x="330" y="450" text-anchor="middle" font-family="Cinzel" font-size="40" fill="#f3e6c9" letter-spacing="6">OUT OF 100</text>
  <text x="640" y="150" font-family="Cinzel" font-size="30" fill="#c9a447" letter-spacing="10">SPLIT THE G</text>
  <text x="640" y="250" font-family="Cinzel" font-weight="700" font-size="72" fill="#f3e6c9">Can you</text>
  <text x="640" y="335" font-family="Cinzel" font-weight="700" font-size="72" fill="#f3e6c9">beat it?</text>
  <text x="640" y="400" font-family="Cinzel" font-size="34" fill="${color}">${esc(TIER_TITLE[tier])}</text>
  <rect x="640" y="460" width="420" height="72" rx="36" fill="#c9a447"/>
  <text x="850" y="507" text-anchor="middle" font-family="Cinzel" font-weight="700" font-size="34" fill="#0d0906">pintsplit.com</text>
</svg>`
}

async function challengePng(score: number): Promise<Buffer> {
  const { Resvg } = await import('@resvg/resvg-js')
  const font = { fontFiles: [join(DIR, 'fonts', 'Cinzel.ttf')], loadSystemFonts: false, defaultFontFamily: 'Cinzel' }
  return new Resvg(challengeSvg(score), { font }).render().asPng()
}

const ROBOTS = `User-agent: *
Allow: /

Sitemap: ${SITE_URL}/sitemap.xml
`

/** Fills the placeholders in index.html: the site nav, footer and latest posts around the app. */
function fillIndex(html: string): string {
  return html
    .replace('<!--site-header-->', siteHeader('/'))
    .replace('<!--site-footer-->', siteFooter())
    .replace('<!--site-latest-->', postList(posts().slice(0, 6)))
    .replace('<!--site-cta-->', ctaBox())
}

export function sitePages(adsenseClient: string | undefined): Plugin {
  return {
    name: 'site-pages',
    transformIndexHtml: { order: 'pre', handler: fillIndex },
    configureServer(server) {
      // Serve the generated pages in dev at the same paths as production.
      server.middlewares.use((req, res, next) => {
        const path = (req.url ?? '').split('?')[0].replace(/\.html$/, '').replace(/(.)\/$/, '$1')
        if (path === '/sitemap.xml' || path === '/robots.txt') {
          res.setHeader('Content-Type', path.endsWith('.xml') ? 'application/xml' : 'text/plain')
          res.end(path === '/robots.txt' ? ROBOTS : sitemap(buildPages(adsenseClient)))
          return
        }
        const c = path.match(/^\/c\/(\d{1,3})$/)
        if (c && Number(c[1]) <= 100) {
          res.setHeader('Content-Type', 'text/html; charset=utf-8')
          res.end(challengePage(Number(c[1]), adsenseClient))
          return
        }
        const og = (req.url ?? '').match(/^\/og\/(\d{1,3})\.png/)
        if (og && Number(og[1]) <= 100) {
          challengePng(Number(og[1])).then((png) => {
            res.setHeader('Content-Type', 'image/png')
            res.end(png)
          }, next)
          return
        }
        const hit = buildPages(adsenseClient).find((p) => p.path === path)
        if (!hit) return next()
        res.setHeader('Content-Type', 'text/html; charset=utf-8')
        res.end(hit.html)
      })
    },
    async generateBundle() {
      for (const n of SCORES) {
        this.emitFile({ type: 'asset', fileName: `c/${n}.html`, source: challengePage(n, adsenseClient) })
        this.emitFile({ type: 'asset', fileName: `og/${n}.png`, source: await challengePng(n) })
      }
      const pages = buildPages(adsenseClient)
      for (const p of pages) this.emitFile({ type: 'asset', fileName: p.file, source: p.html })
      this.emitFile({ type: 'asset', fileName: 'sitemap.xml', source: sitemap(pages) })
      this.emitFile({ type: 'asset', fileName: 'robots.txt', source: ROBOTS })
    },
  }
}
