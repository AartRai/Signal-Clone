export interface User {
  id: number;
  username: string | null;
  phone: string | null;
  display_name: string;
  avatar_url: string | null;
  is_online: boolean;
  last_seen: string;
  created_at: string;
}

export interface Contact {
  id: number;
  user_id: number;
  contact_user: User;
  created_at: string;
}

export interface MessageReaction {
  id: number;
  message_id: number;
  user_id: number;
  reaction: string;
  created_at: string;
}

export interface MessageStatus {
  id: number;
  message_id: number;
  user_id: number;
  status: 'sending' | 'sent' | 'delivered' | 'read';
  updated_at: string;
}

export interface Message {
  id: number;
  conversation_id: number;
  sender_id: number | null;
  content: string;
  message_type: 'text' | 'attachment';
  attachment_url: string | null;
  attachment_type: string | null;
  reply_to_id: number | null;
  is_disappearing: boolean;
  disappear_after: number | null; // in seconds
  created_at: string;
  statuses: MessageStatus[];
  reactions: MessageReaction[];
}

export interface ConversationMember {
  id: number;
  user_id: number;
  role: 'admin' | 'member';
  joined_at: string;
  user: User;
}

export interface Conversation {
  id: number;
  name: string | null;
  is_group: boolean;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
  members: ConversationMember[];
  last_message: Message | null;
  unread_count: number;
}
