const localProducts = Array.isArray(window.MIBOY_PRODUCTS)
  ? window.MIBOY_PRODUCTS
  : [];

const form = document.getElementById("searchForm");
const input = document.getElementById("searchInput");
const results = document.getElementById("results");
const emptyState = document.getElementById("emptyState");
const resultsTitle = document.getElementById("resultsTitle");
const resultsInfo = document.getElementById("resultsInfo");
const submitButton = form ? form.querySelector('button[type="submit"]') : null;

let searchLoaderInterval = null;
let searchLoaderHideTimer = null;
let searchProgressPollTimer = null;
let activeSearchRequestId = "";
let searchProgressDisplayed = 3;
let searchProgressTarget = 3;
let searchProgressStep = 0;
let searchProgressMessage =
  "Rozpoznajemy produkt i sprawdzamy pamięć…";
let searchProgressStartedAt = 0;
let liveCompletionPollTimer = null;
let activeLiveCompletionJobId = "";
let progressiveLoaderMode = false;
let progressiveSearchGeneration = 0;

const SEARCH_PROGRESS_LABELS = [
  "Przeszukuję dla Ciebie Ceneo…",
  "Pokazuję wyniki Ceneo. Teraz sprawdzam Allegro…",
  "Pokazuję wyniki Allegro. Teraz sprawdzam Amazon.pl…",
  "Pokazuję wyniki Amazon.pl. Teraz sprawdzam AliExpress…",
  "Kończę filtrowanie i układam pełny ranking…",
  "Wszystkie dostępne wyniki są gotowe."
];


const PROGRESSIVE_SOURCE_ORDER = [
  "ceneo",
  "allegro",
  "amazon",
  "aliexpress"
];

const PROGRESSIVE_SOURCE_CONFIG = {
  ceneo: {
    name: "Ceneo",
    label: "Ceneo",
    icon: "🇵🇱",
    section: "polish",
    startProgress: 6,
    doneProgress: 24,
    startMessage:
      "Najpierw przeszukuję dla Ciebie Ceneo…",
    doneMessage:
      "Pokazuję wyniki Ceneo. Teraz przeszukuję dla Ciebie Allegro…",
    description:
      "Porównanie cen w polskich sklepach."
  },
  allegro: {
    name: "Allegro",
    label: "Allegro",
    icon: "🟠",
    section: "polish",
    startProgress: 28,
    doneProgress: 48,
    startMessage:
      "Teraz przeszukuję dla Ciebie Allegro…",
    doneMessage:
      "Pokazuję wyniki Allegro. Teraz przeszukuję dla Ciebie Amazon.pl…",
    description:
      "Konkretne oferty z polskiego marketplace."
  },
  amazon: {
    name: "Amazon",
    label: "Amazon.pl",
    icon: "📦",
    section: "polish",
    startProgress: 52,
    doneProgress: 70,
    startMessage:
      "Przygotowuję dla Ciebie wyszukiwanie Amazon.pl…",
    doneMessage:
      "Amazon.pl jest gotowy. Teraz przeszukuję dla Ciebie AliExpress…",
    description:
      "Zobacz aktualne wyniki i ceny bezpośrednio na Amazon.pl."
  },
  aliexpress: {
    name: "AliExpress",
    label: "AliExpress",
    icon: "🌏",
    section: "import",
    startProgress: 74,
    doneProgress: 94,
    startMessage:
      "Na końcu przeszukuję dla Ciebie AliExpress…",
    doneMessage:
      "AliExpress sprawdzone. Kończę ranking wszystkich ofert…",
    description:
      "Import pokazujemy dopiero po polskich sklepach."
  }
};

const SAVED_PRODUCTS_STORAGE_KEY =
  "miboySmartZakupySavedProductsV1";

const savedProducts =
  new Map();

const saveableProducts =
  new Map();

const savedComparisonSelection =
  new Set();

let savedProductsMessage =
  "";

const accessibilityFocusMemory =
  new WeakMap();

let activeAccessibilityLayer =
  null;

injectSmartZakupy3DStyles();
injectSearchEnhancementStyles();
injectBackToTopStyles();
injectSavedProductsStyles();
injectAccessibilityMobileStyles();
injectStage6NStyles();
injectStage6OStyles();
injectStage6PStyles();
injectStage6QStyles();
injectStage6RStyles();
injectStage6SStyles();
injectStage6VStyles();
injectStage6WStyles();
injectStage6XStyles();
injectStage6ZStyles();

const supplementaryInput =
  ensureSupplementarySearchField();

ensureSearchLoader();
ensureBackToTopButton();
loadSavedProductsFromStorage();
ensureSavedProductsUi();
ensureAccessibilityUi();
enhanceExistingAccessibility();

bindComparisonModalControls();
bindFinalDecisionModalControls();

if (input) {
  input.addEventListener(
    "input",
    () => {
      renderQuickPriorities();
    }
  );
}

const panelNote = document.querySelector(".panel-note");
if (panelNote) {
  panelNote.textContent =
    "Ceneo, Allegro, Amazon.pl i AliExpress są sprawdzane etapami. " +
    "Wyniki polskich sklepów pojawiają się najpierw, a kolejne źródła dołączają automatycznie.";
}

function injectSmartZakupy3DStyles() {
  const style = document.createElement("style");
  style.textContent = `
    .product-visual.real-product-visual {
      padding: 18px;
      background:
        radial-gradient(circle at 75% 25%, rgba(99,102,241,.13), transparent 32%),
        linear-gradient(145deg, #f8f9ff, #eef2ff);
    }

    .real-product-image {
      width: 100%;
      height: 170px;
      object-fit: contain;
      border-radius: 14px;
      background: #fff;
    }

    .search-status-line {
      display: inline-flex;
      align-items: center;
      gap: 8px;
    }

    .search-status-dot {
      width: 9px;
      height: 9px;
      border-radius: 50%;
      background: #7c3aed;
      box-shadow: 0 0 0 6px rgba(124,58,237,.10);
      animation: miboyPulse 1.1s ease-in-out infinite;
    }

    .supplementary-search {
      width: 100%;
      display: grid;
      grid-template-columns:
        minmax(180px, .8fr)
        minmax(260px, 1.6fr);
      gap: 14px;
      align-items: center;
      margin-top: 12px;
      padding: 13px 14px;
      border: 1px solid rgba(129,140,248,.24);
      border-radius: 16px;
      background: rgba(255,255,255,.07);
      box-sizing: border-box;
    }

    .supplementary-search-copy {
      min-width: 0;
    }

    .supplementary-search-label {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 7px;
      color: inherit;
      font-size: .82rem;
      font-weight: 900;
      line-height: 1.3;
      cursor: pointer;
    }

    .supplementary-search-optional {
      display: inline-flex;
      align-items: center;
      min-height: 23px;
      padding: 0 7px;
      border-radius: 999px;
      background: rgba(99,102,241,.15);
      color: #a5b4fc;
      font-size: .65rem;
      font-weight: 950;
      text-transform: uppercase;
      letter-spacing: .04em;
    }

    .supplementary-search-help {
      margin: 5px 0 0;
      color: #aab4c5;
      font-size: .72rem;
      line-height: 1.45;
    }

    .supplementary-search-input {
      width: 100%;
      min-height: 48px;
      padding: 0 14px;
      border: 1px solid rgba(255,255,255,.16);
      border-radius: 13px;
      outline: none;
      background: rgba(255,255,255,.96);
      color: #101828;
      font: inherit;
      font-size: .88rem;
      box-sizing: border-box;
    }

    .supplementary-search-input::placeholder {
      color: #98a2b3;
    }

    .supplementary-search-input:focus {
      border-color: #8172ff;
      box-shadow:
        0 0 0 4px
        rgba(91,61,245,.12);
    }

    .quick-priorities {
      display: flex;
      flex-wrap: wrap;
      gap: 7px;
      margin-top: 9px;
    }

    .quick-priority-button {
      min-height: 31px;
      padding: 0 10px;
      border: 1px solid rgba(255,255,255,.14);
      border-radius: 999px;
      background: rgba(255,255,255,.07);
      color: #d9def0;
      font: inherit;
      font-size: .7rem;
      font-weight: 850;
      cursor: pointer;
      transition:
        transform .15s ease,
        background .15s ease,
        border-color .15s ease,
        color .15s ease;
    }

    .quick-priority-button:hover {
      transform: translateY(-1px);
      border-color: rgba(129,140,248,.55);
      background: rgba(99,102,241,.16);
      color: #fff;
    }

    .quick-priority-button.is-active {
      border-color: #8172ff;
      background: #5b3df5;
      color: #fff;
      box-shadow:
        0 6px 16px
        rgba(91,61,245,.24);
    }

    .quick-priority-clear {
      min-height: 31px;
      padding: 0 9px;
      border: 0;
      border-radius: 999px;
      background: transparent;
      color: #98a2b3;
      font: inherit;
      font-size: .68rem;
      font-weight: 800;
      cursor: pointer;
    }

    .quick-priority-clear:hover {
      color: #fff;
      text-decoration: underline;
    }

    .quick-priority-caption {
      width: 100%;
      margin: 0 0 1px;
      color: #aab4c5;
      font-size: .67rem;
      font-weight: 800;
      line-height: 1.35;
    }

    .supplementary-search-note {
      margin: 6px 0 0;
      color: #98a2b3;
      font-size: .68rem;
      line-height: 1.4;
    }

    @media (max-width: 760px) {
      .supplementary-search {
        grid-template-columns: 1fr;
      }
    }

    .result-controls {
      grid-column: 1 / -1;
      display: grid;
      gap: 12px;
      margin: 6px 0 18px;
      padding: 14px;
      border: 1px solid #e4e7ec;
      border-radius: 18px;
      background: rgba(255,255,255,.88);
      box-shadow: 0 8px 24px rgba(16,24,40,.05);
    }

    .result-control-group {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px;
    }

    .result-control-label {
      min-width: 88px;
      color: #667085;
      font-size: .76rem;
      font-weight: 900;
      text-transform: uppercase;
      letter-spacing: .06em;
    }

    .result-control-button {
      min-height: 38px;
      padding: 0 13px;
      border: 1px solid #d0d5dd;
      border-radius: 999px;
      background: #fff;
      color: #344054;
      font: inherit;
      font-size: .8rem;
      font-weight: 850;
      cursor: pointer;
      transition:
        transform .15s ease,
        border-color .15s ease,
        background .15s ease;
    }

    .result-control-button:hover {
      transform: translateY(-1px);
      border-color: #a7a0ff;
    }

    .result-control-button.is-active {
      border-color: #5b3df5;
      background: #5b3df5;
      color: #fff;
      box-shadow: 0 7px 18px rgba(91,61,245,.2);
    }

    .filter-empty-state {
      grid-column: 1 / -1;
      padding: 28px 18px;
      border: 1px dashed #cfd4dc;
      border-radius: 18px;
      background: #fff;
      color: #667085;
      text-align: center;
      line-height: 1.55;
    }

    @media (max-width: 640px) {
      .result-control-label {
        width: 100%;
        min-width: 0;
      }

      .result-control-button {
        flex: 1 1 auto;
      }
    }

    .source-filter-bar {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin: 16px 0 20px;
    }

    .source-filter-button {
      min-height: 40px;
      padding: 0 14px;
      border: 1px solid #d0d5dd;
      border-radius: 999px;
      background: #fff;
      color: #344054;
      font: inherit;
      font-size: .82rem;
      font-weight: 850;
      cursor: pointer;
    }

    .source-filter-button.is-active {
      border-color: #5b3df5;
      background: #5b3df5;
      color: #fff;
    }

    .result-source-section {
      grid-column: 1 / -1;
      margin: 12px 0 4px;
      padding-top: 10px;
    }

    .result-source-eyebrow {
      margin: 0 0 5px;
      color: #5b3df5;
      font-size: .75rem;
      font-weight: 900;
      letter-spacing: .11em;
      text-transform: uppercase;
    }

    .result-source-title {
      margin: 0;
      font-size: clamp(1.6rem, 3vw, 2.35rem);
      line-height: 1;
      letter-spacing: -.04em;
    }

    .source-health-row {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin: 0 0 14px;
    }

    .source-health-badge {
      display: inline-flex;
      align-items: center;
      gap: 7px;
      min-height: 32px;
      padding: 0 10px;
      border-radius: 999px;
      background: #ecfdf3;
      color: #027a48;
      font-size: .76rem;
      font-weight: 850;
    }

    .source-health-badge.is-stale {
      background: #fffaeb;
      color: #b54708;
    }

    .source-health-badge.is-unavailable {
      background: #fef3f2;
      color: #b42318;
    }

    .source-health-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: currentColor;
    }

    .search-warning-box {
      grid-column: 1 / -1;
      padding: 13px 15px;
      border: 1px solid #fedf89;
      border-radius: 14px;
      background: #fffaeb;
      color: #93370d;
      line-height: 1.5;
      font-size: .86rem;
      font-weight: 700;
    }

    .comparison-card {
      grid-column: span 1;
      overflow: hidden;
      border: 1px solid #d9ddff;
      border-radius: 20px;
      background: #fff;
      box-shadow: 0 10px 30px rgba(16,24,40,.06);
    }

    .comparison-card-head {
      display: grid;
      grid-template-columns: 118px 1fr;
      gap: 16px;
      padding: 16px;
      background:
        linear-gradient(
          145deg,
          rgba(91,61,245,.07),
          rgba(255,255,255,.95)
        );
    }

    .comparison-card-image {
      width: 118px;
      height: 118px;
      display: grid;
      place-items: center;
      overflow: hidden;
      border-radius: 15px;
      background: #fff;
    }

    .comparison-card-image img {
      width: 100%;
      height: 100%;
      object-fit: contain;
    }

    .comparison-card-kicker {
      display: inline-flex;
      margin-bottom: 8px;
      padding: 5px 8px;
      border-radius: 999px;
      background: #eef4ff;
      color: #3538cd;
      font-size: .72rem;
      font-weight: 900;
    }

    .comparison-card h3 {
      margin: 0;
      color: #101828;
      font-size: 1.05rem;
      line-height: 1.38;
    }

    .comparison-card-subtitle {
      margin: 8px 0 0;
      color: #667085;
      font-size: .82rem;
      line-height: 1.45;
    }

    .comparison-offers {
      display: grid;
      gap: 0;
      border-top: 1px solid #eaecf0;
    }

    .comparison-offer {
      display: grid;
      grid-template-columns: minmax(90px, .8fr) 1fr auto;
      align-items: center;
      gap: 12px;
      padding: 13px 15px;
      border-bottom: 1px solid #f2f4f7;
    }

    .comparison-offer:last-child {
      border-bottom: 0;
    }

    .comparison-offer-source {
      color: #344054;
      font-size: .8rem;
      font-weight: 900;
    }

    .comparison-offer-details {
      min-width: 0;
    }

    .comparison-offer-price {
      display: block;
      color: #101828;
      font-size: 1rem;
      font-weight: 950;
    }

    .comparison-offer-meta {
      display: block;
      margin-top: 3px;
      color: #667085;
      font-size: .7rem;
      line-height: 1.35;
    }

    .comparison-offer-link {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-height: 38px;
      padding: 0 11px;
      border-radius: 10px;
      background: #5b3df5;
      color: #fff;
      text-decoration: none;
      text-align: center;
      font-size: .76rem;
      font-weight: 900;
      white-space: nowrap;
    }

    .query-profile {
      grid-column: 1 / -1;
      margin: 0 0 14px;
      padding: 16px;
      border: 1px solid #d9ddff;
      border-radius: 18px;
      background:
        linear-gradient(
          145deg,
          rgba(91,61,245,.08),
          rgba(255,255,255,.96)
        );
    }

    .query-profile-title {
      margin: 0;
      color: #2f25a8;
      font-size: .82rem;
      font-weight: 950;
      text-transform: uppercase;
      letter-spacing: .06em;
    }

    .query-profile-chips {
      display: flex;
      flex-wrap: wrap;
      gap: 7px;
      margin-top: 10px;
    }

    .query-profile-chip {
      display: inline-flex;
      align-items: center;
      min-height: 32px;
      padding: 0 10px;
      border-radius: 999px;
      background: #fff;
      color: #344054;
      box-shadow: 0 4px 14px rgba(16,24,40,.06);
      font-size: .76rem;
      font-weight: 850;
    }

    .query-profile-note {
      margin: 10px 0 0;
      color: #667085;
      font-size: .78rem;
      line-height: 1.5;
    }

    .final-decision-launcher {
      grid-column: 1 / -1;
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 16px;
      align-items: center;
      margin: 0 0 22px;
      padding: 17px 18px;
      border: 1px solid #c7d7fe;
      border-radius: 19px;
      background:
        linear-gradient(
          135deg,
          #eef4ff,
          #f8f7ff
        );
    }

    .final-decision-launcher h3 {
      margin: 0;
      color: #182b66;
      font-size: 1.08rem;
      line-height: 1.3;
    }

    .final-decision-launcher p {
      margin: 6px 0 0;
      color: #526581;
      font-size: .77rem;
      line-height: 1.5;
    }

    .final-decision-open {
      min-height: 44px;
      padding: 0 15px;
      border: 0;
      border-radius: 12px;
      background: #5b3df5;
      color: #fff;
      font: inherit;
      font-size: .78rem;
      font-weight: 950;
      cursor: pointer;
      box-shadow:
        0 9px 22px
        rgba(91,61,245,.24);
    }

    .final-decision-backdrop {
      position: fixed;
      inset: 0;
      z-index: 10020;
      display: grid;
      place-items: center;
      padding: 20px;
      background: rgba(15,23,42,.70);
      backdrop-filter: blur(6px);
    }

    .final-decision-backdrop[hidden] {
      display: none;
    }

    .final-decision-modal {
      width: min(840px, 100%);
      max-height: 90vh;
      overflow: auto;
      border-radius: 25px;
      background: #f8fafc;
      box-shadow:
        0 35px 90px
        rgba(0,0,0,.38);
    }

    .final-decision-head {
      position: sticky;
      top: 0;
      z-index: 2;
      display: flex;
      justify-content: space-between;
      gap: 16px;
      padding: 20px;
      border-bottom: 1px solid #e4e7ec;
      background: rgba(248,250,252,.97);
      backdrop-filter: blur(10px);
    }

    .final-decision-eyebrow {
      margin: 0 0 5px;
      color: #5b3df5;
      font-size: .71rem;
      font-weight: 950;
      text-transform: uppercase;
      letter-spacing: .08em;
    }

    .final-decision-head h2 {
      margin: 0;
      color: #101828;
      font-size: 1.45rem;
    }

    .final-decision-close {
      width: 39px;
      height: 39px;
      flex: 0 0 auto;
      border: 1px solid #d0d5dd;
      border-radius: 50%;
      background: #fff;
      color: #344054;
      cursor: pointer;
    }

    .final-decision-body {
      padding: 20px;
    }

    .final-decision-result {
      padding: 18px;
      border: 1px solid #c7d7fe;
      border-radius: 19px;
      background: #fff;
    }

    .final-decision-status {
      display: flex;
      flex-wrap: wrap;
      gap: 7px;
      align-items: center;
      margin-bottom: 11px;
    }

    .final-decision-badge {
      display: inline-flex;
      align-items: center;
      min-height: 28px;
      padding: 0 9px;
      border-radius: 999px;
      background: #5b3df5;
      color: #fff;
      font-size: .69rem;
      font-weight: 950;
    }

    .final-decision-confidence {
      display: inline-flex;
      align-items: center;
      min-height: 28px;
      padding: 0 9px;
      border-radius: 999px;
      background: #f2f4f7;
      color: #475467;
      font-size: .68rem;
      font-weight: 900;
    }

    .final-decision-product {
      margin: 0;
      color: #101828;
      font-size: 1.35rem;
      line-height: 1.28;
    }

    .final-decision-price {
      display: block;
      margin-top: 6px;
      color: #101828;
      font-size: 1.28rem;
      font-weight: 950;
    }

    .final-decision-source {
      display: block;
      margin-top: 4px;
      color: #667085;
      font-size: .74rem;
      font-weight: 800;
    }

    .final-decision-grid {
      display: grid;
      grid-template-columns:
        repeat(2, minmax(0, 1fr));
      gap: 11px;
      margin-top: 15px;
    }

    .final-decision-section {
      padding: 13px;
      border: 1px solid #eaecf0;
      border-radius: 14px;
      background: #f9fafb;
    }

    .final-decision-section h4 {
      margin: 0 0 7px;
      color: #344054;
      font-size: .75rem;
      font-weight: 950;
      text-transform: uppercase;
      letter-spacing: .04em;
    }

    .final-decision-section p {
      margin: 0;
      color: #667085;
      font-size: .77rem;
      line-height: 1.52;
    }

    .final-decision-honesty {
      margin: 13px 0 0;
      padding: 12px 13px;
      border: 1px solid #fedf89;
      border-radius: 13px;
      background: #fffaeb;
      color: #7a2e0e;
      font-size: .74rem;
      line-height: 1.5;
    }

    .final-decision-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 9px;
      margin-top: 15px;
    }

    .final-decision-action {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-height: 42px;
      padding: 0 13px;
      border-radius: 11px;
      text-decoration: none;
      font-size: .75rem;
      font-weight: 950;
    }

    .final-decision-action.primary {
      background: #5b3df5;
      color: #fff;
    }

    .final-decision-action.secondary {
      border: 1px solid #d0d5dd;
      background: #fff;
      color: #344054;
    }

    .final-decision-refusal {
      padding: 20px;
      border: 1px solid #fecdca;
      border-radius: 17px;
      background: #fef3f2;
      color: #912018;
      font-size: .82rem;
      line-height: 1.58;
    }

    @media (max-width: 720px) {
      .final-decision-launcher {
        grid-template-columns: 1fr;
      }

      .final-decision-open {
        width: 100%;
      }

      .final-decision-grid {
        grid-template-columns: 1fr;
      }
    }

    .budget-upgrade {
      grid-column: 1 / -1;
      margin: 0 0 22px;
      padding: 20px;
      border: 1px solid #d9ddff;
      border-radius: 22px;
      background:
        linear-gradient(
          145deg,
          rgba(91,61,245,.07),
          rgba(255,255,255,.98)
        );
      box-shadow: 0 12px 34px rgba(16,24,40,.06);
    }

    .budget-upgrade-head {
      display: flex;
      flex-wrap: wrap;
      justify-content: space-between;
      align-items: end;
      gap: 12px;
      margin-bottom: 15px;
    }

    .budget-upgrade-eyebrow {
      margin: 0 0 5px;
      color: #5b3df5;
      font-size: .72rem;
      font-weight: 950;
      text-transform: uppercase;
      letter-spacing: .08em;
    }

    .budget-upgrade-title {
      margin: 0;
      color: #101828;
      font-size: 1.45rem;
      line-height: 1.2;
    }

    .budget-upgrade-limit {
      display: inline-flex;
      align-items: center;
      min-height: 31px;
      padding: 0 10px;
      border-radius: 999px;
      background: #f2f4f7;
      color: #475467;
      font-size: .7rem;
      font-weight: 900;
    }

    .budget-upgrade-verdict {
      margin: 0 0 15px;
      padding: 14px 15px;
      border-radius: 15px;
      font-size: .83rem;
      font-weight: 750;
      line-height: 1.55;
    }

    .budget-upgrade-verdict.is-worth {
      border: 1px solid #abefc6;
      background: #ecfdf3;
      color: #05603a;
    }

    .budget-upgrade-verdict.is-not-worth {
      border: 1px solid #fedf89;
      background: #fffaeb;
      color: #7a2e0e;
    }

    .budget-upgrade-grid {
      display: grid;
      grid-template-columns:
        repeat(2, minmax(0, 1fr));
      gap: 12px;
    }

    .budget-upgrade-card {
      display: grid;
      grid-template-rows: auto auto 1fr auto;
      min-width: 0;
      padding: 15px;
      border: 1px solid #e4e7ec;
      border-radius: 17px;
      background: #fff;
    }

    .budget-upgrade-label {
      display: inline-flex;
      align-items: center;
      width: fit-content;
      min-height: 27px;
      padding: 0 8px;
      border-radius: 999px;
      background: #eef2ff;
      color: #4338ca;
      font-size: .68rem;
      font-weight: 950;
    }

    .budget-upgrade-card h4 {
      margin: 10px 0 6px;
      color: #101828;
      font-size: .98rem;
      line-height: 1.35;
    }

    .budget-upgrade-price {
      color: #101828;
      font-size: 1.12rem;
      font-weight: 950;
    }

    .budget-upgrade-description {
      margin: 10px 0 0;
      color: #667085;
      font-size: .76rem;
      line-height: 1.5;
    }

    .budget-upgrade-facts {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin-top: 10px;
    }

    .budget-upgrade-fact {
      display: inline-flex;
      align-items: center;
      min-height: 27px;
      padding: 0 8px;
      border-radius: 999px;
      background: #f2f4f7;
      color: #475467;
      font-size: .66rem;
      font-weight: 850;
    }

    .budget-upgrade-link {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: fit-content;
      min-height: 38px;
      margin-top: 14px;
      padding: 0 12px;
      border-radius: 10px;
      background: #5b3df5;
      color: #fff;
      text-decoration: none;
      font-size: .73rem;
      font-weight: 950;
    }

    .budget-upgrade-honesty {
      margin: 14px 0 0;
      color: #667085;
      font-size: .72rem;
      line-height: 1.5;
    }

    @media (max-width: 800px) {
      .budget-upgrade-grid {
        grid-template-columns: 1fr;
      }
    }

    .shopping-advisor {
      grid-column: 1 / -1;
      margin: 0 0 22px;
      padding: 20px;
      border: 1px solid #d9ddff;
      border-radius: 22px;
      background: #fff;
      box-shadow: 0 12px 34px rgba(16,24,40,.06);
    }

    .shopping-advisor-head {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 16px;
      align-items: start;
      margin-bottom: 16px;
    }

    .shopping-advisor-eyebrow {
      margin: 0 0 6px;
      color: #5b3df5;
      font-size: .72rem;
      font-weight: 950;
      text-transform: uppercase;
      letter-spacing: .08em;
    }

    .shopping-advisor-title {
      margin: 0;
      color: #101828;
      font-size: 1.5rem;
      line-height: 1.18;
    }

    .shopping-advisor-intro {
      max-width: 650px;
      margin: 8px 0 0;
      color: #667085;
      font-size: .82rem;
      line-height: 1.55;
    }

    .advisor-confidence {
      display: inline-flex;
      align-items: center;
      min-height: 32px;
      padding: 0 10px;
      border-radius: 999px;
      background: #f2f4f7;
      color: #475467;
      font-size: .7rem;
      font-weight: 900;
      white-space: nowrap;
    }

    .advisor-verdict {
      margin: 0 0 16px;
      padding: 15px 16px;
      border: 1px solid #c7d7fe;
      border-radius: 16px;
      background: #f5f8ff;
      color: #253b80;
      font-size: .86rem;
      font-weight: 750;
      line-height: 1.58;
    }

    .advisor-verdict strong {
      color: #182b66;
    }

    .advisor-options {
      display: grid;
      gap: 12px;
    }

    .advisor-option {
      display: grid;
      grid-template-columns: 170px minmax(0, 1fr);
      gap: 16px;
      padding: 15px;
      border: 1px solid #eaecf0;
      border-radius: 17px;
      background: #fcfcfd;
    }

    .advisor-option-name {
      min-width: 0;
    }

    .advisor-option-label {
      display: inline-flex;
      align-items: center;
      width: fit-content;
      min-height: 27px;
      padding: 0 8px;
      border-radius: 999px;
      background: #eef2ff;
      color: #4338ca;
      font-size: .68rem;
      font-weight: 950;
    }

    .advisor-option-name h4 {
      margin: 9px 0 5px;
      color: #101828;
      font-size: .95rem;
      line-height: 1.35;
    }

    .advisor-option-price {
      color: #344054;
      font-size: .78rem;
      font-weight: 900;
    }

    .advisor-option-body {
      display: grid;
      grid-template-columns:
        repeat(3, minmax(0, 1fr));
      gap: 10px;
    }

    .advisor-point {
      padding: 11px;
      border-radius: 13px;
      background: #fff;
      border: 1px solid #f0f1f4;
    }

    .advisor-point-title {
      display: block;
      margin-bottom: 5px;
      color: #344054;
      font-size: .67rem;
      font-weight: 950;
      text-transform: uppercase;
      letter-spacing: .05em;
    }

    .advisor-point p {
      margin: 0;
      color: #667085;
      font-size: .75rem;
      line-height: 1.48;
    }

    .advisor-honesty {
      margin-top: 14px;
      padding: 13px 14px;
      border: 1px solid #fedf89;
      border-radius: 14px;
      background: #fffaeb;
      color: #7a2e0e;
      font-size: .77rem;
      line-height: 1.5;
    }

    .advisor-honesty strong {
      color: #93370d;
    }

    @media (max-width: 900px) {
      .shopping-advisor-head {
        grid-template-columns: 1fr;
      }

      .advisor-option {
        grid-template-columns: 1fr;
      }

      .advisor-option-body {
        grid-template-columns: 1fr;
      }
    }

    .compare-action-row {
      display: flex;
      justify-content: flex-end;
      margin-top: 10px;
    }

    .compare-toggle-button {
      min-height: 36px;
      padding: 0 11px;
      border: 1px solid #d0d5dd;
      border-radius: 10px;
      background: #fff;
      color: #344054;
      font: inherit;
      font-size: .72rem;
      font-weight: 900;
      cursor: pointer;
    }

    .compare-toggle-button.is-selected {
      border-color: #5b3df5;
      background: #5b3df5;
      color: #fff;
    }

    .compare-tray {
      position: fixed;
      left: 50%;
      bottom: 14px;
      z-index: 9998;
      width: min(900px, calc(100vw - 24px));
      transform: translateX(-50%);
      padding: 13px;
      border-radius: 18px;
      background: rgba(17,24,39,.96);
      color: #fff;
      box-shadow: 0 20px 50px rgba(0,0,0,.28);
    }

    .compare-tray[hidden],
    .compare-modal-backdrop[hidden] {
      display: none;
    }

    .compare-tray-head,
    .compare-tray-actions {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
    }

    .compare-tray-title {
      margin: 0;
      font-size: .86rem;
      font-weight: 950;
    }

    .compare-tray-items {
      display: flex;
      flex-wrap: wrap;
      gap: 7px;
      margin-top: 10px;
    }

    .compare-tray-item {
      display: inline-flex;
      align-items: center;
      gap: 7px;
      max-width: 250px;
      min-height: 32px;
      padding: 0 8px 0 10px;
      border-radius: 999px;
      background: rgba(255,255,255,.11);
      font-size: .7rem;
      font-weight: 800;
    }

    .compare-tray-item span {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .compare-tray-remove {
      width: 24px;
      height: 24px;
      border: 0;
      border-radius: 50%;
      background: rgba(255,255,255,.12);
      color: #fff;
      cursor: pointer;
    }

    .compare-tray-actions {
      justify-content: flex-end;
      margin-top: 11px;
    }

    .compare-tray-button {
      min-height: 38px;
      padding: 0 12px;
      border: 0;
      border-radius: 10px;
      font: inherit;
      font-size: .74rem;
      font-weight: 950;
      cursor: pointer;
    }

    .compare-tray-button.primary {
      background: #6c4cff;
      color: #fff;
    }

    .compare-tray-button.secondary {
      background: rgba(255,255,255,.10);
      color: #fff;
    }

    .compare-tray-message {
      margin: 8px 0 0;
      color: #fcd34d;
      font-size: .69rem;
    }

    .compare-modal-backdrop {
      position: fixed;
      inset: 0;
      z-index: 10000;
      display: grid;
      place-items: center;
      padding: 20px;
      background: rgba(15,23,42,.68);
    }

    .compare-modal {
      width: min(1100px, 100%);
      max-height: 88vh;
      overflow: auto;
      border-radius: 24px;
      background: #f8fafc;
      box-shadow: 0 30px 80px rgba(0,0,0,.34);
    }

    .compare-modal-head {
      position: sticky;
      top: 0;
      z-index: 2;
      display: flex;
      justify-content: space-between;
      gap: 16px;
      padding: 20px;
      border-bottom: 1px solid #e4e7ec;
      background: rgba(248,250,252,.97);
    }

    .compare-modal-head h2 {
      margin: 4px 0 0;
      color: #101828;
    }

    .compare-modal-close {
      width: 38px;
      height: 38px;
      border: 1px solid #d0d5dd;
      border-radius: 50%;
      background: #fff;
      cursor: pointer;
    }

    .compare-modal-body {
      padding: 20px;
    }

    .compare-verdict {
      margin: 0 0 16px;
      padding: 15px 16px;
      border: 1px solid #c7d7fe;
      border-radius: 16px;
      background: #eef4ff;
      color: #253b80;
      font-size: .84rem;
      font-weight: 750;
      line-height: 1.55;
    }

    .compare-grid {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 12px;
    }

    .compare-column {
      padding: 15px;
      border: 1px solid #e4e7ec;
      border-radius: 18px;
      background: #fff;
    }

    .compare-column h3 {
      margin: 8px 0;
      color: #101828;
      font-size: .98rem;
      line-height: 1.35;
    }

    .compare-price {
      margin: 0 0 12px;
      color: #101828;
      font-size: 1.15rem;
      font-weight: 950;
    }

    .compare-fact {
      margin-top: 8px;
      padding: 10px;
      border-radius: 12px;
      background: #f8fafc;
    }

    .compare-fact strong {
      display: block;
      margin-bottom: 4px;
      color: #475467;
      font-size: .65rem;
      text-transform: uppercase;
    }

    .compare-fact p {
      margin: 0;
      color: #667085;
      font-size: .74rem;
      line-height: 1.45;
    }

    .compare-column-action {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 100%;
      min-height: 40px;
      margin-top: 12px;
      border-radius: 11px;
      background: #5b3df5;
      color: #fff;
      text-decoration: none;
      font-size: .74rem;
      font-weight: 950;
    }

    @media (max-width: 860px) {
      .compare-grid {
        grid-template-columns: 1fr;
      }
    }

    .deal-guard-note {
      grid-column: 1 / -1;
      margin: 0 0 14px;
      padding: 12px 14px;
      border: 1px solid #d9e2ff;
      border-radius: 15px;
      background: #f7f9ff;
      color: #41547a;
      font-size: .76rem;
      line-height: 1.5;
    }

    .deal-guard-note strong {
      color: #253b80;
    }

    .risk-badge {
      display: inline-flex;
      align-items: center;
      width: fit-content;
      min-height: 27px;
      margin-top: 8px;
      padding: 0 8px;
      border-radius: 999px;
      font-size: .68rem;
      font-weight: 950;
    }

    .risk-badge.is-medium {
      background: #fff7e6;
      color: #a64b00;
    }

    .risk-badge.is-high {
      background: #fff0f0;
      color: #b42318;
    }

    .risk-warning {
      margin: 9px 0 0;
      padding: 10px 11px;
      border-radius: 12px;
      font-size: .73rem;
      line-height: 1.45;
    }

    .risk-warning.is-medium {
      border: 1px solid #fedf89;
      background: #fffaeb;
      color: #7a2e0e;
    }

    .risk-warning.is-high {
      border: 1px solid #fecdca;
      background: #fef3f2;
      color: #912018;
    }

    .comparison-offer-risk {
      display: block;
      margin-top: 3px;
      font-size: .66rem;
      font-weight: 850;
      line-height: 1.35;
    }

    .comparison-offer-risk.is-medium {
      color: #b54708;
    }

    .comparison-offer-risk.is-high {
      color: #b42318;
    }

    .smart-picks {
      grid-column: 1 / -1;
      margin: 2px 0 18px;
      padding: 18px;
      border: 1px solid #d9ddff;
      border-radius: 22px;
      background:
        linear-gradient(
          145deg,
          rgba(91,61,245,.09),
          rgba(255,255,255,.97)
        );
      box-shadow: 0 12px 34px rgba(16,24,40,.06);
    }

    .smart-picks-head {
      display: flex;
      flex-wrap: wrap;
      align-items: end;
      justify-content: space-between;
      gap: 10px;
      margin-bottom: 14px;
    }

    .smart-picks-eyebrow {
      margin: 0 0 5px;
      color: #5b3df5;
      font-size: .72rem;
      font-weight: 950;
      text-transform: uppercase;
      letter-spacing: .08em;
    }

    .smart-picks-title {
      margin: 0;
      color: #101828;
      font-size: 1.45rem;
      line-height: 1.15;
    }

    .smart-picks-note {
      max-width: 580px;
      margin: 0;
      color: #667085;
      font-size: .78rem;
      line-height: 1.45;
    }

    .smart-picks-grid {
      display: grid;
      grid-template-columns:
        repeat(3, minmax(0, 1fr));
      gap: 12px;
    }

    .smart-pick-card {
      display: grid;
      grid-template-rows: auto auto 1fr auto;
      min-width: 0;
      padding: 14px;
      border: 1px solid #eaecf0;
      border-radius: 17px;
      background: #fff;
      box-shadow: 0 7px 20px rgba(16,24,40,.05);
    }

    .smart-pick-type {
      display: inline-flex;
      align-items: center;
      width: fit-content;
      min-height: 28px;
      padding: 0 8px;
      border-radius: 999px;
      background: #f2f4f7;
      color: #344054;
      font-size: .7rem;
      font-weight: 950;
    }

    .smart-pick-card h4 {
      margin: 10px 0 6px;
      color: #101828;
      font-size: .96rem;
      line-height: 1.35;
    }

    .smart-pick-reason {
      margin: 0;
      color: #667085;
      font-size: .76rem;
      line-height: 1.5;
    }

    .smart-pick-bottom {
      display: flex;
      align-items: end;
      justify-content: space-between;
      gap: 10px;
      margin-top: 14px;
      padding-top: 12px;
      border-top: 1px solid #f2f4f7;
    }

    .smart-pick-price {
      color: #101828;
      font-size: 1rem;
      font-weight: 950;
    }

    .smart-pick-source {
      display: block;
      margin-top: 3px;
      color: #667085;
      font-size: .67rem;
      font-weight: 750;
    }

    .smart-pick-link {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-height: 38px;
      padding: 0 11px;
      border-radius: 10px;
      background: #5b3df5;
      color: #fff;
      text-decoration: none;
      text-align: center;
      font-size: .74rem;
      font-weight: 950;
      white-space: nowrap;
    }

    @media (max-width: 900px) {
      .smart-picks-grid {
        grid-template-columns: 1fr;
      }
    }

    .ranking-explainer {
      grid-column: 1 / -1;
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px;
      margin: 2px 0 14px;
      padding: 12px 14px;
      border: 1px solid #d9ddff;
      border-radius: 14px;
      background: #f8f7ff;
      color: #4a3fc0;
      font-size: .8rem;
      font-weight: 750;
      line-height: 1.5;
    }

    .ranking-explainer strong {
      color: #2f25a8;
    }

    .rank-reasons {
      display: flex;
      flex-wrap: wrap;
      gap: 5px;
      margin-top: 8px;
    }

    .rank-reason {
      padding: 5px 7px;
      border-radius: 999px;
      background: #f2f4f7;
      color: #475467;
      font-size: .68rem;
      font-weight: 800;
    }

    .comparison-rank {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 34px;
      height: 34px;
      margin-right: 8px;
      border-radius: 10px;
      background: #fff;
      color: #4f46e5;
      box-shadow: 0 5px 16px rgba(79,70,229,.14);
      font-size: .76rem;
      font-weight: 950;
    }

    .comparison-card-kicker-row {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 7px;
      margin-bottom: 8px;
    }

    .comparison-summary-note {
      grid-column: 1 / -1;
      margin: 4px 0 0;
      padding: 12px 14px;
      border: 1px solid #d9ddff;
      border-radius: 14px;
      background: #f8f7ff;
      color: #4a3fc0;
      font-size: .82rem;
      font-weight: 750;
      line-height: 1.5;
    }

    @media (max-width: 720px) {
      .comparison-card-head {
        grid-template-columns: 82px 1fr;
      }

      .comparison-card-image {
        width: 82px;
        height: 82px;
      }

      .comparison-offer {
        grid-template-columns: 1fr;
      }

      .comparison-offer-link {
        width: 100%;
      }
    }

    .result-source-description {
      margin: 8px 0 0;
      color: #667085;
      line-height: 1.5;
    }

    .product-source {
      margin-left: 7px;
      color: #667085;
      font-size: .76rem;
      font-weight: 800;
    }

    .product-badge.near-budget {
      background: #fffaeb;
      color: #b54708;
    }

    .product-badge.real-cache {
      background: #eef4ff;
      color: #3538cd;
    }

    .recent-searches-section {
      padding: 34px 0 8px;
    }

    .recent-searches-section[hidden] {
      display: none !important;
    }

    .recent-searches-head {
      display: flex;
      align-items: end;
      justify-content: space-between;
      gap: 20px;
      margin-bottom: 16px;
    }

    .recent-searches-eyebrow {
      margin: 0 0 6px;
      color: #5b3df5;
      font-size: .78rem;
      font-weight: 900;
      letter-spacing: .12em;
      text-transform: uppercase;
    }

    .recent-searches-title {
      margin: 0;
      font-size: clamp(1.7rem, 4vw, 2.8rem);
      line-height: 1;
      letter-spacing: -.045em;
    }

    .recent-searches-info {
      max-width: 460px;
      margin: 0;
      color: #667085;
      line-height: 1.55;
      text-align: right;
    }

    .recent-searches-list {
      display: grid;
      grid-template-columns: repeat(5, minmax(0, 1fr));
      gap: 10px;
    }

    .recent-search-button {
      min-width: 0;
      padding: 15px 14px;
      border: 1px solid #e4e7ec;
      border-radius: 16px;
      background: #fff;
      color: #101828;
      text-align: left;
      cursor: pointer;
      box-shadow: 0 8px 24px rgba(16,24,40,.045);
      transition:
        transform .16s ease,
        box-shadow .16s ease,
        border-color .16s ease;
    }

    .recent-search-button:hover {
      transform: translateY(-2px);
      border-color: #c7d2fe;
      box-shadow: 0 12px 28px rgba(16,24,40,.08);
    }

    .recent-search-query {
      display: block;
      overflow: hidden;
      color: #101828;
      font-size: .92rem;
      font-weight: 900;
      line-height: 1.35;
      text-overflow: ellipsis;
    }

    .recent-search-meta {
      display: block;
      margin-top: 7px;
      color: #667085;
      font-size: .73rem;
      font-weight: 700;
      line-height: 1.4;
    }

    @media (max-width: 1000px) {
      .recent-searches-list {
        grid-template-columns: repeat(3, minmax(0, 1fr));
      }
    }

    @media (max-width: 720px) {
      .recent-searches-head {
        align-items: flex-start;
        flex-direction: column;
      }

      .recent-searches-info {
        text-align: left;
      }

      .recent-searches-list {
        grid-template-columns: 1fr;
      }
    }

    @keyframes miboyPulse {
      0%, 100% { opacity: .45; transform: scale(.9); }
      50% { opacity: 1; transform: scale(1.1); }
    }
  `;
  document.head.appendChild(style);
}

