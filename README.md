# The PDF Maker — Claude Code plugin

Lets Claude Code call [THE PDF MAKER API](https://documenter.getpostman.com/view/15968072/2sA35HVzrs#intro) as native tools: create, preview, and update HTML templates, list templates, read placeholders, check plan usage, and generate PDFs from JSON.

## Install from GitHub

1. Copy your API key from [Settings → API Key](https://app.thepdfmaker.com/settings?tab=api-key) and export it (do not commit it):

```bash
export PDF_MAKER_API_KEY="your-api-key"
```

1. In Claude Code, add the marketplace and install the plugin:

```
/plugin marketplace add PDF-Maker-Automate-Documents/claude-code-plugin
/plugin install pdf-maker@pdf-maker
/reload-plugins
```

1. Example prompts to use

Once the plugin is installed, try these in Claude Code:

**List and inspect templates**

- "List my PDF Maker templates."
- "Show placeholders for template `<templateId>`."
- "Load template `<templateId>` and summarize its structure."

**Create and edit HTML templates**

- "Create an HTML invoice template pdf maker, preview it, then save it."
- "Refactor template `<templateId>` — fix the signature row so Landlord and Tenant stay side by side in the PDF."
- "Update template `<templateId>`: add invoice items table, preview, then save."

**Generate PDFs**

- "Create a PDF from template `<templateId>` with this data: …"
- "Generate a rental contract PDF for tenant John Doe using template `<templateId>` and save it to `./output/contract.pdf`."

**Account / quota**

- "Check my PDF Maker API key."
- "What's my current PDF Maker plan usage?"

**Advanced**

- "Create a bar chart in the template from `monthly_sales` using pdf maker, preview, then generate a PDF."

## Local development

Requirements

- [Claude Code](https://code.claude.com/docs/en/quickstart)
- Node.js 18+
- A [PDF Maker](https://app.thepdfmaker.com/) account and API key from [Settings → API Key](https://app.thepdfmaker.com/settings?tab=api-key)

From a clone of this repo:

```bash
npm install
export PDF_MAKER_API_KEY="your-api-key"
claude --plugin-dir .
```

Or add a local marketplace:

```bash
claude plugin marketplace add .
# then in Claude Code:
# /plugin install pdf-maker@pdf-maker
```

## Verify

1. In Claude Code, run `/mcp`. The `api` server from this plugin should show as connected (`plugin:pdf-maker:api`).
2. Ask Claude to check the API key, or say: "List my PDF Maker templates."
3. Create a template: "Create an HTML invoice template, then generate a PDF with this data: …"
4. Generate a document: "Create a PDF from template `<templateId>` with this data: …"

If the server fails to start, confirm `npm install` ran in `servers/pdf-maker` and that `PDF_MAKER_API_KEY` is set in the same environment that launches Claude Code.

## Validate (maintainers)

Before publishing or opening a PR:

```bash
claude plugin validate . --strict
```

## Tools

| Tool                        | API                                                        |
| --------------------------- | ---------------------------------------------------------- |
| `list_templates`            | `GET /templates` (newest first; optional `page` / `limit`) |
| `create_html_template`      | `POST /templates/html`                                     |
| `preview_html_template`     | `POST /templates/html/preview`                             |
| `get_html_template`         | `GET /templates/html/:templateId`                          |
| `update_html_template`      | `PUT /templates/html/:templateId`                          |
| `get_template_placeholders` | `GET /templates/placeholders`                              |
| `create_pdf`                | `POST /pdf`                                                |
| `auth_check`                | `GET /`                                                    |
| `get_plan`                  | `GET /plan`                                                |
| `pdf_maker_request`         | any path on the configured API base URL                    |

Auth header: `x-api-key`. Base URL: `https://api.thepdfmaker.com`.

## Template setup

**Option A — API (Claude)**

1. Ask Claude to create an HTML template with placeholders (`{{ field }}`, loops, etc.).
2. Ask Claude to preview the HTML, then update if needed.
3. Use the returned `template.id` with `create_pdf` and your JSON data.
4. Open the same template later in the dashboard code editor at `/templates/wysiwyg-editor?id=…`.

**Option B — Dashboard**

1. In The PDF Maker dashboard, create a **WYSIWYG** or Google Doc template with **API** as the data source.
2. Add placeholders where values should be filled.
3. Copy the template ID and the sample request body from Automate.
4. Ask Claude to generate the PDF with that ID and your data.

Docs: [https://the-pdf-maker.tawk.help/article/how-to-create-professional-pdf-documents-using-pdf-maker-api](https://the-pdf-maker.tawk.help/article/how-to-create-professional-pdf-documents-using-pdf-maker-api)
