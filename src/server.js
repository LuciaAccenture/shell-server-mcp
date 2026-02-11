import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";
import { executeTool } from "./tools/stations.js";

// Define Zod schemas for tool inputs
const findStationsSchema = z.object({
  origin: z.string().describe("Origin city (e.g., 'A Coruña')"),
  destination: z.string().describe("Destination city (e.g., 'Madrid')"),
  fuelType: z.enum(["unleaded95", "unleaded98", "diesel"]).optional().describe("Type of fuel"),
});

const getBestOffersSchema = z.object({
  route: z.string().optional().describe("Route in format 'Origin-Destination'"),
});

const getCheapestStationsSchema = z.object({
  fuelType: z.enum(["unleaded95", "unleaded98", "diesel"]).describe("Type of fuel to compare prices"),
  limit: z.number().optional().describe("Maximum number of stations to return (default: 3)"),
});

function createShellStationsServer() {
  const server = new McpServer({ name: "shell-stations", version: "0.1.0" });

  // Register find_stations_on_route tool
  server.tool(
    "find_stations_on_route",
    "Find Shell gas stations along a route between two cities",
    findStationsSchema,
    async (args) => {
      const result = await executeTool("find_stations_on_route", args);
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    }
  );

  // Register get_best_offers tool
  server.tool(
    "get_best_offers",
    "Get gas stations with active offers and promotions",
    getBestOffersSchema,
    async (args) => {
      const result = await executeTool("get_best_offers", args);
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    }
  );

  // Register get_cheapest_stations tool
  server.tool(
    "get_cheapest_stations",
    "Get the cheapest gas stations sorted by fuel price",
    getCheapestStationsSchema,
    async (args) => {
      console.log("get_cheapest_stations called with:", args);
      const result = await executeTool("get_cheapest_stations", args);
      console.log("Result:", result);
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    }
  );

  return server;
}

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
    try {
      const html = readFileSync("public/index.html", "utf8");
      res.writeHead(200, { "content-type": "text/html" }).end(html);
    } catch (error) {
      res.writeHead(500).end("Error loading page");
    }
    return;
  }

  if (req.method === "GET" && url.pathname === "/style.css") {
    try {
      const css = readFileSync("public/style.css", "utf8");
      res.writeHead(200, { "content-type": "text/css" }).end(css);
    } catch (error) {
      res.writeHead(404).end("Not Found");
    }
    return;
  }

  if (req.method === "GET" && url.pathname === "/app.js") {
    try {
      const js = readFileSync("public/app.js", "utf8");
      res.writeHead(200, { "content-type": "application/javascript" }).end(js);
    } catch (error) {
      res.writeHead(404).end("Not Found");
    }
    return;
  }

  const MCP_METHODS = new Set(["POST", "GET", "DELETE"]);
  if (url.pathname === MCP_PATH && req.method && MCP_METHODS.has(req.method)) {
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
  console.log(`Shell MCP server listening on port ${port}${MCP_PATH}`);
});
