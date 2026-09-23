import dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.resolve(process.cwd(), "./backend/.env") });
import { getMatchLineups } from "./backend/src/services/footballService";

async function main() {
  const l = await getMatchLineups(1);
  console.log(JSON.stringify(l, null, 2));
  process.exit(0);
}
main();

