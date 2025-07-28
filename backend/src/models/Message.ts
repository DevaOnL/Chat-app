import mongoose, { Schema, Document } from 'mongoose';

export interface IMessage extends Document {
  text: string;
  sender: string; // email of sender
  thread: string; // 'public' or email for private messages
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

export default mongoose.model<IMessage>('Message', MessageSchema);
