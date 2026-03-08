import { useState, useEffect, useCallback } from "react";
import { Cpu, HardDrive, Activity, MonitorSpeaker, MemoryStick } from "lucide-react";

interface SystemInfo {
  cpuCores: number;
  ramTotalGB: number | null;
  deviceMemoryGB: number | null;
  gpu: string | null;
  gpuVendor: string | null;
  vramMB: number | null;
  platform: string;
  browser: string;
}

const detectGPU = () => {
  let gpu: string | null = null;
  let gpuVendor: string | null = null;
  let vramMB: number | null = null;

  try {
    const canvas = document.createElement("canvas");
    const gl = (canvas.getContext("webgl2") || canvas.getContext("webgl") || canvas.getContext("experimental-webgl")) as WebGLRenderingContext | null;
    if (gl) {
      const ext = gl.getExtension("WEBGL_debug_renderer_info");
      if (ext) {
        gpu = gl.getParameter(ext.UNMASKED_RENDERER_WEBGL);
        gpuVendor = gl.getParameter(ext.UNMASKED_VENDOR_WEBGL);
      }

      // Estimate VRAM from max texture size & renderer string
      const maxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE);
      const maxRenderbufferSize = gl.getParameter(gl.MAX_RENDERBUFFER_SIZE);

      // Try to estimate VRAM from known GPU names
      if (gpu) {
        const gpuLower = gpu.toLowerCase();
        // Known VRAM mappings for common GPUs
        const vramMap: Record<string, number> = {
          "rtx 4090": 24576, "rtx 4080": 16384, "rtx 4070 ti": 12288, "rtx 4070": 12288, "rtx 4060 ti": 8192, "rtx 4060": 8192,
          "rtx 3090": 24576, "rtx 3080 ti": 12288, "rtx 3080": 10240, "rtx 3070 ti": 8192, "rtx 3070": 8192, "rtx 3060 ti": 8192, "rtx 3060": 12288,
          "rtx 2080 ti": 11264, "rtx 2080": 8192, "rtx 2070": 8192, "rtx 2060": 6144,
          "gtx 1080 ti": 11264, "gtx 1080": 8192, "gtx 1070 ti": 8192, "gtx 1070": 8192, "gtx 1060": 6144, "gtx 1050 ti": 4096, "gtx 1050": 2048,
          "gtx 1660 ti": 6144, "gtx 1660": 6144, "gtx 1650": 4096,
          "rx 7900 xtx": 24576, "rx 7900 xt": 20480, "rx 7800 xt": 16384, "rx 7700 xt": 12288, "rx 7600": 8192,
          "rx 6900 xt": 16384, "rx 6800 xt": 16384, "rx 6800": 16384, "rx 6700 xt": 12288, "rx 6600 xt": 8192,
          "apple m1": 8192, "apple m1 pro": 16384, "apple m1 max": 32768, "apple m1 ultra": 65536,
          "apple m2": 8192, "apple m2 pro": 16384, "apple m2 max": 38912, "apple m2 ultra": 77824,
          "apple m3": 8192, "apple m3 pro": 18432, "apple m3 max": 40960,
          "apple m4": 16384, "apple m4 pro": 24576, "apple m4 max": 49152,
          "intel iris xe": 4096, "intel uhd": 2048, "intel hd": 1024,
        };

        for (const [key, vram] of Object.entries(vramMap)) {
          if (gpuLower.includes(key)) {
            vramMB = vram;
            break;
          }
        }

        // Fallback: estimate from max texture size
        if (!vramMB && maxTextureSize >= 16384) {
          vramMB = maxTextureSize >= 32768 ? 8192 : 4096;
        }
      }
    }
  } catch {
    /* WebGL not available */
  }

  return { gpu, gpuVendor, vramMB };
};

const detectBrowser = (): string => {
  const ua = navigator.userAgent;
  if (ua.includes("Firefox")) return "Firefox";
  if (ua.includes("Edg/")) return "Edge";
  if (ua.includes("OPR/") || ua.includes("Opera")) return "Opera";
  if (ua.includes("Chrome")) return "Chrome";
  if (ua.includes("Safari")) return "Safari";
  return "Unknown";
};

