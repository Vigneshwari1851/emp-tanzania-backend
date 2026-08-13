import { Server as HttpServer, IncomingMessage } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import jwt from 'jsonwebtoken';
import { config } from '../../config';
import prisma from '../../shared/prisma/client'; // Added: prisma client import

export class WebSocketService {
    private wss: WebSocketServer | null = null;
    private clients: Map<number, Set<WebSocket>> = new Map();

    init(server: HttpServer) {
        this.wss = new WebSocketServer({ server });

        this.wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
            console.log(`[WS] Connection attempt from ${req.socket.remoteAddress} for URL: ${req.url}`);
            try {
                // Extract token from query params (e.g. ?token=...)
                const url = new URL(req.url || '', `http://${req.headers.host || 'localhost'}`);
                const token = url.searchParams.get('token');
                
                if (!token) {
                    ws.close(1008, 'Token required');
                    return;
                }

                const decoded = jwt.verify(token, config.JWT_SECRET) as any;
                const userId = decoded.id;
                const sessionId = decoded.jti; // Added: extract sessionId

                // Added: Verify the session in the database
                prisma.user.findUnique({
                    where: { id: Number(userId) }
                }).then(user => {
                    if (!user || user.sessionToken !== String(sessionId)) {
                        console.log(`[WS] Connection rejected: Session mismatch/invalid for user ${userId}`);
                        ws.close(3000, 'Session expired');
                        return;
                    }

                    if (ws.readyState !== WebSocket.OPEN) {
                        return;
                    }

                    if (!this.clients.has(userId)) {
                        this.clients.set(userId, new Set());
                    }
                    (ws as any).sessionId = sessionId; // Added: store sessionId on ws
                    this.clients.get(userId)!.add(ws);
                    console.log(`[WS] Session ${sessionId} connected for user ${userId}`);

                    ws.on('close', () => {
                        const userClients = this.clients.get(userId);
                        if (userClients) {
                            userClients.delete(ws);
                            if (userClients.size === 0) {
                                this.clients.delete(userId);
                            }
                        }
                    });
                }).catch(err => {
                    console.error('[WS] DB verification error:', err);
                    ws.close(1011, 'Internal server error');
                });
            } catch (err) {
                console.error('WebSocket connection error:', err);
                ws.close(1008, 'Invalid token');
            }
        });
    }

    // Added: Method to disconnect old sessions
    disconnectSession(userId: number, currentSessionId: string) {
        const userClients = this.clients.get(userId);
        if (userClients) {
            userClients.forEach(ws => {
                if ((ws as any).sessionId && (ws as any).sessionId !== currentSessionId) {
                    console.log(`[WS] Disconnecting old session ${(ws as any).sessionId} for user ${userId}`);
                    ws.close(3000, 'Session replaced');
                    userClients.delete(ws);
                }
            });
            if (userClients.size === 0) {
                this.clients.delete(userId);
            }
        }
    }

    sendNotification(userId: number, event: string, data: any) {
        const userClients = this.clients.get(userId);
        console.log(`[WS] sendNotification event=${event} userId=${userId} connectedClients=${userClients?.size ?? 0}`);
        if (userClients) {
            const message = JSON.stringify({ event, data });
            userClients.forEach(client => {
                if (client.readyState === WebSocket.OPEN) {
                    client.send(message);
                }
            });
        } else {
            console.log(`[WS] No active WebSocket connection for userId=${userId}`);
        }
    }

    broadcast(event: string, data: any) {
        if (!this.wss) return;
        const message = JSON.stringify({ event, data });
        this.wss.clients.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(message);
            }
        });
    }
}

export const webSocketService = new WebSocketService();
