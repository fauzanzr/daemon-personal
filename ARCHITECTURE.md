# Personal AI Hub — System Architecture & Implementation Blueprint

- **Version:** 1.0 (Final Blueprint)
- **Target Cost:** $0 / month (100% Free-Tier Ecosystem)
- **Primary Goal:** A private, single-user multi-provider AI web chatbot (comparable to Gemini & Claude) with intelligent model routing, automatic rate-limit (`429`) fallbacks, document extraction (`.pdf`, `.docx`, `.pptx`, `.xlsx`), screenshot vision support, multi-AI collaboration (*Side-by-Side Compare* & *Critic/Revise Mode*), and long-term PostgreSQL persistence.

---

## 1. Final Tech Stack & Dependencies

All layers use **TypeScript** inside a single **Next.js (App Router)** repository for seamless deployment on Vercel.

| Layer | Technology / Library | Purpose & Technical Role |
| :--- | :--- | :--- |
| **Language** | TypeScript (Full-Stack) | End-to-end type safety across multi-part AI payloads, streaming responses, and database queries. |
| **Framework** | Next.js (App Router) | Unified frontend UI and backend Route Handlers (`/api/chat`, `/api/extract`, `/api/auth`). |
| **AI Orchestration** | `ai` (Vercel AI SDK), `@ai-sdk/google`, `@ai-sdk/openai` | Unified streaming interface (`useChat`) across Google AI Studio, OpenRouter, and Groq. |
| **Styling & Icons** | Tailwind CSS + `lucide-react` | Minimalist, Apple/Claude-inspired UI with default **Dark Mode** and clean typography. |
| **Content Rendering** | `react-markdown`, `remark-gfm`, `remark-math`, `rehype-katex`, `shiki` | Renders GFM tables, LaTeX math formulas, and syntax-highlighted code blocks with one-click copy. |
| **Document Parsing** | `officeparser` (Server) + `FileReader` (Client) | Extracts clean text from `.pdf`, `.docx`, `.pptx`, `.xlsx` on the backend; reads code/text files directly in browser. |
| **Image Compression** | HTML5 `<canvas>` (Client) | Resizes pasted screenshots (`Ctrl+V`) to max `1280px` and compresses to JPEG (`0.8`) before Base64 encoding (~150–250 KB) to stay well within Vercel's 4.5 MB payload limit. |
| **Database & ORM** | Neon PostgreSQL (`@neondatabase/serverless`) + `drizzle-orm` | Long-term storage for chat history and system prompt presets without auto-pause penalties. |
| **Security** | Next.js `middleware.ts` + HTTP-Only Cookie | Single-user `APP_PIN` lock protecting all pages and API routes from unauthorized public access. |

---

## 2. Environment Variables (`.env.local`)

```env
# Required API Keys & Database
DATABASE_URL="postgresql://user:password@ep-xxx.aws.neon.tech/neondb?sslmode=require"
GOOGLE_GENERATIVE_AI_API_KEY="AIzaSy..."
OPENROUTER_API_KEY="sk-or-v1-..."

# Optional Fast Inference Provider
GROQ_API_KEY="gsk_..."

# Single-User Access Security
APP_PIN="123456"
```

---

## 3. Multi-Provider Routing & Anti-Limit Architecture

The backend handler (`/api/chat`) acts as a smart router to prevent `429 RESOURCE_EXHAUSTED` / rate-limit interruptions. It supports both server `.env` keys and optional client-side **BYOK (Bring Your Own Key)** headers (`x-google-key`, `x-openrouter-key`, `x-groq-key`) stored in `localStorage`.

### 3.1 Routing Decision Flow

```text
[ Incoming POST /api/chat: Messages + Optional Attachments + Selected Model ]
        │
        ├─► RULE 1 (Screenshot / Vision Detection):
        │     Does the latest user message contain an image?
        │     └── YES ──► Force Vision Model: `gemini-3.8-flash` (Fallback: `qwen/qwen2.5-vl-72b-instruct:free`)
        │
        ├─► RULE 2 (Long Document Detection):
        │     Does attached document text exceed 25,000 characters?
        │     └── YES ──► Route to `gemini-3.8-flash` (1M token context window)
        │
        └─► RULE 3 (Standard Execution + Auto-Fallback on HTTP 429):
              Run User's Selected Model ──► On HTTP 429 / Rate Limit Error
                                            Automatically retry with designated Fallback Model
                                            Return actual model used via `X-Model-Used` header
```

### 3.2 Provider & Model Matrix