function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractBudget(query) {
  const values = [...normalizeText(query).matchAll(/(\d{2,5})/g)]
    .map(match => Number(match[1]))
    .filter(value => Number.isFinite(value) && value > 0);

  return values.length ? Math.max(...values) : null;
}

function scoreProduct(product, query) {
  const words = normalizeText(query)
    .split(" ")
    .filter(word => word.length > 1);

  const name = normalizeText(product.name);
  const category = normalizeText(product.category);

  const haystack = normalizeText([
    product.name,
    product.category,
    product.description,
    ...(product.keywords || []),
    ...(product.tags || [])
  ].join(" "));

  let score = 0;

  for (const word of words) {
    if (haystack.includes(word)) score += 3;
    if (name.includes(word)) score += 2;
    if (category === word) score += 5;
  }

  const budget = extractBudget(query);

  if (budget !== null) {
    if (product.price <= budget) {
      score += 6;
    } else {
      score -= Math.min(
        8,
        ((product.price - budget) / Math.max(budget, 1)) * 8
      );
    }
  }

  return score;
}

function localSearch(query) {
  return localProducts
    .map(product => ({
      product,
      score: scoreProduct(product, query)
    }))
    .filter(item => item.score > 0)
    .sort(
      (a, b) =>
        b.score - a.score ||
        a.product.price - b.product.price
    )
    .map(item => item.product);
}

