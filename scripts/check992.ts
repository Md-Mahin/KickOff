import { pool } from "../backend/src/db";
import { executeMatchDetailPipeline, pullMatchDetailsFromDatabase } from "../backend/src/services/matchPipelineService";
import { layoutFormation, parseFormationLines } from "../src/components/matches/match-lineups";

async function main() {
  const pipelineResult = await executeMatchDetailPipeline(992);
  console.log("Pipeline Data Source:", (pipelineResult as any)._pipelineMetadata?.source);
  console.log("Pipeline Status:", pipelineResult.fixture?.status?.short);
  console.log("Pipeline Goals:", pipelineResult.goals);
  console.log("Pipeline Events Count:", pipelineResult.events?.length);

  const pulled = await pullMatchDetailsFromDatabase(992);
  const bayern = pulled?.lineups?.find((l: any) => l.team.name === "Bayern Munich");
  const psg = pulled?.lineups?.find((l: any) => l.team.name.includes("Paris"));
  console.log("Match Status:", pulled?.fixture?.status?.short);
  console.log("Match Goals:", pulled?.goals);
  console.log("Match Events Count:", pulled?.events?.length);
  console.log("Bayern Coach:", bayern?.coach);
  console.log("PSG Coach:", psg?.coach);
  console.log("Bayern formation:", bayern?.formation);
  console.log("Bayern starters count:", bayern?.starters?.length);
  console.log("Bayern starters:", bayern?.starters?.map((s: any) => ({ name: s.name, pos: s.position, num: s.number })));

  const parsedLines = parseFormationLines(bayern?.formation);
  console.log("Parsed lines:", parsedLines);

  const laidOut = layoutFormation(bayern?.starters || [], bayern?.formation, "home");
  console.log("Laid out players count:", laidOut.length);
  for (const p of laidOut) {
    console.log(`Line ${p.lineIndex} [${p.indexInLine + 1}/${p.totalInLine}]: ${p.player.name} (${p.player.position} #${p.player.number}) -> left: ${p.position.left}, top: ${p.position.top}`);
  }

  console.log("\nPSG formation:", psg?.formation);
  const laidOutPsg = layoutFormation(psg?.starters || [], psg?.formation, "away");
  console.log("Laid out PSG count:", laidOutPsg.length);
  for (const p of laidOutPsg) {
    console.log(`Line ${p.lineIndex} [${p.indexInLine + 1}/${p.totalInLine}]: ${p.player.name} (${p.player.position} #${p.player.number}) -> left: ${p.position.left}, top: ${p.position.top}`);
  }

  await pool.end();
}

main().catch(console.error);
