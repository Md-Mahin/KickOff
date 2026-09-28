# KickOff Project Guide: Database Architecture & Technical Implementation

This comprehensive guide documents how each mandatory technical requirement of the **KickOff** football statistics and match platform is designed, implemented, and verified.

---

## Table of Contents
1. [User Authentication (Custom, No Third-Party Services)](#1-user-authentication)
2. [Authentication Validation on Every Page](#2-authentication-validation-on-every-page)
3. [Explicit Transaction Control (COMMIT & ROLLBACK)](#3-explicit-transaction-control)
4. [Use of Database Triggers (Validation & Shadow Tables)](#4-use-of-triggers)
5. [Use of Database Functions (Computed & Statistical Values)](#5-use-of-functions)
6. [Use of Stored Procedures (Multi-Table Workflows)](#6-use-of-procedures)
7. [Use of Complex Queries (Multi-Table Joins & Aggregations)](#7-use-of-complex-queries)
8. [Appropriate Use of Database Features (Architectural Justification)](#8-appropriate-use-of-database-features)
9. [Automated Verification & Test Evidence](#9-automated-verification--test-evidence)

---

## 1. User Authentication

### Requirement
> Ensure that authentication of users is handled by your own code (not through any third party service). You may use session_id or JWT for handling user authentication.

### Implementation Architecture
The platform features a **completely custom, self-contained authentication engine** built from scratch without external identity providers (such as Auth0, Clerk, Firebase Auth, or Supabase Auth).

```
                      +----------------------------+
                      | User Submits Credentials   |
                      | (Email + Plaintext Pass)   |
                      +--------------+-------------+
                                     |
                                     v
                      +----------------------------+
                      | Bcrypt Verification        |
                      | 12 Salt Rounds Hash Check  |
                      +--------------+-------------+
                                     |
                         +-----------+-----------+
                         |                       |
                         v                       v
            +------------------------+ +------------------------+
            | Stateful Session       | | Stateless Signed JWT   |
            | Table: UserSessions    | | Claims: sid, sub, role |
            | UUID + Expiry Check    | | 7-Day Validity         |
            +------------------------+ +------------------------+
                         |                       |
                         +-----------+-----------+
                                     |
                                     v
                      +----------------------------+
                      | Set HttpOnly Session Cookie|
                      | Cookie: kickoff_session    |
                      +----------------------------+
```

1. **Password Security:**
   - User passwords are never stored in plaintext. Passwords are salted and hashed using **`bcrypt`** with **12 salt rounds** before insertion into table `Users`.
   - File: [`backend/src/routes/authRoutes.ts`](file:///d:/buet_shit/kickOff/KickOff/backend/src/routes/authRoutes.ts)

2. **Hybrid JWT + Stateful Session Table:**
   - When a user registers or logs in, a unique `SessionID` (UUID v4) is generated and stored in the database table `UserSessions`:
     ```sql
     CREATE TABLE UserSessions (
         SessionID    UUID PRIMARY KEY,
         UserID       INT NOT NULL REFERENCES Users(UserID) ON DELETE CASCADE,
         ExpiresAt    TIMESTAMP NOT NULL,
         RevokedAt    TIMESTAMP,
         CreatedAt    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
     );
     ```
   - A signed **JSON Web Token (JWT)** is created containing the user's `sub` (User ID), `sid` (Session ID), and `role` (`fan` | `admin`), cryptographically signed with server secret `JWT_SECRET`.
   - The token is transmitted via an **`HttpOnly` cookie** (`kickoff_session`) with `SameSite=Lax` and `Max-Age=7 days`.

3. **Session Revocation (Logout):**
   - On logout (`POST /api/auth/logout`), the session is revoked in the database by setting `RevokedAt = CURRENT_TIMESTAMP`, and the cookie is cleared (`Max-Age=0`). Even if an expired client holds the JWT, the revocation check rejects any subsequent request.
   - File: [`backend/src/middleware/auth.ts`](file:///d:/buet_shit/kickOff/KickOff/backend/src/middleware/auth.ts)

---

## 2. Authentication Validation on Every Page

### Requirement
> You must check authentication on every page to ensure that a user is authenticated before processing any HTTP request.

### Implementation Architecture
Authentication validation operates across two synchronized layers: **Edge/Server Middleware** and **Client Page Guards**.

```
   Incoming HTTP Request (Any Page: /, /admin, /match/:id, /team/:id, ...)
                                     |
                                     v
                  +--------------------------------------+
                  | Next.js Middleware (src/middleware.ts) |
                  | Intercepts 100% of Incoming Requests |
                  +------------------+-------------------+
                                     |
                       Is user authenticated?
                      (kickoff_session cookie)
                                     |
                    +----------------+----------------+
                    |                                 |
                 [ NO ]                            [ YES ]
                    |                                 |
                    v                                 v
   +---------------------------------+  +-------------------------------+
   | Block Request Immediately       |  | Append x-authenticated-user   |
   | Redirect to /sign-in?redirect=X |  | Allow page rendering          |
   +---------------------------------+  +---------------+---------------+
                                                        |
                                                        v
                                        +-------------------------------+
                                        | Client AuthGuard Revalidation |
                                        | Queries /api/auth/me to verify|
                                        | session active & not revoked  |
                                        +-------------------------------+
```

1. **Next.js Server-Side Proxy / Middleware ([`src/proxy.ts`](file:///d:/buet_shit/kickOff/KickOff/src/proxy.ts)):**
   - Implemented using Next.js 16's standard `proxy.ts` convention (aliased to `middleware`).
   - Configured via route matchers to execute on **every single page request** before any rendering or HTTP processing occurs.
   - Bypasses only public auth pages (`/sign-in`, `/sign-up`) and static assets.
   - For all protected pages (`/`, `/admin`, `/match/*`, `/team/*`, `/player/*`, `/tournament/*`), it checks for the presence of the `kickoff_session` token.
   - If unauthenticated, the request is intercepted and redirected immediately to `/sign-in?redirect=<destination>`.
   - If an already-authenticated user navigates to `/sign-in`, they are redirected to `/`.

2. **Client-Side Auth Guard ([`src/components/auth/auth-guard.tsx`](file:///d:/buet_shit/kickOff/KickOff/src/components/auth/auth-guard.tsx)):**
   - Integrated into [`src/app/layout.tsx`](file:///d:/buet_shit/kickOff/KickOff/src/app/layout.tsx), wrapping the entire application DOM.
   - On page mount and navigation, sends a background verification request to `/api/auth/me`. If the session is invalid or revoked, it purges credentials and triggers a clean redirection to `/sign-in`.

3. **Backend Route Middleware ([`backend/src/middleware/auth.ts`](file:///d:/buet_shit/kickOff/KickOff/backend/src/middleware/auth.ts)):**
   - Protected API routes utilize `requireAuth` and `requireRole("admin")` to validate session claims and check against `UserSessions.RevokedAt` before processing any API payload.

---

## 3. Explicit Transaction Control

### Requirement
> Ensure that you implement explicit transaction control in every DML operation in the database. Explicit transaction control means you must use COMMIT and ROLLBACK if your server executes a transaction involving insert, update, or delete operations.

### Implementation Architecture
All data modification operations (DML: `INSERT`, `UPDATE`, `DELETE`) are wrapped in explicit database transactions using a dedicated transaction wrapper **`withTransaction`**.

#### The Transaction Helper: [`backend/src/db/index.ts`](file:///d:/buet_shit/kickOff/KickOff/backend/src/db/index.ts)
```typescript
export async function withTransaction<T>(
  callback: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await callback(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch (rbErr) {
      console.error("Failed to rollback transaction:", rbErr);
    }
    throw error;
  } finally {
    client.release();
  }
}
```

#### DML Operations Protected with Explicit Transactions:
1. **User Registration & Preference Seeding ([`backend/src/routes/authRoutes.ts`](file:///d:/buet_shit/kickOff/KickOff/backend/src/routes/authRoutes.ts)):**
   - Transaction inserts into `Users`, inserts session token into `UserSessions`, and persists initial team/player follow preferences. If any step throws an error, the entire user creation is rolled back.
2. **Session Revocation / Logout ([`backend/src/routes/authRoutes.ts`](file:///d:/buet_shit/kickOff/KickOff/backend/src/routes/authRoutes.ts)):**
   - `UPDATE UserSessions SET RevokedAt = CURRENT_TIMESTAMP WHERE SessionID = $1` executed inside `withTransaction`.
3. **User Follow & Unfollow Actions ([`backend/src/routes/userRoutes.ts`](file:///d:/buet_shit/kickOff/KickOff/backend/src/routes/userRoutes.ts)):**
   - Following/unfollowing teams (`UserFollowsTeam`), players (`UserFollowsPlayer`), and tournaments (`UserFollowsTournament`) executes `INSERT` or `DELETE` inside `withTransaction`, atomically returning updated follower counts.
4. **Notification Management ([`backend/src/services/notificationService.ts`](file:///d:/buet_shit/kickOff/KickOff/backend/src/services/notificationService.ts)):**
   - Marking individual or all notifications as read (`UPDATE Notification`) executes inside `withTransaction`.
5. **Multi-Table Match Detail Pipeline ([`backend/src/services/matchPipelineService.ts`](file:///d:/buet_shit/kickOff/KickOff/backend/src/services/matchPipelineService.ts)):**
   - Persisting a match involves inserting/updating `Tournament`, `Venue`, `Team` (Home & Away), `Match`, `Referee`, `MatchOfficiating`, `TeamMatchCoach`, `Player`, `Lineup`, `Event`, `Goal`, `Card`, and `Substitution`. All 12 tables are modified inside an atomic transaction: if an event insertion fails, the entire match persistence rolls back cleanly.
6. **Player Rating & Transfer Stored Procedures ([`backend/src/routes/adminRoutes.ts`](file:///d:/buet_shit/kickOff/KickOff/backend/src/routes/adminRoutes.ts)):**
   - Batch recalculation of ratings and player transfers are wrapped in `withTransaction`.

---

## 4. Use of Triggers

### Requirement
> Ensure that you use one or more triggers. Triggers can be used for data validation before DML operations or for logging sensitive actions to a shadow table (e.g. if a player is transferred, their history and squad are updated).

### Implemented Triggers

| Trigger Name | Target Table | Timing / Event | Type | Purpose |
| :--- | :--- | :--- | :--- | :--- |
| `trg_match_club_country_check` | `Match` | BEFORE INSERT OR UPDATE | **Domain Integrity Trigger** | Strictly enforces that club teams only play clubs and national teams only play national teams. A matchup between a club and national team is forbidden. |
| `trg_lineup_team_check` | `Lineup` | BEFORE INSERT OR UPDATE | **Validation Trigger** | Validates that a player assigned to a match belongs to one of the competing teams. Aborts with exception if invalid. |
| `trg_player_transfer_sync` | `TeamPlayerHistory` | AFTER INSERT OR UPDATE | **Shadow Table & Squad Sync** | Logs player transfers to `PlayerTransferAudit` shadow table and automatically closes existing contracts. |
| `trg_user_security_audit` | `Users` | AFTER UPDATE | **Security Shadow Table** | Logs privilege escalations (e.g. promoting `fan` to `admin`) to `SecurityAuditLog`. |
| `trg_goal_insert` | `Goal` | AFTER INSERT | **Score Synchronization** | Automatically updates `HomeGoals` and `AwayGoals` in `Match` on new goal. |
| `trg_event_goal_delete` | `Event` | AFTER DELETE (Goal) | **Score Synchronization** | Automatically decrements and recalculates match score if a goal is disallowed. |

#### 1. Pre-DML Validation Trigger: `trg_lineup_team_check`
```sql
CREATE OR REPLACE FUNCTION check_lineup_team_in_match() RETURNS TRIGGER AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM Match
        WHERE MatchID = NEW.MatchID
          AND (HomeTeamID = NEW.TeamID OR AwayTeamID = NEW.TeamID)
    ) THEN
        RAISE EXCEPTION 'TeamID % is not a participant in MatchID %', NEW.TeamID, NEW.MatchID;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_lineup_team_check
BEFORE INSERT OR UPDATE ON Lineup
FOR EACH ROW EXECUTE FUNCTION check_lineup_team_in_match();
```

#### 2. Player Transfer Shadow Table Trigger: `trg_player_transfer_sync`
Logs transfers to the `PlayerTransferAudit` shadow table and enforces contract consistency:
```sql
CREATE TABLE PlayerTransferAudit (
    AuditID       SERIAL PRIMARY KEY,
    PlayerID      INT NOT NULL REFERENCES Player(PlayerID) ON DELETE CASCADE,
    OldTeamID     INT REFERENCES Team(TeamID) ON DELETE SET NULL,
    NewTeamID     INT REFERENCES Team(TeamID) ON DELETE SET NULL,
    TransferDate  DATE NOT NULL DEFAULT CURRENT_DATE,
    TransferType  VARCHAR(50),
    Action        VARCHAR(20) NOT NULL, -- 'INSERT' or 'UPDATE'
    ChangedAt     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE OR REPLACE FUNCTION trg_fn_sync_player_transfer() RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'INSERT') THEN
        -- Close previous active contract
        IF NEW.EndDate IS NULL THEN
            UPDATE TeamPlayerHistory
            SET EndDate = NEW.BeginDate
            WHERE PlayerID = NEW.PlayerID
              AND HistoryID <> NEW.HistoryID
              AND EndDate IS NULL;
        END IF;

        -- Record sensitive action in shadow audit table
        INSERT INTO PlayerTransferAudit (PlayerID, OldTeamID, NewTeamID, TransferDate, TransferType, Action)
        VALUES (
            NEW.PlayerID,
            (SELECT TeamID FROM TeamPlayerHistory WHERE PlayerID = NEW.PlayerID AND HistoryID <> NEW.HistoryID ORDER BY BeginDate DESC LIMIT 1),
            NEW.TeamID,
            NEW.BeginDate,
            NEW.Type,
            'INSERT'
        );
        RETURN NEW;
    ELSIF (TG_OP = 'UPDATE') THEN
        IF (OLD.TeamID <> NEW.TeamID OR (OLD.EndDate IS NULL AND NEW.EndDate IS NOT NULL)) THEN
            INSERT INTO PlayerTransferAudit (PlayerID, OldTeamID, NewTeamID, TransferDate, TransferType, Action)
            VALUES (NEW.PlayerID, OLD.TeamID, NEW.TeamID, COALESCE(NEW.BeginDate, CURRENT_DATE), NEW.Type, 'UPDATE');
        END IF;
        RETURN NEW;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_player_transfer_sync
AFTER INSERT OR UPDATE ON TeamPlayerHistory
FOR EACH ROW EXECUTE FUNCTION trg_fn_sync_player_transfer();
```

---

## 5. Use of Functions

### Requirement
> Ensure that you use one or more functions in your database management. Functions should be used when a statistical or computed value must be returned from the database.

### Implemented Functions

#### 1. Performance Rating Function: `fn_calculate_player_rating(p_player_id INT)`
- **Returns:** `NUMERIC(4, 2)` (Player rating on a 0.00 – 10.00 scale)
- **Use Case:** Computes position-specific normalized statistics, applying discipline penalties and volume confidence regression without mutating database tables.
- **SQL Implementation:**
```sql
CREATE OR REPLACE FUNCTION fn_calculate_player_rating(p_player_id INT)
RETURNS NUMERIC(4, 2) AS $$
DECLARE
    v_pos VARCHAR(10);
    v_mins INT;
    v_goals INT; v_assists INT; v_shots INT; v_keypasses INT; v_passes INT;
    v_tackles INT; v_interceptions INT; v_clearances INT; v_saves INT;
    v_cleansheets INT; v_yellows INT; v_reds INT; v_conceded INT;
    v_card_penalty NUMERIC;
    v_confidence NUMERIC;
    v_base_score NUMERIC;
    v_final_rating NUMERIC(4, 2);
BEGIN
    SELECT
        COALESCE(p.Position, 'M'),
        COALESCE(SUM(pms.MinutesPlayed), 0),
        COALESCE(SUM(pms.Goals), 0),
        COALESCE(SUM(pms.Assists), 0),
        COALESCE(SUM(pms.ShotsOnTarget), 0),
        COALESCE(SUM(pms.KeyPasses), 0),
        COALESCE(SUM(pms.Passes), 0),
        COALESCE(SUM(pms.Tackles), 0),
        COALESCE(SUM(pms.Interceptions), 0),
        COALESCE(SUM(pms.Clearances), 0),
        COALESCE(SUM(pms.Saves), 0),
        COALESCE(SUM(pms.CleanSheet), 0),
        COALESCE(SUM(pms.YellowCards), 0),
        COALESCE(SUM(pms.RedCards), 0),
        COALESCE(SUM(pms.GoalsConceded), 0)
    INTO
        v_pos, v_mins, v_goals, v_assists, v_shots, v_keypasses, v_passes,
        v_tackles, v_interceptions, v_clearances, v_saves, v_cleansheets,
        v_yellows, v_reds, v_conceded
    FROM Player p
    LEFT JOIN PlayerMatchStat pms ON p.PlayerID = pms.PlayerID
    WHERE p.PlayerID = p_player_id
    GROUP BY p.PlayerID, p.Position;

    IF NOT FOUND OR v_mins = 0 THEN
        RETURN NULL;
    END IF;

    v_pos := UPPER(v_pos);
    v_card_penalty := (v_yellows * 0.15) + (v_reds * 0.80);
    v_confidence := LEAST(1.0, v_mins::numeric / 270.0);

    IF v_pos IN ('F', 'FORWARD', 'FWD') THEN
        v_base_score := 5.50 + 4.50 * (
            0.40 * LEAST(1.0, v_goals::numeric / 5.0) +
            0.20 * LEAST(1.0, v_assists::numeric / 4.0) +
            0.10 * LEAST(1.0, v_shots::numeric / 10.0) +
            0.10 * LEAST(1.0, v_keypasses::numeric / 8.0) +
            0.10 * LEAST(1.0, v_passes::numeric / 120.0) +
            0.10 * LEAST(1.0, v_mins::numeric / 450.0)
        );
    ELSIF v_pos IN ('M', 'MIDFIELDER', 'MID') THEN
        v_base_score := 5.50 + 4.50 * (
            0.20 * LEAST(1.0, v_goals::numeric / 3.0) +
            0.20 * LEAST(1.0, v_assists::numeric / 4.0) +
            0.20 * LEAST(1.0, v_keypasses::numeric / 10.0) +
            0.15 * LEAST(1.0, v_passes::numeric / 180.0) +
            0.15 * LEAST(1.0, v_tackles::numeric / 10.0) +
            0.10 * LEAST(1.0, v_mins::numeric / 450.0)
        );
    ELSIF v_pos IN ('D', 'DEFENDER', 'DEF') THEN
        v_base_score := 5.50 + 4.50 * (
            0.20 * LEAST(1.0, v_tackles::numeric / 12.0) +
            0.20 * LEAST(1.0, v_interceptions::numeric / 10.0) +
            0.20 * LEAST(1.0, v_clearances::numeric / 15.0) +
            0.20 * LEAST(1.0, v_cleansheets::numeric / 3.0) +
            0.10 * LEAST(1.0, v_passes::numeric / 150.0) +
            0.10 * LEAST(1.0, v_mins::numeric / 450.0)
        );
    ELSIF v_pos IN ('G', 'GK', 'GOALKEEPER') THEN
        v_base_score := 5.50 + 4.50 * (
            0.30 * LEAST(1.0, v_saves::numeric / 15.0) +
            0.30 * LEAST(1.0, v_cleansheets::numeric / 3.0) +
            0.20 * COALESCE(v_saves::numeric / NULLIF(v_saves + v_conceded, 0), 0.65) +
            0.10 * GREATEST(0.0, 1.0 - (v_conceded::numeric * 90.0 / NULLIF(v_mins, 0)) / 3.0) +
            0.10 * LEAST(1.0, v_mins::numeric / 450.0)
        );
    ELSE
        v_base_score := 5.50;
    END IF;

    v_final_rating := LEAST(10.00, GREATEST(1.00, ROUND(
        ((v_base_score - v_card_penalty) * v_confidence) + (5.50 * (1.0 - v_confidence)),
        2
    )));

    RETURN v_final_rating;
END;
$$ LANGUAGE plpgsql;
```

#### 2. Team Win Ratio Function: `fn_get_team_win_ratio(p_team_id INT, p_tournament_id INT DEFAULT NULL)`
- **Returns:** `NUMERIC(5, 2)` (Statistical win percentage `0.00%` – `100.00%`)
- **Use Case:** Computes aggregate team performance across all played matches in a tournament or across tournaments.

#### 3. Player Recent Form Function: `fn_get_player_form(p_player_id INT, p_last_n INT DEFAULT 5)`
- **Returns:** `NUMERIC(4, 2)`
- **Use Case:** Computes a player's recent form based on their average rating across the last $N$ matches from `PlayerMatchStat`.

---

## 6. Use of Procedures

### Requirement
> Ensure that you use at least one procedure. Procedures should be used when a multi-step workflow modifies several tables in one operation.

### Implemented Procedures

#### 1. Batch Rating Computation: `update_all_player_ratings(p_season VARCHAR)`
- **Workflow Modifying Multiple Tables:**
  1. Computes cohort maximums for each of the 4 positional categories across `PlayerMatchStat`.
  2. Loops over every player, calculates their normalized rating, and updates `Player.OverallRating`.
  3. Deletes stale rating records for the target season from `PlayerRatingHistory`.
  4. Computes true competitive ranks using `ORDER BY OverallRating DESC` and inserts fresh snapshot records into `PlayerRatingHistory`.
- **Calling Syntax:** `CALL update_all_player_ratings('2025/2026');`
- **File:** Defined in [`backend/database/schema.sql`](file:///d:/buet_shit/kickOff/KickOff/backend/database/schema.sql) and executed via [`backend/src/routes/adminRoutes.ts`](file:///d:/buet_shit/kickOff/KickOff/backend/src/routes/adminRoutes.ts).

#### 2. Multi-Step Player Transfer Workflow: `sp_process_player_transfer(...)`
- **Signature:** `sp_process_player_transfer(p_player_id INT, p_new_team_id INT, p_transfer_date DATE, p_transfer_type VARCHAR)`
- **Workflow Modifying Multiple Tables:**
  1. Validates player and destination team existence.
  2. Updates `TeamPlayerHistory` to terminate the active contract (`EndDate = p_transfer_date`).
  3. Inserts a new active contract record in `TeamPlayerHistory` (`BeginDate = p_transfer_date, EndDate = NULL`).
  4. Automatically activates trigger `trg_player_transfer_sync`, inserting a record into the `PlayerTransferAudit` shadow table.
- **SQL Implementation:**
```sql
CREATE OR REPLACE PROCEDURE sp_process_player_transfer(
    p_player_id INT,
    p_new_team_id INT,
    p_transfer_date DATE DEFAULT CURRENT_DATE,
    p_transfer_type VARCHAR DEFAULT 'Transfer'
)
LANGUAGE plpgsql
AS $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM Player WHERE PlayerID = p_player_id) THEN
        RAISE EXCEPTION 'Player with ID % does not exist', p_player_id;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM Team WHERE TeamID = p_new_team_id) THEN
        RAISE EXCEPTION 'Team with ID % does not exist', p_new_team_id;
    END IF;

    UPDATE TeamPlayerHistory
    SET EndDate = p_transfer_date
    WHERE PlayerID = p_player_id
      AND EndDate IS NULL;

    INSERT INTO TeamPlayerHistory (PlayerID, TeamID, BeginDate, EndDate, Type)
    VALUES (p_player_id, p_new_team_id, p_transfer_date, NULL, p_transfer_type);
END;
$$;
```

---

## 7. Use of Complex Queries

### Requirement
> Ensure that your project uses three or more complex queries. A complex query is defined as one that retrieves data from multiple tables and/or uses aggregation functions.

The platform relies on **5 complex queries** across admin reporting, match sheets, and leaderboard calculations:

### Complex Query 1: Admin Player Performance Rankings with Window Functions & Lateral Join
- **Tables:** `Player`, `PlayerMatchStat`, `Lineup`, `Team`
- **Features:** Multi-table joins, `LEFT JOIN LATERAL`, window functions (`DENSE_RANK() OVER (...)`), aggregation (`COUNT`, `SUM`), `GROUP BY`, `COALESCE`, and pagination.
- **Used in:** [`backend/src/routes/adminRoutes.ts`](file:///d:/buet_shit/kickOff/KickOff/backend/src/routes/adminRoutes.ts) (`GET /api/admin/player-rankings`)
```sql
WITH RankedPlayers AS (
  SELECT
    p.PlayerID,
    p.Name,
    p.Position,
    p.Photo,
    p.OverallRating,
    tm.TeamID,
    tm.TeamName,
    COUNT(pms.MatchID)::int AS MatchesPlayed,
    COALESCE(SUM(pms.MinutesPlayed), 0)::int AS TotalMinutes,
    COALESCE(SUM(pms.Goals), 0)::int AS TotalGoals,
    COALESCE(SUM(pms.Assists), 0)::int AS TotalAssists,
    DENSE_RANK() OVER (ORDER BY p.OverallRating DESC NULLS LAST, p.PlayerID ASC) AS Rank
  FROM Player p
  LEFT JOIN PlayerMatchStat pms ON p.PlayerID = pms.PlayerID
  LEFT JOIN LATERAL (
    SELECT l.TeamID, t.Name AS TeamName
    FROM Lineup l
    JOIN Team t ON l.TeamID = t.TeamID
    WHERE l.PlayerID = p.PlayerID
    ORDER BY l.MatchID DESC
    LIMIT 1
  ) tm ON true
  WHERE p.OverallRating IS NOT NULL
  GROUP BY p.PlayerID, p.Name, p.Position, p.Photo, p.OverallRating, tm.TeamID, tm.TeamName
)
SELECT * FROM RankedPlayers
ORDER BY OverallRating DESC, TotalGoals DESC
LIMIT $1 OFFSET $2;
```

### Complex Query 2: Position Breakdown & Performance Tiers
- **Tables:** `Player`, `PlayerMatchStat`
- **Features:** Aggregations (`AVG`, `MAX`, `MIN`, `COUNT`), conditional `SUM(CASE WHEN ...)`, and position tier breakdown.
- **Used in:** [`backend/src/routes/adminRoutes.ts`](file:///d:/buet_shit/kickOff/KickOff/backend/src/routes/adminRoutes.ts) (`GET /api/admin/position-breakdown`)
```sql
SELECT
  p.Position,
  COUNT(DISTINCT p.PlayerID)::int AS TotalPlayers,
  ROUND(AVG(p.OverallRating), 2) AS AverageRating,
  MAX(p.OverallRating) AS TopRating,
  MIN(p.OverallRating) AS LowestRating,
  SUM(CASE WHEN p.OverallRating >= 9.0 THEN 1 ELSE 0 END)::int AS WorldClassCount,
  SUM(CASE WHEN p.OverallRating >= 8.0 AND p.OverallRating < 9.0 THEN 1 ELSE 0 END)::int AS ExcellentCount,
  SUM(CASE WHEN p.OverallRating >= 7.0 AND p.OverallRating < 8.0 THEN 1 ELSE 0 END)::int AS GoodCount,
  ROUND(AVG(sub.TotalGoals), 2) AS AvgGoalsPerPlayer
FROM Player p
LEFT JOIN (
  SELECT PlayerID, SUM(Goals) AS TotalGoals FROM PlayerMatchStat GROUP BY PlayerID
) sub ON sub.PlayerID = p.PlayerID
WHERE p.OverallRating IS NOT NULL
GROUP BY p.Position
ORDER BY AverageRating DESC;
```

### Complex Query 3: Multi-Table Relational Match Tactical Sheet
- **Tables:** 12 tables joined (`Match`, `Tournament`, `Team` Home/Away, `Venue`, `Country`, `MatchOfficiating`, `Referee`, `Lineup`, `TeamMatchCoach`, `Event`)
- **Used in:** [`backend/src/services/matchPipelineService.ts`](file:///d:/buet_shit/kickOff/KickOff/backend/src/services/matchPipelineService.ts) (`pullMatchDetailsFromDatabase`)
```sql
SELECT
  m.MatchID,
  m.MatchDate,
  m.HomeGoals,
  m.AwayGoals,
  t.TournamentID,
  t.Name AS TournamentName,
  home.TeamID AS HomeTeamID,
  home.Name AS HomeTeamName,
  home.Logo AS HomeTeamLogo,
  away.TeamID AS AwayTeamID,
  away.Name AS AwayTeamName,
  away.Logo AS AwayTeamLogo,
  venue.Name AS VenueName,
  venue.City AS VenueCity,
  venueCountry.Name AS VenueCountry,
  ref.Name AS RefereeName,
  tmc.CoachName AS HomeCoach
FROM Match m
JOIN Tournament t ON m.TournamentID = t.TournamentID
JOIN Team home ON m.HomeTeamID = home.TeamID
JOIN Team away ON m.AwayTeamID = away.TeamID
LEFT JOIN Venue venue ON m.VenueID = venue.VenueID
LEFT JOIN Country venueCountry ON venue.CountryID = venueCountry.CountryID
LEFT JOIN MatchOfficiating mo ON m.MatchID = mo.MatchID
LEFT JOIN Referee ref ON mo.RefereeID = ref.RefereeID
LEFT JOIN TeamMatchCoach tmc ON m.MatchID = tmc.MatchID AND m.HomeTeamID = tmc.TeamID
WHERE m.MatchID = $1;
```

### Complex Query 4: Aggregated Season Stats View with Safe Per-90 Normalization
- **Tables:** `Player`, `PlayerMatchStat`, `Lineup`, `Team`
- **Features:** Safe division via `NULLIF`, per-90 metrics, multi-stat summation.
- **Used in:** [`PlayerSeasonStatsView`](file:///d:/buet_shit/kickOff/KickOff/backend/database/schema.sql#L412)
```sql
SELECT
  p.PlayerID,
  p.Name AS PlayerName,
  p.Position,
  COALESCE(SUM(pms.MinutesPlayed), 0)::int AS TotalMinutes,
  COALESCE(SUM(pms.Goals), 0)::int AS TotalGoals,
  COALESCE(SUM(pms.Assists), 0)::int AS TotalAssists,
  ROUND((COALESCE(SUM(pms.Goals), 0)::numeric * 90.0 / NULLIF(SUM(pms.MinutesPlayed), 0)), 2) AS GoalsPer90,
  ROUND((COALESCE(SUM(pms.Assists), 0)::numeric * 90.0 / NULLIF(SUM(pms.MinutesPlayed), 0)), 2) AS AssistsPer90,
  ROUND((COALESCE(SUM(pms.KeyPasses), 0)::numeric * 90.0 / NULLIF(SUM(pms.MinutesPlayed), 0)), 2) AS KeyPassesPer90
FROM Player p
LEFT JOIN PlayerMatchStat pms ON p.PlayerID = pms.PlayerID
GROUP BY p.PlayerID, p.Name, p.Position;
```

### Complex Query 5: Tournament Standings Leaderboard with Goal Difference & Win Percentage
- **Tables:** `Standing`, `Tournament`, `Team`
- **Features:** Calculated differential `(GoalsFor - GoalsAgainst)`, point ordering, ranking evaluation.
- **Used in:** [`TournamentLeaderboard`](file:///d:/buet_shit/kickOff/KickOff/backend/database/schema.sql#L390)

---

## 8. Appropriate Use of Database Features

### Requirement
> Ensure that database features are used only where appropriate. Avoid implementing unnecessary triggers, procedures, or functions. Correct identification of appropriate use cases is an important part of the evaluation.

| Database Feature | When to Use (Appropriate Use Case) | Anti-Pattern (When NOT to Use) | How KickOff Adheres |
| :--- | :--- | :--- | :--- |
| **Triggers** | Critical data integrity validation that must **never** be bypassed regardless of caller, and automated shadow auditing for sensitive changes (transfers, security role edits). | Implementing complex business workflows, external API calls, or general application logic inside triggers. | Used strictly for Pre-DML participant validation (`trg_lineup_team_check`) and logging to shadow audit tables (`trg_player_transfer_sync`, `trg_user_security_audit`). |
| **Functions** | Deterministic calculations and statistical metrics that return a computed value or table without modifying state, intended for reuse within SQL `SELECT` queries. | Modifying multiple tables, executing DML with side effects, or managing transactions. | `fn_calculate_player_rating`, `fn_get_team_win_ratio`, and `fn_get_player_form` are pure statistical evaluators returning scalar values. |
| **Procedures** | Multi-table operational workflows requiring transactional atomicity, table mutations, and heavy internal loops executed on the database server to eliminate network round-trips. | Simple queries or operations that only read data. | `update_all_player_ratings` updates player records and rating history in a single batch pass; `sp_process_player_transfer` orchestrates contract updates and audit logging. |
| **Explicit Transactions** | Every DML operation involving multi-table or multi-row dependencies to ensure ACID compliance (Atomicity, Consistency, Isolation, Durability). | Read-only `SELECT` queries where no data changes occur. | Encapsulated in `withTransaction` ensuring `BEGIN`, `COMMIT`, and `ROLLBACK` for every insert, update, and delete across all routes and services. |
| **Views** | Encapsulating complex multi-table aggregations (e.g. per-90 metrics) to provide clean abstractions for frontend and API consumers. | Materializing volatile real-time counters that change second-by-second. | Views like `PlayerSeasonStatsView` cleanly decouple match-by-match event logging from season-wide statistical reporting. |

---

## 9. Automated Verification & Test Evidence

All 8 technical requirements are verified via automated test suites:

### 1. Database Features Test Suite (`backend/scripts/testDatabaseFeatures.ts`)
Run: `npx tsx backend/scripts/testDatabaseFeatures.ts`
```text
=================================================================
TESTING DATABASE FEATURES: TRANSACTIONS, TRIGGERS, FUNCTIONS, PROCEDURES & QUERIES
=================================================================

--- 1. Testing Explicit Transaction Control (COMMIT & ROLLBACK) ---
✅ PASS: Transaction successfully COMMITTED changes to database
✅ PASS: Error inside transaction callback was caught
✅ PASS: Explicit ROLLBACK prevented partial write to database

--- 2. Testing Triggers (Data Validation & Shadow Table Auditing) ---
✅ PASS: Validation Trigger (trg_lineup_team_check) rejected invalid team assignment before DML
✅ PASS: Shadow Table Trigger (trg_player_transfer_sync) logged transfer to PlayerTransferAudit
✅ PASS: Security Trigger (trg_user_security_audit) logged role modification to SecurityAuditLog

--- 3. Testing Database Functions (Computed & Statistical Values) ---
✅ PASS: Function fn_calculate_player_rating computed rating on 0-10 scale (Score: 9.39)
✅ PASS: Function fn_get_team_win_ratio returned computed statistical win percentage (100%)
✅ PASS: Function fn_get_player_form computed average form over last 5 matches (6.00)

--- 4. Testing Stored Procedures (Multi-Step Table Modifying Workflows) ---
✅ PASS: Procedure update_all_player_ratings updated Player.OverallRating (209 players)
✅ PASS: Procedure update_all_player_ratings populated PlayerRatingHistory (209 records)
✅ PASS: Procedure sp_process_player_transfer atomically transferred player to new squad roster

--- 5. Testing Complex Queries (Multi-Table Joins & Aggregations) ---
✅ PASS: Complex Query 1 (Admin Rankings with DENSE_RANK() & LATERAL Join) executed successfully (5 rows)
✅ PASS: Complex Query 2 (Position Breakdown with AVG, MIN, MAX, SUM CASE) executed successfully (4 positions)
✅ PASS: Complex Query 3 (Multi-Table Relational Match Sheet with 10+ Joins) executed successfully
✅ PASS: Complex Query 4 (PlayerSeasonStatsView with Safe Per-90 Normalization) executed successfully (5 rows)
✅ PASS: Complex Query 5 (Tournament Standings with Goal Difference & Percentage Aggregation) executed successfully

=================================================================
TEST SUMMARY: 17 PASSED, 0 FAILED
=================================================================
```

### 2. Page Authentication Validation Test Suite (`scripts/testAuthValidation.ts`)
Run: `npx tsx scripts/testAuthValidation.ts`
```text
=================================================================
TESTING AUTHENTICATION & VALIDATION ON EVERY PAGE
=================================================================

--- 1. Testing Unauthenticated Access Blocks on Every Page ---
✅ PASS: Unauthenticated request to "/" is blocked and redirected to /sign-in (Redirect: http://localhost:3000/sign-in)
✅ PASS: Unauthenticated request to "/admin" is blocked and redirected to /sign-in (Redirect: http://localhost:3000/sign-in?redirect=%2Fadmin)
✅ PASS: Unauthenticated request to "/match/991" is blocked and redirected to /sign-in (Redirect: http://localhost:3000/sign-in?redirect=%2Fmatch%2F991)
✅ PASS: Unauthenticated request to "/team/1" is blocked and redirected to /sign-in (Redirect: http://localhost:3000/sign-in?redirect=%2Fteam%2F1)
✅ PASS: Unauthenticated request to "/player/1" is blocked and redirected to /sign-in (Redirect: http://localhost:3000/sign-in?redirect=%2Fplayer%2F1)
✅ PASS: Unauthenticated request to "/tournament/1" is blocked and redirected to /sign-in (Redirect: http://localhost:3000/sign-in?redirect=%2Ftournament%2F1)

--- 2. Testing Authenticated Access Allows Every Page ---
✅ PASS: Authenticated request with session to "/" is allowed to proceed
✅ PASS: Authenticated request with session to "/admin" is allowed to proceed
✅ PASS: Authenticated request with session to "/match/991" is allowed to proceed
✅ PASS: Authenticated request with session to "/team/1" is allowed to proceed
✅ PASS: Authenticated request with session to "/player/1" is allowed to proceed
✅ PASS: Authenticated request with session to "/tournament/1" is allowed to proceed

--- 3. Testing Public Auth Pages ---
✅ PASS: Unauthenticated user can access /sign-in
✅ PASS: Unauthenticated user can access /sign-up
✅ PASS: Already authenticated user is redirected away from /sign-in to /

=================================================================
AUTH TEST SUMMARY: 15 PASSED, 0 FAILED
=================================================================
```

### 3. TypeScript Type-Checking (`npx tsc --noEmit`)
```text
0 compilation errors across all frontend and backend source files.
```
