# Prompt 012: profile pictures a person approves

Richie's message of 24 Nov 2026, about the account feature, quoted as he typed it. The two-step sign-in half of it is story A and has its own prompt file.

```text
I would like to improve the account feature, like adding OTP and profile pictures, but with AI-sensed or human-approved profile pictures because people might not behave appropriately and could upload inappropriate pictures, so there must be a certain standard or verification for the profile picture used. For the OTP, I have attached a code bundle file.
```

## What came of it

- The tagline "AI reads, rules decide, people approve" settled "AI-sensed or human-approved": fixed rules refuse a bad file, an AI check describes the picture to a reviewer when the data rule allows it, and a person approves or rejects every picture. No model output changes a status.
- The story was designed first and the design was reviewed against the code before any build. The review found sixteen things, and all sixteen held: among them that a pending picture of a shared demo account would have been shown to every visitor of that role, that parallel uploads would each have called the AI before any cap, and that a literal `alt=""` fails the repository's text check. The design was corrected before the build.
- The API half was built first in thirteen commits, with 35 sightings of safety tests, each seen failing against deliberately broken code and then restored byte for byte. The screens were built next: the account card, the reviewer's list in Settings, the end-to-end spec and the documents.
- Two things are stated plainly in the pull request and in ADR 0069. The AI check is built and tested but does not run under area 4's data rule, which lets only synthetic data go to an AI tool, so every reviewer line reads "Not checked by AI". And an approved picture is drawn only in its owner's side menu and on their card until other pages draw avatars.
- Left for the team: area 4 decides the data rule for pictures (a gate before the check is switched on), the queue job for the check, a Take down button on Governance, Users, avatars on other pages, and a sweep for stored objects with no row.
- The builder ran no browser and no Docker. A later step ran the Docker build, the end-to-end spec and a walk in Edge, and took the screenshots in `docs/design/screenshots/platform/profile-pictures/`. The walk found one gap, the missing count on the Settings link in the side panel, and it was added.
