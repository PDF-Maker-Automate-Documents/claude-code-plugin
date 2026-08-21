#!/usr/bin/env node
/**
 * stdio MCP server for THE PDF MAKER API.
 * Logs must go to stderr — stdout is reserved for MCP JSON-RPC.
 */

import { writeFile } from "node:fs/promises";
import { isAbsolute, resolve } from "node:path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const BASE_URL = "https://api.thepdfmaker.com";
const API_KEY_HEADER = "x-api-key";
const MAX_ERROR_BODY = 8000;

function log(...args) {
  console.error("[pdf-maker]", ...args);
}

function getApiKey() {
  const key = process.env.PDF_MAKER_API_KEY?.trim();
  if (!key) {
    throw new Error(
      "PDF_MAKER_API_KEY is not set. Copy your API key from The PDF Maker dashboard (Automate / API panel) and export it in the environment before starting Claude Code."
    );
  }
  return key;
}

function textResult(text, isError = false) {
  return {
    content: [{ type: "text", text }],
    isError,
  };
}

function errorResult(err) {
  const message = err instanceof Error ? err.message : String(err);
  return textResult(message, true);
}

function parseData(data) {
  if (data === undefined || data === null) return {};
  if (typeof data === "string") {
    const trimmed = data.trim();
    if (!trimmed) return {};
    return JSON.parse(trimmed);
  }
  return data;
}

function resolveOutputPath(outputPath) {
  if (!outputPath) return null;
  return isAbsolute(outputPath) ? outputPath : resolve(process.cwd(), outputPath);
}

function looksLikePdf(buffer, contentType) {
  if (contentType.includes("application/pdf")) return true;
  return buffer.length >= 5 && buffer.subarray(0, 5).toString("utf8") === "%PDF-";
}

function extractPdfUrl(value) {
  if (!value || typeof value !== "object") return null;
  const candidates = [
    value.url,
    value.pdfUrl,
    value.pdf_url,
    value.downloadUrl,
    value.download_url,
    value.fileUrl,
    value.file_url,
    value.link,
  ];
  for (const candidate of candidates) {
    if (typeof candidate === "string" && /^https?:\/\//i.test(candidate)) {
      return candidate;
    }
  }
  return null;
}

function formatJson(value) {
  return JSON.stringify(value, null, 2);
}

async function pdfMakerFetch({ method, path, query, body, extraHeaders }) {
  const apiKey = getApiKey();
  const url = new URL(path.startsWith("http") ? path : `${BASE_URL}${path.startsWith("/") ? path : `/${path}`}`);

  if (url.origin !== new URL(BASE_URL).origin) {
    throw new Error(`Refusing to call ${url.origin}. Only ${BASE_URL} is allowed.`);
  }

  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined || value === null || value === "") continue;
      url.searchParams.set(key, String(value));
    }
  }

  const headers = {
    [API_KEY_HEADER]: apiKey,
    Accept: "application/json, application/pdf, */*",
    ...extraHeaders,
  };

  const init = { method, headers };
  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    init.body = JSON.stringify(body);
  }

  const response = await fetch(url, init);
  const buffer = Buffer.from(await response.arrayBuffer());
  const contentType = response.headers.get("content-type") || "";

  return { response, buffer, contentType, url: url.toString() };
}

async function maybeDownloadUrl(pdfUrl, outputPath) {
  if (!pdfUrl || !outputPath) return null;
  const apiKey = getApiKey();
  const response = await fetch(pdfUrl, {
    headers: {
      [API_KEY_HEADER]: apiKey,
      Accept: "application/pdf, */*",
    },
  });
  const buffer = Buffer.from(await response.arrayBuffer());
  if (!response.ok) {
    throw new Error(
      `Failed to download PDF from ${pdfUrl}: HTTP ${response.status} ${buffer.toString("utf8").slice(0, MAX_ERROR_BODY)}`
    );
  }
  const filePath = resolveOutputPath(outputPath);
  await writeFile(filePath, buffer);
  return filePath;
}

async function handleResponse({ response, buffer, contentType, outputPath, requestUrl }) {
  const statusLine = `HTTP ${response.status} ${response.statusText}`.trim();

  if (looksLikePdf(buffer, contentType.toLowerCase())) {
    if (!outputPath) {
      return textResult(
        `${statusLine}\nReceived an application/pdf body (${buffer.length} bytes) from ${requestUrl}.\nPass outputPath to save the file.`
      );
    }
    const filePath = resolveOutputPath(outputPath);
    await writeFile(filePath, buffer);
    return textResult(`${statusLine}\nSaved PDF (${buffer.length} bytes) to ${filePath}`);
  }

  const raw = buffer.toString("utf8");
  let parsed;
  try {
    parsed = raw ? JSON.parse(raw) : null;
  } catch {
    parsed = null;
  }

  if (!response.ok) {
    const detail = parsed ? formatJson(parsed) : raw.slice(0, MAX_ERROR_BODY) || "(empty body)";
    return textResult(`${statusLine} from ${requestUrl}\n${detail}`, true);
  }

  const savedPath = parsed ? await maybeDownloadUrl(extractPdfUrl(parsed), outputPath) : null;
  const parts = [statusLine, parsed ? formatJson(parsed) : raw || "(empty body)"];
  if (savedPath) {
    parts.push(`Downloaded PDF to ${savedPath}`);
  }
  return textResult(parts.join("\n\n"));
}

