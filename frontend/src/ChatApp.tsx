import React, { useEffect, useRef, useState, useCallback } from "react";
import { io, Socket } from "socket.io-client";

// Component for handling long messages with expand/collapse
const MessageContent: React.FC<{ text: string }> = ({ text }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const shouldTruncate = text.length > 200;
  
  if (!shouldTruncate) {
    return <div className="break-words">{text}</div>;
  }
  
  return (
    <div className="break-words">
      {isExpanded ? text : `${text.slice(0, 200)}...`}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="ml-2 text-xs underline opacity-70 hover:opacity-100"
      >
        {isExpanded ? "Show less" : "Show more"}
      </button>
    </div>
  );
};

interface Message {
  id: string;
  text: string;
  sender: string;
  timestamp: number;
  edited?: boolean;
}

interface User {
  code: string;
  nickname?: string;
  isTyping?: boolean;
  joinTime: number;
}

interface Props {
  onCode: (c: string) => void;
}

const ChatApp: React.FC<Props> = ({ onCode }) => {
  const socketRef = useRef<Socket | null>(null);
  const myCodeRef = useRef<string>("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  /* ──────────────────────────────── state */
  const [myCode, setMyCode] = useState("loading");
  const [users, setUsers] = useState<User[]>([]);
  const [threads, setThreads] = useState<Record<string, Message[]>>({ public: [] });
  const [selected, setSelected] = useState("public");
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [typingUsers, setTypingUsers] = useState<Record<string, string[]>>({ public: [] });
  const [nickname, setNickname] = useState("");
  const [showNicknameModal, setShowNicknameModal] = useState(false);
  const [myNickname, setMyNickname] = useState("");
  const [connectionStatus, setConnectionStatus] = useState<"connecting" | "connected" | "disconnected">("connecting");
  const [editingMessage, setEditingMessage] = useState<string | null>(null);
  const [editText, setEditText] = useState("");

  /* ──────────────────────────────── helpers */
  const addMsg = useCallback((thread: string, msg: Message) => {
    setThreads(prev => ({
      ...prev,
      [thread]: [...(prev[thread] || []), msg]
    }));
  }, []);

  const updateMsg = useCallback((messageId: string, newText: string) => {
    setThreads(prev => ({
      ...prev,
      public: prev.public.map(msg => 
        msg.id === messageId ? { ...msg, text: newText, edited: true } : msg
      )
    }));
  }, []);

  const deleteMsg = useCallback((messageId: string) => {
    setThreads(prev => ({
      ...prev,
      public: prev.public.filter(msg => msg.id !== messageId)
    }));
  }, []);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  const handleTyping = useCallback((typing: boolean) => {
    const socket = socketRef.current;
    if (!socket) return;

    if (typing && !isTyping) {
      setIsTyping(true);
      socket.emit("typing", { isTyping: true, thread: selected });
    } else if (!typing && isTyping) {
      setIsTyping(false);
      socket.emit("typing", { isTyping: false, thread: selected });
    }

    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Set new timeout to stop typing
    if (typing) {
      typingTimeoutRef.current = setTimeout(() => {
        setIsTyping(false);
        socket.emit("typing", { isTyping: false, thread: selected });
      }, 3000);
    }
  }, [isTyping, selected]);

  /* ──────────────────────────────── socket lifecycle */
  useEffect(() => {
    const socket = io();
    socketRef.current = socket;

    socket.on("connect", () => {
      setConnectionStatus("connected");
    });

    socket.on("disconnect", () => {
      setConnectionStatus("disconnected");
    });

    socket.on("your code", (code: string) => {
      myCodeRef.current = code;
      setMyCode(code);
      onCode(code);
    });

    socket.on("users update", (userList: User[]) => {
      if (!myCodeRef.current) return;
      setUsers(userList.filter(u => u.code !== myCodeRef.current));
    });

    socket.on("message history", (messages: Message[]) => {
      setThreads(prev => ({ ...prev, public: messages }));
    });

    socket.on("chat message", (message: Message) => {
      if (message.sender === myCodeRef.current) return;
      addMsg("public", message);
    });

    socket.on("private message", ({ from, message, timestamp, id }) => {
      addMsg(from, { id, text: message, sender: from, timestamp });
    });

    socket.on("typing status", ({ code, isTyping, thread }) => {
      setTypingUsers(prev => {
        const threadTyping = prev[thread] || [];
        const newThreadTyping = isTyping 
          ? threadTyping.includes(code) ? threadTyping : [...threadTyping, code]
          : threadTyping.filter(u => u !== code);
        
        return { ...prev, [thread]: newThreadTyping };
      });
    });

    socket.on("message edited", (message: Message) => {
      updateMsg(message.id, message.text);
    });

    socket.on("message deleted", (messageId: string) => {
      deleteMsg(messageId);
    });

    socket.on("error", (error: string) => {
      alert(error); // Replace with proper notification system
    });

    return () => {
      socket.disconnect();
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, [addMsg, updateMsg, deleteMsg]);

  /* auto-scroll */
  useEffect(() => {
    scrollToBottom();
  }, [threads, selected, scrollToBottom]);

  /* ──────────────────────────────── send */
  const send = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    const socket = socketRef.current;
    if (!socket) return;

    handleTyping(false);

    if (selected === "public") {
      const message: Message = {
        id: Date.now().toString(),
        text: input,
        sender: myCodeRef.current,
        timestamp: Date.now()
      };
      
      socket.emit("chat message", input);
      addMsg("public", message);
    } else if (selected !== myCodeRef.current) {
      const message: Message = {
        id: Date.now().toString(),
        text: input,
        sender: myCodeRef.current,
        timestamp: Date.now()
      };
      
      socket.emit("private message", { toCode: selected, message: input });
      addMsg(selected, message);
    }
    setInput("");
    inputRef.current?.focus();
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value);
    handleTyping(e.target.value.length > 0);
  };

  const handleEditMessage = (messageId: string, currentText: string) => {
    setEditingMessage(messageId);
    setEditText(currentText);
  };

  const saveEdit = () => {
    if (editingMessage && editText.trim()) {
      socketRef.current?.emit("edit message", { messageId: editingMessage, newText: editText });
      updateMsg(editingMessage, editText);
    }
    setEditingMessage(null);
    setEditText("");
  };

  const cancelEdit = () => {
    setEditingMessage(null);
    setEditText("");
  };

  const handleDeleteMessage = (messageId: string) => {
    if (confirm("Are you sure you want to delete this message?")) {
      socketRef.current?.emit("delete message", messageId);
      deleteMsg(messageId);
    }
  };

  const setUserNickname = () => {
    if (nickname.trim()) {
      socketRef.current?.emit("set nickname", nickname.trim());
      setMyNickname(nickname.trim());
      setShowNicknameModal(false);
    }
  };

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  /* ──────────────────────────────── render */
  const msgs = threads[selected] || [];
  const selectedUser = users.find(u => u.code === selected);

  return (
    <>
      {/* Connection Status */}
      {connectionStatus !== "connected" && (
        <div className={`fixed top-0 left-0 right-0 z-50 p-2 text-center text-white ${
          connectionStatus === "connecting" ? "bg-yellow-500" : "bg-red-500"
        }`}>
          {connectionStatus === "connecting" ? "Connecting..." : "Disconnected"}
        </div>
      )}

      {/* Nickname Modal */}
      {showNicknameModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-panel p-6 rounded-lg border border-border">
            <h3 className="text-lg font-semibold mb-4">Set Nickname</h3>
            <input
              type="text"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="Enter nickname"
              className="w-full border border-border rounded px-3 py-2 bg-panelAlt text-fg mb-4"
              maxLength={20}
            />
            <div className="flex gap-2">
              <button onClick={setUserNickname} className="bg-accent text-accentFore px-4 py-2 rounded">
                Set
              </button>
              <button onClick={() => setShowNicknameModal(false)} className="border border-border px-4 py-2 rounded">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* sidebar */}
      <aside className="w-64 bg-panel border-r border-border overflow-y-auto">
        <div className="p-4 border-b border-border">
          <h2 className="font-semibold mb-2">Users</h2>
          <button
            onClick={() => setShowNicknameModal(true)}
            className="text-sm text-accent hover:underline"
          >
            Set Nickname
          </button>
        </div>
        <ul>
          <li
            className={`px-4 py-2 cursor-pointer hover:bg-panelAlt font-semibold ${
              selected === "public" && "bg-panelAlt"
            }`}
            onClick={() => setSelected("public")}
          >
            <div className="flex items-center justify-between">
              <span>Public Chat</span>
              {typingUsers.public && typingUsers.public.length > 0 && (
                <span className="text-xs text-accent">
                  {typingUsers.public.length} typing...
                </span>
              )}
            </div>
          </li>
          {users.map(user => (
            <li
              key={user.code}
              className={`px-4 py-2 cursor-pointer hover:bg-panelAlt ${
                selected === user.code && "bg-panelAlt"
              }`}
              onClick={() => setSelected(user.code)}
            >
              <div className="flex items-center justify-between">
                <span>{user.nickname || user.code}</span>
                <div className="flex items-center gap-1">
                  {typingUsers[user.code] && typingUsers[user.code].includes(myCodeRef.current) && (
                    <span className="text-xs text-accent">typing...</span>
                  )}
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </aside>

      {/* chat area */}
      <section className="flex-1 flex flex-col">
        <div className="px-4 py-2 bg-header border-b border-border text-fg font-semibold">
          {selected === "public" ? "Public Chat" : `Chat with ${selectedUser?.nickname || selected}`}
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-panel">
          {msgs.map((m) => (
            <div
              key={m.id}
              className={`flex ${m.sender === myCodeRef.current ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`rounded-lg px-4 py-2 max-w-[70%] min-w-0 ${
                  m.sender === myCodeRef.current
                    ? "bg-accent text-accentFore"
                    : "bg-panelAlt text-fg border border-border"
                }`}
              >
                {editingMessage === m.id ? (
                  <div className="space-y-2">
                    <input
                      type="text"
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      className="w-full bg-transparent border-b border-current"
                      onKeyPress={(e) => e.key === 'Enter' && saveEdit()}
                    />
                    <div className="flex gap-2">
                      <button onClick={saveEdit} className="text-xs underline">Save</button>
                      <button onClick={cancelEdit} className="text-xs underline">Cancel</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs opacity-70 truncate">
                        {m.sender === myCodeRef.current 
                          ? (myNickname || myCodeRef.current)
                          : (users.find(u => u.code === m.sender)?.nickname || m.sender)
                        }
                      </span>
                      <span className="text-xs opacity-70 ml-2 flex-shrink-0">{formatTime(m.timestamp)}</span>
                    </div>
                    <MessageContent text={m.text} />
                    {m.edited && <div className="text-xs opacity-70 mt-1">edited</div>}
                    {m.sender === myCodeRef.current && (
                      <div className="flex gap-2 mt-2">
                        <button
                          onClick={() => handleEditMessage(m.id, m.text)}
                          className="text-xs underline opacity-70 hover:opacity-100"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeleteMessage(m.id)}
                          className="text-xs underline opacity-70 hover:opacity-100"
                        >
                          Delete
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        <form onSubmit={send} className="p-4 bg-panel border-t border-border flex gap-3">
          <input
            ref={inputRef}
            className="flex-1 border border-border rounded px-3 py-2 bg-panelAlt text-fg placeholder:text-fg/60"
            value={input}
            onChange={handleInputChange}
            placeholder="Type your message…"
            maxLength={500}
          />
          <button 
            type="submit" 
            className="bg-accent text-accentFore px-4 py-2 rounded disabled:opacity-50"
            disabled={!input.trim()}
          >
            Send
          </button>
        </form>
      </section>
    </>
  );
};

export default ChatApp;