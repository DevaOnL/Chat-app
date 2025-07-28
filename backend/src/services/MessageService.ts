import Message, { IMessage } from '../models/Message.js';

export class MessageService {
  /**
   * Create a new message
   */
  static async createMessage(messageData: {
    text: string;
    sender: string;
    thread: string;
  }): Promise<IMessage> {
    const message = new Message(messageData);
    return await message.save();
  }

  /**
   * Get messages for a specific thread (public or private)
   */
  static async getMessagesByThread(thread: string, limit: number = 50): Promise<IMessage[]> {
    return await Message.find({ thread })
      .sort({ createdAt: -1 }) // Most recent first
      .limit(limit)
      .exec();
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
    const result = await Message.deleteOne({ _id: messageId, sender: senderEmail }).exec();
    return result.deletedCount > 0;
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
