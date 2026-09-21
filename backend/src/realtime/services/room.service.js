export class RoomService {
  constructor() {
    this.rooms = new Map();
  }

  addPeer(roomId, peer) {
    if (!this.rooms.has(roomId)) this.rooms.set(roomId, []);
    const room = this.rooms.get(roomId);

    const existing = room.find((p) => p.peerId === peer.peerId);
    if (existing) {
      existing.socket = peer.socket;
      existing.userId = peer.userId;
      existing.role = peer.role;
      return;
    }

    room.push(peer);
  }

  removePeer(roomId, peerId) {
    const room = this.rooms.get(roomId);
    if (!room) return [];
    const updated = room.filter((p) => p.peerId !== peerId);
    if (updated.length === 0) {
      this.rooms.delete(roomId);
    } else {
      this.rooms.set(roomId, updated);
    }
    return updated;
  }

  removeUserFromRoom(roomId, userId) {
    const room = this.rooms.get(roomId);
    if (!room) return [];

    const oldPeers = room.filter((p) => p.userId === userId);
    const updated = room.filter((p) => p.userId !== userId);

    if (updated.length === 0) {
      this.rooms.delete(roomId);
    } else {
      this.rooms.set(roomId, updated);
    }

    for (const peer of oldPeers) {
      try { peer.socket.close(1000, "replaced by new connection"); } catch { }
    }

    return updated;
  }

  getPeers(roomId) {
    return this.rooms.get(roomId) ?? [];
  }

  isFull(roomId, maxPeers) {
    return this.getPeers(roomId).length >= maxPeers;
  }

  broadcastToRoomExcept(roomId, senderId, message) {
    const room = this.rooms.get(roomId);
    if (!room) return;
    const payload = JSON.stringify(message);
    for (const peer of room) {
      if (peer.peerId !== senderId) {
        try {
          peer.socket.send(payload);
        } catch { }
      }
    }
  }

  sendToPeer(roomId, targetPeerId, message) {
    const room = this.rooms.get(roomId);
    if (!room) return false;
    const peer = room.find((p) => p.peerId === targetPeerId);
    if (!peer) return false;
    try {
      peer.socket.send(JSON.stringify(message));
      return true;
    } catch {
      return false;
    }
  }

  broadcastToRoom(roomId, message) {
    const room = this.rooms.get(roomId);
    if (!room) return;
    const payload = JSON.stringify(message);
    for (const peer of room) {
      try {
        peer.socket.send(payload);
      } catch { }
    }
  }

  getPeerCount(roomId) {
    return this.getPeers(roomId).length;
  }

  isUserInRoom(roomId, userId) {
    return this.getPeers(roomId).some((p) => p.userId === userId);
  }
}

export default RoomService;
