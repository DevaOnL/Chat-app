import React, { useEffect, useRef, useState, useCallback, forwardRef, useImperativeHandle } from "react";
import { io, Socket } from "socket.io-client";
import Avatar from "./Avatar";
import GroupAvatar from "./GroupAvatar";
import FileUpload from "./FileUpload";
import FileMessage from "./FileMessage";
import { ReactionBar, QuickReactions } from "./EnhancedReactions";
import GroupCreationModal from "./GroupCreationModal";
import GroupSettingsModal from "./GroupSettingsModal";

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
  groupId?: string; // For group messages
}

interface User {
  id: string;
  email: string;
  nickname: string; 
  avatar?: string;
  isTyping?: boolean;
  joinTime: number;
}

interface Group {
  _id: string;
  name: string;
  description?: string;
  members: string[];
  admins: string[];
  creator: string;
  avatar?: string;
  isPrivate: boolean;
  createdAt: string;
  updatedAt: string;
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

export interface ChatAppRef {
  emitProfileUpdate: (userId: string, nickname: string, avatar?: string) => void;
}

const ChatApp = forwardRef<ChatAppRef, Props>(({ user, highlightMessageId, onMessageHighlighted }, ref) => {
  const socketRef = useRef<Socket | null>(null);
   const myEmail = user.email;  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const shouldAutoScrollRef = useRef(true);

  /* ──────────────────────────────── state */
  const [users, setUsers] = useState<User[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [threads, setThreads] = useState<Record<string, Message[]>>({ public: [] });
  const [selected, setSelected] = useState("public");
  const [selectedType, setSelectedType] = useState<'public' | 'user' | 'group'>('public');
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [typingUsers, setTypingUsers] = useState<Record<string, string[]>>({ public: [] });
  const [groupTypingUsers, setGroupTypingUsers] = useState<Record<string, Record<string, boolean>>>({});
  const [connectionStatus, setConnectionStatus] = useState<"connecting" | "connected" | "disconnected">("connecting");
  const [editingMessage, setEditingMessage] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [showEmojiPicker, setShowEmojiPicker] = useState<string | null>(null); // messageId for which picker is shown
  const [showFileUpload, setShowFileUpload] = useState(false);
  const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null);
  const [isUploadingFile, setIsUploadingFile] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMoreMessages, setHasMoreMessages] = useState(true);
  const [showGroupCreationModal, setShowGroupCreationModal] = useState(false);
  const [showGroupSettingsModal, setShowGroupSettingsModal] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);