function formatPrice(price, digits = 0) {
  return new Intl.NumberFormat("pl-PL", {
    style: "currency",
    currency: "PLN",
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  }).format(Number(price || 0));
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function safeUrl(value) {
  const text = String(value || "").trim();
  return /^https?:\/\//i.test(text) ? text : "#";
}

function injectSearchEnhancementStyles() {
  if (document.getElementById("miboySearchEnhancementStyles")) {
    return;
  }

  const style = document.createElement("style");
  style.id = "miboySearchEnhancementStyles";
  style.textContent = `
    .search-loader {
      margin: 16px 0 20px;
      padding: 18px 18px 16px;
      border: 1px solid rgba(129,140,248,.22);
      border-radius: 22px;
      background:
        radial-gradient(circle at top right, rgba(99,102,241,.16), transparent 32%),
        linear-gradient(145deg, rgba(255,255,255,.98), rgba(244,247,255,.98));
      box-shadow: 0 18px 40px rgba(15,23,42,.06);
      overflow: hidden;
      position: relative;
      opacity: 0;
      transform: translateY(8px);
      transition: opacity .28s ease, transform .28s ease;
    }

    .search-loader.is-visible {
      opacity: 1;
      transform: translateY(0);
    }

    .search-loader-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      flex-wrap: wrap;
    }

    .search-loader-title {
      display: inline-flex;
      align-items: center;
      gap: 10px;
      font-weight: 900;
      color: #0f172a;
      font-size: 1rem;
    }

    .search-loader-ring {
      width: 18px;
      height: 18px;
      border-radius: 999px;
      border: 3px solid rgba(99,102,241,.18);
      border-top-color: #6d28d9;
      animation: miboySpin 1s linear infinite;
      box-sizing: border-box;
      flex-shrink: 0;
    }

    .search-loader-time {
      font-size: .8rem;
      font-weight: 800;
      color: #4f46e5;
      background: rgba(99,102,241,.10);
      border-radius: 999px;
      padding: 6px 10px;
    }

    .search-loader-copy {
      margin: 10px 0 14px;
      color: #475467;
      font-size: .92rem;
      line-height: 1.58;
    }

    .search-loader-bar {
      width: 100%;
      height: 12px;
      border-radius: 999px;
      background: rgba(99,102,241,.10);
      overflow: hidden;
      position: relative;
    }

    .search-loader-progress {
      width: 8%;
      height: 100%;
      border-radius: inherit;
      background: linear-gradient(90deg, #4f46e5, #7c3aed, #22c55e);
      box-shadow: 0 8px 18px rgba(79,70,229,.25);
      transition: width .4s ease;
    }

    .search-loader-steps {
      display: grid;
      grid-template-columns: repeat(4, minmax(0,1fr));
      gap: 10px;
      margin-top: 14px;
    }

    .search-loader-step {
      border: 1px solid rgba(148,163,184,.18);
      border-radius: 16px;
      padding: 10px 11px;
      background: rgba(255,255,255,.74);
      color: #64748b;
      font-size: .77rem;
      line-height: 1.42;
    }

    .search-loader-step.is-active {
      border-color: rgba(99,102,241,.25);
      background: rgba(99,102,241,.08);
      color: #312e81;
      font-weight: 700;
    }

    .offer-inline-links,
    .offer-extra-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      align-items: center;
    }

    .offer-inline-link,
    .offer-secondary-link,
    .offer-media-link,
    .offer-image-link {
      display: inline-flex;
      align-items: center;
      gap: 7px;
      font-size: .83rem;
      font-weight: 800;
      color: #4f46e5;
      text-decoration: none;
    }

    .offer-inline-link:hover,
    .offer-secondary-link:hover,
    .offer-media-link:hover,
    .offer-image-link:hover {
      text-decoration: underline;
    }

    .offer-icon-badge {
      width: 28px;
      height: 28px;
      border-radius: 12px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      background: rgba(99,102,241,.10);
      font-size: .92rem;
      flex-shrink: 0;
    }

    .offer-image-link {
      display: block;
      line-height: 0;
    }

    .offer-image-link .real-product-image {
      transition: transform .25s ease, box-shadow .25s ease;
    }

    .offer-image-link:hover .real-product-image {
      transform: scale(1.03);
      box-shadow: 0 16px 32px rgba(15,23,42,.12);
    }

    .product-title-link,
    .smart-pick-title-link,
    .advisor-title-link,
    .budget-upgrade-title-link,
    .final-decision-preview-link {
      color: inherit;
      text-decoration: none;
    }

    .product-title-link:hover,
    .smart-pick-title-link:hover,
    .advisor-title-link:hover,
    .budget-upgrade-title-link:hover,
    .final-decision-preview-link:hover {
      color: #4f46e5;
      text-decoration: underline;
    }

    .budget-upgrade-card {
      display: grid;
      gap: 14px;
    }

    .budget-upgrade-visual {
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 176px;
      padding: 14px;
      border-radius: 18px;
      background:
        radial-gradient(circle at top right, rgba(99,102,241,.12), transparent 38%),
        linear-gradient(145deg, #fbfcff, #f3f5ff);
      border: 1px solid rgba(148,163,184,.14);
    }

    .budget-upgrade-visual .real-product-image {
      max-height: 168px;
      width: auto;
      object-fit: contain;
    }

    .budget-upgrade-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      align-items: center;
    }

    .budget-upgrade-link.is-primary,
    .final-decision-preview-button {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      padding: 11px 14px;
      border-radius: 14px;
      text-decoration: none;
      font-weight: 900;
      background: linear-gradient(135deg, #4f46e5, #7c3aed);
      color: #fff;
      box-shadow: 0 16px 28px rgba(79,70,229,.22);
    }

    .budget-upgrade-link.is-secondary {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      padding: 11px 14px;
      border-radius: 14px;
      text-decoration: none;
      font-weight: 800;
      color: #4f46e5;
      border: 1px solid rgba(99,102,241,.22);
      background: rgba(255,255,255,.92);
    }

    .smart-pick-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      align-items: center;
      margin-top: 12px;
    }

    .advisor-option-actions {
      margin-top: 14px;
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      align-items: center;
    }

    .advisor-option-name-top {
      display: flex;
      gap: 11px;
      align-items: flex-start;
    }

    .advisor-option-media {
      width: 64px;
      height: 64px;
      flex: 0 0 64px;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
      border-radius: 15px;
      background: linear-gradient(145deg, #f8faff, #eef2ff);
      border: 1px solid rgba(148,163,184,.14);
      text-decoration: none;
    }

    .advisor-option-media .real-product-image {
      width: 100%;
      height: 100%;
      object-fit: contain;
    }

    .advisor-option-copy {
      min-width: 0;
    }

    .product-description-link {
      display: block;
      color: inherit;
      text-decoration: none;
    }

    .product-description-link:hover {
      color: #4f46e5;
    }

    .product-description-link:hover .product-description {
      color: #4f46e5;
    }

    .final-decision-launcher {
      gap: 18px;
    }

    .final-decision-launcher-main {
      display: grid;
      gap: 14px;
    }

    .final-decision-preview {
      display: flex;
      gap: 14px;
      align-items: center;
      padding: 14px;
      border-radius: 18px;
      border: 1px solid rgba(129,140,248,.22);
      background: rgba(255,255,255,.72);
      max-width: 620px;
    }

    .final-decision-preview-media {
      width: 86px;
      height: 86px;
      border-radius: 18px;
      overflow: hidden;
      flex-shrink: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      background: linear-gradient(145deg, #f8faff, #eef2ff);
      border: 1px solid rgba(148,163,184,.14);
    }

    .final-decision-preview-media .real-product-image {
      max-height: 74px;
      width: auto;
      object-fit: contain;
    }

    .final-decision-preview-copy {
      display: grid;
      gap: 8px;
      min-width: 0;
    }

    .final-decision-preview-label {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      font-size: .78rem;
      font-weight: 900;
      color: #4f46e5;
      text-transform: uppercase;
      letter-spacing: .05em;
    }

    .final-decision-preview-title {
      margin: 0;
      font-size: 1rem;
      line-height: 1.35;
      color: #0f172a;
      font-weight: 900;
    }

    .final-decision-preview-meta {
      font-size: .85rem;
      color: #475467;
    }

    .product-card .real-product-image {
      max-height: 190px;
      width: auto;
      object-fit: contain;
    }

    .product-card h3 {
      margin-bottom: 10px;
    }

    .product-description {
      margin-bottom: 12px;
    }

    @keyframes miboySpin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }

    @media (max-width: 780px) {
      .search-loader-steps {
        grid-template-columns: repeat(2, minmax(0,1fr));
      }

      .final-decision-preview {
        align-items: flex-start;
      }
    }

    @media (max-width: 560px) {
      .search-loader-steps {
        grid-template-columns: 1fr;
      }

      .final-decision-preview {
        flex-direction: column;
      }

      .budget-upgrade-visual {
        min-height: 148px;
      }
    }
  `;
  document.head.appendChild(style);
}

function injectBackToTopStyles() {
  if (
    document.getElementById(
      "miboyBackToTopStyles"
    )
  ) {
    return;
  }

  const style =
    document.createElement(
      "style"
    );

  style.id =
    "miboyBackToTopStyles";

  style.textContent = `
    .back-to-top-button {
      --scroll-progress: 0%;
      position: fixed;
      right: 22px;
      bottom: 22px;
      z-index: 9996;
      width: 58px;
      height: 58px;
      display: grid;
      place-items: center;
      padding: 3px;
      border: 0;
      border-radius: 999px;
      background:
        conic-gradient(
          #22c55e var(--scroll-progress),
          rgba(255,255,255,.20) 0
        );
      box-shadow:
        0 18px 36px rgba(15,23,42,.25),
        0 0 0 1px rgba(255,255,255,.14);
      cursor: pointer;
      opacity: 0;
      visibility: hidden;
      transform:
        translateY(18px)
        scale(.88);
      transition:
        opacity .24s ease,
        visibility .24s ease,
        transform .24s ease,
        filter .18s ease;
      -webkit-tap-highlight-color: transparent;
    }

    .back-to-top-button.is-visible {
      opacity: 1;
      visibility: visible;
      transform:
        translateY(0)
        scale(1);
    }

    .back-to-top-button:hover {
      filter: brightness(1.08);
      transform:
        translateY(-3px)
        scale(1.04);
    }

    .back-to-top-button:focus-visible {
      outline: 4px solid rgba(99,102,241,.26);
      outline-offset: 4px;
    }

    .back-to-top-inner {
      width: 100%;
      height: 100%;
      display: grid;
      place-items: center;
      border-radius: inherit;
      background:
        linear-gradient(
          145deg,
          #4f46e5,
          #7c3aed
        );
      color: #fff;
      font-size: 1.42rem;
      font-weight: 950;
      line-height: 1;
      box-shadow:
        inset 0 1px 0 rgba(255,255,255,.24);
    }

    .back-to-top-arrow {
      display: block;
      transform: translateY(-1px);
      transition: transform .18s ease;
    }

    .back-to-top-button:hover
    .back-to-top-arrow {
      transform: translateY(-4px);
    }

    .back-to-top-tooltip {
      position: absolute;
      right: 68px;
      top: 50%;
      padding: 8px 10px;
      border-radius: 10px;
      background: rgba(17,24,39,.95);
      color: #fff;
      font-size: .72rem;
      font-weight: 850;
      white-space: nowrap;
      opacity: 0;
      visibility: hidden;
      transform:
        translateY(-50%)
        translateX(6px);
      transition:
        opacity .18s ease,
        visibility .18s ease,
        transform .18s ease;
      pointer-events: none;
    }

    .back-to-top-button:hover
    .back-to-top-tooltip,
    .back-to-top-button:focus-visible
    .back-to-top-tooltip {
      opacity: 1;
      visibility: visible;
      transform:
        translateY(-50%)
        translateX(0);
    }

    @media (max-width: 720px) {
      .back-to-top-button {
        right: 14px;
        bottom: 14px;
        width: 52px;
        height: 52px;
      }

      .back-to-top-tooltip {
        display: none;
      }
    }

    @media (prefers-reduced-motion: reduce) {
      .back-to-top-button,
      .back-to-top-arrow {
        transition: none;
      }
    }
  `;

  document.head.appendChild(
    style
  );
}

function ensureBackToTopButton() {
  let button =
    document.getElementById(
      "backToTopButton"
    );

  if (button) {
    return button;
  }

  button =
    document.createElement(
      "button"
    );

  button.id =
    "backToTopButton";

  button.className =
    "back-to-top-button";

  button.type =
    "button";

  button.setAttribute(
    "aria-label",
    "Wróć na górę strony"
  );

  button.setAttribute(
    "title",
    "Wróć na górę"
  );

  button.innerHTML = `
    <span class="back-to-top-inner">
      <span
        class="back-to-top-arrow"
        aria-hidden="true">
        ↑
      </span>
    </span>

    <span
      class="back-to-top-tooltip"
      aria-hidden="true">
      Wróć na górę
    </span>
  `;

  document.body.appendChild(
    button
  );

  let ticking = false;

  const updateButton = () => {
    const documentElement =
      document.documentElement;

    const body =
      document.body;

    const scrollTop =
      window.scrollY ||
      documentElement.scrollTop ||
      body.scrollTop ||
      0;

    const fullHeight =
      Math.max(
        documentElement.scrollHeight,
        body.scrollHeight
      );

    const availableScroll =
      Math.max(
        1,
        fullHeight -
        window.innerHeight
      );

    const progress =
      Math.max(
        0,
        Math.min(
          100,
          (
            scrollTop /
            availableScroll
          ) * 100
        )
      );

    button.style.setProperty(
      "--scroll-progress",
      `${progress}%`
    );

    button.classList.toggle(
      "is-visible",
      scrollTop > 460
    );
  };

  const scheduleUpdate = () => {
    if (ticking) {
      return;
    }

    ticking = true;

    window.requestAnimationFrame(
      () => {
        updateButton();
        ticking = false;
      }
    );
  };

  button.addEventListener(
    "click",
    () => {
      const prefersReducedMotion =
        window.matchMedia &&
        window.matchMedia(
          "(prefers-reduced-motion: reduce)"
        ).matches;

      window.scrollTo({
        top: 0,
        left: 0,
        behavior:
          prefersReducedMotion
            ? "auto"
            : "smooth"
      });
    }
  );

  window.addEventListener(
    "scroll",
    scheduleUpdate,
    {
      passive: true
    }
  );

  window.addEventListener(
    "resize",
    scheduleUpdate
  );

  updateButton();

  return button;
}


function injectSavedProductsStyles() {
  if (
    document.getElementById(
      "miboySavedProductsStyles"
    )
  ) {
    return;
  }

  const style =
    document.createElement(
      "style"
    );

  style.id =
    "miboySavedProductsStyles";

  style.textContent = `
    .save-product-button {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 7px;
      min-height: 36px;
      padding: 0 11px;
      border: 1px solid #d0d5dd;
      border-radius: 11px;
      background: #fff;
      color: #344054;
      font: inherit;
      font-size: .72rem;
      font-weight: 900;
      cursor: pointer;
      transition:
        transform .16s ease,
        border-color .16s ease,
        background .16s ease,
        color .16s ease;
    }

    .save-product-button:hover {
      transform: translateY(-1px);
      border-color: #ec4899;
      color: #be185d;
    }

    .save-product-button.is-saved {
      border-color: #f9a8d4;
      background: #fdf2f8;
      color: #be185d;
    }

    .save-product-button.is-compact {
      min-height: 34px;
      padding: 0 9px;
      font-size: .69rem;
    }

    .saved-products-tab {
      position: fixed;
      right: 0;
      top: 48%;
      z-index: 9997;
      display: grid;
      gap: 4px;
      justify-items: center;
      min-width: 58px;
      padding: 12px 9px;
      border: 0;
      border-radius: 18px 0 0 18px;
      background:
        linear-gradient(
          145deg,
          #db2777,
          #7c3aed
        );
      color: #fff;
      box-shadow:
        0 18px 38px rgba(76,29,149,.28);
      cursor: pointer;
      transform: translateY(-50%);
      transition:
        transform .18s ease,
        filter .18s ease;
    }

    .saved-products-tab:hover {
      transform:
        translateY(-50%)
        translateX(-3px);
      filter: brightness(1.07);
    }

    .saved-products-tab-icon {
      font-size: 1.25rem;
      line-height: 1;
    }

    .saved-products-tab-label {
      writing-mode: vertical-rl;
      transform: rotate(180deg);
      font-size: .66rem;
      font-weight: 950;
      letter-spacing: .04em;
      text-transform: uppercase;
    }

    .saved-products-tab-count {
      display: grid;
      place-items: center;
      min-width: 25px;
      height: 25px;
      padding: 0 5px;
      border-radius: 999px;
      background: #fff;
      color: #9d174d;
      font-size: .69rem;
      font-weight: 950;
    }

    .saved-products-backdrop {
      position: fixed;
      inset: 0;
      z-index: 10030;
      background: rgba(15,23,42,.62);
      opacity: 0;
      visibility: hidden;
      transition:
        opacity .22s ease,
        visibility .22s ease;
    }

    .saved-products-backdrop.is-open {
      opacity: 1;
      visibility: visible;
    }

    .saved-products-drawer {
      position: absolute;
      top: 0;
      right: 0;
      width: min(460px, 100%);
      height: 100%;
      display: grid;
      grid-template-rows: auto 1fr auto;
      background: #f8fafc;
      box-shadow:
        -28px 0 70px rgba(15,23,42,.24);
      transform: translateX(100%);
      transition: transform .26s ease;
    }

    .saved-products-backdrop.is-open
    .saved-products-drawer {
      transform: translateX(0);
    }

    .saved-products-head {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 14px;
      padding: 19px;
      border-bottom: 1px solid #e4e7ec;
      background: rgba(255,255,255,.96);
    }

    .saved-products-eyebrow {
      margin: 0 0 5px;
      color: #db2777;
      font-size: .69rem;
      font-weight: 950;
      text-transform: uppercase;
      letter-spacing: .08em;
    }

    .saved-products-head h2 {
      margin: 0;
      color: #101828;
      font-size: 1.35rem;
    }

    .saved-products-head p {
      margin: 6px 0 0;
      color: #667085;
      font-size: .74rem;
      line-height: 1.45;
    }

    .saved-products-close {
      width: 38px;
      height: 38px;
      flex: 0 0 38px;
      border: 1px solid #d0d5dd;
      border-radius: 50%;
      background: #fff;
      color: #344054;
      cursor: pointer;
    }

    .saved-products-content {
      overflow: auto;
      padding: 14px;
    }

    .saved-products-empty {
      display: grid;
      place-items: center;
      min-height: 300px;
      padding: 28px;
      border: 1px dashed #d0d5dd;
      border-radius: 20px;
      background: #fff;
      text-align: center;
      color: #667085;
    }

    .saved-products-empty-icon {
      display: block;
      margin-bottom: 10px;
      font-size: 2.2rem;
    }

    .saved-product-card {
      display: grid;
      grid-template-columns: auto 78px minmax(0,1fr);
      gap: 11px;
      align-items: start;
      margin-bottom: 10px;
      padding: 12px;
      border: 1px solid #e4e7ec;
      border-radius: 17px;
      background: #fff;
    }

    .saved-product-check {
      margin-top: 30px;
      width: 18px;
      height: 18px;
      accent-color: #7c3aed;
      cursor: pointer;
    }

    .saved-product-media {
      width: 78px;
      height: 78px;
      display: grid;
      place-items: center;
      overflow: hidden;
      border-radius: 15px;
      background:
        linear-gradient(
          145deg,
          #f8faff,
          #eef2ff
        );
      color: #7c3aed;
      text-decoration: none;
      font-size: 1.5rem;
    }

    .saved-product-media img {
      width: 100%;
      height: 100%;
      object-fit: contain;
      background: #fff;
    }

    .saved-product-copy {
      min-width: 0;
    }

    .saved-product-title {
      display: block;
      color: #101828;
      text-decoration: none;
      font-size: .82rem;
      font-weight: 900;
      line-height: 1.38;
    }

    .saved-product-title:hover {
      color: #5b3df5;
      text-decoration: underline;
    }

    .saved-product-price {
      display: block;
      margin-top: 6px;
      color: #101828;
      font-size: .98rem;
      font-weight: 950;
    }

    .saved-product-meta {
      margin-top: 5px;
      color: #667085;
      font-size: .68rem;
      line-height: 1.42;
    }

    .saved-product-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 7px;
      margin-top: 9px;
    }

    .saved-product-link,
    .saved-product-remove {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-height: 32px;
      padding: 0 9px;
      border-radius: 9px;
      font: inherit;
      font-size: .68rem;
      font-weight: 900;
      cursor: pointer;
    }

    .saved-product-link {
      background: #5b3df5;
      color: #fff;
      text-decoration: none;
    }

    .saved-product-remove {
      border: 1px solid #fda4af;
      background: #fff1f2;
      color: #be123c;
    }

    .saved-products-footer {
      padding: 14px;
      border-top: 1px solid #e4e7ec;
      background: #fff;
    }

    .saved-products-selection {
      margin: 0 0 9px;
      color: #667085;
      font-size: .71rem;
      line-height: 1.42;
    }

    .saved-products-message {
      margin: 0 0 9px;
      color: #b54708;
      font-size: .7rem;
      font-weight: 800;
    }

    .saved-products-footer-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }

    .saved-products-action {
      min-height: 39px;
      padding: 0 12px;
      border: 0;
      border-radius: 11px;
      font: inherit;
      font-size: .72rem;
      font-weight: 950;
      cursor: pointer;
    }

    .saved-products-action.primary {
      flex: 1;
      background: #5b3df5;
      color: #fff;
    }

    .saved-products-action.primary:disabled {
      opacity: .48;
      cursor: not-allowed;
    }

    .saved-products-action.secondary {
      border: 1px solid #d0d5dd;
      background: #fff;
      color: #475467;
    }

    @media (max-width: 720px) {
      .saved-products-tab {
        top: auto;
        right: 14px;
        bottom: 80px;
        min-width: auto;
        display: flex;
        align-items: center;
        gap: 7px;
        padding: 10px 12px;
        border-radius: 999px;
        transform: none;
      }

      .saved-products-tab:hover {
        transform: translateY(-2px);
      }

      .saved-products-tab-label {
        writing-mode: initial;
        transform: none;
      }

      .saved-product-card {
        grid-template-columns: auto 66px minmax(0,1fr);
      }

      .saved-product-media {
        width: 66px;
        height: 66px;
      }
    }

    @media (prefers-reduced-motion: reduce) {
      .saved-products-backdrop,
      .saved-products-drawer,
      .saved-products-tab,
      .save-product-button {
        transition: none;
      }
    }
  `;

  document.head.appendChild(
    style
  );
}

function savedProductKey(
  product,
  section = ""
) {
  const source =
    productMarketplace(
      product,
      section
    );

  const identifier =
    product?._identity_key ||
    product?.offer_id ||
    product?.product_id ||
    product?.id ||
    product?.affiliate_url ||
    product?.url ||
    product?.title ||
    "product";

  return (
    String(source)
      .toLowerCase()
      .trim()
    + "::"
    + String(identifier)
      .toLowerCase()
      .trim()
  );
}

function savedProductRecord(
  product,
  section = ""
) {
  const now =
    new Date().toISOString();

  return {
    key:
      savedProductKey(
        product,
        section
      ),
    section:
      section ||
      (
        productMarketplace(
          product,
          section
        ) === "AliExpress"
          ? "import"
          : "polish"
      ),
    title:
      String(
        product?.title ||
        "Produkt"
      ),
    image_url:
      String(
        product?.image_url ||
        ""
      ),
    affiliate_url:
      String(
        product?.affiliate_url ||
        ""
      ),
    url:
      String(
        product?.url ||
        ""
      ),
    current_price_pln:
      Number(
        product?.current_price_pln
      ),
    source:
      String(
        productMarketplace(
          product,
          section
        )
      ),
    _source:
      String(
        productMarketplace(
          product,
          section
        )
      ),
    rating:
      product?.rating ?? null,
    opinions_count:
      product?.opinions_count ??
      product?.opinion_count ??
      null,
    opinion_count:
      product?.opinion_count ??
      product?.opinions_count ??
      null,
    shops_count:
      product?.shops_count ?? null,
    sold_count:
      product?.sold_count ?? null,
    smart_delivery:
      Boolean(
        product?.smart_delivery
      ),
    shipping_from_poland:
      Boolean(
        product?.shipping_from_poland
      ),
    budget_status:
      String(
        product?.budget_status ||
        ""
      ),
    _rank_score:
      Number(
        product?._rank_score ||
        0
      ),
    _group_rank_score:
      Number(
        product?._group_rank_score ||
        product?._rank_score ||
        0
      ),
    _priority_matches:
      Array.isArray(
        product?._priority_matches
      )
        ? [
            ...product
              ._priority_matches
          ]
        : [],
    reasons:
      Array.isArray(
        product?.reasons
      )
        ? [
            ...product.reasons
          ]
        : [],
    _rank_reasons:
      Array.isArray(
        product?._rank_reasons
      )
        ? [
            ...product
              ._rank_reasons
          ]
        : [],
    _identity_key:
      String(
        product?._identity_key ||
        ""
      ),
    offer_id:
      String(
        product?.offer_id ||
        ""
      ),
    product_id:
      String(
        product?.product_id ||
        ""
      ),
    saved_at:
      String(
        product?.saved_at ||
        now
      ),
    checked_at:
      now
  };
}

function registerSaveableProduct(
  product,
  section = ""
) {
  const record =
    savedProductRecord(
      product,
      section
    );

  saveableProducts.set(
    record.key,
    {
      product,
      section,
      record
    }
  );

  if (
    savedProducts.has(
      record.key
    )
  ) {
    const previous =
      savedProducts.get(
        record.key
      );

    savedProducts.set(
      record.key,
      {
        ...previous,
        ...record,
        saved_at:
          previous.saved_at ||
          record.saved_at
      }
    );

    persistSavedProducts();
  }

  return record.key;
}

function saveProductButtonHtml(
  product,
  section = "",
  compact = false
) {
  const key =
    registerSaveableProduct(
      product,
      section
    );

  const isSaved =
    savedProducts.has(key);

  return `
    <button
      type="button"
      class="save-product-button ${
        compact
          ? "is-compact"
          : ""
      } ${
        isSaved
          ? "is-saved"
          : ""
      }"
      data-save-product-key="${escapeHtml(key)}"
      aria-pressed="${
        isSaved
          ? "true"
          : "false"
      }">
      <span aria-hidden="true">
        ${isSaved ? "♥" : "♡"}
      </span>

      <span>
        ${isSaved ? "Zapisano" : "Zapisz"}
      </span>
    </button>
  `;
}

function loadSavedProductsFromStorage() {
  savedProducts.clear();

  try {
    const raw =
      window.localStorage.getItem(
        SAVED_PRODUCTS_STORAGE_KEY
      );

    if (!raw) {
      return;
    }

    const parsed =
      JSON.parse(raw);

    if (!Array.isArray(parsed)) {
      return;
    }

    parsed.forEach(
      item => {
        if (
          !item ||
          typeof item !== "object" ||
          !item.key ||
          !item.title
        ) {
          return;
        }

        savedProducts.set(
          String(item.key),
          item
        );
      }
    );
  } catch (error) {
    console.warn(
      "Nie udało się odczytać zapisanych produktów.",
      error
    );
  }
}

function persistSavedProducts() {
  try {
    window.localStorage.setItem(
      SAVED_PRODUCTS_STORAGE_KEY,
      JSON.stringify(
        Array.from(
          savedProducts.values()
        )
      )
    );
  } catch (error) {
    console.warn(
      "Nie udało się zapisać schowka produktów.",
      error
    );
  }
}

function formatSavedCheckedAt(
  value
) {
  try {
    const date =
      new Date(value);

    if (
      Number.isNaN(
        date.getTime()
      )
    ) {
      return "czas nieznany";
    }

    return date.toLocaleString(
      "pl-PL",
      {
        dateStyle: "short",
        timeStyle: "short"
      }
    );
  } catch {
    return "czas nieznany";
  }
}

function refreshSaveProductButtons() {
  document
    .querySelectorAll(
      "[data-save-product-key]"
    )
    .forEach(
      button => {
        const key =
          button.dataset
            .saveProductKey ||
          "";

        const isSaved =
          savedProducts.has(key);

        button.classList.toggle(
          "is-saved",
          isSaved
        );

        button.setAttribute(
          "aria-pressed",
          isSaved
            ? "true"
            : "false"
        );

        button.innerHTML = `
          <span aria-hidden="true">
            ${isSaved ? "♥" : "♡"}
          </span>

          <span>
            ${isSaved ? "Zapisano" : "Zapisz"}
          </span>
        `;
      }
    );
}

function updateSavedProductsTab() {
  const count =
    document.getElementById(
      "savedProductsCount"
    );

  if (count) {
    count.textContent =
      String(
        savedProducts.size
      );
  }
}

function savedProductCardHtml(
  item
) {
  const targetUrl =
    productOfferUrl(item);

  const selected =
    savedComparisonSelection.has(
      item.key
    );

  const price =
    Number(
      item.current_price_pln
    );

  const image =
    item.image_url
      ? `
        <img
          src="${escapeHtml(item.image_url)}"
          alt="${escapeHtml(item.title)}"
          loading="lazy"
          referrerpolicy="no-referrer">
      `
      : "🛍️";

  return `
    <article class="saved-product-card">
      <input
        class="saved-product-check"
        type="checkbox"
        data-saved-compare-key="${escapeHtml(item.key)}"
        aria-label="Zaznacz do porównania: ${escapeHtml(item.title)}"
        ${selected ? "checked" : ""}>

      <a
        class="saved-product-media"
        href="${escapeHtml(targetUrl)}"
        target="_blank"
        rel="nofollow sponsored noopener">
        ${image}
      </a>

      <div class="saved-product-copy">
        <a
          class="saved-product-title"
          href="${escapeHtml(targetUrl)}"
          target="_blank"
          rel="nofollow sponsored noopener">
          ${escapeHtml(item.title)}
        </a>

        <span class="saved-product-price">
          ${
            Number.isFinite(price)
              ? formatPrice(price, 2)
              : "sprawdź cenę"
          }
        </span>

        <div class="saved-product-meta">
          ${escapeHtml(item.source || "Sklep")}
          · sprawdzono:
          ${escapeHtml(
            formatSavedCheckedAt(
              item.checked_at
            )
          )}
        </div>

        <div class="saved-product-actions">
          <a
            class="saved-product-link"
            href="${escapeHtml(targetUrl)}"
            target="_blank"
            rel="nofollow sponsored noopener">
            Otwórz ofertę
          </a>

          <button
            type="button"
            class="saved-product-remove"
            data-remove-saved-key="${escapeHtml(item.key)}">
            Usuń
          </button>
        </div>
      </div>
    </article>
  `;
}

function renderSavedProductsDrawer() {
  const content =
    document.getElementById(
      "savedProductsContent"
    );

  const footer =
    document.getElementById(
      "savedProductsFooter"
    );

  if (
    !content ||
    !footer
  ) {
    return;
  }

  const items =
    Array.from(
      savedProducts.values()
    ).sort(
      (a, b) =>
        String(
          b.saved_at ||
          ""
        ).localeCompare(
          String(
            a.saved_at ||
            ""
          )
        )
    );

  if (!items.length) {
    content.innerHTML = `
      <div class="saved-products-empty">
        <div>
          <span class="saved-products-empty-icon">
            ♡
          </span>

          <strong>
            Schowek jest jeszcze pusty
          </strong>

          <p>
            Kliknij „Zapisz” przy interesującym produkcie.
            Zostanie tutaj także po zamknięciu przeglądarki.
          </p>
        </div>
      </div>
    `;

    footer.innerHTML = `
      <p class="saved-products-selection">
        Produkty są przechowywane tylko w tej przeglądarce.
      </p>
    `;

    return;
  }

  content.innerHTML =
    items
      .map(
        savedProductCardHtml
      )
      .join("");

  const selectedCount =
    savedComparisonSelection
      .size;

  footer.innerHTML = `
    <p class="saved-products-selection">
      Zaznacz od 2 do 3 produktów, aby je porównać.
      Wybrano: ${selectedCount}/3.
    </p>

    ${
      savedProductsMessage
        ? `
          <p class="saved-products-message">
            ${escapeHtml(savedProductsMessage)}
          </p>
        `
        : ""
    }

    <div class="saved-products-footer-actions">
      <button
        type="button"
        class="saved-products-action secondary"
        data-clear-saved-products>
        Wyczyść schowek
      </button>

      <button
        type="button"
        class="saved-products-action primary"
        data-compare-saved-products
        ${
          selectedCount < 2
            ? "disabled"
            : ""
        }>
        Porównaj zaznaczone
      </button>
    </div>
  `;
}

function openSavedProductsDrawer() {
  const backdrop =
    document.getElementById(
      "savedProductsBackdrop"
    );

  if (!backdrop) {
    return;
  }

  savedProductsMessage =
    "";

  renderSavedProductsDrawer();

  backdrop.classList.add(
    "is-open"
  );

  backdrop.setAttribute(
    "aria-hidden",
    "false"
  );

  document.body.style.overflow =
    "hidden";

  const tab =
    document.getElementById(
      "savedProductsTab"
    );

  if (tab) {
    tab.setAttribute(
      "aria-expanded",
      "true"
    );
  }

  openAccessibleLayer(
    backdrop.querySelector(
      ".saved-products-drawer"
    ),
    tab
  );

  announceAccessibility(
    `Otwarto zapisane produkty. Liczba produktów: ${savedProducts.size}.`
  );
}

function closeSavedProductsDrawer() {
  const backdrop =
    document.getElementById(
      "savedProductsBackdrop"
    );

  if (!backdrop) {
    return;
  }

  backdrop.classList.remove(
    "is-open"
  );

  backdrop.setAttribute(
    "aria-hidden",
    "true"
  );

  const tab =
    document.getElementById(
      "savedProductsTab"
    );

  if (tab) {
    tab.setAttribute(
      "aria-expanded",
      "false"
    );
  }

  closeAccessibleLayer(
    backdrop.querySelector(
      ".saved-products-drawer"
    ),
    tab
  );

  document.body.style.overflow =
    "";
}

function toggleSavedProduct(
  key
) {
  if (!key) {
    return;
  }

  const wasSaved =
    savedProducts.has(key);

  if (wasSaved) {
    savedProducts.delete(key);
    savedComparisonSelection.delete(
      key
    );
  } else {
    const candidate =
      saveableProducts.get(key);

    if (!candidate) {
      return;
    }

    savedProducts.set(
      key,
      savedProductRecord(
        candidate.product,
        candidate.section
      )
    );
  }

  savedProductsMessage =
    "";

  persistSavedProducts();
  refreshSaveProductButtons();
  updateSavedProductsTab();
  renderSavedProductsDrawer();

  announceAccessibility(
    wasSaved
      ? "Usunięto produkt z zapisanych."
      : "Produkt został zapisany na później."
  );
}

function removeSavedProduct(
  key
) {
  savedProducts.delete(key);
  savedComparisonSelection.delete(
    key
  );

  persistSavedProducts();
  refreshSaveProductButtons();
  updateSavedProductsTab();
  renderSavedProductsDrawer();

  announceAccessibility(
    "Usunięto produkt z zapisanych."
  );
}

function toggleSavedComparison(
  key,
  checked
) {
  savedProductsMessage =
    "";

  if (!checked) {
    savedComparisonSelection.delete(
      key
    );

    renderSavedProductsDrawer();
    return;
  }

  if (
    savedComparisonSelection.size >=
    3
  ) {
    savedProductsMessage =
      "Możesz porównać maksymalnie trzy zapisane produkty.";

    renderSavedProductsDrawer();
    return;
  }

  if (
    savedProducts.has(key)
  ) {
    savedComparisonSelection.add(
      key
    );
  }

  renderSavedProductsDrawer();
}

function compareSavedProducts() {
  const records =
    Array.from(
      savedComparisonSelection
    )
      .map(
        key =>
          savedProducts.get(key)
      )
      .filter(Boolean);

  if (
    records.length < 2 ||
    records.length > 3
  ) {
    savedProductsMessage =
      "Zaznacz od dwóch do trzech produktów.";

    renderSavedProductsDrawer();
    return;
  }

  comparisonSelection.clear();

  records.forEach(
    record => {
      const product = {
        ...record,
        affiliate_url:
          record.affiliate_url ||
          record.url,
        _source:
          record._source ||
          record.source,
        source:
          record.source ||
          record._source
      };

      const section =
        record.section ||
        (
          productMarketplace(
            product,
            ""
          ) === "AliExpress"
            ? "import"
            : "polish"
        );

      const key =
        comparisonKey(
          [product],
          section
        );

      comparisonCandidates.set(
        key,
        {
          group: [
            product
          ],
          section,
          key
        }
      );

      comparisonSelection.add(
        key
      );
    }
  );

  closeSavedProductsDrawer();
  refreshComparisonButtons();
  renderComparisonTray();
  openComparisonModal();
}

function ensureSavedProductsUi() {
  let tab =
    document.getElementById(
      "savedProductsTab"
    );

  if (!tab) {
    tab =
      document.createElement(
        "button"
      );

    tab.id =
      "savedProductsTab";

    tab.type =
      "button";

    tab.className =
      "saved-products-tab";

    tab.setAttribute(
      "aria-label",
      "Otwórz zapisane produkty"
    );

    tab.innerHTML = `
      <span
        class="saved-products-tab-icon"
        aria-hidden="true">
        ♥
      </span>

      <span class="saved-products-tab-label">
        Moje zapisane
      </span>

      <span
        class="saved-products-tab-count"
        id="savedProductsCount">
        0
      </span>
    `;

    document.body.appendChild(
      tab
    );
  }

  let backdrop =
    document.getElementById(
      "savedProductsBackdrop"
    );

  if (!backdrop) {
    backdrop =
      document.createElement(
        "div"
      );

    backdrop.id =
      "savedProductsBackdrop";

    backdrop.className =
      "saved-products-backdrop";

    backdrop.setAttribute(
      "aria-hidden",
      "true"
    );

    backdrop.innerHTML = `
      <aside
        class="saved-products-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="savedProductsTitle">
        <div class="saved-products-head">
          <div>
            <p class="saved-products-eyebrow">
              Twój prywatny schowek
            </p>

            <h2 id="savedProductsTitle">
              Moje zapisane
            </h2>

            <p>
              Bez konta i bez e-maila.
              Produkty zostają w tej przeglądarce.
            </p>
          </div>

          <button
            type="button"
            class="saved-products-close"
            data-close-saved-products
            aria-label="Zamknij zapisane produkty">
            ✕
          </button>
        </div>

        <div
          class="saved-products-content"
          id="savedProductsContent">
        </div>

        <div
          class="saved-products-footer"
          id="savedProductsFooter">
        </div>
      </aside>
    `;

    document.body.appendChild(
      backdrop
    );
  }

  if (
    !document.body.dataset
      .savedProductsBound
  ) {
    document.body.dataset
      .savedProductsBound =
        "true";

    document.addEventListener(
      "click",
      event => {
        const saveButton =
          event.target.closest(
            "[data-save-product-key]"
          );

        if (saveButton) {
          toggleSavedProduct(
            saveButton.dataset
              .saveProductKey ||
            ""
          );

          return;
        }

        const removeButton =
          event.target.closest(
            "[data-remove-saved-key]"
          );

        if (removeButton) {
          removeSavedProduct(
            removeButton.dataset
              .removeSavedKey ||
            ""
          );

          return;
        }

        if (
          event.target.closest(
            "[data-close-saved-products]"
          )
        ) {
          closeSavedProductsDrawer();
          return;
        }

        if (
          event.target.closest(
            "[data-clear-saved-products]"
          )
        ) {
          const confirmed =
            window.confirm(
              "Usunąć wszystkie zapisane produkty?"
            );

          if (confirmed) {
            savedProducts.clear();
            savedComparisonSelection.clear();
            persistSavedProducts();
            refreshSaveProductButtons();
            updateSavedProductsTab();
            renderSavedProductsDrawer();
          }

          return;
        }

        if (
          event.target.closest(
            "[data-compare-saved-products]"
          )
        ) {
          compareSavedProducts();
        }
      }
    );

    document.addEventListener(
      "change",
      event => {
        const checkbox =
          event.target.closest(
            "[data-saved-compare-key]"
          );

        if (!checkbox) {
          return;
        }

        toggleSavedComparison(
          checkbox.dataset
            .savedCompareKey ||
          "",
          checkbox.checked
        );
      }
    );

    tab.addEventListener(
      "click",
      openSavedProductsDrawer
    );

    backdrop.addEventListener(
      "click",
      event => {
        if (
          event.target === backdrop
        ) {
          closeSavedProductsDrawer();
        }
      }
    );

    document.addEventListener(
      "keydown",
      event => {
        if (
          event.key === "Escape" &&
          backdrop.classList
            .contains("is-open")
        ) {
          closeSavedProductsDrawer();
        }
      }
    );
  }

  updateSavedProductsTab();
  renderSavedProductsDrawer();

  return tab;
}


function injectAccessibilityMobileStyles() {
  if (
    document.getElementById(
      "miboyAccessibilityMobileStyles"
    )
  ) {
    return;
  }

  const style =
    document.createElement(
      "style"
    );

  style.id =
    "miboyAccessibilityMobileStyles";

  style.textContent = `
    html {
      scroll-behavior: smooth;
      scroll-padding-top: 18px;
    }

    body {
      overflow-x: hidden;
    }

    button,
    a,
    input,
    select,
    textarea {
      touch-action: manipulation;
    }

    :where(
      a,
      button,
      input,
      select,
      textarea,
      [tabindex]
    ):focus-visible {
      outline: 4px solid rgba(99,102,241,.32);
      outline-offset: 3px;
      border-radius: 8px;
    }

    .a11y-skip-link {
      position: fixed;
      top: 10px;
      left: 50%;
      z-index: 11000;
      padding: 11px 15px;
      border-radius: 12px;
      background: #111827;
      color: #fff;
      font-size: .8rem;
      font-weight: 950;
      text-decoration: none;
      box-shadow: 0 12px 30px rgba(15,23,42,.3);
      transform: translate(-50%, -160%);
      transition: transform .18s ease;
    }

    .a11y-skip-link:focus {
      transform: translate(-50%, 0);
    }

    .sr-only {
      position: absolute !important;
      width: 1px !important;
      height: 1px !important;
      padding: 0 !important;
      margin: -1px !important;
      overflow: hidden !important;
      clip: rect(0, 0, 0, 0) !important;
      white-space: nowrap !important;
      border: 0 !important;
    }

    .mobile-results-jump {
      display: none;
      width: fit-content;
      min-height: 42px;
      margin: 10px 0 0;
      padding: 0 12px;
      align-items: center;
      justify-content: center;
      gap: 7px;
      border: 1px solid rgba(99,102,241,.22);
      border-radius: 11px;
      background: #fff;
      color: #4f46e5;
      font-size: .74rem;
      font-weight: 900;
      text-decoration: none;
    }

    .accessibility-layer-open {
      overscroll-behavior: contain;
    }

    .search-row input,
    .supplementary-search-input,
    .result-control-button,
    .product-link,
    .comparison-offer-link,
    .smart-pick-link,
    .offer-secondary-link,
    .offer-inline-link,
    .budget-upgrade-link,
    .final-decision-action,
    .final-decision-preview-button,
    .compare-toggle-button,
    .save-product-button {
      min-height: 44px;
    }

    @media (max-width: 820px) {
      .mobile-results-jump {
        display: inline-flex;
      }

      .search-row {
        display: grid !important;
        grid-template-columns: 1fr !important;
        gap: 10px !important;
      }

      .search-row input,
      .search-row button,
      #searchInput {
        width: 100% !important;
        min-height: 50px !important;
        box-sizing: border-box;
      }

      .supplementary-search {
        grid-template-columns: 1fr !important;
        padding: 14px !important;
      }

      .supplementary-search-input {
        min-height: 50px !important;
        font-size: 16px !important;
      }

      .quick-priorities {
        gap: 8px !important;
      }

      .quick-priority-button {
        min-height: 42px !important;
        padding: 0 12px !important;
        font-size: .75rem !important;
      }

      .result-controls {
        align-items: stretch !important;
      }

      .result-control-group {
        width: 100%;
        overflow-x: auto;
        padding-bottom: 5px;
        flex-wrap: nowrap !important;
        scrollbar-width: thin;
      }

      .result-control-button {
        flex: 0 0 auto;
        white-space: nowrap;
      }

      .product-card,
      .comparison-card,
      .smart-pick-card,
      .advisor-option,
      .budget-upgrade-card {
        min-width: 0;
      }

      .product-bottom,
      .offer-inline-links,
      .smart-pick-actions,
      .advisor-option-actions,
      .budget-upgrade-actions,
      .final-decision-actions,
      .compare-tray-actions,
      .saved-products-footer-actions {
        align-items: stretch !important;
      }

      .product-bottom {
        display: grid !important;
        grid-template-columns: 1fr !important;
        gap: 10px !important;
      }

      .product-link,
      .comparison-offer-link,
      .smart-pick-link,
      .offer-secondary-link,
      .offer-inline-link,
      .budget-upgrade-link,
      .final-decision-action,
      .final-decision-preview-button,
      .compare-toggle-button,
      .save-product-button {
        justify-content: center !important;
        text-align: center;
      }

      .comparison-offer {
        grid-template-columns: 1fr !important;
        gap: 8px !important;
      }

      .comparison-offer-link {
        width: 100%;
        box-sizing: border-box;
      }

      .compare-tray {
        left: 0 !important;
        right: 0 !important;
        bottom: 0 !important;
        width: 100% !important;
        max-width: none !important;
        transform: none !important;
        border-radius: 20px 20px 0 0 !important;
        padding-bottom:
          calc(
            13px +
            env(safe-area-inset-bottom)
          ) !important;
      }

      .compare-tray-items {
        max-height: 112px;
        overflow: auto;
      }

      .compare-modal-backdrop,
      .final-decision-backdrop {
        align-items: end !important;
        padding: 0 !important;
      }

      .compare-modal,
      .final-decision-modal {
        width: 100% !important;
        max-height: 94vh !important;
        border-radius: 22px 22px 0 0 !important;
        padding-bottom:
          env(safe-area-inset-bottom);
      }

      .saved-products-drawer {
        width: 100% !important;
      }

      .saved-product-card {
        grid-template-columns:
          auto
          66px
          minmax(0, 1fr) !important;
      }

      .back-to-top-button {
        bottom:
          calc(
            14px +
            env(safe-area-inset-bottom)
          ) !important;
      }

      .saved-products-tab {
        bottom:
          calc(
            78px +
            env(safe-area-inset-bottom)
          ) !important;
      }
    }

    @media (max-width: 520px) {
      .product-card {
        border-radius: 18px !important;
      }

      .product-body {
        padding: 15px !important;
      }

      .product-body h3,
      .comparison-card h3 {
        font-size: 1rem !important;
        line-height: 1.4 !important;
      }

      .product-price {
        font-size: 1.18rem !important;
      }

      .advisor-option-name-top,
      .final-decision-preview {
        flex-direction: column !important;
      }

      .advisor-option-media {
        width: 82px !important;
        height: 82px !important;
        flex-basis: 82px !important;
      }

      .saved-product-card {
        grid-template-columns:
          auto
          minmax(0, 1fr) !important;
      }

      .saved-product-media {
        grid-column: 2;
        width: 76px !important;
        height: 76px !important;
      }

      .saved-product-copy {
        grid-column: 1 / -1;
      }

      .saved-product-check {
        margin-top: 28px !important;
      }

      .saved-product-actions {
        display: grid !important;
        grid-template-columns: 1fr 1fr;
      }

      .saved-product-link,
      .saved-product-remove {
        min-height: 42px !important;
      }

      .final-decision-actions,
      .budget-upgrade-actions,
      .advisor-option-actions,
      .smart-pick-actions {
        display: grid !important;
        grid-template-columns: 1fr !important;
      }
    }

    @media (prefers-reduced-motion: reduce) {
      html {
        scroll-behavior: auto;
      }

      *,
      *::before,
      *::after {
        animation-duration: .01ms !important;
        animation-iteration-count: 1 !important;
        transition-duration: .01ms !important;
      }
    }
  `;

  document.head.appendChild(
    style
  );
}

function ensureAccessibilityUi() {
  let skipLink =
    document.getElementById(
      "smartSkipToResults"
    );

  if (!skipLink) {
    skipLink =
      document.createElement(
        "a"
      );

    skipLink.id =
      "smartSkipToResults";

    skipLink.className =
      "a11y-skip-link";

    const resultsTargetId =
      resultsTitle?.id ||
      "smartResultsTitle";

    if (
      resultsTitle &&
      !resultsTitle.id
    ) {
      resultsTitle.id =
        resultsTargetId;
    }

    skipLink.href =
      `#${resultsTargetId}`;

    skipLink.textContent =
      "Przejdź do wyników";

    document.body.insertBefore(
      skipLink,
      document.body.firstChild
    );
  }

  let liveRegion =
    document.getElementById(
      "smartAccessibilityLive"
    );

  if (!liveRegion) {
    liveRegion =
      document.createElement(
        "div"
      );

    liveRegion.id =
      "smartAccessibilityLive";

    liveRegion.className =
      "sr-only";

    liveRegion.setAttribute(
      "role",
      "status"
    );

    liveRegion.setAttribute(
      "aria-live",
      "polite"
    );

    liveRegion.setAttribute(
      "aria-atomic",
      "true"
    );

    document.body.appendChild(
      liveRegion
    );
  }

  if (
    resultsInfo &&
    !document.getElementById(
      "mobileResultsJump"
    )
  ) {
    const jump =
      document.createElement(
        "a"
      );

    jump.id =
      "mobileResultsJump";

    jump.className =
      "mobile-results-jump";

    const resultsTargetId =
      resultsTitle?.id ||
      "smartResultsTitle";

    jump.href =
      `#${resultsTargetId}`;

    jump.hidden =
      true;

    jump.innerHTML =
      "↓ Przejdź do wyników";

    resultsInfo.insertAdjacentElement(
      "afterend",
      jump
    );
  }

  return {
    skipLink,
    liveRegion
  };
}

function enhanceExistingAccessibility() {
  ensureAccessibilityUi();

  if (resultsTitle) {
    if (!resultsTitle.id) {
      resultsTitle.id =
        "smartResultsTitle";
    }

    resultsTitle.tabIndex =
      -1;
  }

  if (results) {
    results.setAttribute(
      "role",
      "region"
    );

    results.setAttribute(
      "aria-labelledby",
      resultsTitle?.id ||
      "smartResultsTitle"
    );

    results.setAttribute(
      "aria-busy",
      "false"
    );
  }

  if (resultsInfo) {
    resultsInfo.setAttribute(
      "aria-live",
      "polite"
    );

    resultsInfo.setAttribute(
      "aria-atomic",
      "true"
    );
  }

  if (emptyState) {
    emptyState.setAttribute(
      "role",
      "status"
    );
  }

  if (form) {
    form.setAttribute(
      "aria-describedby",
      "smartSearchHelp"
    );

    if (
      !document.getElementById(
        "smartSearchHelp"
      )
    ) {
      const help =
        document.createElement(
          "span"
        );

      help.id =
        "smartSearchHelp";

      help.className =
        "sr-only";

      help.textContent =
        "Wpisz produkt i budżet. Dodatkowe wymagania są opcjonalne.";

      form.appendChild(
        help
      );
    }
  }

  const loader =
    document.getElementById(
      "smartSearchLoader"
    );

  if (loader) {
    loader.setAttribute(
      "role",
      "status"
    );

    loader.setAttribute(
      "aria-live",
      "polite"
    );

    loader.setAttribute(
      "aria-atomic",
      "true"
    );
  }

  const savedTab =
    document.getElementById(
      "savedProductsTab"
    );

  if (savedTab) {
    savedTab.setAttribute(
      "aria-controls",
      "savedProductsBackdrop"
    );

    savedTab.setAttribute(
      "aria-expanded",
      "false"
    );
  }

  const backToTop =
    document.getElementById(
      "backToTopButton"
    );

  if (backToTop) {
    backToTop.setAttribute(
      "aria-describedby",
      "backToTopDescription"
    );

    if (
      !document.getElementById(
        "backToTopDescription"
      )
    ) {
      const description =
        document.createElement(
          "span"
        );

      description.id =
        "backToTopDescription";

      description.className =
        "sr-only";

      description.textContent =
        "Przenosi na początek strony.";

      document.body.appendChild(
        description
      );
    }
  }
}

function announceAccessibility(
  message
) {
  const liveRegion =
    document.getElementById(
      "smartAccessibilityLive"
    );

  if (!liveRegion) {
    return;
  }

  liveRegion.textContent =
    "";

  window.setTimeout(
    () => {
      liveRegion.textContent =
        String(message || "");
    },
    20
  );
}

function accessibilityFocusableElements(
  container
) {
  if (!container) {
    return [];
  }

  return Array.from(
    container.querySelectorAll(
      [
        "a[href]",
        "button:not([disabled])",
        "input:not([disabled])",
        "select:not([disabled])",
        "textarea:not([disabled])",
        "[tabindex]:not([tabindex='-1'])"
      ].join(",")
    )
  ).filter(
    element => {
      const style =
        window.getComputedStyle(
          element
        );

      return (
        style.display !== "none" &&
        style.visibility !== "hidden"
      );
    }
  );
}

function openAccessibleLayer(
  container,
  trigger = null
) {
  if (!container) {
    return;
  }

  const active =
    trigger ||
    document.activeElement;

  if (
    active &&
    typeof active.focus ===
      "function"
  ) {
    accessibilityFocusMemory.set(
      container,
      active
    );
  }

  activeAccessibilityLayer =
    container;

  container.dataset
    .accessibilityOpen =
      "true";

  container.classList.add(
    "accessibility-layer-open"
  );

  const focusable =
    accessibilityFocusableElements(
      container
    );

  const target =
    focusable[0] ||
    container;

  if (
    !container.hasAttribute(
      "tabindex"
    )
  ) {
    container.tabIndex =
      -1;
  }

  window.requestAnimationFrame(
    () => {
      target.focus({
        preventScroll: true
      });
    }
  );
}

function closeAccessibleLayer(
  container,
  fallback = null
) {
  if (!container) {
    return;
  }

  container.dataset
    .accessibilityOpen =
      "false";

  container.classList.remove(
    "accessibility-layer-open"
  );

  if (
    activeAccessibilityLayer ===
    container
  ) {
    activeAccessibilityLayer =
      null;
  }

  const previous =
    accessibilityFocusMemory.get(
      container
    ) ||
    fallback;

  accessibilityFocusMemory.delete(
    container
  );

  if (
    previous &&
    typeof previous.focus ===
      "function"
  ) {
    window.requestAnimationFrame(
      () => {
        previous.focus({
          preventScroll: true
        });
      }
    );
  }
}

function enhanceRenderedAccessibility(
  query,
  visibleCount
) {
  enhanceExistingAccessibility();

  const mobileJump =
    document.getElementById(
      "mobileResultsJump"
    );

  if (mobileJump) {
    mobileJump.hidden =
      false;
  }

  document
    .querySelectorAll(
      "a[target='_blank']"
    )
    .forEach(
      link => {
        if (
          !link.getAttribute(
            "aria-label"
          )
        ) {
          const label =
            String(
              link.textContent ||
              "Otwórz ofertę"
            )
              .replace(
                /\s+/g,
                " "
              )
              .trim();

          link.setAttribute(
            "aria-label",
            `${label} — otwiera nową kartę`
          );
        }
      }
    );

  document
    .querySelectorAll(
      ".product-card, .comparison-card"
    )
    .forEach(
      card => {
        if (
          !card.hasAttribute(
            "tabindex"
          )
        ) {
          card.tabIndex =
            0;
        }
      }
    );

  announceAccessibility(
    visibleCount > 0
      ? (
          `Wyniki gotowe. Znaleziono ${visibleCount} ` +
          `propozycji dla zapytania ${query}.`
        )
      : (
          `Brak widocznych propozycji dla zapytania ${query}.`
        )
  );
}

document.addEventListener(
  "keydown",
  event => {
    if (
      event.key !== "Tab" ||
      !activeAccessibilityLayer
    ) {
      return;
    }

    const focusable =
      accessibilityFocusableElements(
        activeAccessibilityLayer
      );

    if (!focusable.length) {
      event.preventDefault();
      activeAccessibilityLayer.focus();
      return;
    }

    const first =
      focusable[0];

    const last =
      focusable[
        focusable.length - 1
      ];

    if (
      event.shiftKey &&
      document.activeElement ===
        first
    ) {
      event.preventDefault();
      last.focus();
    } else if (
      !event.shiftKey &&
      document.activeElement ===
        last
    ) {
      event.preventDefault();
      first.focus();
    }
  }
);


function injectStage6NStyles() {
  if (
    document.getElementById(
      "miboyStage6NStyles"
    )
  ) {
    return;
  }

  const style =
    document.createElement(
      "style"
    );

  style.id =
    "miboyStage6NStyles";

  style.textContent = `
    .advisor-option {
      grid-template-columns:
        minmax(260px, .95fr)
        minmax(0, 2.05fr);
      gap: 12px;
      align-items: start;
      padding: 12px;
    }

    .advisor-option-name {
      display: grid;
      gap: 7px;
      align-content: start;
    }

    .advisor-option-name-top {
      gap: 10px;
      align-items: center;
    }

    .advisor-option-media {
      width: 58px;
      height: 58px;
      flex-basis: 58px;
      border-radius: 13px;
    }

    .advisor-option-copy {
      display: grid;
      grid-template-columns:
        minmax(0, 1fr)
        auto;
      gap: 2px 8px;
      align-items: start;
      width: 100%;
    }

    .advisor-option-label {
      grid-column: 1 / -1;
      min-height: 24px;
      padding: 0 7px;
      font-size: .63rem;
    }

    .advisor-option-name h4 {
      grid-column: 1;
      margin: 3px 0 0;
      min-width: 0;
      font-size: .88rem;
      line-height: 1.32;
    }

    .advisor-title-link {
      display: -webkit-box;
      overflow: hidden;
      -webkit-box-orient: vertical;
      -webkit-line-clamp: 2;
      line-clamp: 2;
    }

    .advisor-option-price {
      grid-column: 2;
      grid-row: 2;
      margin-top: 5px;
      white-space: nowrap;
      font-size: .75rem;
    }

    .advisor-option-actions {
      margin-top: 1px;
      gap: 6px;
    }

    .advisor-option-actions
    .offer-secondary-link,
    .advisor-option-actions
    .save-product-button {
      min-height: 34px;
      padding: 0 8px;
      font-size: .65rem;
    }

    .advisor-option-body {
      gap: 8px;
    }

    .advisor-point {
      min-height: 0;
      padding: 9px 10px;
      border-radius: 12px;
    }

    .advisor-point-title {
      margin-bottom: 4px;
      font-size: .64rem;
    }

    .advisor-point p {
      display: -webkit-box;
      overflow: hidden;
      -webkit-box-orient: vertical;
      -webkit-line-clamp: 2;
      line-clamp: 2;
      font-size: .72rem;
      line-height: 1.4;
    }

    .import-empty-note {
      display: grid;
      grid-template-columns:
        auto
        minmax(0, 1fr);
      gap: 13px;
      align-items: start;
      margin: 18px 0 6px;
      padding: 17px 18px;
      border: 1px solid #fedf89;
      border-radius: 17px;
      background:
        linear-gradient(
          145deg,
          #fffaeb,
          #fffdf5
        );
      color: #7a2e0e;
    }

    .import-empty-note-icon {
      display: grid;
      place-items: center;
      width: 40px;
      height: 40px;
      border-radius: 13px;
      background: #fff;
      font-size: 1.25rem;
      box-shadow:
        0 8px 20px rgba(122,46,14,.08);
    }

    .import-empty-note h3 {
      margin: 0 0 5px;
      color: #93370d;
      font-size: .96rem;
    }

    .import-empty-note p {
      margin: 0;
      color: #854a0e;
      font-size: .76rem;
      line-height: 1.5;
    }

    @media (max-width: 1080px) {
      .advisor-option {
        grid-template-columns:
          minmax(220px, .9fr)
          minmax(0, 2.1fr);
      }
    }

    @media (max-width: 900px) {
      .advisor-option {
        grid-template-columns: 1fr;
      }

      .advisor-option-body {
        grid-template-columns: 1fr;
      }

      .advisor-point p {
        display: block;
        overflow: visible;
        -webkit-line-clamp: unset;
        line-clamp: unset;
      }
    }

    @media (max-width: 520px) {
      .advisor-option-name-top {
        flex-direction: row !important;
        align-items: center !important;
      }

      .advisor-option-media {
        width: 58px !important;
        height: 58px !important;
        flex-basis: 58px !important;
      }

      .advisor-option-actions {
        grid-template-columns:
          1fr
          1fr !important;
      }

      .advisor-option-actions
      .save-product-button {
        grid-column: 1 / -1;
      }

      .import-empty-note {
        grid-template-columns: 1fr;
      }
    }
  `;

  document.head.appendChild(
    style
  );
}


function injectStage6OStyles() {
  if (
    document.getElementById(
      "miboyStage6OStyles"
    )
  ) {
    return;
  }

  const style =
    document.createElement(
      "style"
    );

  style.id =
    "miboyStage6OStyles";

  style.textContent = `
    .query-agent-note {
      display: flex;
      align-items: flex-start;
      gap: 8px;
      margin: 10px 0 0;
      padding: 9px 10px;
      border: 1px solid rgba(99,102,241,.18);
      border-radius: 11px;
      background: rgba(99,102,241,.06);
      color: #4338ca;
      font-size: .7rem;
      line-height: 1.45;
    }

    .query-agent-note strong {
      color: #312e81;
    }

    .query-agent-note-code {
      font-weight: 850;
      overflow-wrap: anywhere;
    }

    @media (max-width: 520px) {
      .query-agent-note {
        font-size: .68rem;
      }
    }
  `;

  document.head.appendChild(
    style
  );
}


function injectStage6PStyles() {
  if (
    document.getElementById(
      "miboyStage6PStyles"
    )
  ) {
    return;
  }

  const style =
    document.createElement(
      "style"
    );

  style.id =
    "miboyStage6PStyles";

  style.textContent = `
    .search-loader {
      scroll-margin-top: 86px;
    }

    .search-loader-time {
      min-width: 148px;
      text-align: center;
      font-variant-numeric: tabular-nums;
    }

    .search-loader-progress {
      position: relative;
      overflow: hidden;
      transition: width .32s ease;
    }

    .search-loader-progress::after {
      content: "";
      position: absolute;
      inset: 0;
      width: 34%;
      background:
        linear-gradient(
          90deg,
          transparent,
          rgba(255,255,255,.48),
          transparent
        );
      animation:
        miboyRealProgressShine
        1.35s
        linear
        infinite;
    }

    .search-loader-step {
      transition:
        border-color .2s ease,
        background .2s ease,
        color .2s ease,
        transform .2s ease;
    }

    .search-loader-step.is-current {
      border-color: rgba(124,58,237,.42);
      background: rgba(124,58,237,.13);
      color: #312e81;
      transform: translateY(-2px);
      box-shadow:
        0 8px 18px rgba(79,70,229,.10);
    }

    .search-loader-step.is-complete {
      border-color: rgba(34,197,94,.24);
      background: rgba(34,197,94,.08);
      color: #166534;
    }

    .search-loader-stage-status {
      margin-top: 9px;
      color: #667085;
      font-size: .72rem;
      line-height: 1.42;
    }

    .query-agent-note {
      display: grid;
      grid-template-columns:
        44px
        minmax(0, 1fr);
      align-items: center;
    }

    .query-agent-visual {
      width: 44px;
      height: 44px;
      display: grid;
      place-items: center;
      overflow: hidden;
      border-radius: 13px;
      background: #fff;
      color: #4338ca;
      font-size: 1.35rem;
      box-shadow:
        0 6px 18px rgba(49,46,129,.10);
    }

    .query-agent-visual img {
      width: 100%;
      height: 100%;
      object-fit: contain;
      background: #fff;
    }

    @keyframes miboyRealProgressShine {
      from {
        transform: translateX(-140%);
      }

      to {
        transform: translateX(360%);
      }
    }

    @media (max-width: 620px) {
      .search-loader-head {
        align-items: flex-start;
      }

      .search-loader-time {
        min-width: 0;
      }

      .query-agent-note {
        grid-template-columns:
          38px
          minmax(0, 1fr);
      }

      .query-agent-visual {
        width: 38px;
        height: 38px;
      }
    }
  `;

  document.head.appendChild(
    style
  );
}


function injectStage6QStyles() {
  if (
    document.getElementById(
      "miboyStage6QStyles"
    )
  ) {
    return;
  }

  const style =
    document.createElement(
      "style"
    );

  style.id =
    "miboyStage6QStyles";

  style.textContent = `
    .search-loader-live-note {
      display: flex;
      align-items: flex-start;
      gap: 8px;
      margin: 11px 0 0;
      padding: 10px 11px;
      border: 1px solid rgba(99,102,241,.17);
      border-radius: 12px;
      background: rgba(255,255,255,.72);
      color: #475467;
      font-size: .72rem;
      line-height: 1.48;
    }

    .search-loader-live-note strong {
      color: #312e81;
    }

    .live-background-note {
      display: grid;
      grid-template-columns:
        auto
        minmax(0, 1fr);
      gap: 11px;
      align-items: start;
      margin: 14px 0;
      padding: 13px 14px;
      border: 1px solid #c7d7fe;
      border-radius: 15px;
      background:
        linear-gradient(
          145deg,
          #eef4ff,
          #f8faff
        );
      color: #344054;
    }

    .live-background-note-icon {
      display: grid;
      place-items: center;
      width: 36px;
      height: 36px;
      border-radius: 11px;
      background: #fff;
      font-size: 1.1rem;
      box-shadow:
        0 6px 16px rgba(49,46,129,.09);
    }

    .live-background-note strong {
      display: block;
      margin-bottom: 3px;
      color: #3538cd;
      font-size: .78rem;
    }

    .live-background-note p {
      margin: 0;
      font-size: .72rem;
      line-height: 1.48;
    }

    .smart-pick-product-row {
      display: grid;
      grid-template-columns:
        66px
        minmax(0, 1fr);
      gap: 11px;
      align-items: start;
      margin-top: 9px;
    }

    .smart-pick-media {
      width: 66px;
      height: 66px;
      display: grid;
      place-items: center;
      overflow: hidden;
      border: 1px solid rgba(148,163,184,.16);
      border-radius: 15px;
      background:
        linear-gradient(
          145deg,
          #f8faff,
          #eef2ff
        );
      color: #4f46e5;
      text-decoration: none;
      font-size: 1.55rem;
    }

    .smart-pick-media img {
      width: 100%;
      height: 100%;
      object-fit: contain;
      background: #fff;
    }

    .smart-pick-product-copy {
      min-width: 0;
    }

    .smart-pick-product-copy h4 {
      margin: 0;
    }

    .smart-pick-title-link {
      display: -webkit-box;
      overflow: hidden;
      -webkit-box-orient: vertical;
      -webkit-line-clamp: 3;
      line-clamp: 3;
    }

    .smart-pick-reason {
      margin-top: 7px !important;
    }

    .partial-results-empty {
      margin: 15px 0;
      padding: 18px;
      border: 1px dashed #a4bcfd;
      border-radius: 16px;
      background: #f5f8ff;
      color: #344054;
      text-align: center;
      font-size: .78rem;
      line-height: 1.55;
    }

    @media (max-width: 520px) {
      .smart-pick-product-row {
        grid-template-columns:
          58px
          minmax(0, 1fr);
      }

      .smart-pick-media {
        width: 58px;
        height: 58px;
      }
    }
  `;

  document.head.appendChild(
    style
  );
}


function injectStage6RStyles() {
  if (
    document.getElementById(
      "miboyStage6RStyles"
    )
  ) {
    return;
  }

  const style =
    document.createElement(
      "style"
    );

  style.id =
    "miboyStage6RStyles";

  style.textContent = `
    .progressive-stage-banner {
      display: grid;
      grid-template-columns:
        42px
        minmax(0, 1fr);
      gap: 11px;
      align-items: center;
      margin: 14px 0 18px;
      padding: 13px 14px;
      border: 1px solid #c7d7fe;
      border-radius: 15px;
      background:
        linear-gradient(
          145deg,
          #eef4ff,
          #f8faff
        );
      color: #344054;
    }

    .progressive-stage-icon {
      width: 42px;
      height: 42px;
      display: grid;
      place-items: center;
      border-radius: 12px;
      background: #fff;
      font-size: 1.2rem;
      box-shadow:
        0 7px 18px rgba(49,46,129,.09);
    }

    .progressive-stage-banner strong {
      display: block;
      margin-bottom: 3px;
      color: #3538cd;
      font-size: .8rem;
    }

    .progressive-stage-banner p {
      margin: 0;
      color: #475467;
      font-size: .73rem;
      line-height: 1.5;
    }

    .progressive-store-section {
      margin-top: 28px;
    }

    .progressive-store-heading {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      margin-bottom: 12px;
      padding: 0 3px;
    }

    .progressive-store-heading h3 {
      margin: 0;
      color: #101828;
      font-size: clamp(
        1.55rem,
        3vw,
        2.25rem
      );
      letter-spacing: -.035em;
    }

    .progressive-store-heading p {
      margin: 4px 0 0;
      color: #667085;
      font-size: .8rem;
    }

    .progressive-store-count {
      flex: 0 0 auto;
      padding: 7px 10px;
      border: 1px solid #e4e7ec;
      border-radius: 999px;
      background: #fff;
      color: #475467;
      font-size: .72rem;
      font-weight: 850;
    }

    .progressive-source-empty {
      padding: 15px;
      border: 1px dashed #d0d5dd;
      border-radius: 14px;
      background: #fff;
      color: #667085;
      font-size: .76rem;
      line-height: 1.5;
    }

    .source-health-badge.is-queued {
      background: #f2f4f7;
      color: #667085;
    }

    .source-health-badge.is-searching {
      background: #eef4ff;
      color: #3538cd;
    }

    .source-health-badge.is-searching
    .source-health-dot {
      animation:
        miboySourcePulse
        1.2s
        ease-in-out
        infinite;
    }

    @keyframes miboySourcePulse {
      50% {
        opacity: .35;
        transform: scale(.72);
      }
    }

    .progressive-source-waiting {
      display: flex;
      align-items: center;
      gap: 9px;
      padding: 14px;
      border: 1px dashed #a4bcfd;
      border-radius: 14px;
      background: #f5f8ff;
      color: #344054;
      font-size: .76rem;
    }

    .progressive-source-waiting::before {
      content: "";
      width: 15px;
      height: 15px;
      flex: 0 0 auto;
      border: 2px solid #c7d7fe;
      border-top-color: #4f46e5;
      border-radius: 50%;
      animation:
        miboyProgressiveSpin
        .9s
        linear
        infinite;
    }

    .search-loader-live-note {
      border-color: rgba(16,185,129,.18);
      background: rgba(236,253,245,.72);
    }

    @keyframes miboyProgressiveSpin {
      to {
        transform: rotate(360deg);
      }
    }

    @media (max-width: 620px) {
      .progressive-store-heading {
        align-items: flex-start;
        flex-direction: column;
        gap: 7px;
      }
    }
  `;

  document.head.appendChild(
    style
  );
}


function injectStage6SStyles() {
  if (
    document.getElementById(
      "miboyStage6SStyles"
    )
  ) {
    return;
  }

  const style =
    document.createElement(
      "style"
    );

  style.id =
    "miboyStage6SStyles";

  style.textContent = `
    .product-grid >
    .progressive-store-section,
    .product-grid >
    .progressive-stage-banner,
    .product-grid >
    .amazon-search-card {
      grid-column: 1 / -1;
      width: 100%;
    }

    .progressive-store-section {
      margin-top: 30px;
    }

    .amazon-search-card {
      display: grid;
      grid-template-columns:
        86px
        minmax(0, 1fr)
        auto;
      gap: 17px;
      align-items: center;
      margin: 0 0 24px;
      padding: 19px;
      border: 1px solid #f5d48a;
      border-radius: 19px;
      background:
        linear-gradient(
          145deg,
          #fffdf7,
          #fff7df
        );
      box-shadow:
        0 12px 32px rgba(146,86,0,.07);
    }

    .amazon-search-visual {
      width: 86px;
      height: 86px;
      display: grid;
      place-items: center;
      border-radius: 19px;
      background: #fff;
      font-size: 2.1rem;
      box-shadow:
        0 8px 22px rgba(146,86,0,.10);
    }

    .amazon-search-copy {
      min-width: 0;
    }

    .amazon-search-eyebrow {
      display: inline-flex;
      margin-bottom: 7px;
      padding: 5px 8px;
      border-radius: 999px;
      background: #fff3c4;
      color: #7a4a00;
      font-size: .67rem;
      font-weight: 900;
      text-transform: uppercase;
      letter-spacing: .055em;
    }

    .amazon-search-copy h4 {
      margin: 0;
      color: #101828;
      font-size: 1.05rem;
      line-height: 1.28;
    }

    .amazon-search-copy p {
      margin: 7px 0 0;
      color: #667085;
      font-size: .76rem;
      line-height: 1.52;
    }

    .amazon-search-disclosure {
      margin-top: 9px !important;
      color: #7a4a00 !important;
      font-size: .68rem !important;
      font-weight: 750;
    }

    .amazon-search-action {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-height: 48px;
      padding: 0 18px;
      border-radius: 13px;
      background: #ffca28;
      color: #111827;
      text-decoration: none;
      font-size: .78rem;
      font-weight: 900;
      white-space: nowrap;
      box-shadow:
        0 9px 20px rgba(180,112,0,.16);
      transition:
        transform .18s ease,
        box-shadow .18s ease;
    }

    .amazon-search-action:hover {
      transform: translateY(-2px);
      box-shadow:
        0 13px 25px rgba(180,112,0,.20);
    }

    .amazon-tracking-note {
      display: block;
      margin-top: 5px;
      color: #98a2b3;
      font-size: .62rem;
    }

    @media (max-width: 760px) {
      .amazon-search-card {
        grid-template-columns:
          66px
          minmax(0, 1fr);
      }

      .amazon-search-visual {
        width: 66px;
        height: 66px;
      }

      .amazon-search-action {
        grid-column: 1 / -1;
        width: 100%;
      }
    }
  `;

  document.head.appendChild(
    style
  );
}


function injectStage6VStyles() {
  if (
    document.getElementById(
      "miboyStage6VStyles"
    )
  ) {
    return;
  }

  const style =
    document.createElement(
      "style"
    );

  style.id =
    "miboyStage6VStyles";

  style.textContent = `
    .product-source {
      display: inline-flex;
      align-items: center;
      min-height: 28px;
      margin-left: 7px;
      padding: 0 10px;
      border-radius: 999px;
      background: #eef4ff;
      color: #3538cd;
      font-size: .84rem;
      font-weight: 950;
      line-height: 1;
    }

    .smart-pick-source {
      display: inline-flex;
      align-items: center;
      min-height: 29px;
      margin-top: 7px;
      padding: 0 10px;
      border-radius: 999px;
      background: #eef4ff;
      color: #3538cd;
      font-size: .82rem;
      font-weight: 950;
      line-height: 1;
    }

    .budget-upgrade-fact:first-child {
      min-height: 32px;
      padding: 0 11px;
      background: #eef4ff;
      color: #3538cd;
      font-size: .82rem;
      font-weight: 950;
    }

    .product-tags span:first-child {
      background: #eef4ff;
      color: #3538cd;
      font-size: .78rem;
      font-weight: 950;
    }

    .progressive-store-count {
      font-size: .78rem;
      font-weight: 950;
    }
  `;

  document.head.appendChild(
    style
  );
}


function injectStage6WStyles() {
  if (
    document.getElementById(
      "miboyStage6WStyles"
    )
  ) {
    return;
  }

  const style =
    document.createElement(
      "style"
    );

  style.id =
    "miboyStage6WStyles";

  style.textContent = `
    .debug-results-panel {
      grid-column: 1 / -1;
      margin: 18px 0 24px;
      padding: 18px;
      border: 1px dashed #9aa4ff;
      border-radius: 18px;
      background: #fbfbff;
      color: #344054;
    }

    .debug-results-panel h3 {
      margin: 0 0 5px;
      color: #2f25a8;
      font-size: 1.02rem;
      letter-spacing: -.02em;
    }

    .debug-results-panel p {
      margin: 0;
      color: #667085;
      font-size: .78rem;
      line-height: 1.5;
    }

    .debug-grid {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 12px;
      margin-top: 14px;
    }

    .debug-source-card {
      padding: 13px;
      border: 1px solid #eaecf0;
      border-radius: 14px;
      background: #fff;
    }

    .debug-source-card h4 {
      margin: 0 0 9px;
      color: #101828;
      font-size: .88rem;
      font-weight: 950;
    }

    .debug-line {
      display: flex;
      justify-content: space-between;
      gap: 10px;
      padding: 5px 0;
      border-top: 1px solid #f2f4f7;
      font-size: .72rem;
      line-height: 1.35;
    }

    .debug-line:first-of-type {
      border-top: 0;
    }

    .debug-line strong {
      color: #475467;
      font-weight: 850;
    }

    .debug-line span {
      max-width: 62%;
      text-align: right;
      color: #101828;
      font-weight: 800;
      word-break: break-word;
    }

    .debug-notes {
      margin-top: 9px;
      padding-top: 8px;
      border-top: 1px solid #f2f4f7;
    }

    .debug-note {
      display: block;
      margin-top: 5px;
      color: #7a4a00;
      font-size: .68rem;
      font-weight: 750;
      line-height: 1.4;
    }

    .debug-query {
      margin-top: 8px;
      padding: 8px;
      border-radius: 10px;
      background: #f8f7ff;
      color: #3538cd;
      font-size: .7rem;
      font-weight: 850;
      line-height: 1.35;
      word-break: break-word;
    }

    @media (max-width: 980px) {
      .debug-grid {
        grid-template-columns: 1fr 1fr;
      }
    }

    @media (max-width: 640px) {
      .debug-grid {
        grid-template-columns: 1fr;
      }
    }
  `;

  document.head.appendChild(
    style
  );
}

function isDebugMode() {
  try {
    const params =
      new URLSearchParams(
        window.location.search
      );

    return (
      params.get("debug") === "1" ||
      params.has("tester")
    );
  } catch {
    return false;
  }
}

function debugValue(value) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return "—";
  }

  if (Array.isArray(value)) {
    return value.length
      ? value.join(" | ")
      : "—";
  }

  if (typeof value === "boolean") {
    return value ? "tak" : "nie";
  }

  return String(value);
}

