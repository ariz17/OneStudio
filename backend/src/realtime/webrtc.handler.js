import RoomService from "./services/room.service.js";
import { sfuService } from "./services/sfu.service.js";
import { prisma } from "../lib/prisma.js";

export function registerWebRtcHandlers(router) {
  const roomService = new RoomService();

  // ── JOIN ──────────────────────────────────────────
  router.register("join", (ctx, message) => {
    const { roomId } = message;
    if (!roomId) return ctx.ws.send(JSON.stringify({ type: "error", message: "missing roomId" }));

    if (!ctx.userId) {
      ctx.ws.close(1008, "Not authenticated");
      return;
    }

    void (async () => {
      console.log(`[JOIN] peerId=${ctx.peerId} userId=${ctx.userId} roomId=${roomId}`);

      const room = await prisma.room.findUnique({
        where: { id: roomId },
        select: { id: true, hostId: true, isActive: true, maxParticipants: true, type: true },
      });

      const user = await prisma.user.findUnique({
        where: { id: ctx.userId },
        select: { name: true, username: true },
      });
      ctx.username = user?.name || (user?.username ? user.username.replace(/_\d+$/, "") : ctx.userId.slice(0, 8));
      console.log(`[JOIN] username=${ctx.username}`);

      if (!room) {
        ctx.ws.send(JSON.stringify({ type: "error", message: "room not found" }));
        return;
      }
      if (!room.isActive) {
        ctx.ws.send(JSON.stringify({ type: "error", message: "meeting has ended" }));
        return;
      }
      if (roomService.isFull(roomId, room.maxParticipants)) {
        return ctx.ws.send(JSON.stringify({ type: "error", message: "room full" }));
      }

      if (roomService.isUserInRoom(roomId, ctx.userId)) {
        const oldPeers = roomService.getPeers(roomId).filter((p) => p.userId === ctx.userId);

        const closedProducerIds = [];
        for (const oldPeer of oldPeers) {
          const producerIds = sfuService.closePeer(oldPeer.peerId);
          closedProducerIds.push(...producerIds);
        }

        roomService.removeUserFromRoom(roomId, ctx.userId);

        roomService.broadcastToRoomExcept(roomId, ctx.peerId, {
          type: "peer-left", userId: ctx.userId,
          peerId: oldPeers[0]?.peerId, closedProducerIds,
          message: "connection replaced",
        });
      }

      let role;
      if (room.hostId === ctx.userId) {
        role = "HOST";
      } else {
        const participant = await prisma.roomParticipant.findFirst({
          where: { roomId, userId: ctx.userId, leftAt: null },
          select: { role: true },
        });
        if (!participant) {
          ctx.ws.send(JSON.stringify({ type: "error", message: "not a participant — join via API first" }));
          return;
        }
        role = participant.role;
      }

      roomService.addPeer(roomId, {
        peerId: ctx.peerId, userId: ctx.userId, username: ctx.username || ctx.userId.slice(0, 8), role,
        socket: ctx.ws,
      });
      ctx.roomId = roomId;
      ctx.role = role;

      if (room.type === "GROUP") {
        await sfuService.getOrCreateRouter(roomId);
      }

      ctx.ws.send(JSON.stringify({
        type: "role", role, peerId: ctx.peerId, roomType: room.type, username: ctx.username,
      }));

      const allPeers = roomService.getPeers(roomId);
      if (allPeers.length > 1) {
        roomService.broadcastToRoomExcept(roomId, ctx.peerId, {
          type: "peer-joined", peerId: ctx.peerId, userId: ctx.userId, username: ctx.username, role,
        });

        ctx.ws.send(JSON.stringify({
          type: "existing-peers",
          peers: allPeers
            .filter((p) => p.peerId !== ctx.peerId)
            .map((p) => ({ peerId: p.peerId, userId: p.userId, username: p.username, role: p.role })),
        }));

        if (room.type === "GROUP") {
          const existingProducers = [];
          for (const peer of allPeers) {
            if (peer.peerId === ctx.peerId) continue;
            for (const prod of sfuService.getAllProducersForPeer(peer.peerId)) {
              existingProducers.push({
                producerId: prod.producerId, peerId: peer.peerId,
                userId: peer.userId, username: peer.username, kind: prod.kind,
              });
            }
          }
          if (existingProducers.length > 0) {
            ctx.ws.send(JSON.stringify({ type: "existingProducers", producers: existingProducers }));
          }
        }
      }
    })().catch((e) => {
      console.error("webrtc: join failed", e);
      ctx.ws.send(JSON.stringify({ type: "error", message: "join failed" }));
    });
  });

  // ── 1:1 SIGNALING ────────────────────────────────
  router.register("offer", (ctx, message) => {
    if (!ctx.roomId) return;
    if (message.targetPeerId) {
      roomService.sendToPeer(ctx.roomId, message.targetPeerId, {
        type: "offer", payload: message.payload, fromPeerId: ctx.peerId,
      });
    } else {
      roomService.broadcastToRoomExcept(ctx.roomId, ctx.peerId, {
        type: "offer", payload: message.payload, fromPeerId: ctx.peerId,
      });
    }
  });

  router.register("answer", (ctx, message) => {
    if (!ctx.roomId) return;
    if (message.targetPeerId) {
      roomService.sendToPeer(ctx.roomId, message.targetPeerId, {
        type: "answer", payload: message.payload, fromPeerId: ctx.peerId,
      });
    } else {
      roomService.broadcastToRoomExcept(ctx.roomId, ctx.peerId, {
        type: "answer", payload: message.payload, fromPeerId: ctx.peerId,
      });
    }
  });

  router.register("ice-candidate", (ctx, message) => {
    if (!ctx.roomId) return;
    if (message.targetPeerId) {
      roomService.sendToPeer(ctx.roomId, message.targetPeerId, {
        type: "ice-candidate", payload: message.payload, fromPeerId: ctx.peerId,
      });
    } else {
      roomService.broadcastToRoomExcept(ctx.roomId, ctx.peerId, {
        type: "ice-candidate", payload: message.payload, fromPeerId: ctx.peerId,
      });
    }
  });

  router.register("mute-state", (ctx, message) => {
    if (!ctx.roomId) return;
    roomService.broadcastToRoomExcept(ctx.roomId, ctx.peerId, {
      type: "mute-state",
      peerId: ctx.peerId,
      isAudioMuted: message.isAudioMuted,
      isVideoOff: message.isVideoOff,
    });
  });

  router.register("chat-message", (ctx, message) => {
    if (!ctx.roomId) return;
    roomService.broadcastToRoomExcept(ctx.roomId, ctx.peerId, {
      type: "chat-message",
      sender: ctx.username || ctx.userId.slice(0, 8),
      text: message.text,
      timestamp: Date.now(),
      messageType: message.messageType || "text",
      imageData: message.imageData,
    });
  });

  router.register("emoji-reaction", (ctx, message) => {
    if (!ctx.roomId) return;
    roomService.broadcastToRoomExcept(ctx.roomId, ctx.peerId, {
      type: "emoji-reaction",
      emoji: message.emoji,
      sender: ctx.username || ctx.userId.slice(0, 8),
    });
  });

  router.register("whiteboard-draw", (ctx, message) => {
    if (!ctx.roomId) return;
    roomService.broadcastToRoomExcept(ctx.roomId, ctx.peerId, {
      type: "whiteboard-draw",
      point: message.point,
    });
  });

  router.register("whiteboard-clear", (ctx) => {
    if (!ctx.roomId) return;
    roomService.broadcastToRoomExcept(ctx.roomId, ctx.peerId, {
      type: "whiteboard-clear",
    });
  });

  router.register("e2e-public-key", (ctx, message) => {
    if (!ctx.roomId) return;
    roomService.broadcastToRoomExcept(ctx.roomId, ctx.peerId, {
      type: "e2e-public-key",
      publicKeyJwk: message.publicKeyJwk,
      sender: ctx.username || ctx.userId.slice(0, 8),
    });
  });

  router.register("recording-status", (ctx, message) => {
    if (!ctx.roomId) return;
    roomService.broadcastToRoomExcept(ctx.roomId, ctx.peerId, {
      type: "recording-status",
      isRecording: message.isRecording,
      recorder: ctx.username || ctx.userId.slice(0, 8),
    });
  });

  router.register("recording-chunk", (ctx, message) => {
    if (!ctx.roomId || !message.targetPeerId) return;
    roomService.sendToPeer(ctx.roomId, message.targetPeerId, {
      type: "recording-chunk",
      fromPeerId: ctx.peerId,
      fromUsername: ctx.username || ctx.userId.slice(0, 8),
      chunkIndex: message.chunkIndex,
      totalChunks: message.totalChunks,
      data: message.data,
    });
  });

  router.register("recording-complete", (ctx, message) => {
    if (!ctx.roomId || !message.targetPeerId) return;
    roomService.sendToPeer(ctx.roomId, message.targetPeerId, {
      type: "recording-complete",
      fromPeerId: ctx.peerId,
      fromUsername: ctx.username || ctx.userId.slice(0, 8),
      totalSize: message.totalSize,
    });
  });

  router.register("screen-share-started", (ctx) => {
    if (!ctx.roomId) return;
    roomService.broadcastToRoomExcept(ctx.roomId, ctx.peerId, {
      type: "screen-share-started", fromPeerId: ctx.peerId,
    });
  });

  router.register("screen-share-stopped", (ctx) => {
    if (!ctx.roomId) return;
    roomService.broadcastToRoomExcept(ctx.roomId, ctx.peerId, {
      type: "screen-share-stopped", fromPeerId: ctx.peerId,
    });
  });

  // ── SFU SIGNALING ────────────────────────────────
  router.register("getRouterCapabilities", (ctx) => {
    if (!ctx.roomId) return;
    const caps = sfuService.getRouterCapabilities(ctx.roomId);
    ctx.ws.send(JSON.stringify({ type: "routerCapabilities", rtpCapabilities: caps }));
  });

  router.register("createTransport", (ctx, message) => {
    if (!ctx.roomId) return;
    void (async () => {
      const params = await sfuService.createTransport(ctx.roomId, ctx.peerId, message.direction);
      ctx.ws.send(JSON.stringify({ type: "transportCreated", direction: message.direction, params }));
    })().catch((e) => {
      console.error("createTransport failed:", e);
      ctx.ws.send(JSON.stringify({ type: "error", message: "createTransport failed" }));
    });
  });

  router.register("connectTransport", (ctx, message) => {
    void (async () => {
      await sfuService.connectTransport(ctx.peerId, message.transportId, message.dtlsParameters);
      ctx.ws.send(JSON.stringify({ type: "transportConnected", transportId: message.transportId }));
    })().catch((e) => {
      console.error("connectTransport failed:", e);
      ctx.ws.send(JSON.stringify({ type: "error", message: "connectTransport failed" }));
    });
  });

  router.register("produce", (ctx, message) => {
    if (!ctx.roomId) return;
    void (async () => {
      const producerId = await sfuService.produce(ctx.peerId, message.transportId, message.kind, message.rtpParameters, message.appData || {});
      ctx.ws.send(JSON.stringify({ type: "produced", producerId }));

      roomService.broadcastToRoomExcept(ctx.roomId, ctx.peerId, {
        type: "newProducer",
        producerId,
        peerId: ctx.peerId,
        userId: ctx.userId,
        username: ctx.username,
        kind: message.kind,
        appData: message.appData,
      });
    })().catch((e) => {
      console.error("produce failed:", e);
      ctx.ws.send(JSON.stringify({ type: "error", message: "produce failed" }));
    });
  });

  router.register("closeProducer", (ctx, message) => {
    if (!ctx.roomId) return;
    void (async () => {
      await sfuService.closeProducer(ctx.peerId, message.producerId);

      roomService.broadcastToRoomExcept(ctx.roomId, ctx.peerId, {
        type: "producerClosed",
        peerId: ctx.peerId,
        producerId: message.producerId,
      });
    })().catch((e) => {
      console.error("closeProducer failed:", e);
    });
  });

  router.register("consume", (ctx, message) => {
    if (!ctx.roomId) return;
    void (async () => {
      const data = await sfuService.consume(ctx.roomId, ctx.peerId, message.producerId, message.rtpCapabilities);
      if (!data) {
        ctx.ws.send(JSON.stringify({ type: "error", message: "cannot consume" }));
        return;
      }
      ctx.ws.send(JSON.stringify({ type: "consumed", ...data }));
    })().catch((e) => {
      console.error("consume failed:", e);
      ctx.ws.send(JSON.stringify({ type: "error", message: "consume failed" }));
    });
  });

  // ── DISCONNECT ───────────────────────────────────
  router.register("disconnect", (ctx) => {
    if (!ctx.roomId) return;

    const closedProducerIds = sfuService.closePeer(ctx.peerId);
    const remaining = roomService.removePeer(ctx.roomId, ctx.peerId);

    for (const p of remaining) {
      try {
        p.socket.send(JSON.stringify({
          type: "peer-left", peerId: ctx.peerId, userId: ctx.userId, closedProducerIds,
        }));
      } catch { }
    }

    if (remaining.length === 0) {
      sfuService.closeRoom(ctx.roomId);
      void prisma.room.update({
        where: { id: ctx.roomId },
        data: { isActive: false, endedAt: new Date() },
      }).catch((e) => console.error("Failed to mark room ended:", e));
    }

    void prisma.roomParticipant.updateMany({
      where: { roomId: ctx.roomId, userId: ctx.userId, leftAt: null },
      data: { leftAt: new Date() },
    }).catch((e) => console.error("Failed to update participant leftAt:", e));
  });
}

export default registerWebRtcHandlers;
