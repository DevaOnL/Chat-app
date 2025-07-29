import React, { useEffect, useRef, useState, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import Avatar from "./Avatar";
import FileUpload from "./FileUpload";
import FileMessage from "./FileMessage";
import { ReactionBar, QuickReactions } from "./EnhancedReactions";

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
  reactions?: {
    [emoji: string]: string[]; // Array of user IDs who reacted
  };
  file?: {
    fileName: string;
    fileSize: number;
    fileType: string;
    fileUrl: string;
  };
}

interface User {
  id: string;
  email: string;
  nickname: string; 
  avatar?: string;
  isTyping?: boolean;
  joinTime: number;
}

interface Props {
  user: {  
    id: string;
    email: string; 
    nickname: string;
    avatar?: string;
  };
  highlightMessageId?: string;
  onMessageHighlighted?: () => void;
}

const ChatApp: React.FC<Props> = ({ user, highlightMessageId, onMessageHighlighted }) => {
  const socketRef = useRef<Socket | null>(null);
   const myEmail = user.email;  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const shouldAutoScrollRef = useRef(true);

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
  const [showEmojiPicker, setShowEmojiPicker] = useState<string | null>(null); // messageId for which picker is shown
  const [showFileUpload, setShowFileUpload] = useState(false);
  const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null);
  const [isUploadingFile, setIsUploadingFile] = useState(false);

  /* ──────────────────────────────── helpers */
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  const isNearBottom = useCallback(() => {
    const container = messagesContainerRef.current;
    if (!container) return true;
    
    const threshold = 100; // pixels from bottom
    const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
    return distanceFromBottom <= threshold;
  }, []);

  const handleScroll = useCallback(() => {
    shouldAutoScrollRef.current = isNearBottom();
  }, [isNearBottom]);

  const addMsg = useCallback((thread: string, msg: Message) => {
    setThreads(prev => ({
      ...prev,
      [thread]: [...(prev[thread] || []), msg]
    }));
    // Force auto-scroll when a new message is added
    shouldAutoScrollRef.current = true;
    setTimeout(() => scrollToBottom(), 50);
  }, [scrollToBottom]);

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

  const updateMessageReactions = useCallback((messageId: string, reactions: { [emoji: string]: string[] }) => {
    console.log(`Updating message reactions - MessageId: ${messageId}, Reactions:`, reactions);
    setThreads(prev => {
      const updated: Record<string, Message[]> = {};
      for (const [thread, msgs] of Object.entries(prev)) {
        updated[thread] = msgs.map(msg =>
          msg.id === messageId ? { ...msg, reactions } : msg
        );
      }
      return updated;
    });
  }, []);

  const handleReaction = useCallback((messageId: string, emoji: string) => {
    console.log(`Sending reaction - MessageId: ${messageId}, Emoji: ${emoji}, UserId: ${user.id}, IsPrivate: ${selected !== "public"}`);
    socketRef.current?.emit("toggle reaction", { 
      messageId, 
      emoji, 
      userId: user.id,
      isPrivate: selected !== "public"
    });
    // Close emoji picker after selecting
    setShowEmojiPicker(null);
  }, [user.id, selected]);

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
    const socket = io({ 
      query: { id: user.id, email: user.email, nickname: user.nickname },
      // Enable automatic reconnection
      autoConnect: true,
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
      timeout: 20000
    }); 
    socketRef.current = socket;
    
    socket.on("connect", () => {
      console.log("🔗 Connected to server");
      setConnectionStatus("connected");
    });

    socket.on("disconnect", (reason) => {
      console.log("💔 Disconnected from server:", reason);
      setConnectionStatus("disconnected");
    });

    socket.on("session_replaced", (data) => {
      console.log("🔄 Session replaced:", data.message);
      alert("Your account has been logged in from another location. This session will be disconnected.");
      // Optionally redirect to login or handle gracefully
      window.location.reload();
    });

    socket.on("connect_error", (error) => {
      console.error("❌ Connection error:", error);
      setConnectionStatus("disconnected");
    });

    socket.on("reconnect", (attemptNumber) => {
      console.log("🔄 Reconnected after", attemptNumber, "attempts");
      setConnectionStatus("connected");
    });

    socket.on("reconnect_attempt", (attemptNumber) => {
      console.log("🔄 Reconnection attempt", attemptNumber);
    });

    socket.on("reconnect_error", (error) => {
      console.error("❌ Reconnection error:", error);
    });

    socket.on("reconnect_failed", () => {
      console.error("❌ Failed to reconnect");
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
      console.log(`✏️ Received edit confirmation for message: ${message.id}`);
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
      console.log(`🗑️ Received delete confirmation for message: ${messageId}`);
      deleteMsg(messageId);
    });

    socket.on("error", (error: string) => {
      console.error('❌ Socket error:', error);
      alert(error); // Replace with proper notification system
    });

    socket.on("reaction updated", ({ messageId, reactions }) => {
      console.log(`Received reaction update - MessageId: ${messageId}, Reactions:`, reactions);
      updateMessageReactions(messageId, reactions);
    });

    return () => {
      socket.disconnect();
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, [addMsg, updateMsg, deleteMsg, updateMessageReactions]);

  /* auto-scroll */
  useEffect(() => {
    // Always auto-scroll when switching threads
    shouldAutoScrollRef.current = true;
    scrollToBottom();
  }, [selected, scrollToBottom]);

  // Auto-scroll only when messages change AND user should auto-scroll
  useEffect(() => {
    if (shouldAutoScrollRef.current) {
      scrollToBottom();
    }
  }, [threads[selected]?.length, scrollToBottom]);

  /* highlight and scroll to specific message */
  useEffect(() => {
    if (highlightMessageId) {
      // Find the message in all threads to determine which thread to switch to
      let targetThread = selected;
      for (const [threadName, messages] of Object.entries(threads)) {
        if (messages.some(msg => msg.id === highlightMessageId)) {
          targetThread = threadName;
          break;
        }
      }

      // Switch to the thread containing the message
      if (targetThread !== selected) {
        setSelected(targetThread);
      }

      // Wait a bit for the thread switch to complete, then scroll to message
      setTimeout(() => {
        const messageElement = document.getElementById(`message-${highlightMessageId}`);
        if (messageElement) {
          // Scroll to the message
          messageElement.scrollIntoView({ 
            behavior: 'smooth', 
            block: 'center' 
          });
          
          // Highlight the message
          setHighlightedMessageId(highlightMessageId);
          
          // Remove highlight after 3 seconds
          setTimeout(() => {
            setHighlightedMessageId(null);
            onMessageHighlighted?.();
          }, 3000);
        }
      }, targetThread !== selected ? 500 : 100);
    }
  }, [highlightMessageId, threads, selected, onMessageHighlighted]);

  /* Auto-focus input when typing anywhere */
  useEffect(() => {
    const handleGlobalKeydown = (e: KeyboardEvent) => {
      // Don't trigger if user is already typing in an input/textarea/contenteditable
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.contentEditable === 'true' ||
        target.closest('[contenteditable="true"]')
      ) {
        return;
      }

      // Don't trigger for special keys
      if (
        e.ctrlKey ||
        e.altKey ||
        e.metaKey ||
        e.key === 'Escape' ||
        e.key === 'Tab' ||
        e.key === 'Enter' ||
        e.key === 'Backspace' ||
        e.key === 'Delete' ||
        e.key.startsWith('Arrow') ||
        e.key.startsWith('F')
      ) {
        return;
      }

      // Only trigger for printable characters
      if (e.key.length === 1 && inputRef.current) {
        e.preventDefault();
        inputRef.current.focus();
        // Add the typed character to the input
        setInput(prev => prev + e.key);
      }
    };

    document.addEventListener('keydown', handleGlobalKeydown);
    return () => document.removeEventListener('keydown', handleGlobalKeydown);
  }, []);

  /* ──────────────────────────────── send */
  const send = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    const socket = socketRef.current;
    if (!socket) return;

    handleTyping(false);
    setShowEmojiPicker(null); // Close emoji picker when sending
    
    // Force auto-scroll when user sends a message
    shouldAutoScrollRef.current = true;

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
    // Close any existing edit first
    if (editingMessage) {
      setEditingMessage(null);
      setEditText("");
    }
    
    // Start editing the new message
    setEditingMessage(messageId);
    setEditText(currentText);
  };

  const saveEdit = () => {
    if (editingMessage && editText.trim()) {
      const isPrivate = selected !== "public";
      console.log(`🔄 Sending edit request for message: ${editingMessage}`);
      socketRef.current?.emit("edit message", { 
        messageId: editingMessage, 
        newText: editText, 
        isPrivate 
      });
      // Don't update local state immediately - wait for server confirmation
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
      console.log(`🗑️ Sending delete request for message: ${messageId}`);
      socketRef.current?.emit("delete message", messageId);
      // Don't delete from local state immediately - wait for server confirmation
    }
  };

  const handleFileUpload = async (file: File) => {
    setIsUploadingFile(true);

    try {
      // Create FormData for file upload
      const formData = new FormData();
      formData.append('file', file);
      formData.append('thread', selected);

      // Get the auth token
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('No authentication token found');
      }

      // Upload file to server
      const response = await fetch('/api/upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to upload file');
      }

      const fileData = await response.json();

      // Send file message through socket
      const fileMessage = {
        text: `📎 ${file.name}`,
        file: {
          fileName: file.name,
          fileSize: file.size,
          fileType: file.type,
          fileUrl: fileData.fileUrl
        }
      };

      if (selected === "public") {
        socketRef.current?.emit("chat message", fileMessage.text, fileMessage.file);
      } else {
        socketRef.current?.emit("private message", { 
          toEmail: selected, 
          message: fileMessage.text,
          file: fileMessage.file
        });
      }

      setShowFileUpload(false);
    } catch (error) {
      console.error('File upload error:', error);
      alert(error instanceof Error ? error.message : 'Failed to upload file');
    } finally {
      setIsUploadingFile(false);
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
            onClick={() => {
              setSelected("public");
              setShowEmojiPicker(null);
            }}
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
              onClick={() => {
                setSelected(user.email);
                setShowEmojiPicker(null);
              }}          
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Avatar user={user} size="sm" />
                  <span>{user.nickname || user.email}</span>
                </div>               
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

        <div 
          ref={messagesContainerRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto p-4 space-y-2 bg-panel"
        >
          {msgs.map((m) => (
            <div
              key={m.id}
              id={`message-${m.id}`}
              className={`flex ${m.sender === myEmail ? "justify-end" : "justify-start"} transition-all duration-300 group relative ${
                highlightedMessageId === m.id 
                  ? 'bg-yellow-200 dark:bg-yellow-800 bg-opacity-50 rounded-lg p-2 -m-2' 
                  : ''
              }`} 
            >
              {/* Show avatar for messages from other users */}
              {m.sender !== myEmail && (
                <div className="mr-3 mt-1 flex-shrink-0">
                  <Avatar 
                    user={users.find(u => u.email === m.sender) || { id: m.sender, email: m.sender, nickname: m.sender, joinTime: 0 }} 
                    size="sm" 
                  />
                </div>
              )}
              
              <div
                className={`rounded-lg px-4 py-2 max-w-[70%] min-w-0 relative ${
                  m.sender === myEmail  
                    ? "bg-accent text-accentFore"
                    : "bg-panelAlt text-fg border border-border"
                }`}
              >
                {/* Quick reactions positioned absolutely on hover */}
                <div className={`absolute ${m.sender === myEmail ? 'right-full mr-2' : 'left-full ml-2'} top-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none group-hover:pointer-events-auto`}>
                  <QuickReactions
                    onReact={(emoji) => handleReaction(m.id, emoji)}
                    messageId={m.id}
                    existingReactions={m.reactions}
                    currentUserId={user.id}
                  />
                </div>
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
                    
                    {/* Display file attachment if present */}
                    {m.file && m.file.fileName && m.file.fileType ? (
                      <FileMessage 
                        fileName={m.file.fileName}
                        fileSize={m.file.fileSize || 0}
                        fileType={m.file.fileType}
                        fileUrl={m.file.fileUrl}
                        isImage={m.file.fileType.startsWith('image/')}
                      />
                    ) : (
                      <MessageContent text={m.text} />
                    )}
                    
                    {m.edited && <div className="text-xs opacity-70 mt-1">edited</div>}
                    
                    {/* Enhanced Reaction System */}
                    <ReactionBar
                      reactions={m.reactions || {}}
                      users={users}
                      currentUserId={user.id}
                      onToggleReaction={(emoji) => handleReaction(m.id, emoji)}
                      onShowEmojiPicker={() => setShowEmojiPicker(showEmojiPicker === m.id ? null : m.id)}
                      showEmojiPicker={showEmojiPicker === m.id}
                      onCloseEmojiPicker={() => setShowEmojiPicker(null)}
                    />
                    
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

        {/* File upload panel */}
        {showFileUpload && (
          <div className="p-4 bg-panel border-t border-border">
            <div className="mb-4 p-4 border border-border rounded-lg bg-panelAlt">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-medium text-fg">
                  Share a file
                </h3>
                <button
                  onClick={() => setShowFileUpload(false)}
                  className="text-fg/60 hover:text-fg"
                >
                  ✕
                </button>
              </div>
              <FileUpload 
                onFileSelect={handleFileUpload} 
                onClose={() => setShowFileUpload(false)}
                isUploading={isUploadingFile}
              />
            </div>
          </div>
        )}

        <form onSubmit={send} className="p-4 bg-panel border-t border-border flex gap-3">
          {/* File upload button */}
          <button
            type="button"
            onClick={() => setShowFileUpload(!showFileUpload)}
            disabled={isUploadingFile}
            className={`p-2 rounded-full transition-colors ${
              showFileUpload 
                ? 'bg-accent text-accentFore' 
                : 'bg-panelAlt text-fg/60 hover:text-accent border border-border'
            } ${isUploadingFile ? 'opacity-50 cursor-not-allowed' : ''}`}
            title="Share file"
          >
            <span className="text-lg font-bold">+</span>
          </button>

          <input
            ref={inputRef}
            className="flex-1 border border-border rounded px-3 py-2 bg-panelAlt text-fg placeholder:text-fg/60 disabled:opacity-50"
            value={input}
            onChange={handleInputChange}
            placeholder={isUploadingFile ? "Uploading file..." : "Type your message…"}
            maxLength={500}
            disabled={isUploadingFile}
          />
          <button 
            type="submit" 
            className="bg-accent text-accentFore px-4 py-2 rounded disabled:opacity-50"
            disabled={!input.trim() || isUploadingFile}
          >
            Send
          </button>
        </form>
      </section>
    </>
  );
};

export default ChatApp;