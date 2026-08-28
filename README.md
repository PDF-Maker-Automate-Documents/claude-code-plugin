# The PDF Maker — Claude Code plugin

Lets Claude Code call [THE PDF MAKER API](https://documenter.getpostman.com/view/15968072/2sA35HVzrs#intro) as native tools: create, preview, and update HTML templates, list templates, read placeholders, check plan usage, and generate PDFs from JSON.

## Requirements

- [Claude Code](https://code.claude.com/docs/en/quickstart)
- Node.js 18+
- A [PDF Maker](https://app.thepdfmaker.com/) account and API key from [Settings → API Key](https://app.thepdfmaker.com/settings?tab=api-key)

## Setup

```bash
cd servers/pdf-maker && npm install
```

After login, open [Settings → API Key](https://app.thepdfmaker.com/settings?tab=api-key), copy your key, then export it (do not commit it):

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
4. Or create a template: "Create an HTML invoice template, then generate a PDF with this data: …"

If the server fails to start, confirm `npm install` ran in `servers/pdf-maker` and that `PDF_MAKER_API_KEY` is set in the same environment that launches Claude Code.

In `/mcp`, the working server is named `plugin:pdf-maker:api`. If you opened this repo as the project, you may also see a project `.mcp.json` warning about `CLAUDE_PLUGIN_ROOT` — that is harmless when the plugin entry shows connected. Prefer testing with `claude --plugin-dir .` from this folder, or install the plugin and work from another project.

## Tools

| Tool | API |
| --- | --- |
| `list_templates` | `GET /templates` |
| `create_html_template` | `POST /templates/html` |
| `preview_html_template` | `POST /templates/html/preview` |
| `get_html_template` | `GET /templates/html/:templateId` |
| `update_html_template` | `PUT /templates/html/:templateId` |
| `get_template_placeholders` | `GET /templates/placeholders` |
| `create_pdf` | `POST /pdf` |
| `auth_check` | `GET /` |
| `get_plan` | `GET /plan` |
| `pdf_maker_request` | any path on the configured API base URL |

Auth header: `x-api-key`. Base URL: `https://api.thepdfmaker.com`.

## Template setup

**Option A — API (Claude)**

1. Ask Claude to create an HTML template with Nunjucks placeholders (`{{ field }}`, loops, etc.).
2. Ask Claude to preview the HTML, then update if needed. Created templates are `HTML_TEMPLATE` (raw HTML, no SunEditor).
3. Use the returned `template.id` with `create_pdf` and your JSON data.
4. Open the same template later in the dashboard code editor at `/templates/wysiwyg-editor?id=…` (not the visual SunEditor).

**Option B — Dashboard**

1. In The PDF Maker dashboard, create a **WYSIWYG** or Google Doc template with **API** as the data source. Do not create `HTML_TEMPLATE` from configure — that type is API/Claude only.
2. Add placeholders where values should be filled.
3. Copy the template ID and the sample request body from Automate.
4. Ask Claude to generate the PDF with that ID and your data.

Docs: https://the-pdf-maker.tawk.help/article/how-to-create-professional-pdf-documents-using-pdf-maker-api
