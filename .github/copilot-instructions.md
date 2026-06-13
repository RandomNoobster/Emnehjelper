# Emnehjelper - Chrome Extension for NTNU Course Statistics

## Project Overview
Chrome/Edge extension that enhances NTNU's course pages and study plans by displaying aggregated statistics (grades, difficulty, workload, pass rates) from emnr.no and karakterweb.no. Written in vanilla JavaScript with Manifest V3.

## Architecture

### Content Scripts Structure
Two main injection contexts, each with dedicated JS/CSS:

1. **Course Pages** (`course-page.js`, `course-page.css`)
   - Matches: `https://www.ntnu.{no|edu}/studies/courses/*`
   - Creates draggable popup with statistics, external links, and visual sliders
   - Runs at `document_end`

2. **Study Plan Tables** (`course-list.js`, `course-list.css`)
   - Matches: `https://www.ntnu.{no|edu}/studies/*` (excluding individual course pages)
   - Uses `MutationObserver` to detect dynamically added course rows
   - Injects colored tags (difficulty, workload, grade) into table cells
   - Runs at `document_idle`

### Data Flow
```
Content Script → service-worker.js → [emnr API + Karakterweb cache worker] → Cache (72h TTL) → utils.js:mergeData()
```

**Key Pattern**: `service-worker.js` handles all API calls with:
- 72-hour cache in `chrome.storage.local` (key: `karakter-data-{emnekode}`)
- **Caches partial success** - if one API fails, the other's data is still cached
- Deduplication via `callsToEmnekode` object to prevent duplicate requests
- Fetch retry logic (1 retry with 500ms delay)
- `Promise.allSettled()` allows partial success - if one API fails, the other's data is still used
- `normalizeKarakterwebResponse()` adapts Karakterweb v1 API JSON to the legacy shape expected by `mergeData()`

**Data merging** (`utils.js:mergeData()`): Weighted average combining emnr and karakterweb review counts. Note rescaling: karakterweb answers (0-4 scale) → divide by 2 → match emnr (0-2 scale).

## Critical Patterns

### Course Code Extraction
Use regex `URL_REGEX = /.*\/([A-Za-zÆØÅæøå]{2,5}\d{3,4})/` for Norwegian letters support. Also extract from table row class: `row.classList[1]`.

### Tag Color System
Five-level color scheme in `course-list.js`:
```javascript
TAG_COLORS = { GREEN, LIME, YELLOW, ORANGE, RED, GRAY }
```
Thresholds in `DESCRIPTIONS` object map numeric values to labels. Use `getColorClass(value, type)` and `getDescription(value, type)` helpers.

### Graded vs Pass/Fail Courses
`is_graded` flag determines display logic:
- `is_graded: true` → show average grade (A-F scale)
- `is_graded: false` → show pass rate (0-100%)

Detection logic in `utils.js:mergeData()`: if `average_grade_letter == null || pass_rate <= 0`.

### Dynamic Content Handling
Study plan tables load asynchronously. Use `MutationObserver` pattern in `course-list.js`:
```javascript
observer.observe(document, { childList: true, subtree: true });
```
Check `cell.classList.contains("emnehjelper-info")` to avoid re-processing rows.

## File Organization
- `emnehjelper/` - Extension source code
- `media/` - Source graphics (.pdn files for Paint.NET)
- `emnehjelper/media/` - Extension assets (icons, logos)
- `emnehjelper/styles/` - One CSS file per content script

## Styling Conventions
- Primary brand color: `#090089` (from `style-guide.md`)
- Fonts: BahnSchrift for titles, Poppins/Federo for UI
- Loading animation: three bouncing dots (`.loading .dot` in CSS)
- Popup uses `position: fixed` with draggable functionality

## Development Workflow
- No build step - direct modification of files in `emnehjelper/`
- Load unpacked extension from `emnehjelper/` directory in Chrome/Edge developer mode
- Test on NTNU course pages (e.g., `https://www.ntnu.edu/studies/courses/TDT4100`)
- Test on study plans (e.g., MTDT program page linked in `about.html`)

