import express, { Response, NextFunction } from 'express';
import { GroupService } from '../services/GroupService.js';
import { MessageService } from '../services/MessageService.js';
import { authenticateToken, AuthRequest } from '../middleware.js';

const router = express.Router();

// Apply authentication middleware to all group routes
router.use((req: AuthRequest, res: Response, next: NextFunction) => {
  authenticateToken(req, res, next).catch(next);
});

/**
 * POST /api/groups - Create new group
 */
router.post('/', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { name, description, isPrivate, avatar } = req.body;
    const userEmail = req.user?.email;

    if (!userEmail) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    if (!name || name.trim().length === 0) {
      res.status(400).json({ error: 'Group name is required' });
      return;
    }

    const group = await GroupService.createGroup({
      name: name.trim(),
      description: description?.trim(),
      creator: userEmail,
      isPrivate: isPrivate || false,
      avatar
    });

    res.status(201).json({
      success: true,
      data: group
    });
  } catch (error) {
    console.error('Create group error:', error);
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Failed to create group' 
    });
  }
});

/**
 * GET /api/groups - Get user's groups
 */
router.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userEmail = req.user?.email;

    if (!userEmail) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const groups = await GroupService.getUserGroups(userEmail);
    
    res.json({
      success: true,
      data: groups
    });
  } catch (error) {
    console.error('Get groups error:', error);
    res.status(500).json({ error: 'Failed to fetch groups' });
  }
});

/**
 * GET /api/groups/:id - Get specific group details
 */
router.get('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const groupId = req.params.id;
    const userEmail = req.user?.email;

    if (!userEmail) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const group = await GroupService.findGroupById(groupId);
    
    if (!group) {
      res.status(404).json({ error: 'Group not found' });
      return;
    }

    // Check if user is a member
    if (!group.members.includes(userEmail)) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    res.json({
      success: true,
      data: group
    });
  } catch (error) {
    console.error('Get group error:', error);
    res.status(500).json({ error: 'Failed to fetch group' });
  }
});

/**
 * PUT /api/groups/:id - Update group settings
 */
router.put('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const groupId = req.params.id;
    const userEmail = req.user?.email;
    const { name, description, avatar, isPrivate } = req.body;

    if (!userEmail) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const updates: any = {};
    if (name !== undefined) updates.name = name.trim();
    if (description !== undefined) updates.description = description?.trim();
    if (avatar !== undefined) updates.avatar = avatar;
    if (isPrivate !== undefined) updates.isPrivate = isPrivate;

    const updatedGroup = await GroupService.updateGroup(groupId, updates, userEmail);
    
    res.json({
      success: true,
      data: updatedGroup
    });
  } catch (error) {
    console.error('Update group error:', error);
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Failed to update group' 
    });
  }
});

/**
 * DELETE /api/groups/:id - Delete group
 */
router.delete('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const groupId = req.params.id;
    const userEmail = req.user?.email;

    if (!userEmail) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    await GroupService.deleteGroup(groupId, userEmail);
    
    res.json({
      success: true,
      message: 'Group deleted successfully'
    });
  } catch (error) {
    console.error('Delete group error:', error);
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Failed to delete group' 
    });
  }
});

/**
 * GET /api/groups/:id/members - Get group members
 */
router.get('/:id/members', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const groupId = req.params.id;
    const userEmail = req.user?.email;

    if (!userEmail) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    // Check if user is a member
    const isMember = await GroupService.isUserMember(groupId, userEmail);
    if (!isMember) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    const members = await GroupService.getGroupMembersWithUserData(groupId);
    
    res.json({
      success: true,
      data: members
    });
  } catch (error) {
    console.error('Get group members error:', error);
    res.status(500).json({ error: 'Failed to fetch group members' });
  }
});

/**
 * POST /api/groups/:id/members - Add member to group
 */
router.post('/:id/members', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const groupId = req.params.id;
    const userEmail = req.user?.email;
    const { memberEmail } = req.body;

    if (!userEmail) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    if (!memberEmail) {
      res.status(400).json({ error: 'Member email is required' });
      return;
    }

    const updatedGroup = await GroupService.addMember(groupId, memberEmail, userEmail);
    
    res.json({
      success: true,
      data: updatedGroup
    });
  } catch (error) {
    console.error('Add member error:', error);
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Failed to add member' 
    });
  }
});

/**
 * DELETE /api/groups/:id/members/:userId - Remove member from group
 */
router.delete('/:id/members/:userEmail', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const groupId = req.params.id;
    const memberEmail = decodeURIComponent(req.params.userEmail);
    const requestingUserEmail = req.user?.email;

    if (!requestingUserEmail) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const updatedGroup = await GroupService.removeMember(groupId, memberEmail, requestingUserEmail);
    
    res.json({
      success: true,
      data: updatedGroup
    });
  } catch (error) {
    console.error('Remove member error:', error);
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Failed to remove member' 
    });
  }
});

/**
 * PUT /api/groups/:id/members/:userId/role - Update member role
 */
router.put('/:id/members/:userEmail/role', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const groupId = req.params.id;
    const memberEmail = decodeURIComponent(req.params.userEmail);
    const requestingUserEmail = req.user?.email;
    const { role } = req.body;

    if (!requestingUserEmail) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    if (!role || !['admin', 'member'].includes(role)) {
      res.status(400).json({ error: 'Valid role (admin or member) is required' });
      return;
    }

    const updatedGroup = await GroupService.updateMemberRole(groupId, memberEmail, role, requestingUserEmail);
    
    res.json({
      success: true,
      data: updatedGroup
    });
  } catch (error) {
    console.error('Update member role error:', error);
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Failed to update member role' 
    });
  }
});

/**
 * GET /api/groups/:id/messages - Get group message history
 */
router.get('/:id/messages', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const groupId = req.params.id;
    const userEmail = req.user?.email;
    const { beforeDate, limit = 50 } = req.query;

    if (!userEmail) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    // Check if user is a member
    const isMember = await GroupService.isUserMember(groupId, userEmail);
    if (!isMember) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    const historyOptions = {
      thread: groupId, // Use groupId as thread for group messages
      beforeDate: beforeDate ? new Date(beforeDate as string) : undefined,
      limit: parseInt(limit as string, 10)
    };

    const results = await MessageService.getMessageHistory(historyOptions);
    
    res.json({
      success: true,
      data: results
    });
  } catch (error) {
    console.error('Get group messages error:', error);
    res.status(500).json({ error: 'Failed to fetch group messages' });
  }
});

/**
 * GET /api/groups/search/:query - Search groups
 */
router.get('/search/:query', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const query = req.params.query;
    const userEmail = req.user?.email;

    if (!userEmail) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    if (!query || query.trim().length === 0) {
      res.status(400).json({ error: 'Search query is required' });
      return;
    }

    const groups = await GroupService.searchGroups(query.trim(), userEmail);
    
    res.json({
      success: true,
      data: groups
    });
  } catch (error) {
    console.error('Search groups error:', error);
    res.status(500).json({ error: 'Failed to search groups' });
  }
});

export default router;