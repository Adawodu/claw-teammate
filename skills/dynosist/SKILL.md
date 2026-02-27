---
name: dynosist
description: Compose Gmail drafts with file attachments, search emails, find uploaded files, and manage drafts
user-invocable: true
metadata: {"openclaw":{"emoji":"📧"}}
---

# DynoSist — Email Draft Assistant

Compose Gmail drafts with optional file attachments. Locate files uploaded via Telegram, gather email details conversationally, and save drafts for review.

## Step 1: Ask Before Acting

**CRITICAL: Do NOT auto-compose.** When this skill is invoked, FIRST ask what the user wants. Present these options:

> **📧 DynoSist — What would you like to do?**
>
> 1. **Compose draft** — Create a new Gmail draft (with or without attachments)
> 2. **Email a file** — Find a recently uploaded file and draft an email with it attached
> 3. **List drafts** — Show recent Gmail drafts
> 4. **Find files** — Search for files on the system (e.g. recent Telegram uploads)
> 5. **Search emails** — Find emails by sender, subject, date, or keywords
>
> You can also give a direct instruction, e.g. "email the PDF I just sent to john@example.com with subject Monthly Report"

**Wait for the user's response before taking any action.** If they give a direct instruction (e.g. "email this to bob@example.com"), skip the menu and act on it.

## Mode 1: Compose Draft

Gather the required info conversationally. Ask for anything missing:
- **To** — recipient email (required)
- **Subject** — email subject (required)
- **Body** — email content (required)
- **CC / BCC** — optional
- **Attachments** — optional file paths

Before creating the draft, show a preview:

> **📧 Draft Preview**
> - **To:** recipient@example.com
> - **Subject:** Monthly Report
> - **Body:** (first 200 chars or full text if short)
> - **Attachments:** report.pdf (2.1 MB)
>
> Create this draft? (yes/no)

On confirmation, call `dynosist_create_draft`. Report the result:

> ✅ Draft saved in Gmail. [Open draft](gmail-link)
> Review it and hit Send when ready.

## Mode 2: Email a File

When the user says "email this file", "send the PDF I uploaded", or similar:

1. Use `dynosist_find_files` to locate the file. Search `/tmp/` for recent files matching the description.
2. If multiple matches, show the list and ask which one.
3. If no matches, tell the user and suggest they re-upload or provide the exact path.
4. Once the file is identified, gather remaining info (recipient, subject, body).
5. Show the draft preview and confirm.
6. Call `dynosist_create_draft` with the file path as an attachment.

## Mode 3: List Drafts

Call `dynosist_list_drafts` and present results as a table:

| # | Subject | To | Date |
|---|---------|-----|------|

## Mode 4: Find Files

Call `dynosist_find_files` with the user's search pattern. Present results:

| Filename | Size | Modified | Path |
|----------|------|----------|------|

Suggest: *"Want me to draft an email with any of these files attached?"*

## Mode 5: Search Emails

Call `dynosist_search_emails` with the user's query. Gmail search supports these operators:

- `from:john@example.com` — emails from a specific sender
- `to:jane@example.com` — emails to a specific recipient
- `subject:invoice` — emails with a word in the subject
- `after:2026/02/01` / `before:2026/02/28` — date range
- `has:attachment` — only emails with attachments
- `is:unread` — only unread emails
- `label:important` — emails with a specific label
- `in:inbox` / `in:sent` — search specific mailboxes

Operators can be combined: `from:john@example.com subject:invoice after:2026/02/01`

Present results as a numbered list:

> **📧 Search results for** `from:john@example.com`
>
> 1. **Subject:** Monthly Report — **From:** John Smith <john@example.com> — **Date:** Feb 15, 2026
>    _Preview: Here's the monthly report for January..._
> 2. ...

After showing results, suggest follow-ups: *"Want me to draft a reply to any of these?"*

## Guidelines

- **Never send emails directly.** Always create drafts only. The user must manually review and send.
- **Always confirm before creating a draft.** Show the preview and wait for approval.
- **Support multiple attachments.** The user can attach several files to one draft.
- **When the user says "the file I just sent"**, search `/tmp/` for the most recently modified files and present matches.
- **Be concise with body text.** If the user doesn't specify a body, ask for one — don't invent content.
- **After completing any action**, suggest a natural next step.
