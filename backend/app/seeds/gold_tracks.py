import logging
from typing import List
from app.ml.chunker import compute_flesch_kincaid_grade
from app.models.content import (
    ContentAdaptation,
    Lesson,
    SemanticChunk,
    SpeedCheckQuestion,
    TrackTier,
)

logger = logging.getLogger("adaptived.seeds")

GOLD_TRACKS_DATA = [
    {
        "track_id": "react-gold",
        "slug": "react-reconciliation-fiber",
        "title": "React 19 Reconciliation & Fiber Architecture",
        "description": "Master React's cooperative multitasking reconciliation engine, fiber node trees, and prioritized lane scheduling.",
        "order": 1,
        "estimated_duration_minutes": 15,
        "prerequisites": ["JavaScript ES6+", "DOM Fundamentals"],
        "chunks": [
            {
                "title": "The Virtual DOM Fallacy & The Need for Fiber",
                "content": (
                    "In early React architectures, reconciliation was a synchronous recursive walk over the virtual DOM tree. "
                    "When updating a deep component hierarchy, the main thread was completely blocked until the reconciliation traversal concluded. "
                    "This 'stack reconciler' caused noticeable frame drops and sluggish input responsiveness during rapid keystrokes or complex animations. "
                    "React Fiber fundamentally re-architected this process by turning the component tree into a singly linked list of mutable work units called Fiber nodes. "
                    "This architectural shift enables cooperative multitasking: React can pause ongoing reconciliation, yield control back to the browser event loop for urgent user events, and resume work seamlessly."
                ),
                "speed_check": {
                    "question": "What primary architectural flaw in the legacy Stack Reconciler necessitated React Fiber?",
                    "options": [
                        "It lacked support for CSS-in-JS style sheet compilations.",
                        "It performed synchronous recursion that monopolized the main thread, blocking urgent user input.",
                        "It was unable to serialize virtual DOM trees across HTTP network boundaries.",
                        "It required manual garbage collection invocations after every render pass.",
                    ],
                    "correct_option_index": 1,
                    "explanation": "The Stack Reconciler's synchronous recursive walk blocked the main thread until completion, causing frame drops during heavy renders.",
                },
                "adaptation": {
                    "simplified_markdown": (
                        "### Mental Model: The Fiber Task Scheduler\n\n"
                        "- **Stack Reconciler (Old):** Like waiting for a chef to cook a 10-course banquet without pause; if a customer asks for a glass of water, they must wait until all 10 courses finish.\n"
                        "- **Fiber Reconciler (Modern):** The chef preps one dish, pauses to serve water if requested, and returns to the kitchen right where they left off.\n\n"
                        "> [!TIP] Fiber transforms React from an all-or-nothing recursion loop into an interruptible cooperative scheduler."
                    ),
                    "mermaid_diagram": (
                        "graph TD\n"
                        "  A[User Event: Keystroke] --> B{Browser Event Loop}\n"
                        "  B -->|Yield Priority| C[Urgent Input Handler]\n"
                        "  B -->|Idle Period| D[Fiber Node Reconciliation]\n"
                        "  D -->|Time Slice Expired| B\n"
                        "  D -->|Work Finished| E[Commit Phase to Real DOM]\n"
                    ),
                    "code_annotations": [
                        "Fiber nodes link together using child, sibling, and return pointers.",
                        "The commit phase is always synchronous to prevent visual tearing in the DOM.",
                    ],
                },
            },
            {
                "title": "Double Buffering: Current vs WorkInProgress Trees",
                "content": (
                    "To guarantee zero visual tearing during interruptible renders, React utilizes a classic computer graphics technique known as double buffering. "
                    "At any given instant, React maintains two parallel trees: the 'current' tree, which mirrors what is currently rendered on screen, and the 'workInProgress' tree. "
                    "All expensive diffing, hook executions, and effect allocations occur exclusively on the workInProgress tree in memory without touching real DOM nodes. "
                    "Once the entire workInProgress tree has finished evaluating all priority lanes, React executes the synchronous Commit Phase. "
                    "With a single pointer swap (`workInProgress.alternate`), the workInProgress tree instantly becomes the current tree, presenting the updated UI atomically to the user."
                ),
                "speed_check": {
                    "question": "How does React's double-buffering architecture prevent visual tearing during long render passes?",
                    "options": [
                        "By writing render diffs directly to the GPU video buffer via WebGL.",
                        "By performing all render calculations on an in-memory workInProgress tree and swapping pointers only upon completion.",
                        "By locking the browser screen with a CSS backdrop filter until rendering finishes.",
                        "By running React components inside a secondary Service Worker thread.",
                    ],
                    "correct_option_index": 1,
                    "explanation": "Double buffering ensures modifications remain offscreen in the workInProgress tree until the entire frame is ready to commit atomically.",
                },
                "adaptation": {
                    "simplified_markdown": (
                        "### Mental Model: Dual Canvas Painting\n\n"
                        "- **Current Tree:** The framed painting hanging on the museum wall that visitors are admiring right now.\n"
                        "- **WorkInProgress Tree:** The artist's easel behind the curtain where corrections and paint strokes are applied in private.\n"
                        "- **The Pointer Swap:** Once the painting is finished, the curtain is pulled back instantly replacing the old painting in one atomic motion."
                    ),
                    "mermaid_diagram": (
                        "graph LR\n"
                        "  Current[Current Fiber Tree] -.->|Mirrors Real DOM| Screen[Screen Display]\n"
                        "  WIP[WorkInProgress Tree] -->|Offscreen Processing| Prep[Memory Allocations]\n"
                        "  Prep -->|Commit Phase| Swap[Atomic Pointer Swap: alternate]\n"
                        "  Swap --> Current\n"
                    ),
                    "code_annotations": [
                        "workInProgress nodes reuse existing Fiber object allocations to minimize garbage collection pauses.",
                        "alternate pointers allow bidirectional traversal between both trees.",
                    ],
                },
            },
        ],
    },
    {
        "track_id": "nextjs-gold",
        "slug": "nextjs-server-actions-lifecycle",
        "title": "Next.js 15 Server Actions & Streaming RSC Lifecycle",
        "description": "Deep-dive into the HTTP wire format, closure serialization, and optimistic mutation lifecycle of React Server Components and Server Actions.",
        "order": 1,
        "estimated_duration_minutes": 20,
        "prerequisites": ["React Basics", "HTTP Protocols"],
        "chunks": [
            {
                "title": "Server Actions as POST Endpoints Under The Hood",
                "content": (
                    "While Server Actions resemble normal asynchronous JavaScript functions declared alongside your components, they compile into dedicated RPC POST endpoints. "
                    "When a client component triggers a Server Action, Next.js generates an HTTP POST request carrying a cryptographic action ID header (`Next-Action`). "
                    "Closed-over scope variables in the client environment are encrypted and serialized into the payload using React's flight protocol format. "
                    "The server decodes the action ID, verifies the cryptographic signature to prevent arbitrary remote code execution, and executes the server function inside Node.js or edge runtimes. "
                    "Crucially, the response does not return bare JSON; it streams an updated React Server Component flight representation, allowing the client to revalidate router cache boundaries in the same roundtrip."
                ),
                "speed_check": {
                    "question": "What wire payload does a Next.js Server Action return to the browser upon execution?",
                    "options": [
                        "A standard HTTP 302 redirect header with an empty JSON body.",
                        "A raw SQL result set stream parsed directly by the client browser.",
                        "An RSC Flight stream containing both action results and revalidated component cache boundaries.",
                        "A newly compiled WebAssembly binary containing the client component updates.",
                    ],
                    "correct_option_index": 2,
                    "explanation": "Server Actions return an RSC Flight stream that seamlessly revalidates server components and mutates cache boundaries in a single network trip.",
                },
                "adaptation": {
                    "simplified_markdown": (
                        "### Mental Model: The Cryptographic Tube\n\n"
                        "- **What you write:** `const res = await updateUser(id);`\n"
                        "- **What actually happens:** Your browser creates an HTTP POST request to `/`, sends an encrypted token representing `updateUser`, and Next.js runs it on your server.\n"
                        "- **The Superpower:** You get instant data mutation and cache revalidation in 1 single roundtrip instead of making an API call and then manually refetching 3 queries."
                    ),
                    "mermaid_diagram": (
                        "sequenceDiagram\n"
                        "  autonumber\n"
                        "  Client->>Server: HTTP POST (Next-Action header + Encrypted Scope)\n"
                        "  Server->>Server: Decrypt Action ID & Execute Node.js Handler\n"
                        "  Server->>Server: Trigger revalidateTag / revalidatePath\n"
                        "  Server-->>Client: Stream RSC Flight Protocol Response\n"
                        "  Client->>Client: Atomically Merge New RSC UI Tree\n"
                    ),
                    "code_annotations": [
                        "'use server' directives mark function boundary crossings for the compiler.",
                        "Always re-authenticate the user inside the server action; client closure state is never trusted.",
                    ],
                },
            }
        ],
    },
    {
        "track_id": "mongodb-gold",
        "slug": "mongodb-compound-indexing-strategy",
        "title": "MongoDB High-Concurrency Compound Indexing",
        "description": "Architect high-performance MongoDB indices using the ESR (Equality, Sort, Range) rule to prevent COLLSCAN bottlenecks.",
        "order": 1,
        "estimated_duration_minutes": 18,
        "prerequisites": ["Database Basics"],
        "chunks": [
            {
                "title": "The ESR (Equality, Sort, Range) Principle",
                "content": (
                    "When designing compound indices in MongoDB, field ordering dictates whether the query engine executes an optimal index scan (IXSCAN) or degrades into an in-memory sort. "
                    "The ESR guideline mandates that index fields must follow a strict three-tier sequence: Equality fields first, followed by Sort fields, followed by Range filter fields. "
                    "Equality fields narrow down the index tree traversal to an exact B-tree node branch with maximum selectivity. "
                    "Placing Sort fields immediately after Equality fields guarantees that the returned index keys are already physically ordered on disk, eliminating expensive in-memory sort buffers (which fail if memory exceeds 32MB). "
                    "Finally, Range fields ($gt, $lt, $in) are placed last because a range boundary search scatters key traversals across multiple leaf pages, making subsequent index-backed sorting impossible."
                ),
                "speed_check": {
                    "question": "According to the ESR rule, why must Sort fields precede Range fields in a compound index?",
                    "options": [
                        "Because MongoDB drivers automatically reverse index keys containing range constraints.",
                        "Because range filters traverse multiple B-tree leaf nodes, destroying the physical ordering required for index-backed sorting.",
                        "Because Range queries require BSON document decryption while Sort queries do not.",
                        "Because MongoDB compound indices are limited to a maximum depth of two fields.",
                    ],
                    "correct_option_index": 1,
                    "explanation": "A range filter splits traversals across disparate index leaves; any sort fields placed after a range require an expensive in-memory sort pass.",
                },
                "adaptation": {
                    "simplified_markdown": (
                        "### Mental Model: The Library Filing Cabinet\n\n"
                        "- **E (Equality):** Pull open the exact drawer labeled 'Section: React' (eliminates 99% of books immediately).\n"
                        "- **S (Sort):** The books inside that specific drawer are already arranged by Publication Date on the shelf—zero re-sorting needed.\n"
                        "- **R (Range):** You simply take the books published between 2022 and 2026 by sliding your finger across that section."
                    ),
                    "mermaid_diagram": (
                        "graph TD\n"
                        "  A[Query Arrives] --> B[1. Equality Match: Exact B-Tree Match]\n"
                        "  B --> C[2. Sort Match: Sequential Leaf Pointer Scan]\n"
                        "  C --> D[3. Range Filter: Scan Upper & Lower Bounds]\n"
                        "  D --> E[IXSCAN Succeeded: Zero In-Memory Sort Overhead]\n"
                    ),
                    "code_annotations": [
                        "Compound index: db.orders.createIndex({ status: 1, createdAt: -1, total: 1 })",
                        "Verify with explain('executionStats') that totalKeysExamined equals nReturned.",
                    ],
                },
            }
        ],
    },
]


