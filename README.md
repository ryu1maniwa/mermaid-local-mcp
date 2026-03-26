# mermaid-local-mcp

A local MCP (Model Context Protocol) server that renders Mermaid diagrams and returns PNG images. Designed for visual feedback loops in Claude Code -- render a diagram, inspect it visually, fix issues, re-render.

## Why?

Cloud-based Mermaid rendering MCPs depend on external APIs that can go down (503 errors, rate limits). This server runs entirely locally using [mermaid-cli (mmdc)](https://github.com/mermaid-js/mermaid-cli), so it's fast, free, and always available.

| | mermaid-local-mcp | Cloud MCP |
|---|---|---|
| Dependency | Local only | External API |
| Reliability | No 503s | Can go down |
| Offline | Works | Doesn't work |
| Speed | Fast (local render) | Network roundtrip |
| Cost | Free | Free (for now) |

## Features

- Renders Mermaid code to high-resolution PNG via Puppeteer/mmdc
- Returns images directly to Claude for visual inspection
- Generates [mermaid.live](https://mermaid.live) preview links automatically
- Reports syntax errors with actionable details
- Supports themes: `default`, `forest`, `dark`, `neutral`
- Configurable scale (1-5x), background color

## Setup

### 1. Clone

```bash
git clone https://github.com/ryu1maniwa/mermaid-local-mcp.git
cd mermaid-local-mcp
npm install
```

### 2. Configure Claude Code

Add to your project's `.mcp.json`:

```json
{
  "mcpServers": {
    "mermaid-local": {
      "command": "node",
      "args": ["/path/to/mermaid-local-mcp/index.mjs"]
    }
  }
}
```

Or add to your global `~/.claude/settings.json`:

```json
{
  "mcpServers": {
    "mermaid-local": {
      "command": "node",
      "args": ["/path/to/mermaid-local-mcp/index.mjs"]
    }
  }
}
```

### 3. Allow the tool (optional)

In `.claude/settings.json`, add to permissions:

```json
{
  "permissions": {
    "allow": ["mcp__mermaid-local"]
  }
}
```

## Tool: `render_mermaid`

Renders Mermaid diagram code to a PNG image.

### Parameters

| Parameter | Type | Default | Description |
|---|---|---|---|
| `mermaidCode` | string | (required) | Mermaid diagram code |
| `theme` | enum | `"default"` | `"default"` / `"forest"` / `"dark"` / `"neutral"` |
| `backgroundColor` | string | `"white"` | Background color (`"white"`, `"transparent"`, `"#F0F0F0"`) |
| `scale` | number | `2` | Scale factor 1-5 for resolution |

### Returns

**On success:**
- PNG image (base64-encoded, displayed inline by Claude)
- mermaid.live preview/edit link

**On error:**
- Syntax error details from mmdc stderr
- mermaid.live link for debugging

## Usage with the feedback loop skill

This MCP pairs with a Claude Code agent skill for autonomous Mermaid diagram improvement:

1. Extract Mermaid blocks from markdown files
2. Render each diagram via `render_mermaid`
3. Visually inspect the returned PNG for issues (text overlap, layout problems, poor contrast)
4. Fix the Mermaid code
5. Re-render and verify
6. Update the source markdown file

See [`SKILL.md`](./SKILL.md) for the complete skill definition.

## Requirements

- Node.js >= 18
- npx (comes with npm)
- `@mermaid-js/mermaid-cli` is invoked via npx automatically (no global install needed)

## License

MIT
