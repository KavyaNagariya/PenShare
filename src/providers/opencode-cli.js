"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawn } = require("child_process");
const { completeTopLevelJsonObjects } = require("../server/model-content.js");

const DEBUG_INTENTS = new Set(["none", "hint", "continue", "explain", "plot", "correct", "erase", "answer", "typeset"]);

function isFinalModelResponse(value) {
  return Boolean(
    value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    DEBUG_INTENTS.has(value.intent) &&
    Object.prototype.hasOwnProperty.call(value, "commands") &&
    Array.isArray(value.commands)
  );
}

function decodeAtlasImage(dataUrl) {
  const match = /^data:image\/(png|webp);base64,([A-Za-z0-9+/]+={0,2})$/i.exec(String(dataUrl || ""));
  if (!match) return null;
  const format = match[1].toLowerCase();
  return { buffer: Buffer.from(match[2], "base64"), extension: format };
}

function findOnPath(name, env = process.env) {
  const directories = String(env.PATH || env.Path || "").split(path.delimiter).filter(Boolean);
  const candidates = process.platform === "win32" && !path.extname(name) ? [".cmd", ".ps1", ".exe", ".bat"].map(ext => `${name}${ext}`) : [name];
  for (const directory of directories) {
    for (const candidate of candidates) {
      const file = path.join(directory.replace(/^"|"$/g, ""), candidate);
      try {
        if (fs.statSync(file).isFile()) return file;
      } catch {}
    }
  }
  return null;
}

function resolveOpenCodeLaunch(configuredPath = "opencode", env = process.env) {
  const requested = String(configuredPath || "opencode").trim();
  const hasDirectory = path.isAbsolute(requested) || requested.includes("/") || requested.includes("\\");
  const executable = hasDirectory ? path.resolve(requested) : findOnPath(requested, env);
  if (!executable) throw new Error("OpenCode CLI (opencode) was not found in PATH.");
  
  if (process.platform === "win32") {
    const npmExe = path.join(path.dirname(executable), "node_modules", "opencode-ai", "bin", "opencode.exe");
    if (fs.existsSync(npmExe)) {
      return { command: npmExe, prefixArgs: [] };
    }
    const ext = path.extname(executable).toLowerCase();
    if (ext === ".ps1") {
      return { command: "powershell.exe", prefixArgs: ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", executable] };
    }
    if (ext === ".cmd" || ext === ".bat") {
      return { command: "cmd.exe", prefixArgs: ["/c", executable] };
    }
  }
  return { command: executable, prefixArgs: [] };
}

async function callOpenCodeCli(options = {}) {
  const { prompt, model, atlasImage, placement, env = process.env, onChunk, signal } = options;
  const launch = resolveOpenCodeLaunch(env.OPENCODE_CLI_PATH || "opencode", env);

  let workDir = null;
  let imageFile = null;
  try {
    workDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), "penshare-opencode-"));
    let fullPrompt = String(prompt || "");

    if (atlasImage) {
      const decoded = decodeAtlasImage(atlasImage);
      if (decoded) {
        imageFile = path.join(workDir, `canvas.${decoded.extension}`);
        await fs.promises.writeFile(imageFile, decoded.buffer);
        fullPrompt += `\n\n[Canvas Image Context]: The screenshot of the user's canvas and handwriting is attached as '${path.basename(imageFile)}'. Read/inspect this image to see what the user drew or wrote on the canvas.`;
      }
    }

    const args = ["run", "--format", "json", "--auto", "--dir", workDir];
    if (imageFile) {
      args.push("-f", imageFile);
    }
    if (model) {
      args.push("-m", model);
    }
    // Use -- to prevent opencode from interpreting the prompt as an additional -f file argument
    args.push("--", fullPrompt);

    return await new Promise((resolve, reject) => {
      if (signal?.aborted) return reject(new Error("Request aborted"));

      const child = spawn(launch.command, [...launch.prefixArgs, ...args], {
        cwd: workDir,
        env: { ...process.env, ...env },
        stdio: ["ignore", "pipe", "pipe"],
        windowsHide: true,
      });

      let accumulatedText = "";
      let stderr = "";

      if (signal) {
        signal.addEventListener("abort", () => {
          try { child.kill(); } catch {}
          reject(new Error("Request aborted"));
        }, { once: true });
      }

      let lineBuffer = "";
      child.stdout.on("data", chunk => {
        lineBuffer += chunk.toString("utf8");
        const lines = lineBuffer.split("\n");
        lineBuffer = lines.pop(); // keep last incomplete line

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const ev = JSON.parse(line);
            if (ev.type === "text" && ev.part?.text) {
              accumulatedText += ev.part.text;
              if (typeof onChunk === "function") {
                onChunk(ev.part.text);
              }
            }
          } catch {}
        }
      });

      child.stderr.on("data", chunk => {
        stderr += chunk.toString("utf8");
      });

      child.on("error", err => {
        reject(new Error(`Failed to run opencode CLI: ${err.message}`));
      });

      child.on("close", code => {
        // Flush any remaining buffer
        if (lineBuffer.trim()) {
          try {
            const ev = JSON.parse(lineBuffer.trim());
            if (ev.type === "text" && ev.part?.text) {
              accumulatedText += ev.part.text;
            }
          } catch {}
        }

        if (code !== 0 && !accumulatedText.trim()) {
          return reject(new Error(`opencode CLI exited with code ${code}: ${stderr}`));
        }

        const trimmed = accumulatedText.trim();
        const candidates = completeTopLevelJsonObjects(trimmed).filter(isFinalModelResponse);
        if (candidates.length > 0) {
          return resolve(trimmed);
        }

        const cleanText = trimmed
          .replace(/```(?:json)?[\s\S]*?```/g, "")
          .trim() || trimmed || "Processed by OpenCode CLI";

        const posX = Math.round(Number(placement?.x) || 150);
        const posY = Math.round(Number(placement?.y) || 150);

        const fallback = JSON.stringify({
          intent: "answer",
          commands: [
            {
              tool: "write_text",
              text: cleanText,
              x: posX,
              y: posY,
            }
          ]
        });

        resolve(fallback);
      });
    });
  } finally {
    if (workDir) {
      try {
        await fs.promises.rm(workDir, { recursive: true, force: true });
      } catch {}
    }
  }
}