### Release Process
- Version bumping: Increment `manifest.json` version after multiple commits with changes
- Create git tags for each release (e.g., `v1.2.7`)
- No automated testing framework yet (TODO)

### Error Handling Pattern
- `service-worker.js`: Checks HTTP status codes before parsing JSON; retries failed requests once
- `utils.js:mergeData()`: Returns `null` only if BOTH APIs fail; handles partial data gracefully by using defaults for missing API
- Content scripts: Check for `null` from `mergeData()` and gracefully clean up (remove loading animations, skip rendering)
- **Partial data support**: If only one API fails, extension displays data from the working API with appropriate warnings
- **Visual error indicators**: 
  - Study plan tables: Warning emoji (⚠️) tag shown when API fails
  - Course page popup: Yellow warning banner at top explaining which API(s) failed
  - Both show tooltips/messages like "Data fra emnr kunne ikke hentes"

### Known TODOs
- Implement testing framework

## Language & Localization
All user-facing text in Norwegian (Bokmål):
- Variable names: English
- UI labels: Norwegian (e.g., "Arbeidsmengde", "Vanskelighetsgrad")
- Comments: English

## External Dependencies
- `https://api.emnr.no/course/{emnekode}/`
- `emnehjelper/config.js` → cached Karakterweb proxy URL (`KARAKTERWEB_CACHE_BASE`)
- `https://www.karakterweb.no/ntnu/{emnekode}` (link validation only)

Karakterweb grade/evaluation data is fetched via the Cloudflare Worker in `worker/`. Deploy instructions are in `worker/README.md`.

Requires `host_permissions` in `manifest.json`. No npm packages or bundlers used for the extension itself.

## Coding Standards

### Magic Numbers
- Define all thresholds and constants at the top of files or in `utils.js` (e.g., `WORKLOAD_LABELS`, `DIFFICULTY_LABELS`, `URL_REGEX`)
- Use enums/objects for related constants (e.g., `TAG_COLORS`, `DESCRIPTIONS`)

### Modularization
- Keep functions small and focused on a single responsibility
- Extract reusable logic into helper functions in `utils.js`
- Group related constants at the top of files (e.g., `ENDPOINTS`, `ColorScheme`, `TAG_COLORS`)
- Separate concerns: DOM creation, data fetching, and data processing should be in distinct functions

### Naming Conventions
- **Variables**: Use descriptive camelCase names that indicate purpose (e.g., `popupParent`, `reviewsSection`, `averageWorkload`)
- **Functions**: Use verb prefixes describing the action (e.g., `createStatCard()`, `fetchCourseData()`, `makePopupDraggable()`)
- **Constants**: Use UPPER_SNAKE_CASE for true constants (e.g., `URL_REGEX`, `WORKLOAD_LABELS`)
- **CSS classes**: Use lowercase with hyphens, prefixed with component context (e.g., `popup-header`, `stat-card`, `service-btn`)

### Function Design
- Prefer pure functions where possible (same input → same output, no side effects)
- Use factory functions for creating DOM elements (e.g., `createStatCard()`, `createServiceButton()`)
- Pass dependencies as parameters rather than relying on global scope
- Document complex functions with a brief comment explaining purpose

### Code Organization Within Files
```javascript
// 1. Constants and Enums at top
// 2. Utility/Helper functions
// 3. DOM creation functions
// 4. Event handlers and business logic
// 5. Main initialization (IIFE at bottom)
```

