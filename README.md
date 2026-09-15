# Product Requirement Agent

A beginner-friendly Product Requirements Agent built with TypeScript and the OpenAI Agents SDK.

## What it does

It takes a software project idea and:
- identifies user roles
- identifies core features
- creates user stories
- creates acceptance criteria
- identifies business rules
- identifies ambiguities
- calls a simple `save_requirements` tool

## Run it

Requirements: Node.js 22+ recommended and an OpenAI API key with API credits/billing.

```bash
npm install
cp .env.example .env
```

Put your API key in `.env`:

```env
OPENAI_API_KEY=your_api_key_here
```

Then:

```bash
npm run dev
```

## Experiment

Edit `projectIdea` in `index.ts` and run the agent again.

## What to learn

Agent = instructions + model + optional tools.

Tool = a function the model can choose to call.

`run(agent, input)` executes the agent and handles the agent/tool loop.

Next learning steps: structured output -> context -> second agent -> multi-agent orchestration.
