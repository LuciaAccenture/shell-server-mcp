// MCP Client for Shell Gas Stations Finder

const chatContainer = document.getElementById("chatContainer");
const userInput = document.getElementById("userInput");
const sendBtn = document.getElementById("sendBtn");

let sessionId = null;
let isProcessing = false;

// Initialize MCP session
async function initializeSession() {
  try {
    const response = await fetch("/mcp", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json, text/event-stream",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2024-11-05",
          capabilities: {},
          clientInfo: {
            name: "shell-web-client",
            version: "1.0.0",
          },
        },
      }),
    });

    const data = await response.json();
    sessionId = response.headers.get("mcp-session-id");
    console.log("Session initialized:", sessionId);
    return data;
  } catch (error) {
    console.error("Failed to initialize session:", error);
    showError("Failed to connect to server. Please refresh the page.");
  }
}

// Call MCP tool
async function callTool(toolName, args) {
  if (!sessionId) {
    await initializeSession();
  }

  try {
    const response = await fetch("/mcp", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json, text/event-stream",
        "mcp-session-id": sessionId,
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: Date.now(),
        method: "tools/call",
        params: {
          name: toolName,
          arguments: args,
        },
      }),
    });

    const data = await response.json();
    return data.result;
  } catch (error) {
    console.error("Tool call failed:", error);
    throw error;
  }
}

// Determine which tool to call based on user query
function determineToolAndArgs(query) {
  const lowerQuery = query.toLowerCase();

  // Check for route-based queries
  if (lowerQuery.includes("from") && lowerQuery.includes("to")) {
    const fromMatch = lowerQuery.match(/from\s+([a-záéíóúñ\s]+?)(?:\s+to)/i);
    const toMatch = lowerQuery.match(/to\s+([a-záéíóúñ\s]+?)(?:\s*$|\.|\?)/i);

    if (fromMatch && toMatch) {
      const origin = fromMatch[1].trim();
      const destination = toMatch[1].trim();
      let fuelType = "diesel";

      if (lowerQuery.includes("unleaded95") || lowerQuery.includes("95")) {
        fuelType = "unleaded95";
      } else if (lowerQuery.includes("unleaded98") || lowerQuery.includes("98")) {
        fuelType = "unleaded98";
      } else if (lowerQuery.includes("diesel")) {
        fuelType = "diesel";
      }

      return {
        tool: "find_stations_on_route",
        args: { origin, destination, fuelType },
      };
    }
  }

  // Check for offers query
  if (lowerQuery.includes("offer") || lowerQuery.includes("promotion") || lowerQuery.includes("deal")) {
    return {
      tool: "get_best_offers",
      args: {},
    };
  }

  // Check for cheapest query
  if (lowerQuery.includes("cheap") || lowerQuery.includes("price")) {
    let fuelType = "diesel";
    let limit = 3;

    if (lowerQuery.includes("unleaded95") || lowerQuery.includes("95")) {
      fuelType = "unleaded95";
    } else if (lowerQuery.includes("unleaded98") || lowerQuery.includes("98")) {
      fuelType = "unleaded98";
    } else if (lowerQuery.includes("diesel")) {
      fuelType = "diesel";
    }

    const limitMatch = lowerQuery.match(/(\d+)\s+(?:cheapest|stations?)/);
    if (limitMatch) {
      limit = parseInt(limitMatch[1]);
    }

    return {
      tool: "get_cheapest_stations",
      args: { fuelType, limit },
    };
  }

  // Default to find stations from A Coruña to Madrid
  return {
    tool: "find_stations_on_route",
    args: { origin: "A Coruña", destination: "Madrid", fuelType: "diesel" },
  };
}

// Display user message
function displayUserMessage(message) {
  const messageDiv = document.createElement("div");
  messageDiv.className = "message user";
  messageDiv.innerHTML = `<div class="message-content">${escapeHtml(message)}</div>`;
  chatContainer.appendChild(messageDiv);
  scrollToBottom();
}

// Display assistant message
function displayAssistantMessage(content) {
  const messageDiv = document.createElement("div");
  messageDiv.className = "message assistant";
  messageDiv.innerHTML = `<div class="message-content">${content}</div>`;
  chatContainer.appendChild(messageDiv);
  scrollToBottom();
}

// Show loading indicator
function showLoading() {
  const loadingDiv = document.createElement("div");
  loadingDiv.className = "message assistant";
  loadingDiv.id = "loading";
  loadingDiv.innerHTML = `
    <div class="loading">
      <div class="loading-spinner"></div>
      <span>Searching stations...</span>
    </div>
  `;
  chatContainer.appendChild(loadingDiv);
  scrollToBottom();
}

// Remove loading indicator
function removeLoading() {
  const loading = document.getElementById("loading");
  if (loading) {
    loading.remove();
  }
}

// Show error message
function showError(message) {
  const errorDiv = document.createElement("div");
  errorDiv.className = "error";
  errorDiv.textContent = message;
  chatContainer.appendChild(errorDiv);
  scrollToBottom();
}

