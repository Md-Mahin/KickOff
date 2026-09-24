import { pool } from "../db";

export type NotificationType = "ABOUT_TO_START" | "JUST_STARTED" | "FINISHED";

export interface NotificationItem {
  id: number;
  matchId: number;
  type: NotificationType;
  title: string;
  message: string;
  entityName: string | null;
  entityType: "Team" | "Player" | null;
  isRead: boolean;
  createdAt: string;
}

export async function generateNotificationsForUser(userId: number): Promise<void> {
  try {
    // 1. Followed teams matches
    const teamMatchesRes = await pool.query(
      `SELECT
         f.TeamID AS "entityId",
         t.Name AS "entityName",
         'Team' AS "entityType",
         m.MatchID AS "matchId",
         m.MatchDate AS "matchDate",
         m.HomeGoals AS "homeGoals",
         m.AwayGoals AS "awayGoals",
         ht.Name AS "homeTeamName",
         at.Name AS "awayTeamName"
       FROM UserFollowsTeam f
       JOIN Team t ON f.TeamID = t.TeamID
       JOIN Match m ON (m.HomeTeamID = f.TeamID OR m.AwayTeamID = f.TeamID)
       JOIN Team ht ON m.HomeTeamID = ht.TeamID
       JOIN Team at ON m.AwayTeamID = at.TeamID
       WHERE f.UserID = $1`,
      [userId]
    );

    // 2. Followed players matches
    const playerMatchesRes = await pool.query(
      `SELECT
         fp.PlayerID AS "entityId",
         p.Name AS "entityName",
         'Player' AS "entityType",
         m.MatchID AS "matchId",
         m.MatchDate AS "matchDate",
         m.HomeGoals AS "homeGoals",
         m.AwayGoals AS "awayGoals",
         ht.Name AS "homeTeamName",
         at.Name AS "awayTeamName"
       FROM UserFollowsPlayer fp
       JOIN Player p ON fp.PlayerID = p.PlayerID
       JOIN (
         SELECT MatchID, PlayerID FROM Lineup
         UNION
         SELECT m.MatchID, tph.PlayerID
         FROM Match m
         JOIN TeamPlayerHistory tph ON (m.HomeTeamID = tph.TeamID OR m.AwayTeamID = tph.TeamID)
         WHERE tph.EndDate IS NULL
       ) pm ON pm.PlayerID = fp.PlayerID
       JOIN Match m ON pm.MatchID = m.MatchID
       JOIN Team ht ON m.HomeTeamID = ht.TeamID
       JOIN Team at ON m.AwayTeamID = at.TeamID
       WHERE fp.UserID = $1`,
      [userId]
    );

    const allMatches = [...teamMatchesRes.rows, ...playerMatchesRes.rows];

    for (const item of allMatches) {
      if (!item.matchDate) continue;
      const matchDate = new Date(item.matchDate);
      const mins = Math.floor((Date.now() - matchDate.getTime()) / 60000);

      // (1) About to start (within 5 minutes before kickoff: mins is between -5 and -1)
      if (mins >= -5 && mins < 0) {
        const remainingMins = Math.max(1, -mins);
        const title = `Match Starting Soon: ${item.homeTeamName} vs ${item.awayTeamName}`;
        const message = item.entityType === "Player"
          ? `Followed player ${item.entityName}'s match (${item.homeTeamName} vs ${item.awayTeamName}) starts in ${remainingMins} minute${remainingMins > 1 ? "s" : ""}!`
          : `Followed team ${item.entityName}'s match (${item.homeTeamName} vs ${item.awayTeamName}) starts in ${remainingMins} minute${remainingMins > 1 ? "s" : ""}!`;

        await pool.query(
          `INSERT INTO Notification (UserID, MatchID, Type, Title, Message, EntityName, EntityType, CreatedAt)
           VALUES ($1, $2, 'ABOUT_TO_START', $3, $4, $5, $6, NOW())
           ON CONFLICT (UserID, MatchID, Type) DO NOTHING`,
          [userId, item.matchId, title, message, item.entityName, item.entityType]
        );
      }

      // (2) Just started (match has kicked off, within 105 mins of kickoff)
      if (mins >= 0 && mins < 105) {
        const title = `Match Started: ${item.homeTeamName} vs ${item.awayTeamName}`;
        const message = `Kickoff! The match between ${item.homeTeamName} and ${item.awayTeamName} has started.`;

        await pool.query(
          `INSERT INTO Notification (UserID, MatchID, Type, Title, Message, EntityName, EntityType, CreatedAt)
           VALUES ($1, $2, 'JUST_STARTED', $3, $4, $5, $6, NOW())
           ON CONFLICT (UserID, MatchID, Type) DO NOTHING`,
          [userId, item.matchId, title, message, item.entityName, item.entityType]
        );
      }

      // (3) Match has finished (after ~105 mins)
      if (mins >= 105) {
        const title = `Full Time: ${item.homeTeamName} ${item.homeGoals ?? 0} - ${item.awayGoals ?? 0} ${item.awayTeamName}`;
        const message = `The match between ${item.homeTeamName} and ${item.awayTeamName} has finished with a score of ${item.homeGoals ?? 0}-${item.awayGoals ?? 0}.`;

        await pool.query(
          `INSERT INTO Notification (UserID, MatchID, Type, Title, Message, EntityName, EntityType, CreatedAt)
           VALUES ($1, $2, 'FINISHED', $3, $4, $5, $6, NOW())
           ON CONFLICT (UserID, MatchID, Type) DO NOTHING`,
          [userId, item.matchId, title, message, item.entityName, item.entityType]
        );
      }
    }
  } catch (error) {
    console.warn("generateNotificationsForUser error:", (error as Error).message);
  }
}

export async function getUserNotifications(userId: number): Promise<{
  notifications: NotificationItem[];
  unreadCount: number;
}> {
  await generateNotificationsForUser(userId);

  const res = await pool.query(
    `SELECT
       NotificationID AS "id",
       MatchID AS "matchId",
       Type AS "type",
       Title AS "title",
       Message AS "message",
       EntityName AS "entityName",
       EntityType AS "entityType",
       IsRead AS "isRead",
       CreatedAt AS "createdAt"
     FROM Notification
     WHERE UserID = $1
     ORDER BY CreatedAt DESC, NotificationID DESC
     LIMIT 50`,
    [userId]
  );

  const unreadRes = await pool.query(
    `SELECT COUNT(*)::int AS "unreadCount" FROM Notification WHERE UserID = $1 AND IsRead = FALSE`,
    [userId]
  );

  return {
    notifications: res.rows,
    unreadCount: unreadRes.rows[0]?.unreadCount ?? 0,
  };
}

export async function markNotificationAsRead(userId: number, notificationId: number): Promise<boolean> {
  const res = await pool.query(
    `UPDATE Notification SET IsRead = TRUE WHERE NotificationID = $1 AND UserID = $2 RETURNING NotificationID`,
    [notificationId, userId]
  );
  return (res.rowCount ?? 0) > 0;
}

export async function markAllNotificationsAsRead(userId: number): Promise<boolean> {
  await pool.query(
    `UPDATE Notification SET IsRead = TRUE WHERE UserID = $1`,
    [userId]
  );
  return true;
}

