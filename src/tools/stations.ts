import stationsMock from "../data/stations-mock.json";

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
          description: "Route in format 'Origin-Destination'",
        },
      },
      required: ["route"],
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

type FuelType = "unleaded95" | "unleaded98" | "diesel";

type FindStationsArgs = {
  origin: string;
  destination: string;
  fuelType?: FuelType;
};

type GetBestOffersArgs = {
  route: string;
};

type GetCheapestStationsArgs = {
  fuelType: FuelType;
  limit?: number;
};

// Function to execute tools
export async function executeTool(name: string, args: unknown) {
  switch (name) {
    case "find_stations_on_route":
      return findStations(args as FindStationsArgs);
    case "get_best_offers":
      return getBestOffers(args as GetBestOffersArgs);
    case "get_cheapest_stations":
      return getCheapestStations(args as GetCheapestStationsArgs);
    default:
      throw new Error(`Tool not found: ${name}`);
  }
}

function findStations(args: FindStationsArgs) {
  const { origin, destination, fuelType = "diesel" } = args;

  const stations = stationsMock.stations.sort(
    (a, b) => a.prices[fuelType] - b.prices[fuelType],
  );

  return {
    route: `${origin} → ${destination}`,
    stations: stations,
    totalStations: stations.length,
  };
}

function getBestOffers(args: GetBestOffersArgs) {
  const stationsWithOffers = stationsMock.stations.filter(
    (s) => s.offers.length > 0,
  );

  return {
    stationsWithOffers,
    total: stationsWithOffers.length,
  };
}

function getCheapestStations(args: GetCheapestStationsArgs) {
  const { fuelType, limit = 3 } = args;

  const sorted = stationsMock.stations
    .sort((a, b) => a.prices[fuelType] - b.prices[fuelType])
    .slice(0, limit);

  return {
    fuelType,
    cheapestStations: sorted,
    lowestPrice: sorted[0]?.prices[fuelType],
  };
}
