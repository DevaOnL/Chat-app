import express from "express";
import http from "http";
import { Server, Socket } from "socket.io";
import path from "path";
import { fileURLToPath } from "url";
import { v4 as uuidv4 } from "uuid";
import rateLimit from "express-rate-limit";
import dotenv from "dotenv";
import multer from "multer";
import fs from "fs";
import { connectDB } from "./config/database.js";
import { UserService } from "./services/UserService.js";
import { MessageService } from "./services/MessageService.js";
import authRoutes from "./auth.js";
import { authenticateToken, AuthRequest } from "./middleware.js";

// Load environment variables
dotenv.config();

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
  reactions?: {
    [emoji: string]: string[]; // Array of user IDs who reacted
  };
}

interface PrivateMessage {
  id: string;
  from: string;
  to: string;
  message: string;
  timestamp: number;
  read?: boolean;
  reactions?: {
    [emoji: string]: string[]; // Array of user IDs who reacted
  };
}

const users = new Map<string, User>(); // socket.id -> User  
const emailToSocketId = new Map<string, string>(); // email -> socket.id 
// Note: Messages are now stored in MongoDB, not in memory
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

// File upload configuration
const uploadsDir = path.join(__dirname, "../../uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const extension = path.extname(file.originalname);
    cb(null, `${uniqueSuffix}${extension}`);
  }
});

const upload = multer({ 
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    // Allow all file types for now
    cb(null, true);
  }
});

// Serve uploaded files
app.use("/uploads", express.static(uploadsDir));

// File upload endpoint
app.post("/api/upload", authenticateToken, upload.single('file'), async (req: AuthRequest, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const fileUrl = `/uploads/${req.file.filename}`;
    
    res.json({
      fileName: req.file.originalname,
      fileSize: req.file.size,
      fileType: req.file.mimetype,
      fileUrl: fileUrl
    });
  } catch (error) {
    console.error('File upload error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({ 
    status: "ok", 
    users: users.size,
    uptime: process.uptime()
  });
});