| Category / Use Case | Primary Model ID | Provider | Fallback Model ID (on 429) |
| :--- | :--- | :--- | :--- |
| **General & Long Documents** | `gemini-3.8-flash` | Google AI Studio | `gemini-3.5-flash-lite` |
| **Deep Reasoning & Audit** | `deepseek/deepseek-r1:free` | OpenRouter | `gemini-3.8-flash` |
| **Coding & Kimi (Chinese AI)** | `moonshotai/kimi-k2:free` | OpenRouter | `qwen/qwen-2.5-coder-32b-instruct:free` |
| **Specialist Code Generation** | `qwen/qwen-2.5-coder-32b-instruct:free` | OpenRouter | `gemini-3.8-flash` |
| **Ultra-Fast Lightweight Chat** | `llama-3.3-70b-versatile` | Groq (Optional) | `gemini-3.5-flash-lite` |
| **Vision / Screenshot OCR** | `gemini-3.8-flash` | Google AI Studio | `qwen/qwen2.5-vl-72b-instruct:free` |

### 3.3 Token-Saving Controls
- **Sliding Window Context Toggle:** Allows sending only the **last 8–10 messages** in long conversations to keep Tokens Per Minute (TPM) low.
- **Privacy & Safety Rule:** Never input passwords, private credentials, or confidential data into free-tier endpoints, as providers may log prompts for model improvement.

---

## 4. Document Extraction & Vision Screenshot Pipeline

### 4.1 Document Extraction (`Text-First Strategy`)
Sending raw binary PDFs or PPTX files wastes token quotas and fails on text-only models. All documents are converted to clean text before inference:
- **Code & Plain Text (`.txt`, `.md`, `.py`, `.ts`, `.tsx`, `.sql`, `.json`, `.csv`):** Read client-side via `FileReader` (`file.text()`).
- **Office & PDF (`.pdf`, `.docx`, `.pptx`, `.xlsx`):** Uploaded via `FormData` to `POST /api/extract`, parsed via `officeparser`, stripped of excessive blank lines, and returned as `{ fileName, charCount, estimatedTokens: Math.ceil(charCount / 4), content }`.
- **Prompt Wrapping Format:**
  ```xml
  <attached_document name="Lecture_Notes.pptx">
  [Extracted clean text...]
  </attached_document>
  ```
- **UI Indicator:** Display a pill badge above the input box showing filename and `~estimatedTokens` before sending.

### 4.2 Screenshot Vision Pipeline (`Ctrl+V` Paste)
1. Listen to `onPaste` on the chat textarea for clipboard `image/*` items.
2. Compress via HTML5 `<canvas>` (`src/lib/image-compress.ts`): scale longest side to max `1280px` while maintaining aspect ratio, export as `image/jpeg` at `0.8` quality (~150–250 KB).
3. Display removable image thumbnail previews above the textarea.
4. Send as multi-part content (`{ type: 'text', text }`, `{ type: 'image', image: base64DataUrl }`) compatible with Vercel AI SDK.

---

## 5. Multi-AI Collaboration Features

### 5.1 Multi-AI Side-by-Side Compare Mode
- Activated via a `"Compare Models"` toggle in the chat header.
- Sends the user prompt in parallel (`Promise.all`) to 2–3 selected models from **different providers** (e.g., `gemini-3.8-flash` + `moonshotai/kimi-k2:free` + `deepseek/deepseek-r1:free`) so they do not exhaust the same provider's RPM limit.
- Renders responses side-by-side in split cards with a **"Select as Main Answer"** button. The chosen answer becomes the active context for subsequent turns, while unselected responses are archived in the message's `alternatives` JSONB column.

### 5.2 AI Critic / Revise Mode
- Every assistant message bubble includes a `"Revise with another model ▾"` action button.
- Clicking it sends a structured critique request to the chosen reviewer model without requiring the user to retype anything:
  ```xml
  <original_question>
  [Original user prompt]
  </original_question>

  <previous_answer model="[previous_model_id]">
  [Initial assistant response]
  </previous_answer>

  Act as a senior technical reviewer. Audit the answer above for bugs, logical gaps, or suboptimal patterns, then provide a significantly improved and complete revision.
  ```

---

## 6. Long-Term Database Architecture (Neon PostgreSQL)

### 6.1 Text-Only Storage Policy
Neon's free tier provides **512 MB** of storage and does not auto-pause/delete inactive projects. To ensure 5–10 years of capacity (~15,000–30,000 chat threads):
- **NEVER store Base64 image strings in PostgreSQL.** Store only lightweight JSON attachment metadata (`name`, `type`, `tokenEstimate`).
- Provide a **One-Click Backup Export** button in Settings to download all chats and messages as `.json` or `.md`.

