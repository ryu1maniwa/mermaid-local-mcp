import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { execFile } from "node:child_process";
import { writeFile, readFile, unlink, mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { deflateSync } from "node:zlib";

const execFileAsync = promisify(execFile);

const MMDC_PATH = "npx";
const MMDC_ARGS = ["@mermaid-js/mermaid-cli", "-q"];

/** pako-compatible deflate + base64url for mermaid.live links */
function toMermaidLiveUrl(code) {
  const json = JSON.stringify({ code, mermaid: { theme: "default" } });
  const compressed = deflateSync(Buffer.from(json, "utf-8"), { level: 9 });
  const b64 = compressed
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
  return `https://mermaid.live/edit#pako:${b64}`;
}

async function renderMermaid(mermaidCode, theme, bgColor, scale) {
  const dir = await mkdtemp(join(tmpdir(), "mermaid-"));
  const inputFile = join(dir, "input.mmd");
  const outputFile = join(dir, "output.png");

  try {
    await writeFile(inputFile, mermaidCode, "utf-8");

    const args = [
      ...MMDC_ARGS,
      "-i", inputFile,
      "-o", outputFile,
      "-s", String(scale),
      "-t", theme,
      "-b", bgColor,
    ];

    const { stderr } = await execFileAsync(MMDC_PATH, args, {
      timeout: 30_000,
      env: { ...process.env, NODE_OPTIONS: "" },
    });

    const pngBuffer = await readFile(outputFile);
    const base64 = pngBuffer.toString("base64");

    return { ok: true, base64, stderr: stderr.trim() };
  } catch (err) {
    const message = err.stderr?.trim() || err.message;
    return { ok: false, base64: null, stderr: message };
  } finally {
    await unlink(inputFile).catch(() => {});
    await unlink(outputFile).catch(() => {});
    await unlink(dir).catch(() => {});
  }
}

const server = new McpServer({
  name: "mermaid-local",
  version: "1.0.0",
});

server.tool(
  "render_mermaid",
  "Render Mermaid diagram code to PNG image locally using mmdc. Returns the rendered image for visual inspection. Use this for feedback loops: render -> inspect -> fix -> re-render.",
  {
    mermaidCode: z.string().describe("Mermaid diagram code to render"),
    theme: z
      .enum(["default", "forest", "dark", "neutral"])
      .default("default")
      .describe("Mermaid theme"),
    backgroundColor: z
      .string()
      .default("white")
      .describe("Background color (e.g. 'white', 'transparent', '#F0F0F0')"),
    scale: z
      .number()
      .min(1)
      .max(5)
      .default(2)
      .describe("Scale factor for higher resolution (1-5)"),
  },
  async ({ mermaidCode, theme, backgroundColor, scale }) => {
    const result = await renderMermaid(mermaidCode, theme, backgroundColor, scale);
    const liveUrl = toMermaidLiveUrl(mermaidCode);

    if (!result.ok) {
      return {
        content: [
          {
            type: "text",
            text: [
              "Rendering failed. Fix the syntax errors below and retry.",
              "",
              "```",
              result.stderr,
              "```",
              "",
              `Preview/debug: ${liveUrl}`,
            ].join("\n"),
          },
        ],
        isError: true,
      };
    }

    const content = [
      {
        type: "image",
        data: result.base64,
        mimeType: "image/png",
      },
      {
        type: "text",
        text: `Mermaid Live: ${liveUrl}`,
      },
    ];

    if (result.stderr) {
      content.push({
        type: "text",
        text: `Warnings:\n${result.stderr}`,
      });
    }

    return { content };
  }
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("mermaid-local MCP server running on stdio");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
