      import { useEffect, useState, useRef } from "react";
      import { signOut } from "firebase/auth";

      import {
        collection,
        getDocs,
        doc,
        getDoc,
        setDoc,
        addDoc,
        onSnapshot,
        orderBy,
        query,
        serverTimestamp,
        updateDoc,
      } from "firebase/firestore";
      import { auth, db } from "../services/firebase";
      import { useAuth } from "../context/AuthContext";

      /* Helpers */
      const getConversationId = (uid1, uid2) =>
        uid1 < uid2 ? `${uid1}_${uid2}` : `${uid2}_${uid1}`;

      const formatTime = (ts) => {
        if (!ts?.toDate) return "";
        const d = ts.toDate();
        return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      };

      const Chat = () => {
        const { user } = useAuth();

        const [users, setUsers] = useState([]);
        const [fullName, setFullName] = useState("");
        const [activeChat, setActiveChat] = useState(null); // user OR group
        const [messages, setMessages] = useState([]);
        const [text, setText] = useState("");
        const [imageUrl, setImageUrl] = useState("");
        const [conversationId, setConversationId] = useState(null);

        // Group states
        const [isGroupMode, setIsGroupMode] = useState(false);
        const [selectedUsers, setSelectedUsers] = useState([]);
        const [groupName, setGroupName] = useState("");

        const bottomRef = useRef(null);
        const [addMembersMode, setAddMembersMode] = useState(false);
        const [newMembers, setNewMembers] = useState([]);
        const [editingMessageId, setEditingMessageId] = useState(null);
        const [editText, setEditText] = useState("");
        const [darkMode, setDarkMode] = useState(false);



        /* ---------------- USER PROFILE ---------------- */
        useEffect(() => {
          if (!user) return;

          getDoc(doc(db, "users", user.uid)).then((snap) => {
            if (snap.exists()) setFullName(snap.data().fullName);
          });
        }, [user]);

        /* ---------------- FETCH USERS ---------------- */
        useEffect(() => {
          if (!user) return;

          getDocs(collection(db, "users")).then((snapshot) => {
            const list = [];
            snapshot.forEach((d) => {
              if (d.id !== user.uid) list.push({ id: d.id, ...d.data() });
            });
            setUsers(list);
          });
        }, [user]);

        /* ---------------- LOAD CONVERSATION ---------------- */
      useEffect(() => {
        if (!activeChat || !user) return;

        const convId = activeChat.isGroup
          ? activeChat.id
          : getConversationId(user.uid, activeChat.id);

        setConversationId(convId);

        if (!activeChat.isGroup) {
          setDoc(
            doc(db, "conversations", convId),
            {
              isGroup: false,
              members: [user.uid, activeChat.id],
              createdAt: serverTimestamp(),
            },
            { merge: true }
          );
        }

        const q = query(
          collection(db, "conversations", convId, "messages"),
          orderBy("createdAt", "asc")
        );

        const unsub = onSnapshot(q, (snapshot) => {
          const msgs = snapshot.docs.map((d) => ({
            id: d.id,
            ...d.data(),
          }));
          setMessages(msgs);
        });

        return () => unsub();
      }, [activeChat]);



        /* ---------------- AUTO SCROLL ---------------- */
        useEffect(() => {
          bottomRef.current?.scrollIntoView({ behavior: "smooth" });
        }, [messages]);

        /* ---------------- CREATE GROUP ---------------- */
      const createGroup = async () => {
        if (!groupName.trim()) {
          alert("Enter group name");
          return;
        }

        if (selectedUsers.length < 2) {
          alert("Select at least 2 users");
          return;
        }

        const groupId = `group_${Date.now()}`;
        const members = [user.uid, ...selectedUsers.map((u) => u.id)];

        await setDoc(doc(db, "conversations", groupId), {
          isGroup: true,
          name: groupName,
          members,
          createdAt: serverTimestamp(),
        });

        setActiveChat({
          id: groupId,
          isGroup: true,
          name: groupName,
        });

        setConversationId(groupId);
        setMessages([]);

        setIsGroupMode(false);
        setSelectedUsers([]);
        setGroupName("");
      };


        /* ---------------- SEND MESSAGE ---------------- */
        const sendMessage = async () => {
          if (!text.trim() && !imageUrl.trim()) return;
          if (!conversationId) return;

          await addDoc(
            collection(db, "conversations", conversationId, "messages"),
            {
              senderId: user.uid,
              text: text || "",
              imageUrl: imageUrl || "",
              createdAt: serverTimestamp(),
              deleted: false,
            }
          );

          setText("");
          setImageUrl("");
        };

        /* ---------------- SOFT DELETE ---------------- */
        const softDeleteMessage = async (id) => {
          await updateDoc(
            doc(db, "conversations", conversationId, "messages", id),
            {
              text: "",
              imageUrl: "",
              deleted: true,
            }
          );
        };
              /* ---------------- EDIT MESSAGE ---------------- */
              const startEditMessage = (msg) => {
                setEditingMessageId(msg.id);
                setEditText(msg.text);
              };

              const saveEditedMessage = async () => {
                if (!editingMessageId || !editText.trim()) return;

                await updateDoc(
                  doc(db, "conversations", conversationId, "messages", editingMessageId),
                  {
                    text: editText,
                    edited: true,
                    editedAt: serverTimestamp(),
                  }
                );

                setEditingMessageId(null);
                setEditText("");
              };

              const cancelEdit = () => {
                setEditingMessageId(null);
                setEditText("");
              };

        /* ---------------- ADD MEMBERS TO GROUP ---------------- */
      const addMembersToGroup = async () => {
        if (!conversationId || newMembers.length === 0) return;

        const groupRef = doc(db, "conversations", conversationId);
        const snap = await getDoc(groupRef);

        if (!snap.exists()) return;

        const existingMembers = snap.data().members || [];

        const updatedMembers = Array.from(
          new Set([...existingMembers, ...newMembers])
        );

        await updateDoc(groupRef, {
          members: updatedMembers,
        });

        setAddMembersMode(false);
        setNewMembers([]);
      };


        /* ---------------- LOGOUT ---------------- */
        const handleLogout = async () => {
          await updateDoc(doc(db, "users", user.uid), {
            online: false,
            lastSeen: serverTimestamp(),
          });
          await signOut(auth);
        };

        return (
          <div
  style={{
    display: "flex",
    height: "100vh",
    background: darkMode ? "#111827" : "#f9fafb",
    color: darkMode ? "#f9fafb" : "#000",
  }}
>

            {/* Sidebar */}
            <div
  style={{
    width: 260,
    background: darkMode ? "#020617" : "#1f2937",
    color: "#fff",
    padding: 15,
  }}
>

              <h3>Welcome, {fullName}</h3>
              <button
  onClick={() => setDarkMode((prev) => !prev)}
  style={{
    marginTop: "10px",
    width: "100%",
    padding: "6px",
    background: darkMode ? "#374151" : "#e5e7eb",
    color: darkMode ? "#fff" : "#000",
    border: "none",
    borderRadius: "6px",
    cursor: "pointer",
    fontSize: "13px",
  }}
>
  {darkMode ? "☀ Light Mode" : "🌙 Dark Mode"}
</button>


              {/* CREATE GROUP UI */}
              <button
                onClick={() => setIsGroupMode(!isGroupMode)}
                style={{ width: "100%", padding: 8, marginBottom: 8 }}
              >
                {isGroupMode ? "Cancel Group" : "Create Group"}
              </button>

              {isGroupMode && (
                <>
                  <input
                    placeholder="Group name"
                    value={groupName}
                    onChange={(e) => setGroupName(e.target.value)}
                    style={{ width: "100%", marginBottom: 6 }}
                  />
                  <button onClick={createGroup} style={{ width: "100%" }}>
                    Create Group
                  </button>
                </>
              )}

              <h4 style={{ marginTop: 15 }}>Users</h4>

              {users.map((u) => (
                <div
                  key={u.id}
                  onClick={() =>
                    isGroupMode
                      ? setSelectedUsers((p) =>
                          p.some((x) => x.id === u.id)
                            ? p.filter((x) => x.id !== u.id)
                            : [...p, u]
                        )
                      : setActiveChat({ ...u, isGroup: false })
                  }
                  style={{
                    padding: 8,
                    marginTop: 6,
                    background: selectedUsers.some((x) => x.id === u.id)
                      ? "#374151"
                      : "#111827",
                    cursor: "pointer",
                  }}
                >
                  {u.fullName}
                </div>
              ))}

              <button
                onClick={handleLogout}
                style={{ marginTop: 20, width: "100%", background: "#ef4444", color: "#fff" }}
              >
                Logout
              </button>
            </div>

            {/* Chat Area */}
            <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
              <div
        style={{
          padding: "15px",
          borderBottom: "1px solid #ddd",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        {activeChat ? (
          <>
            <h3>
              {activeChat.isGroup
                ? activeChat.name
                : `Chat with ${activeChat.fullName}`}
            </h3>

            {activeChat.isGroup && (
              <button
                onClick={() => setAddMembersMode(!addMembersMode)}
                style={{
                  padding: "6px 10px",
                  background: "#2563eb",
                  color: "#fff",
                  border: "none",
                  borderRadius: "4px",
                  cursor: "pointer",
                }}
              >
                {addMembersMode ? "Cancel" : "Add Members"}
              </button>
            )}
          </>
        ) : (
          <h3>Select a chat</h3>
        )}
      </div>
      {addMembersMode && activeChat?.isGroup && (
        <div
          style={{
            padding: "10px",
            borderBottom: "1px solid #ddd",
            background: "#f3f4f6",
          }}
        >
          <h4>Add members</h4>

          {users.map((u) => (
            <label
              key={u.id}
              style={{ display: "block", marginBottom: "4px" }}
            >
              <input
                type="checkbox"
                onChange={(e) =>
                  setNewMembers((prev) =>
                    e.target.checked
                      ? [...prev, u.id]
                      : prev.filter((id) => id !== u.id)
                  )
                }
              />
              {" "}{u.fullName}
            </label>
          ))}

          <button
            onClick={addMembersToGroup}
            style={{
              marginTop: "10px",
              padding: "6px 12px",
              background: "#2563eb",
              color: "#fff",
              border: "none",
              borderRadius: "4px",
            }}
          >
            Add Selected
          </button>
        </div>
      )}



              
          {/* Messages */}
    <div
      style={{
        flex: 1,
        padding: "15px",
        overflowY: "auto",
        background: darkMode ? "#020617" : "#f9fafb",

      }}
    >
      {messages.map((m) => (
        <div
          key={m.id}
          style={{
            display: "flex",
            justifyContent:
              m.senderId === user.uid ? "flex-end" : "flex-start",
            marginBottom: "8px",
          }}
        >
          <div>
            <span
              style={{
                maxWidth: "65%",
                padding: "8px 12px",
                borderRadius: "16px",
               background: m.senderId === user.uid
                              ? "#2563eb"
                              : darkMode
                              ? "#1f2937"
                              : "#e5e7eb",
                          color:
                            m.senderId === user.uid
                              ? "#fff"
                              : darkMode
                              ? "#f9fafb"
                              : "#000",

                fontSize: "14px",
                lineHeight: "1.4",
                wordBreak: "break-word",
                display: "inline-block",
              }}
            >
              {m.deleted ? (
                <div style={{ fontStyle: "italic", opacity: 0.6 }}>
                  This message was deleted
                </div>
              ) : editingMessageId === m.id ? (
                <div>
                  <input
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    style={{
                      width: "100%",
                      fontSize: "13px",
                      padding: "6px",
                    }}
                  />
                  <div style={{ marginTop: "4px" }}>
                    <button
                      onClick={saveEditedMessage}
                      style={{
                        fontSize: "10px",
                        padding: "2px 6px",
                        background: "#22c55e",
                        color: "#fff",
                        border: "none",
                        borderRadius: "3px",
                        cursor: "pointer",
                      }}
                    >
                      Save
                    </button>

                    <button
                      onClick={cancelEdit}
                      style={{
                        fontSize: "10px",
                        padding: "2px 6px",
                        background: "#9ca3af",
                        color: "#fff",
                        border: "none",
                        borderRadius: "3px",
                        cursor: "pointer",
                        marginLeft: "6px",
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  {m.imageUrl && (
                    <img
                      src={m.imageUrl}
                      alt="chat"
                      style={{
                        maxWidth: "200px",
                        borderRadius: "10px",
                        display: "block",
                        marginBottom: "6px",
                      }}
                    />
                  )}

                  {m.text && <div>{m.text}</div>}

                  {m.edited && (
                    <div style={{ fontSize: "11px", opacity: 0.6 }}>
                      (edited)
                    </div>
                  )}
                </>
              )}

              <div
                style={{
                  fontSize: "10px",
                  opacity: 0.6,
                  marginTop: "4px",
                  textAlign: "right",
                }}
              >
                {formatTime(m.createdAt)}
              </div>
            </span>

            {m.senderId === user.uid && !m.deleted && (
              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: "6px",
                  marginTop: "2px",
                }}
              >
                <button
                  onClick={() => softDeleteMessage(m.id)}
                  style={{
                    fontSize: "11px",
                    background: "transparent",
                    border: "none",
                    color: "#ef4444",
                    cursor: "pointer",
                  }}
                >
                  Delete
                </button>

                <button
                  onClick={() => startEditMessage(m)}
                  style={{
                    fontSize: "11px",
                    background: "transparent",
                    border: "none",
                    color: "#2563eb",
                    cursor: "pointer",
                  }}
                >
                  Edit
                </button>
              </div>
            )}
          </div>
        </div>
      ))}
      <div ref={bottomRef} />
    </div>


  {/* Input */}
{activeChat && (
  <div
    style={{
      padding: "12px",
      borderTop: "1px solid #e5e7eb",
      background: darkMode ? "#020617" : "#fff",

    }}
  >
    <input
      value={text}
      onChange={(e) => setText(e.target.value)}
      placeholder="Type a message..."
      style={{
        width: "100%",              // ✅ FULL WIDTH
        height: "44px",             // ✅ NORMAL HEIGHT
        padding: "0 16px",
        fontSize: "14px",
        borderRadius: "8px",
        border: darkMode ? "1px solid #374151" : "1px solid #d1d5db",
        background: darkMode ? "#020617" : "#fff",
        color: darkMode ? "#f9fafb" : "#000",

        outline: "none",
        boxSizing: "border-box",
      }}
    />

    <button
      onClick={sendMessage}
      style={{
        marginTop: "10px",          // ✅ BUTTON BELOW INPUT
        width: "100%",
        height: "42px",
        background: "#2563eb",
        color: "#fff",
        border: "none",
        borderRadius: "8px",
        fontSize: "14px",
        cursor: "pointer",
      }}
    >
      Send
    </button>
  </div>
)}




            </div>
          </div>
        );
      };

      export default Chat;
