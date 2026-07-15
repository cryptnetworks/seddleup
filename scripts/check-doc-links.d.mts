export interface MarkdownDestination {
  destination: string | null;
  line: number;
  error?: string | null;
}

export interface DocumentationCheckResult {
  files: string[];
  errors: string[];
}

export function githubSlug(value: string): string;
export function markdownAnchors(markdown: string): Set<string>;
export function markdownDestinations(markdown: string): MarkdownDestination[];
export function checkDocumentation(rootDirectory?: string): Promise<DocumentationCheckResult>;
