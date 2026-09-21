import { prisma } from "../lib/prisma.js";
import { randomBytes } from "crypto";

// ─── Helper ─────────────────────────────────────────────
// Generates a short, human-friendly invite code.
// Uses base36 (0-9 + a-z) for readability. 6 chars = 2.1 billion combos.
// Example output: "a7k3m2"
function generateInviteCode() {
  return randomBytes(4).toString("hex").slice(0, 6);
}

// Default max participants per room type.
// These are sensible defaults; the host can override on creation.
const DEFAULT_MAX_PARTICIPANTS = {
  ONE_TO_ONE: 2,
  GROUP: 10,
  VIRTUAL_ROOM: 20,
};

// ─── CREATE ROOM ────────────────────────────────────────
// POST /rooms
// Body: { name?, type?, maxParticipants?, scheduledAt? }
export const createRoom = async (req, res) => {
  const userId = req.userId;
  const {
    name,
    type = "ONE_TO_ONE",
    maxParticipants,
    scheduledAt,
  } = req.body;

  // Use provided max or fall back to the default for this room type
  const effectiveMax = maxParticipants ?? DEFAULT_MAX_PARTICIPANTS[type] ?? 2;

  try {
    const room = await prisma.room.create({
      data: {
        name: name || null,
        type,
        maxParticipants: effectiveMax,
        scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
        inviteCode: generateInviteCode(),
        hostId: userId,
        // Automatically add the creator as a HOST participant
        participants: {
          create: {
            userId,
            role: "HOST",
          },
        },
      },
      // Return the full room with participant details
      include: {
        participants: {
          include: {
            user: {
              select: { id: true, username: true, avatar: true },
            },
          },
        },
      },
    });

    console.log(`Room created: ${room.id} (type: ${room.type}, invite: ${room.inviteCode})`);
    return res.status(201).json(room);
  } catch (err) {
    console.error("Failed to create room:", err);
    return res.status(500).json({ error: "Failed to create room" });
  }
};

// ─── GET ROOM ───────────────────────────────────────────
// GET /rooms/:id
export const getRoom = async (req, res) => {
  try {
    const room = await prisma.room.findUnique({
      where: { id: req.params.id },
      include: {
        host: {
          select: { id: true, username: true, avatar: true },
        },
        participants: {
          include: {
            user: {
              select: { id: true, username: true, avatar: true },
            },
          },
        },
      },
    });

    if (!room) {
      return res.status(404).json({ message: "Room not found" });
    }

    return res.json(room);
  } catch (err) {
    console.error("Failed to get room:", err);
    return res.status(500).json({ error: "Failed to get room" });
  }
};

// ─── JOIN ROOM (by ID) ──────────────────────────────────
// POST /rooms/:id/join
export const joinRoom = async (req, res) => {
  const userId = req.userId;
  const roomId = req.params.id;

  try {
    const room = await prisma.room.findUnique({
      where: { id: roomId },
      include: {
        _count: {
          select: {
            // Only count ACTIVE participants (not ones who already left)
            participants: { where: { leftAt: null } },
          },
        },
      },
    });

    if (!room) {
      return res.status(404).json({ message: "Room not found" });
    }

    if (!room.isActive) {
      return res.status(400).json({ message: "This meeting has ended" });
    }

    // Check if user is already a participant FIRST
    const existingParticipant = await prisma.roomParticipant.findFirst({
      where: { roomId, userId, leftAt: null },
    });

    if (existingParticipant) {
      return res.json({ message: "Already in this room", participant: existingParticipant });
    }

    // Only check capacity for genuinely NEW participants
    if (room._count.participants >= room.maxParticipants) {
      return res.status(400).json({ message: "Room is full" });
    }

    const participant = await prisma.roomParticipant.create({
      data: {
        roomId,
        userId,
        role: "PARTICIPANT",
      },
      include: {
        user: {
          select: { id: true, username: true, avatar: true },
        },
      },
    });

    return res.status(201).json(participant);
  } catch (err) {
    console.error("Failed to join room:", err);
    return res.status(500).json({ error: "Failed to join room" });
  }
};

// ─── JOIN ROOM (by Invite Code) ─────────────────────────
// POST /rooms/join/:inviteCode
export const joinByInviteCode = async (req, res) => {
  const userId = req.userId;
  const { inviteCode } = req.params;

  try {
    const room = await prisma.room.findUnique({
      where: { inviteCode },
      include: {
        _count: {
          select: {
            participants: { where: { leftAt: null } },
          },
        },
      },
    });

    if (!room) {
      return res.status(404).json({ message: "Invalid invite code" });
    }

    if (!room.isActive) {
      return res.status(400).json({ message: "This meeting has ended" });
    }

    // Check if user is already a participant FIRST
    const existingParticipant = await prisma.roomParticipant.findFirst({
      where: { roomId: room.id, userId, leftAt: null },
    });

    if (existingParticipant) {
      return res.json({ message: "Already in this room", roomId: room.id, id: room.id, type: room.type, participant: existingParticipant });
    }

    // Only check capacity for genuinely NEW participants
    if (room._count.participants >= room.maxParticipants) {
      return res.status(400).json({ message: "Room is full" });
    }

    const participant = await prisma.roomParticipant.create({
      data: {
        roomId: room.id,
        userId,
        role: "PARTICIPANT",
      },
      include: {
        user: {
          select: { id: true, username: true, avatar: true },
        },
      },
    });

    return res.status(201).json({ roomId: room.id, id: room.id, type: room.type, participant });
  } catch (err) {
    console.error("Failed to join by invite:", err);
    return res.status(500).json({ error: "Failed to join room" });
  }
};

