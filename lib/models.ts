export interface ModelConfig {
  id: string;
  isFree: boolean;
  upstreamModel: string;
  displayName: string;
  category: 'free' | 'claude' | 'gpt' | 'gemini' | 'specialist';
  description: string;
  inputPrice: string;  // per 1M tokens
  outputPrice: string; // per 1M tokens
}

export const MODELS: Record<string, ModelConfig> = {
  // --- Free Tier ---
  "deepseek-v4-flash-free": {
    id: "deepseek-v4-flash-free",
    isFree: true,
    upstreamModel: "deepseek-v4-flash-free",
    displayName: "DeepSeek V4 Flash (Free)",
    category: "free",
    description: "Ultra-fast code editing and completion model. Perfect for daily coding assistant tasks and inline autocomplete.",
    inputPrice: "0.00",
    outputPrice: "0.00"
  },
  "mimo-v2.5-free": {
    id: "mimo-v2.5-free",
    isFree: true,
    upstreamModel: "mimo-v2.5-free",
    displayName: "MiMo V2.5 (Free)",
    category: "free",
    description: "Multi-modal model optimized for general conversation, chat explanation, and simple scripts.",
    inputPrice: "0.00",
    outputPrice: "0.00"
  },
  "qwen3.6-plus-free": {
    id: "qwen3.6-plus-free",
    isFree: true,
    upstreamModel: "qwen3.6-plus-free",
    displayName: "Qwen 3.6 Plus (Free)",
    category: "free",
    description: "Highly capable coding and reasoning specialist model. Great for explaining complex algorithms.",
    inputPrice: "0.00",
    outputPrice: "0.00"
  },
  "minimax-m3-free": {
    id: "minimax-m3-free",
    isFree: true,
    upstreamModel: "minimax-m3-free",
    displayName: "MiniMax M3 (Free)",
    category: "free",
    description: "Fast conversational assistant. Optimized for quick questions and high-concurrency tasks.",
    inputPrice: "0.00",
    outputPrice: "0.00"
  },
  "nemotron-3-ultra-free": {
    id: "nemotron-3-ultra-free",
    isFree: true,
    upstreamModel: "nemotron-3-ultra-free",
    displayName: "Nemotron 3 Ultra (Free)",
    category: "free",
    description: "NVIDIA-tuned instruction-following model. Excels at generating structured guides and text outlines.",
    inputPrice: "0.00",
    outputPrice: "0.00"
  },
  "north-mini-code-free": {
    id: "north-mini-code-free",
    isFree: true,
    upstreamModel: "north-mini-code-free",
    displayName: "North Mini Code (Free)",
    category: "free",
    description: "Lightweight model optimized for low-latency coding responses, debugging, and terminal scripts.",
    inputPrice: "0.00",
    outputPrice: "0.00"
  },

  // --- Claude 4/5 & Grok ---
  "claude-fable-5": {
    id: "claude-fable-5",
    isFree: false,
    upstreamModel: "claude-fable-5",
    displayName: "Claude Fable 5",
    category: "claude",
    description: "Next-generation research and agentic execution flagship model. Top-tier planning capabilities.",
    inputPrice: "8.00",
    outputPrice: "24.00"
  },
  "claude-opus-4-8": {
    id: "claude-opus-4-8",
    isFree: false,
    upstreamModel: "claude-opus-4-8",
    displayName: "Claude 4.8 Opus",
    category: "claude",
    description: "Advanced cognitive reasoning model. Ultimate coding, logic synthesis, and architectural design engine.",
    inputPrice: "15.00",
    outputPrice: "75.00"
  },
  "claude-opus-4-7": {
    id: "claude-opus-4-7",
    isFree: false,
    upstreamModel: "claude-opus-4-7",
    displayName: "Claude 4.7 Opus",
    category: "claude",
    description: "Highly complex logic and math solver. Exceptional code refactoring of large enterprise projects.",
    inputPrice: "15.00",
    outputPrice: "75.00"
  },
  "claude-opus-4-6": {
    id: "claude-opus-4-6",
    isFree: false,
    upstreamModel: "claude-opus-4-6",
    displayName: "Claude 4.6 Opus",
    category: "claude",
    description: "Deep reasoning engine optimized for complex task loops and multi-agent system execution.",
    inputPrice: "15.00",
    outputPrice: "75.00"
  },
  "claude-opus-4-5": {
    id: "claude-opus-4-5",
    isFree: false,
    upstreamModel: "claude-opus-4-5",
    displayName: "Claude 4.5 Opus",
    category: "claude",
    description: "Flagship intelligence for deep-thinking tasks, code synthesis, and multi-file code editing.",
    inputPrice: "15.00",
    outputPrice: "75.00"
  },
  "claude-opus-4-1": {
    id: "claude-opus-4-1",
    isFree: false,
    upstreamModel: "claude-opus-4-1",
    displayName: "Claude 4.1 Opus",
    category: "claude",
    description: "Original deep cognitive model. Excels at planning complex software architecture integrations.",
    inputPrice: "15.00",
    outputPrice: "75.00"
  },
  "claude-sonnet-4-6": {
    id: "claude-sonnet-4-6",
    isFree: false,
    upstreamModel: "claude-sonnet-4-6",
    displayName: "Claude 4.6 Sonnet",
    category: "claude",
    description: "Balanced speed and highly advanced reasoning. Ideal choice for autonomous agent workspace sessions.",
    inputPrice: "3.00",
    outputPrice: "15.00"
  },
  "claude-sonnet-4-5": {
    id: "claude-sonnet-4-5",
    isFree: false,
    upstreamModel: "claude-sonnet-4-5",
    displayName: "Claude 4.5 Sonnet",
    category: "claude",
    description: "Excellent code editing, debugging speed, and comprehensive system documentation.",
    inputPrice: "3.00",
    outputPrice: "15.00"
  },
  "claude-sonnet-4": {
    id: "claude-sonnet-4",
    isFree: false,
    upstreamModel: "claude-sonnet-4",
    displayName: "Claude 4 Sonnet",
    category: "claude",
    description: "High-performance coding model. Incredible speed for day-to-day coding tasks.",
    inputPrice: "3.00",
    outputPrice: "15.00"
  },
  "claude-haiku-4-5": {
    id: "claude-haiku-4-5",
    isFree: false,
    upstreamModel: "claude-haiku-4-5",
    displayName: "Claude 4.5 Haiku",
    category: "claude",
    description: "Blazing fast lightweight intelligence. Perfect for lightning quick completions and syntax checks.",
    inputPrice: "0.25",
    outputPrice: "1.25"
  },
  "grok-build-0.1": {
    id: "grok-build-0.1",
    isFree: false,
    upstreamModel: "grok-build-0.1",
    displayName: "Grok Build 0.1",
    category: "claude",
    description: "Real-time search-integrated coding agent. Ideal for integrating web documentation dynamically.",
    inputPrice: "2.00",
    outputPrice: "10.00"
  },

  // --- GPT-5 & Codex ---
  "gpt-5.5-pro": {
    id: "gpt-5.5-pro",
    isFree: false,
    upstreamModel: "gpt-5.5-pro",
    displayName: "GPT 5.5 Pro",
    category: "gpt",
    description: "OpenAI's ultimate reasoning flagship. Incredible math, logical reasoning, and script automation.",
    inputPrice: "10.00",
    outputPrice: "30.00"
  },
  "gpt-5.5": {
    id: "gpt-5.5",
    isFree: false,
    upstreamModel: "gpt-5.5",
    displayName: "GPT 5.5 Standard",
    category: "gpt",
    description: "High intelligence agentic model. Superb logic flow design, debugging, and project scaffolding.",
    inputPrice: "8.00",
    outputPrice: "24.00"
  },
  "gpt-5.4-pro": {
    id: "gpt-5.4-pro",
    isFree: false,
    upstreamModel: "gpt-5.4-pro",
    displayName: "GPT 5.4 Pro",
    category: "gpt",
    description: "Deep instruction-following coding model. Handles massive multi-file modifications cleanly.",
    inputPrice: "10.00",
    outputPrice: "30.00"
  },
  "gpt-5.4": {
    id: "gpt-5.4",
    isFree: false,
    upstreamModel: "gpt-5.4",
    displayName: "GPT 5.4 Standard",
    category: "gpt",
    description: "Versatile development companion. Great speed and accuracy for full-stack API generation.",
    inputPrice: "5.00",
    outputPrice: "15.00"
  },
  "gpt-5.4-mini": {
    id: "gpt-5.4-mini",
    isFree: false,
    upstreamModel: "gpt-5.4-mini",
    displayName: "GPT 5.4 Mini",
    category: "gpt",
    description: "Cost-efficient, fast API builder and text summary model. Handles small code reviews instantly.",
    inputPrice: "0.15",
    outputPrice: "0.60"
  },
  "gpt-5.4-nano": {
    id: "gpt-5.4-nano",
    isFree: false,
    upstreamModel: "gpt-5.4-nano",
    displayName: "GPT 5.4 Nano",
    category: "gpt",
    description: "Sub-second response model. Perfect for syntax formatting, file parsing, and micro-completions.",
    inputPrice: "0.05",
    outputPrice: "0.20"
  },
  "gpt-5.3-codex-spark": {
    id: "gpt-5.3-codex-spark",
    isFree: false,
    upstreamModel: "gpt-5.3-codex-spark",
    displayName: "GPT 5.3 Codex Spark",
    category: "gpt",
    description: "Highly creative code assistant. Great for prototyping games, animations, and frontend designs.",
    inputPrice: "0.80",
    outputPrice: "2.40"
  },
  "gpt-5.3-codex": {
    id: "gpt-5.3-codex",
    isFree: false,
    upstreamModel: "gpt-5.3-codex",
    displayName: "GPT 5.3 Codex",
    category: "gpt",
    description: "Codex specialist engine. Exceptional at legacy code migration and writing documentation comments.",
    inputPrice: "0.80",
    outputPrice: "2.40"
  },
  "gpt-5.2-codex": {
    id: "gpt-5.2-codex",
    isFree: false,
    upstreamModel: "gpt-5.2-codex",
    displayName: "GPT 5.2 Codex",
    category: "gpt",
    description: "Reliable code completion and formatting model. Low hallucination rates on common algorithms.",
    inputPrice: "0.80",
    outputPrice: "2.40"
  },
  "gpt-5.2": {
    id: "gpt-5.2",
    isFree: false,
    upstreamModel: "gpt-5.2",
    displayName: "GPT 5.2 Standard",
    category: "gpt",
    description: "Solid reasoning core. Ideal for parsing test runner logs and compiling codebases.",
    inputPrice: "2.50",
    outputPrice: "7.50"
  },
  "gpt-5.1-codex-max": {
    id: "gpt-5.1-codex-max",
    isFree: false,
    upstreamModel: "gpt-5.1-codex-max",
    displayName: "GPT 5.1 Codex Max",
    category: "gpt",
    description: "Full-context coding engine. Optimized for deeply nested functions and database schema design.",
    inputPrice: "1.20",
    outputPrice: "3.60"
  },
  "gpt-5.1-codex": {
    id: "gpt-5.1-codex",
    isFree: false,
    upstreamModel: "gpt-5.1-codex",
    displayName: "GPT 5.1 Codex",
    category: "gpt",
    description: "Standard codex execution engine. Perfect for unit test generation and boilerplate creation.",
    inputPrice: "0.80",
    outputPrice: "2.40"
  },
  "gpt-5.1-codex-mini": {
    id: "gpt-5.1-codex-mini",
    isFree: false,
    upstreamModel: "gpt-5.1-codex-mini",
    displayName: "GPT 5.1 Codex Mini",
    category: "gpt",
    description: "Highly performant compact code helper. Fast shell commands and regex generator.",
    inputPrice: "0.30",
    outputPrice: "0.90"
  },
  "gpt-5": {
    id: "gpt-5",
    isFree: false,
    upstreamModel: "gpt-5",
    displayName: "GPT 5 Standard",
    category: "gpt",
    description: "Original GPT-5 flagship model. Strong general reasoning and language synthesis.",
    inputPrice: "2.00",
    outputPrice: "6.00"
  },
  "gpt-5-codex": {
    id: "gpt-5-codex",
    isFree: false,
    upstreamModel: "gpt-5-codex",
    displayName: "GPT 5 Codex",
    category: "gpt",
    description: "Pioneering codex model for auto-editing codeblocks. Handles boilerplate tasks perfectly.",
    inputPrice: "0.80",
    outputPrice: "2.40"
  },
  "gpt-5-nano": {
    id: "gpt-5-nano",
    isFree: false,
    upstreamModel: "gpt-5-nano",
    displayName: "GPT 5 Nano",
    category: "gpt",
    description: "Original sub-second lightweight model for inline code suggestions.",
    inputPrice: "0.05",
    outputPrice: "0.20"
  },

  // --- Gemini 3 ---
  "gemini-3.5-flash": {
    id: "gemini-3.5-flash",
    isFree: false,
    upstreamModel: "gemini-3.5-flash",
    displayName: "Gemini 3.5 Flash",
    category: "gemini",
    description: "Incredibly fast multi-modal intelligence. Perfect for massive code file searches and codebase indexing.",
    inputPrice: "0.075",
    outputPrice: "0.30"
  },
  "gemini-3.1-pro": {
    id: "gemini-3.1-pro",
    isFree: false,
    upstreamModel: "gemini-3.1-pro",
    displayName: "Gemini 3.1 Pro",
    category: "gemini",
    description: "Google's deep reasoning model. Outstanding context window. Best for analyzing multi-file workspaces.",
    inputPrice: "1.25",
    outputPrice: "5.00"
  },
  "gemini-3-flash": {
    id: "gemini-3-flash",
    isFree: false,
    upstreamModel: "gemini-3-flash",
    displayName: "Gemini 3 Flash",
    category: "gemini",
    description: "Ultra low-latency general code exploration and fast developer chat.",
    inputPrice: "0.075",
    outputPrice: "0.30"
  },

  // --- Open Source & Specialists ---
  "deepseek-v4-pro": {
    id: "deepseek-v4-pro",
    isFree: false,
    upstreamModel: "deepseek-v4-pro",
    displayName: "DeepSeek V4 Pro",
    category: "specialist",
    description: "State-of-the-art open weight model. Excels at complex TS, Python, and C++ scripting.",
    inputPrice: "0.14",
    outputPrice: "0.28"
  },
  "deepseek-v4-flash": {
    id: "deepseek-v4-flash",
    isFree: false,
    upstreamModel: "deepseek-v4-flash",
    displayName: "DeepSeek V4 Flash",
    category: "specialist",
    description: "Premium fast DeepSeek model with active thinking features. Low latency and high coding accuracy.",
    inputPrice: "0.08",
    outputPrice: "0.16"
  },
  "glm-5.2": {
    id: "glm-5.2",
    isFree: false,
    upstreamModel: "glm-5.2",
    displayName: "GLM 5.2 Pro",
    category: "specialist",
    description: "Bilingual coding model. Optimized for code explanation, script compilation, and localization.",
    inputPrice: "0.10",
    outputPrice: "0.30"
  },
  "glm-5.1": {
    id: "glm-5.1",
    isFree: false,
    upstreamModel: "glm-5.1",
    displayName: "GLM 5.1",
    category: "specialist",
    description: "Fast bilingual assistant. Great for code comments, formatting, and structured markdown reviews.",
    inputPrice: "0.10",
    outputPrice: "0.30"
  },
  "glm-5": {
    id: "glm-5",
    isFree: false,
    upstreamModel: "glm-5",
    displayName: "GLM 5 Standard",
    category: "specialist",
    description: "Original bilingual flagship model. Capable assistant for general-purpose programming queries.",
    inputPrice: "0.10",
    outputPrice: "0.30"
  },
  "minimax-m2.7": {
    id: "minimax-m2.7",
    isFree: false,
    upstreamModel: "minimax-m2.7",
    displayName: "MiniMax M2.7",
    category: "specialist",
    description: "Fast reasoning specialist model. Great for structural analysis and JSON configuration generation.",
    inputPrice: "0.15",
    outputPrice: "0.45"
  },
  "minimax-m2.5": {
    id: "minimax-m2.5",
    isFree: false,
    upstreamModel: "minimax-m2.5",
    displayName: "MiniMax M2.5",
    category: "specialist",
    description: "Lightweight conversational agent. Reliable helper for general coding and scripting tasks.",
    inputPrice: "0.15",
    outputPrice: "0.45"
  },
  "kimi-k2.6": {
    id: "kimi-k2.6",
    isFree: false,
    upstreamModel: "kimi-k2.6",
    displayName: "Kimi K2.6",
    category: "specialist",
    description: "Large context window coding specialist. Ideal for analyzing entire folders, schemas, and trace logs.",
    inputPrice: "0.50",
    outputPrice: "1.50"
  },
  "kimi-k2.5": {
    id: "kimi-k2.5",
    isFree: false,
    upstreamModel: "kimi-k2.5",
    displayName: "Kimi K2.5",
    category: "specialist",
    description: "Deep text processing specialist model. Highly structured answers and complete script creation.",
    inputPrice: "0.50",
    outputPrice: "1.50"
  },
  "qwen3.6-plus": {
    id: "qwen3.6-plus",
    isFree: false,
    upstreamModel: "qwen3.6-plus",
    displayName: "Qwen 3.6 Plus",
    category: "specialist",
    description: "State-of-the-art open-source logic core. Top-tier coding benchmark performance.",
    inputPrice: "0.20",
    outputPrice: "0.60"
  },
  "qwen3.5-plus": {
    id: "qwen3.5-plus",
    isFree: false,
    upstreamModel: "qwen3.5-plus",
    displayName: "Qwen 3.5 Plus",
    category: "specialist",
    description: "Stable and reliable open weight assistant. Optimized for clean JS/Python script production.",
    inputPrice: "0.20",
    outputPrice: "0.60"
  },
  "big-pickle": {
    id: "big-pickle",
    isFree: false,
    upstreamModel: "big-pickle",
    displayName: "Big Pickle",
    category: "specialist",
    description: "Experimental high-throughput model. Built for rapid automated test iterations and fuzzing loops.",
    inputPrice: "0.10",
    outputPrice: "0.30"
  }
};

/**
 * Normalizes incoming model name and returns corresponding configuration.
 */
export function getModelConfig(modelName: string): ModelConfig {
  const cleanName = modelName.split('/').pop() || modelName;
  
  if (MODELS[cleanName]) {
    return MODELS[cleanName];
  }
  
  // Default fallback
  const isFree = cleanName.endsWith('-free');
  return {
    id: cleanName,
    isFree,
    upstreamModel: cleanName,
    displayName: cleanName,
    category: isFree ? 'free' : 'specialist',
    description: "Custom OpenCode-compatible model configuration.",
    inputPrice: isFree ? "0.00" : "0.50",
    outputPrice: isFree ? "0.00" : "1.50"
  };
}
