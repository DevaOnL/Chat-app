
import mongoose from 'mongoose';
import Channel, { IChannel } from '../models/Channel.js';
import User, { IUser } from '../models/User.js';

class ChannelService {
  async createChannel(name: string, creatorId: string, memberIds: string[], isPublic: boolean = false): Promise<mongoose.HydratedDocument<IChannel>> {
    const allMemberIds = [...new Set([creatorId, ...memberIds])];

    const members = await User.find({ '_id': { $in: allMemberIds } });
    if (members.length !== allMemberIds.length) {
      throw new Error('One or more users not found.');
    }

    const channel = new Channel({
      name,
      creator: creatorId,
      members: allMemberIds,
      isPublic
    });

    await channel.save();
    return channel;
  }

  async getChannelsForUser(userId: string): Promise<IChannel[]> {
    return Channel.find({ members: userId }).populate('members', 'email');
  }

  async addMemberToChannel(channelId: string, userId: string): Promise<IChannel | null> {
    const channel = await Channel.findById(channelId);
    if (!channel) {
      throw new Error('Channel not found');
    }

    const user = await User.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    if (!channel.members.includes(user._id)) {
      channel.members.push(user._id);
      await channel.save();
    }

    return channel;
  }
}

export default new ChannelService();