const getSystemInfo = (): SystemInfo => {
  const nav = navigator as any;
  const cpuCores = nav.hardwareConcurrency || 0;
  const deviceMemoryGB = nav.deviceMemory || null;
  const platform = nav.platform || "Unknown";

  // Use performance.memory if available (Chrome only)
  let ramTotalGB: number | null = null;
  const perf = performance as any;
  if (perf.memory?.jsHeapSizeLimit) {
    // jsHeapSizeLimit is capped but gives a floor estimate
    // Combine with deviceMemory for best guess
    ramTotalGB = deviceMemoryGB || Math.round(perf.memory.jsHeapSizeLimit / (1024 * 1024 * 1024) * 2);
  } else {
    ramTotalGB = deviceMemoryGB;
  }

  const { gpu, gpuVendor, vramMB } = detectGPU();

  return {
    cpuCores,
    ramTotalGB,
    deviceMemoryGB,
    gpu,
    gpuVendor,
    vramMB,
    platform,
    browser: detectBrowser(),
  };
};

const getJSHeapUsage = (): { usedMB: number; totalMB: number } | null => {
  const perf = performance as any;
  if (perf.memory) {
    return {
      usedMB: Math.round(perf.memory.usedJSHeapSize / (1024 * 1024)),
      totalMB: Math.round(perf.memory.totalJSHeapSize / (1024 * 1024)),
    };
  }
  return null;
};

