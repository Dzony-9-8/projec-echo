import { useState, useEffect } from "react";
import { Cpu, HardDrive, Activity, MonitorSpeaker, MemoryStick, Settings, Save, RotateCcw } from "lucide-react";
import { fetchSystemMetrics, getBackendMode, type RealSystemMetrics } from "@/lib/api";

/* ─── Types ─── */
interface BrowserInfo {
  cpuCores: number;
  deviceMemoryGB: number | null;
  gpu: string | null;
  gpuVendor: string | null;
  vramMB: number | null;
  platform: string;
  browser: string;
}

interface ManualOverrides {
  cpuName?: string;
  ramTotalGB?: number;
  gpuName?: string;
  vramMB?: number;
}

type MetricSource = "local" | "override" | "browser";

/* ─── Browser detection (fallback) ─── */
const detectGPU = () => {
  let gpu: string | null = null;
  let gpuVendor: string | null = null;
  let vramMB: number | null = null;
  try {
    const canvas = document.createElement("canvas");
    const gl = (canvas.getContext("webgl2") || canvas.getContext("webgl")) as WebGLRenderingContext | null;
    if (gl) {
      const ext = gl.getExtension("WEBGL_debug_renderer_info");
      if (ext) {
        gpu = gl.getParameter(ext.UNMASKED_RENDERER_WEBGL);
        gpuVendor = gl.getParameter(ext.UNMASKED_VENDOR_WEBGL);
      }
      if (gpu) {
        const gpuLower = gpu.toLowerCase();
        const vramMap: Record<string, number> = {
          "rtx 4090": 24576, "rtx 4080": 16384, "rtx 4070 ti": 12288, "rtx 4070": 12288, "rtx 4060 ti": 8192, "rtx 4060": 8192,
          "rtx 3090": 24576, "rtx 3080 ti": 12288, "rtx 3080": 10240, "rtx 3070 ti": 8192, "rtx 3070": 8192, "rtx 3060 ti": 8192, "rtx 3060": 12288,
          "rtx 2080 ti": 11264, "rtx 2080": 8192, "rtx 2070": 8192, "rtx 2060": 6144,
          "gtx 1080 ti": 11264, "gtx 1080": 8192, "gtx 1070 ti": 8192, "gtx 1070": 8192, "gtx 1060": 6144, "gtx 1050 ti": 4096, "gtx 1050": 2048,
          "gtx 1660 ti": 6144, "gtx 1660": 6144, "gtx 1650": 4096,
          "rx 7900 xtx": 24576, "rx 7900 xt": 20480, "rx 7800 xt": 16384, "rx 7700 xt": 12288, "rx 7600": 8192,
          "rx 6900 xt": 16384, "rx 6800 xt": 16384, "rx 6700 xt": 12288, "rx 6600 xt": 8192,
          "apple m1": 8192, "apple m1 pro": 16384, "apple m1 max": 32768, "apple m2": 8192, "apple m2 pro": 16384, "apple m2 max": 38912,
          "apple m3": 8192, "apple m3 pro": 18432, "apple m3 max": 40960, "apple m4": 16384, "apple m4 pro": 24576, "apple m4 max": 49152,
          "intel iris xe": 4096, "intel uhd": 2048, "intel hd": 1024,
        };
        for (const [key, vram] of Object.entries(vramMap)) {
          if (gpuLower.includes(key)) { vramMB = vram; break; }
        }
      }
    }
  } catch { /* ignore */ }
  return { gpu, gpuVendor, vramMB };
};

const getBrowserInfo = (): BrowserInfo => {
  const nav = navigator as any;
  const { gpu, gpuVendor, vramMB } = detectGPU();
  const ua = navigator.userAgent;
  const browser = ua.includes("Firefox") ? "Firefox" : ua.includes("Edg/") ? "Edge" : ua.includes("Chrome") ? "Chrome" : ua.includes("Safari") ? "Safari" : "Unknown";
  return {
    cpuCores: nav.hardwareConcurrency || 0,
    deviceMemoryGB: nav.deviceMemory || null,
    gpu, gpuVendor, vramMB,
    platform: nav.platform || "Unknown",
    browser,
  };
};

