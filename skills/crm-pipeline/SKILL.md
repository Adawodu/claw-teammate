---
name: crm-pipeline
description: Manage CRM contacts, companies, deals, meetings, and sales pipeline in Clarify
user-invocable: true
metadata: {"openclaw":{"emoji":"📊"}}
---

# CRM Pipeline Manager

Manage your sales pipeline, contacts, companies, deals, and meetings through
Clarify — the CRM of record. All six tools come from the `clarify-ai` plugin.

## Tools

| Tool | Use it for |
|---|---|
| `clarify_search` | Find people, companies, deals or meetings. Params: `object`, `query`, `filters`, `sortBy`, `sortDir`, `limit`, `include` |
| `clarify_find_leads` | Prospect against enriched data. Params: `role`, `company`, `industry`, `location`, `limit` |
| `clarify_create_contact` | Create or upsert a person or company. Params: `object`, `attributes` |
| `clarify_update_record` | Update any record by id. Params: `object`, `id`, `attributes` |
| `clarify_manage_deal` | Create or update a deal. Params: `action`, `id`, `name`, `attributes`, `limit` |
| `clarify_get_meetings` | List meetings or fetch one. Params: `action`, `id`, `limit`, `include` |

If the `clarify_*` tools are unavailable, say the `clarify-ai` plugin needs
enabling rather than reaching for another CRM — there isn't one.

## Usage

When invoked, present these options:

1. **Contacts** — Create, search, or update people
2. **Companies** — Create, search, or update companies
3. **Deals** — Create deals, move stages, search, or list
4. **Meetings** — Review recent meetings and their detail
5. **Leads** — Prospect for new leads by role, company, industry, or location
6. **Lead Funnel** — Full workflow: find or create company → create contact → open deal

## Lead Funnel Workflow

When adding a new lead end to end:

1. Gather: name, email, company, role, deal name, deal value
2. `clarify_search` with `object: "people"` on the email — never create a
   duplicate of someone already in the pipeline
3. `clarify_search` with `object: "companies"` on the company name
4. `clarify_create_contact` with `object: "companies"` if it doesn't exist
5. `clarify_create_contact` with `object: "people"`, carrying the company in
   `attributes` so the association is made at creation
6. `clarify_manage_deal` with `action: "create"`, the deal name and value
7. Report what was created, with ids, so the user can open the records

## Pipeline Management

1. `clarify_search` with `object: "deals"` to load the current pipeline
2. Present a table: Deal | Stage | Amount | Close date
3. Move a deal with `clarify_manage_deal` using `action: "update"` and its `id`
4. Confirm the stage change with the user before executing it

## Meeting Follow-Up

1. `clarify_get_meetings` with `action: "list"` for what happened recently
2. `clarify_get_meetings` with `action: "get"` and an `id` for the detail
3. Attach outcomes to the record with `clarify_update_record`, so the next
   person to open the deal sees why it moved

## Guidelines

- Search before creating. Duplicates are the main way a CRM stops being trusted.
- Confirm before any create or update, and show the resulting record afterwards.
- Prefer `clarify_update_record` for field edits; `clarify_manage_deal` is for
  deal lifecycle specifically.
- Present lists as tables, not prose.
- Pass CRM fields through `attributes` as Clarify names them; don't translate
  them into another CRM's vocabulary.
