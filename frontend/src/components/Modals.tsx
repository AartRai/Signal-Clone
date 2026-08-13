import React, { useState } from "react";
import { useTheme } from "next-themes";
import { User, Contact, Conversation } from "../types";
import { X, Plus, Shield, UserMinus } from "lucide-react";

interface ProfileSettingsModalProps {
  user: User;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: (displayName: string, avatarUrl: string) => Promise<void>;
}

// Renders the user profile settings, including theme switching, profile updates, and simulated privacy settings
export const ProfileSettingsModal: React.FC<ProfileSettingsModalProps> = ({
  user,
  isOpen,
  onClose,
  onUpdate,
}) => {
  const [activeTab, setActiveTab] = useState<"profile" | "privacy" | "notifications" | "appearance">("profile");
  const [displayName, setDisplayName] = useState(user.display_name);
  const [avatarSeed, setAvatarSeed] = useState(
    user.avatar_url?.split("seed=")[1] || "signal"
  );
  const [saving, setSaving] = useState(false);
  const { theme, setTheme } = useTheme();

  if (!isOpen) return null;

  const seeds = ["signal", "alice", "bob", "charlie", "dana", "evan", "happy", "cool", "star", "playful"];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const url = `https://api.dicebear.com/7.x/adventurer/svg?seed=${avatarSeed}`;
    await onUpdate(displayName, url);
    setSaving(false);
  };

  const tabs = [
    { id: "profile", label: "Profile" },
    { id: "privacy", label: "Privacy" },
    { id: "notifications", label: "Notifications" },
    { id: "appearance", label: "Appearance" },
  ] as const;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-[95%] max-w-3xl h-[85vh] max-h-[600px] flex flex-col md:flex-row rounded-xl border border-border bg-surface-3 text-foreground shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Sidebar */}
        <div className="w-full md:w-64 bg-surface-2 border-b md:border-b-0 md:border-r border-border flex flex-col flex-shrink-0">
          <div className="p-3 md:p-4 border-b border-border hidden md:block">
            <h3 className="font-bold text-lg">Settings</h3>
          </div>
          <div className="flex md:flex-1 p-2 gap-1 overflow-x-auto md:flex-col md:gap-1 no-scrollbar">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-shrink-0 whitespace-nowrap md:w-full text-center md:text-left px-4 py-2 rounded-lg text-sm transition font-medium ${
                  activeTab === tab.id
                    ? "bg-blue-500/10 text-blue-400"
                    : "text-text-secondary hover:bg-surface-3 hover:text-foreground"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 flex flex-col relative bg-surface-4">
          <button 
            onClick={onClose} 
            className="absolute top-4 right-4 z-10 rounded-lg p-1.5 text-text-secondary hover:bg-surface-3 hover:text-foreground transition"
          >
            <X className="h-5 w-5" />
          </button>

          <div className="flex-1 overflow-y-auto p-8">
            <h2 className="text-xl font-bold mb-6 capitalize">{activeTab}</h2>
            
            {activeTab === "profile" && (
              <form onSubmit={handleSubmit} className="space-y-8 max-w-md">
                <div className="flex items-center gap-6">
                  <div className="h-24 w-24 rounded-full overflow-hidden border-2 border-border bg-surface-2 shadow-lg">
                    <img
                      src={`https://api.dicebear.com/7.x/adventurer/svg?seed=${avatarSeed}`}
                      alt="Avatar Preview"
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-foreground">{displayName}</h4>
                    <p className="text-xs text-text-secondary font-mono mt-1">
                      {user.phone ? user.phone : `@${user.username}`}
                    </p>
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="text-xs font-semibold uppercase tracking-wider text-text-secondary">Choose Avatar seed</label>
                  <div className="flex flex-wrap gap-2 py-1">
                    {seeds.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setAvatarSeed(s)}
                        className={`h-10 w-10 rounded-full overflow-hidden border-2 transition ${
                          avatarSeed === s ? "border-blue-500 scale-105 shadow-md shadow-blue-500/20" : "border-transparent opacity-60 hover:opacity-100"
                        }`}
                      >
                        <img src={`https://api.dicebear.com/7.x/adventurer/svg?seed=${s}`} alt={s} />
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-wider text-text-secondary">Display Name</label>
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="w-full rounded-lg border border-border bg-surface-2 px-4 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 text-foreground"
                    required
                  />
                </div>

                <div className="pt-4">
                  <button
                    type="submit"
                    disabled={saving}
                    className="rounded-lg bg-primary px-6 py-2.5 text-sm font-semibold text-white hover:bg-blue-600 transition shadow-lg shadow-blue-500/20 disabled:opacity-50"
                  >
                    {saving ? "Saving..." : "Save Profile"}
                  </button>
                </div>
              </form>
            )}

            {activeTab === "privacy" && (
              <div className="space-y-6 max-w-md">
                <p className="text-sm text-text-secondary mb-8">Manage your privacy settings and who can see your activity.</p>
                <div className="space-y-4">
                  {[
                    { title: "Read Receipts", desc: "Let others know when you've read their messages." },
                    { title: "Typing Indicators", desc: "Show when you are typing a message." },
                    { title: "Screen Lock", desc: "Require Face ID or passcode to open the app." }
                  ].map(item => (
                    <div key={item.title} className="flex items-center justify-between p-4 rounded-xl border border-border bg-surface-2/50">
                      <div>
                        <div className="text-sm font-semibold">{item.title}</div>
                        <div className="text-xs text-text-secondary mt-0.5">{item.desc}</div>
                      </div>
                      <div className="h-5 w-9 rounded-full bg-blue-500 relative cursor-not-allowed opacity-50">
                        <div className="absolute right-0.5 top-0.5 h-4 w-4 rounded-full bg-white"></div>
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-[10px] text-text-secondary italic mt-4">* Features coming soon</p>
              </div>
            )}

            {activeTab === "notifications" && (
              <div className="space-y-6 max-w-md">
                <p className="text-sm text-text-secondary mb-8">Configure how you receive alerts for new messages.</p>
                <div className="space-y-4">
                  <div className="p-4 rounded-xl border border-border bg-surface-2/50">
                    <label className="text-xs font-semibold uppercase tracking-wider text-text-secondary block mb-3">Message Sound</label>
                    <select disabled className="w-full bg-surface-1 border border-border rounded-lg p-2.5 text-sm text-text-secondary outline-none cursor-not-allowed">
                      <option>Default (Note)</option>
                      <option>Pop</option>
                      <option>None</option>
                    </select>
                  </div>
                  
                  <div className="flex items-center justify-between p-4 rounded-xl border border-border bg-surface-2/50">
                    <div>
                      <div className="text-sm font-semibold">Show Name and Message</div>
                      <div className="text-xs text-text-secondary mt-0.5">Include content in push notifications</div>
                    </div>
                    <div className="h-5 w-9 rounded-full bg-blue-500 relative cursor-not-allowed opacity-50">
                      <div className="absolute right-0.5 top-0.5 h-4 w-4 rounded-full bg-white"></div>
                    </div>
                  </div>
                </div>
                <p className="text-[10px] text-text-secondary italic mt-4">* Features coming soon</p>
              </div>
            )}

            {activeTab === "appearance" && (
              <div className="space-y-6 max-w-md">
                <p className="text-sm text-text-secondary mb-8">Customize the look and feel of the application.</p>
                
                <div className="space-y-3">
                  <label className="text-xs font-semibold uppercase tracking-wider text-text-secondary">Theme</label>
                  <div className="grid grid-cols-2 gap-3">
                    <button 
                      onClick={() => setTheme("dark")}
                      className={`p-4 rounded-xl border-2 text-left transition relative ${theme === 'dark' ? 'border-primary bg-surface-5' : 'border-border bg-surface-4 hover:border-text-secondary'}`}
                    >
                      <div className={`text-sm font-bold mb-1 ${theme === 'dark' ? 'text-primary' : 'text-foreground'}`}>Dark Mode</div>
                      <div className="text-xs text-text-secondary">Default Signal dark aesthetic</div>
                      {theme === 'dark' && <div className="absolute top-4 right-4 h-4 w-4 rounded-full bg-primary border-2 border-surface-5 flex items-center justify-center"></div>}
                    </button>
                    <button 
                      onClick={() => setTheme("light")}
                      className={`p-4 rounded-xl border-2 text-left transition relative ${theme === 'light' ? 'border-primary bg-surface-5' : 'border-border bg-surface-4 hover:border-text-secondary'}`}
                    >
                      <div className={`text-sm font-bold mb-1 ${theme === 'light' ? 'text-primary' : 'text-foreground'}`}>Light Mode</div>
                      <div className="text-xs text-text-secondary">Bright and clean</div>
                      {theme === 'light' && <div className="absolute top-4 right-4 h-4 w-4 rounded-full bg-primary border-2 border-surface-5 flex items-center justify-center"></div>}
                    </button>
                  </div>
                </div>
                
                <div className="space-y-3 pt-4 border-t border-border">
                  <label className="text-xs font-semibold uppercase tracking-wider text-text-secondary">Chat Color</label>
                  <div className="flex gap-2">
                    {["bg-primary", "bg-indigo-500", "bg-emerald-500", "bg-purple-500", "bg-rose-500"].map((color, i) => (
                      <button key={i} disabled className={`h-8 w-8 rounded-full ${color} opacity-60 cursor-not-allowed border-2 border-transparent hover:border-white transition`}></button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};


interface AddContactModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddContact: (phoneOrUsername: string) => Promise<string | null>;
}

// Renders the modal to add a new contact by searching via phone number or username
export const AddContactModal: React.FC<AddContactModalProps> = ({
  isOpen,
  onClose,
  onAddContact,
}) => {
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    setLoading(true);
    setError(null);
    const err = await onAddContact(input.trim());
    setLoading(false);

    if (err) {
      setError(err);
    } else {
      setInput("");
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm rounded-xl border border-border bg-surface-3 text-foreground shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <h3 className="text-lg font-bold">Add Contact</h3>
          <button onClick={onClose} className="rounded-lg p-1 text-text-secondary hover:bg-surface-3 hover:text-foreground transition">
            <X className="h-5 w-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <div className="space-y-2">
            <label htmlFor="contact-input" className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
              Phone Number or Username
            </label>
            <input
              id="contact-input"
              type="text"
              placeholder="+2222222222 or bob"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              className="w-full rounded-lg border border-border bg-surface-1 px-4 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30"
              required
            />
          </div>

          {error && <p className="text-xs font-medium text-red-400 bg-red-950/20 border border-red-900/30 rounded-lg p-2.5">{error}</p>}

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-border px-4 py-2.5 text-sm font-semibold hover:bg-surface-3 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-600 transition disabled:opacity-50"
            >
              {loading ? "Adding..." : "Add Contact"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};


interface CreateGroupModalProps {
  contacts: Contact[];
  isOpen: boolean;
  onClose: () => void;
  onCreateGroup: (name: string, memberIds: number[]) => Promise<void>;
}

// Renders the modal to create a new group conversation, allowing the user to pick members from contacts
export const CreateGroupModal: React.FC<CreateGroupModalProps> = ({
  contacts,
  isOpen,
  onClose,
  onCreateGroup,
}) => {
  const [groupName, setGroupName] = useState("");
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleToggleContact = (id: number) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupName.trim() || selectedIds.length === 0) return;

    setLoading(true);
    await onCreateGroup(groupName.trim(), selectedIds);
    setLoading(false);
    setGroupName("");
    setSelectedIds([]);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-xl border border-border bg-surface-3 text-foreground shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <h3 className="text-lg font-bold">New Group</h3>
          <button onClick={onClose} className="rounded-lg p-1 text-text-secondary hover:bg-surface-3 hover:text-foreground transition">
            <X className="h-5 w-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-5">
          <div className="space-y-2">
            <label htmlFor="group-name" className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
              Group Name
            </label>
            <input
              id="group-name"
              type="text"
              placeholder="E.g. Book Club"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              className="w-full rounded-lg border border-border bg-surface-1 px-4 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30"
              required
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-text-secondary block mb-1">
              Select Members ({selectedIds.length} selected)
            </label>
            <div className="max-h-56 overflow-y-auto border border-border rounded-lg divide-y divide-neutral-800 bg-surface-1">
              {contacts.length === 0 ? (
                <div className="p-4 text-center text-sm text-text-secondary">No contacts available. Add contacts first.</div>
              ) : (
                contacts.map((c) => (
                  <label
                    key={c.contact_user.id}
                    className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-surface-2 transition"
                  >
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(c.contact_user.id)}
                      onChange={() => handleToggleContact(c.contact_user.id)}
                      className="h-4.5 w-4.5 rounded border-border text-blue-500 bg-surface-2 focus:ring-0 focus:ring-offset-0"
                    />
                    <div className="h-8 w-8 rounded-full overflow-hidden bg-surface-3">
                      <img src={c.contact_user.avatar_url || ""} alt={c.contact_user.display_name} />
                    </div>
                    <div className="flex-1 text-sm font-medium">{c.contact_user.display_name}</div>
                  </label>
                ))
              )}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-border px-4 py-2.5 text-sm font-semibold hover:bg-surface-3 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !groupName.trim() || selectedIds.length === 0}
              className="rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-600 transition disabled:opacity-50"
            >
              {loading ? "Creating..." : "Create Group"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};


interface GroupDetailsModalProps {
  currentUser: User;
  conversation: Conversation;
  contacts: Contact[];
  isOpen: boolean;
  onClose: () => void;
  onAddMember: (userId: number) => Promise<void>;
  onRemoveMember: (userId: number) => Promise<void>;
}

// Displays the details of an active group conversation, including member management and encryption status
export const GroupDetailsModal: React.FC<GroupDetailsModalProps> = ({
  currentUser,
  conversation,
  contacts,
  isOpen,
  onClose,
  onAddMember,
  onRemoveMember,
}) => {
  const [selectedMemberId, setSelectedMemberId] = useState<number | "">("");
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  // Determine current user's role in this group
  const myMemberInfo = conversation.members.find((m) => m.user_id === currentUser.id);
  const isAdmin = myMemberInfo?.role === "admin";

  // Filter contacts who are NOT already in the group
  const nonGroupContacts = contacts.filter(
    (c) => !conversation.members.some((m) => m.user_id === c.contact_user.id)
  );

  const handleAddMemberSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedMemberId === "") return;

    setLoading(true);
    await onAddMember(Number(selectedMemberId));
    setLoading(false);
    setSelectedMemberId("");
  };

  const handleRemove = async (userId: number) => {
    if (!confirm("Are you sure you want to remove this member?")) return;
    setLoading(true);
    await onRemoveMember(userId);
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-xl border border-border bg-surface-3 text-foreground shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div>
            <h3 className="text-lg font-bold">{conversation.name} Details</h3>
            <p className="text-xs text-text-secondary">{conversation.members.length} members</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 text-text-secondary hover:bg-surface-3 hover:text-foreground transition">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
          {/* Members List */}
          <div className="space-y-2">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-text-secondary">Members</h4>
            <div className="border border-border rounded-lg divide-y divide-neutral-800 bg-surface-1">
              {conversation.members.map((m) => {
                const isMemberSelf = m.user_id === currentUser.id;
                return (
                  <div key={m.user_id} className="flex items-center gap-3 px-4 py-3 justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full overflow-hidden bg-surface-3">
                        <img src={m.user.avatar_url || ""} alt={m.user.display_name} />
                      </div>
                      <div>
                        <div className="text-sm font-medium">
                          {m.user.display_name} {isMemberSelf && <span className="text-text-secondary">(You)</span>}
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-text-secondary">
                          {m.role === "admin" && (
                            <span className="flex items-center text-blue-400 text-[10px] uppercase font-bold tracking-wider">
                              <Shield className="h-3 w-3 mr-0.5" /> Admin
                            </span>
                          )}
                          <span>@{m.user.username}</span>
                        </div>
                      </div>
                    </div>
                    {/* Action buttons: Admins can remove other members */}
                    {isAdmin && !isMemberSelf && (
                      <button
                        onClick={() => handleRemove(m.user_id)}
                        disabled={loading}
                        className="rounded-lg p-1.5 text-red-400 hover:bg-surface-3 hover:text-red-300 transition"
                        title="Remove member"
                      >
                        <UserMinus className="h-4.5 w-4.5" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Add member (Admin only) */}
          {isAdmin && (
            <div className="space-y-2">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-text-secondary">Add Member</h4>
              {nonGroupContacts.length === 0 ? (
                <p className="text-xs text-text-secondary italic">All contacts are already in this group.</p>
              ) : (
                <form onSubmit={handleAddMemberSubmit} className="flex gap-2">
                  <select
                    value={selectedMemberId}
                    onChange={(e) => setSelectedMemberId(e.target.value === "" ? "" : Number(e.target.value))}
                    className="flex-1 rounded-lg border border-border bg-surface-1 px-3 py-2 text-sm outline-none transition focus:border-blue-500"
                    required
                  >
                    <option value="">Select a contact...</option>
                    {nonGroupContacts.map((c) => (
                      <option key={c.contact_user.id} value={c.contact_user.id}>
                        {c.contact_user.display_name} (@{c.contact_user.username})
                      </option>
                    ))}
                  </select>
                  <button
                    type="submit"
                    disabled={loading || selectedMemberId === ""}
                    className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-blue-600 transition flex items-center gap-1.5"
                  >
                    <Plus className="h-4 w-4" /> Add
                  </button>
                </form>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