function debugSourceCardHtml(
  sourceKey,
  debug
) {
  const config =
    PROGRESSIVE_SOURCE_CONFIG[
      sourceKey
    ] || {};

  const data =
    debug || {};

  const notes =
    Array.isArray(data.notes)
      ? data.notes
      : [];

  return `
    <article class="debug-source-card">
      <h4>
        ${config.icon || "🔎"}
        ${escapeHtml(
          data.source ||
          config.label ||
          sourceKey
        )}
      </h4>

      <div class="debug-query">
        Fraza:
        ${escapeHtml(
          debugValue(
            data.query_sent ||
            data.planned_query
          )
        )}
      </div>

      <div class="debug-line">
        <strong>Stan</strong>
        <span>${escapeHtml(debugValue(data.state))}</span>
      </div>

      <div class="debug-line">
        <strong>Pokazano</strong>
        <span>${escapeHtml(debugValue(data.shown_count))}</span>
      </div>

      <div class="debug-line">
        <strong>Po parserze</strong>
        <span>${escapeHtml(debugValue(data.selected_before_priority_filter))}</span>
      </div>

      <div class="debug-line">
        <strong>Surowe</strong>
        <span>${escapeHtml(debugValue(data.raw_count))}</span>
      </div>

      <div class="debug-line">
        <strong>Cache</strong>
        <span>${escapeHtml(debugValue(data.cache_age || data.cache_hit))}</span>
      </div>

      ${
        data.assistant_used !== undefined
          ? `
            <div class="debug-line">
              <strong>Asystent</strong>
              <span>${escapeHtml(debugValue(data.assistant_used))}</span>
            </div>
          `
          : ""
      }

      ${
        data.search_variants
          ? `
            <div class="debug-query">
              Warianty:
              ${escapeHtml(debugValue(data.search_variants))}
            </div>
          `
          : ""
      }

      ${
        notes.length
          ? `
            <div class="debug-notes">
              ${notes
                .map(
                  note =>
                    `<span class="debug-note">• ${escapeHtml(note)}</span>`
                )
                .join("")}
            </div>
          `
          : ""
      }
    </article>
  `;
}

function debugResultsPanelHtml(data) {
  if (
    !isDebugMode() ||
    !data ||
    !data.debug_by_source
  ) {
    return "";
  }

  return `
    <section class="debug-results-panel">
      <div class="debug-panel-head">
        <div>
          <h3>
            🧪 Panel testera SmartZakupów
          </h3>

          <p>
            Ten panel widzisz tylko z parametrem
            <strong>?debug=1</strong>. Klient go nie zobaczy.
          </p>

          <span
            class="debug-copy-status"
            data-debug-copy-status>
          </span>
        </div>

        <div class="debug-actions">
          <button
            type="button"
            class="debug-copy-button"
            data-copy-debug-report>
            📋 Kopiuj raport do ChatGPT
          </button>

          <a
            class="debug-clean-link"
            href="${escapeHtml(debugCleanUrl())}">
            Zobacz jak klient
          </a>
        </div>
      </div>

      <pre
        class="debug-report-preview"
        data-debug-report-preview
        hidden></pre>

      <div class="debug-grid">
        ${PROGRESSIVE_SOURCE_ORDER
          .map(
            sourceKey =>
              debugSourceCardHtml(
                sourceKey,
                data.debug_by_source[
                  sourceKey
                ]
              )
          )
          .join("")}
      </div>
    </section>
  `;
}


function injectStage6XStyles() {
  if (
    document.getElementById(
      "miboyStage6XStyles"
    )
  ) {
    return;
  }

  const style =
    document.createElement(
      "style"
    );

  style.id =
    "miboyStage6XStyles";

  style.textContent = `
    .debug-panel-head {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 16px;
    }

    .debug-actions {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
    }

    .debug-copy-button,
    .debug-clean-link {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-height: 38px;
      padding: 0 12px;
      border-radius: 999px;
      border: 1px solid #d0d5dd;
      background: #fff;
      color: #344054;
      font-size: .72rem;
      font-weight: 900;
      text-decoration: none;
      cursor: pointer;
      transition:
        transform .16s ease,
        box-shadow .16s ease,
        border-color .16s ease;
    }

    .debug-copy-button {
      border-color: #7a5cff;
      background: #5d3bff;
      color: #fff;
      box-shadow:
        0 9px 18px rgba(93,59,255,.18);
    }

    .debug-copy-button:hover,
    .debug-clean-link:hover {
      transform: translateY(-1px);
      box-shadow:
        0 9px 18px rgba(16,24,40,.10);
    }

    .debug-copy-status {
      display: block;
      min-height: 18px;
      margin-top: 8px;
      color: #027a48;
      font-size: .7rem;
      font-weight: 850;
    }

    .debug-report-preview {
      margin-top: 13px;
      padding: 12px;
      border-radius: 12px;
      background: #101828;
      color: #f9fafb;
      font-family:
        ui-monospace,
        SFMono-Regular,
        Menlo,
        Monaco,
        Consolas,
        "Liberation Mono",
        monospace;
      font-size: .68rem;
      line-height: 1.45;
      white-space: pre-wrap;
      max-height: 220px;
      overflow: auto;
    }

    @media (max-width: 720px) {
      .debug-panel-head {
        display: block;
      }

      .debug-actions {
        margin-top: 12px;
      }
    }
  `;

  document.head.appendChild(
    style
  );
}

function compactDebugReport(data, query) {
  const lines = [];

  const profile =
    data?.query_profile || {};

  lines.push(
    "Miboy SmartZakupy — raport diagnostyczny"
  );

  lines.push(
    "Etap: 6Z.1"
  );

  lines.push(
    "Zapytanie: " +
    debugValue(
      query ||
      data?.effective_query ||
      data?.main_query
    )
  );

  lines.push(
    "Kategoria: " +
    debugValue(
      profile.category_label ||
      profile.category
    )
  );

  lines.push(
    "Budżet: " +
    debugValue(
      profile.budget_max
        ? (
            "do " +
            profile.budget_max +
            " zł"
          )
        : ""
    )
  );

  lines.push(
    "Cechy: " +
    debugValue(
      profile.priority_labels ||
      profile.priority_keys
    )
  );

  lines.push("");

  const sourceDebug =
    data?.debug_by_source || {};

  PROGRESSIVE_SOURCE_ORDER.forEach(
    sourceKey => {
      const config =
        PROGRESSIVE_SOURCE_CONFIG[
          sourceKey
        ] || {};

      const item =
        sourceDebug[
          sourceKey
        ] || {};

      lines.push(
        "== " +
        (
          item.source ||
          config.label ||
          sourceKey
        ) +
        " =="
      );

      lines.push(
        "Fraza: " +
        debugValue(
          item.query_sent ||
          item.planned_query
        )
      );

      lines.push(
        "Stan: " +
        debugValue(
          item.state
        )
      );

      lines.push(
        "Pokazano: " +
        debugValue(
          item.shown_count
        )
      );

      lines.push(
        "Po parserze: " +
        debugValue(
          item.selected_before_priority_filter
        )
      );

      lines.push(
        "Surowe: " +
        debugValue(
          item.raw_count
        )
      );

      if (
        item.assistant_used !== undefined
      ) {
        lines.push(
          "Asystent Ceneo: " +
          debugValue(
            item.assistant_used
          )
        );

        lines.push(
          "Wyniki Asystenta: " +
          debugValue(
            item.assistant_found_count
          )
        );
      }

      if (
        item.search_variants
      ) {
        lines.push(
          "Warianty: " +
          debugValue(
            item.search_variants
          )
        );
      }

      if (
        Array.isArray(item.notes) &&
        item.notes.length
      ) {
        lines.push(
          "Notatki:"
        );

        item.notes.forEach(
          note => {
            lines.push(
              "- " + note
            );
          }
        );
      }

      lines.push("");
    }
  );

  const counts = {
    ceneo:
      data?.source_sections?.ceneo
        ?.length || 0,
    allegro:
      data?.source_sections?.allegro
        ?.length || 0,
    amazon:
      data?.amazon_search?.url
        ? "link gotowy"
        : 0,
    aliexpress:
      data?.source_sections?.aliexpress
        ?.length || 0
  };

  lines.push(
    "Podsumowanie: " +
    `${counts.ceneo} Ceneo, ` +
    `${counts.allegro} Allegro, ` +
    `${counts.amazon} Amazon.pl, ` +
    `${counts.aliexpress} AliExpress`
  );

  lines.push("");
  lines.push(
    "Wklej ten raport do ChatGPT razem z krótkim opisem, co wygląda źle."
  );

  return lines.join("\n");
}

async function copyDebugReport(report) {
  if (!report) {
    return false;
  }

  try {
    if (
      navigator.clipboard &&
      window.isSecureContext
    ) {
      await navigator.clipboard.writeText(
        report
      );

      return true;
    }
  } catch {
    // Fallback poniżej.
  }

  try {
    const area =
      document.createElement(
        "textarea"
      );

    area.value =
      report;

    area.setAttribute(
      "readonly",
      "readonly"
    );

    area.style.position =
      "fixed";

    area.style.left =
      "-9999px";

    document.body.appendChild(
      area
    );

    area.select();

    const ok =
      document.execCommand(
        "copy"
      );

    area.remove();

    return ok;
  } catch {
    return false;
  }
}

function bindDebugReportActions() {
  document
    .querySelectorAll(
      "[data-copy-debug-report]"
    )
    .forEach(button => {
      if (
        button.dataset.bound ===
        "1"
      ) {
        return;
      }

      button.dataset.bound =
        "1";

      button.addEventListener(
        "click",
        async () => {
          const report =
            compactDebugReport(
              lastCombinedPayload,
              lastCombinedQuery
            );

          const ok =
            await copyDebugReport(
              report
            );

          const panel =
            button.closest(
              ".debug-results-panel"
            );

          const status =
            panel?.querySelector(
              "[data-debug-copy-status]"
            );

          const preview =
            panel?.querySelector(
              "[data-debug-report-preview]"
            );

          if (status) {
            status.textContent =
              ok
                ? "Raport skopiowany. Wklej go teraz do rozmowy."
                : "Nie udało się skopiować automatycznie — zaznacz tekst poniżej.";
          }

          if (preview) {
            preview.textContent =
              report;

            preview.hidden =
              false;
          }
        }
      );
    });
}

function debugCleanUrl() {
  try {
    const url =
      new URL(
        window.location.href
      );

    url.searchParams.delete(
      "debug"
    );

    url.searchParams.delete(
      "tester"
    );

    return (
      url.pathname +
      url.search +
      url.hash
    );
  } catch {
    return "/smartzakupy/";
  }
}


function injectStage6ZStyles() {
  if (
    document.getElementById(
      "miboyStage6ZStyles"
    )
  ) {
    return;
  }

  const style =
    document.createElement(
      "style"
    );

  style.id =
    "miboyStage6ZStyles";

  style.textContent = `
    .progressive-human-message {
      grid-column: 1 / -1;
      margin: 22px 0 28px;
      padding: 24px 26px;
      border: 1px solid #c7d7fe;
      border-radius: 24px;
      background:
        radial-gradient(
          circle at top left,
          rgba(93,59,255,.16),
          transparent 34%
        ),
        linear-gradient(
          135deg,
          #ffffff,
          #f5f7ff
        );
      box-shadow:
        0 16px 42px rgba(16,24,40,.08);
    }

    .progressive-human-label {
      display: inline-flex;
      align-items: center;
      gap: 7px;
      min-height: 27px;
      padding: 0 10px;
      border-radius: 999px;
      background: #eef4ff;
      color: #3538cd;
      font-size: .74rem;
      font-weight: 950;
      text-transform: uppercase;
      letter-spacing: .055em;
    }

    .progressive-human-message h3 {
      margin: 12px 0 7px;
      color: #101828;
      font-size: clamp(1.55rem, 2.4vw, 2.55rem);
      line-height: 1.05;
      letter-spacing: -.055em;
    }

    .progressive-human-message p {
      max-width: 900px;
      margin: 0;
      color: #475467;
      font-size: .98rem;
      line-height: 1.6;
      font-weight: 650;
    }

    .final-summary-anchor {
      grid-column: 1 / -1;
      margin: 40px 0 18px;
      padding: 22px 24px;
      border-radius: 24px;
      border: 1px solid #d6bbfb;
      background:
        linear-gradient(
          135deg,
          #f4f0ff,
          #ffffff
        );
    }

    .final-summary-anchor span {
      display: inline-flex;
      padding: 5px 9px;
      border-radius: 999px;
      background: #ebe9fe;
      color: #5925dc;
      font-size: .72rem;
      font-weight: 950;
      text-transform: uppercase;
      letter-spacing: .055em;
    }

    .final-summary-anchor h3 {
      margin: 9px 0 6px;
      color: #101828;
      font-size: clamp(1.35rem, 2vw, 2.1rem);
      line-height: 1.1;
      letter-spacing: -.04em;
    }

    .final-summary-anchor p {
      margin: 0;
      color: #475467;
      font-size: .9rem;
      line-height: 1.55;
      font-weight: 650;
    }

    html.miboy-auto-scrolling {
      scroll-behavior: smooth;
    }

    @media (max-width: 720px) {
      .progressive-human-message {
        padding: 19px;
      }
    }
  `;

  document.head.appendChild(
    style
  );
}

function latestCompletedSourceKey(data) {
  const completed =
    Array.isArray(
      data?.completed_sources
    )
      ? data.completed_sources
      : [];

  for (
    let index =
      PROGRESSIVE_SOURCE_ORDER.length - 1;
    index >= 0;
    index -= 1
  ) {
    const sourceKey =
      PROGRESSIVE_SOURCE_ORDER[
        index
      ];

    if (
      completed.includes(
        sourceKey
      )
    ) {
      return sourceKey;
    }
  }

  return null;
}

function progressiveHumanMessageHtml(data) {
  const completed =
    Array.isArray(
      data?.completed_sources
    )
      ? data.completed_sources
      : [];

  const has =
    sourceKey =>
      completed.includes(
        sourceKey
      );

  if (
    data?.progressive_complete
  ) {
    return `
      <section class="progressive-human-message" data-progressive-human-message>
        <span class="progressive-human-label">
          ✅ komplet wyników
        </span>

        <h3>
          Mam już wszystko, co udało się sensownie znaleźć.
        </h3>

        <p>
          Sprawdź jeszcze AliExpress, a zaraz pod wynikami
          masz moje końcowe podsumowanie: co jest najlepsze,
          czy warto dopłacić i co wybrałbym dla Ciebie.
        </p>
      </section>
    `;
  }

  if (
    has("amazon")
  ) {
    return `
      <section class="progressive-human-message" data-progressive-human-message>
        <span class="progressive-human-label">
          📦 trzeci etap gotowy
        </span>

        <h3>
          Mam już Ceneo, Allegro i Amazon.pl.
        </h3>

        <p>
          Teraz doczytujesz aktualny link Amazon.pl,
          a ja na końcu sprawdzam AliExpress. Jeśli import
          da sensowną alternatywę, dołączę ją automatycznie.
        </p>
      </section>
    `;
  }

  if (
    has("allegro")
  ) {
    return `
      <section class="progressive-human-message" data-progressive-human-message>
        <span class="progressive-human-label">
          🟠 drugi etap gotowy
        </span>

        <h3>
          Mam już Ceneo, a teraz sprawdź Allegro.
        </h3>

        <p>
          Za chwilę dokładam Amazon.pl, a potem AliExpress.
          Dzięki temu nie czekasz na cały gotowiec — możesz
          już czytać polskie oferty.
        </p>
      </section>
    `;
  }

  if (
    has("ceneo")
  ) {
    return `
      <section class="progressive-human-message" data-progressive-human-message>
        <span class="progressive-human-label">
          🔎 pierwsze wyniki gotowe
        </span>

        <h3>
          Mam już pierwsze wyniki dla Ciebie — to Ceneo.
        </h3>

        <p>
          Możesz je spokojnie przejrzeć. W tym czasie
          SmartZakupy sprawdzają następne źródło:
          Allegro.
        </p>
      </section>
    `;
  }

  return "";
}

function finalSummaryIntroHtml() {
  return `
    <section
      class="final-summary-anchor"
      data-final-summary-anchor>
      <span>
        decyzja po wynikach
      </span>

      <h3>
        Teraz moje podsumowanie i wybór.
      </h3>

      <p>
        Poniżej masz Smart wybór, doradcę, decyzję końcową
        i sprawdzenie, czy warto dopłacić. To pojawia się
        dopiero po wynikach, żeby użytkownik najpierw zobaczył
        realne oferty ze sklepów.
      </p>
    </section>
  `;
}

function scrollToElementWithHeaderOffset(
  target,
  {
    delay = 140,
    extraOffset = 18
  } = {}
) {
  if (!target) {
    return;
  }

  window.setTimeout(
    () => {
      const header =
        document.querySelector(
          ".site-header, header, .topbar, .nav"
        );

      const headerHeight =
        header
          ? Math.min(
              96,
              Math.max(
                0,
                header.getBoundingClientRect()
                  .height || 0
              )
            )
          : 0;

      const targetTop =
        target.getBoundingClientRect().top +
        window.scrollY -
        headerHeight -
        extraOffset;

      document.documentElement
        .classList
        .add(
          "miboy-auto-scrolling"
        );

      window.scrollTo({
        top: Math.max(
          0,
          targetTop
        ),
        behavior: "smooth"
      });

      window.setTimeout(
        () => {
          document.documentElement
            .classList
            .remove(
              "miboy-auto-scrolling"
            );
        },
        950
      );
    },
    delay
  );
}

function scrollToProgressiveSource(
  sourceKey
) {
  if (!sourceKey) {
    return;
  }

  const message =
    document.querySelector(
      "[data-progressive-human-message]"
    );

  const fallback =
    document.querySelector(
      `[data-progressive-store="${sourceKey}"]`
    );

  scrollToElementWithHeaderOffset(
    message || fallback,
    {
      delay: 130,
      extraOffset: 16
    }
  );
}

function scrollToFinalSummary() {
  const target =
    document.querySelector(
      "[data-final-summary-anchor]"
    ) ||
    document.querySelector(
      "[data-progressive-human-message]"
    );

  scrollToElementWithHeaderOffset(
    target,
    {
      delay: 380,
      extraOffset: 18
    }
  );
}


function productOfferUrl(product) {
  return safeUrl(
    product?.affiliate_url ||
    product?.url
  );
}

function productImageLinkHtml(product, className = "offer-image-link", extraClass = "") {
  const url = productOfferUrl(product);
  const classes = [className, extraClass]
    .filter(Boolean)
    .join(" ");

  if (!product?.image_url || url === "#") {
    return `<span class="offer-icon-badge ${escapeHtml(extraClass)}">🛍️</span>`;
  }

  return `
    <a
      class="${escapeHtml(classes)}"
      href="${escapeHtml(url)}"
      target="_blank"
      rel="nofollow sponsored noopener"
      aria-label="Otwórz produkt: ${escapeHtml(product.title || "Produkt")}">
      <img
        class="real-product-image"
        src="${escapeHtml(product.image_url)}"
        alt="${escapeHtml(product.title || "Produkt")}"
        loading="lazy">
    </a>
  `;
}



function updateSearchLoader(
  progress,
  options = {}
) {
  const loader =
    ensureSearchLoader();

  if (!loader) {
    return;
  }

  const bar =
    loader.querySelector(
      "#smartSearchLoaderProgress"
    );

  const copy =
    loader.querySelector(
      "#smartSearchLoaderCopy"
    );

  const time =
    loader.querySelector(
      "#smartSearchLoaderTime"
    );

  const stageStatus =
    loader.querySelector(
      "#smartSearchLoaderStageStatus"
    );

  const steps =
    Array.from(
      loader.querySelectorAll(
        ".search-loader-step"
      )
    );

  const safeProgress =
    Math.max(
      3,
      Math.min(
        Number(progress) || 3,
        100
      )
    );

  if (bar) {
    bar.style.width =
      `${safeProgress}%`;

    bar.setAttribute(
      "aria-valuenow",
      String(
        Math.round(
          safeProgress
        )
      )
    );
  }

  const step =
    Number.isFinite(
      Number(
        options.step
      )
    )
      ? Math.max(
          0,
          Math.min(
            Number(options.step),
            5
          )
        )
      : searchProgressStep;

  const message =
    String(
      options.message ||
      searchProgressMessage ||
      SEARCH_PROGRESS_LABELS[
        step
      ] ||
      SEARCH_PROGRESS_LABELS[0]
    );

  if (copy) {
    copy.textContent =
      message;
  }

  const elapsedSeconds =
    searchProgressStartedAt
      ? Math.max(
          0,
          Math.round(
            (
              Date.now() -
              searchProgressStartedAt
            ) /
            1000
          )
        )
      : 0;

  if (time) {
    time.textContent =
      safeProgress >= 100
        ? "Gotowe · 100%"
        : (
            `${Math.round(safeProgress)}% · ` +
            `${elapsedSeconds} s`
          );
  }

  if (stageStatus) {
    stageStatus.textContent =
      safeProgress >= 100
        ? "Wyniki zostały przygotowane."
        : (
            `Rzeczywisty etap ${Math.min(step + 1, 5)} z 5. ` +
            "Procent zmienia się po zakończeniu kolejnych źródeł."
          );
  }

  steps.forEach(
    (stepElement, index) => {
      stepElement.classList.toggle(
        "is-complete",
        index < step
      );

      stepElement.classList.toggle(
        "is-current",
        index ===
          Math.min(
            step,
            steps.length - 1
          ) &&
        safeProgress < 100
      );
    }
  );
}

function ensureSearchLoader() {
  if (
    !results ||
    !results.parentElement
  ) {
    return null;
  }

  let loader =
    document.getElementById(
      "smartSearchLoader"
    );

  if (loader) {
    return loader;
  }

  loader =
    document.createElement(
      "section"
    );

  loader.id =
    "smartSearchLoader";

  loader.className =
    "search-loader";

  loader.hidden =
    true;

  loader.setAttribute(
    "aria-live",
    "polite"
  );

  loader.innerHTML = `
    <div class="search-loader-head">
      <div class="search-loader-title">
        <span
          class="search-loader-ring"
          aria-hidden="true">
        </span>

        <span id="smartSearchLoaderTitle">
          Trwa inteligentne wyszukiwanie…
        </span>
      </div>

      <span
        class="search-loader-time"
        id="smartSearchLoaderTime">
        3% · 0 s
      </span>
    </div>

    <p
      class="search-loader-copy"
      id="smartSearchLoaderCopy">
      Rozpoznajemy produkt i sprawdzamy pamięć…
    </p>

    <div
      class="search-loader-bar"
      role="progressbar"
      aria-label="Postęp wyszukiwania"
      aria-valuemin="0"
      aria-valuemax="100">
      <div
        class="search-loader-progress"
        id="smartSearchLoaderProgress">
      </div>
    </div>

    <p
      class="search-loader-stage-status"
      id="smartSearchLoaderStageStatus">
      Rzeczywisty etap 1 z 5.
    </p>

    <p class="search-loader-live-note">
      <span aria-hidden="true">✨</span>

      <span>
        <strong>Wyniki będą pojawiały się etapami.</strong>
        Najpierw pokażemy polskie oferty z Ceneo, potem dołączymy
        Allegro i Amazon.pl, a na końcu sprawdzimy AliExpress.
        Nie musisz czekać na gotowy zestaw — podczas oglądania
        pierwszych produktów kolejne sklepy są już przeszukiwane.
      </span>
    </p>

    <div
      class="search-loader-steps"
      id="smartSearchLoaderSteps">
      <div class="search-loader-step is-current">
        01 · Ceneo
      </div>

      <div class="search-loader-step">
        02 · Allegro
      </div>

      <div class="search-loader-step">
        03 · Amazon.pl
      </div>

      <div class="search-loader-step">
        04 · AliExpress
      </div>

      <div class="search-loader-step">
        05 · Gotowe
      </div>
    </div>
  `;

  results.parentElement.insertBefore(
    loader,
    results
  );

  return loader;
}

