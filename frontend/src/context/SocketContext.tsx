"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { User, Conversation, Message, Contact } from "../types";
import { useToast } from "./ToastContext";

interface SocketContextType {
  currentUser: User | null;
  token: string | null;
  conversations: Conversation[];
  messages: Message[]; // messages for the active conversation
  activeConversation: Conversation | null;
  onlineUsers: Record<number, boolean>;
  typingUsers: Record<number, string[]>; // convId -> displayNames of typing users
  contacts: Contact[];
  loadingConversations: boolean;
  login: (phone: string | null, username: string | null, otp: string) => Promise<boolean>;
  register: (username: string, phone: string, displayName: string, avatarUrl: string) => Promise<boolean>;
  logout: () => void;
  selectConversation: (conversationId: number | null) => Promise<void>;
  sendMessage: (content: string, replyToId?: number | null, isDisappearing?: boolean, disappearAfter?: number | null, attachmentUrl?: string | null, attachmentType?: string | null) => void;
  sendTyping: (isTyping: boolean) => void;
  addReaction: (messageId: number, reaction: string) => Promise<void>;
  removeReaction: (messageId: number) => Promise<void>;
  deleteMessage: (messageId: number) => void;
  deleteMessageForMe: (messageId: number) => void;
  addContact: (phoneOrUsername: string) => Promise<string | null>;
  createConversation: (isGroup: boolean, memberIds: number[], name?: string) => Promise<Conversation | null>;
}

const SocketContext = createContext<SocketContextType | undefined>(undefined);

const API_BASE = "http://localhost:8000";
const WS_BASE = "ws://localhost:8000";