  /* ──────────────────────────────── helpers */
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  const fetchGroups = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/groups', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const result = await response.json();
        setGroups(result.data);
      }
    } catch (error) {
      console.error('Error fetching groups:', error);
    }
  }, []);

  const getSelectedInfo = useCallback(() => {
    if (selected === 'public') {
      return { type: 'public' as const, name: 'Public Chat' };
    }
    
    const group = groups.find(g => g._id === selected);
    if (group) {
      return { type: 'group' as const, name: group.name, group };
    }
    
    const user = users.find(u => u.email === selected);
    if (user) {
      return { type: 'user' as const, name: user.nickname || user.email, user };
    }
    
    return { type: 'user' as const, name: selected };
  }, [selected, groups, users]);

  const loadMoreMessages = useCallback(async () => {
    if (isLoadingMore || !hasMoreMessages) return;
    
    setIsLoadingMore(true);
    
    try {
      const currentMessages = threads[selected] || [];
      if (currentMessages.length === 0) {
        setIsLoadingMore(false);
        return;
      }
      
      // Get the oldest message timestamp as beforeDate
      const oldestMessage = currentMessages[0];
      const beforeDate = new Date(oldestMessage.timestamp).toISOString();
      
      const token = localStorage.getItem('token');
      const response = await fetch(
        `/api/messages/history?thread=${selected}&beforeDate=${beforeDate}&limit=50`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );
      
      if (!response.ok) {
        throw new Error('Failed to load more messages');
      }
      
      const data = await response.json();
      const olderMessages = data.data.messages;
      const hasMore = data.data.hasMore;
      
      if (olderMessages.length > 0) {
        // Preserve scroll position
        const container = messagesContainerRef.current;
        const scrollHeightBefore = container?.scrollHeight || 0;
        
        // Add older messages to the beginning
        setThreads(prev => ({
          ...prev,
          [selected]: [...olderMessages, ...prev[selected]]
        }));
        
        // Restore scroll position after render
        setTimeout(() => {
          if (container) {
            const scrollHeightAfter = container.scrollHeight;
            const scrollDiff = scrollHeightAfter - scrollHeightBefore;
            container.scrollTop = container.scrollTop + scrollDiff;
          }
        }, 50);
      }
      
      setHasMoreMessages(hasMore);
    } catch (error) {
      console.error('Error loading more messages:', error);
      // No user alert needed for infinite scroll - loading happens automatically
    } finally {
      setIsLoadingMore(false);
    }
  }, [isLoadingMore, hasMoreMessages, threads, selected]);

  const isNearBottom = useCallback(() => {
    const container = messagesContainerRef.current;
    if (!container) return true;
    
    const threshold = 100; // pixels from bottom
    const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
    return distanceFromBottom <= threshold;
  }, []);

  const handleScroll = useCallback(() => {
    shouldAutoScrollRef.current = isNearBottom();
    
    // Check if user scrolled to the top and load more messages
    const container = messagesContainerRef.current;
    if (container && selected === "public" && hasMoreMessages && !isLoadingMore) {
      const threshold = 100; // pixels from top
      if (container.scrollTop <= threshold) {
        loadMoreMessages();
      }
    }
  }, [isNearBottom, selected, hasMoreMessages, isLoadingMore, loadMoreMessages]);

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
    const selectedInfo = getSelectedInfo();
    const isPrivate = selectedInfo.type === 'user';
    const isGroup = selectedInfo.type === 'group';
    
    console.log(`Sending reaction - MessageId: ${messageId}, Emoji: ${emoji}, UserId: ${user.id}, IsPrivate: ${isPrivate}, IsGroup: ${isGroup}`);
    socketRef.current?.emit("toggle reaction", { 
      messageId, 
      emoji, 
      userId: user.id,
      isPrivate: isPrivate
    });
    // Close emoji picker after selecting
    setShowEmojiPicker(null);
  }, [user.id, getSelectedInfo]);

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

  // Function to emit profile updates via socket
  const emitProfileUpdate = useCallback((userId: string, nickname: string, avatar?: string) => {
    const socket = socketRef.current;
    if (socket) {
      socket.emit('profile updated', {
        userId,
        nickname,
        avatar
      });
    } else {
      console.error('❌ ChatApp: Socket is not connected!');
    }
  }, []);

  // Expose methods to parent component
  useImperativeHandle(ref, () => ({
    emitProfileUpdate
  }), [emitProfileUpdate]);

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
      // Filter out current user and deduplicate by user ID
      const filteredUsers = userList.filter(u => u.email !== myEmail);
      const uniqueUsers = filteredUsers.filter((user, index, arr) => 
        arr.findIndex(u => u.id === user.id) === index
      );
      
      if (uniqueUsers.length !== filteredUsers.length) {
        console.warn(`⚠️ Removed ${filteredUsers.length - uniqueUsers.length} duplicate users from list`);
      }
      
      setUsers(uniqueUsers);  
    });

    socket.on("user profile updated", ({ userId, nickname, avatar, email }) => {
      // Don't update our own user data from socket events to prevent loops
      if (email === user.email) {
        console.log("⏩ Skipping self profile update to prevent loops");
        return;
      }
      
      // Update the user in the users list by email (since messages use email as sender)
      setUsers(prevUsers => {
        const updatedUsers = prevUsers.map(u => 
          u.email === email 
            ? { ...u, nickname, avatar }
            : u
        );
        
        // Check if we actually found and updated a user
        const updatedUser = updatedUsers.find(u => u.email === email);
        if (!updatedUser) {
          console.warn(`❌ User with email ${email} not found in users list`);
        }
        
        return updatedUsers;
      });
    });

    socket.on("message history", (messages: Message[]) => {
      setThreads(prev => ({ ...prev, public: messages }));
      // Reset pagination state when receiving initial messages
      setHasMoreMessages(messages.length >= 50); // Assume more if we got a full batch
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
      console.error('❌ Socket error:', error);
      alert(error); // Replace with proper notification system
    });

    socket.on("reaction updated", ({ messageId, reactions }) => {
      updateMessageReactions(messageId, reactions);
    });

    // Group-specific socket events
    socket.on("group message", (message: Message) => {
      if (message.groupId) {
        addMsg(message.groupId, message);
      }
    });

    socket.on("group message history", ({ groupId, messages }: { groupId: string, messages: Message[] }) => {
      setThreads(prev => ({ ...prev, [groupId]: messages }));
      // Reset pagination state when receiving initial messages
      setHasMoreMessages(messages.length >= 50);
    });

    socket.on("group typing status", ({ groupId, email, isTyping }: { groupId: string, email: string, isTyping: boolean }) => {
      setGroupTypingUsers(prev => ({
        ...prev,
        [groupId]: {
          ...prev[groupId],
          [email]: isTyping
        }
      }));
    });

    socket.on("group created", ({ group }: { group: Group }) => {
      setGroups(prev => [...prev, group]);
    });

    socket.on("group updated", ({ groupId, updates }: { groupId: string, updates: Partial<Group> }) => {
      setGroups(prev => prev.map(g => 
        g._id === groupId ? { ...g, ...updates } : g
      ));
    });

    socket.on("member added", ({ groupId, memberEmail }: { groupId: string, memberEmail: string }) => {
      setGroups(prev => prev.map(g => 
        g._id === groupId ? { ...g, members: [...g.members, memberEmail] } : g
      ));
    });

    socket.on("member removed", ({ groupId, memberEmail }: { groupId: string, memberEmail: string }) => {
      setGroups(prev => prev.map(g => 
        g._id === groupId ? { 
          ...g, 
          members: g.members.filter(email => email !== memberEmail),
          admins: g.admins.filter(email => email !== memberEmail)
        } : g
      ));
    });

    socket.on("group deleted", ({ groupId }: { groupId: string }) => {
      setGroups(prev => prev.filter(g => g._id !== groupId));
      // Switch to public if currently viewing deleted group
      if (selected === groupId) {
        setSelected("public");
        setSelectedType("public");
      }
    });

    socket.on("user joined group", ({ groupId, userEmail }: { groupId: string, userEmail: string }) => {
      console.log(`User ${userEmail} joined group ${groupId}`);
    });

    socket.on("user left group", ({ groupId, userEmail }: { groupId: string, userEmail: string }) => {
      console.log(`User ${userEmail} left group ${groupId}`);
    });

    return () => {
      socket.disconnect();
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, [addMsg, updateMsg, deleteMsg, updateMessageReactions]);

  /* Fetch groups on mount */
  useEffect(() => {
    fetchGroups();
  }, [fetchGroups]);

  /* auto-scroll */
  useEffect(() => {
    // Always auto-scroll when switching threads
    shouldAutoScrollRef.current = true;
    scrollToBottom();
    
    // Reset pagination state when switching threads
    if (selected === "public") {
      setHasMoreMessages(true); // Reset to allow loading more for public chat
    } else {
      setHasMoreMessages(false); // Disable for private chats for now
    }
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

    const selectedInfo = getSelectedInfo();
    
    if (selectedInfo.type === 'public') {
      socket.emit("chat message", input);
    } else if (selectedInfo.type === 'group') {
      socket.emit("group message", { groupId: selected, message: input });
    } else if (selectedInfo.type === 'user' && selected !== myEmail) {     
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
      const selectedInfo = getSelectedInfo();
      const isPrivate = selectedInfo.type === 'user';
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

      const selectedInfo = getSelectedInfo();
      
      if (selectedInfo.type === 'public') {
        socketRef.current?.emit("chat message", fileMessage.text, fileMessage.file);
      } else if (selectedInfo.type === 'group') {
        socketRef.current?.emit("group message", { 
          groupId: selected, 
          message: fileMessage.text,
          file: fileMessage.file
        });
      } else if (selectedInfo.type === 'user') {
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

  // Group handlers
  const handleGroupCreated = (group: Group) => {
    setGroups(prev => [...prev, group]);
    // Emit group created event to notify other users
    socketRef.current?.emit("group created", { groupId: group._id });
  };

  const handleGroupUpdated = (updatedGroup: Group) => {
    setGroups(prev => prev.map(g => g._id === updatedGroup._id ? updatedGroup : g));
    // Update selected group if it's the one being updated
    if (selectedGroup && selectedGroup._id === updatedGroup._id) {
      setSelectedGroup(updatedGroup);
    }
    // Emit group updated event
    socketRef.current?.emit("group updated", { 
      groupId: updatedGroup._id, 
      updates: updatedGroup 
    });
  };

  const handleGroupDeleted = (groupId: string) => {
    setGroups(prev => prev.filter(g => g._id !== groupId));
    // Switch to public if deleted group was selected
    if (selected === groupId) {
      setSelected("public");
      setSelectedType("public");
    }
    setSelectedGroup(null);
    setShowGroupSettingsModal(false);
    // Emit group deleted event
    socketRef.current?.emit("group deleted", { groupId });
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
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-semibold">Conversations</h2>
            <button
              onClick={() => setShowGroupCreationModal(true)}
              className="text-accent hover:text-accentFore text-sm p-1 rounded hover:bg-panelAlt transition-colors"
              title="Create Group"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </button>
          </div>
        </div>
        
        <div className="overflow-y-auto">
          {/* Public Chat */}
          <div className="px-4 py-2 text-xs font-medium text-muted uppercase tracking-wider">
            Public
          </div>
          <ul>
            <li
              className={`px-4 py-2 cursor-pointer hover:bg-panelAlt font-semibold ${
                selected === "public" && "bg-panelAlt"
              }`}
              onClick={() => {
                setSelected("public");
                setSelectedType("public");
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
          </ul>

          {/* Groups */}
          {groups.length > 0 && (
            <>
              <div className="px-4 py-2 text-xs font-medium text-muted uppercase tracking-wider mt-4">
                Groups ({groups.length})
              </div>
              <ul>
                {groups.map(group => {
                  const groupTyping = groupTypingUsers[group._id];
                  const typingCount = groupTyping ? Object.values(groupTyping).filter(Boolean).length : 0;
                  
                  return (
                    <li
                      key={group._id}
                      className={`px-4 py-2 cursor-pointer hover:bg-panelAlt ${
                        selected === group._id && "bg-panelAlt"
                      }`}
                      onClick={() => {
                        setSelected(group._id);
                        setSelectedType("group");
                        setSelectedGroup(group);
                        setShowEmojiPicker(null);
                        // Join group room for real-time updates
                        socketRef.current?.emit("join group", group._id);
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <GroupAvatar group={group} size="sm" />
                          <div>
                            <div className="font-medium truncate">{group.name}</div>
                            <div className="text-xs text-muted">
                              {group.members.length} member{group.members.length !== 1 ? 's' : ''}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          {typingCount > 0 && (
                            <span className="text-xs text-accent">
                              {typingCount} typing...
                            </span>
                          )}
                          {group.admins.includes(user.email) && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedGroup(group);
                                setShowGroupSettingsModal(true);
                              }}
                              className="text-muted hover:text-fg p-1"
                              title="Group Settings"
                            >
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              </svg>
                            </button>
                          )}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </>
          )}

          {/* Direct Messages */}
          {users.length > 0 && (
            <>
              <div className="px-4 py-2 text-xs font-medium text-muted uppercase tracking-wider mt-4">
                Direct Messages ({users.length})
              </div>
              <ul>
                {users.map(user => (
                  <li
                    key={user.id}    
                    className={`px-4 py-2 cursor-pointer hover:bg-panelAlt ${
                     selected === user.email && "bg-panelAlt"        
                    }`}
                    onClick={() => {
                      setSelected(user.email);
                      setSelectedType("user");
                      setShowEmojiPicker(null);
                    }}          
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Avatar user={user} size="sm" />
                        <span className="truncate">{user.nickname || user.email}</span>
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
            </>
          )}
        </div>
      </aside>

      {/* chat area */}
      <section className="flex-1 flex flex-col">
        <div className="px-4 py-2 bg-header border-b border-border text-fg font-semibold">
          {(() => {
            const selectedInfo = getSelectedInfo();
            
            if (selectedInfo.type === 'public') {
              return "Public Chat";
            } else if (selectedInfo.type === 'group' && selectedInfo.group) {
              return (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <GroupAvatar group={selectedInfo.group} size="sm" />
                    <div>
                      <div>{selectedInfo.group.name}</div>
                      <div className="text-xs text-muted font-normal">
                        {selectedInfo.group.members.length} member{selectedInfo.group.members.length !== 1 ? 's' : ''}
                      </div>
                    </div>
                  </div>
                  {selectedInfo.group.admins.includes(user.email) && (
                    <button
                      onClick={() => {
                        setSelectedGroup(selectedInfo.group!);
                        setShowGroupSettingsModal(true);
                      }}
                      className="text-muted hover:text-fg p-2 hover:bg-panelAlt rounded transition-colors"
                      title="Group Settings"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    </button>
                  )}
                </div>
              );
            } else {
              return `Chat with ${selectedInfo.name}`;
            }
          })()}
        </div>

        <div 
          ref={messagesContainerRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto p-4 space-y-2 bg-panel"
        >
          {/* Loading indicator when loading more messages */}
          {selected === "public" && isLoadingMore && (
            <div className="flex justify-center py-2">
              <div className="flex items-center space-x-2 text-fg opacity-70">
                <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                <span>Loading older messages...</span>
              </div>
            </div>
          )}
          
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
                    user={(() => {
                      const foundUser = users.find(u => u.email === m.sender);
                      if (!foundUser) {
                        console.log(`⚠️ User not found in users list for message sender: ${m.sender}`);
                        return { id: m.sender, email: m.sender, nickname: m.sender, avatar: undefined, joinTime: 0 };
                      }
                      return foundUser;
                    })()} 
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

      {/* Group Creation Modal */}
      <GroupCreationModal
        isOpen={showGroupCreationModal}
        onClose={() => setShowGroupCreationModal(false)}
        onGroupCreated={handleGroupCreated}
        currentUser={user}
      />

      {/* Group Settings Modal */}
      {selectedGroup && (
        <GroupSettingsModal
          isOpen={showGroupSettingsModal}
          onClose={() => setShowGroupSettingsModal(false)}
          group={selectedGroup}
          currentUser={user}
          onGroupUpdated={handleGroupUpdated}
          onGroupDeleted={handleGroupDeleted}
        />
      )}
    </>
  );
});

export default ChatApp;