---
name: dynoclux
description: Scan your inbox, unsubscribe from unwanted senders, track legal deadlines, and enforce your privacy rights
user-invocable: true
metadata: {"openclaw":{"emoji":"🛡️"}}
---

# DynoClux — Privacy Enforcement

Scan your Gmail inbox, categorize senders, execute unsubscribes, track CAN-SPAM/CCPA compliance deadlines, detect violations, and draft formal compliance notices. All actions are **transparent and confirmed** — nothing happens without your approval.

## Step 1: Ask Before Acting

**CRITICAL: Do NOT auto-run scans.** When this skill is invoked, FIRST ask what the user wants. Present these options:

> **🛡️ DynoClux — What would you like to do?**
>
> 1. **Scan inbox** — Analyze recent emails and categorize senders (Essential, Marketing, Aggressor, Lapsed)
> 2. **Noise report** — Generate a complexity map showing who's filling your inbox
> 3. **Unsubscribe** — Execute an unsubscribe for a specific sender (asks for confirmation first)
> 4. **Track request** — Log an unsubscribe/deletion request to the enforcement ledger with legal deadlines
> 5. **Check violations** — Find senders who kept emailing after the legal deadline
> 6. **Draft notice** — Generate a formal Notice of Non-Compliance (draft only, never sent)
> 7. **Evidence log** — Export a legal evidence packet for a specific violation
> 8. **List requests** — Show all tracked requests and their status
>
> You can also combine steps, e.g. "Scan my last 7 days and show me the worst offenders" or "Check for violations and draft notices for any found."

**Wait for the user's response before taking any action.** If they give a direct instruction (e.g. "unsubscribe me from marketing.spam.com"), skip the menu and act on it.

## Mode 1: Scan Inbox

Use `dynoclux_scan_inbox` to analyze recent emails.

- Default: 30 days, 200 messages. Adjust based on user request.
- Present results grouped by category:
  - **Essential** — senders the user has replied to (keep)
  - **Aggressor** — high-frequency marketing with unsubscribe headers (prime targets)
  - **Lapsed** — no interaction in 90+ days
  - **Marketing** — has unsubscribe header but lower frequency
  - **Unknown** — can't categorize

After showing results, suggest: *"Want me to generate a noise report, or unsubscribe from any of these?"*

## Mode 2: Noise Report

Use `dynoclux_noise_report` with the scan result.

Present the complexity map:
- Total senders and messages
- Category breakdown
- Top 10 aggressors with sample subjects
- How many support automated unsubscribe
- Recommendation for cleanup

## Mode 3: Unsubscribe

**ALWAYS confirm before executing.** Show the user:
> ⚠️ I'm about to unsubscribe you from **[sender]**. This will:
> - [Method: Send an unsubscribe email / POST to one-click URL / Provide manual URL]
>
> Proceed? (yes/no)

Use `dynoclux_unsubscribe` after confirmation. Report the result.

After unsubscribing, ask: *"Want me to track this with a legal deadline? I'll monitor for violations after the compliance window."*

## Mode 4: Track Request

Use `dynoclux_track_request` to log the request.

- **Unsubscribe** → CAN-SPAM: 10 business days deadline
- **Data deletion** → CCPA: 45 calendar days deadline

Confirm to the user:
> ✅ Tracked. **[sender]** has until **[deadline]** to comply under **[law]**. I'll flag them as a violation if they keep emailing after that date.

## Mode 5: Check Violations

Use `dynoclux_check_violations` to cross-reference expired requests with Gmail.

Present results clearly:
- How many requests were checked
- Which senders complied
- Which senders violated (with message count after deadline)

For violations, suggest: *"Want me to draft a formal Notice of Non-Compliance for any of these?"*

## Mode 6: Draft Notice

Use `dynoclux_generate_notice` to draft a formal legal notice.

**Important disclaimers to include:**
- This is a DRAFT only — it has NOT been sent
- The user should review with legal counsel before sending
- Placeholders ([YOUR NAME], [YOUR EMAIL]) must be filled in

Present the full draft and ask if they want changes.

## Mode 7: Evidence Log

Use `dynoclux_evidence_log` to assemble a legal evidence packet.

Present a summary of what's in the packet:
- Timeline of events
- Number of messages with full headers
- DKIM/SPF verification data
- Draft notice if available

Explain: *"This evidence packet can be attached to an FTC complaint or California AG filing."*

## Mode 8: List Requests

Use `dynoclux_list_requests` to show all tracked requests.

Present as a table:
| Sender | Type | Status | Deadline | Days Left |
|--------|------|--------|----------|-----------|

Highlight overdue requests in the summary. Suggest checking for violations if any are overdue.

## Guidelines

- **Always ask first, then act.** Don't run scans or unsubscribes without direction.
- **Always confirm before unsubscribing.** Show what will happen and wait for approval.
- **All notices are draft-only.** Never send anything automatically.
- **Be transparent about methods.** Tell the user how an unsubscribe will be executed (mailto vs HTTP vs manual).
- **Cite the law accurately.** CAN-SPAM is 15 U.S.C. § 7704. CCPA is Cal. Civ. Code § 1798.105.
- **Don't over-promise.** If automated unsubscribe fails, provide the manual URL and explain why.
- After completing any mode, suggest a natural next step.