function setLoading(isLoading) {
  const loader =
    ensureSearchLoader();

  if (results) {
    results.setAttribute(
      "aria-busy",
      isLoading
        ? "true"
        : "false"
    );
  }

  if (isLoading) {
    announceAccessibility(
      "Rozpoczęto wyszukiwanie ofert."
    );
  }

  if (submitButton) {
    if (isLoading) {
      submitButton.dataset
        .originalText =
          submitButton.textContent ||
          "Znajdź";

      submitButton.textContent =
        "Szukam…";

      submitButton.disabled =
        true;
    } else {
      submitButton.textContent =
        submitButton.dataset
          .originalText ||
        "Znajdź";

      submitButton.disabled =
        false;
    }
  }

  if (!loader) {
    return;
  }

  if (searchLoaderInterval) {
    window.clearInterval(
      searchLoaderInterval
    );

    searchLoaderInterval =
      null;
  }

  if (searchLoaderHideTimer) {
    window.clearTimeout(
      searchLoaderHideTimer
    );

    searchLoaderHideTimer =
      null;
  }

  if (isLoading) {
    loader.hidden =
      false;

    window.requestAnimationFrame(
      () => {
        loader.classList.add(
          "is-visible"
        );
      }
    );

    updateSearchLoader(
      searchProgressDisplayed,
      {
        step:
          searchProgressStep,
        message:
          searchProgressMessage
      }
    );

    searchLoaderInterval =
      window.setInterval(
        () => {
          const elapsed =
            searchProgressStartedAt
              ? (
                  Date.now() -
                  searchProgressStartedAt
                )
              : 0;

          // Awaryjny, bardzo spokojny ruch między
          // rzeczywistymi etapami backendu.
          const fallbackTarget =
            Math.min(
              82,
              3 +
              Math.log1p(
                elapsed / 3200
              ) *
              16
            );

          const effectiveTarget =
            progressiveLoaderMode
              ? searchProgressTarget
              : Math.max(
                  searchProgressTarget,
                  fallbackTarget
                );

          const distance =
            effectiveTarget -
            searchProgressDisplayed;

          if (distance > 0) {
            searchProgressDisplayed +=
              Math.max(
                .18,
                Math.min(
                  1.8,
                  distance * .12
                )
              );
          }

          if (
            searchProgressTarget >=
            100
          ) {
            searchProgressDisplayed =
              Math.min(
                100,
                searchProgressDisplayed +
                Math.max(
                  2,
                  (
                    100 -
                    searchProgressDisplayed
                  ) * .28
                )
              );
          }

          updateSearchLoader(
            searchProgressDisplayed,
            {
              step:
                searchProgressStep,
              message:
                searchProgressMessage
            }
          );
        },
        320
      );
  } else {
    searchProgressTarget =
      100;

    searchProgressDisplayed =
      100;

    updateSearchLoader(
      100,
      {
        step: 5,
        message:
          "Wyniki są gotowe."
      }
    );

    stopSearchProgressPolling();

    loader.classList.remove(
      "is-visible"
    );

    searchLoaderHideTimer =
      window.setTimeout(
        () => {
          loader.hidden =
            true;
        },
        520
      );
  }
}

function renderDemoProducts(list, query = "", infoText = "") {
  results.innerHTML = "";

  if (!list.length) {
    showEmptyState(
      query ? `Brak wyników dla: „${query}”` : "Brak produktów",
      infoText || "Spróbuj prostszego zapytania."
    );
    return;
  }

  results.hidden = false;
  emptyState.hidden = true;

  list.forEach((product, index) => {
    const tags = (product.tags || [])
      .slice(0, 3)
      .map(tag => `<span>${escapeHtml(tag)}</span>`)
      .join("");

    const article = document.createElement("article");
    article.className = "product-card";

    article.innerHTML = `
      <div class="product-visual">
        <span class="product-rank">#${index + 1}</span>
        <span aria-hidden="true">${product.icon || "🛍️"}</span>
      </div>
      <div class="product-body">
        <span class="product-badge">
          ${escapeHtml(product.badge || "Polecane")}
        </span>
        <h3>${escapeHtml(product.name)}</h3>
        <p class="product-description">
          ${escapeHtml(product.description)}
        </p>
        <div class="product-tags">${tags}</div>
        <div class="product-bottom">
          <span class="product-price">
            ${formatPrice(product.price)}
          </span>
          <a
            class="product-link"
            href="${escapeHtml(safeUrl(product.url))}"
            rel="nofollow sponsored">
            Zobacz ofertę
          </a>
        </div>
      </div>
    `;

    results.appendChild(article);
  });

  resultsTitle.textContent = query
    ? `Wyniki dla: „${query}”`
    : "Najciekawsze produkty na start";

  resultsInfo.textContent =
    infoText || "Przykładowe dane demonstracyjne.";

  enhanceRenderedAccessibility(
    query || "produkty startowe",
    list.length
  );
}

let currentMarketplaceFilter = "all";
let currentSortMode = "best";
let lastCombinedPayload = null;
let lastCombinedQuery = "";

const comparisonSelection = new Set();
const comparisonCandidates = new Map();
const MAX_COMPARISON_ITEMS = 3;

let finalDecisionContext = null;

function resultControlButtons() {
  const marketplaceButtons = [
    ["all", "Wszystkie"],
    ["Ceneo", "Ceneo"],
    ["Allegro", "Allegro"],
    ["Amazon", "Amazon.pl"],
    ["AliExpress", "AliExpress"]
  ];

  const sortButtons = [
    ["best", "Najlepsze"],
    ["cheapest", "Najtańsze"],
    ["opinions", "Najwięcej opinii"]
  ];

  const marketplaceHtml = marketplaceButtons
    .map(
      ([value, label]) => `
        <button
          type="button"
          class="result-control-button ${
            currentMarketplaceFilter === value
              ? "is-active"
              : ""
          }"
          data-marketplace-filter="${escapeHtml(value)}">
          ${escapeHtml(label)}
        </button>
      `
    )
    .join("");

  const sortHtml = sortButtons
    .map(
      ([value, label]) => `
        <button
          type="button"
          class="result-control-button ${
            currentSortMode === value
              ? "is-active"
              : ""
          }"
          data-sort-mode="${escapeHtml(value)}">
          ${escapeHtml(label)}
        </button>
      `
    )
    .join("");

  return `
    <div class="result-controls">
      <div class="result-control-group">
        <span class="result-control-label">
          Sklep
        </span>
        ${marketplaceHtml}
      </div>

      <div class="result-control-group">
        <span class="result-control-label">
          Sortuj
        </span>
        ${sortHtml}
      </div>
    </div>
  `;
}


function ensureSupplementarySearchField() {
  if (!form || !input) {
    return null;
  }

  const existing =
    document.getElementById(
      "supplementarySearchInput"
    );

  if (existing) {
    return existing;
  }

  const wrapper =
    document.createElement(
      "div"
    );

  wrapper.className =
    "supplementary-search";

  wrapper.innerHTML = `
    <div class="supplementary-search-copy">
      <label
        class="supplementary-search-label"
        for="supplementarySearchInput">
        Chcesz doprecyzować?
        <span class="supplementary-search-optional">
          opcjonalnie
        </span>
      </label>

      <p class="supplementary-search-help">
        Nie musisz nic wpisywać. Dodaj tylko to,
        co jest dla Ciebie naprawdę ważne.
      </p>
    </div>

    <div>
      <input
        id="supplementarySearchInput"
        class="supplementary-search-input"
        type="text"
        maxlength="180"
        autocomplete="off"
        placeholder="np. dobry aparat, mocna bateria, do gier">

      <p class="supplementary-search-note">
        Puste pole = zwykłe wyszukiwanie dokładnie jak dotychczas.
      </p>

      <div
        class="quick-priorities"
        id="quickPriorities"
        aria-label="Szybkie priorytety">
      </div>
    </div>
  `;

  const preferredRow =
    input.closest(
      ".search-row"
    ) ||
    input.parentElement;

  if (
    preferredRow &&
    preferredRow !== form &&
    form.contains(
      preferredRow
    )
  ) {
    preferredRow.insertAdjacentElement(
      "afterend",
      wrapper
    );
  } else {
    form.appendChild(
      wrapper
    );
  }

  return document.getElementById(
    "supplementarySearchInput"
  );
}

const QUICK_PRIORITY_GROUPS = {
  smartphone: [
    "Dobry aparat",
    "Mocna bateria",
    "Wydajność",
    "Dobry ekran",
    "Dużo pamięci",
    "5G",
    "NFC"
  ],
  headphones: [
    "ANC",
    "Mocna bateria",
    "Dobry mikrofon"
  ],
  smartwatch: [
    "GPS",
    "Funkcje zdrowotne",
    "NFC",
    "Mocna bateria"
  ],
  vacuum: [
    "Mocne ssanie",
    "Do sierści",
    "Lekki",
    "Mocna bateria"
  ],
  default: [
    "Najlepsza cena",
    "Dobra jakość",
    "Mocna bateria"
  ]
};

function normalizeQuickText(value) {
  return String(
    value || ""
  )
    .toLowerCase()
    .normalize("NFD")
    .replace(
      /[\u0300-\u036f]/g,
      ""
    )
    .replace(
      /ł/g,
      "l"
    )
    .replace(
      /\s+/g,
      " "
    )
    .trim();
}

function detectQuickPriorityCategory(
  query
) {
  const text =
    normalizeQuickText(
      query
    );

  if (
    /\b(smartfon|telefon|smartphone)\b/
      .test(text)
  ) {
    return "smartphone";
  }

  if (
    /\b(sluchawki|sluchawka|headphones|earbuds|earphones)\b/
      .test(text)
  ) {
    return "headphones";
  }

  if (
    /\b(smartwatch|zegarek)\b/
      .test(text)
  ) {
    return "smartwatch";
  }

  if (
    /\b(odkurzacz|vacuum)\b/
      .test(text)
  ) {
    return "vacuum";
  }

  return "default";
}

function selectedQuickPriorities() {
  return Array.from(
    document.querySelectorAll(
      ".quick-priority-button.is-active"
    )
  )
    .map(
      button =>
        button.dataset.priority ||
        ""
    )
    .filter(Boolean);
}

function supplementParts(value) {
  return String(
    value || ""
  )
    .split(",")
    .map(
      part =>
        cleanSupplement(
          part
        )
    )
    .filter(Boolean);
}

function mergeSupplementWithPriorities(
  manualText,
  priorities
) {
  const parts =
    supplementParts(
      manualText
    );

  const seen =
    new Set(
      parts.map(
        normalizeQuickText
      )
    );

  (Array.isArray(priorities)
    ? priorities
    : []
  ).forEach(
    priority => {
      const clean =
        cleanSupplement(
          priority
        );

      const normalized =
        normalizeQuickText(
          clean
        );

      if (
        clean &&
        !seen.has(
          normalized
        )
      ) {
        parts.push(
          clean
        );

        seen.add(
          normalized
        );
      }
    }
  );

  return parts.join(", ");
}

function renderQuickPriorities() {
  const container =
    document.getElementById(
      "quickPriorities"
    );

  if (
    !container ||
    !input
  ) {
    return;
  }

  const category =
    detectQuickPriorityCategory(
      input.value
    );

  const priorities =
    QUICK_PRIORITY_GROUPS[
      category
    ] ||
    QUICK_PRIORITY_GROUPS
      .default;

  const selected =
    new Set(
      selectedQuickPriorities()
    );

  container.innerHTML = `
    <p class="quick-priority-caption">
      Albo kliknij, co jest dla Ciebie ważne:
    </p>

    ${priorities
      .map(
        priority => `
          <button
            type="button"
            class="quick-priority-button ${
              selected.has(priority)
                ? "is-active"
                : ""
            }"
            data-priority="${escapeHtml(priority)}"
            aria-pressed="${
              selected.has(priority)
                ? "true"
                : "false"
            }">
            ${escapeHtml(priority)}
          </button>
        `
      )
      .join("")}

    <button
      type="button"
      class="quick-priority-clear"
      data-priority-clear>
      wyczyść
    </button>
  `;

  container
    .querySelectorAll(
      "[data-priority]"
    )
    .forEach(
      button => {
        button.addEventListener(
          "click",
          () => {
            button.classList.toggle(
              "is-active"
            );

            button.setAttribute(
              "aria-pressed",
              button.classList.contains(
                "is-active"
              )
                ? "true"
                : "false"
            );
          }
        );
      }
    );

  const clearButton =
    container.querySelector(
      "[data-priority-clear]"
    );

  if (clearButton) {
    clearButton.addEventListener(
      "click",
      () => {
        container
          .querySelectorAll(
            "[data-priority]"
          )
          .forEach(
            button => {
              button.classList.remove(
                "is-active"
              );

              button.setAttribute(
                "aria-pressed",
                "false"
              );
            }
          );
      }
    );
  }
}

function effectiveSupplementValue() {
  const manual =
    supplementaryInput
      ? supplementaryInput.value
      : "";

  return mergeSupplementWithPriorities(
    manual,
    selectedQuickPriorities()
  );
}

function cleanSupplement(value) {
  return String(
    value || ""
  )
    .replace(
      /\s+/g,
      " "
    )
    .trim();
}

function effectiveSearchQuery(
  mainQuery,
  supplement
) {
  const cleanMain =
    String(
      mainQuery || ""
    )
      .replace(
        /\s+/g,
        " "
      )
      .trim();

  const cleanExtra =
    cleanSupplement(
      supplement
    );

  return cleanExtra
    ? `${cleanMain} ${cleanExtra}`
    : cleanMain;
}

function clearSupplementarySearch() {
  if (supplementaryInput) {
    supplementaryInput.value = "";
  }

  document
    .querySelectorAll(
      ".quick-priority-button.is-active"
    )
    .forEach(
      button => {
        button.classList.remove(
          "is-active"
        );

        button.setAttribute(
          "aria-pressed",
          "false"
        );
      }
    );
}


// Uruchamiamy dopiero tutaj, gdy QUICK_PRIORITY_GROUPS
// i wszystkie funkcje szybkich priorytetów są już gotowe.
renderQuickPriorities();


function productMarketplace(product, section) {
  const explicit = String(
    product?._source ||
    product?.source ||
    ""
  ).trim();

  if (explicit) {
    return explicit;
  }

  return section === "polish"
    ? "Ceneo"
    : "AliExpress";
}

function productIdentityKey(product, index) {
  const key = String(
    product?._identity_key || ""
  ).trim();

  if (key) {
    return key;
  }

  return (
    "unique-" +
    index +
    "-" +
    String(
      product?.url ||
      product?.title ||
      Math.random()
    )
  );
}

function groupProductsByIdentity(products) {
  const groups = new Map();

  (Array.isArray(products) ? products : [])
    .forEach((product, index) => {
      const key = productIdentityKey(
        product,
        index
      );

      if (!groups.has(key)) {
        groups.set(key, []);
      }

      groups.get(key).push(product);
    });

  return Array.from(
    groups.values()
  );
}

function marketplaceMatches(
  product,
  section,
  marketplaceFilter
) {
  if (
    !marketplaceFilter ||
    marketplaceFilter === "all"
  ) {
    return true;
  }

  return (
    productMarketplace(
      product,
      section
    ) === marketplaceFilter
  );
}

function filterProductsByMarketplace(
  products,
  section,
  marketplaceFilter = currentMarketplaceFilter
) {
  return (
    Array.isArray(products)
      ? products
      : []
  ).filter(
    product =>
      marketplaceMatches(
        product,
        section,
        marketplaceFilter
      )
  );
}

function positivePrice(product) {
  const value = Number(
    product?.current_price_pln
  );

  return Number.isFinite(value) &&
    value > 0
    ? value
    : Number.POSITIVE_INFINITY;
}

function groupCheapestPrice(group) {
  return Math.min(
    ...group.map(positivePrice)
  );
}

function groupOpinionCount(group) {
  return Math.max(
    0,
    ...group.map(
      product => {
        const value = Number(
          product?.opinions_count
        );

        return Number.isFinite(value) &&
          value > 0
          ? value
          : 0;
      }
    )
  );
}

function groupBestScore(group) {
  const useGroupScore =
    currentMarketplaceFilter === "all";

  return Math.max(
    0,
    ...group.map(
      product => {
        const value = Number(
          useGroupScore
            ? (
                product?._group_rank_score ??
                product?._rank_score
              )
            : (
                product?._rank_score ??
                product?._group_rank_score
              )
        );

        return Number.isFinite(value)
          ? value
          : 0;
      }
    )
  );
}

function sortProductGroups(
  groups,
  mode = currentSortMode
) {
  const sorted = [
    ...(Array.isArray(groups)
      ? groups
      : [])
  ];

  sorted.sort(
    (a, b) => {
      if (mode === "cheapest") {
        const priceDifference =
          groupCheapestPrice(a) -
          groupCheapestPrice(b);

        if (priceDifference !== 0) {
          return priceDifference;
        }
      }

      if (mode === "opinions") {
        const opinionDifference =
          groupOpinionCount(b) -
          groupOpinionCount(a);

        if (opinionDifference !== 0) {
          return opinionDifference;
        }
      }

      return (
        groupBestScore(b) -
        groupBestScore(a)
      );
    }
  );

  return sorted;
}

function bindResultControls() {
  document
    .querySelectorAll(
      "[data-marketplace-filter]"
    )
    .forEach(button => {
      button.addEventListener(
        "click",
        () => {
          currentMarketplaceFilter =
            button.dataset
              .marketplaceFilter ||
            "all";

          if (
            lastCombinedPayload
              ?.progressive_mode
          ) {
            renderProgressiveResults(
              lastCombinedPayload,
              lastCombinedQuery
            );
          } else {
            renderCombinedResults(
              lastCombinedPayload,
              lastCombinedQuery
            );
          }
        }
      );
    });

  document
    .querySelectorAll(
      "[data-sort-mode]"
    )
    .forEach(button => {
      button.addEventListener(
        "click",
        () => {
          currentSortMode =
            button.dataset.sortMode ||
            "best";

          if (
            lastCombinedPayload
              ?.progressive_mode
          ) {
            renderProgressiveResults(
              lastCombinedPayload,
              lastCombinedQuery
            );
          } else {
            renderCombinedResults(
              lastCombinedPayload,
              lastCombinedQuery
            );
          }
        }
      );
    });
}

function productGroupAnchorId(
  group,
  section
) {
  const first =
    Array.isArray(group) &&
    group.length
      ? group[0]
      : {};

  const raw =
    String(
      first?._identity_key ||
      first?.offer_id ||
      first?.product_id ||
      first?.title ||
      "product"
    );

  const safe = raw
    .toLowerCase()
    .replace(
      /[^a-z0-9_-]+/g,
      "-"
    )
    .replace(
      /^-+|-+$/g,
      ""
    )
    .slice(0, 70);

  return (
    "smart-result-" +
    String(section || "all") +
    "-" +
    (safe || "product")
  );
}

function groupRepresentativeTitle(group) {
  const first =
    Array.isArray(group) &&
    group.length
      ? group[0]
      : {};

  return (
    String(
      first?._identity_label ||
      first?.title ||
      "Produkt"
    ).trim()
  );
}

function groupRepresentativeSource(
  group,
  section
) {
  const sources = Array.from(
    new Set(
      (Array.isArray(group) ? group : [])
        .map(
          product =>
            productMarketplace(
              product,
              section
            )
        )
        .filter(Boolean)
    )
  );

  return sources.join(" + ");
}

function groupBestProduct(group) {
  const list =
    Array.isArray(group)
      ? [...group]
      : [];

  return list.sort(
    (a, b) =>
      Number(
        b?._rank_score ||
        0
      ) -
      Number(
        a?._rank_score ||
        0
      )
  )[0] || {};
}

function groupCheapestProduct(group) {
  const list =
    Array.isArray(group)
      ? [...group]
      : [];

  return list
    .filter(
      product =>
        Number.isFinite(
          positivePrice(product)
        )
    )
    .sort(
      (a, b) =>
        positivePrice(a) -
        positivePrice(b)
    )[0] ||
    groupBestProduct(group);
}

function compactRiskText(value) {
  return String(
    value || ""
  )
    .toLowerCase()
    .normalize("NFD")
    .replace(
      /[\u0300-\u036f]/g,
      ""
    )
    .replace(
      /ł/g,
      "l"
    )
    .replace(
      /\s+/g,
      " "
    )
    .trim();
}

function productRiskAssessment(
  product,
  section
) {
  const title =
    compactRiskText(
      product?.title
    );

  const raw =
    compactRiskText(
      [
        product?.title,
        product?.raw_text,
        product?.description
      ].filter(Boolean).join(" ")
    );

  const price =
    positivePrice(
      product
    );

  const source =
    productMarketplace(
      product,
      section
    );

  const reasons = [];
  let score = 0;

  const isImport =
    source === "AliExpress" ||
    section === "import";

  // Jednoznaczna sprzeczność w nazwie.
  if (
    /\biphone\b/.test(title) &&
    /\bandroid\b/.test(raw)
  ) {
    score += 8;
    reasons.push(
      "nazwa łączy iPhone z Androidem"
    );
  }

  // Podejrzane podszywanie się pod flagowe modele w bardzo niskiej cenie.
  const flagshipLike =
    /\b(iphone\s*(1[5-9]|2[0-9])|s2[4-9]\s*ultra|galaxy\s*s2[4-9]\s*ultra)\b/
      .test(title);

  if (
    isImport &&
    flagshipLike &&
    Number.isFinite(price) &&
    price < 600
  ) {
    score += 6;
    reasons.push(
      "podejrzanie niska cena jak na nazwę flagowego modelu"
    );
  }

  // Nietypowo agresywne parametry pamięci w bardzo niskiej cenie.
  const extremeMemory =
    (
      /\b(18|20|22|24|32|48)\s*gb\b/
        .test(raw) &&
      /\b(1|2)\s*tb\b/
        .test(raw)
    );

  if (
    isImport &&
    extremeMemory &&
    Number.isFinite(price) &&
    price < 900
  ) {
    score += 5;
    reasons.push(
      "bardzo mocne deklarowane parametry względem ceny"
    );
  }

  // Typowe słowa z ofert-klonów nie oznaczają oszustwa same w sobie,
  // ale przy innych sygnałach wzmacniają ostrożność.
  const cloneMarketing =
    /\b(original smartphone|new mobile phones|global cell phone|pro maxi)\b/
      .test(raw);

  if (
    cloneMarketing &&
    isImport
  ) {
    score += 1;
  }

  const rating =
    Number(
      product?.rating
    );

  if (
    Number.isFinite(rating) &&
    rating > 0 &&
    rating < 3
  ) {
    score += 3;
    reasons.push(
      "niska ocena produktu"
    );
  }

  const sold =
    Number(
      product?.sold_count
    );

  if (
    isImport &&
    Number.isFinite(sold) &&
    sold >= 0 &&
    sold < 3
  ) {
    score += 1;
  }

  let level = "low";

  if (score >= 6) {
    level = "high";
  } else if (score >= 3) {
    level = "medium";
  }

  return {
    level,
    score,
    reasons:
      reasons.slice(
        0,
        3
      )
  };
}

function groupRiskAssessment(
  group,
  section
) {
  const assessments =
    (Array.isArray(group)
      ? group
      : []
    ).map(
      product =>
        productRiskAssessment(
          product,
          section
        )
    );

  if (!assessments.length) {
    return {
      level: "low",
      score: 0,
      reasons: []
    };
  }

  const safest =
    [...assessments]
      .sort(
        (a, b) =>
          a.score -
          b.score
      )[0];

  const highest =
    [...assessments]
      .sort(
        (a, b) =>
          b.score -
          a.score
      )[0];

  // Jeżeli ten sam model jest dostępny w kilku miejscach,
  // bezpieczna alternatywa obniża ryzyko całej grupy.
  if (
    safest.level === "low"
  ) {
    return {
      level:
        highest.level === "high"
          ? "medium"
          : "low",
      score:
        highest.level === "high"
          ? 3
          : safest.score,
      reasons:
        highest.level === "high"
          ? [
              "jedna z ofert tego modelu wymaga dodatkowego sprawdzenia"
            ]
          : safest.reasons
    };
  }

  return safest;
}

function safeSmartPickCandidates(
  items
) {
  const list =
    Array.isArray(items)
      ? items
      : [];

  const lowRisk =
    list.filter(
      item =>
        groupRiskAssessment(
          item.group,
          item.section
        ).level === "low"
    );

  if (lowRisk.length) {
    return lowRisk;
  }

  const notHigh =
    list.filter(
      item =>
        groupRiskAssessment(
          item.group,
          item.section
        ).level !== "high"
    );

  return notHigh.length
    ? notHigh
    : list;
}

function riskBadgeHtml(
  assessment
) {
  if (
    !assessment ||
    assessment.level === "low"
  ) {
    return "";
  }

  const label =
    assessment.level === "high"
      ? "⚠️ Sprawdź dokładnie"
      : "ℹ️ Warto zweryfikować";

  return `
    <span class="risk-badge is-${escapeHtml(assessment.level)}">
      ${label}
    </span>
  `;
}

function riskWarningHtml(
  assessment
) {
  if (
    !assessment ||
    assessment.level === "low"
  ) {
    return "";
  }

  const reason =
    assessment.reasons.length
      ? assessment.reasons.join(" · ")
      : (
          assessment.level === "high"
            ? "oferta ma kilka nietypowych sygnałów"
            : "mamy mniej pewnych danych o tej ofercie"
        );

  const prefix =
    assessment.level === "high"
      ? "Strażnik okazji:"
      : "Warto sprawdzić:";

  return `
    <p class="risk-warning is-${escapeHtml(assessment.level)}">
      <strong>${prefix}</strong>
      ${escapeHtml(reason)}.
    </p>
  `;
}

function smartPickReason(
  type,
  group
) {
  const first =
    Array.isArray(group) &&
    group.length
      ? group[0]
      : {};

  const reasons =
    rankingReasons(first);

  if (
    type === "best" &&
    reasons.length
  ) {
    return (
      "Najmocniejszy wynik rankingu: " +
      reasons.slice(0, 2).join(" · ")
    );
  }

  if (type === "cheap") {
    return (
      "Najniższa cena wśród aktualnie " +
      "widocznych, prawidłowo dopasowanych produktów."
    );
  }

  if (
    type === "import" &&
    reasons.length
  ) {
    return (
      "Najwyżej oceniona oferta importowa: " +
      reasons.slice(0, 2).join(" · ")
    );
  }

  if (type === "import") {
    return (
      "Najlepsza aktualnie dostępna propozycja " +
      "z sekcji Import / Chiny."
    );
  }

  return (
    "Produkt wysoko oceniony przez ranking SmartZakupów."
  );
}

function buildSmartPicks(
  polishGroups,
  importGroups
) {
  const allGroups = [
    ...(Array.isArray(polishGroups)
      ? polishGroups.map(
          group => ({
            group,
            section: "polish"
          })
        )
      : []),
    ...(Array.isArray(importGroups)
      ? importGroups.map(
          group => ({
            group,
            section: "import"
          })
        )
      : [])
  ];

  if (!allGroups.length) {
    return [];
  }

  const guardedGroups =
    safeSmartPickCandidates(
      allGroups
    );

  const byScore = [...guardedGroups]
    .sort(
      (a, b) =>
        groupBestScore(b.group) -
        groupBestScore(a.group)
    );

  const best = byScore[0];

  const usedKeys = new Set();

  if (best) {
    usedKeys.add(
      productGroupAnchorId(
        best.group,
        best.section
      )
    );
  }

  const cheapestCandidates = [
    ...guardedGroups
  ].sort(
    (a, b) =>
      groupCheapestPrice(a.group) -
      groupCheapestPrice(b.group)
  );

  let cheapest =
    cheapestCandidates.find(
      item =>
        !usedKeys.has(
          productGroupAnchorId(
            item.group,
            item.section
          )
        )
    ) ||
    cheapestCandidates[0];

  if (cheapest) {
    usedKeys.add(
      productGroupAnchorId(
        cheapest.group,
        cheapest.section
      )
    );
  }

  const importCandidates = safeSmartPickCandidates(
    Array.isArray(importGroups)
      ? importGroups.map(
          group => ({
            group,
            section: "import"
          })
        )
      : []
  ).sort(
    (a, b) =>
      groupBestScore(b.group) -
      groupBestScore(a.group)
  );

  const bestImport =
    importCandidates.find(
      item =>
        !usedKeys.has(
          productGroupAnchorId(
            item.group,
            item.section
          )
        )
    ) ||
    importCandidates[0];

  const picks = [];

  if (best) {
    picks.push({
      type: "best",
      icon: "🏆",
      label: "Najlepszy wybór",
      ...best
    });
  }

  if (
    cheapest &&
    (
      !best ||
      productGroupAnchorId(
        cheapest.group,
        cheapest.section
      ) !==
      productGroupAnchorId(
        best.group,
        best.section
      )
    )
  ) {
    picks.push({
      type: "cheap",
      icon: "💰",
      label: "Najlepsza cena",
      ...cheapest
    });
  }

  if (
    bestImport &&
    (
      !best ||
      productGroupAnchorId(
        bestImport.group,
        bestImport.section
      ) !==
      productGroupAnchorId(
        best.group,
        best.section
      )
    ) &&
    (
      !cheapest ||
      productGroupAnchorId(
        bestImport.group,
        bestImport.section
      ) !==
      productGroupAnchorId(
        cheapest.group,
        cheapest.section
      )
    )
  ) {
    picks.push({
      type: "import",
      icon: "🌍",
      label: "Najlepszy import",
      ...bestImport
    });
  }

  return picks.slice(0, 3);
}


function smartPickCardHtml(pick) {
  const group = pick.group;
  const section = pick.section;

  const title =
    groupRepresentativeTitle(
      group
    );

  const source =
    groupRepresentativeSource(
      group,
      section
    );

  const representative =
    pick.type === "cheap"
      ? groupCheapestProduct(group)
      : groupBestProduct(group);

  const targetUrl =
    productOfferUrl(
      representative
    );

  const price =
    groupCheapestPrice(group);

  const priceText =
    Number.isFinite(price)
      ? formatPrice(price, 2)
      : "sprawdź cenę";

  const anchorId =
    productGroupAnchorId(
      group,
      section
    );

  const categoryIcon =
    String(
      lastCombinedPayload
        ?.query_profile
        ?.category_icon ||
      "🛍️"
    );

  const visual =
    representative.image_url
      ? `
        <a
          class="smart-pick-media"
          href="${escapeHtml(targetUrl)}"
          target="_blank"
          rel="nofollow sponsored noopener"
          aria-label="Otwórz produkt: ${escapeHtml(title)}">
          <img
            src="${escapeHtml(representative.image_url)}"
            alt="${escapeHtml(title)}"
            loading="lazy"
            referrerpolicy="no-referrer">
        </a>
      `
      : `
        <a
          class="smart-pick-media"
          href="${escapeHtml(targetUrl)}"
          target="_blank"
          rel="nofollow sponsored noopener"
          aria-label="Otwórz produkt: ${escapeHtml(title)}">
          <span aria-hidden="true">
            ${escapeHtml(categoryIcon)}
          </span>
        </a>
      `;

  return `
    <article class="smart-pick-card">
      <span class="smart-pick-type">
        ${pick.icon} ${escapeHtml(pick.label)}
      </span>

      <div class="smart-pick-product-row">
        ${visual}

        <div class="smart-pick-product-copy">
          <h4 title="${escapeHtml(title)}">
            <a
              class="smart-pick-title-link"
              href="${escapeHtml(targetUrl)}"
              target="_blank"
              rel="nofollow sponsored noopener">
              ${escapeHtml(title)}
            </a>
          </h4>

          <p class="smart-pick-reason">
            ${escapeHtml(
              smartPickReason(
                pick.type,
                group
              )
            )}
          </p>
        </div>
      </div>

      <div class="smart-pick-bottom">
        <div>
          <span class="smart-pick-price">
            ${priceText}
          </span>

          <span class="smart-pick-source">
            ${escapeHtml(source)}
          </span>
        </div>
      </div>

      <div class="smart-pick-actions">
        <a
          class="smart-pick-link"
          href="${escapeHtml(targetUrl)}"
          target="_blank"
          rel="nofollow sponsored noopener">
          🛒 Otwórz ofertę
        </a>

        <a
          class="offer-secondary-link"
          href="#${escapeHtml(anchorId)}">
          🔎 Pokaż w wynikach
        </a>

        ${saveProductButtonHtml(
          representative,
          section,
          true
        )}
      </div>
    </article>
  `;
}


function smartPicksHtml(
  polishGroups,
  importGroups
) {
  const picks =
    buildSmartPicks(
      polishGroups,
      importGroups
    );

  if (!picks.length) {
    return "";
  }

  return `
    <div class="deal-guard-note">
      <strong>🛡️ Strażnik okazji:</strong>
      oferty z mocnymi sygnałami ostrzegawczymi nie trafiają automatycznie
      do Smart wyboru, jeśli mamy bezpieczniejszą alternatywę.
    </div>

    <section class="smart-picks">
      <div class="smart-picks-head">
        <div>
          <p class="smart-picks-eyebrow">
            Szybka odpowiedź
          </p>
          <h3 class="smart-picks-title">
            Smart wybór
          </h3>
        </div>

        <p class="smart-picks-note">
          Nie musisz przeglądać wszystkich ofert.
          Oto najważniejsze propozycje z aktualnego zestawu.
        </p>
      </div>

      <div class="smart-picks-grid">
        ${picks
          .map(smartPickCardHtml)
          .join("")}
      </div>
    </section>
  `;
}

function groupPriorityMatches(group) {
  const matches = new Set();

  (Array.isArray(group) ? group : [])
    .forEach(product => {
      const values =
        Array.isArray(
          product?._priority_matches
        )
          ? product._priority_matches
          : [];

      values.forEach(
        value => matches.add(
          String(value)
        )
      );
    });

  return Array.from(matches);
}

function queryPriorityMap(data) {
  const profile =
    data?.query_profile ||
    {};

  const keys =
    Array.isArray(
      profile.priority_keys
    )
      ? profile.priority_keys
      : [];

  const labels =
    Array.isArray(
      profile.priority_labels
    )
      ? profile.priority_labels
      : [];

  const map = new Map();

  keys.forEach(
    (key, index) => {
      map.set(
        String(key),
        String(
          labels[index] ||
          key
        )
      );
    }
  );

  return map;
}

function pickPrice(pick) {
  return groupCheapestPrice(
    pick?.group || []
  );
}

function pickScore(pick) {
  return groupBestScore(
    pick?.group || []
  );
}

function pickSources(pick) {
  return Array.from(
    new Set(
      (Array.isArray(pick?.group)
        ? pick.group
        : [])
        .map(
          product =>
            productMarketplace(
              product,
              pick?.section
            )
        )
        .filter(Boolean)
    )
  );
}

function formatMoneyDifference(value) {
  const amount = Number(value);

  if (
    !Number.isFinite(amount) ||
    amount <= 0
  ) {
    return "";
  }

  return formatPrice(
    amount,
    2
  );
}

