import mongoose, { Schema, Document } from 'mongoose';

export interface IGroup extends Document {
  name: string;
  description?: string;
  members: string[]; // Array of user emails
  admins: string[]; // Array of user emails who are admins
  creator: string; // Email of the user who created the group
  avatar?: string; // URL to group avatar image
  isPrivate: boolean; // Whether the group is private or public
  createdAt: Date;
  updatedAt: Date;
}

const GroupSchema: Schema = new Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  description: {
    type: String,
    trim: true,
    maxlength: 500
  },
  members: [{
    type: String,
    required: true,
    ref: 'User' // References User email
  }],
  admins: [{
    type: String,
    required: true,
    ref: 'User' // References User email
  }],
  creator: {
    type: String,
    required: true,
    ref: 'User' // References User email
  },
  avatar: {
    type: String,
    default: null
  },
  isPrivate: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true, // Automatically adds createdAt and updatedAt
  versionKey: false // Disable the __v field
});

// Indexes for efficient queries
GroupSchema.index({ name: 1 });
GroupSchema.index({ members: 1 });
GroupSchema.index({ creator: 1 });
GroupSchema.index({ createdAt: -1 });

// Compound index for member-based queries
GroupSchema.index({ members: 1, createdAt: -1 });

export default mongoose.model<IGroup>('Group', GroupSchema);