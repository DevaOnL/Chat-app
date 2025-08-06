import express, { Request, Response, NextFunction } from "express";
import http from "http";
import { Server, Socket } from "socket.io";
import path from "path";
import { fileURLToPath } from "url";
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
  avatar?: string;
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
const userSessions = new Map<string, Set<string>>(); // email -> Set of socket.ids (for multiple tabs)
// Note: Messages are now stored in MongoDB, not in memory
const maxMessageHistory = 100;

// Utility functions
/**
 * Sanitizes user input by trimming whitespace and limiting length to prevent spam
 */
function sanitizeMessage(message: string): string {
  return message.trim().slice(0, 500);
}

/**
 * Rate limiting check for message sending to prevent spam
 * Allows 30 messages per minute per socket
 */
function isRateLimited(socketId: string): boolean {
  const now = Date.now();
  const userLimit = messageLimiter.get(socketId);
  
  if (!userLimit || now > userLimit.resetTime) {
    messageLimiter.set(socketId, { count: 1, resetTime: now + 60000 });
    return false;
  }
  
  if (userLimit.count >= 30) {
    return true;
  }
  
  userLimit.count++;
  return false;
}

async function broadcastUserList() {
  // Get unique users (deduplicate by both email AND user ID, using the most recent session)
  const uniqueUsersByEmail = new Map<string, User>();
  const uniqueUsersById = new Map<string, User>();
  
  for (const [socketId, user] of users.entries()) {
    // Deduplicate by email (existing logic)
    const existingUserByEmail = uniqueUsersByEmail.get(user.email);
    if (!existingUserByEmail || user.joinTime > existingUserByEmail.joinTime) {
      uniqueUsersByEmail.set(user.email, user);
    }
    
    // Also deduplicate by user ID
    const existingUserById = uniqueUsersById.get(user.id);
    if (!existingUserById || user.joinTime > existingUserById.joinTime) {
      uniqueUsersById.set(user.id, user);
    }
  }
  
  // Fetch fresh user data from database to ensure avatars are up to date
  const userList = [];
  for (const user of Array.from(uniqueUsersById.values())) {
    try {
      const dbUser = await UserService.findUserById(user.id);
      userList.push({
        id: user.id,
        email: user.email,  
        nickname: dbUser?.nickname || user.nickname,
        avatar: dbUser?.avatar, // Always use fresh avatar from database
        isTyping: user.isTyping,
        joinTime: user.joinTime
      });
    } catch (error) {
      console.error(`Error fetching user data for ${user.email}:`, error);
      // Fallback to in-memory data if database lookup fails
      userList.push({
        id: user.id,
        email: user.email,  
        nickname: user.nickname,
        avatar: user.avatar,
        isTyping: user.isTyping,
        joinTime: user.joinTime
      });
    }
  }
  
  // Broadcast unique user list to all clients
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
app.use(express.json({ limit: '10mb' })); // Increase limit for avatar uploads
app.use(express.urlencoded({ limit: '10mb', extended: true }));
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

// Search messages endpoint
app.get("/api/messages/search", (req: AuthRequest, res: Response, next: NextFunction) => {
  authenticateToken(req, res, next).catch(next);
}, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const {
      query,
      thread = 'public',
      sender,
      startDate,
      endDate,
      fileType,
      limit = 20,
      skip = 0
    } = req.query;

    const searchOptions = {
      query: query as string,
      thread: thread as string,
      sender: sender as string,
      startDate: startDate ? new Date(startDate as string) : undefined,
      endDate: endDate ? new Date(endDate as string) : undefined,
      fileType: fileType as string,
      limit: parseInt(limit as string, 10),
      skip: parseInt(skip as string, 10)
    };

    const results = await MessageService.searchMessages(searchOptions);
    
    res.json({
      success: true,
      data: results
    });
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ error: 'Search failed' });
  }
});

