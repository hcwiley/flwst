# Alpha feedback process

Process for selecting alpha users and establishing a feedback loop (Phase 9).

## Selecting 3–5 alpha users

- **Criteria (suggested):** People who will use the app regularly (e.g. run at least
  one ingest per week), have Notion set up, and can report issues or suggestions
  in a timely way. Prefer a mix of use cases (e.g. different team sizes, workflows).
- **Count:** 3–5 users so feedback is manageable and representative.

## Distribution

- **Artifact:** Share the built DMG (or zip) from `apps/electron/dist/` (e.g. via
  secure link or attachment).
- **Instructions:** Point users to install from the DMG and to complete onboarding
  (Notion path). Optionally share a short “getting started” note (e.g. use Inbox to
  paste or drop a transcript, then run ingest).

## Collecting feedback

- **Amplitude:** With `AMPLITUDE_API_KEY` set in the build env, the app sends
  metadata-only events (onboarding funnel, feature requests, run success/failure).
  Use Amplitude to see funnel drop-off, run success rate, and feature-request counts.
- **Direct feedback:** Provide a channel for qualitative feedback (e.g. form, email,
  or Slack). Ask for: what worked, what broke, what’s missing, and one thing they’d
  change.

## Tracking feedback

- **Quantitative:** Review Amplitude dashboards for onboarding completion, run
  completion, and error rates.
- **Qualitative:** Triage direct feedback into bugs, feature requests, and docs
  improvements; track in your issue tracker or alpha notes.

## Outcome

- **Feedback loop established:** You have a clear path from “alpha user uses the app”
  to “team sees metrics and comments” to “prioritized follow-ups.”