// Socket.IO connection handling
io.on("connection", async (socket: Socket) => {
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

  // Send recent public messages from database
  try {
    const recentMessages = await MessageService.getMessagesByThread("public", 50);
    console.log(`📩 Loading ${recentMessages.length} messages from MongoDB for user: ${email}`);
    
    // Transform messages to frontend format
    const transformedMessages = recentMessages.map(msg => {
      const transformedMsg: any = {
        id: (msg._id as string).toString(),
        text: msg.text,
        sender: msg.sender,
        timestamp: msg.createdAt.getTime(),
        edited: msg.edited || false,
        reactions: Object.fromEntries(msg.reactions || new Map())
      };
      
      // Add file data if present
      if (msg.file) {
        transformedMsg.file = msg.file;
      }
      
      return transformedMsg;
    });
    
    socket.emit("message history", transformedMessages);
  } catch (error) {
    console.error("❌ Error fetching message history:", error);
    socket.emit("message history", []);
  }
  
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
  socket.on("chat message", async (msg: string, fileData?: any) => {
    if (isRateLimited(socket.id)) {
      socket.emit("error", "Rate limit exceeded. Please slow down.");
      return;
    }

    const user = users.get(socket.id);
    if (!user) return;

    const sanitized = sanitizeMessage(msg);
    if (!sanitized) return;

    try {
      // Save message to database
      const messageData: any = {
        text: sanitized,
        sender: user.email,
        thread: "public"
      };

      // Add file data if present
      if (fileData) {
        messageData.file = fileData;
      }

      const message = await MessageService.createMessage(messageData);

      console.log(`💾 Saved message to MongoDB: "${sanitized}" from ${user.email}${fileData ? ' with file' : ''}`);

      // Broadcast to all connected clients
      const messageToSend: any = {
        id: (message._id as string).toString(),
        text: message.text,
        sender: message.sender,
        timestamp: message.createdAt.getTime()
      };

      // Add file data if present
      if (message.file) {
        messageToSend.file = message.file;
      }

      io.emit("chat message", messageToSend);
      
      user.lastSeen = Date.now();
    } catch (error) {
      console.error("Error saving message:", error);
      socket.emit("error", "Failed to send message");
    }
  });

  // Handle private messages
  socket.on("private message", async ({ toEmail, message, file }) => {   
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

    try {
      // Save private message to database
      const messageData: any = {
        text: sanitized,
        sender: user.email,
        thread: toEmail // Use recipient email as thread for private messages
      };

      // Add file data if present
      if (file) {
        messageData.file = file;
      }

      const savedMessage = await MessageService.createMessage(messageData);

      const privateMsg: any = {
        id: (savedMessage._id as string).toString(),
        from: user.email,
        to: toEmail,  
        message: sanitized,
        timestamp: savedMessage.createdAt.getTime()
      };

      // Add file data if present
      if (savedMessage.file) {
        privateMsg.file = savedMessage.file;
      }

      console.log(`💾 Saved private message to MongoDB from ${user.email} to ${toEmail}${file ? ' with file' : ''}`);

      io.to(targetSocketId).emit("private message", privateMsg);
      socket.emit("private message", privateMsg);
      user.lastSeen = Date.now();
    } catch (error) {
      console.error("Error saving private message:", error);
      socket.emit("error", "Failed to send private message");
    }
    user.lastSeen = Date.now();
  });

  // Handle typing indicators
  socket.on("typing", ({ isTyping, thread }) => {
    broadcastTypingStatus(socket.id, isTyping, thread);
  });

  socket.on("edit message", async ({ messageId, newText, isPrivate }) => {
    try {
      const user = users.get(socket.id);
      if (!user) {
        console.log('Edit failed: User not found');
        return;
      }

      const sanitizedText = sanitizeMessage(newText);
      console.log(`Attempting to edit message ${messageId} by user ${user.email}`);
      
      // Update message in database
      const updatedMessage = await MessageService.updateMessage(messageId, sanitizedText, user.email);
      
      if (!updatedMessage) {
        console.log(`Edit failed: Message ${messageId} not found or no permission`);
        socket.emit("error", "Message not found or you don't have permission to edit it");
        return;
      }

      console.log(`✅ Successfully edited message ${messageId}`);

      // Create message object for frontend
      const editedMsgForFrontend = {
        id: (updatedMessage._id as string).toString(),
        text: updatedMessage.text,
        sender: updatedMessage.sender,
        timestamp: updatedMessage.createdAt,
        edited: true,
        reactions: Object.fromEntries(updatedMessage.reactions || new Map())
      };

      if (isPrivate) {
        // For private messages, send to both sender and recipient
        const recipientSocketId = emailToSocketId.get(updatedMessage.thread);
        if (recipientSocketId) {
          io.to(recipientSocketId).emit("message edited", editedMsgForFrontend);
        }
        socket.emit("message edited", editedMsgForFrontend);
      } else {
        // For public messages, broadcast to all
        io.emit("message edited", editedMsgForFrontend);
      }
    } catch (error) {
      console.error('Error editing message:', error);
      socket.emit("error", "Failed to edit message");
    }
  });

  // Handle message deletion
  socket.on("delete message", async (messageId: string) => {
    try {
      const user = users.get(socket.id);
      if (!user) {
        console.log('Delete failed: User not found');
        return;
      }

      console.log(`Attempting to delete message ${messageId} by user ${user.email}`);

      // Delete message from database
      const wasDeleted = await MessageService.deleteMessage(messageId, user.email);
      
      if (!wasDeleted) {
        console.log(`Delete failed: Message ${messageId} not found or no permission`);
        socket.emit("error", "Message not found or you don't have permission to delete it");
        return;
      }

      console.log(`✅ Successfully deleted message ${messageId}`);

      // Broadcast deletion to all connected users
      // For both public and private messages, we broadcast to everyone
      // The frontend will filter based on which messages they can see
      io.emit("message deleted", messageId);
    } catch (error) {
      console.error('Error deleting message:', error);
      socket.emit("error", "Failed to delete message");
    }
  });

  // Handle user activity updates
  socket.on("user activity", () => {
    const user = users.get(socket.id);
    if (user) {
      user.lastSeen = Date.now();
    }
  });

  // Handle message reactions
  socket.on("toggle reaction", async ({ messageId, emoji, userId, isPrivate }) => {
    try {
      console.log(`Reaction received - MessageId: ${messageId}, Emoji: ${emoji}, UserId: ${userId}, IsPrivate: ${isPrivate}`);
      
      const user = users.get(socket.id);
      if (!user || user.id !== userId) {
        console.log(`User validation failed - Socket user: ${user?.id}, Provided userId: ${userId}`);
        socket.emit("error", "Invalid user for reaction");
        return;
      }

      // Check if user is trying to react to their own message
      const existingMessage = await MessageService.findMessageById(messageId);
      if (!existingMessage) {
        console.log(`Message not found for reaction: ${messageId}`);
        socket.emit("error", "Message not found");
        return;
      }

      // Get user email for reaction (using email instead of userId for consistency)
      const userEmail = user.email;

      // Toggle reaction (add if not present, remove if present)
      const updatedMessage = await MessageService.toggleReaction(messageId, emoji, userEmail);

      if (!updatedMessage) {
        socket.emit("error", "Failed to update reaction");
        return;
      }

      console.log(`✅ Successfully toggled reaction ${emoji} on message ${messageId}`);

      // Create reaction update object for frontend
      const reactionUpdate = { 
        messageId, 
        reactions: Object.fromEntries(updatedMessage.reactions || new Map())
      };

      if (isPrivate) {
        // For private messages, send to both users in the conversation
        const recipientEmail = updatedMessage.thread; // thread contains recipient email for private messages
        const recipientSocketId = emailToSocketId.get(recipientEmail);
        
        socket.emit("reaction updated", reactionUpdate);
        if (recipientSocketId) {
          io.to(recipientSocketId).emit("reaction updated", reactionUpdate);
        }
      } else {
        // For public messages, broadcast to all users
        console.log(`Broadcasting reaction update:`, reactionUpdate);
        io.emit("reaction updated", reactionUpdate);
      }
    } catch (error) {
      console.error('Error handling reaction:', error);
      socket.emit("error", "Failed to process reaction");
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

// Connect to MongoDB and start server
const startServer = async () => {
  try {
    // Connect to MongoDB Atlas
    await connectDB();
    
    // Start the server
    server.listen(PORT, () => {
      console.log(`✅ Server running at http://localhost:${PORT}`);
      console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`Database: Connected to MongoDB Atlas`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

// Start the server
startServer();