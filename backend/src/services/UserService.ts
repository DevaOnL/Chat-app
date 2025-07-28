import User, { IUser } from '../models/User.js';
import bcrypt from 'bcrypt';

export class UserService {
  /**
   * Create a new user
   */
  static async createUser(userData: {
    email: string;
    password: string;
    nickname?: string;
    avatar?: string;
  }): Promise<IUser> {
    try {
      // Hash the password before saving
      const saltRounds = 10;
      const hashedPassword = await bcrypt.hash(userData.password, saltRounds);
      
      const user = new User({
        ...userData,
        password: hashedPassword
      });
      return await user.save();
    } catch (error) {
      if (error instanceof Error && 'code' in error && error.code === 11000) {
        throw new Error('User with this email already exists');
      }
      throw error;
    }
  }

  /**
   * Find user by email
   */
  static async findUserByEmail(email: string): Promise<IUser | null> {
    return await User.findOne({ email: email.toLowerCase() }).exec();
  }

  /**
   * Find user by ID
   */
  static async findUserById(id: string): Promise<IUser | null> {
    return await User.findById(id).exec();
  }

  /**
   * Get all users (for user list in chat)
   */
  static async getAllUsers(): Promise<IUser[]> {
    return await User.find({}, '-password').exec(); // Exclude password field
  }

  /**
   * Update user nickname
   */
  static async updateUserNickname(id: string, nickname: string): Promise<IUser | null> {
    return await User.findByIdAndUpdate(
      id, 
      { nickname }, 
      { new: true, select: '-password' }
    ).exec();
  }

  /**
   * Update user avatar
   */
  static async updateUserAvatar(id: string, avatar: string): Promise<IUser | null> {
    return await User.findByIdAndUpdate(
      id, 
      { avatar }, 
      { new: true, select: '-password' }
    ).exec();
  }

  /**
   * Update user email
   */
  static async updateUserEmail(id: string, email: string): Promise<IUser | null> {
    // Check if email is already taken by another user
    const existingUser = await User.findOne({ 
      email: email.toLowerCase(), 
      _id: { $ne: id } 
    }).exec();
    
    if (existingUser) {
      throw new Error('Email already exists');
    }

    return await User.findByIdAndUpdate(
      id, 
      { email: email.toLowerCase() }, 
      { new: true, select: '-password' }
    ).exec();
  }

  /**
   * Update user profile (nickname, email, avatar)
   */
  static async updateUserProfile(
    id: string, 
    updates: { nickname?: string; email?: string; avatar?: string }
  ): Promise<IUser | null> {
    // If updating email, check for uniqueness
    if (updates.email) {
      const existingUser = await User.findOne({ 
        email: updates.email.toLowerCase(), 
        _id: { $ne: id } 
      }).exec();
      
      if (existingUser) {
        throw new Error('Email already exists');
      }
      
      // Normalize email
      updates.email = updates.email.toLowerCase();
    }

    return await User.findByIdAndUpdate(
      id, 
      updates, 
      { new: true, select: '-password' }
    ).exec();
  }

  /**
   * Update last seen timestamp
   */
  static async updateLastSeen(id: string): Promise<void> {
    await User.findByIdAndUpdate(id, { lastSeen: new Date() }).exec();
  }

  /**
   * Validate user password
   */
  static async validatePassword(user: IUser, password: string): Promise<boolean> {
    return await bcrypt.compare(password, user.password);
  }

  /**
   * Get user count for debugging
   */
  static async getUserCount(): Promise<number> {
    return await User.countDocuments().exec();
  }
}
