import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import type { Plugin } from 'vite'
import { SITE_URL, ctaBox, esc, renderPage, siteFooter, siteHeader, type PageMeta } from './layout'

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
        const hit = buildPages(adsenseClient).find((p) => p.path === path)
        if (!hit) return next()
        res.setHeader('Content-Type', 'text/html; charset=utf-8')
        res.end(hit.html)
      })
    },
    generateBundle() {
      const pages = buildPages(adsenseClient)
      for (const p of pages) this.emitFile({ type: 'asset', fileName: p.file, source: p.html })
      this.emitFile({ type: 'asset', fileName: 'sitemap.xml', source: sitemap(pages) })
      this.emitFile({ type: 'asset', fileName: 'robots.txt', source: ROBOTS })
    },
  }
}
