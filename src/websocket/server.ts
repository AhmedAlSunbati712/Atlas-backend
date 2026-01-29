import { Server } from "ws";
import { server } from "../index";
import { subsrciber } from "../config/redis";
import { prisma } from "../db/client";
import { WebSocket } from "ws";
import { publisher } from "../config/redis";

interface ExtendedWebSocket extends WebSocket {
    userId?: string;
}

const wss = new Server({ server, path: "/ws?docId=:docId&&userId=:userId" });
const roomMap = new Map<string, Set<ExtendedWebSocket>>();
const subscriber = subsrciber.duplicate();
(async () => {
    await subscriber.connect();
})();
subscriber.psubscribe("doc:*");
subscriber.on("pmessage", (pattern, channel, message) => {
    const data = JSON.parse(message.toString());
    const userId = data.userId;

    if (data.type === "presence.joined") {
        const roomId = channel.toString();
        const room = roomMap.get(roomId);
        for (let ws of room || []) {
            if (ws.userId !== userId) {
                ws.send(JSON.stringify({
                    type: "presence.joined",
                    userId,
                }));
            }
        }
    }
    
})

wss.on("connection", async(ws: WebSocket, req) => {
    const url = new URL(req.url || '', `http://${req.headers.host}`);
    const docId = url.searchParams.get("docId");
    const userId = url.searchParams.get("userId");

    if (!docId || !userId) {
        ws.close();
    }
    // Check if the user has access to the document
    const userDocuments = await prisma.document.findMany({
        where: {
            ownerId: userId!,
            OR: [
                { members: { some: { userId: userId! } } },
            ]
        }
    });
    
    if (userDocuments.length === 0) {
        console.error("User does not have access to the document");
        ws.close();
        return;
    }

    const roomId = `doc:${docId}`;
    const room = roomMap.get(roomId) || new Set<ExtendedWebSocket>();
    (ws as ExtendedWebSocket).userId = userId!;
    room.add(ws as ExtendedWebSocket);
    roomMap.set(roomId, room);

    publisher.publish(roomId, JSON.stringify({
        type: "presence.joined",
        userId: userId!,
    }));

    ws.on("close", () => {
        room.delete(ws as ExtendedWebSocket);
        roomMap.set(roomId, room);
        if (room.size === 0) {
            roomMap.delete(roomId);
        }
        
        publisher.publish(roomId, JSON.stringify({
            type: "presence.left",
            userId: userId!,
        }));
    });

    ws.on("error", (error) => {
        console.error("WebSocket error:", error);
        room.delete(ws as ExtendedWebSocket);
        roomMap.set(roomId, room);
        if (room.size === 0) {
            roomMap.delete(roomId);
        }
    });
})