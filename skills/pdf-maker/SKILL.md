---
name: pdf-maker
description: Generate PDFs and call THE PDF MAKER API from Claude Code. Use when the user wants to create a PDF, create or edit an HTML template, preview HTML output, list PDF Maker templates, fill template placeholders, check plan usage, generate a document from JSON, or call the PDF Maker API.
allowed-tools:
  - mcp__plugin_pdf-maker_api__list_templates
  - mcp__plugin_pdf-maker_api__create_html_template
  - mcp__plugin_pdf-maker_api__preview_html_template
  - mcp__plugin_pdf-maker_api__get_html_template
  - mcp__plugin_pdf-maker_api__update_html_template
  - mcp__plugin_pdf-maker_api__get_template_placeholders
  - mcp__plugin_pdf-maker_api__create_pdf
  - mcp__plugin_pdf-maker_api__auth_check
  - mcp__plugin_pdf-maker_api__get_plan
  - mcp__plugin_pdf-maker_api__pdf_maker_request
---

# The PDF Maker

Call THE PDF Maker API through this plugin's MCP tools. Do not invent curl commands when these tools are available.

## Tool names (critical)

Callable MCP names keep the hyphen in `pdf-maker`:

`mcp__plugin_pdf-maker_api__create_html_template`

Never rewrite `pdf-maker` to `pdf_maker`. Prefer these MCP tools over shell/curl.

## Prerequisites