async def seed_gold_tracks() -> int:
    """
    Idempotent seeding script for verified Gold Tracks.
    Populates lessons and atomic semantic chunks with pre-calibrated baselines and visual analogies.
    """
    seeded_count = 0
    wpm_baseline = 220.0

    for track_data in GOLD_TRACKS_DATA:
        existing = await Lesson.find_one(Lesson.slug == track_data["slug"])
        if existing:
            logger.info(f"Lesson '{track_data['slug']}' already seeded; skipping.")
            continue

        raw_chunks = track_data["chunks"]
        total_words = 0
        total_grade = 0.0

        created_chunks: List[SemanticChunk] = []

        # Create Lesson placeholder to acquire an ID
        lesson = Lesson(
            track_id=track_data["track_id"],
            track_tier=TrackTier.GOLD,
            slug=track_data["slug"],
            title=track_data["title"],
            description=track_data["description"],
            order=track_data["order"],
            estimated_duration_minutes=track_data["estimated_duration_minutes"],
            prerequisites=track_data["prerequisites"],
            total_chunks=len(raw_chunks),
        )
        await lesson.insert()

        for idx, chunk_info in enumerate(raw_chunks):
            content_str = chunk_info["content"]
            sentences = [s.strip() for s in content_str.split(". ") if s.strip()]
            words = sum(len(s.split()) for s in sentences)
            total_words += words

            fk_grade = compute_flesch_kincaid_grade(content_str, len(sentences), words)
            total_grade += fk_grade
            dwell_ms = int((words / wpm_baseline) * 60_000)

            # Build SpeedCheckQuestion
            speed_check = None
            if "speed_check" in chunk_info:
                sc = chunk_info["speed_check"]
                speed_check = SpeedCheckQuestion(
                    question=sc["question"],
                    options=sc["options"],
                    correct_option_index=sc["correct_option_index"],
                    explanation=sc["explanation"],
                )

            # Build ContentAdaptation
            cached_adaptations = {}
            if "adaptation" in chunk_info:
                ad = chunk_info["adaptation"]
                cached_adaptations["OVERLOAD_SIMPLIFIED"] = ContentAdaptation(
                    adaptation_type="OVERLOAD_SIMPLIFIED",
                    simplified_markdown=ad["simplified_markdown"],
                    mermaid_diagram=ad["mermaid_diagram"],
                    code_annotations=ad["code_annotations"],
                )

            chunk_doc = SemanticChunk(
                lesson_id=str(lesson.id),
                chunk_index=idx,
                title=chunk_info["title"],
                content=content_str,
                sentence_count=len(sentences),
                word_count=words,
                flesch_kincaid_grade=fk_grade,
                target_dwell_ms=dwell_ms,
                speed_check=speed_check,
                cached_adaptations=cached_adaptations,
            )
            await chunk_doc.insert()
            created_chunks.append(chunk_doc)

        lesson.total_words = total_words
        lesson.average_complexity = round(total_grade / max(1, len(raw_chunks)), 2)
        await lesson.save()

        seeded_count += 1
        logger.info(f"Seeded lesson '{lesson.title}' with {len(created_chunks)} pre-calibrated chunks.")

    return seeded_count

