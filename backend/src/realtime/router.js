import { randomUUID } from "crypto";
import jwt from "jsonwebtoken";

export function createRouter(wss) {
	const handlers = new Map();

	wss.on("connection", (ws, req) => {
		const peerId = randomUUID();
		const userId = authenticateConnection(req);
		if (!userId) {
			ws.close(1008, "Not authenticated");
			return;
		}

		const ctx = { ws, peerId, userId, username: null, roomId: null, role: null };

		ws.on("message", async (data) => {
			try {
				const msg = JSON.parse(data.toString());

				const handler = handlers.get(msg.type);
				if (!handler) {
					ws.send(JSON.stringify({ type: "error", message: "unknown message type" }));
					return;
				}

				await handler(ctx, msg);
			} catch (err) {
				console.error("router: failed to handle message", err);
				ws.send(JSON.stringify({ type: "error", message: "invalid message" }));
			}
		});

		ws.on("close", () => {
			const handler = handlers.get("disconnect");
			if (handler) {
				const result = handler(ctx, { type: "disconnect" });
				if (result instanceof Promise) {
					result.catch((e) => console.error(e));
				}
			}
		});
	});

	return {
		register(type, handler) {
			handlers.set(type, handler);
		},
	};
}

function authenticateConnection(req) {
	const token =
		extractAccessTokenFromCookies(req.headers.cookie) ??
		extractTokenFromQuery(req.url);
	if (!token) return null;

	try {
		const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
		return typeof decoded?.userId === "string" ? decoded.userId : null;
	} catch {
		return null;
	}
}

function extractTokenFromQuery(url) {
	if (!url) return null;
	try {
		const u = new URL(url, "http://localhost");
		const token = u.searchParams.get("token");
		return token && token.length > 0 ? token : null;
	} catch {
		return null;
	}
}

function extractAccessTokenFromCookies(cookieHeader) {
	if (!cookieHeader) return null;
	const parts = cookieHeader.split(";");
	for (const part of parts) {
		const [rawKey, ...rest] = part.trim().split("=");
		if (!rawKey) continue;
		if (rawKey === "accessToken") {
			const value = rest.join("=");
			return value ? decodeURIComponent(value) : null;
		}
	}
	return null;
}
