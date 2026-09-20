import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ClarificationAnswer } from "../interfaces/clarification-answer.interface";
import { ClarificationQuestion } from "../interfaces/clarification-question.interface";

interface SlackMessageTarget {
  channel: string;
  ts: string;
}

/**
 * Sends Spec clarification questions to a Slack user as a DM
 * and reads thread replies in `Q-001: answer` form.
 *
 * Needs a Slack app bot token with chat:write, im:write, im:history,
 * users:read, and users:read.email. Channel posts use chat:write after the
 * bot is invited. Importing thread replies needs channels:history.
 */
@Injectable()
export class SlackNotifyService {
  private readonly log = new Logger(SlackNotifyService.name);

  constructor(private readonly config: ConfigService) {}

  isConfigured(): boolean {
    return Boolean(this.config.get<string>("SLACK_BOT_TOKEN")?.trim());
  }

  /**
   * Posts questions to a Slack channel (`#name`) or a user DM.
   * Channel threads accept replies; many workspaces lock app DMs as send-only.
   */
  async sendQuestions(
    runId: string,
    notifyTo: string,
    questions: ClarificationQuestion[],
  ): Promise<SlackMessageTarget> {
    const target = notifyTo.trim();
    const destination = target.startsWith("#")
      ? target
      : await this.openDm(target);

    const posted = await this.api("chat.postMessage", {
      channel: destination,
      text: this.formatQuestions(runId, questions),
    });
    const ts = String(posted.ts ?? "");
    const channel = String(posted.channel ?? destination);
    if (!ts) {
      throw new Error("Slack did not return a message timestamp.");
    }
    return { channel, ts };
  }

  /**
   * Parses `Q-001: answer` lines from replies in the original DM thread.
   */
  async readAnswers(
    channel: string,
    ts: string,
  ): Promise<ClarificationAnswer[]> {
    const data = await this.api("conversations.replies", { channel, ts });
    const messages = Array.isArray(data.messages) ? data.messages : [];
    const byId = new Map<string, string>();

    for (const message of messages.slice(1)) {
      const text = String(message.text ?? "")
        .replace(/<@[A-Z0-9]+>/g, "")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">");
      for (const match of text.matchAll(
        /(Q-\d+)\s*[:\-–]\s*(.+)/gi,
      )) {
        const answer = match[2].trim();
        if (answer) {
          byId.set(match[1].toUpperCase(), answer);
        }
      }
    }

    return [...byId.entries()].map(([id, answer]) => ({ id, answer }));
  }

  private formatQuestions(
    runId: string,
    questions: ClarificationQuestion[],
  ): string {
    const lines = [
      `Spec run \`${runId}\` needs clarification before requirements can be written.`,
      "",
      "Reply *in this thread*, one line per question:",
      "`Q-001: your answer`",
      "",
    ];
    for (const item of questions) {
      lines.push(
        `*${item.id}* (${item.required ? "required" : "optional"} · ${item.topic})`,
      );
      lines.push(item.question);
      lines.push(`_${item.why}_`);
      lines.push("");
    }
    return lines.join("\n");
  }

  private async openDm(notifyTo: string): Promise<string> {
    const userId = await this.resolveUser(notifyTo);
    const opened = await this.api("conversations.open", { users: userId });
    const channel = String(opened.channel?.id ?? "");
    if (!channel) {
      throw new Error("Slack did not return a DM channel.");
    }
    return channel;
  }

  private async resolveUser(notifyTo: string): Promise<string> {
    const handle = notifyTo.trim().replace(/^@/, "");
    if (!handle) {
      throw new Error("Slack recipient is empty.");
    }
    if (handle.startsWith("U") && handle.length >= 8 && !handle.includes(" ")) {
      return handle;
    }
    if (handle.includes("@")) {
      const data = await this.api("users.lookupByEmail", { email: handle });
      const id = String(data.user?.id ?? "");
      if (!id) {
        throw new Error(`No Slack user for email ${handle}.`);
      }
      return id;
    }
    const id = await this.findUserByName(handle);
    if (!id) {
      throw new Error(`No Slack user named ${handle}.`);
    }
    return id;
  }

  private async findUserByName(name: string): Promise<string | undefined> {
    const wanted = name.toLowerCase();
    let cursor: string | undefined;
    do {
      const data = await this.api("users.list", {
        limit: 200,
        ...(cursor ? { cursor } : {}),
      });
      const members = Array.isArray(data.members) ? data.members : [];
      for (const member of members) {
        if (member.deleted || member.is_bot) {
          continue;
        }
        const names = [
          member.name,
          member.profile?.display_name,
          member.profile?.real_name,
        ]
          .filter(Boolean)
          .map((value: string) => value.toLowerCase());
        if (names.includes(wanted)) {
          return String(member.id);
        }
      }
      cursor = data.response_metadata?.next_cursor || undefined;
    } while (cursor);
    return undefined;
  }

  private async api(
    method: string,
    body: Record<string, unknown>,
  ): Promise<Record<string, any>> {
    const token = this.config.get<string>("SLACK_BOT_TOKEN")?.trim();
    if (!token) {
      throw new Error("SLACK_BOT_TOKEN is missing.");
    }

    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(body)) {
      if (value === undefined || value === null) {
        continue;
      }
      params.set(key, String(value));
    }

    const response = await fetch(`https://slack.com/api/${method}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params,
    });
    const data = (await response.json()) as Record<string, any>;
    if (!data.ok) {
      this.log.warn(`Slack ${method} failed: ${data.error}`);
      throw new Error(`Slack ${method}: ${data.error}`);
    }
    return data;
  }
}
