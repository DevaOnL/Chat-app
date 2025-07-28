// Migration script to hash existing plain text passwords
import dotenv from 'dotenv';
import { connectDB } from '../config/database.js';
import User from '../models/User.js';
import bcrypt from 'bcrypt';

// Load environment variables
dotenv.config();

async function hashExistingPasswords() {
  try {
    await connectDB();
    console.log('🔗 Connected to database');

    // Find all users with potentially unhashed passwords
    const users = await User.find({});
    console.log(`📊 Found ${users.length} users to check`);

    for (const user of users) {
      // Check if password is already hashed (bcrypt hashes start with $2a$, $2b$, or $2y$)
      if (!user.password.startsWith('$2')) {
        console.log(`🔨 Hashing password for user: ${user.email}`);
        
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(user.password, saltRounds);
        
        await User.findByIdAndUpdate(user._id, { password: hashedPassword });
        console.log(`✅ Updated password for: ${user.email}`);
      } else {
        console.log(`⏭️ Password already hashed for: ${user.email}`);
      }
    }

    console.log('🎉 Password migration completed');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

hashExistingPasswords();