async function callApi(options) {
  try {
    const result = await pdfMakerFetch(options);
    return await handleResponse({
      ...result,
      requestUrl: result.url,
      outputPath: options.outputPath,
    });
  } catch (err) {
    return errorResult(err);
  }
}

const server = new McpServer({
  name: "pdf-maker",
  version: "1.0.0",
});

server.tool(
  "list_templates",
  "List all PDF Maker templates for the authenticated account (GET /templates).",
  {},
  async () => callApi({ method: "GET", path: "/templates" })
);

server.tool(
  "get_template_placeholders",
  "List placeholders for a PDF Maker template (GET /templates/placeholders). Use this before create_pdf so data keys match the template.",
  {
    templateId: z.string().min(1).describe("Template ID whose placeholders should be listed."),
  },
  async ({ templateId }) =>
    callApi({
      method: "GET",
      path: "/templates/placeholders",
      query: { templateId },
    })
);

server.tool(
  "create_pdf",
  "Create a PDF from a template by filling placeholders with JSON data (POST /pdf). Typically returns a URL to the generated file. Pass outputPath to save a binary PDF or download from that URL.",
  {
    templateId: z.string().min(1).describe("ID of the template to render."),
    data: z
      .union([z.record(z.any()), z.string()])
      .optional()
      .describe("Placeholder values as an object or JSON string. Keys must match the template placeholders."),
    pdfFileName: z.string().optional().describe("Optional output file name for the generated PDF."),
    outputPath: z
      .string()
      .optional()
      .describe("If the API returns PDF bytes or a download URL, save the file at this workspace path."),
  },
  async ({ templateId, data, pdfFileName, outputPath }) => {
    let parsedData;
    try {
      parsedData = parseData(data);
    } catch (err) {
      return errorResult(new Error(`data is not valid JSON: ${err instanceof Error ? err.message : String(err)}`));
    }

    const body = { templateId, data: parsedData };
    if (pdfFileName) body.pdfFileName = pdfFileName;

    return callApi({
      method: "POST",
      path: "/pdf",
      body,
      outputPath,
    });
  }
);

server.tool(
  "auth_check",
  "Verify that PDF_MAKER_API_KEY is accepted by THE PDF MAKER API (GET /).",
  {},
  async () => callApi({ method: "GET", path: "/" })
);

server.tool(
  "create_airtable_pdf",
  "Generate a PDF from an Airtable record (POST /airtable/pdf). Prefer this over the GET variant so the API key stays in the header.",
  {
    templateId: z.string().min(1).describe("Template ID to render."),
    recordId: z.string().min(1).describe("Airtable record ID (starts with rec)."),
    outputPath: z
      .string()
      .optional()
      .describe("If the API returns PDF bytes or a download URL, save the file at this workspace path."),
  },
  async ({ templateId, recordId, outputPath }) =>
    callApi({
      method: "POST",
      path: "/airtable/pdf",
      body: { templateId, recordId },
      outputPath,
    })
);

server.tool(
  "create_airtable_pdf_get",
  "Generate a PDF from an Airtable record via GET /airtable/pdf. The API key is sent as the apiKey query parameter; prefer create_airtable_pdf (POST) when possible.",
  {
    templateId: z.string().min(1).describe("Template ID to render."),
    recordId: z.string().min(1).describe("Airtable record ID (starts with rec)."),
    outputPath: z
      .string()
      .optional()
      .describe("If the API returns PDF bytes or a download URL, save the file at this workspace path."),
  },
  async ({ templateId, recordId, outputPath }) => {
    let apiKey;
    try {
      apiKey = getApiKey();
    } catch (err) {
      return errorResult(err);
    }
    return callApi({
      method: "GET",
      path: "/airtable/pdf",
      query: { apiKey, templateId, recordId },
      outputPath,
    });
  }
);

server.tool(
  "pdf_maker_request",
  "Authenticated request to any THE PDF MAKER API path under https://api.thepdfmaker.com. Use dedicated tools when they exist.",
  {
    method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE"]).describe("HTTP method."),
    path: z
      .string()
      .min(1)
      .describe("Path or full api.thepdfmaker.com URL, for example /pdf or /templates."),
    query: z
      .record(z.union([z.string(), z.number(), z.boolean()]))
      .optional()
      .describe("Query string parameters."),
    body: z
      .union([z.record(z.any()), z.string()])
      .optional()
      .describe("JSON body as an object or JSON string. Ignored for GET."),
    outputPath: z
      .string()
      .optional()
      .describe("If the API returns PDF bytes or a download URL, save the file at this workspace path."),
  },
  async ({ method, path, query, body, outputPath }) => {
    let parsedBody;
    try {
      parsedBody = body === undefined ? undefined : parseData(body);
    } catch (err) {
      return errorResult(new Error(`body is not valid JSON: ${err instanceof Error ? err.message : String(err)}`));
    }

    return callApi({
      method,
      path,
      query,
      body: method === "GET" || method === "DELETE" ? undefined : parsedBody,
      outputPath,
    });
  }
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  log("THE PDF MAKER API MCP server connected over stdio");
}

main().catch((err) => {
  log("fatal", err);
  process.exit(1);
});
