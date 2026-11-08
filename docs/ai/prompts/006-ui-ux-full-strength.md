# Prompt 006: The UI and UX at full strength

From the start, Richie set four bars for OrderPilot's UI:

- **Cinematic, Marvel-movie-quality 3D, made in Blender:** P-23, the order constellation.
- **React Bits and ReUI wherever they fit:** P-22, the design system with the Pro kits.
- **A real ERP feel:** prompts 003 and 004.
- **Calm work screens at the level of Linear or Stripe's dashboard:** prompt 001, section 9.

On 5 Nov Spectra showed us the tools they use today, and those tools look a generation old. Spectra lit up at the idea of Spark. Every team heard the same briefing, so the UI is where we pull ahead.

**What's unblocked now:**

- The repository is private, and the Pro kit keys are in `apps/web/.env.local`.
- So P-22 and P-23 can both start.

**How this prompt fits the others:**

- Prompts 001 to 005 still apply.
- Section 7 says how this prompt fits with prompt 005's order of work.
- The handover prompt is now **007**.

## 1. Two modes, one product

- **Work mode:** every screen where people do their job.
  - Dense, calm, fast and keyboard-first.
  - No motion on tables or forms while they're in use.
  - Prompt 001, section 9 and prompt 003's bar still hold.
- **Show mode:** the moments people remember.
  - The landing page, the sign-in page, the 3D live operations view, Spark opening, KPIs revealing their numbers on first view, and empty states.
  - Here the Pro kits and the 3D scene go all out, always with a still version for reduced motion.

## 2. P-22: the design system with the Pro kits

- **Sources.** Use official sources only, as prompt 002, section 4 says:
  - React Bits (free) through `@react-bits`;
  - React Bits Pro as pro.reactbits.dev documents it;
  - `@reui` at `https://reui.io/r/{style}/{name}.json` with `REUI_LICENSE_KEY`;
  - Magic UI.

  Prompt 001's mirror URLs stay dead. If P-22's registries are already in place, keep what works.
- **Three visual directions first. Richie picks one before anything is rolled out.** For each direction:
  - name its palette, type and radius;
  - show the home page and one order page at 1440 by 900, in light and dark;
  - put the screenshots in `docs/design/directions/`.

  The three directions:
  - **A, Ink:** deep neutral surfaces with one confident accent, in the spirit of Linear.
  - **B, Paper:** light, airy and precise, in the spirit of Stripe's dashboard.
  - **C, Spectra:** built on the teal and navy from Spectra's own deck, so it feels like theirs. It uses no Spectra logo until they say yes (Q-23).
- **Tokens:**
  - colour for light and dark;
  - one UI typeface with tabular figures;
  - at most 7 type sizes;
  - spacing, radius, elevation, and motion durations and easings.

  Icons are Lucide only.
- **Rules for kit items.** Every item from a kit:
  - is adapted to the tokens;
  - sits one component to a file;
  - has a header comment naming its vendor, the item and its licence.
- **Where Pro parts go.** They follow prompt 002, section 4: Richie's pages, meaning landing, sign-in, the app shell, Spark and the 3D view. Area screens use ReUI Pro only if Richie confirmed a Team licence.
- **`docs/design/reactbits-usage.md`:** a plan for every page.
  - Which React Bits, ReUI and Magic UI items it uses, and why.
  - 20 or more distinct items across the app, and at least one on every page.
  - Pro blocks on landing and sign-in.
  - Only subtle items on dense work screens.
- **`docs/design/design-system.md`,** and an ADR covering the registries and why licensed code needs a private repository.

## 3. The show moments

1. **P-23, the 3D order constellation,** updated for what Spectra told us.
   - **The concept:**
     - **The core is Spark,** in faceted glass with an emissive inner light that pulses when Spark answers.
     - **Around the core sit the stations:** Sales and Support, Product Managers, the management approvers, the SPR coordinator, the warehouse in Jurong, Finance, and Logistics and forwarders. Business Central and the inbox (email and WhatsApp) sit there too.
     - **Documents travel as glowing packets** along arcs between the stations: PO, PI, invoice, packing list and AWB/BL.
     - **Packet colours show status:** on time, waiting, and a mismatch caught.
     - **Status comes from real workflow events** over SSE (P-15).
   - **Where it appears:**
     - the hero of the landing page;
     - behind the sign-in page;
     - a live operations view for Management, where clicking a station opens the tracker filtered to it.
   - **Assets:**
     - parametric Blender Python scripts in `assets-src/3d/`, with PBR materials, bevels and clean topology;
     - rendered headless with `blender -b -P`;
     - exported to GLB and quantised with glTF Transform, with no WebAssembly decoders;
     - 1.5 MB or less in total.
   - **Film-like rendering:**
     - React Three Fiber, drei and postprocessing;
     - ACES filmic tone mapping, a studio environment and soft shadows;
     - bloom, a subtle depth of field and a vignette;
     - a slow, cinematic opening camera move that the user can take over;
     - spring motion everywhere in the scene.
   - **Proof for Richie:** a 20-second screen capture of the camera move in `docs/design/constellation/`, plus stills in light and dark. He judges it against "Marvel-movie quality" before the scene goes on landing.
   - **Performance and access:**
     - a lazy chunk, with DPR clamped to between 1 and 2, and adaptive quality;
     - pauses when it's off-screen or the tab is hidden;
     - a still frame for reduced motion, and an image without WebGL;
     - a keyboard-usable list beside the canvas;
     - 60 fps on a mid-range laptop, reported honestly.
