import { Injectable, Logger } from "@nestjs/common";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

/**
 * Persists the refined requirements Markdown next to the process working directory.
 */
@Injectable()
export class RequirementsArtifactStore {
  private readonly log = new Logger(RequirementsArtifactStore.name);
  private readonly outputPath = join(process.cwd(), "output", "requirements.md");

  /**
   * Writes the artifact and returns the path it was saved to.
   *
   * @param content - Complete Markdown requirements document.
   */
  async save(content: string): Promise<string> {
    await mkdir(join(process.cwd(), "output"), { recursive: true });
    await writeFile(this.outputPath, content, "utf8");
    this.log.log(`Saved ${this.outputPath}`);
    return this.outputPath;
  }
}