// The SocketProvider acts as the central state manager for the frontend, handling REST API calls,
// real-time WebSocket events, and global application state (currentUser, messages, etc).
export const SocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<number | null>(null);
  const [onlineUsers, setOnlineUsers] = useState<Record<number, boolean>>({});
  const [typingState, setTypingState] = useState<Record<number, Record<number, { name: string; timestamp: number }>>>({});
  const [typingUsers, setTypingUsers] = useState<Record<number, string[]>>({});
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loadingConversations, setLoadingConversations] = useState(false);
  const { success, error } = useToast();

  const socketRef = useRef<WebSocket | null>(null);
  const activeConversationIdRef = useRef<number | null>(null);

  const conversationsRef = useRef<Conversation[]>([]);

  // Keep ref up to date for WebSocket event listener callbacks
  useEffect(() => {
    activeConversationIdRef.current = activeConversationId;
    conversationsRef.current = conversations;
  }, [activeConversationId, conversations]);

  // Read auth session from localStorage on mount
  useEffect(() => {
    const savedToken = localStorage.getItem("signal_token");
    const savedUser = localStorage.getItem("signal_user");
    if (savedToken && savedUser) {
      setToken(savedToken);
      const parsedUser = JSON.parse(savedUser) as User;
      setCurrentUser(parsedUser);
    }
  }, []);

  // Fetch conversations, contacts and load presence


  const loadConversations = useCallback(async (authToken: string) => {
    setLoadingConversations(true);
    try {
      const res = await fetch(`${API_BASE}/conversations/`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (res.ok) {
        const data = await res.json();
        setConversations(data);
      }
    } catch (e) {
      console.error("Error loading conversations", e);
    } finally {
      setLoadingConversations(false);
    }
  }, []);

  const loadContacts = useCallback(async (authToken: string) => {
    try {
      const res = await fetch(`${API_BASE}/contacts/`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (res.ok) {
        const data = await res.json();
        setContacts(data);

        // Build initial online users list
        const initialPresence: Record<number, boolean> = {};
        data.forEach((c: Contact) => {
          initialPresence[c.contact_user.id] = c.contact_user.is_online;
        });
        setOnlineUsers(prev => ({ ...prev, ...initialPresence }));
      }
    } catch (e) {
      console.error("Error loading contacts", e);
    }
  }, []);

  // Establishes a WebSocket connection and registers event listeners for real-time updates
  useEffect(() => {
    if (!currentUser || !token) {
      if (socketRef.current) {
        socketRef.current.close();
        socketRef.current = null;
      }
      return;
    }

    const wsUrl = `${WS_BASE}/ws/${currentUser.id}`;
    console.log("Connecting WebSocket:", wsUrl);
    const socket = new WebSocket(wsUrl);
    socketRef.current = socket;

    socket.onopen = () => {
      console.log("WebSocket connected.");
      loadConversations(token);
      loadContacts(token);
    };

    socket.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        const { event: wsEvent, data } = payload;
        console.log("WS Event Recv:", wsEvent, data);

        if (wsEvent === "new_message") {
          const newMsg = data as Message;
          const isCurrentActive = activeConversationIdRef.current === newMsg.conversation_id;

          // Add to current message thread if open
          if (isCurrentActive) {
            setMessages((prev) => {
              // Deduplicate just in case
              if (prev.some(m => m.id === newMsg.id)) return prev;
              return [...prev, newMsg];
            });
            // Mark read on backend
            fetch(`${API_BASE}/conversations/${newMsg.conversation_id}/read`, {
              method: "POST",
              headers: { Authorization: `Bearer ${token}` },
            });
            // Tell others via WS
            socket.send(JSON.stringify({
              event: "read",
              data: { conversation_id: newMsg.conversation_id }
            }));
          }

          // Update conversation list
          setConversations((prev) => {
            return prev.map((conv) => {
              if (conv.id === newMsg.conversation_id) {
                return {
                  ...conv,
                  last_message: newMsg,
                  unread_count: isCurrentActive ? 0 : conv.unread_count + 1,
                  updated_at: newMsg.created_at
                };
              }
              return conv;
            }).sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
          });

        } else if (wsEvent === "typing") {
          const { conversation_id, user_id, is_typing } = data;

          setTypingState((prev) => {
            const convState = prev[conversation_id] || {};
            if (is_typing) {
              // Find user display name
              const name = conversationsRef.current.find(c => c.id === conversation_id)
                ?.members.find(m => m.user_id === user_id)?.user.display_name || "Someone";

              return {
                ...prev,
                [conversation_id]: {
                  ...convState,
                  [user_id]: { name, timestamp: Date.now() }
                }
              };
            } else {
              const updated = { ...convState };
              delete updated[user_id];
              return { ...prev, [conversation_id]: updated };
            }
          });

        } else if (wsEvent === "read_receipt") {
          const { conversation_id, user_id } = data;
          const isCurrentActive = activeConversationIdRef.current === conversation_id;

          if (isCurrentActive) {
            setMessages((prev) =>
              prev.map((msg) => {
                const statuses = msg.statuses.map((stat) => {
                  if (stat.user_id === user_id) {
                    return { ...stat, status: "read" as const };
                  }
                  return stat;
                });
                return { ...msg, statuses };
              })
            );
          }

        } else if (wsEvent === "presence") {
          const { user_id, is_online } = data;
          setOnlineUsers((prev) => ({ ...prev, [user_id]: is_online }));

          // Also update conversation members presence in the conversations array
          setConversations((prev) =>
            prev.map((conv) => {
              const members = conv.members.map((m) => {
                if (m.user_id === user_id) {
                  return { ...m, user: { ...m.user, is_online } };
                }
                return m;
              });
              return { ...conv, members };
            })
          );

        } else if (wsEvent === "reaction_update") {
          const { message_id, conversation_id, reaction, action } = data;
          const isCurrentActive = activeConversationIdRef.current === conversation_id;

          if (isCurrentActive) {
            setMessages((prev) =>
              prev.map((msg) => {
                if (msg.id === message_id) {
                  let reactions = [...msg.reactions];
                  if (action === "add") {
                    reactions = reactions.filter(r => r.user_id !== reaction.user_id);
                    reactions.push(reaction);
                  } else if (action === "remove") {
                    reactions = reactions.filter(r => r.user_id !== reaction.user_id);
                  }
                  return { ...msg, reactions };
                }
                return msg;
              })
            );
          }

        } else if (wsEvent === "message_deleted") {
          const { message_id, conversation_id } = data;
          const isCurrentActive = activeConversationIdRef.current === conversation_id;

          if (isCurrentActive) {
            setMessages((prev) => prev.filter((msg) => msg.id !== message_id));
          }

        } else if (wsEvent === "message_deleted_for_me") {
          const { message_id, conversation_id } = data;
          const isCurrentActive = activeConversationIdRef.current === conversation_id;

          if (isCurrentActive) {
            setMessages((prev) => prev.filter((msg) => msg.id !== message_id));
          }

        } else if (wsEvent === "new_conversation") {
          const newConv = data as Conversation;
          setConversations((prev) => {
            if (prev.some(c => c.id === newConv.id)) return prev;
            return [newConv, ...prev];
          });

        } else if (wsEvent === "group_update") {
          const updatedConv = data as Conversation;
          setConversations((prev) =>
            prev.map((c) => (c.id === updatedConv.id ? { ...c, ...updatedConv } : c))
          );
          if (activeConversationIdRef.current === updatedConv.id) {
            // Keep member list sync
            setConversations((prev) =>
              prev.map((c) => (c.id === updatedConv.id ? { ...c, ...updatedConv } : c))
            );
          }
        }
      } catch (e) {
        console.error("Error parsing socket JSON data", e);
      }
    };

    socket.onclose = () => {
      console.log("WebSocket disconnected. Retrying in 3s...");
      setTimeout(() => {
        if (currentUser && token) {
          // Trigger a re-evaluation
          setToken(t => t);
        }
      }, 3000);
    };

    return () => {
      socket.close();
    };
  }, [currentUser?.id, token, loadConversations, loadContacts]);

  // Compute active list of typing users display names
  useEffect(() => {
    const nextTyping: Record<number, string[]> = {};
    Object.keys(typingState).forEach((cidStr) => {
      const cid = parseInt(cidStr);
      const convState = typingState[cid] || {};
      const activeTypists: string[] = [];
      const now = Date.now();

      Object.keys(convState).forEach((uidStr) => {
        const uid = parseInt(uidStr);
        const state = convState[uid];
        // Timeout typing after 4 seconds
        if (now - state.timestamp < 4000) {
          activeTypists.push(state.name);
        }
      });
      if (activeTypists.length > 0) {
        nextTyping[cid] = activeTypists;
      }
    });
    setTypingUsers(nextTyping);
  }, [typingState]);

  // --- ACTIONS ---

  const login = async (phone: string | null, username: string | null, otp: string) => {
    try {
      const response = await fetch(`${API_BASE}/auth/verify-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, username, otp }),
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.detail || "Authentication failed");
      }
      const data = await response.json();
      setToken(data.token);
      setCurrentUser(data.user);
      localStorage.setItem("signal_token", data.token);
      localStorage.setItem("signal_user", JSON.stringify(data.user));
      return true;
    } catch (e: any) {
      error(e.message);
      return false;
    }
  };

  const register = async (username: string, phone: string, displayName: string, avatarUrl: string) => {
    try {
      const response = await fetch(`${API_BASE}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: username || null,
          phone: phone || null,
          display_name: displayName,
          avatar_url: avatarUrl || null,
        }),
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.detail || "Registration failed");
      }
      // Automate login request after registration
      success("Registration successful! Verify with OTP 123456");
      return true;
    } catch (e: any) {
      error(e.message);
      return false;
    }
  };

  const logout = () => {
    if (token) {
      fetch(`${API_BASE}/auth/logout`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
    }
    setToken(null);
    setCurrentUser(null);
    setConversations([]);
    setMessages([]);
    setActiveConversationId(null);
    localStorage.removeItem("signal_token");
    localStorage.removeItem("signal_user");
  };

  const selectConversation = async (conversationId: number | null) => {
    if (conversationId === null) {
      setActiveConversationId(null);
      setMessages([]);
      return;
    }
    if (!token) return;
    setActiveConversationId(conversationId);

    // Clear unread count locally
    setConversations((prev) =>
      prev.map((c) => (c.id === conversationId ? { ...c, unread_count: 0 } : c))
    );

    // Fetch conversation message history
    try {
      const res = await fetch(`${API_BASE}/messages/conversation/${conversationId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setMessages(data);
      }

      // Update read receipt on server
      await fetch(`${API_BASE}/conversations/${conversationId}/read`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });

      // Send WS read event
      if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
        socketRef.current.send(JSON.stringify({
          event: "read",
          data: { conversation_id: conversationId }
        }));
      }
    } catch (e) {
      console.error("Error reading messages history", e);
    }
  };

  // Sends a message (text or attachment) to the currently active conversation via WebSocket
  const sendMessage = (
    content: string,
    replyToId: number | null = null,
    isDisappearing: boolean = false,
    disappearAfter: number | null = null,
    attachmentUrl: string | null = null,
    attachmentType: string | null = null
  ) => {
    if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN || !activeConversationId) return;

    const payload = {
      event: "send_message",
      data: {
        conversation_id: activeConversationId,
        content,
        reply_to_id: replyToId,
        is_disappearing: isDisappearing,
        disappear_after: disappearAfter,
        attachment_url: attachmentUrl,
        attachment_type: attachmentType,
        message_type: attachmentUrl ? "attachment" : "text"
      },
    };

    socketRef.current.send(JSON.stringify(payload));
  };

  // Sends a delete message event via WebSocket
  const deleteMessage = (messageId: number) => {
    if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN || !activeConversationId) return;

    const payload = {
      event: "delete_message",
      data: {
        conversation_id: activeConversationId,
        message_id: messageId,
      }
    };
    socketRef.current.send(JSON.stringify(payload));
  };

  // Sends a delete message for me event via WebSocket
  const deleteMessageForMe = (messageId: number) => {
    if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN || !activeConversationId) return;

    const payload = {
      event: "delete_message_for_me",
      data: {
        conversation_id: activeConversationId,
        message_id: messageId,
      }
    };
    socketRef.current.send(JSON.stringify(payload));
  };

  const sendTyping = (isTyping: boolean) => {
    if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN || !activeConversationId) return;

    socketRef.current.send(JSON.stringify({
      event: "typing",
      data: {
        conversation_id: activeConversationId,
        is_typing: isTyping,
      },
    }));
  };

  const addReaction = async (messageId: number, reaction: string) => {
    if (!token) return;
    try {
      await fetch(`${API_BASE}/messages/${messageId}/react`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ reaction }),
      });
    } catch (e) {
      console.error("Error reacting to message", e);
    }
  };

  const removeReaction = async (messageId: number) => {
    if (!token) return;
    try {
      await fetch(`${API_BASE}/messages/${messageId}/react`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch (e) {
      console.error("Error removing reaction", e);
    }
  };

  const addContact = async (phoneOrUsername: string): Promise<string | null> => {
    if (!token) return "Unauthorized";
    try {
      const res = await fetch(`${API_BASE}/contacts/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ contact_phone_or_username: phoneOrUsername }),
      });
      if (!res.ok) {
        const err = await res.json();
        return err.detail || "Failed to add contact";
      }

      // Reload contacts
      await loadContacts(token);
      return null; // success
    } catch {
      return "Network error occurred";
    }
  };

  const createConversation = async (isGroup: boolean, memberIds: number[], name?: string): Promise<Conversation | null> => {
    if (!token) return null;
    try {
      const res = await fetch(`${API_BASE}/conversations/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ is_group: isGroup, member_ids: memberIds, name }),
      });
      if (res.ok) {
        const data = await res.json();
        setConversations(prev => {
          if (prev.some(c => c.id === data.id)) return prev;
          return [data, ...prev];
        });
        return data;
      }
    } catch (e) {
      console.error("Error creating conversation", e);
    }
    return null;
  };

  const activeConversation = conversations.find(c => c.id === activeConversationId) || null;

  return (
    <SocketContext.Provider
      value={{
        currentUser,
        token,
        conversations,
        messages,
        activeConversation,
        onlineUsers,
        typingUsers,
        contacts,
        loadingConversations,
        login,
        register,
        logout,
        selectConversation,
        sendMessage,
        deleteMessage,
        deleteMessageForMe,
        sendTyping,
        addReaction,
        removeReaction,
        addContact,
        createConversation,
      }}
    >
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (context === undefined) {
    throw new Error("useSocket must be used within a SocketProvider");
  }
  return context;
};
