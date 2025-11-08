/**
 * Lightweight keyword → category mapping for fallback prompt generation
 * Detects user intent from scenario text and maps to existing prompt categories
 */

export type PromptCategory = "jobSeeker" | "productManager" | "surprise";

/**
 * Maps scenario text to a prompt category based on keyword detection
 * @param scenario - User's typed scenario description
 * @returns Category name for buildPrompts() or null if no match
 */
export function detectCategoryFromScenario(scenario: string): PromptCategory | null {
  if (!scenario || typeof scenario !== "string") {
    return null;
  }

  const lower = scenario.toLowerCase().trim();

  // Interview-related keywords → jobSeeker
  const interviewKeywords = [
    "interview",
    "job",
    "career",
    "hiring",
    "recruiter",
    "resume",
    "cv",
    "candidate",
    "application",
    "position",
    "role",
    "employer",
  ];
  if (interviewKeywords.some((kw) => lower.includes(kw))) {
    return "jobSeeker";
  }

  // Meeting/product management keywords → productManager
  const pmKeywords = [
    "meeting",
    "product",
    "pm",
    "roadmap",
    "feature",
    "stakeholder",
    "sprint",
    "agile",
    "scrum",
    "backlog",
    "user story",
    "launch",
    "release",
    "team",
    "leadership",
    "presentation",
    "pitch",
  ];
  if (pmKeywords.some((kw) => lower.includes(kw))) {
    return "productManager";
  }

  // Fun/wildcard keywords → surprise
  const funKeywords = [
    "fun",
    "random",
    "wildcard",
    "surprise",
    "creative",
    "story",
    "joke",
    "entertaining",
  ];
  if (funKeywords.some((kw) => lower.includes(kw))) {
    return "surprise";
  }

  // Default: if no clear match, return null (will use generic fallback)
  return null;
}

