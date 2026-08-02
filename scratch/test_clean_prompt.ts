import { repairLatex } from "../src/lib/latex-repair";

function testCleanFormatting() {
  const badPrompt = "An object moves in a straight line with an initial velocity of 10extm/s and a constant acceleration of 2extm/s^2 . If the object covers a distance of 60extm in the first 4exts , what is its final velocity?";
  const badOptionA = "18extm/s";

  console.log("BAD PROMPT BEFORE:", badPrompt);
  console.log("REPAIRED PROMPT:  ", repairLatex(badPrompt));

  console.log("\nBAD OPTION BEFORE:", badOptionA);
  console.log("REPAIRED OPTION:  ", repairLatex(badOptionA));
}

testCleanFormatting();
