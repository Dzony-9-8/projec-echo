

# Plan: Add Skill Creator, Skill Evals, and Skill Trigger Tuning

## Also Fix: Build Error
There's a missing `rehype-katex` package causing a build error in `ChatMessage.tsx`. This must be fixed first.

---

## Overview

Add three new capabilities to the Agent Skills panel, inspired by Claude Code's skill-creator system:

1. **Skill Creator** — AI-powered skill authoring, tuning, and upgrading using the existing chat edge function
2. **Skill Evals** — Test skills against sample prompts and grade outputs for correctness/consistency
3. **Skill Trigger Tuning** — Analyze and refine skill descriptions to reduce false positives/negatives

All three features use the Lovable AI gateway via the existing `chat` edge function (with added system prompts for each use case).

---

## Architecture

```text
AgentSkillsPanel (existing)
├── Skill CRUD (existing)
├── [NEW] Skill Creator Tab
│   ├── "Generate Skill" — describe what you want, AI drafts SKILL.md
│   ├── "Tune Skill" — select existing skill, AI suggests improvements
│   └── "Replace/Delete" — AI recommends removal if agent works better without
├── [NEW] Skill Evals Tab
│   ├── Define eval cases (prompt + expected behavior description)
│   ├── Run evals — AI processes prompt with/without skill, grades output
│   ├── Results table: pass/fail, score, notes
│   └── Benchmark mode — run all evals, track pass rate
└── [NEW] Skill Trigger Tuning Tab
    ├── Show current skill description/name
    ├── Input sample prompts (should-trigger / should-not-trigger)
    └── AI analyzes and suggests refined description
```

---

## Step-by-step Implementation

### Step 0: Fix build error
- Install `rehype-katex` package (it's imported in ChatMessage.tsx but not installed)

### Step 1: Create a new edge function `skill-tools`
- Handles three modes: `create`, `eval`, `tune-trigger`
- **Create mode**: Takes a natural language description + optional existing skill content → returns a drafted/improved SKILL.md
- **Eval mode**: Takes skill content + test prompt + expected behavior → runs the prompt with the skill injected as system context, then grades the output against expectations
- **Tune-trigger mode**: Takes skill name + description + sample prompts (positive/negative) → analyzes and returns an optimized description

### Step 2: Extend `AgentSkill` type in `agentSkills.ts`
- Add optional `evals` field: `Array<{ id, prompt, expectedBehavior, lastResult?, lastScore? }>`
- Add optional `triggerDescription` field for the tuned trigger text
- Add helper functions: `getSkillEvals()`, `updateSkillEvals()`, `updateTriggerDescription()`

### Step 3: Add tabs to `AgentSkillsPanel.tsx`
- Add a tab bar at the top: **Skills** (existing) | **Creator** | **Evals** | **Trigger Tuning**
- Each tab renders a sub-component

### Step 4: Build `SkillCreator` sub-component
- Text area to describe desired skill behavior
- Optional: select existing skill to improve/tune
- "Generate" button → calls `skill-tools` edge function with `mode: "create"`
- Shows AI-generated skill content with "Save as Skill" / "Replace Existing" / "Discard" actions
- If AI determines skill is unnecessary, shows recommendation to delete with explanation

### Step 5: Build `SkillEvals` sub-component
- Select a skill to test
- Add eval cases: prompt text + expected behavior description
- "Run Eval" button → calls `skill-tools` with `mode: "eval"` for each case
- Results displayed in a table: prompt (truncated), pass/fail badge, score (1-5), AI notes
- "Run Benchmark" button → runs all evals for the skill, shows aggregate pass rate + avg score
- Eval definitions stored in the skill's `evals` array in localStorage

### Step 6: Build `SkillTriggerTuning` sub-component
- Select a skill
- Shows current skill name and first paragraph as "current description"
- Add sample prompts in two lists: "Should trigger" and "Should NOT trigger"
- "Analyze" button → calls `skill-tools` with `mode: "tune-trigger"`
- AI returns: analysis of current description, suggested refined description, predicted trigger accuracy
- "Apply" button saves the refined description back to the skill

### Step 7: Deploy edge function
- The `skill-tools` edge function will be auto-deployed

---

## Technical Notes

- The `skill-tools` edge function uses the same LOVABLE_API_KEY and Lovable AI gateway as the existing `chat` function
- Evals use a **non-streaming** call since we need complete output to grade
- Skill Creator uses streaming for better UX during generation
- All skill data stays in localStorage (consistent with existing pattern)
- The eval grading uses tool calling to extract structured `{ pass: boolean, score: number, notes: string }` output

