# Prompt 011: two-step sign-in

Richie's message of 24 Nov 2026, about the account feature, quoted as he typed it. It also covers profile pictures, which are a separate story.

```text
I would like to improve the account feature, like adding OTP and profile pictures, but with AI-sensed or human-approved profile pictures because people might not behave appropriately and could upload inappropriate pictures, so there must be a certain standard or verification for the profile picture used. For the OTP, I have attached a code bundle file.
```

## What came of it

- The attached bundle is a React design for the code boxes. It was read as data and never run. It needs a library the app does not have, imports a constants file it does not contain, mounts in a shadow root, embeds a font, and states no licence.
- The code comes from an authenticator app, not from email: nothing in the API sends email, and the demo addresses cannot receive any.
- The design was written first, reviewed, and corrected before any code. [ADR 0067](../../adr/0067-two-step-sign-in-with-an-authenticator-app.md) records the decisions and the limits.
- The boxes are a port into `apps/web/src/components/kit/code-field/`, not the bundle itself.
