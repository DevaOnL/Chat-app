import express from "express";
import http from "http";
import { Server, Socket } from "socket.io";
import path from "path";
import { fileURLToPath } from "url";
import { v4 as uuidv4 } from "uuid";
import rateLimit from "express-rate-limit";
import authRoutes from "./auth.js";

// ESM workaround for __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.NODE_ENV === "production" 
      ? ["https://yourdomain.com"] 
      : ["http://localhost:5173", "http://localhost:3000"],
    methods: ["GET", "POST"]
  }
});

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});

app.use(limiter);

// Message rate limiting per socket
const messageLimiter = new Map<string, { count: number; resetTime: number }>();

interface User {
  id: string;
  email: string;                                         
  nickname: string;    
  joinTime: number;
  lastSeen: number;
  isTyping?: boolean;
}

interface ChatMessage {
  id: string;
  text: string;
  sender: string;
  timestamp: number;
  edited?: boolean;
}

interface PrivateMessage {
  id: string;
  from: string;
  to: string;
  message: string;
  timestamp: number;
  read?: boolean;
}

const users = new Map<string, User>(); // socket.id -> User
 const emailToSocketId = new Map<string, string>(); // email -> socket.id 
const publicMessages: ChatMessage[] = [];
const privateMessages: PrivateMessage[] = [];
const maxMessageHistory = 100;

// Utility functions
// function generateUserCode(): string {
//   let code;
//   do {
//     code = uuidv4().slice(0, 6).toUpperCase();
//   } while (codeToSocketId.has(code));
//   return code;
// }

function sanitizeMessage(message: string): string {
  return message.trim().slice(0, 500); // Limit message length
}

function isRateLimited(socketId: string): boolean {
  const now = Date.now();
  const userLimit = messageLimiter.get(socketId);
  
  if (!userLimit || now > userLimit.resetTime) {
    messageLimiter.set(socketId, { count: 1, resetTime: now + 60000 }); // 1 minute window
    return false;
  }
  
  if (userLimit.count >= 30) { // 30 messages per minute
    return true;
  }
  
  userLimit.count++;
  return false;
}

function broadcastUserList() {
  const userList = Array.from(users.values()).map(user => ({
    id: user.id,
    email: user.email,  
    nickname: user.nickname,
    isTyping: user.isTyping,
    joinTime: user.joinTime
  }));
  io.emit("users update", userList);
}

function broadcastTypingStatus(socketId: string, isTyping: boolean, thread: string) {
  const user = users.get(socketId);
  if (user) {
    user.isTyping = isTyping;
    user.lastSeen = Date.now();
    
    if (thread === "public") {
       io.emit("typing status", { email: user.email, isTyping, thread });
    } else {
      // For DMs, send to the specific user
      const targetSocketId = emailToSocketId.get(thread);
      if (targetSocketId) {
        io.to(targetSocketId).emit("typing status", { email: user.email, isTyping, thread: user.email });   
      }
    }
  }
}

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, "../../frontend/dist")));

// Authentication routes
app.use("/api/auth", authRoutes);

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({ 
    status: "ok", 
    users: users.size,
    uptime: process.uptime()
  });
});

