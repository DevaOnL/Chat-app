import express from "express";
import http from "http";
import { Server, Socket } from "socket.io";
import path from "path";
import { fileURLToPath } from "url";
import { v4 as uuidv4 } from "uuid";
import rateLimit from "express-rate-limit";

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
  code: string;
  nickname?: string;
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
const codeToSocketId = new Map<string, string>(); // code -> socket.id
const publicMessages: ChatMessage[] = [];
const privateMessages: PrivateMessage[] = [];
const maxMessageHistory = 100;

// Utility functions
function generateUserCode(): string {
  let code;
  do {
    code = uuidv4().slice(0, 6).toUpperCase();
  } while (codeToSocketId.has(code));
  return code;
}

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
    code: user.code,
    nickname: user.nickname,
    isTyping: user.isTyping,
    joinTime: user.joinTime
  }));
  io.emit("users update", userList);
}

function broadcastTypingStatus(socketId: string, isTyping: boolean) {
  const user = users.get(socketId);
  if (user) {
    user.isTyping = isTyping;
    user.lastSeen = Date.now();
    io.emit("typing status", { code: user.code, isTyping });
  }
}

// Middleware
app.use(express.static(path.join(__dirname, "../../frontend/dist")));
app.use(express.json());

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
  const userCode = generateUserCode();
  const user: User = {
    id: socket.id,
    code: userCode,
    joinTime: Date.now(),
    lastSeen: Date.now()
  };

  users.set(socket.id, user);
  codeToSocketId.set(userCode, socket.id);

  // Send initial data
  socket.emit("your code", userCode);
  socket.emit("message history", publicMessages.slice(-50)); // Send last 50 messages
  broadcastUserList();

  console.log(`User connected: ${userCode} (${socket.id})`);

  // Handle user disconnect
  socket.on("disconnect", () => {
    const user = users.get(socket.id);
    if (user) {
      codeToSocketId.delete(user.code);
      users.delete(socket.id);
      messageLimiter.delete(socket.id);
      broadcastUserList();
      console.log(`User disconnected: ${user.code}`);
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
      sender: user.code,
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
  socket.on("private message", ({ toCode, message }) => {
    if (isRateLimited(socket.id)) {
      socket.emit("error", "Rate limit exceeded. Please slow down.");
      return;
    }

    const user = users.get(socket.id);
    const targetSocketId = codeToSocketId.get(toCode);
    
    if (!user || !targetSocketId) {
      socket.emit("error", "User not found");
      return;
    }

    const sanitized = sanitizeMessage(message);
    if (!sanitized) return;

    const privateMsg: PrivateMessage = {
      id: uuidv4(),
      from: user.code,
      to: toCode,
      message: sanitized,
      timestamp: Date.now()
    };

    privateMessages.push(privateMsg);
    
    // Keep only recent private messages
    if (privateMessages.length > maxMessageHistory * 2) {
      privateMessages.shift();
    }

    io.to(targetSocketId).emit("private message", privateMsg);
    user.lastSeen = Date.now();
  });

  // Handle typing indicators
  socket.on("typing", (isTyping: boolean) => {
    broadcastTypingStatus(socket.id, isTyping);
  });

  // Handle message editing (for public messages)
  socket.on("edit message", ({ messageId, newText }) => {
    const user = users.get(socket.id);
    if (!user) return;

    const message = publicMessages.find(m => m.id === messageId && m.sender === user.code);
    if (message) {
      message.text = sanitizeMessage(newText);
      message.edited = true;
      io.emit("message edited", message);
    }
  });

  // Handle message deletion (for public messages)
  socket.on("delete message", (messageId: string) => {
    const user = users.get(socket.id);
    if (!user) return;

    const messageIndex = publicMessages.findIndex(m => m.id === messageId && m.sender === user.code);
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