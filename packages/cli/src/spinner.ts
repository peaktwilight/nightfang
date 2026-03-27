import chalk from "chalk";

/**
 * Nightfang branded CLI spinner.
 *
 * Uses the fang diamond motif with eye-blink animation frames,
 * rendered via raw stdout writes for zero-dependency terminal animation.
 */

// ── Frames ──
// The fang cycles through diamond variants while the "eyes" blink.
// Keeps it minimal and on-brand: crimson diamond with subtle state changes.

const FRAMES = [
  "◆",  // solid — eyes open
  "◆",  // solid — eyes open  (hold)
  "◇",  // outline — blink
  "◆",  // solid — eyes open
  "◈",  // enclosed — pulse
  "◆",  // solid — eyes open
  "◆",  // solid — eyes open  (hold)
  "◇",  // outline — blink
] as const;

const INTERVAL_MS = 120;

export interface NightfangSpinner {
  /** Begin the animation. Idempotent — calling twice is safe. */
  start(): NightfangSpinner;
  /** Freeze the spinner and clear its line. */
  stop(): NightfangSpinner;
  /** Replace the trailing text without restarting. */
  update(text: string): NightfangSpinner;
  /** Stop with a success marker. */
  succeed(text?: string): NightfangSpinner;
  /** Stop with a failure marker. */
  fail(text?: string): NightfangSpinner;
  /** Stop with a warning marker. */
  warn(text?: string): NightfangSpinner;
}

export function createNightfangSpinner(text: string): NightfangSpinner {
  let frameIndex = 0;
  let timer: ReturnType<typeof setInterval> | null = null;
  let currentText = text;
  let lineLength = 0;

  const stream = process.stderr;
  const isInteractive = stream.isTTY !== false;

  function clearLine() {
    if (!isInteractive) return;
    stream.write("\r" + " ".repeat(lineLength) + "\r");
  }

  function render() {
    const frame = FRAMES[frameIndex % FRAMES.length];
    const line = `  ${chalk.red(frame)} ${chalk.gray(currentText)}`;
    clearLine();
    stream.write(line);
    // Track raw length (without ANSI codes) for clearing
    lineLength = stripAnsi(line).length;
    frameIndex++;
  }

  function stopTimer() {
    if (timer !== null) {
      clearInterval(timer);
      timer = null;
    }
  }

  function writeFinalLine(icon: string, msg: string) {
    stopTimer();
    clearLine();
    stream.write(`  ${icon} ${msg}\n`);
    lineLength = 0;
  }

  const spinner: NightfangSpinner = {
    start() {
      if (timer !== null) return spinner;
      frameIndex = 0;
      render();
      timer = setInterval(render, INTERVAL_MS);
      return spinner;
    },

    stop() {
      stopTimer();
      clearLine();
      return spinner;
    },

    update(newText: string) {
      currentText = newText;
      return spinner;
    },

    succeed(msg?: string) {
      const finalText = msg ?? currentText;
      writeFinalLine(chalk.green("✓"), chalk.gray(finalText));
      return spinner;
    },

    fail(msg?: string) {
      const finalText = msg ?? currentText;
      writeFinalLine(chalk.red("✗"), chalk.red(finalText));
      return spinner;
    },

    warn(msg?: string) {
      const finalText = msg ?? currentText;
      writeFinalLine(chalk.yellow("!"), chalk.yellow(finalText));
      return spinner;
    },
  };

  return spinner;
}

// ── Helpers ──

/** Strip ANSI escape codes to get the visible character count. */
function stripAnsi(str: string): string {
  // eslint-disable-next-line no-control-regex
  return str.replace(/\x1B\[[0-9;]*m/g, "");
}