// Format station card
function formatStationCard(station, cheapestFuelType = null) {
  const hasOffers = station.offers && station.offers.length > 0;

  let pricesHtml = '<div class="prices">';
  for (const [fuelType, price] of Object.entries(station.prices)) {
    const isCheapest = fuelType === cheapestFuelType;
    pricesHtml += `
      <div class="price-item">
        <div class="price-label">${fuelType.replace("unleaded", "Unleaded ")}</div>
        <div class="price-value ${isCheapest ? "cheapest" : ""}">€${price.toFixed(3)}</div>
      </div>
    `;
  }
  pricesHtml += "</div>";

  let offersHtml = "";
  if (hasOffers) {
    offersHtml = '<div class="offers">';
    station.offers.forEach((offer) => {
      offersHtml += `
        <div class="offer-badge">🎁 ${offer.type.toUpperCase()}</div>
        <div class="offer-description">${offer.description}</div>
      `;
    });
    offersHtml += "</div>";
  }

  let amenitiesHtml = "";
  if (station.amenities && station.amenities.length > 0) {
    amenitiesHtml = '<div class="amenities">';
    station.amenities.forEach((amenity) => {
      const icon = getAmenityIcon(amenity);
      amenitiesHtml += `<span class="amenity">${icon} ${amenity}</span>`;
    });
    amenitiesHtml += "</div>";
  }

  return `
    <div class="station-card">
      <div class="station-header">
        <div>
          <div class="station-name">${station.name}</div>
          <div class="station-location">${station.location.city} - ${station.location.address}</div>
        </div>
        <div class="station-distance">${station.distanceFromOrigin} km</div>
      </div>
      ${pricesHtml}
      ${offersHtml}
      ${amenitiesHtml}
    </div>
  `;
}

// Get amenity icon
function getAmenityIcon(amenity) {
  const icons = {
    Shop: "🛒",
    Coffee: "☕",
    Restrooms: "🚻",
    "Car wash": "🚿",
    "Rest area": "🅿️",
  };
  return icons[amenity] || "✓";
}

// Format response based on tool result
function formatResponse(toolName, result) {
  let html = "";

  if (toolName === "find_stations_on_route") {
    html += `<div style="margin-bottom: 16px;"><strong>Route:</strong> ${result.route}</div>`;
    html += `<div style="margin-bottom: 16px;"><strong>Found ${result.totalStations} stations</strong></div>`;
    result.stations.forEach((station) => {
      html += formatStationCard(station);
    });
  } else if (toolName === "get_best_offers") {
    if (result.total === 0) {
      html += `<div>No stations with active offers found.</div>`;
    } else {
      html += `<div style="margin-bottom: 16px;"><strong>Found ${result.total} stations with offers</strong></div>`;
      result.stationsWithOffers.forEach((station) => {
        html += formatStationCard(station);
      });
    }
  } else if (toolName === "get_cheapest_stations") {
    html += `<div style="margin-bottom: 16px;"><strong>Cheapest ${result.fuelType} prices</strong></div>`;
    html += `<div style="margin-bottom: 16px;">Lowest price: €${result.lowestPrice.toFixed(3)}/L</div>`;
    result.cheapestStations.forEach((station) => {
      html += formatStationCard(station, result.fuelType);
    });
  }

  return html;
}

// Process user query
async function processQuery(query) {
  if (isProcessing) return;

  isProcessing = true;
  sendBtn.disabled = true;

  // Remove welcome message if exists
  const welcomeMessage = document.querySelector(".welcome-message");
  if (welcomeMessage) {
    welcomeMessage.remove();
  }

  displayUserMessage(query);
  showLoading();

  try {
    const { tool, args } = determineToolAndArgs(query);
    const result = await callTool(tool, args);

    removeLoading();

    if (result.content && result.content[0]) {
      const data = JSON.parse(result.content[0].text);
      const formattedResponse = formatResponse(tool, data);
      displayAssistantMessage(formattedResponse);
    }
  } catch (error) {
    removeLoading();
    showError("Sorry, something went wrong. Please try again.");
    console.error("Error processing query:", error);
  } finally {
    isProcessing = false;
    sendBtn.disabled = false;
    userInput.focus();
  }
}

// Handle send button click
sendBtn.addEventListener("click", () => {
  const query = userInput.value.trim();
  if (query) {
    processQuery(query);
    userInput.value = "";
  }
});

// Handle Enter key
userInput.addEventListener("keypress", (e) => {
  if (e.key === "Enter") {
    const query = userInput.value.trim();
    if (query) {
      processQuery(query);
      userInput.value = "";
    }
  }
});

// Handle example buttons
document.addEventListener("click", (e) => {
  if (e.target.classList.contains("example-btn") || e.target.closest(".example-btn")) {
    const btn = e.target.classList.contains("example-btn") ? e.target : e.target.closest(".example-btn");
    const query = btn.dataset.query;
    if (query) {
      processQuery(query);
    }
  }
});

// Helper functions
function scrollToBottom() {
  chatContainer.scrollTop = chatContainer.scrollHeight;
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

// Initialize on load
window.addEventListener("load", () => {
  initializeSession();
  userInput.focus();
});
