/**
 * Successful Requirements agent run.
 */
export interface RefineResult {
  /** Groq model id that produced the artifact. */
  model: string;
  /** Filesystem path where Markdown was written. */
  path: string;
  /** Refined requirements document. */
  markdown: string;
}
