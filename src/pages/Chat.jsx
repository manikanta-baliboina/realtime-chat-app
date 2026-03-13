import { useEffect, useRef, useState } from "react";
import { signOut } from "firebase/auth";
import {
  addDoc,
  collection,
  doc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { auth, db } from "../services/firebase";
import { useAuth } from "../context/useAuth";

const getConversationId = (uid1, uid2) =>
  uid1 < uid2 ? `${uid1}_${uid2}` : `${uid2}_${uid1}`;

const getInitials = (name = "") =>
  name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "?";

const formatMessageTime = (timestamp) => {
  if (!timestamp?.toDate) return "";

  return timestamp.toDate().toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
};

const formatConversationTime = (timestamp) => {
  if (!timestamp?.toDate) return "";

  const date = timestamp.toDate();
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();

  if (isToday) {
    return date.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  return date.toLocaleDateString([], {
    month: "short",
    day: "numeric",
  });
};

const formatLastSeen = (timestamp) => {
  if (!timestamp?.toDate) return "Offline";

  const date = timestamp.toDate();
  return `Last seen ${date.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })}`;
};

const getMessagePreview = (message) => {
  if (!message) return "No messages yet";
  if (message.deleted) return "Message deleted";
  if (message.imageUrl && message.text) return `Photo: ${message.text}`;
  if (message.imageUrl) return "Photo";
  return message.text || "No messages yet";
};

const Chat = () => {
  const { user } = useAuth();
  const [profile, setProfile] = useState(null);
  const [users, setUsers] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [activeConversationId, setActiveConversationId] = useState("");
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [isGroupMode, setIsGroupMode] = useState(false);
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [groupName, setGroupName] = useState("");
  const [addMembersMode, setAddMembersMode] = useState(false);
  const [newMembers, setNewMembers] = useState([]);
  const [editingMessageId, setEditingMessageId] = useState("");
  const [editText, setEditText] = useState("");
  const [darkMode, setDarkMode] = useState(false);
  const bottomRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  useEffect(() => {
    if (!user) return undefined;

    const profileRef = doc(db, "users", user.uid);
    const unsubscribe = onSnapshot(profileRef, (snapshot) => {
      if (snapshot.exists()) {
        setProfile({ id: snapshot.id, ...snapshot.data() });
      }
    });

    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    if (!user) return undefined;

    const usersRef = collection(db, "users");
    const unsubscribe = onSnapshot(usersRef, (snapshot) => {
      const nextUsers = snapshot.docs
        .map((entry) => ({ id: entry.id, ...entry.data() }))
        .filter((entry) => entry.id !== user.uid)
        .sort((left, right) =>
          (left.fullName || "").localeCompare(right.fullName || "")
        );

      setUsers(nextUsers);
    });

    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    if (!user) return undefined;

    const conversationsRef = query(
      collection(db, "conversations"),
      where("members", "array-contains", user.uid)
    );

    const unsubscribe = onSnapshot(conversationsRef, (snapshot) => {
      const nextConversations = snapshot.docs
        .map((entry) => ({ id: entry.id, ...entry.data() }))
        .sort((left, right) => {
          const leftTime = left.updatedAt?.toMillis?.() || 0;
          const rightTime = right.updatedAt?.toMillis?.() || 0;
          return rightTime - leftTime;
        });

      setConversations(nextConversations);
      setActiveConversationId((currentId) => {
        if (currentId && nextConversations.some((item) => item.id === currentId)) {
          return currentId;
        }

        return nextConversations[0]?.id || "";
      });
    });

    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    if (!activeConversationId) return undefined;

    const messagesRef = query(
      collection(db, "conversations", activeConversationId, "messages"),
      orderBy("createdAt", "asc")
    );

    const unsubscribe = onSnapshot(messagesRef, (snapshot) => {
      setMessages(snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() })));
    });

    return () => unsubscribe();
  }, [activeConversationId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (!activeConversationId || !user) return undefined;

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    const conversationRef = doc(db, "conversations", activeConversationId);
    const isTyping = Boolean(text.trim());

    updateDoc(conversationRef, {
      [`typing.${user.uid}`]: isTyping,
    }).catch(() => {});

    if (isTyping) {
      typingTimeoutRef.current = setTimeout(() => {
        updateDoc(conversationRef, {
          [`typing.${user.uid}`]: false,
        }).catch(() => {});
      }, 1200);
    }

    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, [activeConversationId, text, user]);

  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, []);

  const activeConversation =
    conversations.find((item) => item.id === activeConversationId) || null;

  const availableUsers = users.filter((entry) =>
    entry.fullName?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const recentConversations = conversations.filter((conversation) => {
    const title = getConversationTitle(conversation, users, user?.uid);
    return title.toLowerCase().includes(searchTerm.toLowerCase());
  });

  const activeTypingUsers =
    activeConversation?.members
      ?.filter((memberId) => memberId !== user?.uid)
      .filter((memberId) => activeConversation?.typing?.[memberId])
      .map((memberId) => users.find((entry) => entry.id === memberId)?.fullName)
      .filter(Boolean) || [];

  const activeUsers = users.filter((entry) => entry.online);
  const activeConversationUsers =
    activeConversation?.members
      ?.filter((memberId) => memberId !== user?.uid)
      .map((memberId) => users.find((entry) => entry.id === memberId))
      .filter(Boolean) || [];

  async function createOrOpenDirectConversation(targetUser) {
    if (!user) return;

    const conversationId = getConversationId(user.uid, targetUser.id);
    const conversationRef = doc(db, "conversations", conversationId);

    await setDoc(
      conversationRef,
      {
        isGroup: false,
        members: [user.uid, targetUser.id],
        directParticipantNames: {
          [user.uid]: profile?.fullName || user.email || "You",
          [targetUser.id]: targetUser.fullName,
        },
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );

    setActiveConversationId(conversationId);
    setAddMembersMode(false);
  }

  async function createGroup() {
    if (!user) return;
    if (!groupName.trim()) {
      alert("Enter a group name.");
      return;
    }

    if (selectedUsers.length < 2) {
      alert("Select at least two people for a group chat.");
      return;
    }

    const groupId = `group_${Date.now()}`;
    const members = [user.uid, ...selectedUsers];

    await setDoc(doc(db, "conversations", groupId), {
      isGroup: true,
      name: groupName.trim(),
      members,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      createdBy: user.uid,
      typing: {},
      lastMessage: {
        text: "Group created",
        senderName: profile?.fullName || "System",
      },
    });

    setGroupName("");
    setSelectedUsers([]);
    setIsGroupMode(false);
    setActiveConversationId(groupId);
  }

  async function updateConversationPreview(conversationId) {
    const latestMessageQuery = query(
      collection(db, "conversations", conversationId, "messages"),
      orderBy("createdAt", "desc"),
      limit(1)
    );

    const snapshot = await getDocs(latestMessageQuery);
    const latestMessage = snapshot.docs[0]?.data();

    await updateDoc(doc(db, "conversations", conversationId), {
      lastMessage: latestMessage
        ? {
            text: latestMessage.text || "",
            imageUrl: latestMessage.imageUrl || "",
            deleted: Boolean(latestMessage.deleted),
            senderId: latestMessage.senderId,
            senderName: latestMessage.senderName || "",
            createdAt: latestMessage.createdAt || serverTimestamp(),
          }
        : null,
      updatedAt: latestMessage?.createdAt || serverTimestamp(),
    });
  }

  async function sendMessage() {
    if (!user || !activeConversationId) return;
    if (!text.trim() && !imageUrl.trim()) return;

    const payload = {
      senderId: user.uid,
      senderName: profile?.fullName || user.email || "Anonymous",
      text: text.trim(),
      imageUrl: imageUrl.trim(),
      createdAt: serverTimestamp(),
      deleted: false,
      edited: false,
    };

    await addDoc(
      collection(db, "conversations", activeConversationId, "messages"),
      payload
    );

    await updateDoc(doc(db, "conversations", activeConversationId), {
      lastMessage: payload,
      updatedAt: serverTimestamp(),
      [`typing.${user.uid}`]: false,
    });

    setText("");
    setImageUrl("");
  }

  async function softDeleteMessage(messageId) {
    if (!activeConversationId) return;

    await updateDoc(
      doc(db, "conversations", activeConversationId, "messages", messageId),
      {
        text: "",
        imageUrl: "",
        deleted: true,
      }
    );

    await updateConversationPreview(activeConversationId);
  }

  function startEditMessage(message) {
    setEditingMessageId(message.id);
    setEditText(message.text || "");
  }

  async function saveEditedMessage() {
    if (!activeConversationId || !editingMessageId || !editText.trim()) return;

    await updateDoc(
      doc(db, "conversations", activeConversationId, "messages", editingMessageId),
      {
        text: editText.trim(),
        edited: true,
        editedAt: serverTimestamp(),
      }
    );

    setEditingMessageId("");
    setEditText("");
    await updateConversationPreview(activeConversationId);
  }

  function cancelEdit() {
    setEditingMessageId("");
    setEditText("");
  }

  async function addMembersToGroup() {
    if (!activeConversation || !newMembers.length) return;

    const nextMembers = Array.from(
      new Set([...(activeConversation.members || []), ...newMembers])
    );

    await updateDoc(doc(db, "conversations", activeConversation.id), {
      members: nextMembers,
      updatedAt: serverTimestamp(),
    });

    setNewMembers([]);
    setAddMembersMode(false);
  }

  async function handleLogout() {
    if (!user) return;

    await updateDoc(doc(db, "users", user.uid), {
      online: false,
      lastSeen: serverTimestamp(),
    });

    await signOut(auth);
  }

  const selectableMembers = users.filter(
    (entry) => !activeConversation?.members?.includes(entry.id)
  );

  return (
    <div className={`chat-shell ${darkMode ? "theme-dark" : ""}`}>
      <aside className="sidebar">
        <div className="sidebar__header">
          <div>
            <p className="eyebrow">Realtime workspace</p>
            <h2>{profile?.fullName || "Chat App"}</h2>
            <p className="sidebar__subtext">{profile?.email}</p>
          </div>
          <button
            className="icon-button"
            type="button"
            onClick={() => setDarkMode((value) => !value)}
            aria-label="Toggle theme"
          >
            {darkMode ? "Light" : "Dark"}
          </button>
        </div>

        <div className="sidebar__search">
          <input
            type="text"
            placeholder="Search people or chats"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
          />
        </div>

        <div className="sidebar__actions">
          <button
            type="button"
            className={`secondary-button ${isGroupMode ? "is-active" : ""}`}
            onClick={() => {
              setIsGroupMode((value) => !value);
              setSelectedUsers([]);
              setGroupName("");
            }}
          >
            {isGroupMode ? "Cancel group" : "New group"}
          </button>
          <button type="button" className="danger-button" onClick={handleLogout}>
            Logout
          </button>
        </div>

        {isGroupMode && (
          <section className="panel">
            <h3>Create group</h3>
            <input
              type="text"
              placeholder="Group name"
              value={groupName}
              onChange={(event) => setGroupName(event.target.value)}
            />
            <div className="selection-list">
              {availableUsers.map((entry) => (
                <label key={entry.id} className="check-row">
                  <input
                    type="checkbox"
                    checked={selectedUsers.includes(entry.id)}
                    onChange={(event) =>
                      setSelectedUsers((current) =>
                        event.target.checked
                          ? [...current, entry.id]
                          : current.filter((id) => id !== entry.id)
                      )
                    }
                  />
                  <span>{entry.fullName}</span>
                </label>
              ))}
            </div>
            <button type="button" onClick={createGroup}>
              Create group
            </button>
          </section>
        )}

        <section className="sidebar__section">
          <div className="section-heading">
            <h3>Recent chats</h3>
            <span>{recentConversations.length}</span>
          </div>
          <div className="conversation-list">
            {recentConversations.length ? (
              recentConversations.map((conversation) => (
                <button
                  key={conversation.id}
                  type="button"
                  className={`conversation-card ${
                    activeConversationId === conversation.id ? "is-selected" : ""
                  }`}
                  onClick={() => {
                    setActiveConversationId(conversation.id);
                    setAddMembersMode(false);
                  }}
                >
                  <div
                    className={`avatar ${
                      isConversationOnline(conversation, users, user.uid) ? "avatar--online" : ""
                    }`}
                  >
                    {getInitials(getConversationTitle(conversation, users, user.uid))}
                  </div>
                  <div className="conversation-card__body">
                    <div className="conversation-card__top">
                      <strong>
                        {getConversationTitle(conversation, users, user.uid)}
                      </strong>
                      <span>{formatConversationTime(conversation.updatedAt)}</span>
                    </div>
                    <p>
                      {getConversationSubtitle(conversation, users, user.uid)}
                    </p>
                    <small>{getMessagePreview(conversation.lastMessage)}</small>
                  </div>
                </button>
              ))
            ) : (
              <p className="empty-state">No active conversations yet.</p>
            )}
          </div>
        </section>

        <section className="sidebar__section">
          <div className="section-heading">
            <h3>Active now</h3>
            <span>{activeUsers.length}</span>
          </div>
          <div className="people-list">
            {activeUsers.length ? (
              activeUsers.map((entry) => (
                <button
                  key={entry.id}
                  type="button"
                  className="person-card"
                  onClick={() => createOrOpenDirectConversation(entry)}
                >
                  <div className="avatar avatar--online">{getInitials(entry.fullName)}</div>
                  <div className="person-card__body">
                    <strong>{entry.fullName}</strong>
                    <span>Active now</span>
                  </div>
                </button>
              ))
            ) : (
              <p className="empty-state">No one is active right now.</p>
            )}
          </div>
        </section>

        <section className="sidebar__section">
          <div className="section-heading">
            <h3>People</h3>
            <span>{availableUsers.length}</span>
          </div>
          <div className="people-list">
            {availableUsers.map((entry) => (
              <button
                key={entry.id}
                type="button"
                className="person-card"
                onClick={() => createOrOpenDirectConversation(entry)}
              >
                <div className={`avatar ${entry.online ? "avatar--online" : ""}`}>
                  {getInitials(entry.fullName)}
                </div>
                <div className="person-card__body">
                  <strong>{entry.fullName}</strong>
                  <span>{entry.online ? "Online" : formatLastSeen(entry.lastSeen)}</span>
                </div>
              </button>
            ))}
          </div>
        </section>
      </aside>

      <main className="chat-main">
        {activeConversation ? (
          <>
            <header className="chat-header">
              <div>
                <p className="eyebrow">
                  {activeConversation.isGroup ? "Group chat" : "Direct message"}
                </p>
                <h1>{getConversationTitle(activeConversation, users, user.uid)}</h1>
                <p className="chat-header__status">
                  {activeTypingUsers.length
                    ? `${activeTypingUsers.join(", ")} typing...`
                    : getConversationSubtitle(activeConversation, users, user.uid)}
                </p>
                {activeConversationUsers.length ? (
                  <div className="active-strip">
                    {activeConversationUsers.map((entry) => (
                      <span
                        key={entry.id}
                        className={`active-pill ${entry.online ? "is-online" : ""}`}
                      >
                        {entry.fullName} {entry.online ? "active" : "offline"}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
              {activeConversation.isGroup && (
                <button
                  type="button"
                  className={`secondary-button ${addMembersMode ? "is-active" : ""}`}
                  onClick={() => setAddMembersMode((value) => !value)}
                >
                  {addMembersMode ? "Close members" : "Add members"}
                </button>
              )}
            </header>

            {addMembersMode && activeConversation.isGroup && (
              <section className="panel panel--inline">
                <h3>Add members</h3>
                <div className="selection-list">
                  {selectableMembers.length ? (
                    selectableMembers.map((entry) => (
                      <label key={entry.id} className="check-row">
                        <input
                          type="checkbox"
                          checked={newMembers.includes(entry.id)}
                          onChange={(event) =>
                            setNewMembers((current) =>
                              event.target.checked
                                ? [...current, entry.id]
                                : current.filter((id) => id !== entry.id)
                            )
                          }
                        />
                        <span>{entry.fullName}</span>
                      </label>
                    ))
                  ) : (
                    <p className="empty-state">Everyone is already in this group.</p>
                  )}
                </div>
                <button type="button" onClick={addMembersToGroup}>
                  Add selected members
                </button>
              </section>
            )}

            <section className="messages">
              {messages.length ? (
                messages.map((message) => (
                  <article
                    key={message.id}
                    className={`message ${
                      message.senderId === user.uid ? "message--own" : ""
                    }`}
                  >
                    <div className="message__meta">
                      <span>{message.senderId === user.uid ? "You" : message.senderName}</span>
                      <time>{formatMessageTime(message.createdAt)}</time>
                    </div>

                    <div className="message__bubble">
                      {message.deleted ? (
                        <p className="message__deleted">This message was deleted.</p>
                      ) : editingMessageId === message.id ? (
                        <div className="message__editor">
                          <input
                            type="text"
                            value={editText}
                            onChange={(event) => setEditText(event.target.value)}
                          />
                          <div className="message__editor-actions">
                            <button type="button" onClick={saveEditedMessage}>
                              Save
                            </button>
                            <button
                              type="button"
                              className="secondary-button"
                              onClick={cancelEdit}
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          {message.imageUrl && (
                            <img
                              src={message.imageUrl}
                              alt="Shared attachment"
                              className="message__image"
                            />
                          )}
                          {message.text ? <p>{message.text}</p> : null}
                          {message.edited ? <small>(edited)</small> : null}
                        </>
                      )}
                    </div>

                    {message.senderId === user.uid && !message.deleted ? (
                      <div className="message__actions">
                        <button type="button" onClick={() => startEditMessage(message)}>
                          Edit
                        </button>
                        <button
                          type="button"
                          className="danger-text"
                          onClick={() => softDeleteMessage(message.id)}
                        >
                          Delete
                        </button>
                      </div>
                    ) : null}
                  </article>
                ))
              ) : (
                <div className="messages__empty">
                  <h3>Start the conversation</h3>
                  <p>Send the first message to make this thread active in real time.</p>
                </div>
              )}
              <div ref={bottomRef} />
            </section>

            <footer className="composer">
              <input
                type="text"
                placeholder="Paste an image URL (optional)"
                value={imageUrl}
                onChange={(event) => setImageUrl(event.target.value)}
              />
              <div className="composer__row">
                <input
                  type="text"
                  placeholder="Type a message"
                  value={text}
                  onChange={(event) => setText(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      sendMessage();
                    }
                  }}
                />
                <button type="button" onClick={sendMessage}>
                  Send
                </button>
              </div>
            </footer>
          </>
        ) : (
          <section className="chat-empty">
            <p className="eyebrow">Realtime chat</p>
            <h1>Pick a person or create a group.</h1>
            <p>
              Conversations update live through Firestore snapshots, including member
              status, typing state, and latest message previews.
            </p>
          </section>
        )}
      </main>
    </div>
  );
};

function getConversationTitle(conversation, users, currentUserId) {
  if (conversation.isGroup) {
    return conversation.name || "Untitled group";
  }

  const otherUserId = conversation.members?.find((member) => member !== currentUserId);
  return (
    users.find((entry) => entry.id === otherUserId)?.fullName ||
    conversation.directParticipantNames?.[otherUserId] ||
    "Direct chat"
  );
}

function getConversationSubtitle(conversation, users, currentUserId) {
  if (conversation.isGroup) {
    return `${conversation.members?.length || 0} members`;
  }

  const otherUserId = conversation.members?.find((member) => member !== currentUserId);
  const otherUser = users.find((entry) => entry.id === otherUserId);

  if (!otherUser) return "Direct chat";
  return otherUser.online ? "Online now" : formatLastSeen(otherUser.lastSeen);
}

function isConversationOnline(conversation, users, currentUserId) {
  if (conversation.isGroup) {
    return conversation.members?.some((memberId) => {
      if (memberId === currentUserId) return false;
      return users.find((entry) => entry.id === memberId)?.online;
    });
  }

  const otherUserId = conversation.members?.find((member) => member !== currentUserId);
  return Boolean(users.find((entry) => entry.id === otherUserId)?.online);
}

export default Chat;