- `PDF_MAKER_API_KEY` must be set in the environment. Get it after login from [Settings → API Key](https://app.thepdfmaker.com/settings?tab=api-key).
- Templates can be created in the [dashboard](https://app.thepdfmaker.com/) (gallery / visual editor) **or** via `create_html_template` as **`HTML_TEMPLATE`** (raw HTML + CSS; opens in the dashboard code editor). Do **not** tell users to create `HTML_TEMPLATE` from the dashboard configure UI — that type is API/Claude only.
- If auth fails, run `auth_check` and tell the user to copy the key from Settings → API Key and export `PDF_MAKER_API_KEY`.

## Workflow — use an existing template

1. If the template ID is unknown, call `list_templates`.
2. Call `get_template_placeholders` with that `templateId` so `data` keys match the template.
3. Call `create_pdf` with:
   - `templateId`
   - `data` — object whose keys match the placeholders
   - `pdfFileName` — optional
   - `outputPath` — optional workspace path if the user wants the file saved locally
4. Return the generated PDF URL (or saved file path) to the user.

## Workflow — create, preview, edit HTML, then generate a PDF

1. Author `bodyHtml` with Nunjucks placeholders and normal HTML/CSS (see below). Prefer webfonts from the shared Google Fonts list.
2. Call `preview_html_template` with `bodyHtml` and `sampleData` to verify filled output before saving.
3. Call `create_html_template` with `name`, `bodyHtml`, and ideally `sampleData`. The saved type is `HTML_TEMPLATE` (raw HTML + Google Fonts + layout CSS).
4. Read `template.id` from the response.
5. To revise: `get_html_template` → edit HTML → `preview_html_template` → `update_html_template`. When previewing an edit, pass the same `settings`, `css`, `headerHtml`, `footerHtml`, and `sampleData` from `get_html_template` (plus your updated fields) so the preview matches the dashboard.
6. Call `create_pdf` with real `data`.
7. The user can open the template in the dashboard code editor at `/templates/wysiwyg-editor?id=<templateId>` (body/header/footer are HTML source editors for `HTML_TEMPLATE`).

If `create_pdf` or `create_html_template` fails with a plan/quota error (402/400), call `get_plan` and explain remaining PDF/template usage to the user.

Use `pdf_maker_request` only for documented paths that do not have a dedicated tool.

## HTML / Nunjucks conventions (`HTML_TEMPLATE`)

Templates created via `create_html_template` are **`HTML_TEMPLATE`**: raw HTML + CSS, plus Google Fonts and page layout CSS. Preview nests body HTML under `.se-preview-body > main`; PDF under `.se-pdf-surface > main` (with `.se-html-surface` on the surface). Prefer normal HTML tables and CSS.

**Placeholders**

- Text: `{{ customer_name }}`
- Loops: `{% for item in line_items %}...{% endfor %}`
- Conditions: `{% if show_discount %}...{% endif %}`
- Filters: `render_qr`, `render_barcode`, `render_chart` (e.g. `{{ invoice_number | render_qr(width=240, margin=1, style="width: 120px;") }}`)

**Loops in tables** — use normal table markup; put `{% for %}` / `{% endfor %}` around the row template:

```html
<table>
  <thead>
    <tr>
      <th>Name</th>
      <th>Qty</th>
      <th>Price</th>
    </tr>
  </thead>
  <tbody>
    {% for item in line_items %}
    <tr>
      <td>{{ item.name }}</td>
      <td>{{ item.qty }}</td>
      <td>{{ item.price }}</td>
    </tr>
    {% endfor %}
  </tbody>
</table>
```

**Header / footer** — use inline styles only (they render in isolation). Optional ConvertAPI classes: `pageNumber`, `totalPages`, `date`.

**Minimal example**

```html
<p><strong>Invoice</strong> {{ invoice_number }}</p>
<p>Bill to: {{ customer_name }}</p>
<p>Total: $ {{ invoice_total }}</p>
```

With `sampleData`: `{ "invoice_number": "INV-1", "customer_name": "Jane", "invoice_total": 100 }`.

**Full-page layouts (certificates, covers)**

Surfaces use **zero** default padding. To fill the page content box (works for portrait, landscape, and all paper sizes):

```css
.cert-frame {
  flex: 1;
  min-height: 100%;
  display: flex; /* or grid */
  flex-direction: column;
}
```

- Put `flex: 1` / `min-height: 100%` on the **outer wrapper**, not only on `body` — `body { display: flex }` alone does not stretch nested content.
- Do **not** set `width`, `max-width`, or fixed horizontal sizes on the main content wrapper — `main` already spans the full content box; constraining width leaves empty side space and breaks preview/PDF parity.
- Do **not** hard-code page heights in `mm`/`px`; use flex / `%` so orientation and `settings.pageSize` drive the canvas.
- Surfaces already have `padding: 0`; do not add compensating padding on the wrapper.
- Set size/orientation via `settings` (`pageSize`, `orientation`, margins), not CSS.
- For **edge-to-edge / full content area**, set page margins to `0` in `settings` (`marginTop` / `marginRight` / `marginBottom` / `marginLeft`). Default margins (`20`) shrink the content box; CSS cannot “undo” them.

**Fonts (preview ≈ PDF)**

Live Preview and ConvertAPI share the same Google Fonts list, embedded in a full HTML document for PDF.

- Prefer webfonts from the shared list for body/titles: `Roboto`, `Merriweather`, `Lora`, `Castoro`, `Lusitana`, `Montserrat`, etc.
- Bare `Georgia` / `Times New Roman` / `Times` / `Arial` / `Helvetica` / `Helvetica Neue` in template CSS are **auto-remapped** to Merriweather / Lora / Roboto so Mac preview and ConvertAPI Linux match.
- Prefer writing webfonts explicitly (e.g. `font-family: Merriweather, Georgia, serif;`) on wrappers/titles.
- Decorative Unicode (`&#10047;`, emoji) still differs by OS symbol fonts — prefer SVG/PNG ornaments for exact parity.

## Page settings

Pass optional `settings` to `create_html_template` / `update_html_template` / `preview_html_template`. Omitted keys use backend defaults via `normalizePageSettings`.

| Key                                                         | Type    | Allowed / notes                                             | Default           |
| ----------------------------------------------------------- | ------- | ----------------------------------------------------------- | ----------------- |
| `pageSize`                                                  | string  | `Letter`, `Legal`, `Tabloid`, `Ledger`, `A0`–`A6`, `Custom` | `A4`              |
| `orientation`                                               | string  | `portrait`, `landscape`                                     | `portrait`        |
| `customWidth` / `customHeight`                              | string  | e.g. `210mm` — used when `pageSize` is `Custom`             | `210mm` / `297mm` |
| `marginTop` / `marginRight` / `marginBottom` / `marginLeft` | number  | margin amounts; use `0` for full-bleed content              | `20`              |
| `marginUnit`                                                | string  | typically `mm`                                              | `mm`              |
| `printBackground`                                           | boolean | print CSS backgrounds                                       | `true`            |
| `displayHeaderFooter`                                       | boolean | enable header/footer HTML                                   | `true`            |
| `textDirection`                                             | string  | `ltr`, `rtl`                                                | `ltr`             |

Example:

```json
"settings": {
  "pageSize": "A4",
  "orientation": "portrait",
  "marginTop": 15,
  "marginRight": 15,
  "marginBottom": 15,
  "marginLeft": 15,
  "marginUnit": "mm",
  "printBackground": true,
  "displayHeaderFooter": false,
  "textDirection": "ltr"
}
```

Set `displayHeaderFooter` to `true` when you provide `headerHtml` / `footerHtml`.

## Mapping user data

Placeholder names come from the template, not from guesswork. After `get_template_placeholders`, copy those keys into `data`. Nested objects and arrays are allowed when the template expects them (line items, tables, images).

If the user pastes a sample Automate JSON body, keep its shape and replace only the values.

## Results

- JSON responses usually include a URL — give that URL to the user.
- After `create_html_template` / `update_html_template`, highlight `template.id`.
- After `preview_html_template`, inspect `html` to confirm placeholders resolved correctly before saving. The `html` field is a self-contained document (Google Fonts + layout CSS) matching the dashboard HTML template preview.
- Binary PDF responses are saved when `outputPath` is set; otherwise ask for a path if they want a local file.
- Surface HTTP errors and API error bodies instead of retrying blindly on 401/402. On quota failures, call `get_plan`.
