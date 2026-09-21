import { WebSocketServer } from "ws";

export function setupWebSocketServer(server) {
  const wss = new WebSocketServer({ server });

  wss.on("listening", () => {
    console.log("WebSocket server attached to HTTP server");
  });

  return wss;
}
