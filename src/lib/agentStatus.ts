// Agent status tracking — manages which agent is currently processing
// For local backend: polls /api/agents endpoint
// For cloud mode: uses frontend-side status tracking

import { getBackendMode, getBackendUrl } from "@/lib/api";

export interface AgentStatus {
  name: string;
  status: "idle" | "active" | "processing" | "complete" | "error";
  model: string;
  currentTask?: string;
  lastActive?: string;
  tokensProcessed?: number;
}

export interface AgentsResponse {
  agents: AgentStatus[];
  activeAgent?: string;
  pipeline?: string[];
}

// Default cloud agent state
const defaultCloudAgents: AgentStatus[] = [
  { name: "ECHO Cloud", status: "idle", model: "Gemini 3 Flash" },
];

// Default local agent states
const defaultLocalAgents: AgentStatus[] = [
  { name: "Supervisor", status: "idle", model: "LLaMA 3.1" },
  { name: "Researcher", status: "idle", model: "DeepSeek R1" },
  { name: "Developer", status: "idle", model: "DeepSeek Coder V2" },
  { name: "Critic", status: "idle", model: "DeepSeek R1" },
];

// Fetch agent status from local backend
export const fetchAgentStatus = async (): Promise<AgentsResponse> => {
  const mode = getBackendMode();

  if (mode === "local") {
    const url = getBackendUrl();
    try {
      const response = await fetch(`${url}/api/agents`, {
        signal: AbortSignal.timeout(3000),
      });
      if (!response.ok) throw new Error();
      return await response.json();
    } catch {
      return { agents: defaultLocalAgents };
    }
  }

  return { agents: defaultCloudAgents };
};

// --- Client-side agent status tracking for cloud mode ---

type Listener = (agents: AgentStatus[], activeAgent: string | null) => void;

let _agents: AgentStatus[] = [...defaultCloudAgents];
let _activeAgent: string | null = null;
const _listeners = new Set<Listener>();

const notify = () => {
  for (const fn of _listeners) fn([..._agents], _activeAgent);
};

export const subscribeAgentStatus = (fn: Listener): (() => void) => {
  _listeners.add(fn);
  fn([..._agents], _activeAgent);
  return () => _listeners.delete(fn);
};

export const setAgentActive = (agentName: string, task?: string) => {
  const mode = getBackendMode();
  if (mode === "cloud") {
    _agents = defaultCloudAgents.map((a) =>
      a.name === agentName
        ? { ...a, status: "active" as const, currentTask: task, lastActive: new Date().toISOString() }
        : { ...a, status: "idle" as const }
    );
    _activeAgent = agentName;
  } else {
    _agents = defaultLocalAgents.map((a) =>
      a.name === agentName
        ? { ...a, status: "active" as const, currentTask: task, lastActive: new Date().toISOString() }
        : a
    );
    _activeAgent = agentName;
  }
  notify();
};

export const setAgentProcessing = (agentName: string) => {
  _agents = _agents.map((a) =>
    a.name === agentName ? { ...a, status: "processing" as const } : a
  );
  notify();
};

export const setAgentComplete = (agentName: string) => {
  _agents = _agents.map((a) =>
    a.name === agentName ? { ...a, status: "complete" as const } : a
  );
  _activeAgent = null;
  notify();
};

export const resetAllAgents = () => {
  const mode = getBackendMode();
  _agents = mode === "cloud" ? [...defaultCloudAgents] : [...defaultLocalAgents];
  _activeAgent = null;
  notify();
};

export const getDefaultAgents = () => {
  const mode = getBackendMode();
  return mode === "cloud" ? defaultCloudAgents : defaultLocalAgents;
};
