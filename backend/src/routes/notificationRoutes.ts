import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import {
  getUserNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
} from "../services/notificationService";

const router = Router();

// GET /api/notifications - List user's notifications and unread count
router.get("/", requireAuth, async (req, res) => {
  try {
    const userId = req.auth!.userId;
    const data = await getUserNotifications(userId);
    return res.json(data);
  } catch (error) {
    console.error("GET /api/notifications error:", error);
    return res.status(500).json({ message: "Failed to fetch notifications" });
  }
});

// PATCH /api/notifications/:id/read - Mark specific notification as read
router.patch("/:id/read", requireAuth, async (req, res) => {
  try {
    const userId = req.auth!.userId;
    const notificationId = Number(req.params.id);
    if (!Number.isInteger(notificationId)) {
      return res.status(400).json({ message: "Invalid notification ID" });
    }
    const success = await markNotificationAsRead(userId, notificationId);
    return res.json({ success });
  } catch (error) {
    console.error("PATCH /api/notifications/:id/read error:", error);
    return res.status(500).json({ message: "Failed to mark notification as read" });
  }
});

// POST /api/notifications/read-all - Mark all notifications as read
router.post("/read-all", requireAuth, async (req, res) => {
  try {
    const userId = req.auth!.userId;
    await markAllNotificationsAsRead(userId);
    return res.json({ success: true });
  } catch (error) {
    console.error("POST /api/notifications/read-all error:", error);
    return res.status(500).json({ message: "Failed to mark all as read" });
  }
});

export default router;