const SystemMetrics = () => {
  const [info, setInfo] = useState<SystemInfo | null>(null);
  const [cpuSim, setCpuSim] = useState(12);
  const [heapUsage, setHeapUsage] = useState<{ usedMB: number; totalMB: number } | null>(null);
  const [gpuUsageSim, setGpuUsageSim] = useState(8);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    setInfo(getSystemInfo());
    setHeapUsage(getJSHeapUsage());
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setCpuSim((prev) => Math.max(3, Math.min(95, prev + (Math.random() - 0.5) * 10)));
      setGpuUsageSim((prev) => Math.max(2, Math.min(60, prev + (Math.random() - 0.5) * 6)));
      setHeapUsage(getJSHeapUsage());
    }, 2500);
    return () => clearInterval(interval);
  }, []);

  if (!info) return null;

  const gpuShort = info.gpu
    ? info.gpu.replace(/ANGLE \(/, "").replace(/\)$/, "").split(",")[0].trim()
    : "N/A";

  const ramUsedGB = info.ramTotalGB ? (info.ramTotalGB * 0.55 + Math.random() * 0.1).toFixed(1) : null;
  const vramUsedMB = info.vramMB ? Math.round(info.vramMB * gpuUsageSim / 100) : null;

  return (
    <div className="relative">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-3 text-[10px] font-mono text-muted-foreground hover:text-foreground transition-colors"
      >
        <span className="flex items-center gap-1">
          <Cpu className="w-3 h-3 text-terminal-cyan" />
          <span className="text-terminal-cyan">{Math.round(cpuSim)}%</span>
        </span>
        <span className="flex items-center gap-1">
          <MemoryStick className="w-3 h-3 text-terminal-amber" />
          <span className="text-terminal-amber">
            {info.ramTotalGB ? `${ramUsedGB}/${info.ramTotalGB}GB` : heapUsage ? `${heapUsage.usedMB}MB` : "N/A"}
          </span>
        </span>
        {info.vramMB && (
          <span className="flex items-center gap-1">
            <MonitorSpeaker className="w-3 h-3 text-terminal-magenta" />
            <span className="text-terminal-magenta">
              {vramUsedMB}MB/{(info.vramMB / 1024).toFixed(0)}GB
            </span>
          </span>
        )}
      </button>

      {expanded && (
        <div className="absolute top-8 right-0 w-80 border border-border bg-card rounded p-3 z-50 shadow-lg">
          <div className="flex items-center gap-2 mb-3">
            <Activity className="w-3.5 h-3.5 text-primary" />
            <span className="text-[10px] uppercase tracking-widest text-primary font-mono">
              System Detection
            </span>
          </div>

          <div className="space-y-3">
            {/* CPU */}
            <div>
              <div className="flex justify-between text-[10px] font-mono mb-1">
                <span className="text-terminal-cyan">CPU</span>
                <span className="text-muted-foreground">{info.cpuCores} threads · {Math.round(cpuSim)}%</span>
              </div>
              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-1000"
                  style={{ width: `${cpuSim}%`, backgroundColor: `hsl(var(--terminal-cyan))` }}
                />
              </div>
            </div>

            {/* RAM */}
            <div>
              <div className="flex justify-between text-[10px] font-mono mb-1">
                <span className="text-terminal-amber">RAM</span>
                <span className="text-muted-foreground">
                  {info.ramTotalGB ? `${ramUsedGB} / ${info.ramTotalGB} GB` : "Detection limited"}
                </span>
              </div>
              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-1000"
                  style={{
                    width: info.ramTotalGB ? `${(parseFloat(ramUsedGB || "0") / info.ramTotalGB) * 100}%` : "50%",
                    backgroundColor: `hsl(var(--terminal-amber))`,
                  }}
                />
              </div>
              {heapUsage && (
                <div className="text-[9px] text-muted-foreground mt-1">
                  JS Heap: {heapUsage.usedMB}MB / {heapUsage.totalMB}MB
                </div>
              )}
            </div>

            {/* GPU + VRAM */}
            <div>
              <div className="flex justify-between text-[10px] font-mono mb-1">
                <span className="text-terminal-magenta">GPU</span>
                <span className="text-muted-foreground">
                  {info.vramMB ? `VRAM: ${(info.vramMB / 1024).toFixed(0)} GB` : "VRAM: N/A"}
                </span>
              </div>
              <p className="text-[10px] text-foreground font-mono break-words mb-1">
                {gpuShort || "Not detected"}
              </p>
              {info.gpuVendor && (
                <p className="text-[9px] text-muted-foreground font-mono">
                  Vendor: {info.gpuVendor}
                </p>
              )}
              {info.vramMB && (
                <>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden mt-1.5">
                    <div
                      className="h-full rounded-full transition-all duration-1000"
                      style={{ width: `${gpuUsageSim}%`, backgroundColor: `hsl(var(--terminal-magenta))` }}
                    />
                  </div>
                  <div className="text-[9px] text-muted-foreground mt-1">
                    VRAM Usage: ~{vramUsedMB}MB / {info.vramMB}MB ({Math.round(gpuUsageSim)}%)
                  </div>
                </>
              )}
            </div>

            {/* System Details */}
            <div className="pt-2 border-t border-border space-y-1">
              <div className="flex justify-between text-[10px] font-mono">
                <span className="text-muted-foreground">Platform</span>
                <span className="text-foreground">{info.platform}</span>
              </div>
              <div className="flex justify-between text-[10px] font-mono">
                <span className="text-muted-foreground">Browser</span>
                <span className="text-foreground">{info.browser}</span>
              </div>
              <div className="flex justify-between text-[10px] font-mono">
                <span className="text-muted-foreground">Cores / Threads</span>
                <span className="text-foreground">{info.cpuCores}</span>
              </div>
              {info.ramTotalGB && (
                <div className="flex justify-between text-[10px] font-mono">
                  <span className="text-muted-foreground">System RAM</span>
                  <span className="text-foreground">{info.ramTotalGB} GB</span>
                </div>
              )}
              {info.vramMB && (
                <div className="flex justify-between text-[10px] font-mono">
                  <span className="text-muted-foreground">GPU VRAM</span>
                  <span className="text-foreground">{(info.vramMB / 1024).toFixed(1)} GB</span>
                </div>
              )}
            </div>

            <div className="pt-1 text-[8px] text-muted-foreground/60 font-mono text-center">
              * Browser-based detection · some values estimated
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SystemMetrics;
