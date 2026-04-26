import { exec } from "child_process";
import { platform } from "os";

// We pass the --pretty (for tsc) and --color (for eslint) flags
const command = "npm run tsc && npm run lint";

// Force the environment to accept colors, deceiving tools into thinking they are in a real terminal
const env = { ...process.env, FORCE_COLOR: "1" };

console.log("⏳ Running detailed checks (tsc and eslint)...");

exec(command, { env }, (error, stdout, stderr) => {
  const rawOutput = stdout + (stderr ? "\n" + stderr : "");

  // 1. Shows the log in the terminal EXACTLY as original, preserving colors and code indentation
  console.log(rawOutput);

  if (error) {
    // 2. Removes ANSI color codes to avoid cluttering your clipboard
    // This ensures that you only paste clean and readable text in chat or on GitHub
    const cleanOutput = rawOutput.replace(/\x1B\[\d+(;\d+)*[mK]/g, "");

    // 3. Robust clipboard command.
    // The fallback to wl-copy ensures that the copy works perfectly if you
    // are running a modern interface (like KDE Plasma under Wayland).
    const copyCmd =
      platform() === "darwin"
        ? "pbcopy"
        : platform() === "win32"
          ? "clip"
          : "wl-copy || xclip -selection clipboard";

    const clipProcess = exec(copyCmd);
    clipProcess.stdin.write(cleanOutput);
    clipProcess.stdin.end();

    console.log("\n❌ Errors found! The detailed output has been copied cleanly to the clipboard.");
    process.exit(1);
  } else {
    console.log("\n✅ All good! No errors found.");
  }
});