// Socket.IO connection handling
io.on("connection", (socket: Socket) => {
  const { email, nickname, id } = socket.handshake.query; if (typeof id !== 'string' || typeof email !== 'string' || typeof nickname !== 'string') {                                                                                 
    socket.disconnect();                                                                    
    return;                                                                                 
  }  
  const user: User = {
    id, 
    email,
    nickname,  
    joinTime: Date.now(),
    lastSeen: Date.now()
  };

  users.set(socket.id, user);
emailToSocketId.set(email, socket.id); 
  // Send initial data

  socket.emit("message history", publicMessages.slice(-50)); // Send last 50 messages
  broadcastUserList();

 console.log(`User connected: ${nickname} (${email})`);

  // Handle user disconnect
  socket.on("disconnect", () => {
    const user = users.get(socket.id);
    if (user) {
      emailToSocketId.delete(user.email); 
      users.delete(socket.id);
      messageLimiter.delete(socket.id);
      broadcastUserList();
      console.log(`User disconnected: ${user.nickname} (${user.email})`);  
    }
  });

  // Handle nickname setting
  socket.on("set nickname", (nickname: string) => {
    const user = users.get(socket.id);
    if (user && nickname.trim().length > 0) {
      user.nickname = sanitizeMessage(nickname).slice(0, 20);
      broadcastUserList();
    }
  });

  // Handle public chat messages
  socket.on("chat message", (msg: string) => {
    if (isRateLimited(socket.id)) {
      socket.emit("error", "Rate limit exceeded. Please slow down.");
      return;
    }

    const user = users.get(socket.id);
    if (!user) return;

    const sanitized = sanitizeMessage(msg);
    if (!sanitized) return;

    const message: ChatMessage = {
      id: uuidv4(),
      text: sanitized,
      sender: user.email,       
      timestamp: Date.now()
    };

    publicMessages.push(message);
    
    // Keep only recent messages
    if (publicMessages.length > maxMessageHistory) {
      publicMessages.shift();
    }

    io.emit("chat message", message);
    user.lastSeen = Date.now();
  });

  // Handle private messages
  socket.on("private message", ({ toEmail, message }) => {   
    if (isRateLimited(socket.id)) {
      socket.emit("error", "Rate limit exceeded. Please slow down.");
      return;
    }

    const user = users.get(socket.id);
    const targetSocketId = emailToSocketId.get(toEmail);      
    
    if (!user || !targetSocketId) {
      socket.emit("error", "User not found");
      return;
    }

    const sanitized = sanitizeMessage(message);
    if (!sanitized) return;

    const privateMsg: PrivateMessage = {
      id: uuidv4(),
      from: user.email,
      to: toEmail,  
      message: sanitized,
      timestamp: Date.now()
    };

    privateMessages.push(privateMsg);
    
    // Keep only recent private messages
    if (privateMessages.length > maxMessageHistory * 2) {
      privateMessages.shift();
    }

    io.to(targetSocketId).emit("private message", privateMsg);
    socket.emit("private message", privateMsg);
    user.lastSeen = Date.now();
  });

  // Handle typing indicators
  socket.on("typing", ({ isTyping, thread }) => {
    broadcastTypingStatus(socket.id, isTyping, thread);
  });

  socket.on("edit message", ({ messageId, newText, isPrivate }) => {
    const user = users.get(socket.id);
    if (!user) return;

    if (isPrivate) {
      const message = privateMessages.find(m => m.id === messageId && m.from === user.email);
      if (message) {
        message.message = sanitizeMessage(newText);
        (message as any).edited = true;

        const editedMsgForFrontend = {
          id: message.id,
          text: message.message,
          sender: message.from,
          timestamp: message.timestamp,
          edited: true,
        };

        const targetSocketId = emailToSocketId.get(message.to);
        if (targetSocketId) {
          io.to(targetSocketId).emit("message edited", editedMsgForFrontend);
        }
        socket.emit("message edited", editedMsgForFrontend);
      }
    } else {
      const message = publicMessages.find(m => m.id === messageId && m.sender === user.email);
      if (message) {
        message.text = sanitizeMessage(newText);
        message.edited = true;
        io.emit("message edited", message);
      }
    }
  });

  // Handle message deletion (for public messages)
  socket.on("delete message", (messageId: string) => {
    const user = users.get(socket.id);
    if (!user) return;

    const messageIndex = publicMessages.findIndex(m => m.id === messageId && m.sender === user.email);
    if (messageIndex !== -1) {
      publicMessages.splice(messageIndex, 1);
      io.emit("message deleted", messageId);
    }
  });

  // Handle user activity updates
  socket.on("user activity", () => {
    const user = users.get(socket.id);
    if (user) {
      user.lastSeen = Date.now();
    }
  });
});

// Cleanup inactive users periodically
setInterval(() => {
  const now = Date.now();
  const fiveMinutesAgo = now - 5 * 60 * 1000;
  
  for (const [socketId, user] of users.entries()) {
    if (user.lastSeen < fiveMinutesAgo) {
      const socket = io.sockets.sockets.get(socketId);
      if (socket) {
        socket.disconnect();
      }
    }
  }
}, 60000); // Check every minute

// Serve frontend
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "../../frontend/dist/index.html"));
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`✅ Server running at http://localhost:${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});