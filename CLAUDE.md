# Tlhiso — Claude Code Instructions

## RULE 1 — Read the app record before every code change

Before making **any** edit, write, or code change:

1. Read `TLHISO_APP_RECORD.md` in the project root.
2. Confirm your understanding of what's already built before touching anything.
3. **Only change exactly what the user asks for.** Do not refactor, rename, or improve anything beyond the stated request.

## RULE 2 — Scope discipline

- Do not add unrequested features, clean up unrelated code, or make "while I'm here" edits.
- If you notice something worth fixing that was not asked for, mention it in words — do not fix it silently.

## RULE 3 — Deployment awareness

- Production project: `tlhiso` — live at https://tlhiso.com
- Staging project: `tlhiso-staging`
- After any change that needs to go live, remind the user to run `npm run deploy:prod`.
- Never auto-deploy without being asked.

## RULE 4 — Secrets stay in Secret Manager

- Never write API keys (SendGrid, BulkSMS, Twilio, AssemblyAI) into any source file or `.env`.
- Those live only in Google Secret Manager via `firebase functions:secrets:set`.