### 6.2 Drizzle ORM Schema (`src/db/schema.ts`)

```typescript
import { pgTable, uuid, text, timestamp, boolean, jsonb, index } from 'drizzle-orm/pg-core';

export const chats = pgTable('chats', {
  id: uuid('id').defaultRandom().primaryKey(),
  title: text('title').notNull(),
  modelId: text('model_id').notNull().default('gemini-3.8-flash'),
  systemPrompt: text('system_prompt'),
  isPinned: boolean('is_pinned').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const messages = pgTable(
  'messages',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    chatId: uuid('chat_id')
      .references(() => chats.id, { onDelete: 'cascade' })
      .notNull(),
    parentMessageId: uuid('parent_message_id'),
    role: text('role', { enum: ['user', 'assistant', 'system'] }).notNull(),
    content: text('content').notNull(),
    modelUsed: text('model_used'),
    revisionType: text('revision_type').default('initial').notNull(), // 'initial' | 'critique' | 'side_by_side'
    attachments: jsonb('attachments').$type<
      {
        type: 'document' | 'image';
        name: string;
        tokenEstimate?: number;
      }[]
    >(),
    alternatives: jsonb('alternatives').$type<
      {
        modelId: string;
        content: string;
      }[]
    >(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    chatIdIdx: index('messages_chat_id_idx').on(table.chatId),
  })
);

export const presets = pgTable('presets', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  systemPrompt: text('system_prompt').notNull(),
  defaultModel: text('default_model').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
```

---

## 7. Directory Structure & Phased Execution Roadmap

### 7.1 Project Folder Structure

```text
personal-ai-hub/
├── ARCHITECTURE.md
├── drizzle.config.ts
├── .env.local
└── src/
    ├── middleware.ts                   # Single-user PIN cookie guard
    ├── app/
    │   ├── api/
    │   │   ├── auth/route.ts           # PIN login & logout endpoint
    │   │   ├── chat/route.ts           # Multi-provider streaming, Smart Router, Fallback & Revise
    │   │   ├── extract/route.ts        # PDF/DOCX/PPTX/XLSX text extraction
    │   │   └── chats/                  # CRUD & JSON/Markdown export endpoints
    │   ├── chat/[id]/page.tsx          # Active conversation route
    │   ├── login/page.tsx              # Minimalist PIN login page
    │   └── page.tsx                    # New chat landing page
    ├── components/
    │   ├── chat/
    │   │   ├── chat-interface.tsx      # Main chat state, Compare Mode & Sliding Window toggle
    │   │   ├── message-bubble.tsx      # Markdown + Shiki code blocks + Revise action menu
    │   │   ├── prompt-input.tsx        # Auto-resize textarea, Ctrl+V screenshot paste, file upload
    │   │   └── model-selector.tsx      # Provider/Model dropdown & System Prompt preset picker
    │   └── sidebar/
    │       ├── chat-sidebar.tsx        # Chat history list, search, pin/delete, Settings trigger
    │       └── settings-modal.tsx      # BYOK keys (localStorage), Presets manager, Export backup
    ├── db/
    │   ├── index.ts                    # Neon serverless + Drizzle client
    │   └── schema.ts                   # Database tables
    └── lib/
        ├── ai-providers.ts             # Google, OpenRouter, Groq clients & fallback mappings
        └── image-compress.ts           # Client-side HTML5 Canvas image compressor
```

### 7.2 Phased Implementation Order (For Agentic Execution)
1. **Phase 1 — Foundation & Multi-Provider Backend:** Initialize Next.js + Tailwind + TypeScript, install dependencies, configure Drizzle schema (`src/db/schema.ts`), build `src/lib/ai-providers.ts` and `src/app/api/chat/route.ts` with Smart Routing, Auto-Fallback `429`, and Revise mode, plus `APP_PIN` middleware.
2. **Phase 2 — Document Extraction & Vision Input:** Implement `POST /api/extract` (`officeparser`), `src/lib/image-compress.ts`, and `prompt-input.tsx` supporting `Ctrl+V` screenshot paste and file attachments with token estimation badges.
3. **Phase 3 — Minimalist UI & Multi-AI Collaboration:** Build dark-mode chat interface, `message-bubble.tsx` (Markdown + LaTeX + Shiki + Copy button), `"Revise with another model"` dropdown, and `"Compare Models"` side-by-side split view.
4. **Phase 4 — Persistence, Presets & Backup:** Connect all chat/message CRUD operations to Neon PostgreSQL, build the sidebar with search/pinning, System Prompt Presets manager, BYOK `localStorage` settings, and one-click `.json`/`.md` backup export.