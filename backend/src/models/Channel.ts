
import mongoose, { Document, Schema } from 'mongoose';
import { IUser } from './User';

export interface IChannel extends Document {
  _id: mongoose.Types.ObjectId;
  name: string;
  members: mongoose.Types.ObjectId[];
  creator: mongoose.Types.ObjectId;
  isPublic: boolean;
}

const ChannelSchema: Schema = new Schema({
  name: { type: String, required: true },
  members: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  creator: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  isPublic: { type: Boolean, default: false },
}, { timestamps: true });

export default mongoose.model<IChannel>('Channel', ChannelSchema);
