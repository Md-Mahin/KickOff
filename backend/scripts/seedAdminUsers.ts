import bcrypt from "bcrypt";
import { pool } from "../src/db";

async function seedAdminUsers() {
  console.log("Seeding 2 admin users into the database...\n");

  const adminUsers = [
    {
      name: "KickOff Admin",
      email: "admin@kickoff.com",
      password: "AdminPassword123!",
      role: "admin",
    },
    {
      name: "System Admin",
      email: "admin2@kickoff.com",
      password: "AdminPassword123!",
      role: "admin",
    },
  ];

  try {
    for (const u of adminUsers) {
      const passwordHash = await bcrypt.hash(u.password, 12);

      // Check if user exists by email or username
      const existing = await pool.query(
        "SELECT UserID, Username, Email, Role FROM Users WHERE Email = $1 OR Username = $2",
        [u.email, u.name]
      );

      if (existing.rows.length > 0) {
        const userId = existing.rows[0].userid;
        await pool.query(
          `UPDATE Users 
           SET Username = $1, Email = $2, PasswordHash = $3, Role = $4 
           WHERE UserID = $5`,
          [u.name, u.email, passwordHash, u.role, userId]
        );
        console.log(`Updated existing user #${userId} to Admin:`);
        console.log(`   Email: ${u.email}`);
        console.log(`   Password: ${u.password}\n`);
      } else {
        const insertRes = await pool.query(
          `INSERT INTO Users (Username, Email, PasswordHash, Role)
           VALUES ($1, $2, $3, $4)
           RETURNING UserID`,
          [u.name, u.email, passwordHash, u.role]
        );
        const newId = insertRes.rows[0].userid;
        console.log(`Created new Admin user #${newId}:`);
        console.log(`   Email: ${u.email}`);
        console.log(`   Password: ${u.password}\n`);
      }
    }

    // Verify admin count
    const verifyRes = await pool.query(
      "SELECT UserID, Username, Email, Role, CreatedAt FROM Users WHERE Role = 'admin' ORDER BY UserID ASC"
    );
    console.log("Current Admin Accounts in DB:");
    console.table(verifyRes.rows);

    console.log("\nAdmin user seeding complete!");
  } catch (err) {
    console.error("Error seeding admin users:", err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

seedAdminUsers();
