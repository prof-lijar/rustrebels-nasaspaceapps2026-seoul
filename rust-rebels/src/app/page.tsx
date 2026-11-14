import Image from "next/image";
import { AppTour } from "@/components/app-tour";
import { SlideDeck } from "@/components/slide-deck";
import { deck } from "@/lib/deck";
import { appTour, crew, datasets, demoViews, hazards, links, payload, pipeline, stack, stats, stormSteps, waterVest, xrayLink } from "@/lib/content";

export default function Home() {
  return (
    <>
      <a className="skip-link" href="#main">Skip to content</a>
      <header className="site-header">
        <a className="wordmark" href="#" aria-label="Rust Rebels home">RR<span> / </span>RUST REBELS</a>
        <nav aria-label="Main navigation">
          <a href="#marswalk">App</a>
          <a href="#problem">Problem</a>
          <a href="#system">System</a>
          <a href="#storm">Storm</a>
          <a href="#demo">Demo</a>
          <a href="#crew">Crew</a>
          <a href="#deck">Deck <span aria-hidden="true">↗</span></a>
        </nav>
      </header>
      <main id="main">
        <section className="hero" aria-labelledby="hero-title">
          <div className="hero-image">
            <Image src="/images/rust-rebels-team.png" alt="Fictional Mars expedition concept art: three helmeted explorers studying rocky terrain." fill preload sizes="100vw" />
          </div>
          <div className="hero-shade" />
          <div className="hero-content">
            <p className="eyebrow">Interplanetary Survival Guide: Martian Map</p>
            <h1 id="hero-title">RUST<br /><span>REBELS.</span></h1>
            <p className="hero-copy">Science-rich Marswalks. Fewer wrong turns.<br />A scout-first, radiation-aware digital twin for human EVAs.</p>
            <div className="hero-actions"><a className="button" href="/app">Play the Marswalk <span aria-hidden="true">↗</span></a><a className="text-link" href="#problem">See how it works</a></div>
          </div>
          <div className="hero-caption"><span>Jezero Crater · 18.4°N 77.5°E</span><span>Fictional expedition concept art</span></div>
        </section>

        <section className="section" id="marswalk" aria-labelledby="marswalk-title">
          <p className="eyebrow">00 / The app</p>
          <div>
            <h2 id="marswalk-title">Marswalk,<br />screen by screen.</h2>
            <p>Six moments from the playable map. Use the arrows to step through, then try it yourself.</p>
            <AppTour slides={appTour} />
            <a className="text-link" href="/app">Play the Marswalk <span aria-hidden="true">↗</span></a>
          </div>
        </section>

        <section className="section" id="problem" aria-labelledby="problem-title">
          <p className="eyebrow">01 / The problem</p>
          <div>
            <h2 id="problem-title">A radiation field<br />with an old map.</h2>
            <p>Orbital maps are months old. Radiation, dust and terrain change by the hour.</p>
            <ul className="stat-grid">
              {stats.map((s) => (
                <li key={s.label}>
                  <strong>{s.value}{s.unit && <small> {s.unit}</small>}</strong>
                  <span>{s.label}</span>
                  <em>{s.source}</em>
                </li>
              ))}
            </ul>
            <h3 className="subhead">What can go wrong on a Marswalk</h3>
            <ul className="hazard-list">
              {hazards.map((h) => (
                <li key={h.name}><strong>{h.name}</strong><span>{h.body}</span></li>
              ))}
            </ul>
          </div>
        </section>

        <section className="section" id="system" aria-labelledby="system-title">
          <p className="eyebrow">02 / The system</p>
          <div>
            <h2 id="system-title">Scout first, then walk.</h2>
            <p>SuperJar scouts the route. The digital twin fuses its data with NASA orbital maps. The astronaut sees the result.</p>
            <ol className="pipeline">
              {pipeline.map((p) => (
                <li key={p.name}>
                  <span className="pipeline-phase">{p.phase}</span>
                  <strong>{p.name}</strong>
                  <span>{p.body}</span>
                </li>
              ))}
            </ol>
            <div className="callout-grid">
              <div className="callout">
                <strong>Closed loop: detect → update twin → re-plan</strong>
                <span>Every new rock or dose hot-spot SuperJar finds re-scores the route before the astronaut leaves.</span>
              </div>
              <div className="callout callout-amber">
                <strong>Orbiter relay (MRO, MAVEN) ↔ Earth</strong>
                <span>NASA DONKI solar-event alerts trigger the storm protocol.</span>
              </div>
            </div>
            <h3 className="subhead">SuperJar sensor payload</h3>
            <p className="subcopy">Eight instruments, each with flight heritage or a commercial equivalent.</p>
            <ul className="card-grid">
              {payload.map((p) => (
                <li key={p.name}>
                  <strong>{p.name}</strong>
                  <span className="card-spec">{p.spec}</span>
                  <span>{p.body}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="section" id="storm" aria-labelledby="storm-title">
          <p className="eyebrow">03 / The storm</p>
          <div>
            <h2 id="storm-title">Detect, warn,<br />reroute, shield.</h2>
            <p>The one moment that decides a Marswalk, handled in under ten minutes.</p>
            <ol className="timeline">
              {stormSteps.map((s) => (
                <li key={s.name}>
                  <span className="timeline-time">{s.time}</span>
                  <strong>{s.name}</strong>
                  <span>{s.body}</span>
                </li>
              ))}
            </ol>
            <div className="callout-grid">
              <div className="callout">
                <strong>Water vest: torso + hips</strong>
                <ul>{waterVest.map((t) => <li key={t}>{t}</li>)}</ul>
              </div>
              <div className="callout callout-amber">
                <strong>Backup link: X-ray communication</strong>
                <span className="callout-tag">Experimental · radio stays primary</span>
                <ul>{xrayLink.map((t) => <li key={t}>{t}</li>)}</ul>
              </div>
            </div>
          </div>
        </section>

        <section className="section" id="demo" aria-labelledby="demo-title">
          <p className="eyebrow">04 / The demo</p>
          <div>
            <h2 id="demo-title">Live in the browser,<br />built on real NASA data.</h2>
            <p>One crater, three views, one solar storm. Anyone can try it at our project link.</p>
            <ul className="view-grid">
              {demoViews.map((v) => (
                <li key={v.n}><span className="view-n">{v.n}</span><strong>{v.name}</strong><span>{v.body}</span></li>
              ))}
            </ul>
            <ul className="chip-list" aria-label="Stack">
              {stack.map((s) => <li key={s}>{s}</li>)}
            </ul>
            <table className="data-table">
              <caption>NASA datasets in the twin</caption>
              <thead><tr><th>Dataset</th><th>Mission</th><th>Layer in our twin</th></tr></thead>
              <tbody>
                {datasets.map((d) => (
                  <tr key={d.name}><th scope="row">{d.name}</th><td>{d.mission}</td><td>{d.layer}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="section section-crew" id="crew" aria-labelledby="crew-title">
          <p className="eyebrow">05 / The crew</p>
          <div className="crew-grid">
            <div>
              <h2 id="crew-title">Houston, we&rsquo;ve met Rocky.</h2>
              <ul className="crew-list">
                {crew.map((c) => (
                  <li key={c.name}><strong>{c.name}</strong><span>{c.role}</span></li>
                ))}
              </ul>
              <p>Plus two field robots: SuperJar, the scout who also guards the cookies, and Rocky, who carries the rocks.</p>
              <p className="link-row">
                <a className="text-link" href={links.teamPage} target="_blank" rel="noopener noreferrer">Team page on Space Apps <span aria-hidden="true">↗</span></a>
                <a className="text-link" href={links.github} target="_blank" rel="noopener noreferrer">Source on GitHub <span aria-hidden="true">↗</span></a>
              </p>
            </div>
            <figure className="crew-poster">
              <Image
                src="/images/rust-rebels-poster.png"
                alt="Rust Rebels team poster: engineer Li Jar and researcher Dr. Amar in Mars pressure suits with a route-planning tablet, joined by the robots SuperJar and Rocky. Tagline: Science-rich Marswalks. Fewer wrong turns."
                width={1024}
                height={1536}
                sizes="(max-width: 640px) 88vw, 36vw"
              />
            </figure>
          </div>
        </section>

        <section className="section" id="deck" aria-labelledby="deck-title">
          <p className="eyebrow">06 / The deck</p>
          <div>
            <h2 id="deck-title">The pitch, in eight slides.</h2>
            <p>Open the deck, use the arrow keys to move, and press Enter for full-screen presentation mode.</p>
            <SlideDeck slides={deck.slides} title={deck.title} pdfHref={deck.pdfHref} />
            <a className="text-link" href="#main">Back to the frontier <span aria-hidden="true">↑</span></a>
          </div>
        </section>
      </main>
      <footer className="site-footer">
        <span>RUST REBELS · NASA Space Apps Challenge 2026 · Seoul</span>
        <nav aria-label="External links" className="footer-links">
          <a href={links.challenge} target="_blank" rel="noopener noreferrer">Challenge brief</a>
          <a href={links.teamPage} target="_blank" rel="noopener noreferrer">Team page</a>
          <a href={links.github} target="_blank" rel="noopener noreferrer">GitHub</a>
        </nav>
      </footer>
    </>
  );
}