function advisorEvidence(group) {
  const representative =
    groupBestProduct(group);

  const reasons =
    rankingReasons(
      representative
    );

  const matches =
    groupPriorityMatches(group);

  const opinions =
    groupOpinionCount(group);

  const sources =
    new Set(
      (Array.isArray(group)
        ? group
        : [])
        .map(
          product =>
            productMarketplace(
              product,
              "polish"
            )
        )
        .filter(Boolean)
    ).size;

  let score = 0;

  if (reasons.length >= 2) {
    score += 2;
  } else if (reasons.length) {
    score += 1;
  }

  if (matches.length) {
    score += 2;
  }

  if (opinions >= 50) {
    score += 2;
  } else if (opinions > 0) {
    score += 1;
  }

  if (sources >= 2) {
    score += 1;
  }

  if (score >= 5) {
    return "wysoka";
  }

  if (score >= 2) {
    return "średnia";
  }

  return "ograniczona";
}

function advisorForWhom(
  pick,
  data
) {
  const profile =
    data?.query_profile ||
    {};

  const priorities =
    Array.isArray(
      profile.priority_labels
    )
      ? profile.priority_labels
      : [];

  if (
    pick.type === "best" &&
    priorities.length
  ) {
    return (
      "Dla osoby, która chce możliwie najlepszego " +
      "balansu pod Twoje wymagania: " +
      priorities.slice(0, 3).join(", ") +
      "."
    );
  }

  if (pick.type === "best") {
    return (
      "Dla osoby, która chce zacząć od najbardziej " +
      "kompletnej propozycji, a nie od najniższej ceny."
    );
  }

  if (pick.type === "cheap") {
    return (
      "Dla osoby, która chce przede wszystkim ograniczyć wydatek " +
      "i dopiero potem porównywać dodatkowe zalety."
    );
  }

  return (
    "Dla osoby, która akceptuje zakup z importu w zamian za " +
    "szerszy wybór lub ciekawszą relację ceny do parametrów."
  );
}

function advisorGain(
  pick,
  allPicks,
  data
) {
  const reasons =
    rankingReasons(
      groupBestProduct(
        pick.group
      )
    );

  const priorityMap =
    queryPriorityMap(data);

  const matched =
    groupPriorityMatches(
      pick.group
    );

  const matchedLabels =
    matched
      .map(
        key =>
          priorityMap.get(key) ||
          key
      )
      .filter(Boolean);

  if (
    matchedLabels.length
  ) {
    return (
      "Mamy konkretne sygnały dopasowania do: " +
      matchedLabels
        .slice(0, 3)
        .join(", ") +
      "."
    );
  }

  if (
    pick.type === "cheap"
  ) {
    const best =
      allPicks.find(
        item =>
          item.type === "best"
      );

    const difference =
      best
        ? (
            pickPrice(best) -
            pickPrice(pick)
          )
        : 0;

    const formatted =
      formatMoneyDifference(
        difference
      );

    if (formatted) {
      return (
        "Oszczędzasz około " +
        formatted +
        " względem najlepszego wyboru z tego zestawu."
      );
    }

    return (
      "To najniższa cena w aktualnie widocznym, " +
      "przefiltrowanym zestawie."
    );
  }

  if (reasons.length) {
    return (
      "Najmocniejsze argumenty w danych: " +
      reasons
        .slice(0, 2)
        .join(" · ") +
      "."
    );
  }

  return (
    "Ta propozycja wypada wysoko w aktualnym rankingu, " +
    "ale mamy mniej szczegółowych danych opisowych."
  );
}

function advisorWatchOut(
  pick,
  allPicks,
  data
) {
  const profile =
    data?.query_profile ||
    {};

  const priorityMap =
    queryPriorityMap(data);

  const requestedKeys =
    Array.isArray(
      profile.priority_keys
    )
      ? profile.priority_keys
          .map(String)
      : [];

  const matched =
    new Set(
      groupPriorityMatches(
        pick.group
      )
    );

  const risk =
    groupRiskAssessment(
      pick.group,
      pick.section
    );

  if (
    risk.level === "high"
  ) {
    return (
      "Strażnik okazji wykrył mocne sygnały ostrzegawcze: " +
      (
        risk.reasons.length
          ? risk.reasons.join(" · ")
          : "oferta wymaga dokładnej weryfikacji"
      ) +
      "."
    );
  }

  if (
    risk.level === "medium"
  ) {
    return (
      "Warto dodatkowo sprawdzić tę ofertę: " +
      (
        risk.reasons.length
          ? risk.reasons.join(" · ")
          : "mamy mniej pewnych danych"
      ) +
      "."
    );
  }

  const missing =
    requestedKeys
      .filter(
        key =>
          !matched.has(key)
      )
      .map(
        key =>
          priorityMap.get(key) ||
          key
      )
      .filter(Boolean);

  if (
    pick.type === "cheap"
  ) {
    const best =
      allPicks.find(
        item =>
          item.type === "best"
      );

    if (
      best &&
      pickScore(pick) <
        pickScore(best)
    ) {
      if (missing.length) {
        return (
          "Jest tańszy, ale mamy słabsze potwierdzenie dla: " +
          missing
            .slice(0, 2)
            .join(", ") +
          "."
        );
      }

      return (
        "Niższa cena oznacza też niższy wynik naszego rankingu " +
        "niż przy najlepszym wyborze."
      );
    }
  }

  if (
    pick.section === "import"
  ) {
    return (
      "To zakup importowy. Przed zakupem sprawdź w konkretnej ofercie " +
      "czas dostawy, warunki zwrotu i obsługę posprzedażową."
    );
  }

  if (missing.length) {
    return (
      "W zebranych danych nie mam mocnego potwierdzenia dla: " +
      missing
        .slice(0, 2)
        .join(", ") +
      ". Nie traktuję tego jako pewnika."
    );
  }

  const sources =
    pickSources(pick);

  if (sources.length === 1) {
    return (
      "Dla tej propozycji widzimy teraz jedno główne źródło zakupu. " +
      "Warto sprawdzić szczegóły konkretnej oferty."
    );
  }

  return (
    "Nie widzę tu oczywistej czerwonej flagi w dostępnych danych, " +
    "ale przed zakupem nadal sprawdź pełny opis oferty."
  );
}

function advisorOverallVerdict(
  picks,
  data
) {
  const best =
    picks.find(
      item =>
        item.type === "best"
    ) ||
    picks[0];

  if (!best) {
    return "";
  }

  const bestTitle =
    groupRepresentativeTitle(
      best.group
    );

  const cheap =
    picks.find(
      item =>
        item.type === "cheap"
    );

  const imported =
    picks.find(
      item =>
        item.type === "import"
    );

  let text =
    `Ja zacząłbym od „${bestTitle}”. `;

  const priorityMap =
    queryPriorityMap(data);

  const matched =
    groupPriorityMatches(
      best.group
    )
      .map(
        key =>
          priorityMap.get(key) ||
          key
      )
      .filter(Boolean);

  if (matched.length) {
    text +=
      "To propozycja, dla której mamy najlepsze potwierdzenie " +
      "dopasowania do Twoich wymagań: " +
      matched
        .slice(0, 3)
        .join(", ") +
      ". ";
  } else {
    text +=
      "W obecnym zestawie ma najwyższy wynik naszego rankingu. ";
  }

  if (cheap) {
    const saving =
      pickPrice(best) -
      pickPrice(cheap);

    const formatted =
      formatMoneyDifference(
        saving
      );

    if (formatted) {
      text +=
        `Jeśli wolisz zachować około ${formatted} w kieszeni, ` +
        `sprawdź też „${groupRepresentativeTitle(cheap.group)}”. `;
    }
  }

  if (imported) {
    text +=
      "Opcję importową traktowałbym jako alternatywę dla osoby, " +
      "która świadomie akceptuje inny sposób zakupu.";
  }

  return text.trim();
}

function advisorHonestyHtml(
  picks,
  data
) {
  const profile =
    data?.query_profile ||
    {};

  const requested =
    Array.isArray(
      profile.priority_keys
    )
      ? profile.priority_keys
          .map(String)
      : [];

  if (!requested.length) {
    return "";
  }

  const priorityMap =
    queryPriorityMap(data);

  const confirmed = new Set();

  picks.forEach(
    pick =>
      groupPriorityMatches(
        pick.group
      ).forEach(
        key =>
          confirmed.add(
            String(key)
          )
      )
  );

  const unconfirmed =
    requested
      .filter(
        key =>
          !confirmed.has(key)
      )
      .map(
        key =>
          priorityMap.get(key) ||
          key
      )
      .filter(Boolean);

  if (!unconfirmed.length) {
    return "";
  }

  return `
    <div class="advisor-honesty">
      <strong>Uczciwie o danych:</strong>
      w aktualnie zebranych opisach nie mam wystarczającego
      potwierdzenia dla:
      ${escapeHtml(
        unconfirmed.join(", ")
      )}.
      Nie będę udawać, że wiem to na pewno.
    </div>
  `;
}


function advisorOptionHtml(
  pick,
  picks,
  data
) {
  const title =
    groupRepresentativeTitle(
      pick.group
    );

  const price =
    pickPrice(pick);

  const priceText =
    Number.isFinite(price)
      ? formatPrice(
          price,
          2
        )
      : "sprawdź cenę";

  const product =
    pick.type === "cheap"
      ? groupCheapestProduct(
          pick.group
        )
      : groupBestProduct(
          pick.group
        );

  const targetUrl =
    productOfferUrl(product);

  const anchorId =
    productGroupAnchorId(
      pick.group,
      pick.section
    );

  const forWhom =
    advisorForWhom(
      pick,
      data
    );

  const gain =
    advisorGain(
      pick,
      picks,
      data
    );

  const watchOut =
    advisorWatchOut(
      pick,
      picks,
      data
    );

  return `
    <article class="advisor-option">
      <div class="advisor-option-name">
        <div class="advisor-option-name-top">
          ${
            product.image_url
              ? `
                <a
                  class="advisor-option-media"
                  href="${escapeHtml(targetUrl)}"
                  target="_blank"
                  rel="nofollow sponsored noopener"
                  aria-label="Otwórz produkt: ${escapeHtml(title)}">
                  <img
                    class="real-product-image"
                    src="${escapeHtml(product.image_url)}"
                    alt="${escapeHtml(title)}"
                    loading="lazy"
                    referrerpolicy="no-referrer">
                </a>
              `
              : `
                <a
                  class="advisor-option-media"
                  href="${escapeHtml(targetUrl)}"
                  target="_blank"
                  rel="nofollow sponsored noopener"
                  aria-label="Otwórz produkt: ${escapeHtml(title)}">
                  🛍️
                </a>
              `
          }

          <div class="advisor-option-copy">
            <span class="advisor-option-label">
              ${pick.icon} ${escapeHtml(pick.label)}
            </span>

            <h4 title="${escapeHtml(title)}">
              <a
                class="advisor-title-link"
                href="${escapeHtml(targetUrl)}"
                target="_blank"
                rel="nofollow sponsored noopener">
                ${escapeHtml(title)}
              </a>
            </h4>

            <span class="advisor-option-price">
              ${priceText}
            </span>
          </div>
        </div>

        <div class="advisor-option-actions">
          <a
            class="offer-secondary-link"
            href="${escapeHtml(targetUrl)}"
            target="_blank"
            rel="nofollow sponsored noopener">
            🔗 Produkt
          </a>

          <a
            class="offer-secondary-link"
            href="#${escapeHtml(anchorId)}">
            🧭 Karta
          </a>

          ${saveProductButtonHtml(
            product,
            pick.section,
            true
          )}
        </div>
      </div>

      <div class="advisor-option-body">
        <div class="advisor-point">
          <span class="advisor-point-title">
            Dla kogo
          </span>

          <p title="${escapeHtml(forWhom)}">
            ${escapeHtml(forWhom)}
          </p>
        </div>

        <div class="advisor-point">
          <span class="advisor-point-title">
            Co zyskujesz
          </span>

          <p title="${escapeHtml(gain)}">
            ${escapeHtml(gain)}
          </p>
        </div>

        <div class="advisor-point">
          <span class="advisor-point-title">
            Na co uważać
          </span>

          <p title="${escapeHtml(watchOut)}">
            ${escapeHtml(watchOut)}
          </p>
        </div>
      </div>
    </article>
  `;
}


function finalDecisionItems(
  polishGroups,
  importGroups
) {
  return [
    ...(Array.isArray(polishGroups)
      ? polishGroups.map(
          group => ({
            group,
            section: "polish"
          })
        )
      : []),
    ...(Array.isArray(importGroups)
      ? importGroups.map(
          group => ({
            group,
            section: "import"
          })
        )
      : [])
  ];
}

function finalDecisionPrice(item) {
  return groupCheapestPrice(
    item.group
  );
}

function finalDecisionScore(item) {
  return groupBestScore(
    item.group
  );
}

function finalDecisionRisk(item) {
  return groupRiskAssessment(
    item.group,
    item.section
  );
}

function finalDecisionPriorityLabels(
  item,
  data
) {
  const map =
    queryPriorityMap(data);

  return groupPriorityMatches(
    item.group
  )
    .map(
      key =>
        map.get(key) ||
        key
    )
    .filter(Boolean);
}

function finalDecisionConfidence(
  item
) {
  let confidence =
    advisorEvidence(
      item.group
    );

  const risk =
    finalDecisionRisk(item);

  if (
    risk.level === "medium" &&
    confidence === "wysoka"
  ) {
    confidence = "średnia";
  }

  return confidence;
}

function finalDecisionAnalysis(
  polishGroups,
  importGroups,
  data
) {
  const profile =
    data?.query_profile ||
    {};

  const budget =
    Number(
      profile.budget_max
    );

  const allItems =
    finalDecisionItems(
      polishGroups,
      importGroups
    )
      .filter(
        item =>
          Number.isFinite(
            finalDecisionPrice(item)
          )
      );

  if (!allItems.length) {
    return {
      available: false,
      reason:
        "Nie mam wystarczających danych, żeby wskazać jeden produkt."
    };
  }

  const safeItems =
    allItems.filter(
      item =>
        finalDecisionRisk(item)
          .level !== "high"
    );

  if (!safeItems.length) {
    return {
      available: false,
      reason:
        "Wszystkie widoczne propozycje mają mocne sygnały ostrzegawcze. Nie wybiorę jednej na siłę."
    };
  }

  let candidatePool =
    safeItems;

  let budgetState =
    "bez limitu";

  if (
    Number.isFinite(budget) &&
    budget > 0
  ) {
    const inBudget =
      safeItems.filter(
        item =>
          finalDecisionPrice(item) <=
          budget
      );

    if (inBudget.length) {
      candidatePool =
        inBudget;
      budgetState =
        "w budżecie";
    } else {
      const sortedByPrice =
        [...safeItems].sort(
          (a, b) =>
            finalDecisionPrice(a) -
            finalDecisionPrice(b)
        );

      candidatePool = [
        sortedByPrice[0]
      ];

      budgetState =
        "najbliżej budżetu";
    }
  }

  candidatePool.sort(
    (a, b) => {
      const scoreDifference =
        finalDecisionScore(b) -
        finalDecisionScore(a);

      if (scoreDifference !== 0) {
        return scoreDifference;
      }

      const priorityDifference =
        finalDecisionPriorityLabels(
          b,
          data
        ).length -
        finalDecisionPriorityLabels(
          a,
          data
        ).length;

      if (priorityDifference !== 0) {
        return priorityDifference;
      }

      return (
        groupOpinionCount(
          b.group
        ) -
        groupOpinionCount(
          a.group
        )
      );
    }
  );

  const winner =
    candidatePool[0];

  const alternatives =
    safeItems
      .filter(
        item =>
          item !== winner
      );

  const cheapestAlternative =
    [...alternatives]
      .sort(
        (a, b) =>
          finalDecisionPrice(a) -
          finalDecisionPrice(b)
      )[0] ||
    null;

  const bestImport =
    [...alternatives]
      .filter(
        item =>
          item.section === "import"
      )
      .sort(
        (a, b) =>
          finalDecisionScore(b) -
          finalDecisionScore(a)
      )[0] ||
    null;

  return {
    available: true,
    winner,
    budget,
    budgetState,
    confidence:
      finalDecisionConfidence(
        winner
      ),
    priorities:
      finalDecisionPriorityLabels(
        winner,
        data
      ),
    reasons:
      rankingReasons(
        groupBestProduct(
          winner.group
        )
      ),
    cheapestAlternative,
    bestImport
  };
}

function finalDecisionStatusLabel(
  analysis
) {
  if (
    analysis.confidence === "wysoka"
  ) {
    return "🏆 To mój finalny wybór";
  }

  if (
    analysis.confidence === "średnia"
  ) {
    return "✓ To najrozsądniejszy wybór";
  }

  return "🔎 To najlepszy trop";
}

function finalDecisionWhyText(
  analysis
) {
  const parts = [];

  if (analysis.priorities.length) {
    parts.push(
      "ma potwierdzone dopasowanie do: " +
      analysis.priorities
        .slice(0, 3)
        .join(", ")
    );
  }

  if (analysis.reasons.length) {
    parts.push(
      analysis.reasons
        .slice(0, 2)
        .join(" · ")
    );
  }

  const opinions =
    groupOpinionCount(
      analysis.winner.group
    );

  if (opinions >= 50) {
    parts.push(
      `opiera się na ${opinions} opiniach`
    );
  }

  if (!parts.length) {
    parts.push(
      "ma najwyższy bezpieczny wynik rankingu w aktualnym zestawie"
    );
  }

  return (
    "Wybieram go, ponieważ " +
    parts.join("; ") +
    "."
  );
}

function finalDecisionRejectedText(
  analysis
) {
  const winner =
    analysis.winner;

  const alternatives = [];

  const cheaper =
    analysis.cheapestAlternative;

  if (
    cheaper &&
    finalDecisionPrice(cheaper) <
      finalDecisionPrice(winner)
  ) {
    const saving =
      finalDecisionPrice(winner) -
      finalDecisionPrice(cheaper);

    const scoreLoss =
      finalDecisionScore(winner) -
      finalDecisionScore(cheaper);

    let text =
      `Tańsza opcja „${groupRepresentativeTitle(cheaper.group)}” ` +
      `pozwala oszczędzić około ${formatPrice(saving, 2)}`;

    if (scoreLoss > 0) {
      text +=
        `, ale ma wynik rankingu niższy o około ${Math.round(scoreLoss)} pkt`;
    }

    alternatives.push(
      text + "."
    );
  }

  const imported =
    analysis.bestImport;

  if (
    imported &&
    imported !== cheaper
  ) {
    alternatives.push(
      `Opcję importową „${groupRepresentativeTitle(imported.group)}” ` +
      "zostawiam jako alternatywę dla osoby, która świadomie akceptuje inny czas dostawy i obsługę zwrotu."
    );
  }

  if (!alternatives.length) {
    return (
      "Nie widzę w aktualnym zestawie innej propozycji, " +
      "która dawałaby wyraźnie lepszy kompromis."
    );
  }

  return alternatives.join(" ");
}

function finalDecisionHonestyText(
  analysis
) {
  const risk =
    finalDecisionRisk(
      analysis.winner
    );

  if (
    analysis.confidence === "ograniczona"
  ) {
    return (
      "Dane są ograniczone. To najlepszy dostępny trop, " +
      "ale przed zakupem sprawdź pełny opis, wariant produktu i warunki sprzedawcy."
    );
  }

  if (risk.level === "medium") {
    return (
      "Produkt ma umiarkowany sygnał do dodatkowej weryfikacji. " +
      "Sprawdź dokładnie konkretną ofertę przed płatnością."
    );
  }

  return (
    "Decyzja opiera się wyłącznie na cenie, opisach, ocenach, opiniach " +
    "i danych dostępnych w aktualnym zestawie. Nie udajemy testu laboratoryjnego produktu."
  );
}

function finalDecisionBestUrl(
  analysis
) {
  const product =
    groupBestProduct(
      analysis.winner.group
    );

  return safeUrl(
    product?.affiliate_url ||
    product?.url
  );
}


function finalDecisionLauncherHtml(
  polishGroups,
  importGroups,
  data
) {
  const analysis =
    finalDecisionAnalysis(
      polishGroups,
      importGroups,
      data
    );

  if (
    !analysis.available
  ) {
    return "";
  }

  const winner =
    groupBestProduct(
      analysis.winner.group
    );

  const targetUrl =
    productOfferUrl(winner);

  const source =
    productMarketplace(
      winner,
      analysis.winner.section
    );

  const price =
    finalDecisionPrice(
      analysis.winner
    );

  const image =
    winner.image_url
      ? `
        <a
          class="final-decision-preview-media"
          href="${escapeHtml(targetUrl)}"
          target="_blank"
          rel="nofollow sponsored noopener"
          aria-label="Otwórz produkt: ${escapeHtml(winner.title)}">
          <img
            class="real-product-image"
            src="${escapeHtml(winner.image_url)}"
            alt="${escapeHtml(winner.title)}"
            loading="lazy"
            referrerpolicy="no-referrer">
        </a>
      `
      : `
        <a
          class="final-decision-preview-media"
          href="${escapeHtml(targetUrl)}"
          target="_blank"
          rel="nofollow sponsored noopener"
          aria-label="Otwórz produkt: ${escapeHtml(winner.title)}">
          🛍️
        </a>
      `;

  return `
    <section class="final-decision-launcher">
      <div class="final-decision-launcher-main">
        <div>
          <h3>
            Masz już dość porównywania?
          </h3>

          <p>
            Kliknij, a SmartZakupy wskażą jeden finalny produkt
            i uczciwie wyjaśnią, dlaczego właśnie ten.
          </p>
        </div>

        <div class="final-decision-preview">
          ${image}

          <div class="final-decision-preview-copy">
            <span class="final-decision-preview-label">
              ⭐ Aktualny lider zestawu
            </span>

            <h4 class="final-decision-preview-title">
              <a
                class="final-decision-preview-link"
                href="${escapeHtml(targetUrl)}"
                target="_blank"
                rel="nofollow sponsored noopener">
                ${escapeHtml(
                  winner.title ||
                  groupRepresentativeTitle(
                    analysis.winner.group
                  )
                )}
              </a>
            </h4>

            <div class="final-decision-preview-meta">
              ${escapeHtml(source)}
              ·
              ${
                Number.isFinite(price)
                  ? formatPrice(price, 2)
                  : "sprawdź cenę"
              }
            </div>

            <div class="offer-extra-actions">
              <a
                class="final-decision-preview-button"
                href="${escapeHtml(targetUrl)}"
                target="_blank"
                rel="nofollow sponsored noopener">
                🛒 Otwórz ofertę
              </a>

              ${saveProductButtonHtml(
                winner,
                analysis.winner.section,
                true
              )}
            </div>
          </div>
        </div>
      </div>

      <button
        type="button"
        class="final-decision-open"
        data-final-decision-open>
        Wybierz za mnie
      </button>
    </section>
  `;
}


function ensureFinalDecisionUi() {
  if (
    document.getElementById(
      "finalDecisionBackdrop"
    )
  ) {
    return;
  }

  const backdrop =
    document.createElement(
      "div"
    );

  backdrop.id =
    "finalDecisionBackdrop";

  backdrop.className =
    "final-decision-backdrop";

  backdrop.hidden = true;

  backdrop.innerHTML = `
    <section
      class="final-decision-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="finalDecisionTitle">
      <div class="final-decision-head">
        <div>
          <p class="final-decision-eyebrow">
            Decyzja w 30 sekund
          </p>

          <h2 id="finalDecisionTitle">
            Wybierz za mnie
          </h2>
        </div>

        <button
          type="button"
          class="final-decision-close"
          data-final-decision-close
          aria-label="Zamknij">
          ✕
        </button>
      </div>

      <div
        class="final-decision-body"
        id="finalDecisionBody">
      </div>
    </section>
  `;

  document.body.appendChild(
    backdrop
  );
}

function finalDecisionModalHtml(
  analysis
) {
  if (!analysis.available) {
    return `
      <div class="final-decision-refusal">
        <strong>Nie wybiorę na siłę.</strong><br>
        ${escapeHtml(analysis.reason)}
      </div>
    `;
  }

  const winner =
    analysis.winner;

  const product =
    groupBestProduct(
      winner.group
    );

  const title =
    groupRepresentativeTitle(
      winner.group
    );

  const price =
    finalDecisionPrice(
      winner
    );

  const source =
    groupRepresentativeSource(
      winner.group,
      winner.section
    );

  const anchorId =
    productGroupAnchorId(
      winner.group,
      winner.section
    );

  return `
    <article class="final-decision-result">
      <div class="final-decision-status">
        <span class="final-decision-badge">
          ${escapeHtml(
            finalDecisionStatusLabel(
              analysis
            )
          )}
        </span>

        <span class="final-decision-confidence">
          Pewność: ${escapeHtml(analysis.confidence)}
          · ${escapeHtml(analysis.budgetState)}
        </span>
      </div>

      <h3 class="final-decision-product">
        ${escapeHtml(title)}
      </h3>

      <span class="final-decision-price">
        ${formatPrice(price, 2)}
      </span>

      <span class="final-decision-source">
        ${escapeHtml(source)}
      </span>

      <div class="final-decision-grid">
        <section class="final-decision-section">
          <h4>Dlaczego ten</h4>
          <p>
            ${escapeHtml(
              finalDecisionWhyText(
                analysis
              )
            )}
          </p>
        </section>

        <section class="final-decision-section">
          <h4>Dlaczego nie pozostałe</h4>
          <p>
            ${escapeHtml(
              finalDecisionRejectedText(
                analysis
              )
            )}
          </p>
        </section>
      </div>

      <p class="final-decision-honesty">
        <strong>Uczciwie:</strong>
        ${escapeHtml(
          finalDecisionHonestyText(
            analysis
          )
        )}
      </p>

      <div class="final-decision-actions">
        <a
          class="final-decision-action primary"
          href="${escapeHtml(
            finalDecisionBestUrl(
              analysis
            )
          )}"
          target="_blank"
          rel="nofollow sponsored noopener">
          Zobacz najlepszą ofertę
        </a>

        <a
          class="final-decision-action secondary"
          href="#${escapeHtml(anchorId)}"
          data-final-decision-card>
          Zobacz pełną kartę
        </a>

        ${saveProductButtonHtml(
          product,
          winner.section,
          true
        )}
      </div>
    </article>
  `;
}

function openFinalDecisionModal() {
  ensureFinalDecisionUi();

  const context =
    finalDecisionContext;

  if (!context) {
    return;
  }

  const analysis =
    finalDecisionAnalysis(
      context.polishGroups,
      context.importGroups,
      context.data
    );

  const backdrop =
    document.getElementById(
      "finalDecisionBackdrop"
    );

  const body =
    document.getElementById(
      "finalDecisionBody"
    );

  body.innerHTML =
    finalDecisionModalHtml(
      analysis
    );

  backdrop.hidden = false;
  document.body.style.overflow =
    "hidden";

  openAccessibleLayer(
    backdrop.querySelector(
      ".final-decision-modal"
    )
  );

  announceAccessibility(
    "Otwarto finalną rekomendację produktu."
  );

  const cardLink =
    body.querySelector(
      "[data-final-decision-card]"
    );

  if (cardLink) {
    cardLink.addEventListener(
      "click",
      () => {
        closeFinalDecisionModal();
      }
    );
  }
}

function closeFinalDecisionModal() {
  const backdrop =
    document.getElementById(
      "finalDecisionBackdrop"
    );

  if (backdrop) {
    closeAccessibleLayer(
      backdrop.querySelector(
        ".final-decision-modal"
      )
    );

    backdrop.hidden = true;
  }

  document.body.style.overflow =
    "";
}

function bindFinalDecisionLaunchers() {
  document
    .querySelectorAll(
      "[data-final-decision-open]"
    )
    .forEach(
      button => {
        button.addEventListener(
          "click",
          openFinalDecisionModal
        );
      }
    );
}

function bindFinalDecisionModalControls() {
  ensureFinalDecisionUi();

  const backdrop =
    document.getElementById(
      "finalDecisionBackdrop"
    );

  const close =
    backdrop.querySelector(
      "[data-final-decision-close]"
    );

  close.addEventListener(
    "click",
    closeFinalDecisionModal
  );

  backdrop.addEventListener(
    "click",
    event => {
      if (
        event.target === backdrop
      ) {
        closeFinalDecisionModal();
      }
    }
  );

  document.addEventListener(
    "keydown",
    event => {
      if (
        event.key === "Escape" &&
        !backdrop.hidden
      ) {
        closeFinalDecisionModal();
      }
    }
  );
}

function budgetGroupItems(
  polishGroups,
  importGroups
) {
  return [
    ...(Array.isArray(polishGroups)
      ? polishGroups.map(
          group => ({
            group,
            section: "polish"
          })
        )
      : []),
    ...(Array.isArray(importGroups)
      ? importGroups.map(
          group => ({
            group,
            section: "import"
          })
        )
      : [])
  ];
}

function budgetGroupPrice(item) {
  return groupCheapestPrice(
    item.group
  );
}

function budgetGroupScore(item) {
  return groupBestScore(
    item.group
  );
}

function budgetGroupPriorityKeys(item) {
  return groupPriorityMatches(
    item.group
  );
}

function budgetGroupSafeEnough(item) {
  return (
    groupRiskAssessment(
      item.group,
      item.section
    ).level !== "high"
  );
}

function budgetUpgradeAnalysis(
  polishGroups,
  importGroups,
  data
) {
  const profile =
    data?.query_profile ||
    {};

  const budget =
    Number(
      profile.budget_max
    );

  if (
    !Number.isFinite(budget) ||
    budget <= 0
  ) {
    return null;
  }

  const allItems =
    budgetGroupItems(
      polishGroups,
      importGroups
    )
      .filter(
        item =>
          Number.isFinite(
            budgetGroupPrice(item)
          )
      )
      .filter(
        budgetGroupSafeEnough
      );

  const inBudget =
    allItems
      .filter(
        item =>
          budgetGroupPrice(item) <=
          budget
      )
      .sort(
        (a, b) =>
          budgetGroupScore(b) -
          budgetGroupScore(a)
      );

  const nearBudget =
    allItems
      .filter(
        item =>
          budgetGroupPrice(item) >
            budget &&
          budgetGroupPrice(item) <=
            budget * 1.20
      )
      .sort(
        (a, b) => {
          const scoreDifference =
            budgetGroupScore(b) -
            budgetGroupScore(a);

          if (scoreDifference !== 0) {
            return scoreDifference;
          }

          return (
            budgetGroupPrice(a) -
            budgetGroupPrice(b)
          );
        }
      );

  if (
    !inBudget.length ||
    !nearBudget.length
  ) {
    return null;
  }

  const base =
    inBudget[0];

  const upgrade =
    nearBudget[0];

  const extraCost =
    budgetGroupPrice(upgrade) -
    budgetGroupPrice(base);

  const scoreGain =
    budgetGroupScore(upgrade) -
    budgetGroupScore(base);

  const basePriorities =
    new Set(
      budgetGroupPriorityKeys(base)
    );

  const upgradePriorities =
    budgetGroupPriorityKeys(upgrade);

  const extraPriorityKeys =
    upgradePriorities.filter(
      key =>
        !basePriorities.has(key)
    );

  const priorityMap =
    queryPriorityMap(data);

  const extraPriorityLabels =
    extraPriorityKeys
      .map(
        key =>
          priorityMap.get(key) ||
          key
      )
      .filter(Boolean);

  const baseOpinions =
    groupOpinionCount(
      base.group
    );

  const upgradeOpinions =
    groupOpinionCount(
      upgrade.group
    );

  const opinionGain =
    upgradeOpinions -
    baseOpinions;

  const upgradeRisk =
    groupRiskAssessment(
      upgrade.group,
      upgrade.section
    );

  const meaningfulGain =
    (
      extraPriorityLabels.length > 0
    ) ||
    scoreGain >= 8 ||
    (
      scoreGain >= 4 &&
      opinionGain >= 100
    );

  const riskPenalty =
    upgradeRisk.level === "medium";

  const worth =
    meaningfulGain &&
    !(
      riskPenalty &&
      scoreGain < 10 &&
      extraPriorityLabels.length === 0
    );

  return {
    budget,
    base,
    upgrade,
    extraCost,
    scoreGain,
    extraPriorityLabels,
    baseOpinions,
    upgradeOpinions,
    opinionGain,
    worth
  };
}

function budgetUpgradeReasons(
  analysis
) {
  const reasons = [];

  if (
    analysis.extraPriorityLabels.length
  ) {
    reasons.push(
      "lepsze potwierdzenie: " +
      analysis.extraPriorityLabels
        .slice(0, 3)
        .join(", ")
    );
  }

  if (
    analysis.scoreGain >= 4
  ) {
    reasons.push(
      "wynik rankingu wyższy o " +
      Math.round(
        analysis.scoreGain
      ) +
      " pkt"
    );
  }

  if (
    analysis.opinionGain >= 100
  ) {
    reasons.push(
      "więcej opinii użytkowników"
    );
  }

  return reasons;
}

function budgetUpgradeVerdict(
  analysis
) {
  const extraCost =
    formatPrice(
      analysis.extraCost,
      2
    );

  const baseTitle =
    groupRepresentativeTitle(
      analysis.base.group
    );

  const upgradeTitle =
    groupRepresentativeTitle(
      analysis.upgrade.group
    );

  const reasons =
    budgetUpgradeReasons(
      analysis
    );

  if (analysis.worth) {
    return (
      `Warto rozważyć dopłatę około ${extraCost} do „${upgradeTitle}”. ` +
      (
        reasons.length
          ? (
              "W dostępnych danych zyskujesz: " +
              reasons.join(" · ") +
              "."
            )
          : (
              "Ta propozycja wypada zauważalnie lepiej w rankingu."
            )
      )
    );
  }

  return (
    `Nie widzę mocnego powodu, żeby przekraczać budżet. ` +
    `„${baseTitle}” daje lepszą relację ceny do dostępnych danych, ` +
    `a dopłata około ${extraCost} nie przynosi wystarczająco wyraźnej korzyści.`
  );
}


function budgetUpgradeCardHtml(
  item,
  label,
  description
) {
  const title =
    groupRepresentativeTitle(
      item.group
    );

  const price =
    budgetGroupPrice(item);

  const score =
    budgetGroupScore(item);

  const opinions =
    groupOpinionCount(
      item.group
    );

  const source =
    groupRepresentativeSource(
      item.group,
      item.section
    );

  const anchorId =
    productGroupAnchorId(
      item.group,
      item.section
    );

  const product =
    groupBestProduct(
      item.group
    );

  const targetUrl =
    productOfferUrl(product);

  const image =
    product.image_url
      ? `
        <a
          class="offer-image-link"
          href="${escapeHtml(targetUrl)}"
          target="_blank"
          rel="nofollow sponsored noopener"
          aria-label="Otwórz produkt: ${escapeHtml(title)}">
          <img
            class="real-product-image"
            src="${escapeHtml(product.image_url)}"
            alt="${escapeHtml(title)}"
            loading="lazy"
            referrerpolicy="no-referrer">
        </a>
      `
      : `
        <a
          class="offer-image-link"
          href="${escapeHtml(targetUrl)}"
          target="_blank"
          rel="nofollow sponsored noopener"
          aria-label="Otwórz produkt: ${escapeHtml(title)}">
          <span class="offer-icon-badge">🛍️</span>
        </a>
      `;

  return `
    <article class="budget-upgrade-card">
      <div class="budget-upgrade-visual">
        ${image}
      </div>

      <span class="budget-upgrade-label">
        ${escapeHtml(label)}
      </span>

      <h4>
        <a
          class="budget-upgrade-title-link"
          href="${escapeHtml(targetUrl)}"
          target="_blank"
          rel="nofollow sponsored noopener">
          ${escapeHtml(title)}
        </a>
      </h4>

      <span class="budget-upgrade-price">
        ${formatPrice(price, 2)}
      </span>

      <p class="budget-upgrade-description">
        ${escapeHtml(description)}
      </p>

      <div class="budget-upgrade-facts">
        <span class="budget-upgrade-fact">
          ${escapeHtml(source)}
        </span>

        <span class="budget-upgrade-fact">
          ranking ${Math.round(score)} pkt
        </span>

        ${
          opinions > 0
            ? `
              <span class="budget-upgrade-fact">
                ${escapeHtml(opinions)} opinii
              </span>
            `
            : ""
        }
      </div>

      <div class="budget-upgrade-actions">
        <a
          class="budget-upgrade-link is-primary"
          href="${escapeHtml(targetUrl)}"
          target="_blank"
          rel="nofollow sponsored noopener">
          🛒 Zobacz ofertę
        </a>

        <a
          class="budget-upgrade-link is-secondary"
          href="#${escapeHtml(anchorId)}">
          🔎 Zobacz pełną kartę
        </a>

        ${saveProductButtonHtml(
          product,
          item.section,
          true
        )}
      </div>
    </article>
  `;
}


