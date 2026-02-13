# Shell Stations MCP Server

A Model Context Protocol (MCP) server that provides access to Shell gas station information, supporting both Claude Desktop (stdio mode) and web deployments (HTTP mode).

## Features

- 🔍 **Find stations on route**: Locate Shell gas stations between two cities
- 💰 **Best offers**: Discover stations with active promotions
- 📊 **Cheapest stations**: Compare fuel prices across stations

## Dual-Mode Support

The server automatically detects and runs in the appropriate mode:

### stdio Mode (Claude Desktop)
- Activated when: No `PORT` environment variable and stdin is not a TTY
- Uses: `StdioServerTransport` for MCP protocol communication
- Logging: All logs go to stderr to keep stdout clean

### HTTP Mode (Web/Render)
- Activated when: `PORT` environment variable is set
- Uses: `StreamableHTTPServerTransport` for HTTP-based MCP
- Endpoints:
  - `/` - Health check endpoint
  - `/mcp` - MCP protocol endpoint with CORS support

## Installation

```bash
npm install
```

## Usage

### Local Development (HTTP Mode)

```bash
npm start
```

Server will start on http://localhost:8787

### Claude Desktop (stdio Mode)

Configure Claude Desktop with the following in your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "shell-stations": {
      "command": "/full/path/to/node",
      "args": ["/full/path/to/shell-server-mcp/src/server.js"]
    }
  }
}
```

**Important**: Do NOT include `"env": {"PORT": "8787"}` in the Claude Desktop config, as this would force HTTP mode instead of stdio mode.

### Render Deployment (HTTP Mode)

Set the `PORT` environment variable in your Render dashboard. The server will automatically run in HTTP mode.

## Available Tools

### 1. find_stations_on_route

Find Shell gas stations along a route between two cities.

**Parameters:**
- `origin` (string, required): Origin city (e.g., "A Coruña")
- `destination` (string, required): Destination city (e.g., "Madrid")
- `fuelType` (string, optional): Type of fuel - "unleaded95", "unleaded98", or "diesel" (default: "diesel")

### 2. get_best_offers

Get gas stations with active offers and promotions.

**Parameters:**
- `route` (string, required): Route in format "Origin-Destination"

### 3. get_cheapest_stations

Get the cheapest gas stations sorted by fuel price.

**Parameters:**
- `fuelType` (string, required): Type of fuel to compare - "unleaded95", "unleaded98", or "diesel"
- `limit` (number, optional): Maximum number of stations to return (default: 3)

## Testing

### Manual Testing

#### Test stdio Mode:
```bash
echo '{"jsonrpc":"2.0","method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0.0"}},"id":1}' | node src/server.js
```

#### Test HTTP Mode:
```bash
PORT=8787 node src/server.js &
curl http://localhost:8787/
curl -X POST http://localhost:8787/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","method":"tools/list","params":{},"id":1}'
```

## Requirements

- Node.js >= 18.0.0

## Dependencies

- `@modelcontextprotocol/sdk` - MCP SDK for protocol implementation
- `zod` - Schema validation for tool parameters

## License

MIT