// Get message history with pagination
app.get("/api/messages/history", (req: AuthRequest, res: Response, next: NextFunction) => {
  authenticateToken(req, res, next).catch(next);
}, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const {
      thread = 'public',
      beforeDate,
      limit = 50
    } = req.query;

    const historyOptions = {
      thread: thread as string,
      beforeDate: beforeDate ? new Date(beforeDate as string) : undefined,
      limit: parseInt(limit as string, 10)
    };

    const results = await MessageService.getMessageHistory(historyOptions);
    
    res.json({
      success: true,
      data: results
    });
  } catch (error) {
    console.error('History error:', error);
    res.status(500).json({ error: 'Failed to load message history' });
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
  const { email, nickname, id } = socket.handshake.query; 
  if (typeof id !== 'string' || typeof email !== 'string' || typeof nickname !== 'string') {                                                                                 
    socket.disconnect();                                                                    
    return;                                                                                 
  }

  // Get user data from database to include avatar
  let userDbData;
  try {
    userDbData = await UserService.findUserByEmail(email);
  } catch (error) {
    console.error('Error fetching user data:', error);
    socket.disconnect();
    return;
  }

  // Handle multiple sessions for the same user
  const existingSocketId = emailToSocketId.get(email);
  if (existingSocketId && users.has(existingSocketId)) {
    // Clean up old session data first
    users.delete(existingSocketId);
    
    // Remove from user sessions
    const existingSessions = userSessions.get(email);
    if (existingSessions) {
      existingSessions.delete(existingSocketId);
    }
    
    // Disconnect the previous session
    const existingSocket = io.sockets.sockets.get(existingSocketId);
    if (existingSocket) {
      console.log(`🔄 Disconnecting previous session for ${email} (socket: ${existingSocketId})`);
      existingSocket.emit("session_replaced", { message: "Account logged in from another location" });
      existingSocket.disconnect(true);
    }
  }

  // Add user sessions tracking
  if (!userSessions.has(email)) {
    userSessions.set(email, new Set());
  }
  userSessions.get(email)!.add(socket.id);

  const user: User = {
    id, 
    email,
    nickname: userDbData?.nickname || nickname,
    avatar: userDbData?.avatar,
    joinTime: Date.now(),
    lastSeen: Date.now()
  };

  users.set(socket.id, user);
  emailToSocketId.set(email, socket.id); 
  
  console.log(`✅ User connected: ${email} (${nickname}, socket: ${socket.id})`);
  
  // Send initial data
  // Send recent public messages from database
  try {
    const recentMessages = await MessageService.getMessagesByThread("public", 50);
    
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
  
  await broadcastUserList();

  // Handle user disconnect
  socket.on("disconnect", async () => {
    const user = users.get(socket.id);
    if (user) {
      // Remove this socket from user sessions
      const sessions = userSessions.get(user.email);
      if (sessions) {
        sessions.delete(socket.id);
        // If no more sessions for this user, clean up completely
        if (sessions.size === 0) {
          userSessions.delete(user.email);
          emailToSocketId.delete(user.email);
        } else {
          // Update emailToSocketId to point to another active session
          const remainingSocket = Array.from(sessions)[0];
          if (remainingSocket) {
            emailToSocketId.set(user.email, remainingSocket);
          }
        }
      } else {
        // Fallback cleanup
        emailToSocketId.delete(user.email);
      }
      
      users.delete(socket.id);
      messageLimiter.delete(socket.id);
      await broadcastUserList();
      console.log(`👋 User disconnected: ${user.nickname} (${user.email}, socket: ${socket.id})`);  
    }
  });

  // Handle nickname setting
  socket.on("set nickname", async (nickname: string) => {
    const user = users.get(socket.id);
    if (user && nickname.trim().length > 0) {
      user.nickname = sanitizeMessage(nickname).slice(0, 20);
      await broadcastUserList();
    }
  });

  // Handle profile updates (avatar, nickname changes from settings)
  socket.on("profile updated", async ({ userId, nickname, avatar }) => {
    try {
      // Fetch the updated user data from database to ensure we have the latest info
      const dbUser = await UserService.findUserById(userId);
      if (!dbUser) {
        console.error("❌ Backend: User not found in database:", userId);
        return;
      }
      
      // Update the user in the users map
      const user = users.get(socket.id);
      if (user && user.id === userId) {
        user.nickname = dbUser.nickname || user.nickname;
        user.avatar = dbUser.avatar;
        
        // Broadcast updated user list to all clients
        await broadcastUserList();
        
        // Emit the profile update to all clients so they can update their local user data
        io.emit("user profile updated", {
          userId: user.id,
          nickname: user.nickname,
          avatar: user.avatar,
          email: user.email
        });
      } else {
        console.error("❌ Backend: User not found in socket users map or userId mismatch");
      }
    } catch (error) {
      console.error("💥 Backend: Error handling profile update:", error);
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