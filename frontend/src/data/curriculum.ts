import { SemanticChunkData } from "../components/AdaptiveChunkReader";

export interface TopicModule {
  id: string;
  slug: string;
  title: string;
  shortDescription: string;
  estimatedMinutes: number;
  chunks: SemanticChunkData[];
}

export interface TechnologyTrack {
  id: string;
  name: string;
  category: "frontend" | "backend" | "databases" | "production";
  description: string;
  topics: TopicModule[];
}

export const FRONTEND_CURRICULUM: TechnologyTrack[] = [
  // =========================================================================
  // TRACK 1: CSS & TAILWIND CSS ARCHITECTURE (Comprehensive Deep Masterclass)
  // =========================================================================
  {
    id: "css",
    name: "Modern CSS & Tailwind Architecture",
    category: "frontend",
    description: "Deep dive from Box Model and Stacking Contexts to the complete GeeksforGeeks Tailwind CSS guide (~30 mins).",
    topics: [
      {
        id: "css-box-model",
        slug: "css-box-model-stacking",
        title: "1. The Box Model, Sizing & Stacking Contexts",
        shortDescription: "Content, padding, border, margin collapse, and z-index isolation.",
        estimatedMinutes: 14,
        chunks: [
          {
            id: "css-bm-1",
            chunk_index: 0,
            title: "Box-Sizing: border-box vs content-box",
            content:
              "In standard CSS, the default box-sizing property is 'content-box', where declared width and height apply strictly to the content area. Adding padding or borders expands the computed element dimensions outward, frequently causing layout overflows. Modern engineering standards universally enforce 'box-sizing: border-box', ensuring that padding and borders are absorbed inside the declared dimensions. Stacking contexts are formed when properties like opacity (< 1), transform, or will-change are asserted, creating an isolated local z-index tree that prevents internal child elements from overlapping outer siblings.",
            sentence_count: 4,
            word_count: 82,
            flesch_kincaid_grade: 9.8,
            target_dwell_ms: 22000,
            speed_check: {
              question: "Why does modern CSS universally apply 'box-sizing: border-box'?",
              options: [
                "It enables GPU hardware acceleration for CSS animations.",
                "It ensures declared width and height include padding and borders, preventing accidental layout expansion.",
                "It automatically converts inline elements into flex containers.",
                "It compresses stylesheet file sizes across HTTP network boundaries.",
              ],
              correct_option_index: 1,
              explanation: "border-box absorbs padding and border within the declared width, preventing layout breakage.",
            },
            cached_adaptations: {
              OVERLOAD_SIMPLIFIED: {
                simplified_markdown:
                  "### Mental Model: The Shipping Parcel\n\n- **content-box (Old):** You buy a 10-inch box. When you wrap it with bubble wrap (padding) and cardboard (border), the parcel expands to 14 inches and won't fit in your mailbox.\n- **border-box (Modern):** The outer shipping parcel is fixed at exactly 10 inches. Any bubble wrap fits inside without changing external dimensions.",
                mermaid_diagram:
                  "graph TD\n  Border[Border: Outer Edge] --> Padding[Padding: Internal Buffer]\n  Padding --> Content[Content Box: Text / Children]",
                code_annotations: ["* { box-sizing: border-box; } should be declared at the stylesheet root."],
              },
            },
          },
          {
            id: "css-bm-2",
            chunk_index: 1,
            title: "Margin Collapsing & Stacking Context Isolation",
            content:
              "Margin collapsing occurs when adjoining vertical margins of block-level elements merge into a single combined margin whose size equals the maximum of the individual margins. This behavior never applies to horizontal margins, flex items, grid items, or elements with absolute positioning. Stacking contexts form a 3D conceptual layering tree along the z-axis of the viewport. Creating a stacking context via 'position: relative' with a non-auto z-index or 'opacity: 0.99' traps all child elements inside that layer, meaning a child with 'z-index: 9999' cannot render above an outside element with 'z-index: 2' if the parent's layer is below it.",
            sentence_count: 4,
            word_count: 95,
            flesch_kincaid_grade: 10.4,
            target_dwell_ms: 25000,
            speed_check: {
              question: "When does margin collapsing occur in standard CSS layouts?",
              options: [
                "Between adjacent horizontal margins in a flexbox row.",
                "Between adjacent vertical margins of block-level elements in normal flow.",
                "Whenever an element has 'display: grid' applied.",
                "Inside absolute positioned modal dialogs.",
              ],
              correct_option_index: 1,
              explanation: "Vertical margins of adjacent block elements in normal flow collapse to the maximum single margin value.",
            },
          },
        ],
      },
      {
        id: "css-flexbox-grid",
        slug: "css-flexbox-grid-layouts",
        title: "2. Flexbox vs Grid: 1D vs 2D Layout Engines",
        shortDescription: "Axis distribution, fractional units (fr), and auto-fit responsive patterns.",
        estimatedMinutes: 16,
        chunks: [
          {
            id: "css-fg-1",
            chunk_index: 0,
            title: "Dimensionality: When to Choose Flexbox vs CSS Grid",
            content:
              "Flexbox is fundamentally a one-dimensional layout model designed for distributing space along either a main axis or cross axis. It excels at linear micro-components like navigation bars, button clusters, and vertical media card headers. In contrast, CSS Grid is a two-dimensional layout engine capable of orchestrating rows and columns simultaneously. Grid's fractional unit ('fr') distributes leftover track space proportionally, while patterns like 'repeat(auto-fit, minmax(280px, 1fr))' produce fully responsive multi-column layouts without requiring media queries.",
            sentence_count: 4,
            word_count: 76,
            flesch_kincaid_grade: 10.2,
            target_dwell_ms: 21000,
            speed_check: {
              question: "What is the core architectural difference between Flexbox and CSS Grid?",
              options: [
                "Flexbox runs on the CPU while CSS Grid is executed on the GPU.",
                "Flexbox is a 1-dimensional axis distributor, whereas Grid orchestrates 2-dimensional rows and columns simultaneously.",
                "Flexbox requires JavaScript polyfills in modern mobile browsers.",
                "CSS Grid cannot align child elements along a cross axis.",
              ],
              correct_option_index: 1,
              explanation: "Flexbox manages one axis at a time; CSS Grid simultaneously manages rows and columns.",
            },
          },
          {
            id: "css-fg-2",
            chunk_index: 1,
            title: "Flex Items Sizing: flex-grow, flex-shrink, and flex-basis",
            content:
              "A flex item's dimension is governed by three interconnected properties shorthand as 'flex: grow shrink basis'. The 'flex-basis' defines the initial size of an item before remaining free space is distributed along the main axis. If excess space exists, 'flex-grow' determines what proportion of that remaining space the element absorbs. Conversely, when space is constrained and items must shrink to avoid overflowing the container, 'flex-shrink' controls how aggressively the item compresses, with a value of 0 preventing the item from shrinking entirely.",
            sentence_count: 4,
            word_count: 84,
            flesch_kincaid_grade: 9.6,
            target_dwell_ms: 23000,
            speed_check: {
              question: "How do you prevent a specific flex item from shrinking when container space runs out?",
              options: [
                "Set 'flex-grow: 0'.",
                "Set 'flex-shrink: 0'.",
                "Set 'flex-basis: auto'.",
                "Set 'align-self: baseline'.",
              ],
              correct_option_index: 1,
              explanation: "'flex-shrink: 0' explicitly commands the flex item never to reduce below its base size.",
            },
          },
        ],
      },
      {
        id: "css-tailwind",
        slug: "tailwind-css-comprehensive",
        title: "3. Complete Tailwind CSS Guide (GeeksforGeeks Aligned)",
        shortDescription: "Utility-first paradigm, installation, JIT compiler, spacing scale, flex/grid, responsive variants & dark mode (~30 mins).",
        estimatedMinutes: 30,
        chunks: [
          {
            id: "css-tw-1",
            chunk_index: 0,
            title: "What is Tailwind CSS & The Utility-First Paradigm",
            content:
              "Tailwind CSS is a utility-first CSS framework created by Adam Wathan that provides highly composable, low-level atomic classes like 'flex', 'pt-4', 'text-center', and 'rotate-90'. Unlike component-based frameworks like Bootstrap or Bulma that provide pre-styled opinionated buttons and navigation cards, Tailwind gives you atomic building blocks. This eliminates class-naming paralysis (avoiding endless debates over BEM naming like 'card__header--active') and guarantees that you rarely write custom CSS files. Every visual property is constructed directly in your markup, keeping style and structure tightly co-located.",
            sentence_count: 4,
            word_count: 85,
            flesch_kincaid_grade: 9.9,
            target_dwell_ms: 23000,
            speed_check: {
              question: "What differentiates Tailwind CSS from component frameworks like Bootstrap?",
              options: [
                "Tailwind ships pre-designed components like buttons, while Bootstrap only provides layout grids.",
                "Tailwind is utility-first, providing low-level styling classes rather than pre-styled opinionated components.",
                "Tailwind runs exclusively via a Node.js runtime on the server.",
                "Tailwind requires writing all styles in SCSS pre-processors.",
              ],
              correct_option_index: 1,
              explanation: "Tailwind provides atomic utility classes allowing bespoke UI composition without pre-styled opinions.",
            },
          },
          {
            id: "css-tw-2",
            chunk_index: 1,
            title: "Tailwind JIT Compiler & Production Performance",
            content:
              "Traditional CSS files continuously grow in file size over the lifetime of a project because developers hesitate to delete obsolete classes for fear of breaking dependent views. Tailwind CSS eliminates this issue through its Just-In-Time (JIT) compiler engine. During development and production builds, the JIT engine scans your template files (HTML, JS, TSX) in real-time and generates strictly the CSS rules that are actively being used in your code. Consequently, the production CSS bundle typically remains between 10KB to 25KB regardless of how massive your application becomes.",
            sentence_count: 4,
            word_count: 85,
            flesch_kincaid_grade: 10.5,
            target_dwell_ms: 23000,
            speed_check: {
              question: "Why does a Tailwind CSS production bundle rarely exceed 25KB in large applications?",
              options: [
                "Because Tailwind compresses fonts into SVG vectors.",
                "Because the JIT compiler scans templates and generates only the utility classes physically in use.",
                "Because Tailwind converts all CSS into inline HTML attributes at runtime.",
                "Because Tailwind downloads stylesheets on demand from a global CDN.",
              ],
              correct_option_index: 1,
              explanation: "Tailwind's JIT compiler purges unused rules and only compiles classes actively referenced in source files.",
            },
          },
          {
            id: "css-tw-3",
            chunk_index: 2,
            title: "The 4px Numeric Scale, Spacing, and Sizing",
            content:
              "Tailwind establishes design consistency by mapping padding, margin, width, and height to a standardized proportional scale where 1 unit corresponds to 0.25rem (4 pixels in default root configurations). For example, 'p-1' equals 4px, 'p-2' equals 8px, 'p-4' equals 16px, and 'p-12' equals 48px. Sizing utilities support fractions such as 'w-1/2' (50%), 'w-full' (100%), and viewport units like 'h-screen' (100vh). When custom dimensions outside the scale are necessary, Tailwind supports arbitrary value syntax like 'w-[317px]' or 'top-[15px]'.",
            sentence_count: 4,
            word_count: 82,
            flesch_kincaid_grade: 9.2,
            target_dwell_ms: 22000,
            speed_check: {
              question: "In Tailwind CSS, what computed pixel value does the utility class 'p-6' produce by default?",
              options: ["6px", "12px", "24px", "36px"],
              correct_option_index: 2,
              explanation: "6 * 4px = 24px (1.5rem).",
            },
          },
          {
            id: "css-tw-4",
            chunk_index: 3,
            title: "Responsive Breakpoints, Pseudo-Classes & Dark Mode",
            content:
              "Tailwind implements a mobile-first responsive architecture using breakpoint prefixes: 'sm:' (640px), 'md:' (768px), 'lg:' (1024px), and 'xl:' (1280px). Unprefixed utilities like 'text-sm' apply to mobile screens, while 'md:text-lg' triggers exclusively on tablets and desktops. Interactive pseudo-classes seamlessly compose with state modifiers like 'hover:bg-indigo-500', 'focus:ring-2', and 'disabled:opacity-50'. Furthermore, dark mode can be activated via media query or toggled manually via the 'dark:' prefix (such as 'bg-white dark:bg-slate-900').",
            sentence_count: 4,
            word_count: 77,
            flesch_kincaid_grade: 9.5,
            target_dwell_ms: 21000,
            speed_check: {
              question: "What does mobile-first mean when using Tailwind's responsive prefixes like 'md:'?",
              options: [
                "Unprefixed classes apply to mobile devices, and prefixed classes (e.g. 'md:') apply from that screen width upward.",
                "Classes prefixed with 'md:' apply only on mobile devices.",
                "Desktop styles must be written first before mobile breakpoints take effect.",
                "The browser requires a mobile user-agent header to parse the CSS.",
              ],
              correct_option_index: 0,
              explanation: "Tailwind uses min-width media queries; unprefixed classes target the smallest screens first.",
            },
          },
          {
            id: "css-tw-5",
            chunk_index: 4,
            title: "Flexbox and CSS Grid in Tailwind",
            content:
              "Constructing complex layouts in Tailwind requires zero custom stylesheet rules. Applying 'flex' converts an element into a flex container, paired with 'flex-col' or 'flex-row' for directional orientation, 'justify-between' for main-axis spacing, and 'items-center' for cross-axis alignment. For multi-column grids, 'grid' combined with 'grid-cols-1 md:grid-cols-3' and 'gap-6' produces a responsive 3-column layout that gracefully collapses to a single column on mobile devices without writing a single media query.",
            sentence_count: 3,
            word_count: 73,
            flesch_kincaid_grade: 9.8,
            target_dwell_ms: 20000,
            speed_check: {
              question: "How do you define a grid that displays 1 column on mobile and 3 columns on medium screens?",
              options: [
                "grid grid-cols-3 mobile:grid-cols-1",
                "grid grid-cols-1 md:grid-cols-3",
                "display-grid cols-1 to-3",
                "flex flex-wrap md:flex-3",
              ],
              correct_option_index: 1,
              explanation: "'grid grid-cols-1 md:grid-cols-3' defines mobile 1-column by default, scaling to 3 columns at md.",
            },
          },
          {
            id: "css-tw-6",
            chunk_index: 5,
            title: "Typography, Color Palettes and Font Stacks",
            content:
              "Tailwind features a professionally curated color palette spanning 22 shades with numeric weight scales from 50 (lightest tint) to 950 (deepest dark shade). Typography sizing ranges smoothly from 'text-xs' (12px) through 'text-6xl' (60px), with companion utilities for letter-spacing ('tracking-tight', 'tracking-widest') and line-height ('leading-none', 'leading-relaxed'). Color opacity can be adjusted on the fly by appending a slash, such as 'bg-indigo-600/20' to produce a 20% transparent tinted overlay.",
            sentence_count: 3,
            word_count: 73,
            flesch_kincaid_grade: 9.4,
            target_dwell_ms: 20000,
            speed_check: {
              question: "What does the utility class 'bg-indigo-600/50' achieve?",
              options: [
                "Sets background color to 50% lighter indigo.",
                "Sets background color to indigo-600 with 50% alpha opacity.",
                "Applies a 50px border around an indigo box.",
                "Blurs the background by 50 pixels.",
              ],
              correct_option_index: 1,
              explanation: "The '/50' modifier controls CSS color opacity via alpha channel transparency.",
            },
          },
          {
            id: "css-tw-7",
            chunk_index: 6,
            title: "Borders, Shadows, Blurs & Visual Effects",
            content:
              "Visual depth is engineered through layered border and elevation utilities. Border radiuses scale from 'rounded-sm' to 'rounded-3xl' and 'rounded-full' for avatars. Elevation shadows ('shadow-sm' to 'shadow-2xl') use realistic multi-layer drop shadows that create authentic depth. Backdrop filters like 'backdrop-blur-md' and 'bg-black/60' enable modern frosted-glass modal interfaces. Transitions and transforms are applied via 'transition-all duration-300 hover:scale-105', creating smooth GPU-accelerated interactive feedback.",
            sentence_count: 4,
            word_count: 67,
            flesch_kincaid_grade: 9.7,
            target_dwell_ms: 19000,
            speed_check: {
              question: "Which combination produces a frosted-glass translucent modal overlay in Tailwind?",
              options: [
                "filter-glass shadow-none",
                "bg-black/80 backdrop-blur-md",
                "opacity-50 display-glass",
                "blur-background border-none",
              ],
              correct_option_index: 1,
              explanation: "'bg-black/80 backdrop-blur-md' creates a translucent dark surface with underlying Gaussian blur.",
            },
          },
          {
            id: "css-tw-8",
            chunk_index: 7,
            title: "Arbitrary Values, The @apply Directive & Best Practices",
            content:
              "When an exact specification from a Figma mock cannot be satisfied by Tailwind's default design tokens, you can write arbitrary values inside square brackets like 'top-[117px]' or 'bg-[#1da1f2]'. In enterprise codebases, when an identical combination of classes repeats across hundreds of buttons, teams either extract reusable React components (the recommended pattern) or use the '@apply' directive in CSS files ('@apply px-4 py-2 bg-indigo-600 text-white rounded-xl;'). Extracting React components maintains cleaner separation and TypeScript prop validation.",
            sentence_count: 4,
            word_count: 81,
            flesch_kincaid_grade: 10.1,
            target_dwell_ms: 22000,
            speed_check: {
              question: "What is the industry-standard best practice when utility classes repeat frequently across a React application?",
              options: [
                "Copy and paste the classes manually into every file.",
                "Extract the markup and classes into a reusable React component with TypeScript props.",
                "Switch back to traditional global CSS stylesheets.",
                "Disable the Tailwind JIT compiler.",
              ],
              correct_option_index: 1,
              explanation: "Component extraction in React is the canonical way to achieve DRY UI code in utility-first frameworks.",
            },
          },
        ],
      },
    ],
  },

  // =========================================================================
  // TRACK 2: JAVASCRIPT MASTERY (W3Schools Comprehensive Deep Masterclass)
  // =========================================================================
  {
    id: "javascript",
    name: "JavaScript Engineering (W3Schools Deep Masterclass)",
    category: "frontend",
    description: "Deep dive through execution context, closures, event loop concurrency, and modern async architectures (~35 mins).",
    topics: [
      {
        id: "js-fundamentals",
        slug: "js-variables-datatypes",
        title: "1. JS Syntax, Variables & Execution Context",
        shortDescription: "let, const, var, primitive vs reference types, TDZ, and type coercion.",
        estimatedMinutes: 20,
        chunks: [
          {
            id: "js-fun-1",
            chunk_index: 0,
            title: "Variable Declarations: let, const, and var",
            content:
              "Modern JavaScript provides three keywords for declaring variables: 'var', 'let', and 'const'. Legacy 'var' is function-scoped and hoisted to the top of its context with an initial value of undefined, frequently creating silent bugs. In contrast, ES6 introduced 'let' and 'const', which are strictly block-scoped and live inside the Temporal Dead Zone (TDZ) until evaluated. 'const' declares an immutable binding: while the variable identifier cannot be reassigned, mutable values such as objects or arrays assigned to a const can still have their internal properties modified.",
            sentence_count: 4,
            word_count: 88,
            flesch_kincaid_grade: 9.8,
            target_dwell_ms: 24000,
            speed_check: {
              question: "What occurs if you reference a 'let' variable before its declaration line?",
              options: [
                "It returns undefined due to variable hoisting.",
                "It throws a ReferenceError because the variable is in the Temporal Dead Zone (TDZ).",
                "It defaults automatically to null.",
                "It converts into a global window property.",
              ],
              correct_option_index: 1,
              explanation: "'let' and 'const' are hoisted but remain uninitialized in the TDZ until their declaration executes.",
            },
          },
          {
            id: "js-fun-2",
            chunk_index: 1,
            title: "Primitive Data Types vs Reference Types",
            content:
              "JavaScript features seven primitive types: String, Number, BigInt, Boolean, Undefined, Null, and Symbol. Primitive values are immutable and compared by value directly on the call stack. Conversely, Objects (including Arrays and Functions) are reference types allocated on the memory heap. When you assign an object to a new variable, JavaScript copies the memory reference pointer rather than cloning the data. Consequently, mutating a property on the new variable immediately modifies the original object.",
            sentence_count: 5,
            word_count: 77,
            flesch_kincaid_grade: 9.0,
            target_dwell_ms: 21000,
            speed_check: {
              question: "Why does `[1, 2] === [1, 2]` evaluate to false in JavaScript?",
              options: [
                "Array elements are not strictly comparable with triple equals.",
                "Arrays are reference types stored in different memory addresses, so their pointers are not identical.",
                "The JavaScript engine cannot parse brackets inside equality checks.",
                "One array is stored on the stack while the other is on the heap.",
              ],
              correct_option_index: 1,
              explanation: "Triple equals compares object references; two separate array literals have different memory addresses.",
            },
          },
          {
            id: "js-fun-3",
            chunk_index: 2,
            title: "Strict Equality vs Type Coercion",
            content:
              "JavaScript supports both loose equality ('==') and strict equality ('==='). Loose equality triggers implicit type coercion, converting operands to matching types before evaluation, which produces counter-intuitive results like '0 == false' or '[] == 0'. Strict equality compares both value and type without coercion, ensuring predictable code execution. Modern JavaScript also introduces the Nullish Coalescing operator ('??'), which only falls back when a value is null or undefined, unlike the logical OR operator ('||') which also triggers on falsy values like 0, empty string, or false.",
            sentence_count: 4,
            word_count: 88,
            flesch_kincaid_grade: 9.7,
            target_dwell_ms: 24000,
            speed_check: {
              question: "What is the result of `0 || 'fallback'` versus `0 ?? 'fallback'`?",
              options: [
                "Both return 'fallback'.",
                "Both return 0.",
                "`0 || 'fallback'` returns 'fallback', while `0 ?? 'fallback'` returns 0.",
                "`0 || 'fallback'` returns 0, while `0 ?? 'fallback'` returns 'fallback'.",
              ],
              correct_option_index: 2,
              explanation: "'||' triggers on any falsy value (including 0), while '??' only triggers on null and undefined.",
            },
          },
        ],
      },
      {
        id: "js-functions-closures",
        slug: "js-functions-scope-closures",
        title: "2. Functions, Scope & Closures",
        shortDescription: "Arrow functions, execution context, lexical scope, and state preservation with closures.",
        estimatedMinutes: 22,
        chunks: [
          {
            id: "js-fc-1",
            chunk_index: 0,
            title: "Function Declarations, Expressions, and Arrow Functions",
            content:
              "A function declaration ('function foo() {}') is hoisted entirely to the top of its scope, permitting invocations before its definition in the source file. In contrast, arrow functions ('const foo = () => {}') do not have their own 'this', 'arguments', or 'super' bindings. Instead, arrow functions lexically bind 'this' from their enclosing lexical context, making them ideal for event callbacks and functional iteration where preserving outer instance references is critical.",
            sentence_count: 4,
            word_count: 76,
            flesch_kincaid_grade: 10.1,
            target_dwell_ms: 21000,
            speed_check: {
              question: "How does the 'this' keyword behave inside an arrow function?",
              options: [
                "It dynamically binds to whatever object invokes the function.",
                "It defaults to the global window object in strict mode.",
                "It lexically inherits 'this' from the enclosing execution context where it was defined.",
                "It creates a new isolated instance object.",
              ],
              correct_option_index: 2,
              explanation: "Arrow functions do not bind their own 'this'; they capture 'this' lexically from surrounding code.",
            },
          },
          {
            id: "js-fc-2",
            chunk_index: 1,
            title: "Closures & Persistent Lexical Scope",
            content:
              "A closure is the combination of a function bundled together with references to its surrounding lexical state. When an inner function is returned from an outer function, the inner function retains access to the outer function's local variables even after the outer function has finished executing and popped off the call stack. This lexical preservation mechanism powers key JavaScript design patterns, including private instance variables, factory functions, event listener state management, and memoization caches.",
            sentence_count: 4,
            word_count: 81,
            flesch_kincaid_grade: 10.6,
            target_dwell_ms: 22000,
            speed_check: {
              question: "Why do variables inside an outer function remain in memory when accessed by a returned inner function?",
              options: [
                "The garbage collector marks all functions as global variables.",
                "The returned inner function maintains a live reference to the outer lexical environment, preventing garbage collection.",
                "JavaScript converts all closure variables into browser localStorage.",
                "The variables are transferred to Web Worker memory threads.",
              ],
              correct_option_index: 1,
              explanation: "Closures maintain active references to outer lexical scopes, preventing the engine from garbage collecting them.",
            },
          },
        ],
      },
      {
        id: "js-async-event-loop",
        slug: "js-async-event-loop",
        title: "3. Asynchronous JavaScript & The Event Loop",
        shortDescription: "Call stack, Web APIs, Macrotasks vs Microtasks, Promises, and async/await.",
        estimatedMinutes: 25,
        chunks: [
          {
            id: "js-ael-1",
            chunk_index: 0,
            title: "Single-Threaded Execution & The Call Stack",
            content:
              "JavaScript is a single-threaded language, meaning it possesses a single Call Stack and can execute only one instruction at a time. Synchronous operations run sequentially: when a function is called, a frame is pushed onto the stack, and when it returns, it pops off. Long-running synchronous calculations block the stack, freezing user interface responsiveness and rendering the browser unresponsive. To perform non-blocking I/O operations such as network requests or timers, JavaScript offloads tasks to browser Web APIs.",
            sentence_count: 4,
            word_count: 81,
            flesch_kincaid_grade: 9.8,
            target_dwell_ms: 22000,
            speed_check: {
              question: "What happens when a CPU-intensive synchronous loop runs on the JavaScript call stack?",
              options: [
                "The browser spawns a new OS background thread automatically.",
                "The call stack is blocked, freezing UI rendering and user interactions until the loop completes.",
                "The loop is automatically pushed into the microtask queue.",
                "The engine throws an asynchronous timeout exception.",
              ],
              correct_option_index: 1,
              explanation: "Because JavaScript has a single call stack, synchronous blocking code halts all rendering and event processing.",
            },
          },
          {
            id: "js-ael-2",
            chunk_index: 1,
            title: "Microtasks vs Macrotasks (Task Queues)",
            content:
              "When an asynchronous Web API task completes, its callback is placed into one of two queues: the Microtask Queue or the Macrotask Queue. The Microtask Queue handles Promise callbacks ('.then', '.catch', '.finally'), 'queueMicrotask', and MutationObserver events. The Macrotask Queue handles 'setTimeout', 'setInterval', and I/O callbacks. Crucially, the Event Loop drains the entire Microtask Queue completely before picking up the next single Macrotask, meaning Promise callbacks execute before any pending setTimeout callback.",
            sentence_count: 4,
            word_count: 79,
            flesch_kincaid_grade: 10.2,
            target_dwell_ms: 22000,
            speed_check: {
              question: "In what order do `console.log(1)`, `setTimeout(() => console.log(2), 0)`, and `Promise.resolve().then(() => console.log(3))` execute?",
              options: ["1, 2, 3", "1, 3, 2", "3, 1, 2", "2, 1, 3"],
              correct_option_index: 1,
              explanation: "Synchronous code (1) runs first, then the microtask queue (3), and lastly the macrotask queue (2).",
            },
          },
          {
            id: "js-ael-3",
            chunk_index: 2,
            title: "Async / Await and Error Handling",
            content:
              "The 'async' and 'await' keywords introduced in ES2017 provide syntactic sugar over Promises, enabling asynchronous code to be written with synchronous readability. Marking a function with 'async' guarantees it returns a Promise resolving with the return value. Inside an async function, the 'await' keyword pauses function execution until the awaited Promise settles, non-blockingly yielding the thread back to the event loop. Error handling is performed natively using standard 'try...catch...finally' blocks, catching both synchronous and asynchronous rejections cleanly.",
            sentence_count: 4,
            word_count: 83,
            flesch_kincaid_grade: 10.4,
            target_dwell_ms: 23000,
            speed_check: {
              question: "What does the 'await' keyword do when evaluating a pending Promise?",
              options: [
                "It blocks the operating system thread until the network response arrives.",
                "It suspends the async function's execution and yields control to the event loop until the promise settles.",
                "It converts the promise into a synchronous XMLHttpRequest.",
                "It cancels all pending tasks in the macrotask queue.",
              ],
              correct_option_index: 1,
              explanation: "'await' non-blockingly pauses only the enclosing async function, letting other event loop tasks execute.",
            },
          },
        ],
      },
      {
        id: "js-dom-events",
        slug: "js-dom-event-handling",
        title: "4. DOM Manipulation & Event Handling",
        shortDescription: "querySelector, classList, Event Bubbling vs Capturing, and Event Delegation.",
        estimatedMinutes: 20,
        chunks: [
          {
            id: "js-dom-1",
            chunk_index: 0,
            title: "Selecting and Manipulating DOM Elements",
            content:
              "The Document Object Model (DOM) represents the HTML document as an interconnected tree of nodes that JavaScript can inspect and mutate. Modern scripts select nodes using 'document.querySelector()' for single matches or 'document.querySelectorAll()' for static NodeLists. To modify appearances cleanly, developers avoid setting inline style strings and instead manipulate CSS classes using the 'element.classList' API with methods like 'add()', 'remove()', and 'toggle()'. Creating and appending nodes via 'document.createElement()' and 'appendChild()' modifies the live tree, triggering reflow and repaint passes.",
            sentence_count: 4,
            word_count: 85,
            flesch_kincaid_grade: 10.0,
            target_dwell_ms: 23000,
            speed_check: {
              question: "Why is 'element.classList.toggle()' preferred over setting 'element.style' directly?",
              options: [
                "It keeps styles organized in external CSS rules and prevents CSS specificity bugs.",
                "It renders faster by bypassing the GPU.",
                "It automatically encrypts class names in production.",
                "It prevents event bubbling on the element.",
              ],
              correct_option_index: 0,
              explanation: "classList maintains clean separation of concerns and avoids high-specificity inline style clutter.",
            },
          },
          {
            id: "js-dom-2",
            chunk_index: 1,
            title: "Event Propagation & Event Delegation",
            content:
              "When an event occurs on a DOM node, it travels through three distinct propagation phases: the Capturing Phase (descending from the window to the target), the Target Phase, and the Bubbling Phase (ascending from target back to window). By default, 'addEventListener' listens during the bubbling phase. Event Delegation leverages bubbling by attaching a single event listener to a common parent element rather than attaching hundreds of individual listeners to children. The parent inspects 'event.target' to identify which child triggered the action, drastically reducing memory consumption.",
            sentence_count: 4,
            word_count: 87,
            flesch_kincaid_grade: 10.8,
            target_dwell_ms: 24000,
            speed_check: {
              question: "What architectural benefit does Event Delegation provide in high-density lists?",
              options: [
                "It forces all click events to run synchronously.",
                "It attaches one listener to a parent container instead of individual listeners on every child, saving memory.",
                "It prevents users from inspecting elements in developer tools.",
                "It converts standard DOM events into WebSockets.",
              ],
              correct_option_index: 1,
              explanation: "Event delegation exploits event bubbling so one parent listener handles actions for all present and future children.",
            },
          },
        ],
      },
    ],
  },

  // =========================================================================
  // TRACK 3: REACT MASTERY (W3Schools Comprehensive Deep Masterclass)
  // =========================================================================
  {
    id: "react",
    name: "React 19 & Architecture (W3Schools Deep Masterclass)",
    category: "frontend",
    description: "Deep dive from Virtual DOM and immutable state to useEffect, advanced hooks, and Fiber reconciliation (~35 mins).",
    topics: [
      {
        id: "react-fundamentals",
        slug: "react-jsx-components",
        title: "1. React Fundamentals & JSX Architecture",
        shortDescription: "Virtual DOM, JSX rules, expressions, fragments, and root rendering.",
        estimatedMinutes: 20,
        chunks: [
          {
            id: "react-fun-1",
            chunk_index: 0,
            title: "What is React & The Virtual DOM",
            content:
              "React is a declarative, component-based JavaScript library for building interactive user interfaces. Direct manipulation of the browser DOM is computationally expensive because layout calculations and style recalculations trigger synchronous reflows. React solves this by maintaining an in-memory Virtual DOM tree representing the desired UI state. When state changes, React computes the difference (reconciliation diffing) between the previous and current Virtual DOM trees, batching and applying strictly the minimal necessary mutations to the real browser DOM.",
            sentence_count: 4,
            word_count: 81,
            flesch_kincaid_grade: 10.3,
            target_dwell_ms: 22000,
            speed_check: {
              question: "Why does React use an in-memory Virtual DOM instead of updating the browser DOM directly?",
              options: [
                "The browser DOM cannot render HTML5 canvas elements.",
                "Computing diffs in memory and batching minimal DOM updates avoids expensive layout reflows and repaints.",
                "The Virtual DOM is executed directly on the GPU.",
                "React cannot execute JavaScript on the main thread.",
              ],
              correct_option_index: 1,
              explanation: "Batching updates via the Virtual DOM minimizes costly real-browser layout recalculations.",
            },
          },
          {
            id: "react-fun-2",
            chunk_index: 1,
            title: "JSX Syntax Rules & React Fragments",
            content:
              "JSX is a syntax extension for JavaScript that looks similar to HTML but compiles to standard 'React.createElement()' function calls. Because JSX is JavaScript, it enforces key rules: components must return a single root element, attribute names use camelCase (like 'className' instead of 'class' and 'htmlFor' instead of 'for'), and all tags must be explicitly closed. When grouping adjacent elements without adding an extra div wrapper to the DOM tree, developers use React Fragments, written with the shorthand syntax '<> ... </>'.",
            sentence_count: 4,
            word_count: 85,
            flesch_kincaid_grade: 9.7,
            target_dwell_ms: 23000,
            speed_check: {
              question: "What is the primary purpose of a React Fragment (`<> ... </>`)?",
              options: [
                "It enables CSS Grid layouts on all child elements.",
                "It allows returning multiple adjacent elements from a component without injecting an extra node into the real DOM.",
                "It renders the component into a separate HTML document.",
                "It automatically memoizes all child props.",
              ],
              correct_option_index: 1,
              explanation: "Fragments satisfy the single-root JSX rule without creating unnecessary wrapper divs in the real DOM.",
            },
          },
        ],
      },
      {
        id: "react-components-props",
        slug: "react-components-props",
        title: "2. Components, Props & Composition",
        shortDescription: "Functional components, prop destructuring, children slots, and unidirectional data flow.",
        estimatedMinutes: 20,
        chunks: [
          {
            id: "react-cp-1",
            chunk_index: 0,
            title: "Functional Components and Unidirectional Data Flow",
            content:
              "React components are JavaScript functions that accept an arbitrary input object called 'props' and return JSX representing UI elements. React enforces unidirectional data flow, meaning data flows strictly downward from parent components to child components via props. Child components cannot mutate the props they receive: props are strictly read-only and immutable. If a child needs to communicate changes back to its parent, the parent passes a callback function as a prop, which the child invokes when an event occurs.",
            sentence_count: 4,
            word_count: 82,
            flesch_kincaid_grade: 9.9,
            target_dwell_ms: 23000,
            speed_check: {
              question: "Can a React child component directly modify the props it receives from its parent?",
              options: [
                "Yes, by modifying `this.props` directly.",
                "No, props are strictly read-only; the child must invoke a parent callback to request state changes.",
                "Yes, but only if the prop is an array or object.",
                "Yes, provided the child is wrapped in React.memo.",
              ],
              correct_option_index: 1,
              explanation: "Props are strictly immutable; state changes must be requested through parent callbacks.",
            },
          },
          {
            id: "react-cp-2",
            chunk_index: 1,
            title: "The children Prop & Container Composition",
            content:
              "React components can be composed flexibly using the special 'children' prop. Whatever JSX content is placed between a component's opening and closing tags is passed automatically to that component as 'props.children'. This compositional pattern allows developers to create generic layout wrappers such as Card containers, Dialog modals, and Navigation shells without the wrapper needing to know what specific content will be rendered inside it.",
            sentence_count: 3,
            word_count: 69,
            flesch_kincaid_grade: 9.8,
            target_dwell_ms: 20000,
            speed_check: {
              question: "How does a container component access JSX elements placed between its opening and closing tags?",
              options: [
                "Via `document.getElementById()`. ",
                "Through `props.children`.",
                "Using the `useSlots` hook.",
                "By querying the window context.",
              ],
              correct_option_index: 1,
              explanation: "Content nested between tags is automatically accessible through `props.children`.",
            },
          },
        ],
      },
      {
        id: "react-state-usestate",
        slug: "react-state-usestate",
        title: "3. State Management & The useState Hook",
        shortDescription: "Component memory, immutable updates, and updater functions.",
        estimatedMinutes: 22,
        chunks: [
          {
            id: "react-st-1",
            chunk_index: 0,
            title: "Component Memory and The useState Hook",
            content:
              "Standard local variables inside a function component disappear between render cycles because the function re-executes from scratch on each render. The 'useState' Hook grants components persistent memory across renders. Calling 'useState(initialValue)' returns an array with two elements: the current state value and a state updater function. When the updater function is called with a new value, React schedules a re-render of the component and updates the DOM to reflect the updated state.",
            sentence_count: 4,
            word_count: 76,
            flesch_kincaid_grade: 9.3,
            target_dwell_ms: 21000,
            speed_check: {
              question: "Why do regular variables fail to preserve values across component re-renders?",
              options: [
                "The browser clears all variables every 16 milliseconds.",
                "The functional component re-executes from top to bottom, re-initializing regular local variables.",
                "React moves regular variables into WebAssembly memory.",
                "Regular variables trigger infinite re-render loops.",
              ],
              correct_option_index: 1,
              explanation: "Components re-execute on every render, resetting local variables unless stored in useState or useRef.",
            },
          },
          {
            id: "react-st-2",
            chunk_index: 1,
            title: "Immutable State Updates & Functional Setters",
            content:
              "In React, state must always be treated as immutable: you must never directly mutate state variables like 'user.name = \"Alice\"' because React detects changes by checking object reference equality ('Object.is()'). If the reference pointer has not changed, React will skip re-rendering the component entirely. To update objects or arrays, always create new copies using the spread operator ('setUser({ ...user, name: \"Alice\" })'). When the next state depends on the previous state, pass an updater function ('setCount(prev => prev + 1)') to avoid stale closure race conditions.",
            sentence_count: 4,
            word_count: 88,
            flesch_kincaid_grade: 10.2,
            target_dwell_ms: 24000,
            speed_check: {
              question: "Why will `stateArray.push(newItem); setArray(stateArray);` fail to trigger a re-render?",
              options: [
                "The push method is disabled in React strict mode.",
                "The array reference pointer remains identical, so React's shallow comparison determines nothing changed.",
                "React only supports primitive state values.",
                "Arrays must be updated using setTimeout.",
              ],
              correct_option_index: 1,
              explanation: "React relies on reference equality; mutating an existing array does not change its reference pointer.",
            },
          },
        ],
      },
      {
        id: "react-useeffect-lifecycle",
        slug: "react-useeffect-lifecycle",
        title: "4. Side Effects & The useEffect Hook",
        shortDescription: "Component lifecycles, dependency arrays, cleanup functions, and preventing memory leaks.",
        estimatedMinutes: 25,
        chunks: [
          {
            id: "react-ue-1",
            chunk_index: 0,
            title: "Synchronizing with External Systems via useEffect",
            content:
              "Side effects are operations that reach outside the pure rendering flow of React, such as fetching data over HTTP, subscribing to WebSockets, setting browser timers, or directly touching the DOM. The 'useEffect' Hook allows components to execute side effects cleanly after React has completed rendering and painted the screen. Effects receive a callback function and an optional dependency array that dictates when the effect should re-run.",
            sentence_count: 3,
            word_count: 70,
            flesch_kincaid_grade: 10.0,
            target_dwell_ms: 20000,
            speed_check: {
              question: "When does the callback inside 'useEffect' execute relative to screen painting?",
              options: [
                "Before React begins rendering the Virtual DOM.",
                "Synchronously during the initial render before HTML is created.",
                "Asynchronously after React has rendered and the browser has painted the screen.",
                "Only when the browser window loses focus.",
              ],
              correct_option_index: 2,
              explanation: "useEffect runs asynchronously after paint so it does not block the user's visual interface.",
            },
          },
          {
            id: "react-ue-2",
            chunk_index: 1,
            title: "The Dependency Array and Cleanup Functions",
            content:
              "The dependency array controls effect scheduling: passing no array runs the effect after every single render, an empty array ('[]') runs the effect exactly once after the initial mount, and passing dependencies ('[userId]') runs the effect only when specified values change. If an effect returns a cleanup function, React executes that cleanup before re-running the effect and when the component unmounts. Returning cleanups is mandatory when subscribing to event listeners or timers to prevent severe memory leaks.",
            sentence_count: 3,
            word_count: 81,
            flesch_kincaid_grade: 10.2,
            target_dwell_ms: 22000,
            speed_check: {
              question: "What happens if you omit the dependency array in `useEffect(() => { ... })`?",
              options: [
                "The effect runs only once when the component mounts.",
                "The effect runs after every single render of the component.",
                "React throws a compile-time syntax error.",
                "The effect is converted into a microtask.",
              ],
              correct_option_index: 1,
              explanation: "Omitting the dependency array causes the effect to run on mount and after every subsequent render.",
            },
          },
        ],
      },
      {
        id: "react-advanced-hooks",
        slug: "react-advanced-hooks",
        title: "5. Advanced Hooks: useRef, useMemo, useCallback & useContext",
        shortDescription: "Non-rendering mutable refs, computational memoization, and avoiding prop drilling.",
        estimatedMinutes: 28,
        chunks: [
          {
            id: "react-ah-1",
            chunk_index: 0,
            title: "useRef: Mutable State Without Re-rendering",
            content:
              "The 'useRef' Hook returns a mutable object with a '.current' property that persists throughout the full lifecycle of a component. Unlike useState, updating 'ref.current = newValue' does not trigger a component re-render. This makes useRef ideal for storing non-visual values such as timer IDs, previous state snapshots, or WebSocket connections. Additionally, attaching a ref to a JSX element ('<input ref={inputRef} />') gives direct imperative access to the underlying real DOM node for operations like programmatic focus management.",
            sentence_count: 4,
            word_count: 81,
            flesch_kincaid_grade: 10.1,
            target_dwell_ms: 22000,
            speed_check: {
              question: "What is the critical behavioral difference between 'useState' and 'useRef'?",
              options: [
                "useRef cannot store objects or arrays.",
                "Modifying 'useState' schedules a re-render, whereas modifying 'useRef.current' mutates silently without re-rendering.",
                "useRef is only available in class components.",
                "useState values are reset to default on every render.",
              ],
              correct_option_index: 1,
              explanation: "useRef holds a mutable reference across renders without scheduling UI re-renders.",
            },
          },
          {
            id: "react-ah-2",
            chunk_index: 1,
            title: "Performance Optimization: useMemo and useCallback",
            content:
              "When a component re-renders, all functions declared inside it are re-instantiated with new memory addresses, and all computations re-execute. The 'useMemo' Hook memoizes the calculated result of an expensive function, recomputing it only when its declared dependencies change. Similarly, 'useCallback' memoizes a function definition itself, preserving a stable reference pointer across renders. When combined with 'React.memo', useCallback prevents unnecessary re-renders of memoized child components that rely on callback props.",
            sentence_count: 4,
            word_count: 76,
            flesch_kincaid_grade: 10.5,
            target_dwell_ms: 22000,
            speed_check: {
              question: "What does 'useCallback(fn, deps)' return compared to 'useMemo(fn, deps)'?",
              options: [
                "useCallback returns a memoized function, whereas useMemo returns the memoized result of calling the function.",
                "useCallback executes asynchronously, while useMemo executes synchronously.",
                "useCallback returns a DOM node reference.",
                "Both hooks return identical values.",
              ],
              correct_option_index: 0,
              explanation: "useCallback caches the function definition itself; useMemo caches the return value of invoking the function.",
            },
          },
          {
            id: "react-ah-3",
            chunk_index: 2,
            title: "Eliminating Prop Drilling with useContext",
            content:
              "Passing props through intermediate components that do not need them simply to reach deeply nested children is known as 'prop drilling'. React's Context API solves this by allowing parent components to broadcast data to their entire sub-tree. Creating a context with 'React.createContext()' yields a Provider component ('<ThemeContext.Provider value={theme}>'). Any descendant component, regardless of depth, can subscribe to the value using the 'useContext(ThemeContext)' Hook, automatically re-rendering whenever the provided context value updates.",
            sentence_count: 4,
            word_count: 78,
            flesch_kincaid_grade: 10.3,
            target_dwell_ms: 22000,
            speed_check: {
              question: "What problem does the React Context API solve in deep component hierarchies?",
              options: [
                "It enables CSS Grid layouts across disconnected DOM trees.",
                "It eliminates 'prop drilling' by allowing components to consume shared values without manual prop passing.",
                "It stores application data permanently in browser IndexedDB.",
                "It enables multi-threading in React server components.",
              ],
              correct_option_index: 1,
              explanation: "Context broadcasts values directly to any subscriber in the subtree without prop drilling.",
            },
          },
        ],
      },
    ],
  },
];
