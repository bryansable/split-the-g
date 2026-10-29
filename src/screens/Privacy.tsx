import { Page, PageTitle, SectionLabel } from '../components/ui'

const CONTACT = 'bryansable52@gmail.com'

/** Plain-language privacy policy. Required by ad networks and app stores. */
export function Privacy() {
  return (
    <Page>
      <PageTitle sub="Last updated 29 October 2026">Privacy</PageTitle>
      <div className="space-y-5 text-sm text-cream/75 leading-relaxed">
        <p>
          Split The G is an independent app run by one person. This page says what the app collects, what it does with it, and what it never does.
        </p>

        <section>
          <SectionLabel>The camera</SectionLabel>
          <p>
            The camera is used only to find your glass and the liquid line. Frames are analysed on your phone and are never uploaded. The snapshot shown
            on your result stays on your phone unless you choose to share it.
          </p>
        </section>

        <section>
          <SectionLabel>Scores and history</SectionLabel>
          <p>
            Your scores are stored on your phone. If you sign in, they are also stored in the app's database, run on Supabase, so they follow you between
            devices and can appear on your friends' leaderboards.
          </p>
        </section>

        <section>
          <SectionLabel>Accounts</SectionLabel>
          <p>
            Signing in uses your email address and nothing else. We send a sign-in link to it and keep it so you can sign in again. Your username is
            visible to people you add as friends and to anyone who types it in to add you. You can sign out at any time, and you can ask for your account
            and scores to be deleted by emailing the address below.
          </p>
        </section>

        <section>
          <SectionLabel>Cookies and storage</SectionLabel>
          <p>
            The app uses your browser's local storage to keep your scores, your sign-in session, and your answer to the age question. It sets no tracking
            cookies of its own.
          </p>
        </section>

        <section>
          <SectionLabel>Advertising</SectionLabel>
          <p>
            Some screens may show adverts served by Google AdSense. Google and its partners may use cookies or device identifiers to show ads based on your
            visits to this and other sites. You can opt out of personalised advertising at{' '}
            <a className="text-gold underline underline-offset-4" href="https://www.google.com/settings/ads" rel="noreferrer" target="_blank">
              google.com/settings/ads
            </a>
            . Where the law requires it, you will be asked for consent before any such cookies are set.
          </p>
        </section>

        <section>
          <SectionLabel>Age</SectionLabel>
          <p>The app is a game about beer. It is intended only for people of legal drinking age where they live. Please drink responsibly.</p>
        </section>

        <section>
          <SectionLabel>Contact</SectionLabel>
          <p>
            Questions, or a request to delete your data:{' '}
            <a className="text-gold underline underline-offset-4" href={`mailto:${CONTACT}`}>
              {CONTACT}
            </a>
            .
          </p>
        </section>

        <p className="text-cream/45 text-xs">Split The G is an independent fan project and is not affiliated with or endorsed by any brewery.</p>
      </div>
    </Page>
  )
}