function budgetUpgradeHtml(
  polishGroups,
  importGroups,
  data
) {
  const analysis =
    budgetUpgradeAnalysis(
      polishGroups,
      importGroups,
      data
    );

  if (!analysis) {
    return "";
  }

  const upgradeReasons =
    budgetUpgradeReasons(
      analysis
    );

  const baseDescription =
    "Najlepiej oceniona bezpieczna propozycja, która mieści się w zadanym budżecie.";

  const upgradeDescription =
    upgradeReasons.length
      ? (
          "Dopłata może dać: " +
          upgradeReasons.join(" · ") +
          "."
        )
      : (
          "Najwyżej oceniona sensowna propozycja do 20% powyżej budżetu."
        );

  return `
    <section class="budget-upgrade">
      <div class="budget-upgrade-head">
        <div>
          <p class="budget-upgrade-eyebrow">
            Granica budżetu
          </p>

          <h3 class="budget-upgrade-title">
            Czy warto dopłacić?
          </h3>
        </div>

        <span class="budget-upgrade-limit">
          sprawdzamy maks. +20%
        </span>
      </div>

      <p class="budget-upgrade-verdict ${
        analysis.worth
          ? "is-worth"
          : "is-not-worth"
      }">
        <strong>Moja rada:</strong>
        ${escapeHtml(
          budgetUpgradeVerdict(
            analysis
          )
        )}
      </p>

      <div class="budget-upgrade-grid">
        ${budgetUpgradeCardHtml(
          analysis.base,
          "✓ W budżecie",
          baseDescription
        )}

        ${budgetUpgradeCardHtml(
          analysis.upgrade,
          `+ ${formatPrice(
            analysis.extraCost,
            2
          )}`,
          upgradeDescription
        )}
      </div>

      <p class="budget-upgrade-honesty">
        Nie namawiamy automatycznie do droższego zakupu.
        Dopłata jest uznana za sensowną tylko wtedy, gdy dostępne dane
        pokazują wyraźną korzyść.
      </p>
    </section>
  `;
}

function shoppingAdvisorHtml(
  polishGroups,
  importGroups,
  data
) {
  const picks =
    buildSmartPicks(
      polishGroups,
      importGroups
    );

  if (!picks.length) {
    return "";
  }

  const confidenceLevels =
    picks.map(
      pick =>
        advisorEvidence(
          pick.group
        )
    );

  const confidence =
    confidenceLevels.includes(
      "ograniczona"
    )
      ? "ograniczona"
      : (
          confidenceLevels.includes(
            "średnia"
          )
            ? "średnia"
            : "wysoka"
        );

  const verdict =
    advisorOverallVerdict(
      picks,
      data
    );

  return `
    <section class="shopping-advisor">
      <div class="shopping-advisor-head">
        <div>
          <p class="shopping-advisor-eyebrow">
            Doradca zakupowy
          </p>

          <h3 class="shopping-advisor-title">
            Jak bym to wybrał?
          </h3>

          <p class="shopping-advisor-intro">
            Nie chcę zostawić Cię z samą tabelą wyników.
            Poniżej masz praktyczne różnice między najważniejszymi
            opcjami — tylko na podstawie danych, które faktycznie mamy.
          </p>
        </div>

        <span class="advisor-confidence">
          Pewność porównania: ${escapeHtml(confidence)}
        </span>
      </div>

      ${
        verdict
          ? `
            <p class="advisor-verdict">
              <strong>Moja rada:</strong>
              ${escapeHtml(verdict)}
            </p>
          `
          : ""
      }

      <div class="advisor-options">
        ${picks
          .map(
            pick =>
              advisorOptionHtml(
                pick,
                picks,
                data
              )
          )
          .join("")}
      </div>

      ${advisorHonestyHtml(
        picks,
        data
      )}
    </section>
  `;
}

function comparisonKey(group, section) {
  return productGroupAnchorId(group, section);
}

function prepareComparisonCandidates(
  polishGroups,
  importGroups
) {
  comparisonCandidates.clear();

  [
    ...(polishGroups || []).map(
      group => ({
        group,
        section: "polish"
      })
    ),
    ...(importGroups || []).map(
      group => ({
        group,
        section: "import"
      })
    )
  ].forEach(item => {
    const key =
      comparisonKey(
        item.group,
        item.section
      );

    comparisonCandidates.set(
      key,
      {
        ...item,
        key
      }
    );
  });

  Array.from(
    comparisonSelection
  ).forEach(key => {
    if (!comparisonCandidates.has(key)) {
      comparisonSelection.delete(key);
    }
  });
}

function comparisonButtonHtml(group, section) {
  const key =
    comparisonKey(group, section);

  const selected =
    comparisonSelection.has(key);

  return `
    <div class="compare-action-row">
      <button
        type="button"
        class="compare-toggle-button ${
          selected ? "is-selected" : ""
        }"
        data-compare-key="${escapeHtml(key)}">
        ${
          selected
            ? "✓ Dodano do porównania"
            : "Porównaj ten produkt"
        }
      </button>
    </div>
  `;
}

function ensureComparisonUi() {
  if (!document.getElementById("compareTray")) {
    const tray =
      document.createElement("aside");

    tray.id = "compareTray";
    tray.className = "compare-tray";
    tray.hidden = true;
    document.body.appendChild(tray);
  }

  if (!document.getElementById("compareModalBackdrop")) {
    const backdrop =
      document.createElement("div");

    backdrop.id =
      "compareModalBackdrop";
    backdrop.className =
      "compare-modal-backdrop";
    backdrop.hidden = true;

    backdrop.innerHTML = `
      <section
        class="compare-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="compareModalTitle">
        <div class="compare-modal-head">
          <div>
            <small>OSTATNI KROK DECYZJI</small>
            <h2 id="compareModalTitle">
              Porównanie Twoich typów
            </h2>
          </div>
          <button
            type="button"
            class="compare-modal-close"
            data-compare-close
            aria-label="Zamknij porównanie">
            ✕
          </button>
        </div>
        <div
          class="compare-modal-body"
          id="compareModalBody">
        </div>
      </section>
    `;

    document.body.appendChild(backdrop);
  }
}

function selectedComparisonItems() {
  return Array.from(
    comparisonSelection
  )
    .map(
      key =>
        comparisonCandidates.get(key)
    )
    .filter(Boolean);
}

function itemTitle(item) {
  return groupRepresentativeTitle(
    item.group
  );
}

function itemPrice(item) {
  return groupCheapestPrice(
    item.group
  );
}

function itemRisk(item) {
  return groupRiskAssessment(
    item.group,
    item.section
  );
}

function itemPriorities(item, data) {
  const map =
    queryPriorityMap(data);

  return groupPriorityMatches(
    item.group
  )
    .map(
      key =>
        map.get(key) || key
    )
    .filter(Boolean);
}

function itemBestUrl(item) {
  const product =
    groupBestProduct(item.group);

  return safeUrl(
    product?.affiliate_url ||
    product?.url
  );
}

function comparisonVerdict(items, data) {
  const ranked = [...items].sort(
    (a, b) =>
      groupBestScore(b.group) -
      groupBestScore(a.group)
  );

  const priced = [...items].sort(
    (a, b) =>
      itemPrice(a) -
      itemPrice(b)
  );

  const safe = [...items].sort(
    (a, b) =>
      itemRisk(a).score -
      itemRisk(b).score
  );

  const winner = ranked[0];
  const cheapest = priced[0];
  const safest = safe[0];

  let text =
    `Z tej grupy zacząłbym od „${itemTitle(winner)}”, ` +
    "bo ma najwyższy wynik rankingu. ";

  if (cheapest.key !== winner.key) {
    const difference =
      itemPrice(winner) -
      itemPrice(cheapest);

    if (
      Number.isFinite(difference) &&
      difference > 0
    ) {
      text +=
        `„${itemTitle(cheapest)}” jest tańszy o około ` +
        `${formatPrice(difference, 2)}. `;
    }
  }

  if (safest.key !== winner.key) {
    text +=
      `Najmniej sygnałów ostrzegawczych ma „${itemTitle(safest)}”. `;
  }

  const priorities =
    itemPriorities(winner, data);

  if (priorities.length) {
    text +=
      "Najlepiej potwierdzone wymagania zwycięzcy: " +
      priorities.slice(0, 3).join(", ") +
      ".";
  }

  return text.trim();
}

function comparisonColumnHtml(
  item,
  index,
  data
) {
  const price = itemPrice(item);
  const ratingValues =
    item.group
      .map(
        product =>
          Number(product?.rating)
      )
      .filter(Number.isFinite);

  const rating =
    ratingValues.length
      ? Math.max(...ratingValues)
      : null;

  const opinions =
    groupOpinionCount(item.group);

  const priorities =
    itemPriorities(item, data);

  const risk =
    itemRisk(item);

  const product =
    groupBestProduct(
      item.group
    );

  const riskText =
    risk.level === "low"
      ? "brak mocnych sygnałów ostrzegawczych"
      : (
          risk.reasons.length
            ? risk.reasons.join(" · ")
            : "warto dokładniej sprawdzić ofertę"
        );

  return `
    <article class="compare-column">
      <small>Typ #${index + 1}</small>

      <h3>${escapeHtml(itemTitle(item))}</h3>

      <p class="compare-price">
        ${
          Number.isFinite(price)
            ? formatPrice(price, 2)
            : "sprawdź cenę"
        }
      </p>

      <div class="compare-fact">
        <strong>Gdzie kupisz</strong>
        <p>
          ${escapeHtml(
            groupRepresentativeSource(
              item.group,
              item.section
            ) || "brak danych"
          )}
        </p>
      </div>

      <div class="compare-fact">
        <strong>Oceny i opinie</strong>
        <p>
          ${
            rating !== null
              ? `ocena ${escapeHtml(rating)}/5`
              : "brak oceny"
          }
          ${
            opinions > 0
              ? ` · ${escapeHtml(opinions)} opinii`
              : ""
          }
        </p>
      </div>

      <div class="compare-fact">
        <strong>Twoje priorytety</strong>
        <p>
          ${
            priorities.length
              ? escapeHtml(priorities.join(", "))
              : "brak mocnego potwierdzenia"
          }
        </p>
      </div>

      <div class="compare-fact">
        <strong>Strażnik okazji</strong>
        <p>${escapeHtml(riskText)}</p>
      </div>

      <div class="compare-fact">
        <strong>Dlaczego wysoko</strong>
        <p>
          ${escapeHtml(
            rankingReasons(
              groupBestProduct(item.group)
            )
              .slice(0, 2)
              .join(" · ")
            ||
            "wynik oparty głównie na cenie i ocenach"
          )}
        </p>
      </div>

      <a
        class="compare-column-action"
        href="${escapeHtml(itemBestUrl(item))}"
        target="_blank"
        rel="nofollow sponsored noopener">
        Otwórz najlepszą ofertę
      </a>

      <div class="compare-action-row">
        ${saveProductButtonHtml(
          product,
          item.section,
          true
        )}
      </div>
    </article>
  `;
}

function renderComparisonTray(message = "") {
  ensureComparisonUi();

  const tray =
    document.getElementById("compareTray");

  const items =
    selectedComparisonItems();

  if (!tray) {
    return;
  }

  if (!items.length) {
    tray.hidden = true;
    return;
  }

  tray.hidden = false;

  tray.innerHTML = `
    <div class="compare-tray-head">
      <p class="compare-tray-title">
        Porównaj moje typy
      </p>
      <span>
        ${items.length}/${MAX_COMPARISON_ITEMS}
      </span>
    </div>

    <div class="compare-tray-items">
      ${items.map(
        item => `
          <div class="compare-tray-item">
            <span>${escapeHtml(itemTitle(item))}</span>
            <button
              type="button"
              class="compare-tray-remove"
              data-compare-remove="${escapeHtml(item.key)}">
              ✕
            </button>
          </div>
        `
      ).join("")}
    </div>

    ${
      message
        ? `
          <p class="compare-tray-message">
            ${escapeHtml(message)}
          </p>
        `
        : ""
    }

    <div class="compare-tray-actions">
      <button
        type="button"
        class="compare-tray-button secondary"
        data-compare-clear>
        Wyczyść
      </button>

      <button
        type="button"
        class="compare-tray-button primary"
        data-compare-open
        ${items.length < 2 ? "disabled" : ""}>
        ${
          items.length < 2
            ? "Dodaj jeszcze jeden"
            : "Porównaj wybrane"
        }
      </button>
    </div>
  `;

  bindComparisonTrayControls();
}

function openComparisonModal() {
  ensureComparisonUi();

  const items =
    selectedComparisonItems();

  if (items.length < 2) {
    renderComparisonTray(
      "Wybierz co najmniej dwa produkty."
    );
    return;
  }

  const backdrop =
    document.getElementById(
      "compareModalBackdrop"
    );

  const body =
    document.getElementById(
      "compareModalBody"
    );

  body.innerHTML = `
    <p class="compare-verdict">
      <strong>Moja rada:</strong>
      ${escapeHtml(
        comparisonVerdict(
          items,
          lastCombinedPayload
        )
      )}
    </p>

    <div class="compare-grid">
      ${items.map(
        (item, index) =>
          comparisonColumnHtml(
            item,
            index,
            lastCombinedPayload
          )
      ).join("")}
    </div>
  `;

  backdrop.hidden = false;
  document.body.style.overflow = "hidden";

  openAccessibleLayer(
    backdrop.querySelector(
      ".compare-modal"
    )
  );

  announceAccessibility(
    `Otwarto porównanie ${items.length} produktów.`
  );
}

function closeComparisonModal() {
  const backdrop =
    document.getElementById(
      "compareModalBackdrop"
    );

  if (backdrop) {
    closeAccessibleLayer(
      backdrop.querySelector(
        ".compare-modal"
      )
    );

    backdrop.hidden = true;
  }

  document.body.style.overflow = "";
}

function refreshComparisonButtons() {
  document
    .querySelectorAll("[data-compare-key]")
    .forEach(button => {
      const key =
        button.dataset.compareKey || "";

      const selected =
        comparisonSelection.has(key);

      button.classList.toggle(
        "is-selected",
        selected
      );

      button.textContent =
        selected
          ? "✓ Dodano do porównania"
          : "Porównaj ten produkt";
    });
}

function toggleComparisonItem(key) {
  if (
    !key ||
    !comparisonCandidates.has(key)
  ) {
    return;
  }

  if (comparisonSelection.has(key)) {
    comparisonSelection.delete(key);
  } else if (
    comparisonSelection.size <
    MAX_COMPARISON_ITEMS
  ) {
    comparisonSelection.add(key);
  } else {
    renderComparisonTray(
      "Możesz porównać maksymalnie trzy produkty."
    );
    return;
  }

  refreshComparisonButtons();
  renderComparisonTray();
}

function bindComparisonButtons() {
  document
    .querySelectorAll("[data-compare-key]")
    .forEach(button => {
      button.addEventListener(
        "click",
        () => {
          toggleComparisonItem(
            button.dataset.compareKey || ""
          );
        }
      );
    });
}

function bindComparisonTrayControls() {
  document
    .querySelectorAll("[data-compare-remove]")
    .forEach(button => {
      button.addEventListener(
        "click",
        () => {
          comparisonSelection.delete(
            button.dataset.compareRemove || ""
          );
          refreshComparisonButtons();
          renderComparisonTray();
        }
      );
    });

  const clear =
    document.querySelector(
      "[data-compare-clear]"
    );

  if (clear) {
    clear.addEventListener(
      "click",
      () => {
        comparisonSelection.clear();
        refreshComparisonButtons();
        renderComparisonTray();
      }
    );
  }

  const open =
    document.querySelector(
      "[data-compare-open]"
    );

  if (open) {
    open.addEventListener(
      "click",
      openComparisonModal
    );
  }
}

function bindComparisonModalControls() {
  ensureComparisonUi();

  const backdrop =
    document.getElementById(
      "compareModalBackdrop"
    );

  backdrop
    .querySelector("[data-compare-close]")
    .addEventListener(
      "click",
      closeComparisonModal
    );

  backdrop.addEventListener(
    "click",
    event => {
      if (event.target === backdrop) {
        closeComparisonModal();
      }
    }
  );

  document.addEventListener(
    "keydown",
    event => {
      if (
        event.key === "Escape" &&
        !backdrop.hidden
      ) {
        closeComparisonModal();
      }
    }
  );
}

function comparisonOfferButtonText(source) {
  if (source === "Ceneo") {
    return "Porównaj ceny";
  }

  if (source === "Allegro") {
    return "Otwórz na Allegro";
  }

  return "Zobacz ofertę";
}

function comparisonOfferMeta(product, source) {
  const parts = [];

  if (
    product.rating !== null &&
    product.rating !== undefined
  ) {
    parts.push(
      `ocena ${product.rating}/5`
    );
  }

  if (
    source === "Ceneo" &&
    product.shops_count !== null &&
    product.shops_count !== undefined
  ) {
    parts.push(
      `${product.shops_count} sklepów`
    );
  }

  if (
    source === "Allegro" &&
    product.opinions_count !== null &&
    product.opinions_count !== undefined
  ) {
    parts.push(
      `${product.opinions_count} opinii`
    );
  }

  if (
    source === "AliExpress" &&
    product.sold_count !== null &&
    product.sold_count !== undefined
  ) {
    parts.push(
      `${product.sold_count} sprzedanych`
    );
  }

  return parts.join(" · ");
}

function rankingReasons(product) {
  const reasons =
    product?._group_rank_reasons ||
    product?._rank_reasons ||
    [];

  return Array.isArray(reasons)
    ? reasons.filter(Boolean).slice(0, 4)
    : [];
}

function rankReasonsHtml(product) {
  const reasons = rankingReasons(product);

  if (!reasons.length) {
    return "";
  }

  return `
    <div class="rank-reasons">
      ${reasons
        .map(
          reason =>
            `<span class="rank-reason">${escapeHtml(reason)}</span>`
        )
        .join("")}
    </div>
  `;
}

function comparisonCardHtml(group, index, section) {
  const first = group[0];

  const saveProduct =
    groupBestProduct(
      group
    );

  const label =
    String(
      first?._identity_label || ""
    ).trim() ||
    first.title;

  const imageProduct =
    group.find(
      product => product.image_url
    ) ||
    first;

  const image = imageProduct?.image_url
    ? `
      <img
        src="${escapeHtml(imageProduct.image_url)}"
        alt="${escapeHtml(label)}"
        loading="lazy"
        referrerpolicy="no-referrer">
    `
    : `<span aria-hidden="true">🛍️</span>`;

  const offers = [...group].sort(
    (a, b) =>
      Number(a.current_price_pln || 0) -
      Number(b.current_price_pln || 0)
  );

  const groupRisk =
    groupRiskAssessment(
      group,
      section
    );

  const uniqueSources = new Set(
    offers.map(
      product =>
        productMarketplace(
          product,
          section
        )
    )
  );

  const rows = offers
    .map(product => {
      const source = productMarketplace(
        product,
        section
      );

      const targetUrl = safeUrl(
        product.affiliate_url ||
        product.url
      );

      const pricePrefix =
        source === "Ceneo"
          ? "od "
          : "";

      const meta = comparisonOfferMeta(
        product,
        source
      );

      const offerRisk =
        productRiskAssessment(
          product,
          section
        );

      return `
        <div class="comparison-offer">
          <span class="comparison-offer-source">
            ${escapeHtml(source)}
          </span>

          <span class="comparison-offer-details">
            <span class="comparison-offer-price">
              ${pricePrefix}${formatPrice(
                product.current_price_pln,
                2
              )}
            </span>

            ${
              meta
                ? `
                  <span class="comparison-offer-meta">
                    ${escapeHtml(meta)}
                  </span>
                `
                : ""
            }

            ${
              offerRisk.level !== "low"
                ? `
                  <span class="comparison-offer-risk is-${escapeHtml(offerRisk.level)}">
                    ${
                      offerRisk.level === "high"
                        ? "⚠️ sprawdź dokładnie"
                        : "ℹ️ warto zweryfikować"
                    }
                  </span>
                `
                : ""
            }
          </span>

          <a
            class="comparison-offer-link"
            href="${escapeHtml(targetUrl)}"
            target="_blank"
            rel="nofollow sponsored noopener">
            ${comparisonOfferButtonText(source)}
          </a>
        </div>
      `;
    })
    .join("");

  const anchorId =
    productGroupAnchorId(
      group,
      section
    );

  return `
    <article
      class="comparison-card"
      id="${escapeHtml(anchorId)}">
      <div class="comparison-card-head">
        <div class="comparison-card-image">
          ${image}
        </div>

        <div>
          <div class="comparison-card-kicker-row">
            <span class="comparison-rank">
              #${index + 1}
            </span>

            <span class="comparison-card-kicker">
              ${uniqueSources.size} ${
                uniqueSources.size === 1
                  ? "miejsce zakupu"
                  : "miejsca zakupu"
              }
            </span>
          </div>

          <h3>
            ${escapeHtml(label)}
          </h3>

          ${rankReasonsHtml(first)}

          <p class="comparison-card-subtitle">
            Ten sam model znaleziony w kilku miejscach.
            Wybierz sklep lub sposób zakupu, który najbardziej Ci odpowiada.
          </p>

          ${riskBadgeHtml(groupRisk)}
          ${riskWarningHtml(groupRisk)}
        </div>
      </div>

      <div class="comparison-offers">
        ${rows}
      </div>

      <div class="compare-action-row">
        ${saveProductButtonHtml(
          saveProduct,
          section,
          true
        )}
      </div>

      ${comparisonButtonHtml(group, section)}
    </article>
  `;
}


function productCardHtml(
  product,
  index,
  section
) {
  const marketplace =
    productMarketplace(
      product,
      section
    );

  const isCeneo =
    marketplace === "Ceneo";

  const isAllegro =
    marketplace === "Allegro";

  const isAmazon =
    marketplace === "Amazon";

  const isAliExpress =
    marketplace === "AliExpress";

  const tags = [];

  tags.push(marketplace);

  if (
    product.rating !== null &&
    product.rating !== undefined
  ) {
    tags.push(
      `ocena ${product.rating}/5`
    );
  }

  if (
    (
      isCeneo ||
      isAllegro
    ) &&
    product.opinions_count !== null &&
    product.opinions_count !== undefined
  ) {
    tags.push(
      `${product.opinions_count} opinii`
    );
  }

  if (
    isCeneo &&
    product.shops_count !== null &&
    product.shops_count !== undefined
  ) {
    tags.push(
      `${product.shops_count} sklepów`
    );
  }

  if (
    isAllegro &&
    product.smart_delivery
  ) {
    tags.push(
      "Allegro Smart!"
    );
  }

  if (
    isAliExpress &&
    product.sold_count !== null &&
    product.sold_count !== undefined
  ) {
    tags.push(
      `${product.sold_count} sprzedanych`
    );
  }

  if (
    isAliExpress &&
    product.shipping_from_poland
  ) {
    tags.push(
      "wysyłka z Polski"
    );
  }

  const tagHtml =
    tags
      .slice(0, 4)
      .map(
        tag =>
          `<span>${escapeHtml(tag)}</span>`
      )
      .join("");

  const badgeClass =
    product.budget_status ===
    "nieco powyżej budżetu"
      ? "near-budget"
      : "";

  const reasons =
    Array.isArray(
      product.reasons
    )
      ? product.reasons
          .slice(0, 3)
          .join(" · ")
      : "";

  let fallbackDescription =
    "Oferta wybrana na podstawie ceny i jakości.";

  if (isCeneo) {
    fallbackDescription =
      "Produkt z porównaniem cen w polskich sklepach przez Ceneo.";
  } else if (isAllegro) {
    fallbackDescription =
      "Konkretna oferta Allegro wybrana według budżetu i opinii.";
  } else if (isAmazon) {
    fallbackDescription =
      product.description ||
      "Oferta Amazon.pl dopasowana do produktu i budżetu.";
  } else if (isAliExpress) {
    fallbackDescription =
      "Oferta importowa wybrana na podstawie ceny i popularności.";
  }

  const description =
    reasons ||
    fallbackDescription;

  const targetUrl =
    productOfferUrl(product);

  const image =
    product.image_url
      ? `
        <a
          class="offer-image-link"
          href="${escapeHtml(targetUrl)}"
          target="_blank"
          rel="nofollow sponsored noopener"
          aria-label="Otwórz produkt: ${escapeHtml(product.title)}">
          <img
            class="real-product-image"
            src="${escapeHtml(product.image_url)}"
            alt="${escapeHtml(product.title)}"
            loading="lazy"
            referrerpolicy="no-referrer">
        </a>
      `
      : `
        <a
          class="offer-image-link"
          href="${escapeHtml(targetUrl)}"
          target="_blank"
          rel="nofollow sponsored noopener"
          aria-label="Otwórz produkt: ${escapeHtml(product.title)}">
          <span aria-hidden="true">🛍️</span>
        </a>
      `;

  let buttonText =
    "Zobacz ofertę";

  let pricePrefix = "";

  if (isCeneo) {
    buttonText =
      "Porównaj ceny";

    pricePrefix =
      "od ";
  } else if (isAllegro) {
    buttonText =
      "Otwórz na Allegro";
  } else if (isAmazon) {
    buttonText =
      "Otwórz na Amazon.pl";
  } else if (isAliExpress) {
    buttonText =
      "Otwórz na AliExpress";
  }

  const anchorId =
    productGroupAnchorId(
      [product],
      section
    );

  const risk =
    productRiskAssessment(
      product,
      section
    );

  return `
    <article
      class="product-card"
      id="${escapeHtml(anchorId)}">
      <div class="product-visual real-product-visual">
        <span class="product-rank">
          #${index + 1}
        </span>

        ${image}
      </div>

      <div class="product-body">
        <div>
          <span class="product-badge ${badgeClass}">
            ${escapeHtml(
              product.budget_status ||
              "Polecane"
            )}
          </span>

          <span class="product-source">
            ${escapeHtml(marketplace)}
          </span>
        </div>

        <h3>
          <a
            class="product-title-link"
            href="${escapeHtml(targetUrl)}"
            target="_blank"
            rel="nofollow sponsored noopener">
            ${escapeHtml(product.title)}
          </a>
        </h3>

        <a
          class="product-description-link"
          href="${escapeHtml(targetUrl)}"
          target="_blank"
          rel="nofollow sponsored noopener">
          <p class="product-description">
            ${escapeHtml(description)}
          </p>
        </a>

        <div class="offer-inline-links">
          <a
            class="offer-inline-link"
            href="${escapeHtml(targetUrl)}"
            target="_blank"
            rel="nofollow sponsored noopener">
            <span class="offer-icon-badge">
              🔗
            </span>

            Karta produktu
          </a>

          ${saveProductButtonHtml(
            product,
            section,
            true
          )}
        </div>

        ${riskBadgeHtml(risk)}
        ${riskWarningHtml(risk)}

        ${rankReasonsHtml(product)}

        <div class="product-tags">
          ${tagHtml}
        </div>

        <div class="product-bottom">
          <span class="product-price">
            ${
              Number.isFinite(
                Number(
                  product.current_price_pln
                )
              ) &&
              Number(
                product.current_price_pln
              ) > 0
                ? (
                    pricePrefix +
                    formatPrice(
                      product.current_price_pln,
                      2
                    )
                  )
                : "sprawdź cenę"
            }
          </span>

          <a
            class="product-link"
            href="${escapeHtml(targetUrl)}"
            target="_blank"
            rel="nofollow sponsored noopener">
            ${buttonText}
          </a>
        </div>

        ${comparisonButtonHtml(
          [product],
          section
        )}
      </div>
    </article>
  `;
}



function sectionHeaderHtml(source, products) {
  const isPolish = source === "polish";
  const list = Array.isArray(products)
    ? products
    : [];

  if (isPolish) {
    const ceneoCount = list.filter(
      product =>
        productMarketplace(
          product,
          "polish"
        ) === "Ceneo"
    ).length;

    const allegroCount = list.filter(
      product =>
        productMarketplace(
          product,
          "polish"
        ) === "Allegro"
    ).length;

    const modelCount =
      groupProductsByIdentity(
        list
      ).length;

    return `
      <div class="result-source-section">
        <p class="result-source-eyebrow">
          Szybciej i lokalnie
        </p>
        <h3 class="result-source-title">
          🇵🇱 Polskie sklepy
        </h3>
        <p class="result-source-description">
          ${list.length} ofert dla ${modelCount} modeli:
          ${ceneoCount} z Ceneo +
          ${allegroCount} z Allegro.
        </p>
      </div>
    `;
  }

  return `
    <div class="result-source-section">
      <p class="result-source-eyebrow">
        Szerszy wybór
      </p>
      <h3 class="result-source-title">
        🌏 Import / Chiny
      </h3>
      <p class="result-source-description">
        ${list.length} wybranych ofert importowych z AliExpress.
      </p>
    </div>
  `;
}


function queryProfileHtml(data) {
  const profile =
    data?.query_profile ||
    {};

  if (
    !profile ||
    typeof profile !== "object"
  ) {
    return "";
  }

  const chips = [];

  if (profile.category_label) {
    chips.push(
      String(
        profile.category_label
      )
    );
  }

  if (
    profile.budget_max !== null &&
    profile.budget_max !== undefined
  ) {
    chips.push(
      `budżet do ${profile.budget_max} zł`
    );
  }

  const priorities =
    Array.isArray(
      profile.priority_labels
    )
      ? profile.priority_labels
      : [];

  priorities.forEach(
    priority => chips.push(
      String(priority)
    )
  );

  if (!chips.length) {
    return "";
  }

  const chipHtml = chips
    .map(
      chip => `
        <span class="query-profile-chip">
          ${escapeHtml(chip)}
        </span>
      `
    )
    .join("");

  const hasPriorities =
    priorities.length > 0;

  const categoryAgent =
    profile.category_agent &&
    typeof profile.category_agent ===
      "object"
      ? profile.category_agent
      : null;

  const agentQuery =
    String(
      categoryAgent
        ?.aliexpress_query ||
      ""
    ).trim();

  const profileSections =
    data?.sections ||
    data?.results ||
    {};

  const profileProducts = [
    ...(
      Array.isArray(
        profileSections.polish
      )
        ? profileSections.polish
        : []
    ),
    ...(
      Array.isArray(
        profileSections.import
      )
        ? profileSections.import
        : []
    )
  ];

  const previewProduct =
    profileProducts.find(
      product =>
        product &&
        product.image_url
    ) ||
    null;

  const categoryIcon =
    String(
      profile.category_icon ||
      "🛍️"
    );

  const agentVisual =
    previewProduct
      ? `
        <span class="query-agent-visual">
          <img
            src="${escapeHtml(previewProduct.image_url)}"
            alt="${escapeHtml(previewProduct.title || profile.category_label || "Produkt")}"
            loading="lazy"
            referrerpolicy="no-referrer">
        </span>
      `
      : `
        <span
          class="query-agent-visual"
          aria-hidden="true">
          ${escapeHtml(categoryIcon)}
        </span>
      `;

  const agentNote =
    agentQuery
      ? `
        <p class="query-agent-note">
          ${agentVisual}

          <span>
            <strong>Agent AliExpress:</strong>
            szukamy jako
            <span class="query-agent-note-code">
              „${escapeHtml(agentQuery)}”
            </span>
            i odrzucamy inne typy produktów oraz akcesoria.
          </span>
        </p>
      `
      : "";

  return `
    <div class="query-profile">
      <p class="query-profile-title">
        Rozumiem Twoje zapytanie
      </p>

      <div class="query-profile-chips">
        ${chipHtml}
      </div>

      <p class="query-profile-note">
        ${
          hasPriorities
            ? (
                "Sklepy przeszukujemy szerzej, a ranking dodatkowo " +
                "premiuje produkty pasujące do wskazanych cech."
              )
            : (
                "Rozpoznaliśmy kategorię i budżet. " +
                "Możesz dopisać np. „z dobrym aparatem” albo „z mocną baterią”."
              )
        }
      </p>

      ${agentNote}
    </div>
  `;
}

function sourceStateLabel(meta, fallbackName) {
  const state = meta?.state || "unknown";
  const age = meta?.cache_age || "";

  const labels = {
    cache_fresh: "świeży wynik z pamięci",
    combined_cache: "świeży zestaw z pamięci",
    live: "pobrano teraz",
    refreshed: "odświeżono teraz",
    stale_fallback: "starszy zapisany wynik",
    previous_cache_filtered:
      "wcześniejszy wynik po ponownym sprawdzeniu",
    category_cache_filtered:
      "awaryjny sprawdzony wynik z pamięci",
    no_matching_products:
      "brak dopasowanego pełnego produktu",
    queued:
      "czeka na swoją kolej",
    searching_live:
      "przeszukujemy teraz na żywo",
    affiliate_program_unavailable:
      "program partnerski nieaktywny",
    affiliate_search_ready:
      "wyszukiwanie Amazon.pl gotowe",
    unavailable: "chwilowo niedostępne"
  };

  let label = labels[state] || "gotowy wynik";

  if (
    fallbackName === "Ceneo" &&
    meta?.assistant_used
  ) {
    label = "wyniki wybrane przez Asystenta Ceneo";
  }

  return `${fallbackName}: ${label}${age ? ` · ${age}` : ""}`;
}

function sourceStateClass(meta) {
  const state = meta?.state || "";

  if (
    state === "stale_fallback" ||
    state === "previous_cache_filtered" ||
    state === "category_cache_filtered"
  ) {
    return "is-stale";
  }

  if (state === "unavailable") {
    return "is-unavailable";
  }

  if (
    state === "queued" ||
    state ===
      "affiliate_program_unavailable"
  ) {
    return "is-queued";
  }

  if (
    state === "searching_live"
  ) {
    return "is-searching";
  }

  return "";
}

function sourceHealthHtml(data) {
  const meta = data?.source_meta || {};

  const ceneoMeta = meta.ceneo || {
    state: data?.cache_hit
      ? "combined_cache"
      : "unknown"
  };

  const allegroMeta = meta.allegro || {
    state: data?.cache_hit
      ? "combined_cache"
      : "unknown"
  };

  const amazonMeta = meta.amazon || {
    state: data?.cache_hit
      ? "combined_cache"
      : "queued"
  };

  const aliexpressMeta = meta.aliexpress || {
    state: data?.cache_hit
      ? "combined_cache"
      : "unknown"
  };

  return `
    <div class="source-health-row">
      <span class="source-health-badge ${sourceStateClass(ceneoMeta)}">
        <span class="source-health-dot" aria-hidden="true"></span>
        ${escapeHtml(sourceStateLabel(ceneoMeta, "Ceneo"))}
      </span>

      <span class="source-health-badge ${sourceStateClass(allegroMeta)}">
        <span class="source-health-dot" aria-hidden="true"></span>
        ${escapeHtml(sourceStateLabel(allegroMeta, "Allegro"))}
      </span>

      <span class="source-health-badge ${sourceStateClass(amazonMeta)}">
        <span class="source-health-dot" aria-hidden="true"></span>
        ${escapeHtml(sourceStateLabel(amazonMeta, "Amazon.pl"))}
      </span>

      <span class="source-health-badge ${sourceStateClass(aliexpressMeta)}">
        <span class="source-health-dot" aria-hidden="true"></span>
        ${escapeHtml(sourceStateLabel(aliexpressMeta, "AliExpress"))}
      </span>
    </div>
  `;
}


