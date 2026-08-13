"use client";

import React, { useState } from "react";
import { useSocket } from "@/context/SocketContext";
import { useToast } from "@/context/ToastContext";
import { Contact } from "@/types";
import { Search, Settings, Plus, Users, LogOut, User, Laptop, CircleDashed } from "lucide-react";

interface SidebarProps {
  onOpenProfile: () => void;
  onOpenAddContact: () => void;
  onOpenCreateGroup: () => void;
}

// The Sidebar component displays the user's profile, action menus, and a searchable list of chats/contacts
export const Sidebar: React.FC<SidebarProps> = ({
  onOpenProfile,
  onOpenAddContact,
  onOpenCreateGroup,
}) => {
  const {
    currentUser,
    conversations,
    activeConversation,
    onlineUsers,
    typingUsers,
    contacts,
    selectConversation,
    createConversation,
    logout,
  } = useSocket();
  const { info } = useToast();

  const [searchQuery, setSearchQuery] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);

  if (!currentUser) return null;

  // Filter conversations based on the search query (matching group names or other member names)
  const filteredConversations = conversations.filter((c) => {
    if (c.is_group) {
      return c.name?.toLowerCase().includes(searchQuery.toLowerCase());
    } else {
      // Find the other member in direct conversation
      const otherMember = c.members.find((m) => m.user_id !== currentUser.id);
      return (
        otherMember?.user.display_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        otherMember?.user.username?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
  });

  // Filters contacts to display those matching the search query who are NOT already in an active direct conversation
  const filteredContacts = contacts.filter((c) => {
    const isMatching =
      c.contact_user.display_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.contact_user.username?.toLowerCase().includes(searchQuery.toLowerCase());
    
    if (!isMatching) return false;

    // Check if a direct conversation already exists
    const hasConversation = conversations.some(
      (conv) =>
        !conv.is_group &&
        conv.members.some((m) => m.user_id === c.contact_user.id)
    );
    return !hasConversation;
  });

  const handleStartContactChat = async (contact: Contact) => {
    // Create new direct conversation
    const newConv = await createConversation(false, [currentUser.id, contact.contact_user.id]);
    if (newConv) {
      selectConversation(newConv.id);
      setSearchQuery("");
    }
  };

  const parseISOUTC = (isoString: string): Date => {
    if (!isoString) return new Date();
    if (!isoString.endsWith("Z") && !isoString.includes("+") && !/-\d{2}:\d{2}$/.test(isoString)) {
      return new Date(isoString + "Z");
    }
    return new Date(isoString);
  };

  // Formats the message timestamp into a human-readable string (e.g., '12:30 PM', 'Yesterday', 'Mon')
  const formatTime = (isoString: string) => {
    try {
      const date = parseISOUTC(isoString);
      const now = new Date();
      
      const diffMs = now.getTime() - date.getTime();
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      
      if (diffDays === 0) {
        return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      } else if (diffDays === 1) {
        return "Yesterday";
      } else if (diffDays < 7) {
        return date.toLocaleDateString([], { weekday: "long" });
      } else {
        return date.toLocaleDateString([], { month: "short", day: "numeric" });
      }
    } catch {
      return "";
    }
  };

  return (
    <div className="flex h-full w-full flex-col border-r border-border bg-surface-3 text-foreground">
      {/* Sidebar Header */}
      <div className="relative flex items-center justify-between px-4 py-3 bg-surface-2">
        <div className="flex items-center gap-3">
          <div className="relative h-10 w-10 rounded-full overflow-hidden bg-surface-3 border-2 border-surface-1 flex-shrink-0">
            {currentUser.avatar_url ? (
              <img src={currentUser.avatar_url} alt={currentUser.display_name} className="h-full w-full object-cover" />
            ) : (
              <div className="h-full w-full flex items-center justify-center bg-blue-500 text-white font-bold text-sm">
                {currentUser.display_name.substring(0, 2).toUpperCase()}
              </div>
            )}
          </div>
          <div>
            <div className="text-sm font-semibold truncate max-w-[120px]">{currentUser.display_name}</div>
            <div className="text-[10px] text-green-400 font-medium">Online</div>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => info("Stories: Feature Coming Soon!")}
            className="rounded-lg p-1.5 text-text-secondary hover:bg-surface-3 hover:text-foreground transition"
            title="Stories"
          >
            <CircleDashed className="h-4.5 w-4.5" />
          </button>
          <button
            onClick={() => onOpenCreateGroup()}
            className="rounded-lg p-1.5 text-text-secondary hover:bg-surface-3 hover:text-foreground transition"
            title="Create Group"
          >
            <Users className="h-4.5 w-4.5" />
          </button>
          <button
            onClick={() => onOpenAddContact()}
            className="rounded-lg p-1.5 text-text-secondary hover:bg-surface-3 hover:text-foreground transition"
            title="Add Contact"
          >
            <Plus className="h-4.5 w-4.5" />
          </button>
          <button
            onClick={() => setShowDropdown(!showDropdown)}
            className="rounded-lg p-1.5 text-text-secondary hover:bg-surface-3 hover:text-foreground transition"
            title="Settings"
          >
            <Settings className="h-4.5 w-4.5" />
          </button>
        </div>

        {/* Dropdown Menu */}
        {showDropdown && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setShowDropdown(false)}></div>
            <div className="absolute right-4 top-14 z-20 w-48 rounded-lg border border-border bg-surface-5 py-1 shadow-xl animate-in fade-in duration-100">
              <button
                onClick={() => {
                  setShowDropdown(false);
                  onOpenProfile();
                }}
                className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm hover:bg-surface-3 transition"
              >
                <User className="h-4 w-4" /> Profile Settings
              </button>
              <button
                onClick={() => {
                  setShowDropdown(false);
                  info("Linked Devices: Feature Coming Soon!");
                }}
                className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm hover:bg-surface-3 transition"
              >
                <Laptop className="h-4 w-4" /> Linked Devices
              </button>
              <button
                onClick={() => {
                  setShowDropdown(false);
                  onOpenAddContact();
                }}
                className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm hover:bg-surface-3 transition"
              >
                <Plus className="h-4 w-4" /> Add Contact
              </button>
              <button
                onClick={() => {
                  setShowDropdown(false);
                  onOpenCreateGroup();
                }}
                className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm hover:bg-surface-3 transition"
              >
                <Users className="h-4 w-4" /> New Group
              </button>
              <div className="my-1 border-t border-border"></div>
              <button
                onClick={() => {
                  setShowDropdown(false);
                  logout();
                }}
                className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-red-400 hover:bg-surface-3 transition"
              >
                <LogOut className="h-4 w-4" /> Sign Out
              </button>
            </div>
          </>
        )}
      </div>

      {/* Search Input */}
      <div className="px-4 py-3">
        <div className="relative flex items-center bg-surface-2 border border-border rounded-lg">
          <Search className="absolute left-3 h-4 w-4 text-text-secondary" />
          <input
            type="text"
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-transparent pl-9 pr-4 py-2 text-sm text-foreground placeholder-neutral-500 outline-none"
          />
        </div>
      </div>

      {/* List Container */}
      <div className="flex-1 overflow-y-auto divide-y divide-neutral-900/40">
        
        {/* Contacts section (shows when searching to start a new chat) */}
        {searchQuery.trim() !== "" && filteredContacts.length > 0 && (
          <div className="py-2">
            <h4 className="px-4 py-1 text-[10px] font-bold uppercase tracking-wider text-text-secondary">Contacts (Start Chat)</h4>
            {filteredContacts.map((contact) => (
              <button
                key={contact.id}
                onClick={() => handleStartContactChat(contact)}
                className="flex w-full items-center gap-3 px-4 py-3 hover:bg-surface-3/40 transition text-left"
              >
                <div className="relative h-10 w-10 rounded-full overflow-hidden flex-shrink-0 bg-surface-3">
                  {contact.contact_user.avatar_url ? (
                    <img src={contact.contact_user.avatar_url} alt={contact.contact_user.display_name} className="h-full w-full object-cover" />
                  ) : (
                    <div className="h-full w-full flex items-center justify-center bg-blue-500 text-white font-bold text-sm">
                      {contact.contact_user.display_name.substring(0, 2).toUpperCase()}
                    </div>
                  )}
                  {onlineUsers[contact.contact_user.id] && (
                    <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-[#161618] bg-green-500"></span>
                  )}
                </div>
                <div>
                  <div className="text-sm font-semibold">{contact.contact_user.display_name}</div>
                  <div className="text-xs text-text-secondary">@{contact.contact_user.username}</div>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Active Conversations Section */}
        <div>
          {searchQuery.trim() !== "" && <h4 className="px-4 py-1 text-[10px] font-bold uppercase tracking-wider text-text-secondary">Chats</h4>}
          
          {filteredConversations.length === 0 ? (
            <div className="p-4 text-center text-xs text-text-secondary">No chats found. Add a contact or create a group to begin messaging.</div>
          ) : (
            filteredConversations.map((conv) => {
              const isActive = activeConversation?.id === conv.id;
              
              // Get conversation header details
              let chatName = conv.name || "";
              let avatarUrl = conv.avatar_url || "";
              let isOnline = false;
              const isTyping = typingUsers[conv.id]?.length > 0;

              if (!conv.is_group) {
                const other = conv.members.find((m) => m.user_id !== currentUser.id);
                if (other) {
                  chatName = other.user.display_name;
                  avatarUrl = other.user.avatar_url || "";
                  isOnline = onlineUsers[other.user.id] || false;
                }
              }

              // Compute preview text
              let previewText = "";
              if (isTyping) {
                previewText = `${typingUsers[conv.id].join(", ")} is typing...`;
              } else if (conv.last_message) {
                const senderName = conv.last_message.sender_id === currentUser.id 
                  ? "You" 
                  : (conv.members.find(m => m.user_id === conv.last_message?.sender_id)?.user.display_name || "Someone");
                previewText = `${senderName}: ${conv.last_message.content}`;
              } else {
                previewText = "No messages yet";
              }

              return (
                <button
                  key={conv.id}
                  onClick={() => selectConversation(conv.id)}
                  className={`flex w-full items-center gap-3 px-4 py-3.5 transition text-left border-l-2 ${
                    isActive 
                      ? "bg-surface-3/70 border-[#2c6bed]" 
                      : "hover:bg-surface-2 border-transparent"
                  }`}
                >
                  {/* Avatar */}
                  <div className="relative h-11 w-11 rounded-full overflow-hidden flex-shrink-0 bg-surface-3">
                    {avatarUrl ? (
                      <img src={avatarUrl} alt={chatName} className="h-full w-full object-cover" />
                    ) : (
                      <div className="h-full w-full flex items-center justify-center bg-blue-500 text-white font-bold text-sm">
                        {chatName.substring(0, 2).toUpperCase()}
                      </div>
                    )}
                    {!conv.is_group && isOnline && (
                      <span className="absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full border-2 border-[#161618] bg-green-500"></span>
                    )}
                  </div>

                  {/* Body */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-semibold truncate text-foreground">{chatName}</div>
                      {conv.last_message && (
                        <div className="text-[10px] text-text-secondary whitespace-nowrap">
                          {formatTime(conv.last_message.created_at)}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center justify-between mt-0.5">
                      <div className={`text-xs truncate ${isTyping ? "text-blue-400 font-medium" : "text-text-secondary"}`}>
                        {previewText}
                      </div>
                      {conv.unread_count > 0 && (
                        <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-white shadow-sm shadow-blue-500/10">
                          {conv.unread_count}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
