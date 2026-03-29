import cfonts from "cfonts";
import { VERSION } from "@pwnkit/shared";

/**
 * Print the pwnkit banner. Called once before Ink takes over.
 * Shared between the interactive menu and the scan TUI.
 */
export function printBanner(subtitle?: string): void {
  const r = "\x1b[31m";
  const d = "\x1b[2m";
  const b = "\x1b[1m";
  const x = "\x1b[0m";

  console.log("");
  try {
    cfonts.say(`pwnkit|v${VERSION}`, {
      font: "tiny",
      colors: ["red", "gray"],
      space: false,
    });
  } catch {
    console.log(`  ${r}${b}pwnkit${x} ${d}v${VERSION}${x}`);
  }
  if (subtitle) {
    console.log(`  ${d}${subtitle}${x}`);
  }
  console.log("");
}
