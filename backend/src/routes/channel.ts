
import express, { Request, Response, NextFunction, RequestHandler } from "express";
import { authenticateToken, AuthRequest } from "../middleware.js";
import ChannelService from "../services/ChannelService.js";

const router = express.Router();

// Get all channels for the logged-in user
router.get("/", authenticateToken as RequestHandler, async (req: AuthRequest, res: Response) => {
  try {
    const channels = await ChannelService.getChannelsForUser(req.user!.id);
    res.json(channels);
  } catch (error) {
    res.status(500).json({ message: "Error fetching channels" });
  }
});

// Create a new channel
router.post("/", authenticateToken as RequestHandler, async (req: AuthRequest, res: Response) => {
  const { name, memberIds } = req.body;
  try {
    const channel = await ChannelService.createChannel(name, req.user!.id, memberIds);
    res.status(201).json(channel);
  } catch (error) {
    res.status(400).json({ message: "Error creating channel" });
  }
});

// Get all messages for a specific channel
router.get("/:id/messages", authenticateToken as RequestHandler, async (req: Request, res: Response) => {
  try {
    // @ts-ignore
    const messages = await MessageService.getMessagesByChannelId(req.params.id, 100);
    res.json(messages);
  } catch (error) {
    res.status(500).json({ message: "Error fetching messages" });
  }
});

// Invite a user to a channel
router.post("/:id/members", authenticateToken as RequestHandler, async (req: AuthRequest, res: Response) => {
  const { userId } = req.body;
  try {
    const channel = await ChannelService.addMemberToChannel(req.params.id, userId);
    res.json(channel);
  } catch (error) {
    res.status(400).json({ message: "Error adding member" });
  }
});

export default router;
