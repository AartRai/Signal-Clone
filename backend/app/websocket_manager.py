from fastapi import WebSocket
from typing import Dict, Set, List
import logging

logger = logging.getLogger("websocket")

# ConnectionManager handles all active WebSocket connections, routing real-time messages to users
class ConnectionManager:
    def __init__(self):
        # Maps user_id (int) to a set of active WebSockets
        self.active_connections: Dict[int, Set[WebSocket]] = {}

    # Registers a new WebSocket connection for a given user
    async def connect(self, user_id: int, websocket: WebSocket):
        await websocket.accept()
        if user_id not in self.active_connections:
            self.active_connections[user_id] = set()
        self.active_connections[user_id].add(websocket)
        logger.info(f"User {user_id} connected. Active sockets: {len(self.active_connections[user_id])}")

    def disconnect(self, user_id: int, websocket: WebSocket):
        if user_id in self.active_connections:
            self.active_connections[user_id].discard(websocket)
            if not self.active_connections[user_id]:
                del self.active_connections[user_id]
            logger.info(f"User {user_id} disconnected.")

    # Sends a direct JSON message to a specific user via all their active WebSockets
    async def send_personal_message(self, message: dict, user_id: int):
        if user_id in self.active_connections:
            dead_connections = set()
            for connection in self.active_connections[user_id]:
                try:
                    await connection.send_json(message)
                except Exception as e:
                    logger.error(f"Error sending message to user {user_id}: {e}")
                    dead_connections.add(connection)
            
            for dead in dead_connections:
                self.disconnect(user_id, dead)

    # Broadcasts a message to a list of users (used for group chats)
    async def broadcast_to_users(self, message: dict, user_ids: list[int]):
        for user_id in user_ids:
            await self.send_personal_message(message, user_id)

# Global connection manager instance
manager = ConnectionManager()
