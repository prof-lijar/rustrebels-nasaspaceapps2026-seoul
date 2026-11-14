import Image from "next/image";

export default function Home() {
  return (
    <>
      <a className="skip-link" href="#main">Skip to content</a>
      <header className="site-header">
        <a className="wordmark" href="#" aria-label="Rust Rebels home">RR<span> / </span>RUST REBELS</a>
        <nav aria-label="Main navigation">
          <a href="#mission">The mission</a>
          <a href="#approach">Our approach</a>
          <a href="#crew">The crew <span aria-hidden="true">↗</span></a>
        </nav>
      </header>
      <main id="main">
        <section className="hero" aria-labelledby="hero-title">
          <div className="hero-image">
            <Image src="/images/rust-rebels-team.png" alt="Fictional Mars expedition concept art: three helmeted explorers studying rocky terrain." fill preload sizes="100vw" />
          </div>
          <div className="hero-shade" />
          <div className="hero-content">
            <p className="eyebrow">Curiosity has a new frontier.</p>
            <h1 id="hero-title">RUST<br /><span>REBELS.</span></h1>
            <p className="hero-copy">Serious curiosity. Bold experiments.<br />Red dust on everything.</p>
            <a className="button" href="#mission">Discover the mission <span aria-hidden="true">↗</span></a>
          </div>
          <div className="hero-caption"><span>Big ideas. Real science. A little mischief.</span><span>Fictional expedition concept art</span></div>
        </section>
        <section className="section" id="mission" aria-labelledby="mission-title">
          <p className="eyebrow">01 / The mission</p>
          <div>
            <h2 id="mission-title">A little garage-inventor<br />energy. A whole new world.</h2>
            <p>We’re Rust Rebels, bringing garage-inventor energy to Mars exploration. Our aim: turn NASA terrain, imagery, and geological data into an intuitive tool for planning science-rich Marswalks, comparing routes, and making uncertainty visible.</p>
          </div>
        </section>
        <section className="section" id="approach" aria-labelledby="approach-title">
          <p className="eyebrow">02 / Our approach</p>
          <div>
            <h2 id="approach-title">Explore. Question. Build.</h2>
            <p>Planetary science, geospatial analysis, coding, data visualization, and design. One shared curiosity about what comes next.</p>
          </div>
        </section>
        <section className="section section-crew" id="crew" aria-labelledby="crew-title">
          <p className="eyebrow">03 / The crew</p>
          <div className="crew-grid">
            <div>
              <h2 id="crew-title">Houston, we&rsquo;ve met Rocky.</h2>
              <p>Li Jar, engineer at KAIST OverEdge, and Dr. Amar, researcher at KAIST, plus two field robots: SuperJar, who guards the cookies, and Rocky, who carries the rocks. Science-rich Marswalks. Fewer wrong turns.</p>
              <a className="text-link" href="#main">Back to the frontier <span aria-hidden="true">↑</span></a>
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
      </main>
      <footer className="site-footer"><span>RUST REBELS</span><span>Red dust on everything.</span></footer>
    </>
  );
}
