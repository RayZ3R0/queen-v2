export class Logger {
  static spinners = new Map();
  static startTime = Date.now();
  static spinnerFrames = ["-", "\\", "|", "/"];
  static spinnerIndex = 0;
  static spinnerIntervals = new Map();

  static showTitle() {
    const title = [
      "===============================",
      "         WHITE QUEEN          ",
      "===============================",
    ];
    console.log("\n" + title.join("\n"));
    return Promise.resolve();
  }

  static createBox(title, content) {
    const width = Math.max(title.length, ...content.map((line) => line.length));

    const hr = "+=" + "=".repeat(width + 2) + "=+";
    const titleLine = `| ${title.padEnd(width + 2)} |`;
    const lines = content.map((line) => `| ${line.padEnd(width + 2)} |`);

    return [hr, titleLine, hr.replace(/=/g, "-"), ...lines, hr].join("\n");
  }

  static createProgressBar(current, total, size = 15) {
    const percentage = current / total;
    const progress = Math.round(size * percentage);
    const emptyProgress = size - progress;
    const progressText = "=".repeat(progress) + ">";
    const emptyProgressText = " ".repeat(emptyProgress);
    const percentageText = Math.round(percentage * 100) + "%";
    return `[${progressText}${emptyProgressText}] ${current}/${total} (${percentageText})`;
  }

  static startSpinner(text) {
    const spinnerId = Date.now().toString();
    this.spinners.set(spinnerId, text);

    const interval = setInterval(() => {
      this.spinnerIndex = (this.spinnerIndex + 1) % this.spinnerFrames.length;
      const frame = this.spinnerFrames[this.spinnerIndex];
      process.stdout.write(`\r${frame} ${text}`);
    }, 100);

    this.spinnerIntervals.set(spinnerId, interval);
    return spinnerId;
  }

  static updateSpinner(spinnerId, newText) {
    if (this.spinners.has(spinnerId)) {
      this.spinners.set(spinnerId, newText);
    }
  }

  static succeedSpinner(spinnerId) {
    if (this.spinners.has(spinnerId)) {
      const text = this.spinners.get(spinnerId);
      clearInterval(this.spinnerIntervals.get(spinnerId));
      this.spinners.delete(spinnerId);
      this.spinnerIntervals.delete(spinnerId);
      process.stdout.write(`\r+ ${text} ... done\n`);
    }
  }

  static formatLoadingSection(title, items, loading = false) {
    const lines = [];
    lines.push(title);
    items.forEach((item) => {
      if (typeof item === "string") {
        lines.push(`  ${loading ? "*" : "+"} ${item}`);
      } else {
        lines.push(`  ${item.icon || "+"} ${item.text}`);
      }
    });
    return lines;
  }

  static showStats() {
    const endTime = Date.now();
    const duration = ((endTime - this.startTime) / 1000).toFixed(2);
    const memory = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2);

    return this.createBox("System Stats", [
      `[+] Bot is fully operational`,
      `[*] Memory Usage: ${memory} MB`,
      `[*] Startup Time: ${duration}s`,
    ]);
  }

  static debug(message) {
    console.log(`[DEBUG] ${message}`);
  }

  static info(message) {
    console.log(`[INFO] ${message}`);
  }

  static warn(message) {
    console.warn(`[WARN] ${message}`);
  }

  static error(message, error = null) {
    if (error) {
      console.error(`[ERROR] ${message}:`, error);
    } else {
      console.error(`[ERROR] ${message}`);
    }
  }
}
