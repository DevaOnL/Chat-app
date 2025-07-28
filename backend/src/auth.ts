// src/auth.ts
import { Router, Request, Response, NextFunction } from 'express';
import bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import { UserService } from './services/UserService.js';
import { IUser } from './models/User.js';
import { generateToken, authenticateToken, AuthRequest } from './middleware.js';

const router = Router();

// Signup endpoint
router.post('/signup', async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password, nickname } = req.body;

    // Validation
    if (!email || !password || !nickname) {                                                          
      res.status(400).json({ error: 'Email, password, and nickname are required' });   
      return;
    }

    if (password.length < 6) {
      res.status(400).json({ error: 'Password must be at least 6 characters' });
      return;
    }

    // Check if user already exists
    const existingUser = await UserService.findUserByEmail(email);
    if (existingUser) {
      res.status(409).json({ error: 'User already exists' });
      return;
    }

    // Create user
    const userData = {
      email: email.toLowerCase(),
      password: password,
      nickname: nickname
    };

    const user: IUser = await UserService.createUser(userData);

    // Generate token
    const token = generateToken({ id: (user._id as string).toString(), email: user.email });

    res.status(201).json({
      message: 'User created successfully',
      token,
      user: {
        id: (user._id as string).toString(),
        email: user.email,
        nickname: user.nickname,
        avatar: user.avatar
      }
    });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Login endpoint
router.post('/login', async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;

    // Validation
    if (!email || !password) {
      res.status(400).json({ error: 'Email and password are required' });
      return;
    }

    // Find user
    const user = await UserService.findUserByEmail(email);
    if (!user) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    // Verify password
    const isValidPassword = await UserService.validatePassword(user, password);
    if (!isValidPassword) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    // Generate token
    const token = generateToken({ id: (user._id as string).toString(), email: user.email });

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: (user._id as string).toString(),
        email: user.email,
        nickname: user.nickname,
        avatar: user.avatar
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get current user info (protected route)
router.get('/me', (req: AuthRequest, res: Response, next: NextFunction) => {
  authenticateToken(req, res, next).catch(next);
}, (req: AuthRequest, res: Response): void => {
  res.json({
    user: req.user
  });
});

// Update user profile (protected route)
router.put('/profile', (req: AuthRequest, res: Response, next: NextFunction) => {
  authenticateToken(req, res, next).catch(next);
}, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { nickname, email, avatar } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    // Validation
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      res.status(400).json({ error: 'Invalid email format' });
      return;
    }

    if (nickname && (nickname.trim().length === 0 || nickname.length > 50)) {
      res.status(400).json({ error: 'Nickname must be between 1 and 50 characters' });
      return;
    }

    // Prepare updates object
    const updates: { nickname?: string; email?: string; avatar?: string } = {};
    if (nickname !== undefined) updates.nickname = nickname.trim();
    if (email !== undefined) updates.email = email.trim();
    if (avatar !== undefined) updates.avatar = avatar;

    // Update user profile
    const updatedUser = await UserService.updateUserProfile(userId, updates);

    if (!updatedUser) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    res.json({
      message: 'Profile updated successfully',
      user: {
        id: (updatedUser._id as string).toString(),
        email: updatedUser.email,
        nickname: updatedUser.nickname,
        avatar: updatedUser.avatar
      }
    });
  } catch (error) {
    console.error('Profile update error:', error);
    if (error instanceof Error && error.message === 'Email already exists') {
      res.status(409).json({ error: 'Email already exists' });
    } else {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
});

export default router;