2. **The landing page:**
   - the constellation as its hero;
   - the tagline "AI reads, rules decide, people approve";
   - the three steps;
   - a short Spark exchange playing out;
   - Spectra's own measures (an hour a day saved; an audit pack in seconds, not days);
   - "Sign in" and "Try the demo".
3. **The sign-in page:** the split layout from prompt 003, with the scene or a React Bits background behind it. The demo role buttons stay one click each.
4. **Spark's interface:**
   - **Opening:** a short glow as the panel opens.
   - **Answers** stream in with a quiet shimmer.
   - **Sources** appear as chips that open the document beside the chat.
   - **Charts** appear inline, each with "Open in dashboard".
   - **Audit packs** appear as a card with the download.
   - **Drafts** appear as cards a person edits, then sends.
   - **Suggested prompts** fill the empty state.
   - **It's built for a phone too.**
5. **Small delights, on first view only:**
   - KPI numbers count up;
   - sparklines draw in;
   - empty states each have a simple illustration of our own and the next action.

## 4. Work-mode polish, on every screen

- **The chosen direction** goes onto the app shell and prompt 004's templates (list page, document form and cards) first. Then every screen built after that starts in the new style.
- **Grids:**
  - rows 36 to 40 px high;
  - numbers right-aligned in tabular figures, with their currency;
  - sticky headers and resizable columns;
  - keyboard movement and inline editing.
- **Feeling fast:**
  - optimistic updates;
  - skeletons that match the final layout;
  - prefetching on hover;
  - Ctrl+K for actions, "/" for search, "N" for new, and "?" for a list of shortcuts;
  - a toast with Undo after every action.
- **Status:**
  - one chip system (prompt 004, section 6);
  - timers such as "due in 3 h" and "2 days late";
  - the 24-hour SPR reminder visible as a countdown.
- **The document cabinet's compare view** (prompt 005, section 4):
  - two documents side by side;
  - mismatched values highlighted on both pages;
  - page thumbnails, zoom and stamps.
- **Phones and tablets:**
  - approvals and Spark work on a phone, because the approvers travel;
  - the warehouse pick list works on a tablet.
- **Dark mode is as good as light,** not an afterthought.
- **The words:**
  - plain and specific, in Spectra's terms: SPR, PI, AWB/BL, Business Central;
  - no em dashes in UI text.
- **Accessibility:**
  - WCAG 2.2 AA;
  - reduced motion respected everywhere;
  - every chart has a data-table view for screen readers.

## 5. Rules carried over

- **Patterns, not copies** (prompt 002, section 5).
  - Use no other product's logos, brand colours or text.
  - Take none of DocuWare's look from the client pack.
- **The design rules:**
  - one primary button per view;
  - no emoji as icons;
  - no lorem ipsum, and no "John Doe".
- **Performance at each release:**
  - Lighthouse 90 or more;
  - LCP under 2.5 s;
  - initial JS of 250 KB gzip or less, not counting the 3D.

## 6. Proof for every UI story

- **Screenshots** of every page it touches, at 1440 by 900 and 390 by 844, in light and dark (prompt 003, section 4).
- **A short capture** for anything that moves.
- **`docs/design/review-board.md`:** before and after for each page, so Richie reviews in one place.

## 7. Order, alongside prompt 005

1. **Finish P-45 and P-47,** then prompt 005's steps 2 and 3 (the facts, the renames and the synthetic data).
2. **P-22's three directions.** Stop for Richie's pick.
3. **Roll the picked direction out** onto the shell and the templates. This comes before prompt 005's sales-flow screens multiply.
4. **P-23 runs in parallel from step 2,** with its own builder, because it touches only `assets-src/3d/` and the constellation feature.
5. **Spark's interface** lands with prompt 005's step 6.
6. **The landing page** follows once P-23's capture is approved.
7. **Polish page by page** as prompt 005's features land, each page through the review board.
