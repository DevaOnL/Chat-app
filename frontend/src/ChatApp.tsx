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
  id: string;
  email: string;
  nickname: string; 
  isTyping?: boolean;
  joinTime: number;
}

interface Props {
  user: {  
    id: string;
    email: string; 
    nickname: string; 
  };   
}

const ChatApp: React.FC<Props> = ({ user }) => {
  const socketRef = useRef<Socket | null>(null);
   const myEmail = user.email;  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  /* ──────────────────────────────── state */
  const [users, setUsers] = useState<User[]>([]);
  const [threads, setThreads] = useState<Record<string, Message[]>>({ public: [] });
  const [selected, setSelected] = useState("public");
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [typingUsers, setTypingUsers] = useState<Record<string, string[]>>({ public: [] });
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
  setThreads(prev => {
    const updated: Record<string, Message[]> = {};
    for (const [thread, msgs] of Object.entries(prev)) {
      updated[thread] = msgs.map(msg =>
        msg.id === messageId ? { ...msg, text: newText, edited: true } : msg
      );
    }
    return updated;
  });
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
    const socket = io({ query: { id: user.id, email: user.email, nickname: user.nickname } }); 
    socketRef.current = socket;
    socket.on("connect", () => {
      setConnectionStatus("connected");
    });

    socket.on("disconnect", () => {
      setConnectionStatus("disconnected");
    });

    // socket.on("your code", (code: string) => {
    //   myCodeRef.current = code;
    //   setMyCode(code);
    //   onCode(code);
    // });

    socket.on("users update", (userList: User[]) => {
      setUsers(userList.filter(u => u.email !== myEmail));  
    });

    socket.on("message history", (messages: Message[]) => {
      setThreads(prev => ({ ...prev, public: messages }));
    });

    socket.on("chat message", (message: Message) => {
      addMsg("public", message);
    });

    socket.on("private message", ({ from, to, message, timestamp, id }) => {
      const thread = from === myEmail ? to : from;
      addMsg(thread, { id, text: message, sender: from, timestamp });
    });

    socket.on("typing status", ({ email, isTyping, thread }) => {          
      setTypingUsers(prev => {
        const threadTyping = prev[thread] || [];
        const newThreadTyping = isTyping 
         ? threadTyping.includes(email) ? threadTyping : [...threadTyping, email]   
         : threadTyping.filter(u => u !== email);       
        
        return { ...prev, [thread]: newThreadTyping };
      });
    });

    socket.on("message edited", (message: Message) => {
      setThreads(prev => {
        const newThreads = { ...prev };
        for (const thread in newThreads) {
          newThreads[thread] = newThreads[thread].map(msg =>
            msg.id === message.id ? { ...msg, text: message.text, edited: true } : msg
          );
        }
        return newThreads;
      });
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
      socket.emit("chat message", input);
    } else if (selected !== myEmail) {     
      socket.emit("private message", { toEmail: selected, message: input });
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
      const isPrivate = selected !== "public";
      socketRef.current?.emit("edit message", { 
        messageId: editingMessage, 
        newText: editText, 
        isPrivate 
      });
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

  // const setUserNickname = () => {
  //   if (nickname.trim()) {
  //     socketRef.current?.emit("set nickname", nickname.trim());
  //     setMyNickname(nickname.trim());
  //     setShowNicknameModal(false);
  //   }
  // };

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  /* ──────────────────────────────── render */
  const msgs = threads[selected] || [];
   const selectedUser = users.find(u => u.email === selected);    

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

      

      {/* sidebar */}
      <aside className="w-64 bg-panel border-r border-border overflow-y-auto">
        <div className="p-4 border-b border-border">
          <h2 className="font-semibold mb-2">Users</h2>
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
              key={user.id}    
              className={`px-4 py-2 cursor-pointer hover:bg-panelAlt ${
               selected === user.email && "bg-panelAlt"        
              }`}
              onClick={() => setSelected(user.email)}          
            >
              <div className="flex items-center justify-between">
                 <span>{user.nickname || user.email}</span>               
                <div className="flex items-center gap-1">
                 {typingUsers[user.email] && typingUsers[user.email].includes(myEmail) && (   
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
              className={`flex ${m.sender === myEmail ? "justify-end" : "justify-start"}`} 
            >
              <div
                className={`rounded-lg px-4 py-2 max-w-[70%] min-w-0 ${
                  m.sender === myEmail  
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
                        {m.sender === myEmail  ? user.nickname   : (users.find(u => u.email === m.sender)?.nickname || m.sender)   
                        }
                      </span>
                      <span className="text-xs opacity-70 ml-2 flex-shrink-0">{formatTime(m.timestamp)}</span>
                    </div>
                    <MessageContent text={m.text} />
                    {m.edited && <div className="text-xs opacity-70 mt-1">edited</div>}
                   {m.sender === myEmail && (            
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