/** In-memory website demo ONLY. Never import an Electron preload or an engine. */
type DemoMessage = { id: string; role: "user" | "assistant"; text: string; createdAt: number };
type DemoChat = { id: string; title: string; projectId?: string; updatedAt: number };
type DemoEvent = { chatId: string; type: string; [key: string]: unknown };

export function createDemoBridge(
  host: { location: { search: string }; matchMedia?: (query: string) => { matches: boolean } },
  notice: (text: string) => void,
) {
  let sequence = 20;
  const now = Date.now();
  const listeners = new Set<(event: DemoEvent) => void>();
  const pending = new Map<string, { cancelled: boolean }>();
  const copy = <T,>(value: T): T => JSON.parse(JSON.stringify(value));
  const emit = (event: DemoEvent) => listeners.forEach(listener => listener(copy(event)));
  const pause = (milliseconds: number) => new Promise<void>(resolve => setTimeout(resolve, host.matchMedia?.("(prefers-reduced-motion: reduce)").matches ? 0 : milliseconds));
  const disabled = async () => { notice("Preview only. No account, files, API keys or external services are accessed."); return false; };
  const unavailable = async (): Promise<never> => {
    notice("This action is available in Blue Desktop, not in this isolated preview.");
    throw new Error("Interactive preview only. No account connection, files or real AI requests are available.");
  };
  const unsubscribe = () => () => {};
  const initialTheme = new URLSearchParams(host.location.search).get("theme") === "dark" ? "dark" : "light";
  const preferences = { enabled: false, approvals: false, questions: false, results: false, failures: false, releases: false, alwaysNotify: false, silent: true, showTaskNames: false };
  const models = [
    { id: "openai/gpt-5.5", displayName: "GPT-5.5", tools: true },
    { id: "anthropic/claude-sonnet-4.6", displayName: "Claude Sonnet 4.6", tools: true },
    { id: "google/gemini-3.1-pro-preview", displayName: "Gemini 3.1 Pro", tools: true },
    { id: "deepseek/deepseek-v4-flash", displayName: "DeepSeek V4 Flash", tools: true },
  ];
  const project = { id: "demo-project", name: "study-planner", path: "Example project / study-planner", isGitRepository: false };
  const chats: DemoChat[] = [
    { id: "demo-understand", title: "Understand this project", projectId: project.id, updatedAt: now },
    { id: "demo-build", title: "Build a study planner", projectId: project.id, updatedAt: now - 1000 },
    { id: "demo-ui", title: "Improve the interface", projectId: project.id, updatedAt: now - 2000 },
  ];
  const message = (role: DemoMessage["role"], text: string): DemoMessage => ({ id: `demo-message-${sequence++}`, role, text, createdAt: now });
  const messages: Record<string, DemoMessage[]> = {
    "demo-understand": [
      message("user", "Explain the architecture and important files."),
      message("assistant", "## A clearer view of your project\n\nThis **example study planner** brings coursework, deadlines and weekly study sessions together.\n\n- `src/App.tsx` connects the main views.\n- `src/components/StudyBoard.tsx` organises sessions by day.\n- `src/styles.css` keeps the interface consistent.\n\nChoose **Build a study planner** in the sidebar to try a question card. Or send a message below to see an example task with parallel agents.\n\n*Interactive preview — illustrative responses, not a live scan or an AI call.*"),
    ],
    "demo-build": [
      message("user", "Build a study planner for my coursework."),
      message("assistant", "Before we start, choose how you would like your sessions organised in the question below.\n\n*This is an example interaction. No files will be created.*"),
    ],
    "demo-ui": [
      message("user", "Improve the interface without disturbing the user experience."),
      message("assistant", "## Small details. A better experience.\n\nFor this example, we would refine the spacing, make deadlines easier to scan and preserve clear keyboard focus.\n\nWith **Multi-agent** on, Blue can delegate independent work. Send a message to try the example agent views, then click an agent name at the bottom.\n\n*Preview only. No source files or model credits are used.*"),
    ],
  };
  const state = {
    appVersion: "0.1.19", productionEngine: "codex", platform: "win32",
    account: { email: "student@blue-demo.example", userId: "example-student", plan: "blue" },
    update: { status: "disabled", currentVersion: "0.1.19" },
    features: { passwordLoginEnabled: false },
    settings: { theme: initialTheme, provider: "openrouter", selectedModel: models[0].id, setupCompleted: true, modes: { fullAccess: true, ponytail: false, uiMax: true, multiAgent: true } },
    projects: [project], chats, messages, models,
    ui: { view: "chat", activeProjectId: project.id, activeChatId: chats[0].id, drafts: {}, sidebarOpen: host.matchMedia?.("(max-width: 767px)").matches !== true, rollbackOpen: false, workTraces: {} },
  };
  const disconnected = () => ({ connected: false, configured: false, mcp: false, status: "disconnected" });
  const connect = async () => { await disabled(); return disconnected(); };
  const createChat = (input?: { projectId?: string }) => {
    // Bound all demo state: reopening the preview resets it; nothing is persisted.
    if (chats.length >= 12) throw new Error("This preview supports twelve example chats. Reload it to start again.");
    const chat = { id: `demo-chat-${sequence++}`, title: "New chat", projectId: input?.projectId ? project.id : undefined, updatedAt: Date.now() };
    chats.unshift(chat); messages[chat.id] = [];
    return chat;
  };
  const agents = [
    { id: "example-layout", name: "Layout", task: "Review the example study board’s structure and spacing." },
    { id: "example-accessibility", name: "Accessibility", task: "Review keyboard navigation and readable states in the example interface." },
  ];
  async function stream(chatId: string, text: string, control: { cancelled: boolean }) {
    emit({ chatId, type: "state", state: "responding", label: "Writing the example response" });
    for (let offset = 0; offset < text.length && !control.cancelled; offset += 55) {
      emit({ chatId, type: "delta", delta: text.slice(offset, offset + 55) });
      await pause(45);
    }
    if (!control.cancelled) {
      messages[chatId].push(message("assistant", text));
      emit({ chatId, type: "complete", text });
    }
  }
  let answeredQuestion = false;
  const bridge = {
    bootstrap: async () => copy(state),
    theme: { initial: initialTheme, set: async (theme: "light" | "dark") => { state.settings.theme = theme; return theme; } },
    updates: { check: async () => copy(state.update), download: disabled, install: disabled, dismiss: async () => copy(state.update), notesRead: async () => copy(state.update), openStore: disabled, onEvent: unsubscribe },
    notifications: { get: async () => copy(preferences), set: async () => { await disabled(); return copy(preferences); }, onNavigate: unsubscribe },
    auth: { sendOtp: unavailable, verifyOtp: unavailable, signInWithPassword: unavailable, logout: unavailable },
    account: { refresh: async () => { notice("Example account only. No balance is fetched or billed."); return copy(state.account); }, onEvent: unsubscribe },
    features: { onEvent: unsubscribe },
    setup: { saveProvider: unavailable },
    models: { list: async () => copy(models), select: async (id: string) => { if (!models.some(model => model.id === id)) throw new Error("Choose an example model from the list."); state.settings.selectedModel = id; return id; } },
    modes: { set: async ({ mode, enabled }: { mode: keyof typeof state.settings.modes; enabled: boolean }) => {
      if (!Object.hasOwn(state.settings.modes, mode)) throw new Error("Unknown demo mode.");
      state.settings.modes[mode] = Boolean(enabled);
      return copy({ modes: state.settings.modes, chats });
    } },
    projects: { select: async () => { notice("The preview uses the example study-planner project. It never opens your files."); return copy(project); }, remove: async () => { await disabled(); return copy(state); }, reveal: async () => { await disabled(); return ""; } },
    chats: {
      create: async (input?: { projectId?: string }) => copy(createChat(input)),
      delete: disabled,
      send: async (input: { chatId?: string; projectId?: string; text: string }) => {
        const chat = chats.find(item => item.id === input.chatId) || createChat(input);
        if (pending.has(chat.id)) throw new Error("An example task is already running in this chat.");
        if (messages[chat.id].length >= 22) throw new Error("Reload the preview to start a fresh example conversation.");
        const text = String(input.text || "").slice(0, 6000);
        const user = message("user", text); messages[chat.id].push(user);
        chat.updatedAt = Date.now();
        if (chat.title === "New chat") chat.title = text.slice(0, 70) || "Example task";
        const control = { cancelled: false }; pending.set(chat.id, control);
        const multiAgent = state.settings.modes.multiAgent;
        emit({ chatId: chat.id, type: "accepted", chat, message: user });
        emit({ chatId: chat.id, type: "commentary", id: `demo-note-${sequence++}`, text: "This is a scripted product preview. The interaction stays in this frame; no model, files or credits are used." });
        try {
          if (multiAgent) for (const agent of agents) emit({ chatId: chat.id, type: "agent_work", agent, entry: { id: `${agent.id}-work`, kind: "commentary", label: "Reviewing the example interface", status: "running", detail: agent.task } });
          emit({ chatId: chat.id, type: "activity", activity: { id: "demo-inspect", label: "Reviewing the example study planner", status: "running", detail: "Illustrative project review. No command is executed." } });
          await pause(1300);
          if (!control.cancelled) {
            emit({ chatId: chat.id, type: "activity", activity: { id: "demo-inspect", label: "Reviewed the example study planner", status: "completed" } });
            if (multiAgent) for (const agent of agents) emit({ chatId: chat.id, type: "agent_work", agent, entry: { id: `${agent.id}-work`, kind: "message", label: "Example review completed", status: "completed", detail: agent.id === "example-layout" ? "## Layout\n\nKeep the weekly board clear, group related sessions and leave room for longer course names.\n\n*Illustrative result. No files were reviewed or edited.*" : "## Accessibility\n\nUse visible focus, descriptive button labels and clear completed states.\n\n*Illustrative result. No live audit was run.*" } });
            await stream(chat.id, `## Your next step, made clearer\n\nThis example shows how Blue brings project context, a conversation and tools into one workspace.\n\n${multiAgent ? "Two example agents reviewed independent parts of the study planner. Click **Layout** or **Accessibility** below to inspect their work in Blue’s real agent panel." : "You are viewing a single-agent example. Turn on **Multi-agent** to try the example parallel-agent views."}\n\nYour chosen model and mode buttons work within the preview. Real coding, account connection and file changes are available only in Blue Desktop.\n\n*Launching soon · Scripted example. No AI calls or credits used.*`, control);
          }
          return copy({ chat, messages: messages[chat.id], modes: state.settings.modes });
        } finally { pending.delete(chat.id); }
      },
      stop: async (chatId: string) => { const control = pending.get(chatId); if (!control) return false; control.cancelled = true; emit({ chatId, type: "state", state: "stopped", label: "Example task stopped" }); return true; },
      onEvent: (listener: (event: DemoEvent) => void) => {
        listeners.add(listener);
        const timer = setTimeout(() => {
          if (answeredQuestion || !listeners.has(listener)) return;
          listener({ chatId: "demo-build", type: "question", question: {
            id: "demo-planner-question", sessionId: "example-session", questions: [{ id: "planner-view", header: "Planner view", question: "How would you like to organise your study sessions?", isOther: false, options: [
              { label: "Weekly board", description: "See your coursework and sessions arranged by day." },
              { label: "Simple task list", description: "Keep a focused checklist with deadlines." },
            ] }],
          } });
        }, 180);
        return () => { clearTimeout(timer); listeners.delete(listener); };
      },
    },
    attachments: { preparePdf: unavailable },
    approvals: { reply: disabled },
    questions: { reply: async (input: { chatId: string; requestId: string; answers: string[][] }) => {
      const choice = input.answers?.[0]?.[0];
      if (answeredQuestion || input.chatId !== "demo-build" || input.requestId !== "demo-planner-question" || !["Weekly board", "Simple task list"].includes(choice)) return false;
      answeredQuestion = true;
      const control = { cancelled: false }; pending.set(input.chatId, control);
      try { await stream(input.chatId, `## ${choice}\n\nGreat — the example plan will use a **${choice.toLowerCase()}**. We would keep coursework easy to scan, with readable deadlines and keyboard-friendly controls.\n\nThat is Blue’s real question card and answer UI, responding to your choice.\n\n*Illustrative preview. No files were created and no AI request was sent.*`, control); return true; }
      finally { pending.delete(input.chatId); }
    } },
    rollback: { list: async () => [{ id: "demo-checkpoint", projectId: project.id, chatId: "demo-build", userMessageIndex: 0, title: "Build a study planner", prompt: "Example project checkpoint", createdAt: now, restorable: false, restoreUnavailableReason: "Preview only. No file changes or restorable checkpoint is created." }], restore: unavailable },
    ui: { save: async () => true },
    connections: { access: async () => ({ eligible: true, plan: "blue", reason: "active_paid_plan", source: "no_session", verifiedAt: now, monthlyExpiresAt: null }), status: async () => ({ github: disconnected(), vercel: disconnected(), canva: disconnected() }), githubStatus: async () => disconnected(), connectGitHub: connect, disconnectGitHub: disabled, connectVercel: connect, disconnectVercel: disabled, connectCanva: connect, disconnectCanva: disabled },
    blender: { revokeProjectAccess: disabled },
    openExternal: disabled, resolveImage: unavailable, resolveViewedImage: unavailable,
    downloadImage: async () => { await disabled(); return { saved: false }; },
    minimize: disabled, toggleMaximize: disabled, close: disabled, isMaximized: async () => false,
  };
  return bridge;
}