function extractHarnessDecisionJson(rawText) {
  const text = String(rawText || "").trim();
  if (!text) return JSON.stringify({ type: "final", text: "" });

  try {
    const parsed = JSON.parse(text);
    if (parsed && typeof parsed === "object") return text;
  } catch {}

  const codeBlockMatch = /```(?:json)?\s*([\s\S]*?)\s*```/i.exec(text);
  if (codeBlockMatch) {
    try {
      const parsed = JSON.parse(codeBlockMatch[1].trim());
      if (parsed && typeof parsed === "object") return codeBlockMatch[1].trim();
    } catch {}
  }

  let firstBrace = text.indexOf("{");
  let lastBrace = text.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    const candidate = text.slice(firstBrace, lastBrace + 1);
    try {
      const parsed = JSON.parse(candidate);
      if (parsed && typeof parsed === "object") return candidate;
    } catch {}
  }

  return JSON.stringify({
    type: "final",
    text: text
  });
}

async function callOpenCodeCanvasAgentCli(options = {}) {
  const { prompt, model, atlasImage, executable, env = process.env, onText, onActivity, signal } = options;
  const launch = resolveOpenCodeLaunch(executable || env.OPENCODE_CLI_PATH || "opencode", env);

  let workDir = null;
  let imageFile = null;
  try {
    workDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), "penshare-opencode-"));
    let fullPrompt = String(prompt || "");

    if (atlasImage) {
      const decoded = decodeAtlasImage(Array.isArray(atlasImage) ? atlasImage[0] : atlasImage);
      if (decoded) {
        imageFile = path.join(workDir, `canvas.${decoded.extension}`);
        await fs.promises.writeFile(imageFile, decoded.buffer);
        fullPrompt += `\n\n[Canvas Image Context]: The screenshot of the user's canvas and handwriting is attached as '${path.basename(imageFile)}'. Read/inspect this image to see what the user drew or wrote on the canvas.`;
      }
    }

    const args = ["run", "--format", "json", "--auto", "--dir", workDir];
    if (imageFile) {
      args.push("-f", imageFile);
    }
    const trimmedModel = String(model || "").trim();
    if (trimmedModel && trimmedModel !== "default") {
      args.push("-m", trimmedModel);
    }
    args.push("--", fullPrompt);

    return await new Promise((resolve, reject) => {
      if (signal?.aborted) return reject(new Error("Request aborted"));

      const child = spawn(launch.command, [...launch.prefixArgs, ...args], {
        cwd: workDir,
        env: { ...process.env, ...env },
        stdio: ["ignore", "pipe", "pipe"],
        windowsHide: true,
      });

      let accumulatedText = "";
      let stderr = "";

      if (signal) {
        signal.addEventListener("abort", () => {
          try { child.kill(); } catch {}
          reject(new Error("Request aborted"));
        }, { once: true });
      }

      let lineBuffer = "";
      child.stdout.on("data", chunk => {
        lineBuffer += chunk.toString("utf8");
        const lines = lineBuffer.split("\n");
        lineBuffer = lines.pop();

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const ev = JSON.parse(line);
            if (ev.type === "text" && ev.part?.text) {
              accumulatedText += ev.part.text;
              try { onActivity?.(); } catch {}
              try { onText?.(ev.part.text); } catch {}
            }
          } catch {}
        }
      });

      child.stderr.on("data", chunk => {
        stderr += chunk.toString("utf8");
        try { onActivity?.(); } catch {}
      });

      child.on("error", err => {
        reject(new Error(`Failed to run opencode CLI: ${err.message}`));
      });

      child.on("close", code => {
        if (lineBuffer.trim()) {
          try {
            const ev = JSON.parse(lineBuffer.trim());
            if (ev.type === "text" && ev.part?.text) {
              accumulatedText += ev.part.text;
            }
          } catch {}
        }

        if (code !== 0 && !accumulatedText.trim()) {
          return reject(new Error(`opencode CLI exited with code ${code}: ${stderr}`));
        }

        resolve(extractHarnessDecisionJson(accumulatedText.trim()));
      });
    });
  } finally {
    if (workDir) {
      try {
        await fs.promises.rm(workDir, { recursive: true, force: true });
      } catch {}
    }
  }
}

module.exports = {
  resolveOpenCodeLaunch,
  callOpenCodeCli,
  callOpenCodeCanvasAgentCli,
};
