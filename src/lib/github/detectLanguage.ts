const EXTENSIONS: Record<string, string> = {
  ".ts": "TypeScript",
  ".tsx": "TypeScript React",
  ".js": "JavaScript",
  ".jsx": "JavaScript React",
  ".mjs": "JavaScript",
  ".cjs": "JavaScript",
  ".json": "JSON",
  ".md": "Markdown",
  ".mdx": "MDX",
  ".css": "CSS",
  ".scss": "SCSS",
  ".html": "HTML",
  ".py": "Python",
  ".rb": "Ruby",
  ".go": "Go",
  ".rs": "Rust",
  ".java": "Java",
  ".kt": "Kotlin",
  ".php": "PHP",
  ".cs": "C#",
  ".sql": "SQL",
  ".prisma": "Prisma",
  ".yml": "YAML",
  ".yaml": "YAML",
  ".toml": "TOML",
  ".env": "Environment",
  ".sh": "Shell",
};

export function detectLanguage(path: string): string {
  const lower = path.toLowerCase();

  if (lower === "dockerfile" || lower.endsWith("/dockerfile")) {
    return "Dockerfile";
  }

  if (lower.includes("github/workflows/")) {
    return "GitHub Actions";
  }

  const match = lower.match(/\.[a-z0-9]+$/);
  if (!match) {
    return "Text";
  }

  return EXTENSIONS[match[0]] ?? "Text";
}
