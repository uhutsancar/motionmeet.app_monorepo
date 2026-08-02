import { connectDatabase, database, disconnectDatabase } from "../configs/database.js";
import bcrypt from "bcryptjs";

async function run() {
  try {
    await connectDatabase();
    const hash = await bcrypt.hash("12345678", 12);
    await database.updateTable("users").set({ password_hash: hash }).where("email", "=", "admin@motionmeet.app").execute();
    console.log("Password successfully updated to 12345678");
  } catch (err) {
    console.error(err);
  } finally {
    await disconnectDatabase().catch(() => {});
  }
}
run();