## Example Response from karakterweb API
```json
{
    "grades": {
        "Emnekode": "SPRÅK3501-1",
        "data": [
            {
                "Antall_kandidater_totalt": 101,
                "Antall_kandidater_menn": 68,
                "Antall_kandidater_kvinner": 33,
                "Karakterfordeling": {
                    "Bestått": {
                        "Alle": 101,
                        "Menn": 68,
                        "Kvinner": 33
                    },
                    "Ikke bestått": {
                        "Alle": 0,
                        "Menn": 0,
                        "Kvinner": 0
                    }
                },
                "Karakterskala": "G-H",
                "Semester": "Høst",
                "Årstall": "2012"
            },
            {
                "Antall_kandidater_totalt": 87,
                "Antall_kandidater_menn": 54,
                "Antall_kandidater_kvinner": 33,
                "Karakterfordeling": {
                    "Bestått": {
                        "Alle": 87,
                        "Menn": 54,
                        "Kvinner": 33
                    },
                    "Ikke bestått": {
                        "Alle": 0,
                        "Menn": 0,
                        "Kvinner": 0
                    }
                },
                "Karakterskala": "G-H",
                "Semester": "Høst",
                "Årstall": "2013"
            }
        ]
    },
    "evaluations": [
        {
            "questionId": 0,
            "question": "Hva er ditt generelle inntrykk av kurset?",
            "answers": [
                {
                    "answerId": 0,
                    "answer": "Svært dårlig",
                    "count": 0,
                    "active": false
                },
                {
                    "answerId": 1,
                    "answer": "Dårlig",
                    "count": 2,
                    "active": false
                },
                {
                    "answerId": 2,
                    "answer": "Nøytral",
                    "count": 0,
                    "active": false
                },
                {
                    "answerId": 3,
                    "answer": "Bra",
                    "count": 0,
                    "active": false
                },
                {
                    "answerId": 4,
                    "answer": "Svært bra",
                    "count": 0,
                    "active": false
                }
            ],
            "answersTotal": 2
        },
        {
            "questionId": 1,
            "question": "Hva synes du om emnets nivå?",
            "answers": [
                {
                    "answerId": 0,
                    "answer": "Svært lett",
                    "count": 0,
                    "active": false
                },
                {
                    "answerId": 1,
                    "answer": "Lett",
                    "count": 0,
                    "active": false
                },
                {
                    "answerId": 2,
                    "answer": "Passende",
                    "count": 0,
                    "active": false
                },
                {
                    "answerId": 3,
                    "answer": "Vanskelig",
                    "count": 0,
                    "active": false
                },
                {
                    "answerId": 4,
                    "answer": "Svært vanskelig",
                    "count": 0,
                    "active": false
                }
            ],
            "answersTotal": 0
        },
        {
            "questionId": 2,
            "question": "Hva synes du om arbeidsmengden sett i forhold til antall studiepoeng?",
            "answers": [
                {
                    "answerId": 0,
                    "answer": "Svært liten",
                    "count": 0,
                    "active": false
                },
                {
                    "answerId": 1,
                    "answer": "Liten",
                    "count": 0,
                    "active": false
                },
                {
                    "answerId": 2,
                    "answer": "Passe",
                    "count": 0,
                    "active": false
                },
                {
                    "answerId": 3,
                    "answer": "Stor",
                    "count": 0,
                    "active": false
                },
                {
                    "answerId": 4,
                    "answer": "Svært stor",
                    "count": 0,
                    "active": false
                }
            ],
            "answersTotal": 0
        }
    ]
}
```

## Example Response from emnr API
```json
{
    "course_code": "TEP4223",
    "institution": 194,
    "version": 1,
    "course_name_norwegian": "Livssyklusanalyse",
    "course_name_english": "Life Cycle Assessment",
    "study_level": 500.0,
    "semester": "HØST",
    "course_type": "",
    "is_thesis": false,
    "credit": 7.5,
    "language": "ENGELSK",
    "campus": [],
    "connected_studyprograms": [],
    "average_grade": 3.11665098777046,
    "pass_rate": 94.73684210526316,
    "review_count": 2,
    "average_review_score": 5.0,
    "average_difficulty": 1.0,
    "average_workload": 2.0,
    "advanced_sorting_score": -1.0,
    "average_grade_letter": "C"
}
```

## Maintaining These Instructions

> **Important**: When making significant changes to the project architecture, file structure, data flow, or adding new patterns, update this document to reflect those changes. This ensures Copilot and future contributors have accurate context.

Examples of changes that should trigger an update:
- Adding new content scripts or modifying match patterns
- Changing the caching strategy or API handling
- Introducing new UI components or interaction patterns
- Adding new external dependencies
- Modifying the build/release process
