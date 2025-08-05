import Group, { IGroup } from '../models/Group.js';
import { UserService } from './UserService.js';

export class GroupService {
  /**
   * Create a new group
   */
  static async createGroup(groupData: {
    name: string;
    description?: string;
    creator: string;
    isPrivate?: boolean;
    avatar?: string;
  }): Promise<IGroup> {
    try {
      // Verify that the creator exists
      const creatorUser = await UserService.findUserByEmail(groupData.creator);
      if (!creatorUser) {
        throw new Error('Creator user not found');
      }

      const group = new Group({
        ...groupData,
        members: [groupData.creator], // Creator is automatically a member
        admins: [groupData.creator], // Creator is automatically an admin
        isPrivate: groupData.isPrivate || false
      });

      return await group.save();
    } catch (error) {
      if (error instanceof Error && 'code' in error && error.code === 11000) {
        throw new Error('Group with this name already exists');
      }
      throw error;
    }
  }

  /**
   * Find group by ID
   */
  static async findGroupById(groupId: string): Promise<IGroup | null> {
    return await Group.findById(groupId).exec();
  }

  /**
   * Get groups where user is a member
   */
  static async getUserGroups(userEmail: string): Promise<IGroup[]> {
    return await Group.find({ 
      members: userEmail 
    }).sort({ updatedAt: -1 }).exec();
  }

  /**
   * Add member to group
   */
  static async addMember(groupId: string, memberEmail: string, requestingUserEmail: string): Promise<IGroup | null> {
    const group = await Group.findById(groupId).exec();
    if (!group) {
      throw new Error('Group not found');
    }

    // Check if requesting user is an admin
    if (!group.admins.includes(requestingUserEmail)) {
      throw new Error('Only group admins can add members');
    }

    // Check if user exists
    const user = await UserService.findUserByEmail(memberEmail);
    if (!user) {
      throw new Error('User not found');
    }

    // Check if user is already a member
    if (group.members.includes(memberEmail)) {
      throw new Error('User is already a member of this group');
    }

    // Add member
    group.members.push(memberEmail);
    await group.save();

    return group;
  }

  /**
   * Remove member from group
   */
  static async removeMember(groupId: string, memberEmail: string, requestingUserEmail: string): Promise<IGroup | null> {
    const group = await Group.findById(groupId).exec();
    if (!group) {
      throw new Error('Group not found');
    }

    // Check if requesting user is an admin or removing themselves
    if (!group.admins.includes(requestingUserEmail) && requestingUserEmail !== memberEmail) {
      throw new Error('Only group admins can remove members, or users can remove themselves');
    }

    // Cannot remove the creator
    if (memberEmail === group.creator) {
      throw new Error('Cannot remove the group creator');
    }

    // Remove from members
    group.members = group.members.filter(email => email !== memberEmail);
    
    // Also remove from admins if they were an admin
    group.admins = group.admins.filter(email => email !== memberEmail);

    await group.save();
    return group;
  }

  /**
   * Update member role (promote/demote admin)
   */
  static async updateMemberRole(
    groupId: string, 
    memberEmail: string, 
    role: 'admin' | 'member', 
    requestingUserEmail: string
  ): Promise<IGroup | null> {
    const group = await Group.findById(groupId).exec();
    if (!group) {
      throw new Error('Group not found');
    }

    // Check if requesting user is an admin
    if (!group.admins.includes(requestingUserEmail)) {
      throw new Error('Only group admins can change member roles');
    }

    // Check if member exists in group
    if (!group.members.includes(memberEmail)) {
      throw new Error('User is not a member of this group');
    }

    // Cannot change creator's role
    if (memberEmail === group.creator) {
      throw new Error('Cannot change the role of the group creator');
    }

    if (role === 'admin') {
      // Add to admins if not already
      if (!group.admins.includes(memberEmail)) {
        group.admins.push(memberEmail);
      }
    } else {
      // Remove from admins
      group.admins = group.admins.filter(email => email !== memberEmail);
    }

    await group.save();
    return group;
  }

  /**
   * Update group settings (name, description, avatar)
   */
  static async updateGroup(
    groupId: string, 
    updates: { name?: string; description?: string; avatar?: string; isPrivate?: boolean }, 
    requestingUserEmail: string
  ): Promise<IGroup | null> {
    const group = await Group.findById(groupId).exec();
    if (!group) {
      throw new Error('Group not found');
    }

    // Check if requesting user is an admin
    if (!group.admins.includes(requestingUserEmail)) {
      throw new Error('Only group admins can update group settings');
    }

    // Apply updates
    if (updates.name !== undefined) group.name = updates.name;
    if (updates.description !== undefined) group.description = updates.description;
    if (updates.avatar !== undefined) group.avatar = updates.avatar;
    if (updates.isPrivate !== undefined) group.isPrivate = updates.isPrivate;

    await group.save();
    return group;
  }

  /**
   * Delete group
   */
  static async deleteGroup(groupId: string, requestingUserEmail: string): Promise<boolean> {
    const group = await Group.findById(groupId).exec();
    if (!group) {
      throw new Error('Group not found');
    }

    // Only creator can delete the group
    if (group.creator !== requestingUserEmail) {
      throw new Error('Only the group creator can delete the group');
    }

    await Group.findByIdAndDelete(groupId).exec();
    return true;
  }

  /**
   * Check if user is member of group
   */
  static async isUserMember(groupId: string, userEmail: string): Promise<boolean> {
    const group = await Group.findById(groupId).exec();
    return group ? group.members.includes(userEmail) : false;
  }

  /**
   * Check if user is admin of group
   */
  static async isUserAdmin(groupId: string, userEmail: string): Promise<boolean> {
    const group = await Group.findById(groupId).exec();
    return group ? group.admins.includes(userEmail) : false;
  }

  /**
   * Get group members with their user data
   */
  static async getGroupMembersWithUserData(groupId: string): Promise<any[]> {
    const group = await Group.findById(groupId).exec();
    if (!group) {
      throw new Error('Group not found');
    }

    const membersData = [];
    for (const memberEmail of group.members) {
      const user = await UserService.findUserByEmail(memberEmail);
      if (user) {
        membersData.push({
          email: user.email,
          nickname: user.nickname,
          avatar: user.avatar,
          isAdmin: group.admins.includes(memberEmail),
          isCreator: group.creator === memberEmail
        });
      }
    }

    return membersData;
  }

  /**
   * Search groups by name (for public groups or groups user is member of)
   */
  static async searchGroups(query: string, userEmail: string): Promise<IGroup[]> {
    return await Group.find({
      $and: [
        {
          $or: [
            { isPrivate: false }, // Public groups
            { members: userEmail } // Groups user is member of
          ]
        },
        {
          name: { $regex: query, $options: 'i' } // Case-insensitive name search
        }
      ]
    }).sort({ name: 1 }).limit(20).exec();
  }

  /**
   * Get group count for debugging
   */
  static async getGroupCount(): Promise<number> {
    return await Group.countDocuments().exec();
  }
}