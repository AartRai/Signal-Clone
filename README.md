# Signal Clone

**Live Demo:** [https://signal-clone-lake.vercel.app](https://signal-clone-lake.vercel.app)

A real-time, secure messaging platform clone built with a modern tech stack. Features include direct and group messaging, disappearing messages, file attachments, and real-time read receipts.

## Features Showcase
![Signal Clone Demo](./demo.webp)

## Architecture Overview

This project is divided into two main components:
- **Frontend**: Built with Next.js (React), Tailwind CSS, and Lucide React icons. It uses a custom `SocketContext` for real-time WebSocket communication and state management.
- **Backend**: Built with Python and FastAPI. It uses SQLAlchemy for database operations (SQLite by default) and handles real-time WebSocket connections with a custom `ConnectionManager`.

## Setup Instructions

### Prerequisites
- Node.js (v18+)
- Python 3.9+

### Backend Setup
1. Navigate to the `backend` directory:
   ```bash
   cd backend
   ```
2. Create and activate a virtual environment:
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```
3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Run the FastAPI development server:
   ```bash
   uvicorn app.main:app --reload --port 8000
   ```
   *Note: The database is automatically seeded on startup.*

### Frontend Setup
1. Navigate to the `frontend` directory:
   ```bash
   cd frontend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the Next.js development server:
   ```bash
   npm run dev
   ```
4. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Database Schema (SQLAlchemy)

The backend uses a relational database structure:
- **User**: Represents registered accounts (id, username, phone, display_name, avatar_url, is_online, last_seen).
- **Contact**: Represents a user's address book (user_id -> contact_id).
- **Conversation**: Represents chats (id, is_group, name, created_at, updated_at).
- **ConversationMember**: Junction table mapping Users to Conversations (includes role/admin status).
- **Message**: Represents chat messages (id, conversation_id, sender_id, content, attachment data, disappearing config).
- **MessageRead**: Tracks which users have read which messages.
- **MessageReaction**: Tracks emoji reactions to messages.

## API Overview

### REST Endpoints
- `/auth/login`: Authenticate and receive a JWT token.
- `/auth/register`: Create a new user account.
- `/contacts/`: Add and list address book contacts.
- `/conversations/`: Create and retrieve direct or group conversations.
- `/messages/conversation/{id}`: Fetch message history for a chat.

### WebSocket Endpoint
- `/ws/{user_id}`: The core real-time connection. Handles incoming and outgoing events for messages, typing indicators, read receipts, and online status.

---
*Note: Sensitive configuration (like JWT secrets) should be managed via environment variables in production deployments.*