const getJSHeapUsage = (): { usedMB: number; totalMB: number } | null => {
  const perf = performance as any;
  return perf.memory ? { usedMB: Math.round(perf.memory.usedJSHeapSize / (1024 * 1024)), totalMB: Math.round(perf.memory.totalJSHeapSize / (1024 * 1024)) } : null;
};

const OVERRIDES_KEY = "echo_system_overrides";
const loadOverrides = (): ManualOverrides => {
  try { return JSON.parse(localStorage.getItem(OVERRIDES_KEY) || "{}"); } catch { return {}; }
};
const saveOverrides = (o: ManualOverrides) => localStorage.setItem(OVERRIDES_KEY, JSON.stringify(o));

/* ─── Component ─── */
const SystemMetrics = () => {
  const [browserInfo] = useState<BrowserInfo>(getBrowserInfo);
  const [realMetrics, setRealMetrics] = useState<RealSystemMetrics | null>(null);
  const [overrides, setOverrides] = useState<ManualOverrides>(loadOverrides);
  const [heapUsage, setHeapUsage] = useState(getJSHeapUsage);
  const [expanded, setExpanded] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [editOverrides, setEditOverrides] = useState<ManualOverrides>({});
  const [source, setSource] = useState<MetricSource>("browser");

  // Poll local backend for real metrics
  useEffect(() => {
    let active = true;
    const poll = async () => {
      const data = await fetchSystemMetrics();
      if (!active) return;
      setRealMetrics(data);
      if (data) setSource("local");
      else if (Object.keys(overrides).length > 0) setSource("override");
      else setSource("browser");
    };
    poll();
    const interval = setInterval(() => { poll(); setHeapUsage(getJSHeapUsage()); }, 3000);
    return () => { active = false; clearInterval(interval); };
  }, [overrides]);

  const handleSaveOverrides = () => {
    const cleaned: ManualOverrides = {};
    if (editOverrides.cpuName?.trim()) cleaned.cpuName = editOverrides.cpuName.trim();
    if (editOverrides.ramTotalGB && editOverrides.ramTotalGB > 0) cleaned.ramTotalGB = editOverrides.ramTotalGB;
    if (editOverrides.gpuName?.trim()) cleaned.gpuName = editOverrides.gpuName.trim();
    if (editOverrides.vramMB && editOverrides.vramMB > 0) cleaned.vramMB = editOverrides.vramMB;
    setOverrides(cleaned);
    saveOverrides(cleaned);
    setShowSettings(false);
  };

  const handleClearOverrides = () => {
    setOverrides({});
    setEditOverrides({});
    saveOverrides({});
  };

  // Resolved values: local > override > browser
  const cpuName = realMetrics?.cpu.name || overrides.cpuName || null;
  const cpuCores = realMetrics?.cpu.threads || browserInfo.cpuCores;
  const cpuUsage = realMetrics?.cpu.usage_percent ?? null;

  const ramTotalGB = realMetrics?.ram.total_gb || overrides.ramTotalGB || browserInfo.deviceMemoryGB;
  const ramUsedGB = realMetrics?.ram.used_gb ?? null;
  const ramUsage = realMetrics?.ram.usage_percent ?? (ramTotalGB ? 55 : null);

  const gpuName = realMetrics?.gpu?.name || overrides.gpuName || browserInfo.gpu;
  const vramTotalMB = realMetrics?.gpu?.vram_total_mb || overrides.vramMB || browserInfo.vramMB;
  const vramUsedMB = realMetrics?.gpu?.vram_used_mb ?? null;
  const gpuUsage = realMetrics?.gpu?.gpu_usage_percent ?? null;
  const gpuTemp = realMetrics?.gpu?.temperature_c ?? null;

  const gpuShort = gpuName ? gpuName.replace(/ANGLE \(/, "").replace(/\)$/, "").split(",")[0].trim() : "N/A";

  const sourceLabel = source === "local" ? "⚡ Live" : source === "override" ? "✏ Override" : "🌐 Browser";
  const sourceColor = source === "local" ? "text-primary" : source === "override" ? "text-terminal-amber" : "text-muted-foreground";

  return (
    <div className="relative">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-3 text-[10px] font-mono text-muted-foreground hover:text-foreground transition-colors"
      >
        <span className="flex items-center gap-1">
          <Cpu className="w-3 h-3 text-terminal-cyan" />
          <span className="text-terminal-cyan">{cpuUsage !== null ? `${Math.round(cpuUsage)}%` : `${cpuCores}C`}</span>
        </span>
        <span className="flex items-center gap-1">
          <MemoryStick className="w-3 h-3 text-terminal-amber" />
          <span className="text-terminal-amber">
            {ramUsedGB !== null && ramTotalGB ? `${ramUsedGB.toFixed(1)}/${ramTotalGB}GB` : ramTotalGB ? `${ramTotalGB}GB` : "N/A"}
          </span>
        </span>
        {vramTotalMB && (
          <span className="flex items-center gap-1">
            <MonitorSpeaker className="w-3 h-3 text-terminal-magenta" />
            <span className="text-terminal-magenta">
              {vramUsedMB !== null ? `${(vramUsedMB / 1024).toFixed(1)}/${(vramTotalMB / 1024).toFixed(0)}GB` : `${(vramTotalMB / 1024).toFixed(0)}GB`}
            </span>
          </span>
        )}
      </button>

      {expanded && (
        <div className="absolute top-8 right-0 w-80 border border-border bg-card rounded p-3 z-50 shadow-lg">
          {/* Header */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Activity className="w-3.5 h-3.5 text-primary" />
              <span className="text-[10px] uppercase tracking-widest text-primary font-mono">System</span>
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-[9px] font-mono ${sourceColor}`}>{sourceLabel}</span>
              <button onClick={() => { setEditOverrides(overrides); setShowSettings(!showSettings); }} className="text-muted-foreground hover:text-foreground transition-colors">
                <Settings className="w-3 h-3" />
              </button>
            </div>
          </div>

          {/* Settings panel */}
          {showSettings && (
            <div className="mb-3 p-2.5 border border-border rounded bg-muted/30 space-y-2">
              <div className="text-[9px] uppercase tracking-widest text-terminal-amber font-mono mb-1">Manual Overrides</div>
              <div>
                <label className="text-[9px] text-muted-foreground uppercase tracking-widest block mb-0.5">CPU Name</label>
                <input value={editOverrides.cpuName || ""} onChange={(e) => setEditOverrides({ ...editOverrides, cpuName: e.target.value })} placeholder="e.g. Intel i7-12700K" className="w-full bg-input border border-border rounded px-2 py-1 text-[10px] text-foreground font-mono focus:outline-none focus:border-primary" />
              </div>
              <div>
                <label className="text-[9px] text-muted-foreground uppercase tracking-widest block mb-0.5">Total RAM (GB)</label>
                <input type="number" value={editOverrides.ramTotalGB || ""} onChange={(e) => setEditOverrides({ ...editOverrides, ramTotalGB: parseFloat(e.target.value) || undefined })} placeholder="e.g. 32" className="w-full bg-input border border-border rounded px-2 py-1 text-[10px] text-foreground font-mono focus:outline-none focus:border-primary" />
              </div>
              <div>
                <label className="text-[9px] text-muted-foreground uppercase tracking-widest block mb-0.5">GPU Name</label>
                <input value={editOverrides.gpuName || ""} onChange={(e) => setEditOverrides({ ...editOverrides, gpuName: e.target.value })} placeholder="e.g. NVIDIA RTX 4070" className="w-full bg-input border border-border rounded px-2 py-1 text-[10px] text-foreground font-mono focus:outline-none focus:border-primary" />
              </div>
              <div>
                <label className="text-[9px] text-muted-foreground uppercase tracking-widest block mb-0.5">VRAM (MB)</label>
                <input type="number" value={editOverrides.vramMB || ""} onChange={(e) => setEditOverrides({ ...editOverrides, vramMB: parseFloat(e.target.value) || undefined })} placeholder="e.g. 12288" className="w-full bg-input border border-border rounded px-2 py-1 text-[10px] text-foreground font-mono focus:outline-none focus:border-primary" />
              </div>
              <div className="flex gap-2 pt-1">
                <button onClick={handleClearOverrides} className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded border border-border text-muted-foreground hover:text-foreground text-[9px] font-mono uppercase">
                  <RotateCcw className="w-2.5 h-2.5" /> Reset
                </button>
                <button onClick={handleSaveOverrides} className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded border border-primary bg-primary/10 text-primary text-[9px] font-mono uppercase">
                  <Save className="w-2.5 h-2.5" /> Save
                </button>
              </div>
            </div>
          )}

          <div className="space-y-3">
            {/* CPU */}
            <div>
              <div className="flex justify-between text-[10px] font-mono mb-1">
                <span className="text-terminal-cyan">CPU</span>
                <span className="text-muted-foreground">
                  {cpuName ? cpuName : `${cpuCores} threads`}
                  {cpuUsage !== null ? ` · ${Math.round(cpuUsage)}%` : ""}
                </span>
              </div>
              {cpuUsage !== null && (
                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-1000" style={{ width: `${cpuUsage}%`, backgroundColor: `hsl(var(--terminal-cyan))` }} />
                </div>
              )}
            </div>

            {/* RAM */}
            <div>
              <div className="flex justify-between text-[10px] font-mono mb-1">
                <span className="text-terminal-amber">RAM</span>
                <span className="text-muted-foreground">
                  {ramUsedGB !== null && ramTotalGB ? `${ramUsedGB.toFixed(1)} / ${ramTotalGB} GB` : ramTotalGB ? `${ramTotalGB} GB total` : "Unknown"}
                </span>
              </div>
              {ramUsage !== null && ramTotalGB && (
                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-1000" style={{ width: `${ramUsedGB !== null ? (ramUsedGB / ramTotalGB) * 100 : ramUsage}%`, backgroundColor: `hsl(var(--terminal-amber))` }} />
                </div>
              )}
              {heapUsage && (
                <div className="text-[9px] text-muted-foreground mt-1">JS Heap: {heapUsage.usedMB}MB / {heapUsage.totalMB}MB</div>
              )}
            </div>

            {/* GPU + VRAM */}
            <div>
              <div className="flex justify-between text-[10px] font-mono mb-1">
                <span className="text-terminal-magenta">GPU</span>
                <span className="text-muted-foreground">
                  {vramTotalMB ? `VRAM: ${(vramTotalMB / 1024).toFixed(1)} GB` : "VRAM: N/A"}
                </span>
              </div>
              <p className="text-[10px] text-foreground font-mono break-words mb-1">{gpuShort || "Not detected"}</p>
              {gpuTemp !== null && (
                <p className="text-[9px] text-muted-foreground font-mono">Temp: {gpuTemp}°C</p>
              )}
              {(gpuUsage !== null || vramUsedMB !== null) && vramTotalMB && (
                <>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden mt-1.5">
                    <div className="h-full rounded-full transition-all duration-1000" style={{ width: `${vramUsedMB !== null ? (vramUsedMB / vramTotalMB) * 100 : gpuUsage}%`, backgroundColor: `hsl(var(--terminal-magenta))` }} />
                  </div>
                  <div className="text-[9px] text-muted-foreground mt-1">
                    {vramUsedMB !== null ? `VRAM: ${vramUsedMB}MB / ${vramTotalMB}MB` : ""}{gpuUsage !== null ? ` · GPU: ${Math.round(gpuUsage)}%` : ""}
                  </div>
                </>
              )}
            </div>

            {/* System Details */}
            <div className="pt-2 border-t border-border space-y-1">
              <div className="flex justify-between text-[10px] font-mono">
                <span className="text-muted-foreground">Platform</span>
                <span className="text-foreground">{realMetrics?.platform || browserInfo.platform}</span>
              </div>
              {realMetrics?.hostname && (
                <div className="flex justify-between text-[10px] font-mono">
                  <span className="text-muted-foreground">Hostname</span>
                  <span className="text-foreground">{realMetrics.hostname}</span>
                </div>
              )}
              <div className="flex justify-between text-[10px] font-mono">
                <span className="text-muted-foreground">Browser</span>
                <span className="text-foreground">{browserInfo.browser}</span>
              </div>
              <div className="flex justify-between text-[10px] font-mono">
                <span className="text-muted-foreground">Cores / Threads</span>
                <span className="text-foreground">{cpuCores}</span>
              </div>
            </div>

            <div className="pt-1 text-[8px] text-muted-foreground/60 font-mono text-center">
              {source === "local" ? "Live data from local backend" : source === "override" ? "Using manual overrides · ⚙ to edit" : "Browser-limited · ⚙ to set real specs"}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SystemMetrics;
