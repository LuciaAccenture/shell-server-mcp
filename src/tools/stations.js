import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const stationsMock = JSON.parse(
  readFileSync(join(__dirname, "../data/stations-mock.json"), "utf8")
);

export const tools = [
  {
    name: "find_stations_on_route",
    description: "Find Shell gas stations along a route between two cities",
    inputSchema: {
      type: "object",
      properties: {
        origin: {
          type: "string",
          description: "Origin city (e.g., 'A Coruña')",
        },
        destination: {
          type: "string",
          description: "Destination city (e.g., 'Madrid')",
        },
        fuelType: {
          type: "string",
          enum: ["unleaded95", "unleaded98", "diesel"],
          description: "Type of fuel",
        },
      },
      required: ["origin", "destination"],
    },
  },
  {
    name: "get_best_offers",
    description: "Get gas stations with active offers and promotions",
    inputSchema: {
      type: "object",
      properties: {
        route: {
          type: "string",
          description: "Route in format 'Origin-Destination' (optional)",
        },
      },
    },
  },
  {
    name: "get_cheapest_stations",
    description: "Get the cheapest gas stations sorted by fuel price",
    inputSchema: {
      type: "object",
      properties: {
        fuelType: {
          type: "string",
          enum: ["unleaded95", "unleaded98", "diesel"],
          description: "Type of fuel to compare prices",
        },
        limit: {
          type: "number",
          description: "Maximum number of stations to return (default: 3)",
        },
      },
      required: ["fuelType"],
    },
  },
];

// Function to execute tools
export async function executeTool(name, args) {
  switch (name) {
    case "find_stations_on_route":
      return findStations(args);
    case "get_best_offers":
      return getBestOffers(args);
    case "get_cheapest_stations":
      return getCheapestStations(args);
    default:
      throw new Error(`Tool not found: ${name}`);
  }
}

function findStations(args) {
  const { origin, destination, fuelType = "diesel" } = args;

  const stations = [...stationsMock.stations].sort(
    (a, b) => a.prices[fuelType] - b.prices[fuelType]
  );

  return {
    route: `${origin} → ${destination}`,
    stations: stations,
    totalStations: stations.length,
  };
}

function getBestOffers(args) {
  const stationsWithOffers = stationsMock.stations.filter(
    (s) => s.offers.length > 0
  );

  return {
    stationsWithOffers,
    total: stationsWithOffers.length,
  };
}

function getCheapestStations(args) {
  const { fuelType, limit = 3 } = args;

  const sorted = [...stationsMock.stations]
    .sort((a, b) => a.prices[fuelType] - b.prices[fuelType])
    .slice(0, limit);

  return {
    fuelType,
    cheapestStations: sorted,
    lowestPrice: sorted[0]?.prices[fuelType],
  };
}
