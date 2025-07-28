import express from "express";
import http from "http";
import { Server, Socket } from "socket.io";
import path from "path";
import { fileURLToPath } from "url";
import { v4 as uuidv4 } from "uuid";
import rateLimit from "express-rate-limit";
import dotenv from "dotenv";
import { connectDB } from "./config/database.js";
import { UserService } from "./services/UserService.js";
import { MessageService } from "./services/MessageService.js";
import authRoutes from "./auth.js";

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
    const transformedMessages = recentMessages.map(msg => ({
      id: (msg._id as string).toString(),
      text: msg.text,
      sender: msg.sender,
      timestamp: msg.createdAt.getTime(),
      edited: msg.edited || false,
      reactions: Object.fromEntries(msg.reactions || new Map())
    }));
    
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
  socket.on("chat message", async (msg: string) => {
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
      const message = await MessageService.createMessage({
        text: sanitized,
        sender: user.email,
        thread: "public"
      });

      console.log(`💾 Saved message to MongoDB: "${sanitized}" from ${user.email}`);

      // Broadcast to all connected clients
      io.emit("chat message", {
        id: (message._id as string).toString(),
        text: message.text,
        sender: message.sender,
        timestamp: message.createdAt.getTime()
      });
      
      user.lastSeen = Date.now();
    } catch (error) {
      console.error("Error saving message:", error);
      socket.emit("error", "Failed to send message");
    }
  });

  // Handle private messages
  socket.on("private message", async ({ toEmail, message }) => {   
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
      const savedMessage = await MessageService.createMessage({
        text: sanitized,
        sender: user.email,
        thread: toEmail // Use recipient email as thread for private messages
      });

      const privateMsg = {
        id: (savedMessage._id as string).toString(),
        from: user.email,
        to: toEmail,  
        message: sanitized,
        timestamp: savedMessage.createdAt.getTime()
      };

      console.log(`💾 Saved private message to MongoDB from ${user.email} to ${toEmail}`);

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
  socket.on("toggle reaction", ({ messageId, emoji, userId, isPrivate }) => {
    // TODO: Migrate to MongoDB - temporarily disabled
    socket.emit("error", "Message reactions temporarily disabled during database migration");
    /*
    console.log(`Reaction received - MessageId: ${messageId}, Emoji: ${emoji}, UserId: ${userId}, IsPrivate: ${isPrivate}`);
    
    const user = users.get(socket.id);
    if (!user || user.id !== userId) {
      console.log(`User validation failed - Socket user: ${user?.id}, Provided userId: ${userId}`);
      return;
    }

    if (isPrivate) {
      // Handle private message reactions
      const message = privateMessages.find(m => m.id === messageId);
      if (message) {
        console.log(`Found private message for reaction`);
        if (!message.reactions) message.reactions = {};
        if (!message.reactions[emoji]) message.reactions[emoji] = [];
        
        const userIndex = message.reactions[emoji].indexOf(userId);
        if (userIndex === -1) {
          // Add reaction
          message.reactions[emoji].push(userId);
          console.log(`Added reaction ${emoji} to private message`);
        } else {
          // Remove reaction
          message.reactions[emoji].splice(userIndex, 1);
          if (message.reactions[emoji].length === 0) {
            delete message.reactions[emoji];
          }
          console.log(`Removed reaction ${emoji} from private message`);
        }

        // Send to both users in the private conversation
        const targetSocketId = emailToSocketId.get(message.from === user.email ? message.to : message.from);
        const reactionUpdate = { messageId, reactions: message.reactions };
        
        socket.emit("reaction updated", reactionUpdate);
        if (targetSocketId) {
          io.to(targetSocketId).emit("reaction updated", reactionUpdate);
        }
      } else {
        console.log(`Private message not found for reaction: ${messageId}`);
      }
    } else {
      // Handle public message reactions
      const message = publicMessages.find(m => m.id === messageId);
      if (message) {
        console.log(`Found public message for reaction`);
        if (!message.reactions) message.reactions = {};
        if (!message.reactions[emoji]) message.reactions[emoji] = [];
        
        const userIndex = message.reactions[emoji].indexOf(userId);
        if (userIndex === -1) {
          // Add reaction
          message.reactions[emoji].push(userId);
          console.log(`Added reaction ${emoji} to public message. Reactions:`, message.reactions);
        } else {
          // Remove reaction
          message.reactions[emoji].splice(userIndex, 1);
          if (message.reactions[emoji].length === 0) {
            delete message.reactions[emoji];
          }
          console.log(`Removed reaction ${emoji} from public message. Reactions:`, message.reactions);
        }

        // Broadcast to all users
        console.log(`Broadcasting reaction update:`, { messageId, reactions: message.reactions });
        io.emit("reaction updated", { messageId, reactions: message.reactions });
      } else {
        console.log(`Public message not found for reaction: ${messageId}`);
      }
    }
    */
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