// ─── LEAVE ROOM ─────────────────────────────────────────
// POST /rooms/:id/leave
export const leaveRoom = async (req, res) => {
  const userId = req.userId;
  const roomId = req.params.id;

  try {
    // Find the user's active participation
    const participant = await prisma.roomParticipant.findFirst({
      where: { roomId, userId, leftAt: null },
    });

    if (!participant) {
      return res.status(400).json({ message: "Not in this room" });
    }

    // Mark as left (don't delete — preserve history)
    await prisma.roomParticipant.update({
      where: { id: participant.id },
      data: { leftAt: new Date() },
    });

    return res.json({ message: "Left the room" });
  } catch (err) {
    console.error("Failed to leave room:", err);
    return res.status(500).json({ error: "Failed to leave room" });
  }
};

// ─── END ROOM ───────────────────────────────────────────
// POST /rooms/:id/end
export const endRoom = async (req, res) => {
  const userId = req.userId;
  const roomId = req.params.id;

  try {
    const room = await prisma.room.findUnique({
      where: { id: roomId },
    });

    if (!room) {
      return res.status(404).json({ message: "Room not found" });
    }

    // Only the host can end the meeting
    if (room.hostId !== userId) {
      return res.status(403).json({ message: "Only the host can end the meeting" });
    }

    const now = new Date();

    // Use a transaction to ensure both updates happen atomically
    await prisma.$transaction([
      // Mark the room as ended
      prisma.room.update({
        where: { id: roomId },
        data: { isActive: false, endedAt: now },
      }),
      // Mark all remaining participants as left
      prisma.roomParticipant.updateMany({
        where: { roomId, leftAt: null },
        data: { leftAt: now },
      }),
    ]);

    return res.json({ message: "Meeting ended" });
  } catch (err) {
    console.error("Failed to end room:", err);
    return res.status(500).json({ error: "Failed to end meeting" });
  }
};

// ─── LIST USER'S ROOMS ──────────────────────────────────
// GET /rooms
export const getUserRooms = async (req, res) => {
  const userId = req.userId;
  const activeFilter = req.query.active;

  try {
    const where = {
      OR: [
        { hostId: userId },
        { participants: { some: { userId } } },
      ],
    };

    if (activeFilter === "true") where.isActive = true;
    if (activeFilter === "false") where.isActive = false;

    const rooms = await prisma.room.findMany({
      where,
      include: {
        host: {
          select: { id: true, username: true, avatar: true },
        },
        _count: {
          select: { participants: true },
        },
      },
      orderBy: { updatedAt: "desc" },
    });

    return res.json(rooms);
  } catch (err) {
    console.error("Failed to list rooms:", err);
    return res.status(500).json({ error: "Failed to list rooms" });
  }
};

// ─── USER MEETING STATS ─────────────────────────────────
// GET /rooms/stats
export const getUserStats = async (req, res) => {
  const userId = req.userId;

  try {
    const rooms = await prisma.room.findMany({
      where: {
        OR: [
          { hostId: userId },
          { participants: { some: { userId } } },
        ],
      },
      include: {
        host: { select: { id: true, username: true } },
        _count: { select: { participants: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    const totalMeetings = rooms.length;
    let totalDurationMs = 0;
    const meetingsByType = {};
    const dailyActivity = {};

    const allMeetings = rooms.map((room) => {
      let durationMs = 0;
      if (room.endedAt) {
        durationMs = Math.max(0, new Date(room.endedAt).getTime() - new Date(room.createdAt).getTime());
        durationMs = Math.min(durationMs, 4 * 60 * 60 * 1000);
      } else if (room.isActive) {
        const timeSinceCreation = Date.now() - new Date(room.createdAt).getTime();
        if (timeSinceCreation > 4 * 60 * 60 * 1000) {
          durationMs = 15 * 60 * 1000;
        } else {
          durationMs = timeSinceCreation;
        }
      }
      totalDurationMs += durationMs;

      meetingsByType[room.type] = (meetingsByType[room.type] || 0) + 1;

      const dayKey = new Date(room.createdAt).toISOString().split("T")[0];
      dailyActivity[dayKey] = (dailyActivity[dayKey] || 0) + 1;

      return {
        id: room.id,
        name: room.name,
        type: room.type,
        createdAt: room.createdAt,
        endedAt: room.endedAt,
        isActive: room.isActive,
        durationMs,
        participantCount: room._count.participants,
        hostName: room.host.username,
        isHost: room.hostId === userId,
      };
    });

    const recentMeetings = allMeetings.slice(0, 20);

    const last30Days = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().split("T")[0];
      last30Days.push({ date: key, count: dailyActivity[key] || 0 });
    }

    const avgDurationMs = totalMeetings > 0 ? totalDurationMs / totalMeetings : 0;

    return res.json({
      totalMeetings,
      totalDurationMs,
      avgDurationMs,
      meetingsByType,
      recentMeetings,
      dailyActivity: last30Days,
    });
  } catch (err) {
    console.error("Failed to get user stats:", err);
    return res.status(500).json({ error: "Failed to get stats" });
  }
};
