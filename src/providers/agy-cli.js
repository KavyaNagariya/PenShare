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
  const candidates = process.platform === "win32" && !path.extname(name) ? [".exe", ".cmd", ".bat"].map(ext => `${name}${ext}`) : [name];
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

function resolveAgyLaunch(configuredPath = "agy", env = process.env) {
  const requested = String(configuredPath || "agy").trim();
  const hasDirectory = path.isAbsolute(requested) || requested.includes("/") || requested.includes("\\");
  const executable = hasDirectory ? path.resolve(requested) : findOnPath(requested, env);
  if (!executable) throw new Error("Antigravity CLI (agy) was not found in PATH.");
  return { command: executable, prefixArgs: [] };
}

function buildAgyArgs({ model, effort }) {
  const args = ["--output-format", "text", "--dangerously-skip-permissions", "--disable-slash-commands"];
  const trimmedModel = String(model || "").trim();
  const selectedModel = trimmedModel && trimmedModel !== "default" ? trimmedModel : "";

  if (selectedModel) {
    const hasEffortSuffix = /-(low|medium|high|max)$/i.test(selectedModel);
    if (hasEffortSuffix) {
      args.push("--model", selectedModel);
    } else {
      args.push("--model", selectedModel);
      if (effort && effort !== "none" && effort !== "config") {
        args.push("--effort", String(effort).trim());
      }
    }
  } else if (effort && effort !== "none" && effort !== "config") {
    args.push("--effort", String(effort).trim());
  }

  return args;
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

async function callAgyCli(options = {}) {
  const { prompt, model, effort, atlasImage, placement, env = process.env, onChunk, signal } = options;
  const launch = resolveAgyLaunch(env.AGY_CLI_PATH || "agy", env);

  let workDir = null;
  try {
    workDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), "penshare-agy-"));
    let fullPrompt = String(prompt || "");

    if (atlasImage) {
      const decoded = decodeAtlasImage(atlasImage);
      if (decoded) {
        const imagePath = path.join(workDir, `canvas.${decoded.extension}`);
        await fs.promises.writeFile(imagePath, decoded.buffer);
        fullPrompt += `\n\n[Canvas Image Context]: The screenshot of the user's canvas and handwriting has been saved to '${path.basename(imagePath)}' in the workspace. Read/inspect this image to see what the user drew or wrote on the canvas.`;
      }
    }

    const promptFile = path.join(workDir, "PROMPT.md");
    await fs.promises.writeFile(promptFile, fullPrompt, "utf8");

    const execPrompt = "Read and execute the task in PROMPT.md in the current workspace directory. Follow all its instructions and output the requested JSON response.";
    const args = ["-p", execPrompt, ...buildAgyArgs({ model, effort })];

    return await new Promise((resolve, reject) => {
      if (signal?.aborted) return reject(new Error("Request aborted"));

      const child = spawn(launch.command, [...launch.prefixArgs, ...args], {
        cwd: workDir,
        env: { ...process.env, ...env },
        stdio: ["ignore", "pipe", "pipe"],
        windowsHide: true,
      });

      let stdout = "";
      let stderr = "";

      if (signal) {
        signal.addEventListener("abort", () => {
          try { child.kill(); } catch {}
          reject(new Error("Request aborted"));
        }, { once: true });
      }

      child.stdout.on("data", chunk => {
        const text = chunk.toString("utf8");
        stdout += text;
        if (typeof onChunk === "function") {
          onChunk(text);
        }
      });

      child.stderr.on("data", chunk => {
        stderr += chunk.toString("utf8");
      });

      child.on("error", err => {
        reject(new Error(`Failed to run agy CLI: ${err.message}`));
      });

      child.on("close", code => {
        if (code !== 0 && !stdout.trim()) {
          return reject(new Error(`agy CLI exited with code ${code}: ${stderr || stdout}`));
        }

        const trimmed = stdout.trim();
        const candidates = completeTopLevelJsonObjects(trimmed).filter(isFinalModelResponse);
        if (candidates.length > 0) {
          return resolve(trimmed);
        }

        const cleanText = trimmed
          .replace(/```(?:json)?[\s\S]*?```/g, "")
          .trim() || trimmed;

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

async function callAgyCanvasAgentCli(options = {}) {
  const { prompt, model, effort, atlasImage, executable, env = process.env, onText, onActivity, signal } = options;
  const launch = resolveAgyLaunch(executable || env.AGY_CLI_PATH || "agy", env);

  let workDir = null;
  try {
    workDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), "penshare-agy-"));
    let fullPrompt = String(prompt || "");

    const images = (Array.isArray(atlasImage) ? atlasImage : atlasImage ? [atlasImage] : []).filter(Boolean).slice(0, 5);
    for (let index = 0; index < images.length; index++) {
      const decoded = decodeAtlasImage(images[index]);
      if (decoded) {
        const imagePath = path.join(workDir, `canvas-${index + 1}.${decoded.extension}`);
        await fs.promises.writeFile(imagePath, decoded.buffer);
        fullPrompt += `\n\n[Canvas Image Context]: A screenshot of the canvas is saved at '${path.basename(imagePath)}'. Read/inspect this image to see what the user drew or wrote on the canvas.`;
      }
    }

    const promptFile = path.join(workDir, "PROMPT.md");
    await fs.promises.writeFile(promptFile, fullPrompt, "utf8");

    const execPrompt = "Read PROMPT.md in the current directory. Follow all instructions and output the requested response directly.";
    const args = ["-p", execPrompt, ...buildAgyArgs({ model, effort })];

    return await new Promise((resolve, reject) => {
      if (signal?.aborted) return reject(new Error("Request aborted"));

      const child = spawn(launch.command, [...launch.prefixArgs, ...args], {
        cwd: workDir,
        env: { ...process.env, ...env },
        stdio: ["ignore", "pipe", "pipe"],
        windowsHide: true,
      });

      let stdout = "";
      let stderr = "";

      const activityHeartbeat = setInterval(() => {
        try { onActivity?.(); } catch {}
      }, 4000);

      if (signal) {
        signal.addEventListener("abort", () => {
          clearInterval(activityHeartbeat);
          try { child.kill(); } catch {}
          reject(new Error("Request aborted"));
        }, { once: true });
      }

      child.stdout.on("data", chunk => {
        const text = chunk.toString("utf8");
        stdout += text;
        try { onActivity?.(); } catch {}
        try { onText?.(text); } catch {}
      });

      child.stderr.on("data", chunk => {
        stderr += chunk.toString("utf8");
        try { onActivity?.(); } catch {}
      });

      child.on("error", err => {
        clearInterval(activityHeartbeat);
        reject(new Error(`Failed to run agy CLI: ${err.message}`));
      });

      child.on("close", code => {
        clearInterval(activityHeartbeat);
        if (code !== 0 && !stdout.trim()) {
          return reject(new Error(`agy CLI exited with code ${code}: ${stderr || stdout}`));
        }
        const decision = extractHarnessDecisionJson(stdout.trim());
        resolve(decision);
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
  resolveAgyLaunch,
  callAgyCli,
  callAgyCanvasAgentCli,
};
