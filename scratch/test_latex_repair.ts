import { repairLatex } from "../src/lib/latex-repair";

function testTimesFix() {
  const cases = [
    "Two point charges, q1 = 2imes10^{-6}C and q2 = -3imes10^{-6}C, are separated by a distance of 10cm.",
    "A. 9imes10^{4}V",
    "B. -9imes10^{4}V",
    "C. 5imes10^{4}V",
    "D. 0V",
    "q1 = 2\\times10^{-6}C",
    "q1 = 2\times10^{-6}C", // with literal tab ASCII 0x09 before imes
  ];

  console.log("--- TIMES & UNIT REPAIR TESTS ---");
  for (const c of cases) {
    console.log("BEFORE:", JSON.stringify(c));
    console.log("AFTER: ", JSON.stringify(repairLatex(c)));
    console.log("---");
  }
}

testTimesFix();
