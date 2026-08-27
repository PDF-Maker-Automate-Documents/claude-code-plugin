# Connect Google Sheets with PDF Maker (Claude Code)

PDF Maker does **not** connect to Google Sheets by itself. In Claude Code you combine two MCPs:

| MCP | Role |
| --- | --- |
| **mcp-gsheets** | Read / write spreadsheet rows |
| **PDF Maker** (`pdf-maker` plugin) | Create HTML templates and generate PDFs via `create_pdf` |

Typical flow: read a row → map columns to template placeholders → `create_pdf` → write the PDF URL back into a column on the same row.

---

## 1. Setup mcp-gsheets

### Google Cloud

1. Create (or pick) a GCP project.
2. Enable the **Google Sheets API**.
3. Create a **service account** and download a JSON key file.
4. Note `project_id` and `client_email` from that JSON.

### Claude Code MCP config

Add env with an **absolute** path to the key (relative/`$CLAUDE_PLUGIN_ROOT` paths often fail for the Sheets server):

```json
{
  "mcpServers": {
    "mcp-gsheets": {
      "command": "npx",
      "args": ["mcp-gsheets@latest"],
      "env": {
        "GOOGLE_PROJECT_ID": "your-gcp-project-id",
        "GOOGLE_APPLICATION_CREDENTIALS": "/absolute/path/to/service-account-key.json"
      }
    }
  }
}
```

You can register via `claude mcp add mcp-gsheets npx mcp-gsheets@latest` and then edit `~/.claude.json` (project `mcpServers`) to add `env`, **or** put the same block in the plugin [`.mcp.json`](../.mcp.json).

**Do not register the same server name twice.** If both a manual `mcp-gsheets` and `plugin:…:mcp-gsheets` exist, Claude keeps the manual one and may drop the plugin’s `env` — `/mcp` then shows failed auth (`GOOGLE_APPLICATION_CREDENTIALS` missing). Prefer **one** registration with `env` filled in.

After changing config, restart Claude Code and check `/mcp`.

### Share the spreadsheet

Open the sheet → **Share** → add the service account `client_email`:

- **Viewer** — enough to read rows and generate PDFs
- **Editor** — required to write a PDF URL (or any values) back into the sheet

Without sharing, reads/writes fail even when MCP shows connected.

---

## 2. Workflow — one PDF per row

### A. Inspect the sheet

Ask Claude to open the spreadsheet URL and list tabs/headers (via mcp-gsheets). Confirm which columns map to which placeholders (e.g. Date → `date`, Category → `category`, Image Link → `image_link`).

### B. Create an HTML template

Use the PDF Maker skill / tools:

1. Design `bodyHtml` with Nunjucks placeholders (`{{ category }}`, `{{ date }}`, `{{ image_link }}`, …).
2. `preview_html_template` with `sampleData` (and placehold.co for missing images only in demos — see the pdf-maker skill).
3. `create_html_template` → save the returned `template.id`.

Keep `using` as `HTML_TEMPLATE` for API/Claude templates. Prefer fonts from the skill’s supported Google Fonts list.

### C. Generate a PDF from a row

1. `get_template_placeholders` for that `templateId` (optional but recommended).
2. Read the target row from mcp-gsheets.
3. Build a JSON `data` object whose **keys match placeholders**, not raw sheet column letters.
4. Call `create_pdf` with `templateId` + `data`.
5. Take the PDF URL from the response.

### D. Write the URL back to the sheet

1. Ensure a column exists (e.g. header `PDF Link`).
2. Update that cell for the same row with the PDF URL (service account needs **Editor**).

Example prompt:

> Using spreadsheet `<url>`, sheet `images`, and template `<templateId>`, take the first data row, create a PDF with `create_pdf`, add a `PDF Link` column if missing, and put the PDF URL on that row.

### E. Batch remaining rows

Ask Claude to loop remaining rows the same way (skip rows that already have a PDF Link if you want). For ongoing automation outside Claude, use Zapier / Apps Script / a small Node script calling the same OpenAPI endpoints — Claude Code is best for setup and ad‑hoc batches.

---

## 3. Example end-to-end prompts

**Setup check**

> Can you access this Google Sheet? `<url>` List sheet names and the header row of `images`.

**Template + first PDF**

> Create an HTML PDF template for the `images` sheet columns (date, category, modal used, image link). Preview with sample data, create the template, then generate a PDF for the first data row and write the PDF URL into a new `PDF Link` column.

**Fill the rest**

> Using template `<id>`, generate PDFs for every row in `images` that has no `PDF Link` yet, and update column H with each URL.

---

## 4. Security

- Do **not** commit `service-account-key.json` to git.
- Keep the key path absolute in MCP `env`.
- Give the service account only the sheets it needs; revoke when done testing.
- Use real image URLs from the sheet for production `create_pdf` data; placehold.co is for sample/demo only (see pdf-maker skill).

---

## 5. Troubleshooting

| Symptom | Likely cause |
| --- | --- |
| `/mcp` shows mcp-gsheets **failed** | Missing `GOOGLE_APPLICATION_CREDENTIALS` / `GOOGLE_PROJECT_ID` on the **active** server config (duplicate name without env) |
| Connected but cannot read sheet | Sheet not shared with `client_email` |
| Can read but cannot write PDF Link | Share is Viewer only — need Editor |
| PDF placeholders empty | `data` keys don’t match template placeholders — check `get_template_placeholders` |
| Images broken in PDF | Row’s image URL not public/fetchable by the PDF renderer |

Debug Claude logs often mention: `Authentication Error: No authentication method provided` when env is missing on the running MCP process.
