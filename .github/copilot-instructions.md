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
Content Script → service-worker.js → [emnr API + karakterweb API] → Cache (24h TTL) → utils.js:mergeData()
```

**Key Pattern**: `service-worker.js` handles all API calls with:
- 72-hour cache in `chrome.storage.local` (key: `karakter-data-{emnekode}`)
- **Only caches complete data** - partial/failed responses are NOT cached, so failed APIs are retried on next visit
- Deduplication via `callsToEmnekode` object to prevent duplicate requests
- Fetch retry logic (1 retry with 500ms delay)
- `Promise.allSettled()` allows partial success - if one API fails, the other's data is still used

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
- `https://www.karakterweb.no/api/evals?institute=NTNU&courseCode={emnekode}`

Requires `host_permissions` in `manifest.json`. No npm packages or bundlers used.
