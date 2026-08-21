---
name: pdf-maker
description: Generate PDFs and call THE PDF MAKER API from Claude Code. Use when the user wants to create a PDF, list PDF Maker templates, fill template placeholders, generate a document from JSON or an Airtable record, or call api.thepdfmaker.com.
allowed-tools:
  - mcp__plugin_pdf-maker_api__list_templates
  - mcp__plugin_pdf-maker_api__get_template_placeholders
  - mcp__plugin_pdf-maker_api__create_pdf
  - mcp__plugin_pdf-maker_api__auth_check
  - mcp__plugin_pdf-maker_api__create_airtable_pdf
  - mcp__plugin_pdf-maker_api__create_airtable_pdf_get
  - mcp__plugin_pdf-maker_api__pdf_maker_request
---

# The PDF Maker

Call [THE PDF MAKER API](https://documenter.getpostman.com/view/15968072/2sA35HVzrs#intro) through this plugin's MCP tools. Do not invent curl commands when these tools are available.

## Prerequisites

- `PDF_MAKER_API_KEY` must be set in the environment (from The PDF Maker dashboard Automate / API panel).
- Templates are created in [The PDF Maker](https://app.thepdfmaker.com/) dashboard. For JSON generation, the template's data source should be **API**.
- If auth fails, run `auth_check` and tell the user to export `PDF_MAKER_API_KEY`.

## Workflow

1. If the template ID is unknown, call `list_templates`.
2. Call `get_template_placeholders` with that `templateId` so `data` keys match the template.
3. Call `create_pdf` with:
   - `templateId`
   - `data` — object whose keys match the placeholders
   - `pdfFileName` — optional
   - `outputPath` — optional workspace path if the user wants the file saved locally
4. Return the generated PDF URL (or saved file path) to the user.

For Airtable-backed templates, use `create_airtable_pdf` (POST) with `templateId` and `recordId`. Prefer POST over `create_airtable_pdf_get`.

Use `pdf_maker_request` only for documented paths that do not have a dedicated tool. Allowed host is `https://api.thepdfmaker.com`.

## Mapping user data

Placeholder names come from the template, not from guesswork. After `get_template_placeholders`, copy those keys into `data`. Nested objects and arrays are allowed when the template expects them (line items, tables, images).

If the user pastes a sample Automate JSON body, keep its shape and replace only the values.

## Results

- JSON responses usually include a URL — give that URL to the user.
- Binary PDF responses are saved when `outputPath` is set; otherwise ask for a path if they want a local file.
- Surface HTTP errors and API error bodies instead of retrying blindly on 401/402.
