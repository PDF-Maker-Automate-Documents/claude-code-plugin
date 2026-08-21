# The PDF Maker — Claude Code plugin

Lets Claude Code call [THE PDF MAKER API](https://documenter.getpostman.com/view/15968072/2sA35HVzrs#intro) as native tools: list templates, read placeholders, generate PDFs from JSON, and generate PDFs from Airtable records.

## Requirements

- [Claude Code](https://code.claude.com/docs/en/quickstart)
- Node.js 18+
- A [PDF Maker](https://app.thepdfmaker.com/) account and API key (Automate / API panel)

## Setup

```bash
cd servers/pdf-maker && npm install
```

Export your API key (do not commit it):

```bash
export PDF_MAKER_API_KEY="your-api-key"
```

## Install

From this plugin directory:

```bash
claude --plugin-dir .
```

Or add it as a local marketplace, then install:

```bash
claude plugin marketplace add .
# then in Claude Code:
# /plugin install pdf-maker@pdf-maker
```

## Verify

1. In Claude Code, run `/mcp`. The `api` server from this plugin should show as connected.
2. Ask Claude to check the API key, or say: "List my PDF Maker templates."
3. Generate a document: "Create a PDF from template `<templateId>` with this data: …"

If the server fails to start, confirm `npm install` ran in `servers/pdf-maker` and that `PDF_MAKER_API_KEY` is set in the same environment that launches Claude Code.

## Tools

| Tool | API |
| --- | --- |
| `list_templates` | `GET /templates` |
| `get_template_placeholders` | `GET /templates/placeholders` |
| `create_pdf` | `POST /pdf` |
| `auth_check` | `GET /` |
| `create_airtable_pdf` | `POST /airtable/pdf` |
| `create_airtable_pdf_get` | `GET /airtable/pdf` |
| `pdf_maker_request` | any path on `https://api.thepdfmaker.com` |

Auth header: `x-api-key`. Base URL: `https://api.thepdfmaker.com`.

## Template setup

1. In The PDF Maker dashboard, create a template with **API** as the data source.
2. Add placeholders where values should be filled.
3. Copy the template ID and the sample request body from Automate.
4. Ask Claude to generate the PDF with that ID and your data.

Docs: https://the-pdf-maker.tawk.help/article/how-to-create-professional-pdf-documents-using-pdf-maker-api
# claude-code-plugin
