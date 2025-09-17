import { z } from "zod";
import { UnifiedTool } from "./registry.js";
import {
  executeGeminiCLI,
  processChangeModeOutput,
} from "../utils/geminiExecutor.js";
import { ERROR_MESSAGES, STATUS_MESSAGES } from "../constants.js";

const askGeminiArgsSchema = z.object({
  prompt: z
    .string()
    .min(1)
    .describe(
      "Analysis request. Use @ syntax to include files (e.g., '@largefile.js explain what this does') or ask general questions",
    ),
  // === START OF EDIT ===
  model: z
    .enum(['gemini-2.5-pro', 'gemini-1.5-pro', 'gemini-1.5-flash'])
    .default('gemini-2.5-pro')
    .describe(
      "Optional model to use. If not specified, uses the default model (gemini-2.5-pro).",
    ),
  // === END OF EDIT ===
  sandbox: z
    .boolean()
    .default(false)
    .describe(
      "Use sandbox mode (-s flag) to safely test code changes, execute scripts, or run potentially risky operations in an isolated environment",
    ),
  changeMode: z
    .boolean()
    .default(false)
    .describe(
      "Enable structured change mode - formats prompts to prevent tool errors and returns structured edit suggestions that Claude can apply directly",
    ),
  chunkIndex: z
    .union([z.number(), z.string()])
    .optional()
    .describe("Which chunk to return (1-based)"),
  chunkCacheKey: z
    .string()
    .optional()
    .describe("Optional cache key for continuation"),
});

type AskGeminiArgs = z.infer<typeof askGeminiArgsSchema>;

export const askGeminiTool: UnifiedTool<AskGeminiArgs> = {
  name: "ask-gemini",
  description:
    "model selection [-m], sandbox [-s], and changeMode:boolean for providing edits",
  zodSchema: askGeminiArgsSchema,
  prompt: {
    description:
      "Execute 'gemini -p <prompt>' to get Gemini AI's response. Supports enhanced change mode for structured edit suggestions.",
  },
  category: "gemini",
  execute: async (args: AskGeminiArgs, onProgress) => {
    const { prompt, model, sandbox, changeMode, chunkIndex, chunkCacheKey } =
      args;
    if (!prompt?.trim()) {
      throw new Error(ERROR_MESSAGES.NO_PROMPT_PROVIDED);
    }

    if (changeMode && chunkIndex && chunkCacheKey) {
      return processChangeModeOutput(
        "", // empty for cache...
        Number(chunkIndex),
        chunkCacheKey,
        prompt,
      );
    }

    const result = await executeGeminiCLI(
      prompt,
      model,
      !!sandbox,
      !!changeMode,
      onProgress,
    );

    if (changeMode) {
      return processChangeModeOutput(
        result,
        chunkIndex !== undefined ? Number(chunkIndex) : undefined,
        undefined,
        prompt,
      );
    }
    return `${STATUS_MESSAGES.GEMINI_RESPONSE}\n${result}`; // changeMode false
  },
};
