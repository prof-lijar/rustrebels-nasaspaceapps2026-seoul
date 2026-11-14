# NASA Space Apps 2026: revised shortlist for science, creativity, and impact

Reviewed: November 3, 2026  
Source: [Official 2026 challenge list](https://www.spaceappschallenge.org/2026/challenges/)

## Decision

**My revised recommendation is Interplanetary Survival Guide: Martian Map.** It best combines a serious exploration purpose, substantial freedom of interaction design, rich existing observations, and an exciting demonstration.

**Choose Dancing with the SARs instead if immediate usefulness on Earth is the deciding factor.** Choose **Planet X and SPHEREx** if the team is most excited by astronomical investigation and potential discovery.

The earlier ranking over-weighted educational play and ease of demonstration. The clarified aim is a scientifically grounded tool that helps somebody investigate, decide, or act, while making the experience enjoyable through exploration and experimentation. Educational projects can have value, but they are not the best fit for this aim.

These rankings are my judgments, not NASA ratings. Potential impact is distinguished from demonstrated impact; none of these concepts has been validated with users or built.

| Rank | Challenge | Strongest value | Creative opportunity | Main difficulty |
| --- | --- | --- | --- | --- |
| **1** | **Interplanetary Survival Guide: Martian Map** | Support local exploration planning and geological investigation | Mission control, route comparison, terrain exploration, spacesuit-style displays | Aligning datasets and respecting their resolution |
| **2** | **Dancing with the SARs** | Help investigate environmental changes affecting real communities | Interactive radar investigation, temporal comparisons, evidence exploration | SAR interpretation and verifying suitable observations |
| **3** | **Planet X and SPHEREx** | Help users inspect changing skies and prepare candidate evidence | Multi-epoch exploration, spectral comparisons, collaborative investigation | Astronomical calibration, alignment, artifacts, and false positives |

## 1. Interplanetary Survival Guide: Martian Map

[Full official brief](https://www.spaceappschallenge.org/2026/challenges/interplanetary-survival-guide-martian-map/)

### Why it fits

The brief asks for a localized, integrated view of Mars that helps an explorer carry out science. It welcomes different interfaces, including planning displays and a helmet HUD. It suggests combining several data types and choosing a scientific objective and location.

This is a strong fit for the inventive mission-control feel you described: inspect an actual landscape, examine evidence, compare possible paths, and understand the consequences of a choice.

### Where useful value could come from

**Proposed direction: an evidence-based Mars fieldwork planner.** A researcher selects a geological target, compares routes against terrain constraints, and inspects the observations behind each recommendation.

The interesting question is: “Which route reaches useful science targets while respecting a stated terrain and distance budget?”

Potential early users include planetary-science students, researchers, analog-mission teams, and rover-planning educators. Actual astronaut deployment would require much more validation. Near-term value is in scientific investigation and planning experiments, not a claim of operational mission readiness.

### Data available

- [Mars Trek WMTS services](https://trek.nasa.gov/tiles/apidoc/trekAPI.html?body=mars): public map-layer catalog, including regional imagery and global context. The catalog includes Curiosity and Jezero imagery. Rendered map tiles provide visual context; they are not interchangeable with numerical elevation data.
- [HiRISE terrain models](https://hirise.lpl.arizona.edu/dtm/): local terrain products derived from stereo imagery. The [format guide](https://hirise.lpl.arizona.edu/dtm/howto.php) documents 32-bit PDS `.IMG` rasters and conversion to GeoTIFF. Coverage is local rather than continuous across Mars.
- [MRO CRISM archive](https://pds-geosciences.wustl.edu/missions/mro/crism.htm): spectral products for geological/compositional investigation, including map-projected derived products. Interpretation and quality checking remain necessary.
- [Curiosity REMS](https://pds-atmospheres.nmsu.edu/data_and_services/atmospheres_data/MARS/curiosity/rems.html): optional environmental context for Gale Crater, with measurement dates and location retained.

**First feasibility check:** select one small region with overlapping optical imagery, numerical terrain, and a useful science layer. Jezero and Gale are candidates, not confirmed complete bundles. Do not promise either until overlap and scale are checked.

### What would make it more than another map

Existing Mars Trek and scientific archives already provide powerful browsing. The differentiator should be a specific task: explain why one route or target set better meets a scientific objective, with visible evidence and uncertainty.

During the hackathon, a meaningful demonstration could compare a simple shortest-path baseline with a terrain-constrained route and report distance, ascent, slope exposure, targets reached, and data coverage. Suit endurance or oxygen estimates should remain explicitly assumed until supported by an appropriate model.

**Critical limit:** coarse regional elevation cannot establish that a human walking route is safe. Show unknown areas and resolution limits; do not infer small hazards from data that cannot resolve them.

## 2. Dancing with the SARs

[Full official brief](https://www.spaceappschallenge.org/2026/challenges/dancing-with-the-sars/)

### Why it fits

The challenge calls for NISAR radar observations to investigate surface changes. The choice of location and phenomenon is broad: wetlands, forests, floods, agriculture, ice, and deformation are among the possibilities. This gives creative freedom while retaining a serious observational basis.

**This is the strongest choice for near-term societal impact.** Its potential beneficiaries already exist: local environmental groups, researchers, resource managers, and public agencies.

### Where useful value could come from

**Proposed direction: a surface-change investigation tool.** A user explores a location across dates, sees where radar measurements changed, and checks supporting observations and limitations.

For a first study, wetland or surface-water change may be more manageable than a full ground-deformation workflow. A Korean location could make the work locally relevant, but the location must follow usable data coverage.

The enjoyable element is scientific detective work: reveal changes, compare hypotheses, examine counterevidence, and assemble a reproducible explanation.

### Data available and access constraints

- [ASF NISAR access guide](https://nisar-docs.asf.alaska.edu/access-overview/): L-band products are archived by ASF. Downloads require a free Earthdata Login. S-band access is through ISRO's Bhoonidhi platform.
- [GCOV product guide](https://nisar-docs.asf.alaska.edu/gcov/): calibrated, terrain-corrected backscatter products, a practical starting point for many amplitude-based comparisons. Polarizations and pixel spacing depend on acquisition configuration.
- [Vertex download/subsetting guide](https://nisar-docs.asf.alaska.edu/vertex/): search, HDF5 downloads, and support for subsetting suitable products.
- [Available-data notice](https://nisar-docs.asf.alaska.edu/availability-overview/): provisional products were released July 20, 2026, with limited-site validation. The notice warns about mixing beta and provisional processing and documents an instrument gap from July 27 to August 10, 2026. Check current product maturity and known issues for the selected scenes.

**First feasibility check:** find at least two compatible observations over one region, using comparable acquisition geometry, polarization, and processing versions. Inspect quality masks and an independent reference before treating a difference as environmental change.

### What would demonstrate impact

A useful prototype should help a person investigate a particular question, not merely toggle satellite layers. Examples of evidence include agreement with an independently mapped event, false-positive analysis, and the time required to identify and document a changed area.

**Critical limit:** a radar difference does not establish its cause. Moisture, viewing geometry, vegetation, noise, and processing can affect the result. GCOV amplitude change is not a substitute for a properly processed deformation analysis. This should be presented as a research/decision-support prototype, not an emergency-warning service.

## 3. Planet X and SPHEREx

[Full official brief](https://www.spaceappschallenge.org/2026/challenges/planet-x-and-spherex/)

### Why it fits

This offers the clearest discovery experience. The required core is a web tool that displays SPHEREx observations of a sky region over time so users can inspect changes. The brief suggests named targets for testing and welcomes spectral exploration and comparisons with other surveys.

It ranks third because data processing is demanding and the core task is more prescribed than the first two. It is still a stronger match than an educational game when the fun comes from doing real investigation.

### Where useful value could come from

**Proposed direction: a candidate-investigation workbench.** Users inspect aligned observations, distinguish plausible changes from artifacts, compare known catalog information, and export a compact evidence record.

Potential users include citizen scientists and astronomy researchers. The credible outcome is making inspection and follow-up easier. Discovering a new planet is an aspiration, not a promised hackathon result.

### Data available

- [IRSA SPHEREx portal](https://irsa.ipac.caltech.edu/Missions/spherex.html): access to QR2 and QR3 releases, a Data Explorer, cloud data, and existing science tools.
- [SPHEREx cutout service](https://irsa.ipac.caltech.edu/data/SPHEREx/docs/cutout_tool.html): spatial subsets of spectral-image FITS files, available through the Explorer, direct URLs, and Python tutorials. Full files can be hundreds of megabytes; cutouts reduce the volume.
- [Cutout technical guidance](https://irsa.ipac.caltech.edu/onlinehelp/spherex/spherex/cutouts.html): image extensions, coordinates, wavelength dependence, and point-spread functions require care.

**First feasibility check:** find suitable repeated observations of one brief-specified target, such as Barnard's Star, and demonstrate an interpretable comparison before generalizing to arbitrary sky regions. Suitable epochs, bands, and detectable motion have not been confirmed in this research pass.

### What would make it useful

IRSA already offers cutouts, mosaics, source discovery, and moving-object search. A basic sky viewer alone is a weak differentiator. The opportunity is a more coherent investigation workflow with evidence provenance, quality flags, understandable uncertainty, and human review.

A meaningful evaluation could test recovery of known objects or variations, false positives, and inspection time. Differences caused by wavelength, registration, calibration, or image quality must not be presented as discoveries.

## Reassessment of every challenge

All 14 current summaries were reviewed, and all ten non-shortlisted scientific/applied briefs from the earlier pass were read in full during this reassessment. Together with the earlier full-brief review of the four creative/educational options, every challenge has now received full-brief review in this session. Full data feasibility work remains concentrated on the revised top three.

| Challenge | Revised assessment |
| --- | --- |
| [Martian Map](https://www.spaceappschallenge.org/2026/challenges/interplanetary-survival-guide-martian-map/) | **#1:** strongest blend of exploration, creativity, and scientific planning. |
| [Dancing with the SARs](https://www.spaceappschallenge.org/2026/challenges/dancing-with-the-sars/) | **#2:** strongest immediate community/environmental value. Could become #1 if that is the priority. |
| [Planet X and SPHEREx](https://www.spaceappschallenge.org/2026/challenges/planet-x-and-spherex/) | **#3:** strongest discovery appeal; considerable calibration and validation work. |
| [Earth analogs for Moon/Mars](https://www.spaceappschallenge.org/2026/challenges/permanent-moon-base-locations-and-mars/) | Closest alternative for maximum scientific freedom. Useful for field testing, but credible similarity criteria and validation are harder than producing a visually convincing match. |
| [Lunar Landing Site Navigator](https://www.spaceappschallenge.org/2026/challenges/lunar-landing-site-navigator/) | Strong alternative for concrete mission-engineering utility. Focuses on Sun/Earth visibility and site/date comparison; narrower scope but an identifiable planning task. Terrain horizons matter. |
| [Flame in Freefall](https://www.spaceappschallenge.org/2026/challenges/flame-in-freefall/) | Serious research value for spacecraft fire safety. Best with combustion expertise; avoid a generic document chatbot. The brief says PSI currently lacks partial-gravity combustion data, which limits direct lunar/Martian extrapolation. |
| [Earth System Trend Detective](https://www.spaceappschallenge.org/2026/challenges/earth-system-trend-detective/) | Broad science questions and credible analysis potential. Must provide trend/significance analysis, with careful handling of seasonal patterns and statistical assumptions. |
| [Field Shift](https://www.spaceappschallenge.org/2026/challenges/adapting-farms-with-nasa-data/) | Strong practical agricultural value. Credible crop-rotation advice depends on local soils, crop knowledge, constraints, and farmer input. |
| [MODIS/VIIRS Hot Spots](https://www.spaceappschallenge.org/2026/challenges/modis-and-viirs-hot-spots/) | Strong fire-management relevance. Sensor harmonization is the central scientific challenge; a polished calendar alone would not solve it. Less freedom to change the task. |
| [Astronaut Health Monitoring](https://www.spaceappschallenge.org/2026/challenges/health-monitoring-software/) | Important mission problem. Representative data and medically justified interpretation are substantial hurdles; a generic dashboard risks adding little scientific value. |
| [Earth Information Jukebox](https://www.spaceappschallenge.org/2026/challenges/the-earth-information-jukebox/) | Valuable for accessibility and science communication; weaker fit for the requested mission/scientific-analysis priority. |
| [Space Mission Design Game](https://www.spaceappschallenge.org/2026/challenges/space-mission-design-game/) | Explicit educational simulation; deprioritized under the clarified criteria. |
| [Junior Astronaut Mission Trainer](https://www.spaceappschallenge.org/2026/challenges/junior-astronaut-mission-trainer/) | Explicitly aimed at children; no longer recommended for this team's stated ambition. |
| [Abandoned but not Forgotten](https://www.spaceappschallenge.org/2026/challenges/nasas-discarded-equipment-storytelling/) | High storytelling freedom, with primarily educational/historical outcomes. |

The live title **Lunar Landing Site Navigator** replaces the earlier local-organizer wording “CLPS Lunar Mission Browser.” The live Flame in Freefall page currently uses “SI-Powered”; the earlier listing used “AI-Powered.” The linked official briefs are the reference.

## Data feasibility and what is still unverified

This assessment verified public catalogs, access documentation, product descriptions, and existing-tool capabilities. It did not download and process science files, verify a specific site's complete data overlap, run a scientific benchmark, or establish operational usefulness.

The NISAR and SPHEREx challenge Resources tabs both stated **November 13** availability when checked. The public archives above already exist, but they should not be described as the final challenge-curated resource lists.

Before committing the team to a replacement challenge, resolve one decisive feasibility question:

| Candidate | Evidence needed for a confident selection |
| --- | --- |
| Martian Map | A local region with usable, overlapping imagery, terrain, and science observations at defensible scales. |
| NISAR | A compatible observation pair/time series plus a reference that supports evaluating the chosen change phenomenon. |
| SPHEREx | Repeated observations of a known test target with compatible wavelength/quality information and an observable signal. |

Concepts above illustrate suitability, not a finished project specification. The official site says project work should begin during the hackathon; this pass remains selection and resource research.

## Team status

[Rust Rebels](https://www.spaceappschallenge.org/2026/find-a-team/arc-playground/) (formerly Arc Playground) was updated and published on 2026-11-03 in Seoul. The selected challenge is now **Interplanetary Survival Guide: Martian Map**, the first pick above. Its introduction and recruiting interests now focus on planetary science, terrain mapping, data analysis, visualization, coding, and design. A generated fictional Mars expedition image is published as the team image. The site retained the original `arc-playground` URL after renaming.

See [team identity and image prompt](rust-rebels-team-identity.md) and [published-page verification](assets/rust-rebels-published.jpg).
