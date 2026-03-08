import { useState, useRef, useEffect } from "react";
import { BookOpen, Code2, Search, PenTool, Shield, Lightbulb } from "lucide-react";

interface Template {
  id: string;
  label: string;
  icon: typeof Code2;
  color: string;
  prompt: string;
}

const TEMPLATES: Template[] = [
  {
    id: "code",
    label: "Code",
    icon: Code2,
    color: "text-terminal-cyan",
    prompt: "Write clean, well-documented code for: ",
  },
  {
    id: "research",
    label: "Research",
    icon: Search,
    color: "text-primary",
    prompt: "Research and provide a detailed analysis of: ",
  },
  {
    id: "explain",
    label: "Explain",
    icon: Lightbulb,
    color: "text-terminal-amber",
    prompt: "Explain in detail with examples: ",
  },
  {
    id: "review",
    label: "Review",
    icon: Shield,
    color: "text-terminal-red",
    prompt: "Critically review and suggest improvements for: ",
  },
  {
    id: "write",
    label: "Write",
    icon: PenTool,
    color: "text-terminal-magenta",
    prompt: "Write professional content for: ",
  },
];

interface Props {
  onSelect: (prompt: string) => void;
}

const PromptTemplates = ({ onSelect }: Props) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="p-2.5 rounded border border-border bg-muted/50 text-muted-foreground hover:text-foreground hover:border-primary transition-colors"
        title="Prompt templates"
      >
        <BookOpen className="w-4 h-4" />
      </button>

      {open && (
        <div className="absolute bottom-full mb-1 left-0 w-48 border border-border bg-card rounded shadow-lg z-50 py-1">
          <div className="px-2 py-1 text-[9px] uppercase tracking-widest text-muted-foreground font-mono">
            Templates
          </div>
          {TEMPLATES.map((t) => (
            <button
              key={t.id}
              onClick={() => {
                onSelect(t.prompt);
                setOpen(false);
              }}
              className="w-full flex items-center gap-2 px-2 py-1.5 text-left hover:bg-muted/50 transition-colors"
            >
              <t.icon className={`w-3.5 h-3.5 ${t.color}`} />
              <span className="text-[11px] font-mono text-foreground">{t.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default PromptTemplates;
