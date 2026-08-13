"use client";

import React, { useState, useEffect, useRef } from "react";
import { useSocket } from "@/context/SocketContext";
import { Smile, Send, Paperclip, Clock, X, Image as ImageIcon, Check } from "lucide-react";

export const ChatInput: React.FC = () => {
  const { sendMessage, sendTyping, activeConversation, token } = useSocket();
  const [content, setContent] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  
  // Typing debounce timer
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isTypingRef = useRef(false);

  // Disappearing messages settings
  const [showDisappearMenu, setShowDisappearMenu] = useState(false);
  const [disappearSetting, setDisappearSetting] = useState<{ active: boolean; seconds: number }>({
    active: false,
    seconds: 30, // default 30s
  });

  // Attachments settings
  const [attachment, setAttachment] = useState<{ name: string; type: string; file: File; base64: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Emoji picker settings
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  // Inserts the selected emoji at the current cursor position within the text input
  const handleEmojiSelect = (emoji: string) => {
    const input = inputRef.current;
    if (input) {
      const start = input.selectionStart ?? content.length;
      const end = input.selectionEnd ?? content.length;
      const nextContent = content.substring(0, start) + emoji + content.substring(end);
      setContent(nextContent);
      
      // Reset cursor position to right after the inserted emoji
      setTimeout(() => {
        input.focus();
        input.setSelectionRange(start + emoji.length, start + emoji.length);
      }, 0);
    } else {
      setContent(prev => prev + emoji);
    }
  };

  useEffect(() => {
    // Reset all inputs and typing status when switching to a different conversation
    setContent("");
    setAttachment(null);
    if (isTypingRef.current) {
      sendTyping(false);
      isTypingRef.current = false;
    }
  }, [activeConversation]);

  if (!activeConversation) return null;

  // Updates the text input and manages the 'is typing' status with a debounce timer
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setContent(e.target.value);

    // Typing status logic
    if (!isTypingRef.current) {
      sendTyping(true);
      isTypingRef.current = true;
    }

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      sendTyping(false);
      isTypingRef.current = false;
    }, 2000); // 2 second typing indicator timeout
  };

  // Sends the compiled message (text, attachment, disappearing config) via WebSocket
  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Support empty text if we have an attachment, otherwise ignore
    const trimmedContent = content.trim();
    if (!trimmedContent && !attachment) return;

    let attachmentUrl = null;

    if (attachment) {
      setIsUploading(true);
      try {
        const formData = new FormData();
        formData.append("file", attachment.file);

        const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
        const res = await fetch(`${apiUrl}/messages/upload`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: formData,
        });

        if (res.ok) {
          const data = await res.json();
          attachmentUrl = data.url;
        } else {
          console.error("File upload failed");
        }
      } catch (err) {
        console.error("Error uploading file:", err);
      } finally {
        setIsUploading(false);
      }
    }

    // Call WebSocket send message with attachment payload
    sendMessage(
      trimmedContent || (attachment?.type?.startsWith("image/") ? "Sent a photo" : `Sent attachment: ${attachment?.name || ""}`),
      null, // replyToId
      disappearSetting.active,
      disappearSetting.active ? disappearSetting.seconds : null,
      attachmentUrl,
      attachment?.type || null
    );

    // Reset fields
    setContent("");
    setAttachment(null);
    
    if (isTypingRef.current) {
      sendTyping(false);
      isTypingRef.current = false;
    }
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
  };

  // Reads the selected file and converts it to a base64 string for transmission
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setAttachment({
          name: file.name,
          type: file.type,
          file: file,
          base64: reader.result as string
        });
      };
      reader.readAsDataURL(file);
    }
  };

  const triggerAttachment = () => {
    fileInputRef.current?.click();
  };

  const handleSelectDisappearing = (seconds: number | null) => {
    if (seconds === null) {
      setDisappearSetting({ active: false, seconds: 0 });
    } else {
      setDisappearSetting({ active: true, seconds });
    }
    setShowDisappearMenu(false);
  };

  const displayDisappearLabel = () => {
    if (!disappearSetting.active) return "Off";
    const s = disappearSetting.seconds;
    if (s < 60) return `${s}s`;
    if (s < 3600) return `${s / 60}m`;
    return `${s / 3600}h`;
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      if (attachment) {
        setAttachment(null);
      }
    }
  };

  return (
    <div className="p-4 border-t border-border bg-surface-2 flex flex-col gap-2 relative">
      {/* File Attachment Preview */}
      {attachment && (
        <div className="flex items-center gap-3 bg-surface-2 border border-border rounded-lg p-2.5 max-w-sm animate-in slide-in-from-bottom-2 duration-150">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-surface-3 text-blue-400">
            <ImageIcon className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-semibold truncate text-foreground">{attachment.name}</div>
            <div className="text-[10px] text-text-secondary">{attachment.type || "Unknown file type"}</div>
          </div>
          <button
            onClick={() => setAttachment(null)}
            className="rounded-full p-1 hover:bg-surface-3 transition text-text-secondary hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Main Input Controls */}
      <form onSubmit={handleFormSubmit} className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setShowEmojiPicker(!showEmojiPicker)}
          className="p-2 text-text-secondary hover:text-foreground transition rounded-full hover:bg-surface-3"
        >
          <Smile className="h-6 w-6" />
        </button>

        <button
          type="button"
          onClick={triggerAttachment}
          className="p-2 text-text-secondary hover:text-foreground transition rounded-full hover:bg-surface-3"
        >
          <Paperclip className="h-6 w-6" />
        </button>
        <input 
          type="file" 
          ref={fileInputRef} 
          className="hidden" 
          onChange={handleFileChange}
          accept="image/*,video/*,application/pdf,.doc,.docx"
        />

        <div className="flex-1 bg-surface-3 rounded-2xl flex items-center px-4 relative">
          <input
            ref={inputRef}
            type="text"
            value={content}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            className="w-full bg-transparent border-none text-sm text-foreground placeholder-neutral-500 outline-none py-1.5"
          />

          {/* Smiley Icon Button & Emoji Picker Popover */}
          <div className="relative flex items-center">
            <button
              type="button"
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              className="text-text-secondary hover:text-foreground p-1 transition"
              title="Add Emoji"
            >
              <Smile className="h-5 w-5" />
            </button>

            {showEmojiPicker && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowEmojiPicker(false)}></div>
                <div className="absolute right-0 bottom-full mb-3 z-20 w-64 rounded-lg border border-border bg-surface-5 p-3 shadow-xl animate-in slide-in-from-bottom-2 duration-100">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-text-secondary mb-2">Emojis</div>
                  <div className="grid grid-cols-5 gap-2 max-h-40 overflow-y-auto pr-1">
                    {["😊", "👍", "❤️", "😂", "😮", "😢", "🙏", "🔥", "🎉", "✨", "🚀", "💡", "👏", "👀", "💯", "😭", "😍", "😎", "🤔", "🙌"].map((emoji) => (
                      <button
                        key={emoji}
                        type="button"
                        onClick={() => handleEmojiSelect(emoji)}
                        className="text-xl p-1.5 hover:bg-surface-3 rounded transition duration-75 flex items-center justify-center active:scale-90"
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Disappearing Timer Button */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowDisappearMenu(!showDisappearMenu)}
            className={`rounded-full p-2.5 transition flex-shrink-0 flex items-center gap-1.5 text-xs font-semibold ${
              disappearSetting.active
                ? "bg-orange-950/40 border border-orange-900/30 text-orange-400"
                : "text-text-secondary hover:bg-surface-3 hover:text-foreground"
            }`}
            title="Disappearing Messages"
          >
            <Clock className="h-5 w-5" />
            {disappearSetting.active && <span>{displayDisappearLabel()}</span>}
          </button>

          {/* Disappearing Settings Dropdown */}
          {showDisappearMenu && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowDisappearMenu(false)}></div>
              <div className="absolute right-0 bottom-full mb-2 z-20 w-44 rounded-lg border border-border bg-surface-5 py-1 shadow-xl animate-in slide-in-from-bottom-2 duration-100">
                <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-text-secondary">Timer</div>
                {[
                  { label: "Off", val: null },
                  { label: "10 seconds", val: 10 },
                  { label: "30 seconds", val: 30 },
                  { label: "1 minute", val: 60 },
                  { label: "5 minutes", val: 300 },
                  { label: "1 hour", val: 3600 },
                  { label: "1 day", val: 86400 },
                ].map((item) => {
                  const isActive = item.val === null ? !disappearSetting.active : disappearSetting.active && disappearSetting.seconds === item.val;
                  return (
                    <button
                      key={item.label}
                      type="button"
                      onClick={() => handleSelectDisappearing(item.val)}
                      className={`flex items-center justify-between w-full px-4 py-2 text-left text-xs hover:bg-surface-3 transition ${
                        isActive ? "text-blue-400 bg-surface-3/50" : "text-foreground"
                      }`}
                    >
                      {item.label}
                      {isActive && <Check className="h-3 w-3" />}
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* Submit Send Button */}
        <button
          type="submit"
          disabled={(!content.trim() && !attachment) || isUploading}
          className="rounded-full bg-primary hover:bg-blue-600 disabled:bg-surface-3 disabled:text-text-secondary text-white p-2.5 shadow-md shadow-blue-500/10 transition flex-shrink-0"
        >
          {isUploading ? (
            <div className="h-5 w-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
          ) : (
            <Send className="h-5 w-5" />
          )}
        </button>
      </form>
    </div>
  );
};
