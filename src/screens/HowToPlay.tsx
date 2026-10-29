import { LinkButton, Page, PageTitle, SectionLabel } from '../components/ui'
import { Pint } from '../components/icons'

/** The game, the rules and how the scoring works, in plain words. */
export function HowToPlay() {
  return (
    <Page>
      <PageTitle sub="One sip. One line. One letter.">How to play</PageTitle>
      <div className="space-y-5 text-sm text-cream/75 leading-relaxed">
        <section>
          <SectionLabel>The game</SectionLabel>
          <p>
            Splitting the G is a pub challenge. You take one drink from a full pint and try to stop with the top of the beer exactly through the middle of
            the G printed on the glass. Too small a sip and the line sits above the G; too big and it drops below. Nobody gets to nudge it afterwards. The
            first sip is the only sip that counts.
          </p>
        </section>

        <section>
          <SectionLabel>Playing with any glass</SectionLabel>
          <p>
            You do not need the branded glass. The app knows where the G sits on the classic tulip pint, about thirty percent of the way down from the rim,
            and draws a ghost G in that spot on whatever glass you are holding. Switch to Official glass if you have the real thing and the ghost is hidden.
          </p>
        </section>

        <section>
          <SectionLabel>Scoring a pint</SectionLabel>
          <ol className="list-decimal pl-5 space-y-1.5">
            <li>Set the glass on a table and point the camera at it with the whole glass in view.</li>
            <li>The app finds the rim, the base and the walls on its own. Drag the RIM or BASE guides only if it got them wrong.</li>
            <li>Take your sip and put the glass back down.</li>
            <li>The app reads the beer line at the front of the glass and shows your score live. Tap the capture button when it looks right.</li>
          </ol>
        </section>

        <section>
          <SectionLabel>What the score means</SectionLabel>
          <p>
            Inside the bar of the G is a perfect 100, "Split the G!". Every percent of the glass height you miss by costs six points. 85 and up is "So
            close", 60 and up is "Decent sip", below that is a "Rookie pour". The result also tells you how far off you were in millimetres and which way,
            so the next one is better.
          </p>
        </section>

        <section>
          <SectionLabel>Friends and the daily G-off</SectionLabel>
          <p>
            Sign in with your email, pick a username and share your invite link. Everyone's best score of the day goes on the Contest board, which resets at
            midnight. Or text a challenge straight from a result and let a friend try to beat it.
          </p>
        </section>

        <section>
          <SectionLabel>Tips</SectionLabel>
          <ul className="list-disc pl-5 space-y-1.5">
            <li>A plain background behind the glass helps the camera find the walls.</li>
            <li>Keep the glass level with the camera, not viewed from high above, so the near edge of the liquid is clear.</li>
            <li>Stout with a thick head is the easiest to read. Clear drinks work too; the app looks for the meniscus line.</li>
          </ul>
        </section>

        <p className="text-cream/45 text-xs">For people of legal drinking age. Please drink responsibly. Not affiliated with any brewery.</p>

        <LinkButton to="/score" size="lg" className="w-full">
          <Pint size={22} />
          Score a pint
        </LinkButton>
      </div>
    </Page>
  )
}
