# NASA Space Apps 2026: three challenges ranked for fun and creative freedom

> **Superseded recommendation:** After clarifying that scientific usefulness, mission relevance, and impact should take priority over educational play, the recommended shortlist changed. Read [the revised science-and-impact assessment](2026-science-impact-shortlist.md). This earlier document is retained as background research, not the current recommendation.

Researched: November 3, 2026  
Event: November 14–15, 2026  
Starting point: [Official 2026 challenges](https://www.spaceappschallenge.org/2026/challenges/)

## Recommendation

**Choose Build a Junior Astronaut Mission Trainer for the best balance of fun, creative freedom, usable NASA data, and a feasible interactive demonstration.** Choose Abandoned but not Forgotten if freedom of expression matters most. Choose Space Mission Design Game if your team particularly enjoys systems, strategy, and engineering.

This is my assessment against your preferences, not NASA's ranking or a prediction of awards. I prioritized creative freedom and enjoyment, followed by data accessibility and what a small team could demonstrate over a weekend. No particular team size, game engine, or scientific specialization is assumed.

| Rank | Challenge | Why it fits | Main limitation |
| --- | --- | --- | --- |
| **1 — Best overall** | **Build a Junior Astronaut Mission Trainer** | Playful decisions, many possible formats, and real data that can affect the experience | Must teach meaningful engineering trade-offs to children |
| **2 — Most freedom** | **Abandoned but not Forgotten: Storytelling about NASA's Discarded Equipment on the Moon and Mars** | Widest choice of medium; rich historical material; low data-processing burden | Needs a compelling, accurate story connecting hardware to scientific discoveries |
| **3 — Best engineering playground** | **Space Mission Design Game** | Many mission scenarios, design choices, and opportunities for strategic play | Larger scope and more work to make the simulation coherent |

## 1. Build a Junior Astronaut Mission Trainer

[Official challenge and full brief](https://www.spaceappschallenge.org/2026/challenges/junior-astronaut-mission-trainer/)

### What NASA asks for

An interactive game or app in which children ages 7–12 manage an outpost and experience engineering trade-offs. The brief welcomes different formats and creative settings beyond the Moon and Mars, provided the learning goal stays central. It encourages real NASA data and explicitly accepts curated, embedded datasets when live API calls are impractical. Static data must be identified honestly.

### Why I rank it first

The challenge gives you a clear purpose while leaving substantial room to invent the experience. Decisions have consequences, which naturally creates tension, replayability, and discussion. A small prototype can communicate its value through one difficult choice rather than needing a large world.

It also offers an unusually useful relationship between science and gameplay: historical environmental observations can influence events, while clearly labeled simulation rules determine the player's resource costs.

### Creative directions to consider

These are illustrative possibilities, not official requirements or finished project designs:

- A cooperative outpost where players negotiate how to divide limited power.
- A branching survival story where each successful decision introduces a different problem.
- A tactile, visual resource game with minimal reading and optional narration.

**A realistic weekend scope:** one setting, a short playable session, two or three resources, and one NASA dataset used meaningfully. The challenge brief itself recommends avoiding too many simultaneous systems.

### Data fit

Start by investigating **DONKI** for historical space-weather events and **Curiosity REMS** for Martian environmental observations. **OSDR** can provide biological research context, but interpreting an entire biological dataset is unnecessary for a first prototype.

**Scientific boundary:** a solar flare record is not a direct measurement of an astronaut's radiation dose at an arbitrary outpost. Make the distinction between observed events and your educational simulation explicit.

## 2. Abandoned but not Forgotten

Full title: **Abandoned but not Forgotten: Storytelling about NASA's Discarded Equipment on the Moon and Mars**.

[Official challenge and full brief](https://www.spaceappschallenge.org/2026/challenges/nasas-discarded-equipment-storytelling/)

### What NASA asks for

A story-driven experience that introduces young or casual audiences to equipment left in space, its mission, and the science it enabled. The brief welcomes web experiences, games, illustrated books, animation, 3D timelines, and other approaches. Historical and scientific accuracy remain central.

### Why I rank it second

**This is the least restrictive of my three choices in terms of medium.** Your team's strengths can determine whether the result is a game, a story, an audio experience, or an interactive exhibit.

The available material already contains characters, obstacles, discoveries, and endings. You can spend more of the weekend creating an engaging experience and less preparing scientific files. I place it below the trainer only because, for an interactive software project, compelling participation is less automatic: a collection of facts and pictures can easily become passive browsing.

### Creative directions to consider

- A space archaeology mystery where visitors identify an artifact from clues.
- A rover's illustrated diary, with fictional narration clearly separated from sourced events.
- An explorable museum where each object reveals one discovery through a short interaction.

**A realistic weekend scope:** one mission, a handful of documented moments, and one memorable interaction. There is no need to cover every abandoned spacecraft.

### Data fit

The strongest starting combination is **NASA mission histories + the NASA Image and Video Library + NASA 3D Resources**. For a lunar map, add the **NSSDCA table of spacecraft and impacts on the Moon**.

**Scientific boundary:** preserve unknown or approximate locations. Do not turn uncertain coordinates into precise map pins, or fictional dialogue into supposed NASA quotations.

## 3. Space Mission Design Game

[Official challenge and full brief](https://www.spaceappschallenge.org/2026/challenges/space-mission-design-game/)

### What NASA asks for

An interactive game that lets participants design and manage a complete space mission, experiencing the effects of engineering choices and resource constraints. The brief encourages creative mechanics and scenarios. Collaboration for up to four players is suggested, not mandatory; this is a gameplay suggestion, not the hackathon team-size rule.

### Why I rank it third

It is an excellent playground for strategic experimentation: different designs can achieve the same objective, and a more powerful component can create new costs elsewhere. You can make the experience humorous, competitive, cooperative, or exploratory.

It ranks third because the mission lifecycle is broad. A convincing model of components, launch, operations, and success criteria can consume time that might otherwise go into polish. Public technical references exist, but they are not a ready-made, internally consistent game database.

### Creative directions to consider

- A component-selection card game where every upgrade changes several constraints.
- A cooperative mission room with competing science, power, and communications priorities.
- A mission workshop where players revise a failed design and immediately see why it improves.

**A realistic weekend scope:** one mission objective and a small component catalog, covering design through a simplified operational outcome. Multiplayer and detailed orbital physics can remain optional.

### Data fit

Use **NASA's Small Spacecraft Technology report** for subsystem references, **mission fact pages** for real examples, and **JPL Horizons** if planetary geometry is useful. Horizons supplies positions and related quantities; it does not solve an entire custom mission or provide a complete budget model.

**Scientific boundary:** label invented game costs, scoring weights, and simplified relationships. Do not present them as NASA engineering estimates.

## Public data and assets available now

The links below are independently researched public sources. They are **not represented as the final official challenge resource list**. Difficulty is my assessment of the effort required to use a small, relevant subset.

| Source | What is available | Access and format | Useful application | Effort / caveat |
| --- | --- | --- | --- | --- |
| [DONKI — NASA CCMC](https://ccmc.gsfc.nasa.gov/tools/DONKI/) | Space-weather event analyses, model outputs, notifications, and relationships between events | Public web application and [API documentation](https://ccmc.gsfc.nasa.gov/DONKI/api/) | Historical event scenarios for the trainer | **Low–medium.** Research/prototyping information, not site-specific radiation dosage. NASA reports a September 2026 URL migration; use the current CCMC links. |
| [Curiosity REMS — NASA PDS Atmospheres Node](https://pds-atmospheres.nmsu.edu/data_and_services/atmospheres_data/MARS/curiosity/rems.html) | Air/ground temperature, pressure, humidity, wind, and ultraviolet observations at Curiosity's location | Downloadable archive files and instrument documentation; processed temperature records include `.TAB` files | Environmental context for a Martian outpost | **Medium.** Historical local measurements, not a global live Mars weather feed. Check units, missing values, and confidence flags. |
| [NASA OSDR](https://science.nasa.gov/biological-physical/data/osdr/) | Space-biology studies, metadata, physiological and environmental information, and raw/processed files | [REST/tabular API](https://www.nasa.gov/osdr-api/), repository downloads; formats vary by study | Evidence for educational explanations about space biology | **Medium–high.** Open-access browsing/downloads [do not require login](https://www.nasa.gov/osdr-data-repository-portal-login/). Biological interpretation is the harder part. |
| [NASA Image and Video Library API](https://images.nasa.gov/docs/images.nasa.gov_api_docs.pdf) | Images, video, audio, descriptions, identifiers, and asset links | REST JSON; search and asset endpoints; documented browser CORS support | Visual evidence and atmosphere for all three projects | **Low.** Preserve credits and inspect each asset's usage information. Search results are metadata, not automatically the original full-resolution file. |
| [NASA 3D Resources](https://science.nasa.gov/3d-resources/) | Spacecraft and other space-related 3D assets | Downloadable assets; formats and sizes depend on the model | Inspectable artifacts, spacecraft, and scene objects | **Low–medium.** Inspect individual formats and model complexity before choosing a browser workflow. |
| [NSSDCA lunar spacecraft/impact table](https://nssdc.gsfc.nasa.gov/planetary/lunar/lunar_artifact_impacts.html) | Spacecraft names, landing/impact dates, locations, notes, and imaging status | Public HTML table with linked records | Lunar artifact map and historical timeline | **Low.** Contains non-NASA missions too. Coordinates vary in certainty and longitude convention; retain uncertainty and normalize deliberately. |
| [NASA Opportunity mission record](https://science.nasa.gov/mission/mer-opportunity/) | Mission milestones, instruments, hardware facts, discoveries, and linked visualizations | Public structured web content and linked assets | A focused, evidence-based rover story | **Low.** Distinguish launch-system mass from rover mass when extracting specifications. |
| [NASA Small Spacecraft Technology report](https://www.nasa.gov/smallsat-institute/sst-soa/) | References covering platforms, power, propulsion, communications, launch, and other subsystems | Web chapters, tables, and PDF downloads | A small, sourced component catalog for mission design | **Medium.** Reference material, not a uniform API. Some values originate from manufacturers; verify the context and units. |
| [JPL Horizons API](https://ssd-api.jpl.nasa.gov/doc/horizons.html) | Solar-system ephemerides: positions and related quantities for supported objects and times | HTTP API with JSON or text responses | Planetary geometry and communication-delay context | **Medium.** Requires correct reference frames, time settings, and units. It is not an arbitrary spacecraft trajectory optimizer. |

### What I actually verified

- Reviewed the 14 challenge summaries through the [UAE local-organizer listing](https://nasaspaceapps.ae/challenges), then read the live official full briefs for the three recommendations and Earth Information Jukebox. The official site needed browser rendering; several direct web fetches failed.
- Opened the public documentation or catalog pages linked above. This confirms documented availability, not that every download or API endpoint was tested.
- Retrieved an actual [OSDR file-list JSON response for OSD-87](https://osdr.nasa.gov/osdr/data/osd/files/87). It listed 18 files, including metadata and CSV data, with unrestricted file flags. This checks the access mechanism; it does not establish OSD-87 as the best scientific study for your project.
- Inspected the lunar table's actual fields and records, including its distinction between known, approximate, and unknown locations.
- A sample NASA media API request could not be fetched by the research tool. Its API documentation was accessible, but live media retrieval remains to be tested in the eventual development environment.

### Most practical starting bundles

| Choice | Start with | Add only if useful |
| --- | --- | --- |
| Junior Astronaut Trainer | A small DONKI historical event selection plus cited environmental context | REMS observations; a relevant OSDR finding |
| Abandoned but not Forgotten | One mission history plus a small set of credited images | A 3D model or lunar artifact coordinates |
| Space Mission Design Game | A small manually curated catalog from technical references and mission facts | Horizons geometry and 3D spacecraft assets |

For all three, traceable, meaningful use of a small dataset is a better practical target than integrating many unrelated APIs. Preserve the source URL, units, observation dates, and any transformations. Clearly distinguish observations, research findings, and your own simulation assumptions.

## Why the other candidates did not make this top three

These are fit judgments for your preferences, not judgments of scientific value.

- **Earth Information Jukebox:** the closest alternative, especially for a team interested in music and accessibility. Its [full brief](https://www.spaceappschallenge.org/2026/challenges/the-earth-information-jukebox/) allows several formats, including generated audio collections, but the central relationship remains EIC imagery translated into sound. It offers less thematic freedom than storytelling.
- **Martian Map / Earth analog locations:** promising for exploration and visual design, but scientific mapping and combining geospatial sources can become the main workload.
- **SAR, Earth-system trends, hotspot harmonization:** strong data-science opportunities, but their specified analytical tasks constrain the solution more tightly.
- **CLPS lunar planning, astronaut health, microgravity combustion, and crop rotations:** interesting domains, but they ask for more specific operational or scientific outcomes.
- **Planet X and SPHEREx:** attractive for discovery, but image handling and change inspection create a more specialized workflow.

These comparisons use the [published challenge summaries](https://nasaspaceapps.ae/challenges); only the four strongest creative candidates received full-brief review during this pass.

## Timing and remaining checks

The [official 2026 event page](https://www.spaceappschallenge.org/2026/) lists November 14–15. As checked on November 3, the trainer's [Resources tab](https://www.spaceappschallenge.org/2026/challenges/junior-astronaut-mission-trainer/?tab=resources) says resources will be available Friday, November 13. Revisit that list before committing to a data dependency.

The official site also explicitly says not to begin project work before the hackathon starts. This document is challenge-selection and public-resource research; no application, simulation, or submission has been built.

**My choice for you: Junior Astronaut Mission Trainer.** It offers the strongest combination of creative play, an understandable demonstration, and manageable data use. If you want the broadest possible artistic freedom, choose **Abandoned but not Forgotten** instead.
