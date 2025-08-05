import mongoose, { Schema, Document } from 'mongoose';

export interface IMessage extends Document {
  text: string;
  sender: string; // email of sender
  thread: string; // 'public', email for private messages, or group ID for group messages
  groupId?: string; // Optional group ID for group messages
  edited?: boolean;
  reactions?: Map<string, string[]>; // emoji -> array of user emails
  file?: {
    fileName: string;
    fileSize: number;
    fileType: string;
    fileUrl: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

const MessageSchema: Schema = new Schema({
  text: {
    type: String,
    required: true,
    maxlength: 500,
    trim: true
  },
  sender: {
    type: String,
    required: true,
    ref: 'User'
  },
  thread: {
    type: String,
    required: true,
    index: true // Index for faster thread queries
  },
  groupId: {
    type: String,
    ref: 'Group',
    default: null,
    index: true // Index for faster group queries
  },
  edited: {
    type: Boolean,
    default: false
  },
  reactions: {
    type: Map,
    of: [String], // Array of user emails who reacted
    default: new Map()
  },
  file: {
    fileName: {
      type: String,
      required: false
    },
    fileSize: {
      type: Number,
      required: false
    },
    fileType: {
      type: String,
      required: false
    },
    fileUrl: {
      type: String,
      required: false
    }
  }
}, {
  timestamps: true, // Automatically adds createdAt and updatedAt
  versionKey: false // Disable the __v field
});

// Compound index for efficient thread + timestamp queries
MessageSchema.index({ thread: 1, createdAt: -1 });

// Index for finding messages by sender
MessageSchema.index({ sender: 1 });

// Index for group messages
MessageSchema.index({ groupId: 1, createdAt: -1 });

// Compound index for group and thread queries
MessageSchema.index({ groupId: 1, thread: 1, createdAt: -1 });

// Text search index for message content and file names
MessageSchema.index({ 
  text: 'text', 
  'file.fileName': 'text' 
}, {
  name: 'message_search_index',
  weights: {
    text: 10,          // Higher weight for message text
    'file.fileName': 5  // Lower weight for file names
  }
});

export default mongoose.model<IMessage>('Message', MessageSchema);
