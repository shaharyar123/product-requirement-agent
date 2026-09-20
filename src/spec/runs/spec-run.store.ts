import { Injectable, NotFoundException } from "@nestjs/common";
import { SpecRun, SpecRunEvent } from "../interfaces/spec-run.interface";

/**
 * In-memory Spec run store. Lost on process restart.
 */
@Injectable()
export class SpecRunStore {
  private readonly runs = new Map<string, SpecRun>();

  create(run: SpecRun): SpecRun {
    this.runs.set(run.id, run);
    return run;
  }

  get(id: string): SpecRun {
    const run = this.runs.get(id);
    if (!run) {
      throw new NotFoundException(`Run ${id} not found.`);
    }
    return run;
  }

  save(run: SpecRun): SpecRun {
    run.updatedAt = new Date().toISOString();
    this.runs.set(run.id, run);
    return run;
  }

  addEvent(run: SpecRun, type: string, message: string): SpecRunEvent {
    const event: SpecRunEvent = {
      at: new Date().toISOString(),
      type,
      message,
    };
    run.events.push(event);
    this.save(run);
    return event;
  }

}
