# Product Requirement Agent

NestJS Spec-stage backend.

- **Question agent** — ranked clarification questions
- **Requirements agent** — structured MVP requirements
- **Planning agent** — factory handoff packet
- **Orchestrator** — questions → human answers → requirements → plan

Uses Groq through the OpenAI client. Tools are local file writes. Runs are in-memory (lost on restart).
## Setup

```bash
npm install
cp .env.example .env
```

Get a free key at [console.groq.com](https://console.groq.com). Put it in `.env`:

```env
GROQ_API_KEY=gsk_...
GROQ_MODEL=openai/gpt-oss-20b
PORT=3000
SLACK_BOT_TOKEN=xoxb-...
```

`openai/gpt-oss-20b` stays on Groq's free tier. For a stronger pass, try `openai/gpt-oss-120b` or `qwen/qwen3.6-27b`.

## Run

```bash
npm run start:dev
```

Open [http://localhost:3000](http://localhost:3000) for a simple control UI (intake, questions, answers, requirements, plan).

Health check:

```bash
curl http://localhost:3000/spec/health
```

## Pipeline (recommended)

Start a run. Response includes `id`, `status: waiting_for_answers`, and `questions`.

```bash
curl -X POST http://localhost:3000/spec/runs \
  -H "Content-Type: application/json" \
  -d "{\"prd\": \"A streaming platform like netflix but free\"}"
```

Inspect:

```bash
curl http://localhost:3000/spec/runs/RUN_ID
```

Answer required questions, then the server runs refine + plan:

```bash
curl -X POST http://localhost:3000/spec/runs/RUN_ID/answers \
  -H "Content-Type: application/json" \
  -d "{\"answers\":[{\"id\":\"Q-001\",\"answer\":\"Ad-supported free streaming\"}]}"
```

## Slack DMs

Optional. Create a Slack app bot with `chat:write`, `im:write`, `im:history`, `users:read`, `users:read.email`, `channels:read`, `channels:join`, `channels:history`. Install it to the workspace. Put `SLACK_BOT_TOKEN` in `.env`.

On Start run, fill a **channel** like `#all-ai-factory-championship` (recommended — people can reply in the thread). Email/`@username` DMs often show “Sending messages to this app has been turned off” on workspaces with AI apps enabled.

Invite the bot to that channel. Add bot scopes `channels:read`, `channels:join`, `channels:history`, then reinstall.

Reply in the Slack **thread**:

```
Q-001: Ad-supported, web only
Q-002: United States, English
```

Then click **Import Slack replies** on the UI (or keep answering in the form). Google Chat is not wired; Slack matches the championship UAT path.

## Single-agent endpoints

Ask clarification questions for a one-line brief:

```bash
curl -X POST http://localhost:3000/spec/questions \
  -H "Content-Type: application/json" \
  -d "{\"prd\": \"A streaming platform like netflix but free\"}"
```

Refine the bundled WorkBoard PRD:

```bash
curl -X POST http://localhost:3000/spec/refine
```

Plan from the last refine output (or send your own `prd`):

```bash
curl -X POST http://localhost:3000/spec/plan
```

Or send your own markdown:

```bash
curl -X POST http://localhost:3000/spec/refine ^
  -H "Content-Type: application/json" ^
  -d "{\"prd\": \"# My app\\nUsers can sign in and create tasks.\"}"
```

Output is written to `output/questions.md`, `output/questions.json`, `output/requirements.md`, `output/plan.md`, and `output/plan.json`.
