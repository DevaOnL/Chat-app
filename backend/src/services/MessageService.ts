import Message, { IMessage } from '../models/Message.js';
import mongoose from 'mongoose';

export class MessageService {
  /**
   * Create a new message
   */
  static async createMessage(messageData: {
    text: string;
    sender: string;
    thread: string;
    groupId?: string;
    file?: any;
  }): Promise<IMessage> {
    const message = new Message(messageData);
    return await message.save();
  }

  /**
   * Find message by ID
   */
  static async findMessageById(messageId: string): Promise<IMessage | null> {
    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(messageId)) {
      console.log(`❌ Invalid ObjectId for find: ${messageId}`);
      return null;
    }
    
    return await Message.findById(messageId).exec();
  }

  /**
   * Get group messages
   */
  static async getGroupMessages(groupId: string, limit: number = 50): Promise<IMessage[]> {
    // Get most recent messages first, then reverse for chronological order
    const messages = await Message.find({ groupId })
      .sort({ createdAt: -1 }) // Most recent first
      .limit(limit)
      .exec();
    
    // Reverse to get chronological order (oldest to newest)
    return messages.reverse();
  }

  /**
   * Get messages for a specific thread (public, private, or group)
   */
  static async getMessagesByThread(thread: string, limit: number = 50): Promise<IMessage[]> {
    // Get most recent messages first, then reverse for chronological order
    const messages = await Message.find({ thread })
      .sort({ createdAt: -1 }) // Most recent first
      .limit(limit)
      .exec();
    
    // Reverse to get chronological order (oldest to newest)
    return messages.reverse();
  }

  /**
   * Get messages for a specific thread with pagination support
   */
  static async getMessagesByThreadPaginated(
    thread: string, 
    limit: number = 50, 
    skip: number = 0
  ): Promise<{ messages: IMessage[], hasMore: boolean, total: number }> {
    // Get total count for hasMore calculation
    const total = await Message.countDocuments({ thread });
    
    // Get messages with pagination
    const messages = await Message.find({ thread })
      .sort({ createdAt: -1 }) // Most recent first
      .skip(skip)
      .limit(limit)
      .exec();
    
    // Check if there are more messages
    const hasMore = skip + messages.length < total;
    
    // Reverse to get chronological order (oldest to newest)
    return {
      messages: messages.reverse(),
      hasMore,
      total
    };
  }

  /**
   * Get recent public messages
   */
  static async getPublicMessages(limit: number = 50): Promise<IMessage[]> {
    return await this.getMessagesByThread('public', limit);
  }

  /**
   * Get private messages between two users
   */
  static async getPrivateMessages(user1: string, user2: string, limit: number = 50): Promise<IMessage[]> {
    // Private messages use both users' emails as thread identifiers
    const thread1 = `${user1}_${user2}`;
    const thread2 = `${user2}_${user1}`;
    
    return await Message.find({
      $or: [
        { thread: thread1 },
        { thread: thread2 }
      ]
    })
    .sort({ createdAt: -1 })
    .limit(limit)
    .exec();
  }

  /**
   * Update message text (for editing)
   */
  static async updateMessage(messageId: string, newText: string, senderEmail: string): Promise<IMessage | null> {
    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(messageId)) {
      console.log(`❌ Invalid ObjectId for update: ${messageId}`);
      return null;
    }
    
    return await Message.findOneAndUpdate(
      { _id: messageId, sender: senderEmail }, // Only allow sender to edit
      { text: newText, edited: true },
      { new: true }
    ).exec();
  }

  /**
   * Delete message
   */
  static async deleteMessage(messageId: string, senderEmail: string): Promise<boolean> {
    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(messageId)) {
      console.log(`❌ Invalid ObjectId for delete: ${messageId}`);
      return false;
    }
    
    const result = await Message.deleteOne({ _id: messageId, sender: senderEmail }).exec();
    return result.deletedCount > 0;
  }

  /**
   * Toggle reaction on message (add if not present, remove if present)
   */
  static async toggleReaction(messageId: string, emoji: string, userEmail: string): Promise<IMessage | null> {
    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(messageId)) {
      console.log(`❌ Invalid ObjectId for toggle reaction: ${messageId}`);
      return null;
    }

    const message = await Message.findById(messageId).exec();
    if (!message) return null;

    // Initialize reactions if not exists
    if (!message.reactions) {
      message.reactions = new Map();
    }

    // Get current reactions for this emoji
    const currentReactions = message.reactions.get(emoji) || [];
    
    // Check if user already reacted
    const userIndex = currentReactions.indexOf(userEmail);
    
    if (userIndex === -1) {
      // Add reaction
      currentReactions.push(userEmail);
      message.reactions.set(emoji, currentReactions);
      console.log(`➕ Added reaction ${emoji} from ${userEmail} to message ${messageId}`);
    } else {
      // Remove reaction
      currentReactions.splice(userIndex, 1);
      
      if (currentReactions.length === 0) {
        // Remove emoji entirely if no users left
        message.reactions.delete(emoji);
      } else {
        message.reactions.set(emoji, currentReactions);
      }
      console.log(`➖ Removed reaction ${emoji} from ${userEmail} to message ${messageId}`);
    }

    await message.save();
    return message;
  }

  /**
   * Add reaction to message
   */
  static async addReaction(messageId: string, emoji: string, userEmail: string): Promise<IMessage | null> {
    const message = await Message.findById(messageId).exec();
    if (!message) return null;

    // Initialize reactions if not exists
    if (!message.reactions) {
      message.reactions = new Map();
    }

    // Get current reactions for this emoji
    const currentReactions = message.reactions.get(emoji) || [];
    
    // Add user if not already reacted
    if (!currentReactions.includes(userEmail)) {
      currentReactions.push(userEmail);
      message.reactions.set(emoji, currentReactions);
      await message.save();
    }

    return message;
  }

  /**
   * Remove reaction from message
   */
  static async removeReaction(messageId: string, emoji: string, userEmail: string): Promise<IMessage | null> {
    const message = await Message.findById(messageId).exec();
    if (!message || !message.reactions) return null;

    const currentReactions = message.reactions.get(emoji) || [];
    const updatedReactions = currentReactions.filter(email => email !== userEmail);
    
    if (updatedReactions.length === 0) {
      message.reactions.delete(emoji);
    } else {
      message.reactions.set(emoji, updatedReactions);
    }
    
    await message.save();
    return message;
  }

  /**
   * Get message by ID
   */
  static async getMessageById(messageId: string): Promise<IMessage | null> {
    return await Message.findById(messageId).exec();
  }

  /**
   * Search messages with text search, filters, and pagination
   */
  static async searchMessages(options: {
    query?: string;
    thread?: string;
    sender?: string;
    startDate?: Date;
    endDate?: Date;
    fileType?: string;
    limit?: number;
    skip?: number;
  }): Promise<{
    messages: IMessage[];
    total: number;
    hasMore: boolean;
  }> {
    const {
      query,
      thread,
      sender,
      startDate,
      endDate,
      fileType,
      limit = 20,
      skip = 0
    } = options;

    // Build the search filter
    const filter: any = {};

    // Text search
    if (query && query.trim()) {
      filter.$text = { $search: query.trim() };
    }

    // Thread filter
    if (thread) {
      filter.thread = thread;
    }

    // Sender filter
    if (sender) {
      filter.sender = sender;
    }

    // Date range filter
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = startDate;
      if (endDate) filter.createdAt.$lte = endDate;
    }

    // File type filter
    if (fileType) {
      if (fileType === 'text') {
        filter.file = { $exists: false };
      } else {
        filter['file.fileType'] = new RegExp(fileType, 'i');
      }
    }

    // Get total count for pagination
    const total = await Message.countDocuments(filter).exec();

    // Build the query
    let mongoQuery = Message.find(filter);

    // Sort by relevance if text search, otherwise by date
    if (query && query.trim()) {
      mongoQuery = mongoQuery.sort({ score: { $meta: 'textScore' }, createdAt: -1 });
    } else {
      mongoQuery = mongoQuery.sort({ createdAt: -1 });
    }

    // Apply pagination
    const messages = await mongoQuery
      .skip(skip)
      .limit(limit)
      .exec();

    return {
      messages,
      total,
      hasMore: skip + limit < total
    };
  }

  /**
   * Get message history with pagination for infinite scroll
   */
  static async getMessageHistory(options: {
    thread?: string;
    beforeDate?: Date;
    limit?: number;
  }): Promise<{
    messages: IMessage[];
    hasMore: boolean;
  }> {
    const { thread = 'public', beforeDate, limit = 50 } = options;

    const filter: any = { thread };
    
    if (beforeDate) {
      filter.createdAt = { $lt: beforeDate };
    }

    const messages = await Message.find(filter)
      .sort({ createdAt: -1 })
      .limit(limit + 1) // Get one extra to check if there are more
      .exec();

    const hasMore = messages.length > limit;
    if (hasMore) {
      messages.pop(); // Remove the extra message
    }

    // Return in chronological order
    return {
      messages: messages.reverse(),
      hasMore
    };
  }

  /**
   * Clean old messages (for maintenance)
   */
  static async cleanOldMessages(daysOld: number = 30): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);
    
    const result = await Message.deleteMany({
      createdAt: { $lt: cutoffDate }
    }).exec();
    
    return result.deletedCount;
  }
}
