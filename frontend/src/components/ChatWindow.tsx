"use client";

import React, { useEffect, useRef, useState } from "react";
import { useSocket } from "@/context/SocketContext";
import { useToast } from "@/context/ToastContext";
import { Message, User } from "@/types";
import { Phone, Video, Info, ArrowLeft, Smile, Check, CheckCheck, Clock, Paperclip, Lock, Trash2 } from "lucide-react";

interface ChatWindowProps {
  onOpenDetails: () => void;
}

const parseISOUTC = (isoString: string): Date => {
  if (!isoString) return new Date();
  if (!isoString.endsWith("Z") && !isoString.includes("+") && !/-\d{2}:\d{2}$/.test(isoString)) {
    return new Date(isoString + "Z");
  }
  return new Date(isoString);
};

// The ChatWindow component renders the active conversation's message history, header, and handles reactions
export const ChatWindow: React.FC<ChatWindowProps> = ({ onOpenDetails }) => {
  const {
    currentUser,
    messages,
    activeConversation,
    onlineUsers,
    typingUsers,
    addReaction,
    removeReaction,
    selectConversation,
    deleteMessage,
    deleteMessageForMe,
  } = useSocket();
  const { info } = useToast();

  const [showReactionPickerId, setShowReactionPickerId] = useState<number | null>(null);
  const [showDeleteMenuId, setShowDeleteMenuId] = useState<number | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, typingUsers]);

  if (!currentUser) return null;

  if (!activeConversation) {
    // Empty state placeholder
    return (
      <div className="flex flex-1 flex-col items-center justify-center bg-surface-1 p-8 text-center text-text-secondary">
        <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-surface-2 border border-border text-text-secondary mb-6">
          <svg viewBox="0 0 24 24" className="h-12 w-12 fill-current">
            <path d="M12 2C6.48 2 2 6.48 2 12c0 1.83.49 3.55 1.34 5.03L2.06 21.6c-.22.68.41 1.3 1.09 1.09l4.57-1.28C9.2 22.14 10.57 22.4 12 22.4c5.52 0 10-4.48 10-10S17.52 2 12 2zm1.09 16.03c-.22.25-.49.37-.81.37s-.61-.13-.85-.38l-2.61-2.63a1.14 1.14 0 010-1.6c.44-.45 1.15-.45 1.59 0l1.83 1.84 4.54-4.88c.42-.45 1.14-.47 1.58-.02.44.44.42 1.16-.03 1.6l-5.26 5.7z" />
          </svg>
        </div>
        <h2 className="text-xl font-semibold text-foreground mb-2">Signal for Desktop</h2>
        <p className="max-w-md text-sm leading-relaxed text-text-secondary">
          Send and receive messages privately. All communications are simulated end-to-end encrypted on SQLite.
        </p>
      </div>
    );
  }

  // Get active chat metadata
  let chatName = activeConversation.name || "";
  let avatarUrl = activeConversation.avatar_url || "";
  let presenceText = "";
  
  if (activeConversation.is_group) {
    presenceText = `${activeConversation.members.length} members`;
  } else {
    const other = activeConversation.members.find((m) => m.user_id !== currentUser.id);
    if (other) {
      chatName = other.user.display_name;
      avatarUrl = other.user.avatar_url || "";
      const isOnline = onlineUsers[other.user.id];
      
      if (isOnline) {
        presenceText = "Online";
      } else {
        const lastSeenDate = parseISOUTC(other.user.last_seen);
        const now = new Date();
        const diffMs = now.getTime() - lastSeenDate.getTime();
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
        const diffMins = Math.floor(diffMs / (1000 * 60));
        
        let lastSeenStr = "";
        if (diffMins < 1) lastSeenStr = "just now";
        else if (diffMins < 60) lastSeenStr = `${diffMins}m ago`;
        else if (diffHours < 24) lastSeenStr = `${diffHours}h ago`;
        else if (diffDays === 1) lastSeenStr = "yesterday";
        else lastSeenStr = lastSeenDate.toLocaleDateString();
        
        presenceText = `Last seen ${lastSeenStr}`;
      }
    }
  }

  const handleCallClick = () => {
    info("Voice/Video calls: Feature Coming Soon!");
  };

  // Toggles a quick reaction emoji on a specific message
  const handleQuickReaction = async (messageId: number, emoji: string) => {
    const existing = messages.find(m => m.id === messageId)
      ?.reactions.find(r => r.user_id === currentUser.id);
      
    if (existing && existing.reaction === emoji) {
      await removeReaction(messageId);
    } else {
      await addReaction(messageId, emoji);
    }
    setShowReactionPickerId(null);
  };

  return (
    <div className="flex flex-1 flex-col bg-surface-1 text-foreground h-full relative">
      {/* Header */}
      <div className="flex items-center justify-between px-4 md:px-6 py-3 border-b border-border bg-surface-2">
        <div className="flex items-center gap-2 md:gap-3">
          <button 
            onClick={() => selectConversation(null)}
            className="md:hidden p-1.5 -ml-1 text-text-secondary hover:bg-surface-3 hover:text-foreground rounded-lg transition"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="h-10 w-10 rounded-full overflow-hidden bg-surface-3 border border-border">
            {avatarUrl ? (
              <img src={avatarUrl} alt={chatName} className="h-full w-full object-cover" />
            ) : (
              <div className="h-full w-full flex items-center justify-center bg-blue-500 text-white font-bold text-sm">
                {chatName.substring(0, 2).toUpperCase()}
              </div>
            )}
          </div>
          <div>
            <div className="text-sm font-semibold text-foreground">{chatName}</div>
            <div className="text-[11px] text-text-secondary flex items-center gap-1.5">
              {activeConversation.is_group ? (
                <span>{presenceText}</span>
              ) : (
                <>
                  <span className={`h-2 w-2 rounded-full ${presenceText === "Online" ? "bg-green-500" : "bg-neutral-600"}`}></span>
                  <span>{presenceText}</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Action icons */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleCallClick}
            className="rounded-lg p-2 text-text-secondary hover:bg-surface-3 hover:text-foreground transition"
          >
            <Phone className="h-4.5 w-4.5" />
          </button>
          <button
            onClick={handleCallClick}
            className="rounded-lg p-2 text-text-secondary hover:bg-surface-3 hover:text-foreground transition"
          >
            <Video className="h-4.5 w-4.5" />
          </button>
          <button
            onClick={onOpenDetails}
            className="rounded-lg p-2 text-text-secondary hover:bg-surface-3 hover:text-foreground transition"
          >
            <Info className="h-4.5 w-4.5" />
          </button>
        </div>
      </div>

      {/* Security E2E Banner */}
      <div className="flex justify-center p-6">
        <div className="bg-surface-5 border border-border rounded-xl p-4 flex flex-col items-center text-center max-w-sm shadow-md">
          <div className="h-8 w-8 bg-yellow-500/10 rounded-full flex items-center justify-center mb-2">
            <Lock className="h-4 w-4 text-yellow-500" />
          </div>
          <p className="text-xs text-text-secondary font-medium leading-relaxed">
            Messages and calls are end-to-end encrypted. No one outside of this chat, not even Signal, can read or listen to them.
          </p>
        </div>
      </div>

      {/* Messages List Area */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
        {messages.length === 0 ? (
          <div className="h-full flex items-center justify-center text-xs text-text-secondary italic">No messages. Start the conversation.</div>
        ) : (
          messages.map((msg) => {
            const isMe = msg.sender_id === currentUser.id;
            const senderName = activeConversation.members.find(
              (m) => m.user_id === msg.sender_id
            )?.user.display_name || "Someone";
            
            // Find quoted message
            const quotedMsg = msg.reply_to_id 
              ? (messages.find(m => m.id === msg.reply_to_id) || null)
              : null;

            return (
              <div
                key={msg.id}
                className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}
              >
                {/* Sender Name for group chat */}
                {activeConversation.is_group && !isMe && (
                  <span className="text-[10px] text-text-secondary font-semibold mb-0.5 ml-1">
                    {senderName}
                  </span>
                )}

                {/* Message Bubble + Action Buttons Container */}
                <div className="relative group flex items-center gap-2 max-w-[70%]">
                  {/* Left-side action triggers for hover */}
                  {isMe && (
                    <div className="opacity-0 group-hover:opacity-100 flex gap-1 transition-opacity duration-150">
                      <button
                        onClick={() => setShowDeleteMenuId(msg.id)}
                        className="rounded-full bg-surface-3 p-1.5 text-red-400 hover:text-red-500 hover:bg-red-500/10 transition relative"
                        title="Delete Message"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => setShowReactionPickerId(msg.id)}
                        className="rounded-full bg-surface-3 p-1.5 text-text-secondary hover:text-foreground transition"
                      >
                        <Smile className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}

                  {/* Bubble body */}
                  <MessageBubble
                    message={msg}
                    isMe={isMe}
                    quotedMessage={quotedMsg}
                    currentUser={currentUser}
                    onReactClick={() => setShowReactionPickerId(msg.id)}
                  />

                  {/* Right-side action triggers for hover */}
                  {!isMe && (
                    <div className="opacity-0 group-hover:opacity-100 flex gap-1 transition-opacity duration-150">
                      <button
                        onClick={() => setShowReactionPickerId(msg.id)}
                        className="rounded-full bg-surface-3 p-1.5 text-text-secondary hover:text-foreground transition"
                      >
                        <Smile className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => setShowDeleteMenuId(msg.id)}
                        className="rounded-full bg-surface-3 p-1.5 text-red-400 hover:text-red-500 hover:bg-red-500/10 transition"
                        title="Delete Message"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}

                  {/* Delete Menu Popover */}
                  {showDeleteMenuId === msg.id && (
                    <>
                      <div className="fixed inset-0 z-30" onClick={() => setShowDeleteMenuId(null)}></div>
                      <div className={`absolute bottom-full mb-1 z-40 flex flex-col bg-surface-2 border border-border rounded-lg shadow-xl overflow-hidden min-w-[140px] animate-in fade-in duration-100 ${
                        isMe ? "right-0" : "left-0"
                      }`}>
                        <button
                          onClick={() => {
                            deleteMessageForMe(msg.id);
                            setShowDeleteMenuId(null);
                          }}
                          className="px-4 py-2 text-sm text-left text-foreground hover:bg-surface-3 transition"
                        >
                          Delete for Me
                        </button>
                        {isMe && (
                          <button
                            onClick={() => {
                              deleteMessage(msg.id);
                              setShowDeleteMenuId(null);
                            }}
                            className="px-4 py-2 text-sm text-left text-red-500 hover:bg-red-500/10 transition"
                          >
                            Delete for Everyone
                          </button>
                        )}
                      </div>
                    </>
                  )}

                  {/* Reaction Picker Popover */}
                  {showReactionPickerId === msg.id && (
                    <>
                      <div className="fixed inset-0 z-30" onClick={() => setShowReactionPickerId(null)}></div>
                      <div className={`absolute bottom-full mb-1 z-40 flex gap-1 bg-surface-5 border border-border rounded-full px-2.5 py-1.5 shadow-xl animate-in slide-in-from-bottom-2 duration-100 ${
                        isMe ? "right-0" : "left-0"
                      }`}>
                        {["👍", "❤️", "😂", "😮", "😢", "🙏"].map((emoji) => (
                          <button
                            key={emoji}
                            onClick={() => handleQuickReaction(msg.id, emoji)}
                            className="text-base hover:scale-125 transition duration-100"
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </div>
            );
          })
        )}

        {/* Live typing status indicators */}
        {typingUsers[activeConversation.id]?.length > 0 && (
          <div className="flex items-center gap-2 text-xs text-text-secondary italic py-1 animate-pulse">
            <div className="flex gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-bounce"></span>
              <span className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-bounce delay-150"></span>
              <span className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-bounce delay-300"></span>
            </div>
            <span>{typingUsers[activeConversation.id].join(", ")} is typing...</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>
    </div>
  );
};

/* INNER COMPONENT FOR BUBBLE RENDER */
interface BubbleProps {
  message: Message;
  isMe: boolean;
  quotedMessage: Message | null;
  currentUser: User;
  onReactClick: () => void;
}

// MessageBubble is an internal sub-component responsible for rendering a single message bubble,
// handling disappearing timers, and rendering read receipts/ticks
const MessageBubble: React.FC<BubbleProps> = ({
  message,
  isMe,
  quotedMessage,
}) => {
  const [expired, setExpired] = useState(false);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);

  // Handle disappearing messages countdown (Bonus Feature!)
  useEffect(() => {
    if (!message.is_disappearing || !message.disappear_after) return;

    const createdTime = parseISOUTC(message.created_at).getTime();
    const expiryTime = createdTime + message.disappear_after * 1000;

    const updateTimer = () => {
      const remaining = Math.max(0, Math.ceil((expiryTime - Date.now()) / 1000));
      setTimeLeft(remaining);
      if (remaining <= 0) {
        setExpired(true);
      }
    };

    updateTimer(); // Initial call
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [message]);

  if (expired) return null; // Unrenders bubble when disappeared

  // Status check renderer (Ticks)
  const renderStatus = () => {
    // Only show ticks for messages sent by ME
    if (!isMe) return null;

    // Find statuses that are NOT 'sending'
    const stats = message.statuses || [];
    
    // Check for optimistic 'sending' state
    const isSending = stats.some(s => s.status === 'sending');
    if (isSending) {
      return <Clock className="h-3 w-3 text-white/60" />;
    }

    if (stats.length === 0) {
      return <Check className="h-3.5 w-3.5 text-white/60" />; // Single grey/white check
    }

    const isAllRead = stats.every((s) => s.status === "read");
    const isAnyDelivered = stats.some((s) => s.status === "delivered" || s.status === "read");

    if (isAllRead) {
      return <CheckCheck className="h-3.5 w-3.5 text-sky-300 drop-shadow-sm" />; // Double bright blue checks
    } else if (isAnyDelivered) {
      return <CheckCheck className="h-3.5 w-3.5 text-white/60" />; // Double grey/white checks
    } else {
      return <Check className="h-3.5 w-3.5 text-white/60" />; // Single grey/white check
    }
  };

  const formatMessageTime = (isoString: string) => {
    try {
      const date = parseISOUTC(isoString);
      return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    } catch {
      return "";
    }
  };

  // Group reactions by emoji counts
  const reactionCounts: Record<string, number> = {};
  message.reactions.forEach((r) => {
    reactionCounts[r.reaction] = (reactionCounts[r.reaction] || 0) + 1;
  });

  return (
    <div className={`flex flex-col relative`}>
      {/* Quoted parent render */}
      {quotedMessage && (
        <div className={`text-[11px] px-3 py-1.5 rounded-t-lg border-l-2 select-none truncate max-w-full ${
          isMe 
            ? "bg-blue-950/40 border-blue-400 text-blue-200" 
            : "bg-surface-3 border-neutral-400 text-foreground"
        }`}>
          <div className="font-semibold text-[9px] uppercase tracking-wider mb-0.5">Replying to</div>
          {quotedMessage.content}
        </div>
      )}

      {/* Bubble core */}
      <div className={`px-3 py-2 text-sm shadow-sm relative ${
        quotedMessage ? "rounded-b-xl" : "rounded-2xl"
      } ${
        isMe 
          ? "bg-primary text-white rounded-tr-none" 
          : "bg-surface-6 text-foreground rounded-tl-none"
      }`}>
        {/* Render base64 image or file attachment */}
        {message.attachment_url && (
          message.attachment_type?.startsWith("image/") || message.attachment_url.startsWith("data:image/") ? (
            <div className="mb-2 max-w-xs rounded-lg overflow-hidden border border-border bg-surface-2">
              <img
                src={message.attachment_url}
                alt="Attachment"
                className="max-h-56 w-full object-cover cursor-pointer hover:scale-[1.02] transition-transform duration-200"
                onClick={() => {
                  const w = window.open();
                  w?.document.write(`<img src="${message.attachment_url}" style="max-width:100%; max-height:100vh; display:block; margin:auto;" />`);
                }}
              />
            </div>
          ) : (
            <div className="mb-2 flex items-center gap-2.5 p-2 bg-surface-1/60 rounded-lg border border-border text-xs max-w-xs">
              <Paperclip className="h-4 w-4 text-blue-400 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="font-semibold truncate text-neutral-200">File Attachment</div>
                <div className="text-[9px] text-text-secondary uppercase">{message.attachment_type?.split("/")[1] || "File"}</div>
              </div>
              <a
                href={message.attachment_url}
                download={message.content || "attachment"}
                className="text-blue-400 hover:text-blue-300 font-bold text-[9px] uppercase tracking-wider"
              >
                Download
              </a>
            </div>
          )
        )}

        {/* Render text content only if not a fallback title */}
        {!(message.attachment_url && (message.content === "Sent a photo" || message.content.startsWith("Sent attachment:"))) && (
          <p className="leading-relaxed break-words">{message.content}</p>
        )}
        
        {/* Timestamp + ticks + timer */}
        <div className="flex items-center gap-1 justify-end mt-1 text-[9px] text-foreground/60 select-none">
          {message.is_disappearing && timeLeft !== null && (
            <span className="flex items-center gap-0.5 text-orange-300 font-medium">
              <Clock className="h-2.5 w-2.5 animate-spin" /> {timeLeft}s
            </span>
          )}
          <span>{formatMessageTime(message.created_at)}</span>
          {renderStatus()}
        </div>

        {/* Floating Emoji Reactions */}
        {message.reactions.length > 0 && (
          <div className="absolute -bottom-2 right-2 flex gap-0.5 bg-surface-2 border border-border rounded-full px-1.5 py-0.5 shadow select-none">
            {Object.entries(reactionCounts).map(([emoji, count]) => (
              <span key={emoji} className="text-[10px] flex items-center gap-0.5">
                {emoji} <span className="text-[8px] text-text-secondary">{count > 1 ? count : ""}</span>
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
