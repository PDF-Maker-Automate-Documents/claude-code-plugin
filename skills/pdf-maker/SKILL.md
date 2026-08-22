---
name: pdf-maker
description: Generate PDFs and call THE PDF MAKER API from Claude Code. Use when the user wants to create a PDF, create an HTML/WYSIWYG template, list PDF Maker templates, fill template placeholders, check plan usage, generate a document from JSON, or call api.thepdfmaker.com.
allowed-tools:
  - mcp__plugin_pdf-maker_api__list_templates
  - mcp__plugin_pdf-maker_api__create_html_template
  - mcp__plugin_pdf-maker_api__get_template_placeholders
  - mcp__plugin_pdf-maker_api__create_pdf
  - mcp__plugin_pdf-maker_api__auth_check
  - mcp__plugin_pdf-maker_api__get_plan
  - mcp__plugin_pdf-maker_api__pdf_maker_request
---

# The PDF Maker

Call [THE PDF MAKER API](https://documenter.getpostman.com/view/15968072/2sA35HVzrs#intro) through this plugin's MCP tools. Do not invent curl commands when these tools are available.

## Prerequisites

- `PDF_MAKER_API_KEY` must be set in the environment. Get it after login from [Settings → API Key](https://app.thepdfmaker.com/settings?tab=api-key).
- Templates can be created in the [dashboard](https://app.thepdfmaker.com/) **or** via `create_html_template` (WYSIWYG/HTML + API data source).
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

## Workflow — create an HTML template then generate a PDF

1. Author `bodyHtml` with Nunjucks placeholders and SunEditor-compatible markup (see below).
2. Call `create_html_template` with `name`, `bodyHtml`, and ideally `sampleData` matching those placeholders.
3. Read `template.id` from the response.
4. Call `get_template_placeholders` (optional check), then `create_pdf` with real `data`.
5. The user can later open the same template in the dashboard WYSIWYG editor at `/templates/wysiwyg-editor?id=<templateId>`.

If `create_pdf` or `create_html_template` fails with a plan/quota error (402/400), call `get_plan` and explain remaining PDF/template usage to the user.

Use `pdf_maker_request` only for documented paths that do not have a dedicated tool. Allowed host is `https://keena-homoeomorphic-nila.ngrok-free.app/openapi`.

## HTML / Nunjucks / SunEditor conventions

Templates created via `create_html_template` use the same engine as the dashboard WYSIWYG editor.

**Placeholders**

- Text: `{{ customer_name }}`
- Loops: `{% for item in line_items %}...{% endfor %}`
- Conditions: `{% if show_discount %}...{% endif %}`
- Filters: `render_qr`, `render_barcode`, `render_chart` (e.g. `{{ invoice_number | render_qr(width=240, margin=1, style="width: 120px;") }}`)

**SunEditor layout tables** (so the dashboard editor handles tables cleanly):

```html
<figure
  class="se-flex-component se-input-component se-scroll-figure-x"
  style="width: 100%"
>
  <table class="se-table-layout-auto">
    <colgroup>
      <col style="width: 50%" />
      <col style="width: 50%" />
    </colgroup>
    <tbody>
      <tr>
        <td class="" style="vertical-align: top"><div>{{ left }}</div></td>
        <td class="" style="text-align: right"><div>{{ right }}</div></td>
      </tr>
    </tbody>
  </table>
</figure>
```

**Loop marker rows** — put `{% for %}` / `{% endfor %}` on rows with `class="show-only-in-editor"` so control tags are hidden in the PDF:

```html
<tr class="show-only-in-editor">
  <td colspan="4"><div>{% for item in line_items %}</div></td>
</tr>
<tr>
  <td><div>{{ item.name }}</div></td>
  <td><div>{{ item.qty }}</div></td>
  <td><div>{{ item.price }}</div></td>
</tr>
<tr class="show-only-in-editor">
  <td colspan="4"><div>{% endfor %}</div></td>
</tr>
```

**Header / footer** — use inline styles only (they render in isolation). Optional ConvertAPI classes: `pageNumber`, `totalPages`, `date`.

**Minimal example**

```html
<p><strong>Invoice</strong> {{ invoice_number }}</p>
<p>Bill to: {{ customer_name }}</p>
<p>Total: $ {{ invoice_total }}</p>
```

With `sampleData`: `{ "invoice_number": "INV-1", "customer_name": "Jane", "invoice_total": 100 }`.

## Page settings

Pass optional `settings` to `create_html_template`. Omitted keys use backend defaults via `normalizePageSettings`.

| Key                                                         | Type    | Allowed / notes                                             | Default           |
| ----------------------------------------------------------- | ------- | ----------------------------------------------------------- | ----------------- |
| `pageSize`                                                  | string  | `Letter`, `Legal`, `Tabloid`, `Ledger`, `A0`–`A6`, `Custom` | `A4`              |
| `orientation`                                               | string  | `portrait`, `landscape`                                     | `portrait`        |
| `customWidth` / `customHeight`                              | string  | e.g. `210mm` — used when `pageSize` is `Custom`             | `210mm` / `297mm` |
| `marginTop` / `marginRight` / `marginBottom` / `marginLeft` | number  | margin amounts                                              | `20`              |
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
- After `create_html_template`, highlight `template.id` so the user can reuse it or open it in the dashboard.
- Binary PDF responses are saved when `outputPath` is set; otherwise ask for a path if they want a local file.
- Surface HTTP errors and API error bodies instead of retrying blindly on 401/402. On quota failures, call `get_plan`.