function renderCombinedResults(data, query) {
  const sections =
    data?.sections ||
    data?.results ||
    {};

  const polishAll =
    Array.isArray(
      sections.polish
    )
      ? sections.polish
      : [];

  const importedAll =
    Array.isArray(
      sections.import
    )
      ? sections.import
      : [];

  const polish =
    filterProductsByMarketplace(
      polishAll,
      "polish"
    );

  const imported =
    filterProductsByMarketplace(
      importedAll,
      "import"
    );

  lastCombinedPayload = data;
  lastCombinedQuery = query;

  results.innerHTML =
    resultControlButtons() +
    queryProfileHtml(data) +
    sourceHealthHtml(data) +
    `
      <div class="ranking-explainer">
        <strong>Ranking SmartZakupów:</strong>
        domyślnie pokazujemy najlepsze propozycje.
        Gdy wpiszesz ważne cechy, ranking dodatkowo
        uwzględnia ich dopasowanie.
      </div>
    `;

  const warnings =
    Array.isArray(
      data?.warnings
    )
      ? data.warnings.filter(Boolean)
      : [];

  if (warnings.length) {
    results.insertAdjacentHTML(
      "beforeend",
      `
        <div class="search-warning-box">
          ${warnings
            .map(escapeHtml)
            .join("<br>")}
        </div>
      `
    );
  }

  if (data?.partial_live) {
    const pendingSources =
      Array.isArray(
        data.pending_sources
      )
        ? data.pending_sources
        : [];

    results.insertAdjacentHTML(
      "beforeend",
      `
        <section class="live-background-note">
          <span
            class="live-background-note-icon"
            aria-hidden="true">
            ✨
          </span>

          <div>
            <strong>
              Pierwsze dopasowane wyniki są już gotowe
            </strong>

            <p>
              Nie każemy Ci czekać na najwolniejszy sklep.
              ${
                pendingSources.length
                  ? (
                      "W tle nadal pracują: " +
                      escapeHtml(
                        pendingSources.join(", ")
                      ) +
                      ". "
                    )
                  : ""
              }
              Gdy zakończą, ranking uzupełni się automatycznie.
            </p>
          </div>
        </section>
      `
    );
  }

  const polishGroups =
    sortProductGroups(
      groupProductsByIdentity(
        polish
      )
    );

  const importGroups =
    sortProductGroups(
      groupProductsByIdentity(
        imported
      )
    );

  prepareComparisonCandidates(
    sortProductGroups(
      groupProductsByIdentity(
        polishAll
      )
    ),
    sortProductGroups(
      groupProductsByIdentity(
        importedAll
      )
    )
  );

  finalDecisionContext = {
    polishGroups,
    importGroups,
    data
  };

  const smartPicks =
    smartPicksHtml(
      polishGroups,
      importGroups
    );

  if (smartPicks) {
    results.insertAdjacentHTML(
      "beforeend",
      smartPicks
    );
  }

  const shoppingAdvisor =
    shoppingAdvisorHtml(
      polishGroups,
      importGroups,
      data
    );

  if (shoppingAdvisor) {
    results.insertAdjacentHTML(
      "beforeend",
      shoppingAdvisor
    );
  }

  const finalDecisionLauncher =
    finalDecisionLauncherHtml(
      polishGroups,
      importGroups,
      data
    );

  if (finalDecisionLauncher) {
    results.insertAdjacentHTML(
      "beforeend",
      finalDecisionLauncher
    );
  }

  const budgetUpgrade =
    budgetUpgradeHtml(
      polishGroups,
      importGroups,
      data
    );

  if (budgetUpgrade) {
    results.insertAdjacentHTML(
      "beforeend",
      budgetUpgrade
    );
  }

  let visibleCount = 0;

  if (polish.length) {
    results.insertAdjacentHTML(
      "beforeend",
      sectionHeaderHtml(
        "polish",
        polish
      )
    );

    if (
      currentMarketplaceFilter ===
        "all" &&
      polishGroups.some(
        group =>
          new Set(
            group.map(
              product =>
                productMarketplace(
                  product,
                  "polish"
                )
            )
          ).size > 1
      )
    ) {
      results.insertAdjacentHTML(
        "beforeend",
        `
          <div class="comparison-summary-note">
            Ten sam model znaleziony w Ceneo i Allegro
            jest łączony w jedną kartę. Żadna oferta nie znika —
            klient wybiera, gdzie chce kupić.
          </div>
        `
      );
    }

    polishGroups.forEach(
      (group, index) => {
        results.insertAdjacentHTML(
          "beforeend",
          group.length > 1
            ? comparisonCardHtml(
                group,
                index,
                "polish"
              )
            : productCardHtml(
                group[0],
                index,
                "polish"
              )
        );
      }
    );

    visibleCount +=
      polishGroups.length;
  }

  if (imported.length) {
    results.insertAdjacentHTML(
      "beforeend",
      sectionHeaderHtml(
        "import",
        imported
      )
    );

    importGroups.forEach(
      (group, index) => {
        results.insertAdjacentHTML(
          "beforeend",
          group.length > 1
            ? comparisonCardHtml(
                group,
                index,
                "import"
              )
            : productCardHtml(
                group[0],
                index,
                "import"
              )
        );
      }
    );

    visibleCount +=
      importGroups.length;
  } else if (
    (
      currentMarketplaceFilter ===
        "all" ||
      currentMarketplaceFilter ===
        "aliexpress"
    ) &&
    data?.source_meta
      ?.aliexpress
      ?.state ===
        "no_matching_products"
  ) {
    results.insertAdjacentHTML(
      "beforeend",
      `
        <section class="import-empty-note">
          <span
            class="import-empty-note-icon"
            aria-hidden="true">
            🌍
          </span>

          <div>
            <h3>
              Brak wiarygodnej oferty z Chin
            </h3>

            <p>
              AliExpress pokazał wyniki, ale nie były właściwym
              produktem dla tego zapytania. Nie pokazujemy przypadkowych
              ofert tylko po to, aby zapełnić sekcję importową.
            </p>
          </div>
        </section>
      `
    );
  }

  results.hidden = false;
  emptyState.hidden = true;
  resultsTitle.textContent =
    `Wyniki dla: „${query}”`;

  const allCeneoCount =
    polishAll.filter(
      product =>
        productMarketplace(
          product,
          "polish"
        ) === "Ceneo"
    ).length;

  const allAllegroCount =
    polishAll.filter(
      product =>
        productMarketplace(
          product,
          "polish"
        ) === "Allegro"
    ).length;

  const allAliExpressCount =
    importedAll.filter(
      product =>
        productMarketplace(
          product,
          "import"
        ) === "AliExpress"
    ).length;

  if (!visibleCount) {
    results.insertAdjacentHTML(
      "beforeend",
      data?.partial_live
        ? `
          <div class="partial-results-empty">
            Pierwsze sklepy jeszcze kończą sprawdzanie ofert.
            Nie pokazujemy przypadkowych produktów tylko po to,
            aby zapełnić ekran. Wyniki pojawią się tutaj automatycznie.
          </div>
        `
        : `
          <div class="filter-empty-state">
            Brak zapisanych ofert dla wybranego filtra
            <strong>${escapeHtml(currentMarketplaceFilter)}</strong>.
            Wybierz inny sklep lub wróć do „Wszystkie”.
          </div>
        `
    );

    resultsInfo.textContent =
      `W pamięci: ${allCeneoCount} Ceneo + ` +
      `${allAllegroCount} Allegro + ` +
      `${allAliExpressCount} AliExpress`;

    bindResultControls();
    bindComparisonButtons();
    bindFinalDecisionLaunchers();
    renderComparisonTray();

    enhanceRenderedAccessibility(
      query,
      0
    );

    return;
  }

  const sortLabels = {
    best: "Najlepsze",
    cheapest: "Najtańsze",
    opinions: "Najwięcej opinii"
  };

  const filterLabel =
    currentMarketplaceFilter ===
      "all"
      ? "wszystkie sklepy"
      : currentMarketplaceFilter;

  const baseSummary =
    `${allCeneoCount} Ceneo + ` +
    `${allAllegroCount} Allegro + ` +
    `${allAliExpressCount} AliExpress`;

  if (
    data.mode ===
    "combined_cache_fresh"
  ) {
    resultsInfo.textContent =
      `Świeży zestaw z pamięci · ${data.cache_age} · ` +
      `${baseSummary} · ` +
      `${filterLabel} · ` +
      `${sortLabels[currentSortMode]}`;
  } else if (
    String(
      data.mode || ""
    ).includes("stale")
  ) {
    resultsInfo.textContent =
      `Pokazujemy ostatni zapisany zestaw · ` +
      `${baseSummary} · ` +
      `${filterLabel} · ` +
      `${sortLabels[currentSortMode]}`;
  } else {
    resultsInfo.textContent =
      `Sprawdzono trzy źródła · ` +
      `${baseSummary} · ` +
      `${filterLabel} · ` +
      `${sortLabels[currentSortMode]}`;
  }

  bindResultControls();
  bindComparisonButtons();
  bindFinalDecisionLaunchers();
  bindDebugReportActions();
  renderComparisonTray();

  enhanceRenderedAccessibility(
    query,
    visibleCount
  );
}


function showEmptyState(title, text) {
  results.innerHTML = "";
  results.hidden = true;
  emptyState.hidden = false;
  resultsTitle.textContent = title;
  resultsInfo.textContent = text;

  enhanceExistingAccessibility();

  const mobileJump =
    document.getElementById(
      "mobileResultsJump"
    );

  if (mobileJump) {
    mobileJump.hidden =
      true;
  }

  announceAccessibility(
    `${title}. ${text}`
  );
}





function setSearchStatus(query) {
  results.hidden = false;
  emptyState.hidden = true;
  results.innerHTML = "";

  resultsTitle.textContent = `Szukamy: „${query}”`;
  resultsInfo.innerHTML = `
    <span class="search-status-line">
      <span class="search-status-dot" aria-hidden="true"></span>
      Start wyszukiwania. Najczęściej komplet wyników pojawia się po około 18–45 sekundach.
    </span>
  `;
}

function ensureRecentSearchesSection() {
  let section = document.getElementById("recentSearchesSection");

  if (section) {
    return section;
  }

  const target =
    document.getElementById("promocje") ||
    resultsTitle?.closest("section") ||
    form?.closest("section");

  if (!target || !target.parentNode) {
    return null;
  }

  section = document.createElement("section");
  section.id = "recentSearchesSection";
  section.className = "recent-searches-section";
  section.hidden = true;

  section.innerHTML = `
    <div class="recent-searches-head">
      <div>
        <p class="recent-searches-eyebrow">Gotowe od ręki</p>
        <h2 class="recent-searches-title">Ostatnio wyszukiwane</h2>
      </div>
      <p class="recent-searches-info">
        Kliknij frazę, aby od razu zobaczyć ostatnio zapisane wyniki.
        Bez ponownego otwierania sklepu.
      </p>
    </div>
    <div
      id="recentSearchesList"
      class="recent-searches-list"
      aria-live="polite">
    </div>
  `;

  target.parentNode.insertBefore(section, target);

  return section;
}

function recentSearchLabel(item) {
  const resultCount = Number(item.result_count || 0);
  const usageCount = Number(item.search_count || 0);

  const resultText =
    resultCount === 1
      ? "1 zapisana oferta"
      : `${resultCount} zapisanych ofert`;

  const usageText =
    usageCount === 1
      ? "użyto 1 raz"
      : `użyto ${usageCount} razy`;

  return `${resultText} · ${usageText}`;
}

function renderRecentSearches(searches) {
  const section = ensureRecentSearchesSection();
  const list = document.getElementById("recentSearchesList");

  if (!section || !list) {
    return;
  }

  if (!Array.isArray(searches) || !searches.length) {
    section.hidden = true;
    list.innerHTML = "";
    return;
  }

  list.innerHTML = searches
    .slice(0, 5)
    .map(item => `
      <button
        type="button"
        class="recent-search-button"
        data-recent-query="${escapeHtml(item.query)}"
        title="Pokaż zapisane wyniki dla: ${escapeHtml(item.query)}">
        <span class="recent-search-query">
          ${escapeHtml(item.query)}
        </span>
        <span class="recent-search-meta">
          ${escapeHtml(recentSearchLabel(item))}
        </span>
      </button>
    `)
    .join("");

  section.hidden = false;

  list
    .querySelectorAll("[data-recent-query]")
    .forEach(button => {
      button.addEventListener("click", () => {
        const query = button.dataset.recentQuery || "";

        input.value = query;
        clearSupplementarySearch();
        searchProducts(
          query,
          ""
        );
      });
    });
}

async function loadRecentSearches() {
  try {
    const response = await fetch(
      "/api/smartzakupy/recent-searches?limit=5"
    );

    const data = await response.json().catch(() => ({}));

    if (!response.ok || !data.ok) {
      return;
    }

    renderRecentSearches(data.searches || []);
  } catch (error) {
    console.debug(
      "Nie udało się pobrać ostatnich wyszukiwań:",
      error
    );
  }
}


function createSearchRequestId() {
  const random =
    Math.random()
      .toString(36)
      .slice(2, 10);

  return (
    `miboy-${Date.now()}-${random}`
  );
}

function scrollToSearchLoader() {
  const loader =
    ensureSearchLoader();

  if (!loader) {
    return;
  }

  window.setTimeout(
    () => {
      const top =
        loader
          .getBoundingClientRect()
          .top +
        window.scrollY -
        78;

      window.scrollTo({
        top: Math.max(0, top),
        behavior: "smooth"
      });

      loader.setAttribute(
        "tabindex",
        "-1"
      );
    },
    70
  );
}

function stopSearchProgressPolling() {
  if (
    searchProgressPollTimer
  ) {
    window.clearInterval(
      searchProgressPollTimer
    );

    searchProgressPollTimer =
      null;
  }
}

function applySearchProgressPayload(
  payload
) {
  if (
    !payload ||
    typeof payload !== "object"
  ) {
    return;
  }

  const progress =
    Number(
      payload.progress
    );

  if (Number.isFinite(progress)) {
    searchProgressTarget =
      Math.max(
        searchProgressTarget,
        Math.min(
          progress,
          100
        )
      );
  }

  const step =
    Number(
      payload.step
    );

  if (Number.isFinite(step)) {
    searchProgressStep =
      Math.max(
        searchProgressStep,
        Math.min(
          step,
          5
        )
      );
  }

  if (payload.message) {
    searchProgressMessage =
      String(
        payload.message
      );
  }

  if (payload.done) {
    searchProgressTarget =
      100;

    stopSearchProgressPolling();
  }
}

async function pollSearchProgress(
  requestId
) {
  if (
    !requestId ||
    requestId !==
      activeSearchRequestId
  ) {
    return;
  }

  try {
    const response = await fetch(
      `/api/smartzakupy/progress/${encodeURIComponent(requestId)}`,
      {
        cache: "no-store"
      }
    );

    if (!response.ok) {
      return;
    }

    const payload =
      await response
        .json()
        .catch(
          () => ({})
        );

    if (
      requestId !==
      activeSearchRequestId
    ) {
      return;
    }

    applySearchProgressPayload(
      payload
    );
  } catch {
    // Postęp ma działać również przy chwilowym
    // braku odpowiedzi endpointu.
  }
}

function startSearchProgressPolling(
  requestId
) {
  stopSearchProgressPolling();

  activeSearchRequestId =
    requestId;

  searchProgressDisplayed =
    3;

  searchProgressTarget =
    3;

  searchProgressStep =
    0;

  searchProgressMessage =
    SEARCH_PROGRESS_LABELS[0];

  searchProgressStartedAt =
    Date.now();

  pollSearchProgress(
    requestId
  );

  searchProgressPollTimer =
    window.setInterval(
      () => {
        pollSearchProgress(
          requestId
        );
      },
      650
    );
}


function stopLiveCompletionPolling() {
  if (liveCompletionPollTimer) {
    window.clearTimeout(
      liveCompletionPollTimer
    );

    liveCompletionPollTimer =
      null;
  }

  activeLiveCompletionJobId =
    "";
}

async function refreshAfterLiveCompletion(
  jobId,
  query,
  supplement
) {
  if (
    !jobId ||
    jobId !==
      activeLiveCompletionJobId
  ) {
    return;
  }

  try {
    const statusResponse =
      await fetch(
        `/api/smartzakupy/live-result/${encodeURIComponent(jobId)}`,
        {
          cache: "no-store"
        }
      );

    const status =
      await statusResponse
        .json()
        .catch(
          () => ({})
        );

    if (
      jobId !==
      activeLiveCompletionJobId
    ) {
      return;
    }

    if (
      !statusResponse.ok ||
      !status.ok ||
      !status.done
    ) {
      liveCompletionPollTimer =
        window.setTimeout(
          () => {
            refreshAfterLiveCompletion(
              jobId,
              query,
              supplement
            );
          },
          1400
        );

      return;
    }

    stopLiveCompletionPolling();

    resultsInfo.innerHTML = `
      <span class="search-status-line">
        <span
          class="search-status-dot"
          aria-hidden="true">
        </span>

        Pozostałe sklepy zakończyły pracę.
        Aktualizujemy ranking bez ponownego czekania…
      </span>
    `;

    announceAccessibility(
      "Pozostałe sklepy zakończyły wyszukiwanie. Aktualizujemy wyniki."
    );

    await new Promise(
      resolve =>
        window.setTimeout(
          resolve,
          650
        )
    );

    const refreshRequestId =
      createSearchRequestId();

    const refreshed =
      await searchViaMainBackend(
        query,
        supplement,
        refreshRequestId
      );

    if (
      refreshed.real_result &&
      refreshed.combined_result
    ) {
      renderCombinedResults(
        refreshed,
        refreshed.effective_query ||
        effectiveSearchQuery(
          query,
          supplement
        )
      );

      loadRecentSearches();

      announceAccessibility(
        "Ranking został uzupełniony o wyniki ze wszystkich dostępnych sklepów."
      );
    }
  } catch {
    if (
      jobId ===
      activeLiveCompletionJobId
    ) {
      liveCompletionPollTimer =
        window.setTimeout(
          () => {
            refreshAfterLiveCompletion(
              jobId,
              query,
              supplement
            );
          },
          1800
        );
    }
  }
}

function startLiveCompletionPolling(
  jobId,
  query,
  supplement
) {
  stopLiveCompletionPolling();

  if (!jobId) {
    return;
  }

  activeLiveCompletionJobId =
    String(jobId);

  liveCompletionPollTimer =
    window.setTimeout(
      () => {
        refreshAfterLiveCompletion(
          activeLiveCompletionJobId,
          query,
          supplement
        );
      },
      1200
    );
}


function progressiveInitialPayload(
  query,
  supplement
) {
  return {
    ok: true,
    real_result: true,
    progressive_mode: true,
    progressive_complete: false,
    mode: "progressive_live",
    main_query: query,
    supplement,
    effective_query:
      effectiveSearchQuery(
        query,
        supplement
      ),
    query_profile: null,
    source_order: [
      ...PROGRESSIVE_SOURCE_ORDER
    ],
    current_source: "ceneo",
    completed_sources: [],
    source_sections: {
      ceneo: [],
      allegro: [],
      amazon: [],
      aliexpress: []
    },
    sections: {
      polish: [],
      import: []
    },
    source_meta: {
      ceneo: {
        state: "queued"
      },
      allegro: {
        state: "queued"
      },
      amazon: {
        state: "queued"
      },
      aliexpress: {
        state: "queued"
      }
    },
    warnings: [],
    references: [],
    amazon_search: null,
    debug_by_source: {}
  };
}

function progressiveRebuildSections(
  payload
) {
  payload.sections = {
    polish: [
      ...(
        payload.source_sections
          ?.ceneo ||
        []
      ),
      ...(
        payload.source_sections
          ?.allegro ||
        []
      ),
      ...(
        payload.source_sections
          ?.amazon ||
        []
      )
    ],
    import: [
      ...(
        payload.source_sections
          ?.aliexpress ||
        []
      )
    ]
  };

  return payload;
}

function mergeProgressiveSourceResult(
  payload,
  response
) {
  const sourceKey =
    String(
      response?.source ||
      ""
    ).toLowerCase();

  if (
    !PROGRESSIVE_SOURCE_ORDER
      .includes(sourceKey)
  ) {
    return payload;
  }

  const config =
    PROGRESSIVE_SOURCE_CONFIG[
      sourceKey
    ];

  const sourceProducts =
    Array.isArray(
      response?.sections?.[
        config.section
      ]
    )
      ? response.sections[
          config.section
        ]
      : [];

  payload.source_sections[
    sourceKey
  ] = sourceProducts;

  payload.source_meta = {
    ...payload.source_meta,
    ...(
      response.source_meta ||
      {}
    )
  };

  if (
    response.debug &&
    typeof response.debug ===
      "object"
  ) {
    payload.debug_by_source[
      sourceKey
    ] = response.debug;
  }

  if (
    response.query_profile &&
    typeof response.query_profile ===
      "object"
  ) {
    payload.query_profile =
      response.query_profile;
  }

  if (
    sourceKey === "amazon" &&
    response.amazon_search &&
    typeof response.amazon_search ===
      "object"
  ) {
    payload.amazon_search =
      response.amazon_search;
  }

  if (
    response.reference &&
    response.reference.title
  ) {
    payload.references.push(
      response.reference
    );
  }

  if (
    !payload.completed_sources
      .includes(sourceKey)
  ) {
    payload.completed_sources.push(
      sourceKey
    );
  }

  return progressiveRebuildSections(
    payload
  );
}

async function fetchProgressiveSource(
  source,
  query,
  supplement,
  references = []
) {
  const response = await fetch(
    "/api/smartzakupy/progressive-source",
    {
      method: "POST",
      headers: {
        "Content-Type":
          "application/json"
      },
      body: JSON.stringify({
        source,
        query,
        supplement:
          cleanSupplement(
            supplement
          ),
        references:
          Array.isArray(
            references
          )
            ? references.slice(
                0,
                3
              )
            : []
      })
    }
  );

  const data =
    await response
      .json()
      .catch(
        () => ({})
      );

  if (
    !response.ok ||
    !data.ok
  ) {
    throw new Error(
      data.error ||
      `Nie udało się przeszukać źródła ${source}.`
    );
  }

  return data;
}

function progressiveStoreHeadingHtml(
  sourceKey,
  count,
  hasAffiliateSearch = false
) {
  const config =
    PROGRESSIVE_SOURCE_CONFIG[
      sourceKey
    ];

  return `
    <div class="progressive-store-heading">
      <div>
        <h3>
          ${config.icon}
          ${escapeHtml(config.label)}
        </h3>

        <p>
          ${escapeHtml(config.description)}
        </p>
      </div>

      <span class="progressive-store-count">
        ${
          hasAffiliateSearch
            ? "Zobacz oferty"
            : (
                count +
                " " +
                (
                  count === 1
                    ? "oferta"
                    : (
                        count >= 2 &&
                        count <= 4
                          ? "oferty"
                          : "ofert"
                      )
                )
              )
        }
      </span>
    </div>
  `;
}

function amazonAffiliateSearchHtml(
  amazonSearch,
  data
) {
  if (
    !amazonSearch ||
    !amazonSearch.url
  ) {
    return "";
  }

  const categoryIcon =
    String(
      data?.query_profile
        ?.category_icon ||
      "📦"
    );

  const phrase =
    String(
      amazonSearch.query ||
      data?.effective_query ||
      ""
    );

  return `
    <article class="amazon-search-card">
      <span
        class="amazon-search-visual"
        aria-hidden="true">
        ${escapeHtml(categoryIcon)}
      </span>

      <div class="amazon-search-copy">
        <span class="amazon-search-eyebrow">
          Amazon.pl
        </span>

        <h4>
          ${escapeHtml(
            amazonSearch.title ||
            (
              "Sprawdź „" +
              phrase +
              "” na Amazon.pl"
            )
          )}
        </h4>

        <p>
          Otwórz aktualną listę produktów na Amazon.pl.
          Wyszukiwanie zachowuje wskazaną cechę oraz limit ceny,
          np. „słuchawki ANC do 300 zł”.
        </p>

        <p class="amazon-search-disclosure">
          ${escapeHtml(
            amazonSearch.disclosure ||
            "Jako Partner Amazon zarabiam na kwalifikujących się zakupach."
          )}
        </p>

      </div>

      <a
        class="amazon-search-action"
        href="${escapeHtml(amazonSearch.url)}"
        target="_blank"
        rel="nofollow sponsored noopener">
        📦
        ${escapeHtml(
          amazonSearch.button_label ||
          "Zobacz na Amazon.pl"
        )}
      </a>
    </article>
  `;
}


function progressiveCurrentStageHtml(
  data
) {
  if (
    data.progressive_complete
  ) {
    return `
      <section class="progressive-stage-banner">
        <span
          class="progressive-stage-icon"
          aria-hidden="true">
          ✅
        </span>

        <div>
          <strong>
            Wszystkie dostępne sklepy zostały sprawdzone
          </strong>

          <p>
            Wyniki pozostają w kolejności:
            Ceneo, Allegro, Amazon.pl i AliExpress.
          </p>
        </div>
      </section>
    `;
  }

  const sourceKey =
    data.current_source;

  const config =
    PROGRESSIVE_SOURCE_CONFIG[
      sourceKey
    ];

  if (!config) {
    return "";
  }

  return `
    <section class="progressive-stage-banner">
      <span
        class="progressive-stage-icon"
        aria-hidden="true">
        ${config.icon}
      </span>

      <div>
        <strong>
          ${escapeHtml(config.startMessage)}
        </strong>

        <p>
          Możesz już oglądać wcześniejsze wyniki.
          Ten sklep dołączy swoje oferty automatycznie.
        </p>
      </div>
    </section>
  `;
}

function renderProgressiveResults(
  data,
  query
) {
  const sourceSections =
    data?.source_sections ||
    {};

  const allPolish = [
    ...(
      sourceSections.ceneo ||
      []
    ),
    ...(
      sourceSections.allegro ||
      []
    ),
    ...(
      sourceSections.amazon ||
      []
    )
  ];

  const allImport = [
    ...(
      sourceSections.aliexpress ||
      []
    )
  ];

  lastCombinedPayload =
    data;

  lastCombinedQuery =
    query;

  results.innerHTML =
    resultControlButtons() +
    (
      data.query_profile
        ? queryProfileHtml(data)
        : ""
    ) +
    sourceHealthHtml(data) +
    `
      <div class="ranking-explainer">
        <strong>Wyniki pojawiają się etapami:</strong>
        najpierw Ceneo, później Allegro, potem Amazon.pl,
        a na końcu AliExpress. Po każdym etapie strona
        przejdzie do świeżo dodanych wyników.
      </div>
    ` +
    progressiveCurrentStageHtml(
      data
    ) +
    progressiveHumanMessageHtml(
      data
    );

  const allPolishGroups =
    sortProductGroups(
      groupProductsByIdentity(
        allPolish
      )
    );

  const allImportGroups =
    sortProductGroups(
      groupProductsByIdentity(
        allImport
      )
    );

  prepareComparisonCandidates(
    allPolishGroups,
    allImportGroups
  );

  finalDecisionContext = {
    polishGroups:
      allPolishGroups,
    importGroups:
      allImportGroups,
    data
  };

  let visibleCount = 0;

  PROGRESSIVE_SOURCE_ORDER
    .forEach(
      sourceKey => {
        const config =
          PROGRESSIVE_SOURCE_CONFIG[
            sourceKey
          ];

        if (
          currentMarketplaceFilter !==
            "all" &&
          currentMarketplaceFilter !==
            config.name
        ) {
          return;
        }

        const sourceProducts =
          Array.isArray(
            sourceSections[
              sourceKey
            ]
          )
            ? sourceSections[
                sourceKey
              ]
            : [];

        const meta =
          data.source_meta?.[
            sourceKey
          ] ||
          {
            state: "queued"
          };

        const wasCompleted =
          data.completed_sources
            ?.includes(
              sourceKey
            );

        const isCurrent =
          data.current_source ===
          sourceKey &&
          !data.progressive_complete;

        const hasAmazonSearch =
          sourceKey === "amazon" &&
          Boolean(
            data.amazon_search?.url
          );

        if (
          !sourceProducts.length &&
          !wasCompleted &&
          !isCurrent &&
          !hasAmazonSearch
        ) {
          return;
        }

        results.insertAdjacentHTML(
          "beforeend",
          `
            <section
              class="progressive-store-section"
              data-progressive-store="${escapeHtml(sourceKey)}">
              ${progressiveStoreHeadingHtml(
                sourceKey,
                sourceProducts.length,
                hasAmazonSearch
              )}

              ${
                isCurrent &&
                !sourceProducts.length
                  ? `
                    <div class="progressive-source-waiting">
                      ${escapeHtml(config.startMessage)}
                    </div>
                  `
                  : ""
              }

              ${
                wasCompleted &&
                !sourceProducts.length &&
                !hasAmazonSearch
                  ? `
                    <div class="progressive-source-empty">
                      ${
                        meta.state ===
                          "affiliate_program_unavailable"
                          ? (
                              "Amazon.pl nie jest obecnie aktywnym " +
                              "programem partnerskim w Twoim Admitad, " +
                              "dlatego nie pokazujemy zwykłych linków bez afiliacji."
                            )
                          : (
                              "Nie znaleźliśmy pełnego produktu, który " +
                              "przeszedł filtr jakości dla tego sklepu."
                            )
                      }
                    </div>
                  `
                  : ""
              }
            </section>
          `
        );

        if (hasAmazonSearch) {
          results.insertAdjacentHTML(
            "beforeend",
            amazonAffiliateSearchHtml(
              data.amazon_search,
              data
            )
          );

          visibleCount += 1;
          return;
        }

        if (!sourceProducts.length) {
          return;
        }

        const section =
          config.section;

        const groups =
          sortProductGroups(
            groupProductsByIdentity(
              sourceProducts
            )
          );

        groups.forEach(
          (group, index) => {
            results.insertAdjacentHTML(
              "beforeend",
              group.length > 1
                ? comparisonCardHtml(
                    group,
                    index,
                    section
                  )
                : productCardHtml(
                    group[0],
                    index,
                    section
                  )
            );
          }
        );

        visibleCount +=
          groups.length;
      }
    );

  if (
    data.progressive_complete
  ) {
    results.insertAdjacentHTML(
      "beforeend",
      finalSummaryIntroHtml()
    );

    const smartPicks =
      smartPicksHtml(
        allPolishGroups,
        allImportGroups
      );

    if (smartPicks) {
      results.insertAdjacentHTML(
        "beforeend",
        smartPicks
      );
    }

    const debugPanel =
      debugResultsPanelHtml(
        data
      );

    if (debugPanel) {
      results.insertAdjacentHTML(
        "beforeend",
        debugPanel
      );
    }

    const advisor =
      shoppingAdvisorHtml(
        allPolishGroups,
        allImportGroups,
        data
      );

    if (advisor) {
      results.insertAdjacentHTML(
        "beforeend",
        advisor
      );
    }

    const decision =
      finalDecisionLauncherHtml(
        allPolishGroups,
        allImportGroups,
        data
      );

    if (decision) {
      results.insertAdjacentHTML(
        "beforeend",
        decision
      );
    }

    const upgrade =
      budgetUpgradeHtml(
        allPolishGroups,
        allImportGroups,
        data
      );

    if (upgrade) {
      results.insertAdjacentHTML(
        "beforeend",
        upgrade
      );
    }
  }

  results.hidden = false;
  emptyState.hidden = true;

  resultsTitle.textContent =
    `Wyniki dla: „${query}”`;

  const counts = {
    ceneo:
      sourceSections.ceneo
        ?.length || 0,
    allegro:
      sourceSections.allegro
        ?.length || 0,
    amazon:
      data.amazon_search?.url
        ? "gotowe"
        : "brak",
    aliexpress:
      sourceSections.aliexpress
        ?.length || 0
  };

  resultsInfo.textContent =
    `${counts.ceneo} Ceneo + ` +
    `${counts.allegro} Allegro + ` +
    `Amazon.pl: ${counts.amazon} + ` +
    `${counts.aliexpress} AliExpress`;

  bindResultControls();
  bindComparisonButtons();
  bindFinalDecisionLaunchers();
  bindDebugReportActions();
  renderComparisonTray();

  enhanceRenderedAccessibility(
    query,
    visibleCount
  );
}

async function waitForProgressiveMoment(
  milliseconds = 650
) {
  await new Promise(
    resolve =>
      window.setTimeout(
        resolve,
        milliseconds
      )
  );
}


async function searchViaMainBackend(
  query,
  supplement = "",
  requestId = ""
) {
  const response = await fetch(
    "/api/smartzakupy/main-search",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        query,
        supplement:
          cleanSupplement(
            supplement
          ),
        request_id:
          String(
            requestId || ""
          )
      })
    }
  );

  const data = await response.json().catch(() => ({}));

  if (!response.ok || !data.ok) {
    throw new Error(
      data.error || "Nie udało się zakończyć wyszukiwania."
    );
  }

  return data;
}

async function searchProducts(
  query,
  supplement = ""
) {
  const cleanQuery =
    String(
      query || ""
    ).trim();

  const cleanExtra =
    cleanSupplement(
      supplement
    );

  const displayQuery =
    effectiveSearchQuery(
      cleanQuery,
      cleanExtra
    );

  if (!cleanQuery) {
    renderDemoProducts(
      localProducts.slice(
        0,
        6
      )
    );

    loadRecentSearches();
    return;
  }

  stopLiveCompletionPolling();
  stopSearchProgressPolling();

  currentMarketplaceFilter =
    "all";

  currentSortMode =
    "best";

  progressiveSearchGeneration +=
    1;

  const generation =
    progressiveSearchGeneration;

  progressiveLoaderMode =
    true;

  searchProgressStartedAt =
    Date.now();

  searchProgressDisplayed =
    3;

  searchProgressTarget =
    6;

  searchProgressStep =
    0;

  searchProgressMessage =
    PROGRESSIVE_SOURCE_CONFIG
      .ceneo
      .startMessage;

  setLoading(true);

  setSearchStatus(
    displayQuery
  );

  scrollToSearchLoader();

  let payload =
    progressiveInitialPayload(
      cleanQuery,
      cleanExtra
    );

  try {
    for (
      let index = 0;
      index <
      PROGRESSIVE_SOURCE_ORDER.length;
      index += 1
    ) {
      if (
        generation !==
        progressiveSearchGeneration
      ) {
        return;
      }

      const sourceKey =
        PROGRESSIVE_SOURCE_ORDER[
          index
        ];

      const config =
        PROGRESSIVE_SOURCE_CONFIG[
          sourceKey
        ];

      payload.current_source =
        sourceKey;

      payload.source_meta[
        sourceKey
      ] = {
        state: "searching_live",
        source:
          config.name,
        warning: null
      };

      searchProgressStep =
        index;

      searchProgressTarget =
        config.startProgress;

      searchProgressMessage =
        config.startMessage;

      updateSearchLoader(
        searchProgressDisplayed,
        {
          step: index,
          message:
            config.startMessage
        }
      );

      if (
        payload.completed_sources
          .length
      ) {
        renderProgressiveResults(
          payload,
          displayQuery
        );
      }

      let response = null;

      try {
        response =
          await fetchProgressiveSource(
            sourceKey,
            cleanQuery,
            cleanExtra,
            payload.references
          );
      } catch (error) {
        response = {
          ok: true,
          source: sourceKey,
          sections: {
            [config.section]: []
          },
          source_meta: {
            [sourceKey]: {
              state: "unavailable",
              source:
                config.name,
              warning:
                error.message ||
                (
                  config.name +
                  " jest chwilowo niedostępne."
                )
            }
          },
          query_profile:
            payload.query_profile,
          reference: null
        };
      }

      if (
        generation !==
        progressiveSearchGeneration
      ) {
        return;
      }

      payload =
        mergeProgressiveSourceResult(
          payload,
          response
        );

      const nextSource =
        PROGRESSIVE_SOURCE_ORDER[
          index + 1
        ] ||
        null;

      payload.current_source =
        nextSource;

      searchProgressTarget =
        config.doneProgress;

      searchProgressMessage =
        config.doneMessage;

      updateSearchLoader(
        searchProgressDisplayed,
        {
          step:
            Math.min(
              index + 1,
              4
            ),
          message:
            config.doneMessage
        }
      );

      renderProgressiveResults(
        payload,
        displayQuery
      );

      scrollToProgressiveSource(
        sourceKey
      );

      await waitForProgressiveMoment(
        850
      );
    }

    payload.progressive_complete =
      true;

    payload.current_source =
      null;

    payload.mode =
      "progressive_complete";

    searchProgressStep =
      4;

    searchProgressTarget =
      100;

    searchProgressMessage =
      "Wszystkie dostępne wyniki są gotowe.";

    updateSearchLoader(
      searchProgressDisplayed,
      {
        step: 4,
        message:
          searchProgressMessage
      }
    );

    renderProgressiveResults(
      payload,
      displayQuery
    );

    scrollToFinalSummary();

    loadRecentSearches();

    announceAccessibility(
      "Zakończono przeszukiwanie Ceneo, Allegro, Amazon.pl i AliExpress."
    );

    await waitForProgressiveMoment(
      550
    );
  } finally {
    if (
      generation ===
      progressiveSearchGeneration
    ) {
      progressiveLoaderMode =
        false;

      setLoading(false);
    }
  }
}

if (form) {
  form.addEventListener(
    "submit",
    event => {
      event.preventDefault();

      searchProducts(
        input.value,
        effectiveSupplementValue()
      );
    }
  );
}

document
  .querySelectorAll(
    "[data-query]"
  )
  .forEach(button => {
    button.addEventListener(
      "click",
      () => {
        input.value =
          button.dataset.query ||
          "";

        clearSupplementarySearch();

        searchProducts(
          input.value,
          ""
        );
      }
    );
  });

renderDemoProducts(localProducts.slice(0, 6));
