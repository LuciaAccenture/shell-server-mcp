import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";

// Load Shell stations data
const stationsMock = JSON.parse(
  readFileSync("src/data/stations-mock.json", "utf8"),
);

// Tool schemas using Zod
const findStationsInputSchema = {
  origin: z.string().describe("Origin city (e.g., 'A Coruña')"),
  destination: z.string().describe("Destination city (e.g., 'Madrid')"),
  fuelType: z
    .enum(["unleaded95", "unleaded98", "diesel"])
    .optional()
    .describe("Type of fuel"),
};

const getBestOffersInputSchema = {
  route: z.string().describe("Route in format 'Origin-Destination'"),
};

const getCheapestStationsInputSchema = {
  fuelType: z
    .enum(["unleaded95", "unleaded98", "diesel"])
    .describe("Type of fuel to compare prices"),
  limit: z.number().optional().describe("Maximum number of stations to return (default: 3)"),
};

// Tool execution functions
function findStations(args) {
  const { origin, destination, fuelType = "diesel" } = args;

  const stations = stationsMock.stations.sort(
    (a, b) => a.prices[fuelType] - b.prices[fuelType],
  );

  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(
          {
            route: `${origin} → ${destination}`,
            stations: stations,
            totalStations: stations.length,
          },
          null,
          2,
        ),
      },
    ],
  };
}

function getBestOffers(args) {
  const stationsWithOffers = stationsMock.stations.filter(
    (s) => s.offers.length > 0,
  );

  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(
          {
            stationsWithOffers,
            total: stationsWithOffers.length,
          },
          null,
          2,
        ),
      },
    ],
  };
}

function getCheapestStations(args) {
  const { fuelType, limit = 3 } = args;

  const sorted = stationsMock.stations
    .sort((a, b) => a.prices[fuelType] - b.prices[fuelType])
    .slice(0, limit);

  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(
          {
            fuelType,
            cheapestStations: sorted,
            lowestPrice: sorted[0]?.prices[fuelType],
          },
          null,
          2,
        ),
      },
    ],
  };
}

// Create Shell Stations MCP Server
function createShellStationsServer() {
  const server = new McpServer({
    name: "shell-stations",
    version: "1.0.0",
  });

  // Register tools
  server.registerTool(
    "find_stations_on_route",
    {
      description: "Find Shell gas stations along a route between two cities",
      inputSchema: findStationsInputSchema,
    },
    async (args) => findStations(args),
  );

  server.registerTool(
    "get_best_offers",
    {
      description: "Get gas stations with active offers and promotions",
      inputSchema: getBestOffersInputSchema,
    },
    async (args) => getBestOffers(args),
  );

  server.registerTool(
    "get_cheapest_stations",
    {
      description: "Get the cheapest gas stations sorted by fuel price",
      inputSchema: getCheapestStationsInputSchema,
    },
    async (args) => getCheapestStations(args),
  );

  return server;
}

// Detect mode: stdio or HTTP
const isStdioMode = !process.env.PORT && !process.stdin.isTTY;

if (isStdioMode) {
  // STDIO MODE for Claude Desktop
  console.error("Starting Shell MCP server in stdio mode...");

  const server = createShellStationsServer();
  const transport = new StdioServerTransport();

  await server.connect(transport);
  console.error("Shell MCP server ready (stdio mode)");
} else {
  // HTTP MODE for Render/web
  const port = Number(process.env.PORT ?? 8787);
  const MCP_PATH = "/mcp";

  const httpServer = createServer(async (req, res) => {
    if (!req.url) {
      res.writeHead(400).end("Missing URL");
      return;
    }

    const url = new URL(req.url, `http://${req.headers.host ?? "localhost"}`);

    if (req.method === "OPTIONS" && url.pathname === MCP_PATH) {
      res.writeHead(204, {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
        "Access-Control-Allow-Headers": "content-type, mcp-session-id",
        "Access-Control-Expose-Headers": "Mcp-Session-Id",
      });
      res.end();
      return;
    }

    if (req.method === "GET" && url.pathname === "/") {
      res
        .writeHead(200, { "content-type": "text/plain" })
        .end("Shell Stations MCP server is running!");
      return;
    }

    const MCP_METHODS = new Set(["POST", "GET", "DELETE"]);
    if (
      url.pathname === MCP_PATH &&
      req.method &&
      MCP_METHODS.has(req.method)
    ) {
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Access-Control-Expose-Headers", "Mcp-Session-Id");

      const server = createShellStationsServer();
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined,
        enableJsonResponse: true,
      });

      res.on("close", () => {
        transport.close();
        server.close();
      });

      try {
        await server.connect(transport);
        await transport.handleRequest(req, res);
      } catch (error) {
        console.error("Error handling MCP request:", error);
        if (!res.headersSent) {
          res.writeHead(500).end("Internal server error");
        }
      }
      return;
    }

    res.writeHead(404).end("Not Found");
  });

  httpServer.listen(port, "0.0.0.0", () => {
    console.error(`Shell MCP server listening on port ${port}${MCP_PATH}`);
  });
}
