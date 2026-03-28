export type Persona = "investor" | "founder" | "student" | "executive" | "general";

export interface NewsStory {
  id: string;
  title: string;
  summary: string;
  category: string;
  timestamp: string;
  source: string;
  url?: string;
}

export interface Briefing {
  overview: string;
  keyTakeaways: string[];
  personaInsight: string;
  timeline?: { date: string; event: string }[];
  relatedQuestions: string[];
}
