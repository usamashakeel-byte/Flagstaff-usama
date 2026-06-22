/* =========================================================================
   Flagstaff Social, Onboarding POC
   Complete onboarding use case.
   - Step-based conversation engine (each step is an async function)
   - Account-type branching (Brand vs Individual)
   - All input methods (URL / Upload / Verbal)
   - All skip / edit / adjust branches
   - Dashboard pending items reflect actual skipped steps
   No backend; Scout's "intelligence" is a deterministic story.
   ========================================================================= */

(() => {

/* =========================================================================
   1. STATE
   ========================================================================= */
const state = {
  accountType: 'brand',          // 'brand' | 'individual' (confirmed in chat post-scan)
  user: { name: 'Abdullah' },     // simulated: captured at sign-up before the conversation

  // Knowledge bases — populated as the conversation runs. The KB widget at
  // top-right reflects this in real time. Each entry: { label, value }.
  // Single panel-level expand state (compact 2×2 squares vs expanded 1/3-width).
  kb: {
    activeId: 'brand',         // Scout starts by filling Brand
    actionCallback: null,      // set during a confirmation moment; cleared on resolve
    kbReveal: new Set(),   // tracks which brand card sections are unlocked
    brand:     { facts: [], expanded: false },
    trending:  { facts: [], expanded: false },
  },

  // Identity collected during onboarding (mutable, edits write here)
  brand: null,                    // populated by step1 based on accountType
  productLines: [],               // populated by step3a (brand path)
  topics: [],                     // populated for individuals
  goals: [],
  audience: '',
  tone: '',
  competitors: [],

  // First-post artifacts
  selectedTrendGroupId: null,
  selectedIterationId: null,
  draftPost: '',
  publishedPost: null,            // { body, postedAt } once user hits Publish

  // Skip / branch flags, drive dashboard pending items
  skipped: new Set(),

  // Demo richness flag, toggle to demo "new account" variant
  xAccountMaturity: 'established', // 'established' | 'new'
};

/* Two demo identities, chosen by accountType in step 1 */
const DEMO_BRAND = {
  // Identity
  name: 'rasa',
  niche: 'Fashion / Heritage',
  industry: 'Heritage Fashion',
  products: ['Sindhi-embroidered tops', 'Kashmiri shawls', 'Modern kurtas'],
  positioning: 'Modern Gen Z take on traditional Pakistani crafts',
  themes: ['Heritage', 'Sustainability', 'Local artisanship'],
  tone: 'Casual, witty, culture-forward',
  websiteUrl: 'https://rasa.studio',
  competitorsDefault: ['@generation.pk', '@khaadiofficial', '@sapphirepakistan'],
  // X profile metadata (mirrors what Twitter exposes)
  handle: '@rasa',
  displayName: 'rasa',
  bio: 'Heritage, restitched. Made by hand, worn with pride. Sindhi & Kashmiri craft for the next generation.',
  location: 'Karachi, Pakistan',
  verified: true,
  followers: '4,320',
  following: '218',
  postCount: '187',
  joinDate: 'March 2024',
  // Performance signals
  topTopics: [
    { name: 'Heritage origin stories',   engagement: 92 },
    { name: 'Behind-the-scenes artisan', engagement: 67 },
    { name: 'Styling guides',            engagement: 45 },
  ],
  primaryAudience:   'Women 22–34 · Pakistan & diaspora',
  secondaryAudience: 'Mothers and gift buyers · 35–50',
  peakActivity: 'Weekdays 2–4pm PKT',
  audienceDefault: 'Women 22–34 in Pakistan, the UAE, and the Pakistani diaspora, culturally curious, mobile-first, value heritage with a modern eye.',
  toneDirections: [
    {
      id: 'warm-story',
      label: 'Warm, story-led',
      icon: 'i-heart',
      recommended: true,
      recommendedReason: "Story-led posts in your niche save 3× more than product-only content, and your audience responds strongest to personal context behind the craft.",
      sample: "Heritage isn't an aesthetic. It's a postcode and a person who can name the stitch. We learn first, then we make.",
    },
    {
      id: 'direct-candid',
      label: 'Direct, candid',
      icon: 'i-bolt',
      sample: "We don't 'reinterpret tradition'. We work with people doing it now and we pay them properly. Everything else is marketing.",
    },
    {
      id: 'reverent-grounded',
      label: 'Reverent, grounded',
      icon: 'i-mountain',
      sample: "Sindhi mirror work. Mid-century origins. Bibi taught us. She's been at it 31 years. Worth knowing whose hands made what you wear.",
    },
  ],
  trendGroups: [
    {
      id: 'heritage',
      theme: '#SouthAsianHeritageWeek',
      tone: 'Warm, story-led',
      format: 'Image + caption',
      signal: '4.2× w/w',
      summary: 'Spiking now. Strong overlap with your themes and audience.',
    },
    {
      id: 'founder',
      theme: 'Founder transparency',
      tone: 'Direct, candid',
      format: 'Short thread',
      signal: 'Saves +38%',
      summary: 'Audiences in your niche are bookmarking honest founder notes more than launches.',
    },
    {
      id: 'craft',
      theme: 'Behind-the-scenes craft',
      tone: 'Reverent, grounded',
      format: 'Single post + photo',
      signal: 'Saves > likes',
      summary: 'Workshop content gets craft questions; studio content gets price questions.',
    },
  ],
  postIterations: {
    heritage: [
      { id: 'a', angle: 'Personal story', body: "My nani's dupatta has stitches I can't name. This week I'm trying to learn them, properly. If you've got heritage you don't fully know, you're not alone. Pull a thread, see what unspools." },
      { id: 'b', angle: 'Hot take',       body: "Half of what gets called 'heritage' on this app is aesthetics with no postcode. The actual craft has names, regions, and people still doing it for less than it's worth. Worth knowing the difference." },
      { id: 'c', angle: 'Data-driven',    body: "We pulled the numbers on our last 30 posts. The ones that named the artisan and the region got 3.8× the saves of pure product shots. Audiences want context, not catalog. #SouthAsianHeritageWeek" },
    ],
    founder: [
      { id: 'a', angle: 'Personal story', body: "Year one of running rasa: I underpaid myself, overpaid for marketing, and learned that the artisans we work with had been waiting twenty years for someone to put their names on the label. That last one is why we keep going." },
      { id: 'b', angle: 'Hot take',       body: "Founder transparency on this app is mostly performance. Real transparency is boring. This is what the cost breakdown looks like, this is what we got wrong last quarter, this is what we're still figuring out." },
      { id: 'c', angle: 'Data-driven',    body: "Posts where we share an honest founder note get 2.6× more replies than launch posts. Replies turn into customers at 4× the rate of likes. The lesson: stop polishing, start talking." },
    ],
    craft: [
      { id: 'a', angle: 'Personal story', body: "Spent the morning at Bibi's workshop in Hyderabad. She's been doing mirror work for 31 years. Her hands move faster than I can take notes. Some of what we sell started here. Felt important to say." },
      { id: 'b', angle: 'Hot take',       body: "If your 'handcrafted' brand can't show you the hands, it isn't. The reason most heritage brands hide the workshop is that the workshop is the asset, not the boutique." },
      { id: 'c', angle: 'Data-driven',    body: "Workshop reels outperform studio reels 1.8× for us. The comment sentiment is different too. Workshop content gets craft questions, studio content gets price questions. Tells you what your audience actually cares about." },
    ],
  },
};

const DEMO_INDIVIDUAL = {
  name: 'Abdullah Qamar',
  niche: 'Product design / Design systems',
  industry: 'Product Design',
  products: ['Practical design writing', 'Design-system templates', 'Office-hours mentoring'],
  positioning: 'Practical product design, no fluff, no jargon, things you can actually use Monday',
  themes: ['Design systems', 'Career growth', 'Honest critique'],
  tone: 'Direct, generous, lightly opinionated',
  websiteUrl: 'https://aqamar.design',
  competitorsDefault: ['@brian_lovin', '@mds', '@rauchg'],
  handle: '@aqamar',
  displayName: 'Abdullah Qamar',
  bio: 'Independent product designer. Writing about craft, systems, and shipping. Office hours every Friday.',
  location: 'Lahore, Pakistan',
  verified: false,
  followers: '2,140',
  following: '486',
  postCount: '94',
  joinDate: 'January 2023',
  topTopics: [
    { name: 'Design-system teardowns', engagement: 88 },
    { name: 'Honest takes',            engagement: 64 },
    { name: 'Career advice threads',   engagement: 41 },
  ],
  primaryAudience:   'Designers · PMs · 25–40',
  secondaryAudience: 'Founders / heads of product at early-stage startups',
  peakActivity: 'Weekday mornings PKT',
  audienceDefault: 'Designers and PMs 25–40, mid-level, building craft and reputation. Mostly North America and South Asia, mobile-first, save things for later.',
  toneDirections: [
    {
      id: 'direct-generous',
      label: 'Direct, generous',
      icon: 'i-compass',
      recommended: true,
      recommendedReason: "Your top posts lead with a concrete observation, not a take. Your audience bookmarks things they can use — this voice matches that pattern best.",
      sample: "Most design-system posts skip the part that matters: adoption. Token tables are easy. Getting a PM to ship without DM-ing a designer is hard.",
    },
    {
      id: 'confessional-specific',
      label: 'Confessional, specific',
      icon: 'i-quote',
      sample: "Shipped a design system once. Engineers ignored it for six months. The fix: I'd built the wrong primitive. Lesson learned twice.",
    },
    {
      id: 'sharp-contrarian',
      label: 'Sharp, contrarian',
      icon: 'i-diamond',
      sample: "'AI replaces designers' is a take from people who don't ship. The real question is which 30% of the job goes first, and whether you're spending 30% of your time there.",
    },
  ],
  topics: [
    'Design systems',
    'Product craft',
    'AI tooling',
    'Career growth',
    'Honest critique',
    'Design leadership',
    'Indie shipping',
    'Side projects',
  ],
  trendGroups: [
    {
      id: 'ai-tooling',
      theme: 'AI tooling debate',
      tone: 'Measured, opinionated',
      format: 'Short thread',
      signal: 'Saves 5.6× on nuance',
      summary: 'Designers split on Cursor / Figma AI. Specifics outperform takes.',
    },
    {
      id: 'system-teardowns',
      theme: 'Design-system teardowns',
      tone: 'Direct, generous',
      format: 'Post + screenshot',
      signal: 'Bookmarks 3× niche avg',
      summary: 'Audiences in your niche save concrete component decisions more than essays.',
    },
    {
      id: 'public-work',
      theme: 'Working in public',
      tone: 'Specific, confessional',
      format: 'Single post',
      signal: 'Reply rate +42%',
      summary: 'Posts that name what you got wrong outperform highlight reels.',
    },
  ],
  postIterations: {
    'ai-tooling': [
      { id: 'a', angle: 'Personal story', body: "I tried replacing my Figma workflow with Cursor for two weeks. Three things broke, two things got faster, one thing made me look stupider than I actually am. Notes below." },
      { id: 'b', angle: 'Hot take',       body: "The 'AI replaces designers' debate is mostly people who don't design talking to people who don't ship. The real question is which 30% of the job goes first, and whether you're already spending 30% of your time on it." },
      { id: 'c', angle: 'Data-driven',    body: "Looked at engagement on AI-tool posts in our niche over 90 days. Nuanced takes (specific tool, specific task, specific tradeoff) outperform 'AI is great/bad' posts by 5.6× on saves. Specifics win." },
    ],
    'system-teardowns': [
      { id: 'a', angle: 'Personal story', body: "First time I shipped a design system, I optimized the wrong thing for six months. I made the buttons perfect. Nobody used the buttons. The thing engineering needed was a layout primitive I hadn't built. Lesson learned twice." },
      { id: 'b', angle: 'Hot take',       body: "Most design-system posts on here are screenshots of token tables. Tokens aren't the system. The system is whether a PM can ship a feature without DM'ing a designer at 6pm. Measure that." },
      { id: 'c', angle: 'Data-driven',    body: "Audit of 12 internal design systems I've worked on: the ones that got adopted shared one trait. They shipped one usable component before they had a doc site. The ones with great docs and no early component sat unused. Component first, doc second." },
    ],
    'public-work': [
      { id: 'a', angle: 'Personal story', body: "Office hours this Friday. Four free 30-minute slots for designers stuck on a system decision. I'll learn something too. Half the time the question reframes how I'd answer it. Reply if you want one." },
      { id: 'b', angle: 'Hot take',       body: "Building in public on this app has become its own genre, and most of it is the same three updates dressed differently. If you want it to land, share the decision you got wrong, not the dashboard going up and to the right." },
      { id: 'c', angle: 'Data-driven',    body: "Posts where I share something I got wrong get 2.4× the reply rate of posts where I share what worked. Replies become DMs become consulting calls. The 'wrong' content is the funnel." },
    ],
  },
};

/* =========================================================================
   2. DOM HELPERS
   ========================================================================= */
const $  = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
const stream = $('#stream');
const crumbs = $('#crumbs');

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// Parse a raw SVG string into actual SVG DOM (innerHTML on an <svg> element
// uses the HTML parser and silently lowercases names like `linearGradient`
// and discards SVG-specific attributes). Use this when you need proper SVG.
function parseSvg(svgString) {
  const doc = new DOMParser().parseFromString(svgString, 'image/svg+xml');
  return doc.documentElement;
}

function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') node.className = v;
    else if (k === 'html') node.innerHTML = v;
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
    else if (v != null) node.setAttribute(k, v);
  }
  for (const c of [].concat(children)) {
    if (c == null) continue;
    node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
  }
  return node;
}

const icon = (id) => `<svg><use href="#${id}"/></svg>`;

function scrollDown() {
  // Scroll on the next frame, then again after the typical card-in animation
  // (~380ms). The second pass catches cards that grow after appending.
  requestAnimationFrame(() => { stream.scrollTop = stream.scrollHeight; });
  setTimeout(() => { stream.scrollTop = stream.scrollHeight; }, 400);
}

function append(node) {
  stream.appendChild(node);
  scrollDown();
  // Some elements (cards) have an entry animation that grows their height.
  // Re-scroll once the animation finishes so the bottom stays in view.
  node.addEventListener('animationend', () => {
    stream.scrollTop = stream.scrollHeight;
  }, { once: true });
  return node;
}

function showView(id) {
  $$('.view').forEach(v => v.classList.remove('view--active'));
  $('#' + id).classList.add('view--active');
  document.body.classList.toggle('mode-conv', id === 'view-conv' || id === 'view-dash');
  // Sync sidebar active state
  $$('.sidebar__btn[data-nav]').forEach(b => b.removeAttribute('aria-current'));
  const navMap = { 'view-home': 'home', 'view-dash': 'analytics', 'view-conv': 'posts' };
  const activeNav = navMap[id];
  if (activeNav) {
    const btn = document.querySelector(`.sidebar__btn[data-nav="${activeNav}"]`);
    if (btn) btn.setAttribute('aria-current', 'page');
  }
}

function setCrumbs(parts) {
  crumbs.innerHTML = '';
  parts.forEach((p, i) => {
    if (i > 0) crumbs.appendChild(el('span', { class: 'crumbs__sep' }, '›'));
    crumbs.appendChild(el('span', { class: i === parts.length - 1 ? 'crumbs__current' : '' }, p));
  });
}

/* =========================================================================
   3. MESSAGE RENDERERS
   ========================================================================= */
function scoutTyping() {
  // The avatar IS the loader. Inline circles so each can carry its own
  // animation phase. No separate body element during the thinking moment.
  const avatarSvg =
    '<svg viewBox="0 0 32 32" aria-hidden="true">' +
      '<circle cx="8"  cy="8"  r="6" class="scout-loader__c scout-loader__c--1"/>' +
      '<circle cx="8"  cy="24" r="6" class="scout-loader__c scout-loader__c--2"/>' +
      '<circle cx="24" cy="24" r="6" class="scout-loader__c scout-loader__c--3"/>' +
      '<circle cx="24" cy="8"  r="6" class="scout-loader__c scout-loader__c--4"/>' +
    '</svg>';

  const node = el('div', { class: 'msg msg--scout' }, [
    el('div', { class: 'msg__head' }, [
      el('span', {
        class: 'msg__avatar msg__avatar--scout msg__avatar--loading',
        'aria-label': 'Scout is thinking',
        html: avatarSvg,
      }),
      el('span', { class: 'msg__name' }, 'Scout'),
    ]),
  ]);
  return append(node);
}

async function scoutMsg(text, { beat = 600, typingFor = 700, charSpeed = 14 } = {}) {
  // Only the current Scout message shows its avatar/name head. Mark previous
  // ones as past so the chat reads as a single live speaker rather than a
  // wall of repeated avatars.
  document.querySelectorAll('.msg--scout').forEach(m => m.classList.add('msg--past'));
  const typingNode = scoutTyping();
  await sleep(typingFor);
  // Avatar stops animating: drop the loading class and swap inline circles
  // for the static logo reference.
  const avatar = typingNode.querySelector('.msg__avatar--scout');
  avatar.classList.remove('msg__avatar--loading');
  avatar.innerHTML = '<svg><use href="#i-logo"/></svg>';
  // Strip **bold** markers from the raw text before typewriter (so asterisks never show),
  // but preserve the content — highlightKeywords will bold them via the escaped HTML pass.
  const displayText = text.replace(/\*\*(.+?)\*\*/g, '$1');
  // Append text node and stream characters into it.
  const textNode = el('div', { class: 'msg__text' });
  typingNode.appendChild(textNode);
  scrollDown();
  await typewriterInto(textNode, displayText, charSpeed);
  // After typewriter completes, auto-emphasise key tokens for visual hierarchy.
  // Also re-bold any **…** spans that were in the original text.
  const boldPhrases = [];
  text.replace(/\*\*(.+?)\*\*/g, (_, p) => boldPhrases.push(p));
  textNode.innerHTML = highlightKeywords(textNode.textContent, boldPhrases);
  await sleep(beat);
  return typingNode;
}

// Wraps numbers, brand/user names, and a small allow-list of key actions in
// <strong class="kw"> so they read as visual anchors against the lighter body.
function highlightKeywords(text, boldPhrases = []) {
  if (!text) return '';
  const escape = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const tokens = [];
  if (state && state.user && state.user.name) tokens.push(state.user.name);
  if (state && state.brand && state.brand.displayName) tokens.push(state.brand.displayName);
  if (state && state.brand && state.brand.name && (!state.brand.displayName || state.brand.name !== state.brand.displayName)) {
    tokens.push(state.brand.name);
  }
  tokens.sort((a, b) => b.length - a.length);
  const escForRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const tokenAlt = tokens.length ? tokens.map(escForRe).join('|') : null;
  const combined = new RegExp(
    [
      tokenAlt && `\\b(?:${tokenAlt})\\b`,
      '\\b\\d{1,3}(?:,\\d{3})+\\b',
      '\\b\\d+(?:\\.\\d+)?×',
      '\\b\\d+(?:\\.\\d+)?%',
      '\\bfive minutes\\b',
      '\\bthree seconds\\b',
      '\\bConnect\\b',
      '\\bLooks right\\b',
      '\\bPublish\\b',
    ].filter(Boolean).join('|'),
    'g'
  );
  let result = escape(text).replace(combined, (m) => `<strong class="kw">${m}</strong>`);
  // Bold any explicitly marked phrases (from **…** in original text)
  boldPhrases.forEach((phrase) => {
    const safe = escForRe(escape(phrase));
    result = result.replace(new RegExp(safe, 'g'), (m) => {
      // Don't double-wrap if already inside <strong>
      return m.startsWith('<strong') ? m : `<strong class="kw">${m}</strong>`;
    });
  });
  return result;
}

async function typewriterInto(node, text, baseSpeed = 14) {
  // Reveal characters one at a time with natural rhythm at punctuation.
  // Auto-scrolls when newlines arrive so the user follows along.
  for (let i = 0; i < text.length; i++) {
    node.appendChild(document.createTextNode(text[i]));
    const ch = text[i];
    let delay;
    if (ch === '.' || ch === '?' || ch === '!') delay = 160;
    else if (ch === ',' || ch === ';' || ch === ':') delay = 90;
    else if (ch === '\n') { delay = 220; scrollDown(); }
    else delay = baseSpeed;
    await sleep(delay);
  }
  scrollDown();
}

function userMsg(text, { options = null, _restartStep = -1 } = {}) {
  // User messages render as a white right-aligned bubble. No avatar / name —
  // the bubble itself is the differentiation from Scout's plain-text turns.
  const bubble = el('div', { class: 'msg__bubble' }, text);

  const editBtn = el('button', { class: 'msg__edit-btn', type: 'button', 'aria-label': 'Edit message' }, [
    el('span', { html: icon('i-pencil') }),
    document.createTextNode('Edit'),
  ]);

  editBtn.addEventListener('click', () => {
    if (options && options.length) {
      // Re-show the original quick reply options
      bubble.style.display = 'none';
      editBtn.style.display = 'none';

      const cancelBtn = el('button', { class: 'msg__edit-cancel', type: 'button' }, 'Cancel');
      const pills = options.map((opt) => {
        const btn = el('button', {
          class: 'qreply' + (opt === bubble.textContent ? ' qreply--chosen' : ''),
        }, opt);
        btn.addEventListener('click', () => {
          // If same option picked, no replay needed — just close
          if (opt === bubble.textContent) {
            picker.remove();
            bubble.style.display = '';
            editBtn.style.display = '';
            return;
          }

          // Changing this answer replays the conversation from here, discarding
          // everything that came after (later answers, drafts, a published post).
          // If there's downstream work, confirm before destroying it.
          const streamEl = document.querySelector('#stream');
          const downstream = [];
          { let n = node.nextSibling; while (n) { downstream.push(n); n = n.nextSibling; } }

          const performReplay = () => {
            bubble.textContent = opt;
            bubble.style.display = '';
            editBtn.style.display = '';
            picker.remove();
            downstream.forEach((n) => streamEl.removeChild(n));
            // Queue the new answer and re-run from the step that produced this message
            _preAnswers.length = 0;
            _preAnswers.push(opt);
            _resumeFrom = _restartStep - 1;
            delete stream.dataset.started;
            runConversation();
          };

          if (downstream.length === 0) { performReplay(); return; }

          // Inline confirmation — replace the pills with a warning + Confirm/Cancel.
          picker.innerHTML = '';
          const warn = el('div', { class: 'msg__edit-warn' },
            'Changing this will clear everything after it and pick up from here. Continue?');
          const confirmBtn = el('button', { class: 'qreply qreply--primary', type: 'button' }, 'Yes, change it');
          const backBtn = el('button', { class: 'msg__edit-cancel', type: 'button' }, 'Keep as is');
          confirmBtn.addEventListener('click', performReplay);
          backBtn.addEventListener('click', () => {
            picker.remove();
            bubble.style.display = '';
            editBtn.style.display = '';
          });
          picker.append(warn, el('div', { class: 'msg__edit-actions' }, [backBtn, confirmBtn]));
        });
        return btn;
      });
      cancelBtn.addEventListener('click', () => {
        picker.remove();
        bubble.style.display = '';
        editBtn.style.display = '';
      });
      const picker = el('div', { class: 'msg__edit-picker' }, [
        el('div', { class: 'qreplies msg__edit-qreplies' }, pills),
        el('div', { class: 'msg__edit-actions' }, [cancelBtn]),
      ]);
      node.appendChild(picker);
    } else {
      const current = bubble.textContent;
      const ta = el('textarea', { class: 'msg__edit-ta' }, current);
      ta.rows = Math.max(2, Math.ceil(current.length / 48));

      const save = el('button', { class: 'msg__edit-save', type: 'button' }, 'Save');
      const cancel = el('button', { class: 'msg__edit-cancel', type: 'button' }, 'Cancel');

      const actions = el('div', { class: 'msg__edit-actions' }, [cancel, save]);
      const editor = el('div', { class: 'msg__editor' }, [ta, actions]);

      bubble.style.display = 'none';
      editBtn.style.display = 'none';
      node.appendChild(editor);
      ta.focus();
      ta.setSelectionRange(ta.value.length, ta.value.length);

      cancel.addEventListener('click', () => {
        editor.remove();
        bubble.style.display = '';
        editBtn.style.display = '';
      });

      save.addEventListener('click', () => {
        const val = ta.value.trim();
        if (val) bubble.textContent = val;
        editor.remove();
        bubble.style.display = '';
        editBtn.style.display = '';
      });
    }
  });

  const node = el('div', { class: 'msg msg--user' }, [bubble, editBtn]);
  node._restartStep = _restartStep;
  return append(node);
}

/* =========================================================================
   4. INTERACTIVE COMPONENTS
   Each returns a Promise resolving to the user's choice.
   ========================================================================= */

// Quick replies: pills register as a user-prompt bubble. All pills remain
// visible; the chosen one is highlighted, the rest dim but stay clickable so
// the user can change their mind. The choice commits after a short idle.
function quickReplies(options, { primaryIndex = -1, settleMs = 1500 } = {}) {
  // If a pre-answer exists (from an edit-replay), auto-pick it immediately.
  if (_preAnswers.length > 0) {
    const ans = _preAnswers.shift();
    const stepAtCall = _currentStep;
    const bubbleNode = userMsg(ans, { options, _restartStep: stepAtCall });
    return Promise.resolve(ans);
  }

  return new Promise((resolve) => {
    const stepAtCall = _currentStep;
    const wrap = el('div', { class: 'qreplies' });
    let activeBtn = null;
    let bubble = null;
    let commitTimer = null;

    const updateChoice = (btn, opt) => {
      if (activeBtn === btn) return;
      activeBtn = btn;
      Array.from(wrap.children).forEach((c) => {
        c.classList.toggle('qreply--chosen', c === btn);
        c.classList.toggle('qreply--dim', c !== btn);
      });
      if (!bubble) {
        bubble = userMsg(opt, { options, _restartStep: stepAtCall });
      } else {
        const t = bubble.querySelector('.msg__bubble');
        if (t) t.textContent = opt;
      }
      if (commitTimer) clearTimeout(commitTimer);
      commitTimer = setTimeout(() => {
        wrap.classList.add('qreplies--chosen');
        Array.from(wrap.children).forEach((c) => { c.disabled = true; });
        resolve(opt);
      }, settleMs);
    };

    options.forEach((opt, i) => {
      const btn = el('button', {
        class: 'qreply' + (i === primaryIndex ? ' qreply--primary' : ''),
        onclick: () => updateChoice(btn, opt),
      }, opt);
      wrap.appendChild(btn);
    });
    append(wrap);
  });
}

function selectionChips(options, {
  allowCustom = false,
  customLabel = 'Something else',
  maxSelections = 0, // 0 = unlimited
} = {}) {
  return new Promise((resolve) => {
    const selected = new Set();
    const group = el('div', { class: 'chips-group' });
    const helperRow = maxSelections > 0
      ? el('div', { class: 'chips-helper' }, `Pick ${maxSelections}`)
      : null;
    if (helperRow) group.appendChild(helperRow);
    const wrap = el('div', { class: 'chips' });

    // Sync capped/disabled state on every selectable chip. The "Add your
    // own" button is itself a chip but it's a *trigger*, not selectable —
    // so we don't toggle aria-pressed on it.
    const refreshState = () => {
      const atCap = maxSelections > 0 && selected.size >= maxSelections;
      Array.from(wrap.children).forEach((chip) => {
        if (chip.classList.contains('chip--custom')) {
          // The custom trigger goes capped when the user has filled all slots.
          chip.classList.toggle('chip--capped', atCap);
          return;
        }
        const pressed = chip.getAttribute('aria-pressed') === 'true';
        chip.classList.toggle('chip--capped', atCap && !pressed);
      });
      done.disabled = selected.size === 0;
    };

    // Toggle a regular (non-custom) chip. Handles cap shake + selection
    // accounting. Custom-added pills also use this handler so they can be
    // deselected by clicking them again.
    const toggleChip = (btn, value) => {
      const on = btn.getAttribute('aria-pressed') === 'true';
      if (!on && maxSelections > 0 && selected.size >= maxSelections) {
        btn.classList.remove('chip--shake');
        void btn.offsetWidth;
        btn.classList.add('chip--shake');
        return;
      }
      btn.setAttribute('aria-pressed', String(!on));
      on ? selected.delete(value) : selected.add(value);
      refreshState();
    };

    // Build the seed chips from the option list.
    options.forEach((opt) => {
      const btn = el('button', {
        class: 'chip',
        type: 'button',
        'aria-pressed': 'false',
        onclick: () => toggleChip(btn, opt),
      }, opt);
      wrap.appendChild(btn);
    });

    // "Add your own" trigger — clicking opens an inline text input. The
    // resulting pill is a regular chip with its own toggle handler, so
    // the user can click it again to deselect.
    let customTrigger = null;
    if (allowCustom) {
      customTrigger = el('button', {
        class: 'chip chip--custom',
        type: 'button',
        onclick: async () => {
          if (maxSelections > 0 && selected.size >= maxSelections) {
            customTrigger.classList.remove('chip--shake');
            void customTrigger.offsetWidth;
            customTrigger.classList.add('chip--shake');
            return;
          }
          const customText = await inlineTextInput({
            placeholder: 'Type your own…',
            submitLabel: 'Add',
          });
          if (!customText) return;
          // De-dup against existing tags (case-insensitive).
          const exists = Array.from(wrap.children).some(c =>
            !c.classList.contains('chip--custom') &&
            c.textContent.trim().toLowerCase() === customText.trim().toLowerCase()
          );
          if (exists) return;
          selected.add(customText);
          const tag = el('button', {
            class: 'chip',
            type: 'button',
            'aria-pressed': 'true',
            onclick: () => toggleChip(tag, customText),
          }, customText);
          wrap.insertBefore(tag, customTrigger);
          refreshState();
        },
      }, customLabel);
      wrap.appendChild(customTrigger);
    }

    const done = el('button', {
      class: 'qreply qreply--primary chips__done',
      type: 'button',
      disabled: 'true',
      onclick: () => {
        if (selected.size === 0) return;
        const list = Array.from(selected);
        // Drop unselected chips + the custom trigger; freeze selected ones.
        Array.from(wrap.children).forEach((chip) => {
          const isPressed = chip.getAttribute('aria-pressed') === 'true';
          const isCustomTrigger = chip.classList.contains('chip--custom');
          if (isCustomTrigger || !isPressed) chip.remove();
        });
        Array.from(wrap.children).forEach((chip) => {
          chip.disabled = true;
          chip.classList.add('chip--chosen');
        });
        wrap.classList.add('chips--chosen');
        if (helperRow) helperRow.remove();
        doneRow.remove();
        group.classList.add('is-settled');
        userMsg(list.join(', '));
        resolve(list);
      },
    }, 'Done');
    const doneRow = el('div', { class: 'chips-group__actions' }, [done]);
    group.appendChild(wrap);
    group.appendChild(doneRow);
    append(group);
  });
}

function inlineTextInput({ placeholder = 'Type a response…', submitLabel = 'Send', initial = '' } = {}) {
  return new Promise((resolve) => {
    const input = el('input', { type: 'text', placeholder, value: initial });
    const wrap = el('div', { class: 'url-inline' }, [
      input,
      el('button', {
        onclick: () => {
          const v = input.value.trim();
          wrap.remove();
          if (v) userMsg(v);
          resolve(v);
        },
      }, submitLabel),
    ]);
    append(wrap);
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') wrap.querySelector('button').click(); });
    requestAnimationFrame(() => input.focus());
  });
}

// ----- Composer-as-input ----------------------------------------------------
// The chat bar at the bottom is the universal text input. By default it is
// DISABLED. It is enabled only while we are awaiting user text input
// (awaitComposer). At every other moment (Scout typing, narrated processing,
// pending quick-reply or chip selection), the composer reads as inert so the
// user knows to interact through the controls Scout has surfaced.
let pendingComposerResolver = null;

function setComposerEnabled(enabled) {
  const input = $('#composer-input');
  const send = $('#composer-send');
  const pill = $('.composer-pill');
  if (!input || !pill) return;
  input.disabled = !enabled;
  if (send) send.disabled = !enabled;
  pill.classList.toggle('composer-pill--disabled', !enabled);
}

function awaitComposer({ placeholder = 'Message Scout…' } = {}) {
  return new Promise((resolve) => {
    const input = $('#composer-input');
    input.placeholder = placeholder;
    pendingComposerResolver = resolve;
    setComposerEnabled(true);
    requestAnimationFrame(() => input.focus());
  });
}

async function openingHero() {
  // Only skip the picker if we have both an accountType in session AND an active
  // checkpoint — meaning the user was mid-conversation and reloaded.
  // A fresh login (no checkpoint) should always show the picker.
  try {
    const s  = JSON.parse(sessionStorage.getItem('fs_session') || '{}');
    const ck = JSON.parse(sessionStorage.getItem(CHECKPOINT_KEY) || 'null');
    if (s.accountType && ck) { state.accountType = s.accountType; return; }
  } catch (e) {}

  // Greeting hero: Scout logo animates in, then the greeting beats type out,
  // then the profile-type picker reveals. No "Start" hook — splash 3's CTA
  // already framed the journey, so we land directly on Scout's introduction.
  const hero = buildHero();
  $('.conv').prepend(hero);
  document.body.classList.add('mode-hero');

  const logoStage = hero.querySelector('.hero__mark');
  const titleEl   = hero.querySelector('.hero__title');
  const subEl     = hero.querySelector('.hero__sub');
  const greet     = {
    title:    hero.querySelector('.hero__title'),
    sub:      hero.querySelector('.hero__sub'),
    question: hero.querySelector('.hero__question'),
    blocks:   hero.querySelector('.hero__blocks'),
  };

  // Beat 0: Scout logo animates in (scale + fade) and stays.
  await sleep(220);
  logoStage.classList.add('hero__stage--in', 'hero__mark--enter');
  await sleep(720);

  // Beat 1: "Hi, [Name]."
  greet.title.classList.add('hero__stage--in');
  await typewriterInto(titleEl, `Hi, ${state.user.name}.`, 55);
  await sleep(550);

  // Beat 2: "I'm Scout, your marketing strategist."
  greet.sub.classList.add('hero__stage--in');
  await typewriterInto(subEl, "I'm Scout, your marketing strategist.", 45);
  await sleep(700);

  // Beat 3: question line.
  greet.question.classList.add('hero__stage--in');
  await sleep(440);

  // Beat 4: profile-type blocks; wait for click before exiting.
  greet.blocks.classList.add('hero__stage--in');

  await new Promise((resolve) => {
    hero.querySelectorAll('.hero-block').forEach((b) => {
      b.addEventListener('click', () => {
        state.accountType = b.dataset.acct;
        // Persist immediately so reload skips the picker
        try {
          const s = JSON.parse(sessionStorage.getItem('fs_session') || '{}');
          sessionStorage.setItem('fs_session', JSON.stringify({ ...s, accountType: state.accountType }));
        } catch (e) {}
        hero.querySelectorAll('.hero-block').forEach(x => x.setAttribute('data-picked', String(x === b)));
        resolve();
      }, { once: true });
    });
  });
  await sleep(280);

  // Hero exits, composer fades in at its bottom slot
  await heroExit(hero);
  document.body.classList.remove('mode-hero');
  await sleep(350);

  const composerPill = $('.composer-pill');
  composerPill.style.opacity = '0';
  composerPill.style.transition = 'opacity 500ms ease';
  void composerPill.offsetHeight;
  composerPill.style.opacity = '1';

  hero.remove();
  setTimeout(() => { composerPill.style.transition = ''; }, 600);
}

async function heroExit(hero) {
  const stages = hero.querySelectorAll('.hero__stage');
  // Reverse: input/question first, then title, then mark
  for (let i = stages.length - 1; i >= 0; i--) {
    stages[i].classList.remove('hero__stage--in');
    stages[i].classList.add('hero__stage--out');
    await sleep(120);
  }
  await sleep(400);
}

function buildHero() {
  // Greeting hero only — no hook layer. Logo animates in once, then the
  // greeting beats reveal in sequence, then the profile-type picker shows.
  return el('div', { class: 'hero', id: 'hero' }, [
    el('div', { class: 'hero__inner' }, [
      el('div', {
        class: 'hero__mark hero__stage',
        html: '<svg width="44" height="44" style="color: var(--primary);"><use href="#i-logo"/></svg>',
      }),
      el('div', { class: 'hero__slot' }, [
        el('div', { class: 'hero__greet' }, [
          el('h1', { class: 'hero__title hero__stage' }),
          el('p',  { class: 'hero__sub hero__stage' }),
          el('div', { class: 'hero__question hero__stage' }, "Tell me who I'm setting up for."),
          el('div', { class: 'hero__blocks hero__stage' }, [
            heroBlock('individual', 'i-individual', 'Individual', 'Solo creator, freelancer, or thought leader'),
            heroBlock('brand',      'i-brand',      'Brand',      'Company, agency, or multi-product brand'),
          ]),
        ]),
      ]),
    ]),
  ]);
}

function heroBlock(acct, _iconId, label, desc) {
  return el('button', {
    class: 'hero-block',
    'data-acct': acct,
    'data-picked': 'false',
  }, [
    el('div', { class: 'hero-block__body' }, [
      el('span', { class: 'hero-block__label' }, label),
      el('div', { class: 'hero-block__desc' }, desc),
    ]),
    el('span', { class: 'hero-block__chevron', html: icon('i-chevron-right') }),
  ]);
}

/* =========================================================================
   5. NARRATED PROCESSING
   ========================================================================= */
// Single-line narrated process. No card, no list. Each pointer occupies the
// same slot in the chat: it fades in, holds, fades up, and the next pointer
// takes its place. Each accepts {icon, text} (or a bare string with a default
// icon). The text is rendered in a soft indigo shade so it reads as ambient
// status rather than chat content.
async function narratedProcess(_label, lines, { lineBeat = 1400, exitBeat = 360, _finalBeat = 0 } = {}) {
  // The icon plate stays anchored in place — only its inner SVG cross-fades
  // and rotates softly between activities. The text uses its existing
  // up/in & up/out pattern so each phrase reads as a fresh thought.
  const iconHolder = el('span', { class: 'proc-line__icon' }, [
    el('span', { class: 'proc-line__icon-pulse', 'aria-hidden': 'true' }),
    el('span', { class: 'proc-line__icon-glyph', 'aria-hidden': 'true' }),
  ]);
  const textHolder = el('span', { class: 'proc-line__text-slot' });
  const pointer = el('div', { class: 'proc-line__pointer proc-line__pointer--persistent' }, [
    iconHolder, textHolder,
  ]);
  const slot = el('div', { class: 'proc-line' }, [pointer]);
  append(slot);

  const normalize = (l) => (typeof l === 'string' ? { icon: 'i-sparkle', text: l } : l);
  const iconGlyph = iconHolder.querySelector('.proc-line__icon-glyph');

  // Force a layout/paint so the browser sees the "pre" (opacity 0)
  // state before we add the `--in` class. Without this, the transition
  // is skipped because the element has never been painted in its
  // initial state.
  const flushIntoView = (node) => {
    // eslint-disable-next-line no-unused-expressions
    node.offsetHeight;
  };

  const swapIcon = async (iconId, isFirst) => {
    const next = el('span', { class: 'proc-line__icon-frame', html: icon(iconId) });
    if (isFirst) {
      iconGlyph.innerHTML = '';
      iconGlyph.appendChild(next);
      flushIntoView(next);
      next.classList.add('proc-line__icon-frame--in');
      return;
    }
    // Old icon exits first (~260ms). New icon enters slightly delayed
    // (CSS adds a 120ms entrance delay), keeping the swap clean.
    const old = iconGlyph.firstChild;
    iconGlyph.appendChild(next);
    flushIntoView(next);
    next.classList.add('proc-line__icon-frame--in');
    if (old) {
      old.classList.remove('proc-line__icon-frame--in');
      old.classList.add('proc-line__icon-frame--out');
      setTimeout(() => old.remove(), 320);
    }
  };

  const swapText = async (text, isFirst) => {
    const nextText = el('span', { class: 'proc-line__text-line' }, text);
    if (isFirst) {
      textHolder.innerHTML = '';
      textHolder.appendChild(nextText);
      flushIntoView(nextText);
      nextText.classList.add('proc-line__text-line--in');
      return;
    }
    // Old line exits first (~280ms). New line enters delayed (CSS adds
    // 120ms entrance delay) so the two don't sit on top of each other.
    const old = textHolder.firstChild;
    textHolder.appendChild(nextText);
    flushIntoView(nextText);
    nextText.classList.add('proc-line__text-line--in');
    if (old) {
      old.classList.remove('proc-line__text-line--in');
      old.classList.add('proc-line__text-line--out');
      setTimeout(() => old.remove(), 320);
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const { icon: iconId, text } = normalize(lines[i]);
    await swapIcon(iconId, i === 0);
    await swapText(text, i === 0);
    scrollDown();
    await sleep(lineBeat);
  }

  // Exit: fade out the whole pointer.
  pointer.classList.add('proc-line__pointer--exit');
  await sleep(exitBeat);
  slot.remove();
  return null;
}

/* =========================================================================
   6. CONFIRMATION CARD with INLINE EDIT
   ========================================================================= */
function confirmationCard({ title, rows, primary = 'Looks right', onEditField } = {}) {
  return new Promise((resolve) => {
    const rowEls = rows.map(([label, value, key]) => makeConfRow(label, value, key, onEditField));

    const card = el('div', { class: 'conf' }, [
      el('div', { class: 'conf__title' }, [
        el('div', { class: 'conf__title-left' }, [
          document.createTextNode(title),
        ]),
      ]),
      el('div', { class: 'conf__rows' }, rowEls),
      el('div', { class: 'conf__hint' }, 'Tap any row to edit. Sign off when it reads right.'),
      el('div', { class: 'conf__actions' }, [
        el('button', { class: 'btn-primary', onclick: () => { card.remove(); userMsg(primary); resolve('confirm'); } }, primary),
      ]),
    ]);
    append(card);
  });
}

function makeConfRow(label, value, key, onEditField) {
  // value can be string, array, or HTMLElement
  let valNode;
  if (Array.isArray(value)) {
    valNode = el('div', { class: 'conf__val' }, [bulletList(value)]);
  } else if (typeof value === 'string') {
    valNode = el('div', { class: 'conf__val' }, value);
  } else {
    valNode = el('div', { class: 'conf__val' }, [value]);
  }

  const editBtn = el('button', { class: 'conf__edit', html: icon('i-pencil'), 'aria-label': 'Edit ' + label });

  const row = el('div', { class: 'conf__row' }, [
    el('div', { class: 'conf__label' }, label),
    valNode,
    editBtn,
  ]);

  editBtn.addEventListener('click', () => {
    // Replace value with input
    const isArray = Array.isArray(value);
    const isMultiLine = isArray || (typeof value === 'string' && value.length > 60);
    const initial = isArray ? value.join(', ') : (typeof value === 'string' ? value : '');
    const editor = isMultiLine
      ? el('textarea', { rows: '3' }, initial)
      : el('input', { type: 'text', value: initial });
    editor.className = 'conf__editor';

    const save = el('button', { class: 'btn-primary conf__save' }, 'Save');
    const cancel = el('button', { class: 'btn-ghost conf__cancel' }, 'Cancel');

    valNode.innerHTML = '';
    valNode.appendChild(editor);
    valNode.appendChild(el('div', { class: 'conf__edit-actions' }, [cancel, save]));

    editBtn.style.display = 'none';
    requestAnimationFrame(() => editor.focus());

    cancel.addEventListener('click', () => restoreView(value));
    save.addEventListener('click', () => {
      const newRaw = editor.value.trim();
      const newVal = isArray ? newRaw.split(',').map(s => s.trim()).filter(Boolean) : newRaw;
      if (key && onEditField) onEditField(key, newVal);
      restoreView(newVal);
    });

    function restoreView(v) {
      valNode.innerHTML = '';
      if (Array.isArray(v)) valNode.appendChild(bulletList(v));
      else valNode.appendChild(document.createTextNode(v));
      editBtn.style.display = '';
    }
  });

  return row;
}

function bulletList(items) {
  const ul = el('ul');
  items.forEach(i => ul.appendChild(el('li', {}, i)));
  return ul;
}

/* =========================================================================
   7. PRODUCT-LINES TREE CARD
   ========================================================================= */
function productLineTreeCard(lines) {
  return new Promise((resolve) => {
    const items = lines.map(line => el('div', { class: 'pl-tree__item' }, [
      el('div', { class: 'pl-tree__branch' }),
      el('div', { class: 'pl-tree__line' }, [
        el('div', { class: 'pl-tree__line-name' }, line.name),
        el('div', { class: 'pl-tree__line-meta' }, [
          el('span', {}, [el('strong', {}, 'Audience: '), document.createTextNode(line.audience)]),
          el('span', {}, [el('strong', {}, 'Tone: '), document.createTextNode(line.tone)]),
        ]),
      ]),
    ]));

    const card = el('div', { class: 'pl-tree' }, [
      el('div', { class: 'conf__title' }, [
        el('div', { class: 'conf__title-left' }, [
          document.createTextNode('Brand knowledge structure'),
        ]),
      ]),
      el('div', { class: 'pl-tree__master' }, [
        el('div', { class: 'pl-tree__master-label' }, 'MASTER BRAND'),
        el('div', { class: 'pl-tree__master-name' }, state.brand.name),
      ]),
      el('div', { class: 'pl-tree__items' }, items),
      el('div', { class: 'conf__actions' }, [
        el('button', {
          class: 'btn-primary',
          onclick: () => { card.remove(); userMsg('Looks right'); resolve('confirm'); },
        }, 'Looks right'),
      ]),
    ]);
    append(card);
  });
}

/* =========================================================================
   8. CONNECT X CARD
   ========================================================================= */
function connectSocial() {
  // Multi-platform connect card. X is active; IG / FB / TikTok are surfaced
  // with "Coming soon" pills so the user understands the product is
  // cross-platform with X as the first available surface.
  return new Promise((resolve) => {
    const platforms = [
      { id: 'x',         icon: 'i-x-logo',    name: 'X',          status: 'active' },
      { id: 'instagram', icon: 'i-instagram', name: 'Instagram',  status: 'soon' },
      { id: 'facebook',  icon: 'i-facebook',  name: 'Facebook',   status: 'soon' },
      { id: 'tiktok',    icon: 'i-tiktok',    name: 'TikTok',     status: 'soon' },
    ];

    const rows = platforms.map(p => {
      const isActive = p.status === 'active';
      const row = el('button', {
        class: 'platform platform--' + p.id + (isActive ? '' : ' platform--soon'),
        disabled: isActive ? null : 'true',
        // Keep the widget visible while the OAuth modal is open. The caller
        // (step5_x_connect) is responsible for marking the card as connected
        // after authorization completes.
        onclick: isActive
          ? () => resolve({ result: 'connect', card })
          : null,
      }, [
        el('span', { class: 'platform__icon', html: icon(p.icon) }),
        el('span', { class: 'platform__name' }, p.name),
        isActive
          ? el('span', { class: 'platform__cta' }, 'Connect')
          : el('span', { class: 'platform__pill' }, 'Coming soon'),
      ]);
      return row;
    });

    const card = el('div', { class: 'connect connect--multi' }, [
      el('div', { class: 'connect__head' }, [
        el('div', { class: 'connect__title' }, 'Connect a social account'),
        el('div', { class: 'connect__sub' }, "Read-only. Scout never posts without your approval."),
      ]),
      el('div', { class: 'platform-list' }, rows),
      el('div', { class: 'connect__actions' }, [
        el('button', {
          class: 'btn-ghost',
          onclick: () => { card.remove(); userMsg('Skip for now'); resolve({ result: 'skip', card: null }); },
        }, 'Skip for now'),
      ]),
    ]);
    append(card);
  });
}

/* =========================================================================
   9. INLINE PREVIEWS, X profile (established + new) + trends
   ========================================================================= */
function xProfilePreview(profile) {
  // Stats (top topics, audience, peak activity) are now rendered inside the
  // brand drawer instead of below the header. The chat surfaces only the
  // Twitter-faithful header here.
  xProfileHeader(profile);
}

// Twitter white-mode profile header — read as if pasted from twitter.com.
// Brand/individual accounts get their own banner + avatar assets.
function xProfileHeader(profile) {
  const verified = profile.verified
    ? el('span', { class: 'x-header__verified', 'aria-label': 'Verified', html: icon('i-check') })
    : null;
  const isBrand = state.accountType === 'brand';
  const bannerSrc  = isBrand ? '/BannerBrand.jpeg'  : '/BannerIndividual.jpeg';
  const avatarSrc  = isBrand ? '/ProfileBrand.jpeg' : '/ProfileIndividual.png';

  const card = el('div', { class: 'x-header' }, [
    el('div', { class: 'x-header__banner', style: `background-image: url('${bannerSrc}');` }),
    el('div', { class: 'x-header__avatar', style: `background-image: url('${avatarSrc}');` }),
    el('div', { class: 'x-header__body' }, [
      el('div', { class: 'x-header__name' }, [
        document.createTextNode(profile.displayName || profile.name),
        verified,
      ]),
      el('div', { class: 'x-header__handle' }, profile.handle),
      profile.bio ? el('p', { class: 'x-header__bio' }, profile.bio) : null,
      el('div', { class: 'x-header__meta' }, [
        profile.location ? el('span', { class: 'x-header__meta-item' }, [
          el('span', { class: 'x-header__meta-icon', html: icon('i-people') }),
          document.createTextNode(profile.location),
        ]) : null,
        profile.joinDate ? el('span', { class: 'x-header__meta-item' }, [
          el('span', { class: 'x-header__meta-icon', html: icon('i-cal') }),
          document.createTextNode(`Joined ${profile.joinDate}`),
        ]) : null,
      ]),
      el('div', { class: 'x-header__counts' }, [
        el('span', { class: 'x-header__count' }, [
          el('strong', {}, profile.following || '0'),
          document.createTextNode(' '),
          el('span', { class: 'x-header__count-label' }, 'Following'),
        ]),
        el('span', { class: 'x-header__count' }, [
          el('strong', {}, profile.followers || '0'),
          document.createTextNode(' '),
          el('span', { class: 'x-header__count-label' }, 'Followers'),
        ]),
      ]),
    ]),
  ]);
  append(card);
}

// Scout's analysis layered on top of the Twitter clone above.
function xProfileStats(profile) {
  const topTopicEls = (profile.topTopics || []).map(t => el('div', { class: 'topic-bar topic-bar--lg' }, [
    el('div', { class: 'topic-bar__row' }, [
      el('span', { class: 'topic-bar__name' }, t.name),
      el('span', { class: 'topic-bar__pct' }, `+${t.engagement}%`),
    ]),
    el('div', { class: 'topic-bar__track' }, [
      el('div', { class: 'topic-bar__fill', style: `width: ${Math.min(100, t.engagement)}%;` }),
    ]),
  ]));

  // Peak activity strip — parse hour range from peakActivity text if possible, else center it.
  const peakStrip = el('div', { class: 'peak-strip' }, [
    el('div', { class: 'peak-strip__track' }, [
      el('div', { class: 'peak-strip__highlight' }),
    ]),
    el('div', { class: 'peak-strip__labels' }, [
      el('span', {}, '12a'), el('span', {}, '6a'), el('span', {}, '12p'), el('span', {}, '6p'), el('span', {}, '12a'),
    ]),
  ]);

  const audienceBlock = (label, text) => el('div', { class: 'x-stats__audience-block' }, [
    el('div', { class: 'x-stats__avatars' }, [
      el('span', { class: 'x-stats__avatar' }),
      el('span', { class: 'x-stats__avatar' }),
      el('span', { class: 'x-stats__avatar' }),
    ]),
    el('div', { class: 'x-stats__eyebrow' }, label),
    el('div', { class: 'x-stats__audience-text' }, text),
  ]);

  const card = el('div', { class: 'x-stats' }, [
    el('div', { class: 'x-stats__section' }, [
      el('div', { class: 'x-stats__eyebrow' }, 'Top performing topics'),
      el('div', { class: 'topic-bars' }, topTopicEls),
    ]),
    el('div', { class: 'x-stats__section' }, [
      el('div', { class: 'x-stats__audience-grid' }, [
        audienceBlock('Primary audience', profile.primaryAudience),
        audienceBlock('Secondary audience', profile.secondaryAudience),
      ]),
    ]),
    el('div', { class: 'x-stats__section' }, [
      el('div', { class: 'x-stats__eyebrow' }, 'Peak activity'),
      peakStrip,
      el('div', { class: 'x-stats__peak-text' }, profile.peakActivity || ''),
    ]),
  ]);
  append(card);
}

function stat(value, label) {
  return el('div', { class: 'preview__stat' }, [
    el('div', { class: 'preview__stat-value' }, value || '0'),
    el('div', { class: 'preview__stat-label' }, label),
  ]);
}

function xProfilePreviewEmpty(profile) {
  const isBrand = state.accountType === 'brand';
  const bannerSrc = isBrand ? '/BannerBrand.jpeg'  : '/BannerIndividual.jpeg';
  const avatarSrc = isBrand ? '/ProfileBrand.jpeg' : '/ProfileIndividual.png';
  const card = el('div', { class: 'preview preview--empty' }, [
    el('div', { class: 'preview__banner', style: `background-image: url('${bannerSrc}');` }),
    el('div', { class: 'preview__identity' }, [
      el('div', { class: 'preview__avatar', style: `background-image: url('${avatarSrc}');` }),
      el('div', { class: 'preview__name-row' }, [
        el('div', { class: 'preview__name' }, profile.displayName || profile.name),
        el('div', { class: 'preview__handle' }, profile.handle),
      ]),
    ]),
    profile.bio ? el('p', { class: 'preview__bio' }, profile.bio) : null,
    el('div', { class: 'preview__meta-row' }, [
      profile.location ? el('span', { class: 'preview__meta-item' }, [
        el('span', { class: 'preview__meta-icon', html: icon('i-people') }),
        document.createTextNode(profile.location),
      ]) : null,
      profile.joinDate ? el('span', { class: 'preview__meta-item' }, [
        el('span', { class: 'preview__meta-icon', html: icon('i-cal') }),
        document.createTextNode(`Joined ${profile.joinDate}`),
      ]) : null,
    ]),
    el('div', { class: 'preview__stats-row' }, [
      stat(profile.following || '0',  'Following'),
      stat(profile.followers,         'Followers'),
      stat(profile.postCount || '0',  'Posts'),
    ]),
    el('div', { class: 'preview__empty-note' }, [
      el('div', { class: 'preview__empty-icon', html: icon('i-sparkle') }),
      el('div', {}, [
        el('div', { class: 'preview__empty-title' }, 'No post history yet, leaning on signals around the account'),
        el('div', { class: 'preview__empty-sub' }, "I'll use your interest preferences, the accounts you follow, and your brand context to guide us until performance data builds up."),
      ]),
    ]),
    el('div', { class: 'preview__divider' }),
    el('div', { class: 'preview__section' }, [
      el('div', { class: 'preview__section-title' }, 'Inferred interest space'),
      topicRow('Accounts followed in niche',  '12'),
      topicRow('X interest tags',             'Fashion · Heritage · Sustainability'),
      topicRow("Bookmarks on others' posts", 'Heritage threads 4× more than product'),
    ]),
  ]);
  append(card);
}

function topicRow(name, stat) {
  return el('div', { class: 'topic-row' }, [
    el('span', { class: 'topic-row__name' }, name),
    el('span', { class: 'topic-row__stat' }, stat),
  ]);
}

/* =========================================================================
   10. TREND CARDS PREVIEW
   ========================================================================= */
/* =========================================================================
   SUCCESS-POST TEASER — opening hook, shown before the social-connect ask.
   A mock X post with high engagement, framing what Scout is going to help
   the user achieve. Visual proof anchors the value prop.
   ========================================================================= */

function successMetric(iconId, value, label) {
  return el('div', { class: 'success-post__metric' }, [
    el('span', { class: 'success-post__metric-icon', html: icon(iconId) }),
    el('span', { class: 'success-post__metric-value' }, value),
    el('span', { class: 'success-post__metric-label' }, label),
  ]);
}

function trendsPreview() {
  const items = state.accountType === 'brand' ? [
    ['i-fire',  'Trending: #SouthAsianHeritageWeek', 'Spiking 4.2× this week. Strong overlap with your audience and brand themes.'],
    ['i-trend', 'Competitor activity',                '@generation.pk posted a craft-origin reel yesterday, 22k views in 18h. @khaadiofficial running a Ramadan capsule teaser.'],
    ['i-people','Audience pattern',                   'Your demographic bookmarks heritage-explained posts at 3× the niche average. Education plus aesthetic is the unlock.'],
  ] : [
    ['i-fire',  'Trending: AI design tooling debate', 'Strong week, designers split on Cursor / Figma AI. High bookmark rate on nuanced takes.'],
    ['i-trend', 'Competitor activity',                '@brian_lovin shipped a craft essay, 9k engagements in 24h. @rauchg on shipping speed, 14k.'],
    ['i-people','Audience pattern',                   'Your demographic responds 2.4× more to specific examples than to abstract principles. Show the artifact.'],
  ];
  const card = el('div', { class: 'preview preview--simple' }, [
    el('div', { class: 'preview__section' }, [
      el('div', { class: 'preview__section-title' }, "What's happening in your niche"),
      ...items.map(([ic, t, d]) => trendCard(ic, t, d)),
    ]),
  ]);
  append(card);
}
function trendCard(iconId, title, desc) {
  return el('div', { class: 'trend-card' }, [
    el('div', { class: 'trend-card__icon', html: icon(iconId) }),
    el('div', {}, [
      el('div', { class: 'trend-card__title' }, title),
      el('div', { class: 'trend-card__desc' }, desc),
    ]),
  ]);
}

/* =========================================================================
   11. DASHBOARD RENDER (pending items reflect actual skips)
   ========================================================================= */
/* =========================================================================
   KNOWLEDGE — top-right widget that fills as Scout learns.
   Compact: 2×2 grid of square blocks (40% empty / 80% filled).
   Expanded: 1/3 width vertical panel (100% opacity, full facts visible).
   ========================================================================= */
/* ── Split-panel KB renderer ─────────────────────────────────────────── */
const KB_NEW_META = {
  brand:     { title: 'About You',         subtitle: 'Identity, products, niche, voice' },
  trending:  { title: 'Trending',           subtitle: 'Trends, competitors, audience patterns' },
  algorithm: { title: 'Platform Algorithm', subtitle: 'X algorithm and content rules' },
};

function renderKBNew(panel) {
  let inner = panel.querySelector('.kb-panel__inner');

  if (!inner) {
    // Remove old structure (has inline display styles that override CSS)
    panel.querySelectorAll('.kb-panel__head, .kb-panel__grid').forEach(n => n.remove());

    // First build: create inner wrapper + all 3 cards
    inner = el('div', { class: 'kb-panel__inner' });
    panel.appendChild(inner);

    const order = ['brand', 'trending'];
    order.forEach((kbId, i) => {
      const card = buildKBNewCard(kbId, i === 0);
      inner.appendChild(card);
      // Stagger entry animation
      setTimeout(() => card.classList.add('kb-card--visible'), 100 + i * 110);
    });
  }

  // Update each card's content
  ['brand', 'trending'].forEach(kbId => {
    const card = inner.querySelector(`[data-kb-card="${kbId}"]`);
    if (card) updateKBNewCard(card, kbId);
  });
}

function buildKBNewCard(kbId, isActive) {
  const meta = KB_NEW_META[kbId];
  const card = el('div', {
    class: `kb-card ${isActive ? 'kb-card--active' : 'kb-card--upcoming'}`,
    'data-kb-card': kbId,
  }, [
    el('div', { class: 'kb-card__hd' }, [
      el('div', {}, [
        el('div', { class: 'kb-card__title' }, meta.title),
        el('div', { class: 'kb-card__subtitle' }, meta.subtitle),
      ]),
      isActive
        ? el('div', { class: 'kb-card__status-tag' }, [
            el('span', { class: 'kb-card__status-spin' }, '↻'),
            document.createTextNode(' Building...'),
          ])
        : null,
    ]),
  ]);
  return card;
}

function updateKBNewCard(card, kbId) {
  const kb = state.kb[kbId];
  const activeId = state.kb.activeId || 'brand';
  const isActive = activeId === kbId;

  // Promote card to active if newly active
  if (isActive && card.classList.contains('kb-card--upcoming')) {
    card.classList.remove('kb-card--upcoming');
    card.classList.add('kb-card--active');
    card.style.opacity = '1';
    card.style.transform = 'none';
    if (!card.querySelector('.kb-card__status-tag')) {
      const hd = card.querySelector('.kb-card__hd');
      if (hd) hd.appendChild(el('div', { class: 'kb-card__status-tag' }, [
        el('span', { class: 'kb-card__status-spin' }, '↻'),
        document.createTextNode(' Building...'),
      ]));
    }
  }

  if (!isActive) {
    // Brand card keeps its content even after activeId moves on
    if (kbId === 'brand') {
      renderKBBrandCard(card);
    }
    return;
  }

  // Brand card gets a rich visual renderer
  if (kbId === 'brand') {
    renderKBBrandCard(card);
    return;
  }

  // ── Generic shimmer / facts for non-brand cards ──
  const hasFacts = kb.facts.length > 0;
  const showActions = isActive && state.kb.actionCallback != null;
  let shimmer = card.querySelector('.kb-shimmer-wrap');
  let factsList = card.querySelector('.kb-facts-list');

  if (hasFacts) {
    if (shimmer) { shimmer.remove(); shimmer = null; }
    if (!factsList) {
      factsList = el('div', { class: 'kb-facts-list' });
      card.appendChild(factsList);
    }
    kb.facts.forEach(fact => {
      const factKey = `fact-${kbId}-${fact.label.toLowerCase().replace(/\s+/g, '-')}`;
      let row = factsList.querySelector(`[data-fkey="${factKey}"]`);
      if (!row) {
        const valEl = el('span', { class: 'kb-fact-item__val', contenteditable: 'true', spellcheck: 'false' });
        valEl.textContent = fact.value;
        row = el('div', { class: 'kb-fact-item', 'data-fkey': factKey }, [
          el('span', { class: 'kb-fact-item__lbl' }, fact.label),
          valEl,
        ]);
        factsList.appendChild(row);
        requestAnimationFrame(() => setTimeout(() => row.classList.add('kb-fact-item--visible'), 20));
      } else {
        const valEl = row.querySelector('.kb-fact-item__val');
        if (valEl && !valEl.matches(':focus') && valEl.textContent !== fact.value) {
          valEl.textContent = fact.value;
        }
      }
    });
  } else {
    if (!shimmer) {
      shimmer = el('div', { class: 'kb-shimmer-wrap' }, [
        el('div', { class: 'kb-shimmer-line' }),
        el('div', { class: 'kb-shimmer-line' }),
        el('div', { class: 'kb-shimmer-line' }),
      ]);
      card.appendChild(shimmer);
    }
  }

  let actionFooter = card.querySelector('.kb-card__actions');
  if (showActions && !actionFooter) {
    actionFooter = el('div', { class: 'kb-card__actions' }, [
      el('button', { class: 'kb-card__btn kb-card__btn--ghost', onclick: () => state.kb.actionCallback && state.kb.actionCallback('edit') }, 'Not quite'),
      el('button', { class: 'kb-card__btn kb-card__btn--primary', onclick: () => state.kb.actionCallback && state.kb.actionCallback('confirm') }, 'Looks right'),
    ]);
    card.appendChild(actionFooter);
  } else if (!showActions && actionFooter) {
    actionFooter.remove();
  }
}

// ── Rich visual brand KB card ─────────────────────────────────────────────

function renderKBBrandCard(card) {
  const brand = state.brand;
  if (!brand) return;
  const reveal = state.kb.kbReveal || new Set();
  const showActions = state.kb.actionCallback != null;
  const isBrandActive = (state.kb.activeId || 'brand') === 'brand';

  // Status tag: Building... → Ready to review → Done
  const statusTag = card.querySelector('.kb-card__status-tag');
  if (statusTag) {
    if (showActions && !statusTag.classList.contains('kbs-ready')) {
      statusTag.classList.add('kbs-ready');
      statusTag.innerHTML = '✓ Ready to review';
    } else if (!isBrandActive && !showActions) {
      statusTag.innerHTML = '✓ Done';
      statusTag.classList.add('kbs-done');
      statusTag.classList.remove('kbs-ready');
    }
  }

  // Mark card done when no longer the active KB
  if (!isBrandActive && !card.classList.contains('kb-card--done')) {
    card.classList.add('kb-card--done');
  }

  const sections = [
    { id: 'identity', revealed: reveal.has('identity'),
      build: () => buildKBIdentitySection(brand) },
    { id: 'themes',   revealed: reveal.has('themes'),   build: () => buildKBThemesSection(brand) },
    { id: 'topics',   revealed: reveal.has('topics'),   build: () => buildKBTopicsSection(brand) },
    { id: 'audience', revealed: reveal.has('audience'), build: () => buildKBAudienceSection(brand) },
    { id: 'peak',     revealed: reveal.has('peak'),     build: () => buildKBPeakSection(brand) },
  ];

  sections.forEach(({ id, revealed, build, version }, i) => {
    const existing = card.querySelector(`[data-kbs="${id}"]`);
    const footer = card.querySelector('.kb-card__actions');
    const existingVer = existing?.dataset.kbsVer;

    if (!existing) {
      const section = revealed ? build() : buildKBShimmerSection(id);
      section.dataset.kbs = id;
      if (version) section.dataset.kbsVer = version;
      if (footer) card.insertBefore(section, footer);
      else card.appendChild(section);
      const delay = 60 + i * 90;
      requestAnimationFrame(() => setTimeout(() => section.classList.add('kbs--visible'), delay));
    } else if (version && existingVer !== version && revealed) {
      // Version upgrade (e.g. partial identity → full)
      const real = build();
      real.dataset.kbs = id;
      if (version) real.dataset.kbsVer = version;
      existing.classList.add('kbs--exiting');
      setTimeout(() => {
        existing.replaceWith(real);
        requestAnimationFrame(() => setTimeout(() => real.classList.add('kbs--visible'), 20));
      }, 220);
    } else if (revealed && existing.classList.contains('kbs--shimmer')) {
      // Shimmer → real section
      const real = build();
      real.dataset.kbs = id;
      if (version) real.dataset.kbsVer = version;
      existing.classList.add('kbs--exiting');
      setTimeout(() => {
        existing.replaceWith(real);
        requestAnimationFrame(() => setTimeout(() => real.classList.add('kbs--visible'), 20));
      }, 220);
    }
  });

  // Action footer — only when active and actionCallback set
  let actionFooter = card.querySelector('.kb-card__actions');
  if (showActions && isBrandActive && !actionFooter) {
    actionFooter = el('div', { class: 'kb-card__actions' }, [
      el('button', { class: 'kb-card__btn kb-card__btn--ghost',
        onclick: () => state.kb.actionCallback && state.kb.actionCallback('edit') }, 'Not quite'),
      el('button', { class: 'kb-card__btn kb-card__btn--primary',
        onclick: () => state.kb.actionCallback && state.kb.actionCallback('confirm') }, 'Looks right'),
    ]);
    card.appendChild(actionFooter);
    requestAnimationFrame(() => setTimeout(() => actionFooter.classList.add('kbs--visible'), 20));
  } else if ((!showActions || !isBrandActive) && actionFooter) {
    actionFooter.remove();
  }
}

function buildKBShimmerSection(id) {
  const labels = { themes: 'THEMES', topics: 'TOP PERFORMING TOPICS', audience: 'AUDIENCE', peak: 'PEAK ACTIVITY' };
  const lbl = labels[id];
  const children = [];
  if (lbl) children.push(el('div', { class: 'kbs__eyebrow' }, lbl));
  children.push(el('div', { class: 'kb-shimmer-wrap kb-shimmer-wrap--sm' }, [
    el('div', { class: 'kb-shimmer-line' }),
    el('div', { class: 'kb-shimmer-line' }),
  ]));
  return el('div', { class: 'kbs kbs--shimmer' }, children);
}

function buildKBIdentitySection(brand) {
  const displayName = state.user.name || brand.name;
  return el('div', { class: 'kbs kbs--identity' }, [
    el('div', { class: 'kbs__identity-top' }, [
      el('div', { class: 'kbs__identity-name' }, displayName),
      brand.location ? el('div', { class: 'kbs__identity-loc' }, brand.location) : null,
    ].filter(Boolean)),
    el('div', { class: 'kbs__identity-niche' }, brand.niche),
    el('div', { class: 'kbs__identity-pos' }, brand.positioning),
  ]);
}

function buildKBThemesSection(brand) {
  if (!brand.themes || !brand.themes.length) return buildKBShimmerSection('themes');
  const chips = brand.themes.map((t, i) => {
    const chip = el('span', { class: 'kbs__chip' }, t);
    setTimeout(() => chip.classList.add('kbs__chip--in'), 100 + i * 70);
    return chip;
  });
  return el('div', { class: 'kbs kbs--themes' }, [
    el('div', { class: 'kbs__eyebrow' }, 'THEMES'),
    el('div', { class: 'kbs__chips' }, chips),
  ]);
}

function buildKBTopicsSection(brand) {
  if (!brand.topTopics || !brand.topTopics.length) return buildKBShimmerSection('topics');
  const rows = brand.topTopics.map((t, i) => {
    const fill = el('div', { class: 'kbs__bar-fill' });
    setTimeout(() => { fill.style.width = t.engagement + '%'; }, 280 + i * 100);
    return el('div', { class: 'kbs__topic-row' }, [
      el('div', { class: 'kbs__topic-meta' }, [
        el('span', { class: 'kbs__topic-name' }, t.name),
        el('span', { class: 'kbs__topic-pct' }, '+' + t.engagement + '%'),
      ]),
      el('div', { class: 'kbs__bar' }, [fill]),
    ]);
  });
  return el('div', { class: 'kbs kbs--topics' }, [
    el('div', { class: 'kbs__eyebrow' }, 'TOP PERFORMING TOPICS'),
    el('div', { class: 'kbs__topics-list' }, rows),
  ]);
}

function buildKBAudienceSection(brand) {
  const text = brand.audienceDefault || brand.primaryAudience || '';
  const secondary = brand.secondaryAudience || '';
  const photos = [
    'https://images.pexels.com/photos/415829/pexels-photo-415829.jpeg?auto=compress&cs=tinysrgb&w=60&h=60&fit=crop',
    'https://images.pexels.com/photos/1222271/pexels-photo-1222271.jpeg?auto=compress&cs=tinysrgb&w=60&h=60&fit=crop',
    'https://images.pexels.com/photos/774909/pexels-photo-774909.jpeg?auto=compress&cs=tinysrgb&w=60&h=60&fit=crop',
  ];
  const avatars = photos.map((src, i) => {
    const img = el('img', { class: 'kbs__avatar-img', src, alt: '', loading: 'lazy' });
    return el('div', { class: 'kbs__avatar', style: `z-index:${3-i}` }, [img]);
  });
  return el('div', { class: 'kbs kbs--audience' }, [
    el('div', { class: 'kbs__eyebrow' }, 'AUDIENCE'),
    el('div', { class: 'kbs__audience-row' }, [
      el('div', { class: 'kbs__avatars' }, avatars),
      el('div', { class: 'kbs__audience-text' }, [
        el('div', { class: 'kbs__audience-primary' }, text),
        secondary ? el('div', { class: 'kbs__audience-secondary' }, secondary) : null,
      ].filter(Boolean)),
    ]),
  ]);
}

function buildKBPeakSection(brand) {
  const peakText = (brand.peakActivity || '').toLowerCase();
  let left = 52, width = 15;
  if (peakText.includes('morning') || peakText.includes('9') || peakText.includes('10am') || peakText.includes('11am')) {
    left = 28; width = 15;
  } else if (peakText.includes('2') || peakText.includes('3pm') || peakText.includes('4pm') || peakText.includes('afternoon')) {
    left = 52; width = 16;
  } else if (peakText.includes('evening') || peakText.includes('8pm') || peakText.includes('9pm')) {
    left = 70; width = 14;
  }
  const pill = el('div', { class: 'kbs__peak-pill', style: `left:${left}%;width:${width}%` });
  return el('div', { class: 'kbs kbs--peak' }, [
    el('div', { class: 'kbs__eyebrow' }, 'PEAK ACTIVITY'),
    el('div', { class: 'kbs__peak-wrap' }, [
      el('div', { class: 'kbs__peak-track' }, [pill]),
      el('div', { class: 'kbs__peak-labels' }, ['12a','6a','12p','6p','12a'].map(t => el('span', {}, t))),
    ]),
  ]);
}

/* ── End new KB renderer ──────────────────────────────────────────────── */

function renderKB() {
  const panel = document.getElementById('kb-panel');
  if (!panel) return;

  renderKBNew(panel);
}

function addKBFact(kbId, label, value) {
  const kb = state.kb[kbId];
  if (!kb) return;
  // Whichever KB is being written to becomes "active" — Scout's focus.
  state.kb.activeId = kbId;
  const existing = kb.facts.findIndex(f => f.label === label);
  if (existing >= 0) kb.facts[existing] = { label, value };
  else kb.facts.push({ label, value });
  renderKB();
}


function renderHome() {
  const home = $('#home-main') || $('#view-home');
  home.innerHTML = '';

  const isBrand = state.accountType === 'brand';
  const firstName = (state.user.name || 'there').split(/\s+/)[0];

  const wrap = el('div', { class: 'dash' });

  // ───── Welcome strip ──────────────────────────────────────────────────
  const heroTitle = state.publishedPost
    ? `Your first post is live, ${firstName}.`
    : `Welcome back, ${firstName}.`;
  const heroSub = isBrand
    ? "Scout's tracking 3 trends and a peak window in your niche right now. Pick what's next."
    : "Scout's tracked 3 conversations and your peak window today. Pick what's next.";
  wrap.appendChild(el('div', { class: 'dash__welcome' }, [
    el('div', { class: 'dash__welcome-top' }, [
      el('div', { class: 'dash__welcome-text' }, [
        el('h1', { class: 'dash__welcome-title' }, heroTitle),
        el('p',  { class: 'dash__welcome-sub' }, heroSub),
      ]),
      el('div', { class: 'dash__welcome-actions' }, [
        el('button', { class: 'dash__action-btn', type: 'button', onclick: () => {} }, [
          el('span', { class: 'dash__action-btn-icon', html: icon('i-pencil') }),
          document.createTextNode('New post'),
        ]),
        el('button', { class: 'dash__action-btn dash__action-btn--secondary', type: 'button', onclick: () => {} }, [
          el('span', { class: 'dash__action-btn-icon', html: icon('i-trend') }),
          document.createTextNode('Run a campaign'),
        ]),
      ]),
    ]),
  ]));

  // ───── Account snapshot (top) ─────────────────────────────────────────
  wrap.appendChild(buildSnapshot(isBrand));

  // ───── Recent activity ────────────────────────────────────────────────
  wrap.appendChild(buildRecentActivity(isBrand));

  // ───── Scout's pulse ──────────────────────────────────────────────────
  wrap.appendChild(el('div', { class: 'dash__pulse' }, [
    el('div', { class: 'dash__pulse-head' }, [
      el('span', { class: 'dash__pulse-mark', html: icon('i-logo') }),
      el('h3', { class: 'dash__pulse-title' }, "Scout's pulse"),
      el('span', { class: 'dash__pulse-status' }, [
        el('span', { class: 'dash__pulse-dot' }),
        document.createTextNode('Live'),
      ]),
    ]),
    el('div', { class: 'dash__pulse-grid' }, [
      buildPulseTrend(isBrand),
      buildPulseWindow(isBrand),
      buildPulseSuggestion(isBrand),
    ]),
  ]));

  home.appendChild(wrap);
  initHomeScout();
}

// ─── Shared Scout panel renderer (KB-card style) ──────────────────────────
function initScoutPanel(innerId, inputId, sendId, cards, replyMap) {
  const inner = $('#' + innerId);
  const input = $('#' + inputId);
  const send  = $('#' + sendId);
  if (!inner || !input || !send) return;

  inner.innerHTML = '';

  // ── Scout header card ────────────────────────────────────────────────
  const header = el('div', { class: 'sp-header' }, [
    el('span', { class: 'sp-header__avatar' }, [
      el('span', { html: icon('i-logo') }),
    ]),
    el('div', { class: 'sp-header__text' }, [
      el('div', { class: 'sp-header__name' }, 'Scout'),
      el('div', { class: 'sp-header__status' }, [
        el('span', { class: 'sp-header__dot' }),
        document.createTextNode('Active now'),
      ]),
    ]),
  ]);
  inner.appendChild(header);

  // ── Build KB-style cards ─────────────────────────────────────────────
  cards.forEach((card, i) => {
    const cardEl = buildScoutCard(card);
    cardEl.style.transitionDelay = (100 + i * 110) + 'ms';
    inner.appendChild(cardEl);
    requestAnimationFrame(() => requestAnimationFrame(() => cardEl.classList.add('kb-card--visible')));
  });

  // ── Chip handler ─────────────────────────────────────────────────────
  inner.addEventListener('click', e => {
    const chip = e.target.closest('.sp-chip');
    if (!chip) return;
    const label = chip.textContent.trim();
    chip.closest('.sp-chips')?.querySelectorAll('.sp-chip').forEach(c => c.setAttribute('disabled', 'true'));
    appendScoutReply(inner, label, replyMap);
  });

  // ── Composer wiring ──────────────────────────────────────────────────
  function sendMsg() {
    const v = input.value.trim();
    if (!v) return;
    input.value = '';
    send.classList.remove('active');
    appendUserMsg(inner, v);
    appendScoutReply(inner, v, replyMap);
  }
  send.onclick = sendMsg;
  input.onkeydown = e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMsg(); } };
  input.oninput = () => send.classList.toggle('active', input.value.trim().length > 0);
}

function buildScoutCard({ title, subtitle, status, sections, chips, isActive }) {
  const card = el('div', { class: 'kb-card ' + (isActive ? 'kb-card--active' : 'kb-card--upcoming') });

  // Header
  const hd = el('div', { class: 'kb-card__hd' }, [
    el('div', {}, [
      el('div', { class: 'kb-card__title' }, title),
      ...(subtitle ? [el('div', { class: 'kb-card__subtitle' }, subtitle)] : []),
    ]),
    ...(status ? [el('div', { class: 'kb-card__status-tag' + (isActive ? '' : '') }, [
      ...(isActive ? [el('span', { class: 'kb-card__status-spin' }, '↻')] : []),
      document.createTextNode(status),
    ])] : []),
  ]);
  card.appendChild(hd);

  // Sections
  if (sections) {
    sections.forEach((sec, i) => {
      const secEl = buildScoutSection(sec);
      secEl.style.transitionDelay = (120 + i * 90) + 'ms';
      card.appendChild(secEl);
      requestAnimationFrame(() => requestAnimationFrame(() => secEl.classList.add('kbs--visible')));
    });
  }

  // Chips
  if (chips && chips.length) {
    const chipsEl = el('div', { class: 'sp-chips' },
      chips.map(c => el('button', { class: 'sp-chip', type: 'button' }, c))
    );
    card.appendChild(chipsEl);
  }

  return card;
}

function buildScoutSection({ type, eyebrow, body, bars, track, chips }) {
  const sec = el('div', { class: 'kbs kbs--' + type });

  if (eyebrow) sec.appendChild(el('div', { class: 'kbs__eyebrow' }, eyebrow));

  if (type === 'identity') {
    sec.appendChild(el('div', { class: 'kbs__identity-niche' }, body));
  } else if (type === 'text') {
    sec.appendChild(el('div', { class: 'sp-section-text' }, body));
  } else if (type === 'topics' && bars) {
    const list = el('div', { class: 'kbs__topics-list' });
    bars.forEach(({ label, pct }, i) => {
      const row = el('div', { class: 'kbs__topic-row' }, [
        el('div', { class: 'kbs__topic-meta' }, [
          el('span', { class: 'kbs__topic-name' }, label),
          el('span', { class: 'kbs__topic-pct' }, pct),
        ]),
        el('div', { class: 'kbs__bar' }, [
          el('div', { class: 'kbs__bar-fill', style: 'width:0' }),
        ]),
      ]);
      list.appendChild(row);
      setTimeout(() => {
        const fill = row.querySelector('.kbs__bar-fill');
        if (fill) fill.style.width = pct;
      }, 280 + i * 100);
    });
    sec.appendChild(list);
  } else if (type === 'peak' && track) {
    sec.appendChild(el('div', { class: 'kbs__peak-wrap' }, [
      el('div', { class: 'kbs__peak-track' }, [
        el('div', { class: 'kbs__peak-pill', style: `left:${track.left};width:${track.width}` }),
      ]),
      el('div', { class: 'kbs__peak-labels' }, ['12a','6a','12p','6p','12a'].map(t =>
        el('span', {}, t)
      )),
    ]));
    if (body) sec.appendChild(el('div', { class: 'sp-section-note' }, body));
  } else if (type === 'chips' && chips) {
    const row = el('div', { class: 'kbs__chips' });
    chips.forEach((c, i) => {
      const chip = el('span', { class: 'kbs__chip' }, c);
      setTimeout(() => chip.classList.add('kbs__chip--in'), 100 + i * 70);
      row.appendChild(chip);
    });
    sec.appendChild(row);
  }

  return sec;
}

function appendUserMsg(inner, text) {
  const msg = el('div', { class: 'sp-user-msg' }, [
    el('div', { class: 'sp-user-msg__bubble' }, text),
  ]);
  inner.appendChild(msg);
  inner.scrollTop = inner.scrollHeight;
}

function appendScoutReply(inner, label, replyMap) {
  // Typing indicator card
  const typing = el('div', { class: 'kb-card kb-card--active kb-card--visible sp-typing-card' }, [
    el('div', { class: 'kb-card__hd' }, [
      el('div', {}, [el('div', { class: 'kb-card__title' }, 'Scout')]),
      el('div', { class: 'kb-card__status-tag' }, [
        el('span', { class: 'kb-card__status-spin' }, '↻'),
        document.createTextNode('Thinking…'),
      ]),
    ]),
    el('div', { class: 'sp-typing-dots' }, [
      el('span', { class: 'hmsg__dot' }),
      el('span', { class: 'hmsg__dot' }),
      el('span', { class: 'hmsg__dot' }),
    ]),
  ]);
  inner.appendChild(typing);
  inner.scrollTop = inner.scrollHeight;

  setTimeout(() => {
    typing.remove();
    const replyText = replyMap[label] || `Got it — let me work on that. Give me a moment.`;
    const replyCard = buildScoutCard({
      title: 'Scout',
      status: 'Done',
      isActive: false,
      sections: [{ type: 'text', body: replyText }],
    });
    replyCard.classList.add('kb-card--done');
    inner.appendChild(replyCard);
    requestAnimationFrame(() => requestAnimationFrame(() => replyCard.classList.add('kb-card--visible')));
    inner.scrollTop = inner.scrollHeight;
  }, 1100);
}

function initHomeScout() {
  const isBrand = state.accountType === 'brand';

  const cards = isBrand ? [
    {
      title: 'Right now',
      subtitle: 'Trending opportunity',
      status: 'Live',
      isActive: true,
      sections: [
        { type: 'chips', eyebrow: 'TRENDING', chips: ['#SouthAsianHeritageWeek', 'Heritage content', 'Cultural storytelling'] },
        { type: 'topics', eyebrow: 'SIGNAL STRENGTH', bars: [
          { label: 'Personal stories', pct: '78%' },
          { label: 'Brand content',    pct: '24%' },
          { label: 'Product posts',    pct: '41%' },
        ]},
        { type: 'peak', eyebrow: 'PEAK WINDOW TODAY', track: { left: '50%', width: '17%' }, body: '2–4pm PKT · 3 drafts ready' },
      ],
      chips: ['Draft a thread →', 'Show me the data'],
    },
  ] : [
    {
      title: 'Right now',
      subtitle: 'Spiking conversation',
      status: 'Live',
      isActive: true,
      sections: [
        { type: 'chips', eyebrow: 'TOPIC', chips: ['AI tooling debate', 'Nuanced takes', 'Design process'] },
        { type: 'topics', eyebrow: 'ENGAGEMENT BY FORMAT', bars: [
          { label: 'Nuanced takes',  pct: '85%' },
          { label: 'Hot takes',      pct: '34%' },
          { label: 'Tutorial posts', pct: '52%' },
        ]},
        { type: 'peak', eyebrow: 'PEAK WINDOW TODAY', track: { left: '50%', width: '17%' }, body: '2–4pm PKT · 3 drafts ready' },
      ],
      chips: ['Draft a follow-up →', 'Show the trend'],
    },
  ];

  const replyMap = {
    'Draft a thread →': `Here's a thread opener: "Heritage isn't a mood board. It's a body of knowledge being lost one generation at a time. Here's what I've been trying to learn…" Want the full 3-post thread?`,
    'Draft a follow-up →': `Here's an opener: "The 'AI replaces designers' take is from people who've never shipped under a deadline. Here's what actually happens in the room…" Build out the full post?`,
    'Show me the data': `#SouthAsianHeritageWeek is up 4.2× w/w. Personal stories are getting 3× more saves than brand content right now. Your last post hit exactly this note.`,
    'Show the trend': `The AI tooling debate is seeing 5.6× saves on nuanced takes vs. hot takes. Your last post landed in the sweet spot — a follow-up has strong potential.`,
    'See my drafts': `You have 3 drafts ready: (1) The collaboration post, (2) Tool audit thread, (3) A hot take on briefs. Which feels closest to ready?`,
    'Schedule one': `I can schedule any of your 3 drafts for 2pm PKT today. Which post do you want to go out?`,
    'Remind me later': `Got it — I'll surface this again closer to 2pm PKT.`,
  };

  initScoutPanel('home-scout-inner', 'home-scout-input', 'home-scout-send', cards, replyMap);
}

function initDashScout() {
  const isBrand = state.accountType === 'brand';

  const cards = isBrand ? [
    {
      title: 'This week\'s insight',
      subtitle: 'Analytics summary',
      status: 'Updated now',
      isActive: true,
      sections: [
        { type: 'text', body: 'Bookmarks are your strongest signal — up +38% this month. Posts with visual storytelling drive 2× more saves than copy-only.' },
        { type: 'topics', eyebrow: 'METRIC BREAKDOWN', bars: [
          { label: 'Impressions', pct: '72%' },
          { label: 'Bookmarks',   pct: '91%' },
          { label: 'Reposts',     pct: '38%' },
          { label: 'Likes',       pct: '55%' },
        ]},
        { type: 'chips', eyebrow: 'GROWING SEGMENT', chips: ['Women 25–34', 'Pakistan', 'UAE'] },
      ],
      chips: ['What drove this?', 'Draft for them'],
    },
  ] : [
    {
      title: 'This week\'s insight',
      subtitle: 'Analytics summary',
      status: 'Updated now',
      isActive: true,
      sections: [
        { type: 'text', body: 'Bookmarks are your strongest signal — up +34% this month. Your nuanced takes on AI are driving 3× more saves than your tutorial posts.' },
        { type: 'topics', eyebrow: 'METRIC BREAKDOWN', bars: [
          { label: 'Impressions', pct: '65%' },
          { label: 'Bookmarks',   pct: '88%' },
          { label: 'Replies',     pct: '42%' },
          { label: 'Reposts',     pct: '31%' },
        ]},
        { type: 'chips', eyebrow: 'GROWING SEGMENT', chips: ['Designers', 'PMs', '25–34 range'] },
      ],
      chips: ['What drove this?', 'Write for them'],
    },
  ];

  const replyMap = {
    'What drove this?': `Your bookmark spike tracks with the Heritage Week thread — posts that ask the reader to reflect (not just react) consistently drive 2–3× more saves in your niche.`,
    'Dig deeper': `Your top-performing post this month had a 85% ER and 34 bookmarks on just 1.4K reach — that's a 2.4% bookmark rate, which is exceptional. Want to reverse-engineer what made it land?`,
    'Draft for them': `Here's an angle for your 25–34 Pakistan/UAE audience: "The brief everyone ignores — and why the best projects start with it." Want me to build it out?`,
    'Write for them': `Here's an angle for Designers & PMs: "The 'move fast' culture broke something in how we brief. Here's what I've started doing instead." Want the full draft?`,
    'Tell me more': `The 25–34 women in Pakistan & UAE segment grew 12% this week, likely driven by the Heritage Week context. They're saving posts about craft, process, and cultural identity at 3× the baseline.`,
    'Show analytics': `Your Designers & PMs segment is now 31% of your audience. They have a 6.2% avg bookmark rate — highest of any segment. Posts about tooling opinions and process critiques land best.`,
  };

  initScoutPanel('dash-scout-inner', 'dash-scout-input', 'dash-scout-send', cards, replyMap);
}

function goAnalytics() {
  renderDashboard();
  initDashScout();
  showView('view-dash');
  setCrumbs(['Dashboard']);
}

function buildSnapshot(isBrand) {
  const stats = isBrand ? [
    { label: 'Followers',   value: '12.4k', delta: '+2.1%',  dir: 'up' },
    { label: 'Reach · 7d',  value: '58.2k', delta: '+9.7%',  dir: 'up' },
    { label: 'Engagement',  value: '4.6%',  delta: '+0.4pt', dir: 'up' },
    { label: 'Posts live',  value: '34',    delta: null },
  ] : [
    { label: 'Followers',   value: '8,240', delta: '+1.2%',  dir: 'up' },
    { label: 'Reach · 7d',  value: '42.1k', delta: '+8.4%',  dir: 'up' },
    { label: 'Engagement',  value: '3.8%',  delta: '−0.2pt', dir: 'down' },
    { label: 'Posts live',  value: '27',    delta: null },
  ];

  return el('div', { class: 'dash__snapshot' }, [
    el('div', { class: 'dash__snapshot-head' }, [
      el('span', { class: 'dash__snapshot-label' }, [
        el('span', { class: 'dash__snapshot-mark', html: icon('i-x-logo') }),
        document.createTextNode('Your account · last 7 days'),
      ]),
      el('button', { class: 'dash__snapshot-link', type: 'button', onclick: goAnalytics }, [
        document.createTextNode('View analytics'),
        el('span', { class: 'dash__snapshot-arrow', html: icon('i-arrow-right') }),
      ]),
    ]),
    el('div', { class: 'dash__snapshot-grid' },
      stats.map(s => el('button', { class: 'snap-tile', type: 'button', onclick: goAnalytics }, [
        el('span', { class: 'snap-tile__label' }, s.label),
        el('span', { class: 'snap-tile__value' }, s.value),
        s.delta
          ? el('span', { class: `snap-tile__delta snap-tile__delta--${s.dir}` }, s.delta)
          : el('span', { class: 'snap-tile__delta snap-tile__delta--flat' }, 'No change'),
      ])),
    ),
  ]);
}

function buildPulseSuggestion(isBrand) {
  const data = isBrand
    ? { text: 'Heritage Week peaks in ~3 hrs. Want a thread ready to ship?' }
    : { text: 'Your peak window opens in ~3 hrs. Want a draft on AI tooling ready?' };
  return el('button', { class: 'pulse pulse--suggest', type: 'button' }, [
    el('div', { class: 'pulse__label' }, 'Scout suggests'),
    el('div', { class: 'pulse__suggest-text' }, data.text),
    el('span', { class: 'pulse__suggest-cta' }, [
      document.createTextNode('Draft it'),
      el('span', { class: 'pulse__suggest-arrow', html: icon('i-arrow-right') }),
    ]),
  ]);
}

function buildRecentActivity(isBrand) {
  const preset = isBrand
    ? { name: 'rasa', handle: '@rasa', verified: true,  avatar: '/ProfileBrand.jpeg' }
    : { name: 'Abdullah Qamar', handle: '@aqamar', verified: false, avatar: '/ProfileIndividual.png' };

  const brand    = state.brand || {};
  const name     = brand.displayName || brand.name || preset.name;
  const handle   = brand.handle || preset.handle;
  const verified = brand.verified != null ? brand.verified : preset.verified;
  const avatar   = preset.avatar;

  const post = state.publishedPost || {
    body: isBrand
      ? "Heritage isn't an aesthetic. It's a postcode and a person who can name the stitch."
      : "Most design-system posts skip the part that matters: adoption. Token tables are easy.",
    postedAt: Date.now() - 1000 * 60 * 60 * 26,
  };

  const ms = Date.now() - (post.postedAt || Date.now());
  const mins = Math.round(ms / 60000);
  const rel = mins < 1 ? 'Just now'
    : mins < 60 ? `${mins}m ago`
    : mins < 1440 ? `${Math.round(mins / 60)}h ago`
    : `${Math.round(mins / 1440)}d ago`;

  const metrics = isBrand
    ? [['i-reply', '41'], ['i-repost', '74'], ['i-heart', '312'], ['i-bar-chart', '5,210']]
    : [['i-reply', '28'], ['i-repost', '42'], ['i-heart', '186'], ['i-bar-chart', '3,420']];

  const goPosts = () => { showView('view-conv'); setCrumbs(['Posts']); };

  const tweet = el('div', {
    class: 'success-post success-post--recent',
    role: 'button',
    tabindex: '0',
    onclick: goPosts,
    onkeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); goPosts(); } },
  }, [
    el('div', { class: 'success-post__head' }, [
      el('div', { class: 'success-post__avatar', style: `background-image: url('${avatar}');` }),
      el('div', { class: 'success-post__id' }, [
        el('div', { class: 'success-post__name-row' }, [
          el('span', { class: 'success-post__name' }, name),
          verified ? el('span', { class: 'success-post__verified', html: icon('i-check') }) : null,
          el('span', { class: 'success-post__handle' }, `${handle} · ${rel}`),
        ]),
      ]),
      el('span', { class: 'success-post__badge success-post__badge--live' }, [
        el('span', { class: 'success-post__badge-icon', html: icon('i-check') }),
        document.createTextNode('Published'),
      ]),
    ]),
    el('div', { class: 'success-post__body' }, post.body),
    el('div', { class: 'success-post__metrics' },
      metrics.map(([ic, value]) => el('div', { class: 'success-post__metric' }, [
        el('span', { class: 'success-post__metric-icon', html: icon(ic) }),
        el('span', { class: 'success-post__metric-value' }, value),
      ])),
    ),
  ]);

  return el('div', { class: 'dash__recent' }, [
    el('div', { class: 'dash__recent-head' }, [
      el('h3', { class: 'dash__recent-title' }, 'Recent activity'),
      el('button', { class: 'dash__recent-link', type: 'button', onclick: goPosts }, [
        document.createTextNode('All posts'),
        el('span', { class: 'dash__recent-arrow', html: icon('i-arrow-right') }),
      ]),
    ]),
    tweet,
  ]);
}

function buildPostCTA(isBrand) {
  const h = (state.brand && state.brand.handle) || (isBrand ? '@rasa' : '@aqamar');
  const samples = isBrand ? [
    { handle: h, body: "Heritage isn't an aesthetic. It's a postcode and a person who can name the stitch." },
    { handle: h, body: "Bibi taught us mirror work in Hyderabad. 31 years, hands faster than my notes." },
    { handle: h, body: "Workshop reels outperform studio reels 1.8× for us. Tells you what your audience wants." },
  ] : [
    { handle: h, body: "Most design-system posts skip the part that matters: adoption. Token tables are easy." },
    { handle: h, body: "First time I shipped a system, optimized the wrong thing for six months. Lesson logged." },
    { handle: h, body: "AI replacing designers is a take from people who don't ship. The real question is which 30%." },
  ];

  const stack = el('div', { class: 'cta-card__stack' },
    samples.map((s, i) => el('div', { class: `cta-card__post cta-card__post--${i + 1}` }, [
      el('div', { class: 'cta-card__post-head' }, [
        el('span', { class: 'cta-card__post-avatar' }),
        el('span', { class: 'cta-card__post-handle' }, s.handle),
      ]),
      el('div', { class: 'cta-card__post-body' }, s.body),
    ])),
  );

  return el('button', {
    class: 'cta-card cta-card--post',
    type: 'button',
    onclick: () => {},
  }, [
    el('div', { class: 'cta-card__pill' }, [
      el('span', { class: 'cta-card__pill-mark', html: icon('i-logo') }),
      document.createTextNode('Scout · drafts in your voice'),
    ]),
    el('h2', { class: 'cta-card__title' }, 'Craft your next post'),
    el('p', { class: 'cta-card__sub' }, 'Scout writes in your tone, on the trends that matter. You edit, you ship.'),
    stack,
    el('span', { class: 'cta-card__action' }, [
      document.createTextNode('Create post'),
      el('span', { class: 'cta-card__action-arrow', html: icon('i-arrow-right') }),
    ]),
  ]);
}

function buildCampaignCTA(isBrand) {
  const rows = isBrand ? [
    { icon: 'i-trend',  label: 'Goals',    value: 'Audience growth · Sales' },
    { icon: 'i-people', label: 'Audience', value: 'Women 22–34 · Pakistan' },
    { icon: 'i-cal',    label: 'Duration', value: '12 days · Heritage Week' },
    { icon: 'i-chat',   label: 'Posts',    value: '9 scheduled · 3 angles' },
  ] : [
    { icon: 'i-trend',  label: 'Goals',    value: 'Thought leadership · Leads' },
    { icon: 'i-people', label: 'Audience', value: 'Designers & PMs · 25–40' },
    { icon: 'i-cal',    label: 'Duration', value: '14 days · Office hours' },
    { icon: 'i-chat',   label: 'Posts',    value: '6 scheduled · 2 angles' },
  ];

  const brief = el('div', { class: 'cta-card__brief' }, [
    el('div', { class: 'cta-card__brief-head' }, [
      el('span', { class: 'cta-card__brief-tag' }, 'Campaign brief'),
      el('span', { class: 'cta-card__brief-status' }, 'Draft'),
    ]),
    ...rows.map(r => el('div', { class: 'cta-card__brief-row' }, [
      el('span', { class: 'cta-card__brief-icon', html: icon(r.icon) }),
      el('span', { class: 'cta-card__brief-label' }, r.label),
      el('span', { class: 'cta-card__brief-value' }, r.value),
    ])),
  ]);

  return el('button', { class: 'cta-card cta-card--campaign', type: 'button' }, [
    el('div', { class: 'cta-card__pill' }, [
      el('span', { class: 'cta-card__pill-mark', html: icon('i-logo') }),
      document.createTextNode('Scout · multi-post planning'),
    ]),
    el('h2', { class: 'cta-card__title' }, 'Run a campaign'),
    el('p', { class: 'cta-card__sub' }, 'Goals, audience, schedule, posts. Scout assembles the brief, you approve.'),
    brief,
    el('span', { class: 'cta-card__action' }, [
      document.createTextNode('Start campaign'),
      el('span', { class: 'cta-card__action-arrow', html: icon('i-arrow-right') }),
    ]),
  ]);
}

function buildPulseTrend(isBrand) {
  const data = isBrand
    ? { tag: '#SouthAsianHeritageWeek', delta: '4.2× w/w', detail: 'matches your themes' }
    : { tag: 'AI tooling debate',        delta: '5.6× saves', detail: 'on nuanced takes' };
  return el('div', { class: 'pulse pulse--trend' }, [
    el('div', { class: 'pulse__label' }, 'Top trend'),
    el('div', { class: 'pulse__value' }, data.tag),
    el('div', { class: 'pulse__detail' }, [
      el('span', { class: 'pulse__delta' }, data.delta),
      document.createTextNode(' · ' + data.detail),
    ]),
  ]);
}

function buildPulseWindow(isBrand) {
  const data = isBrand
    ? { window: '2–4pm PKT', detail: 'In 3 hours · weekday peak' }
    : { window: '9–11am PKT', detail: 'Tomorrow morning · global window' };
  return el('div', { class: 'pulse pulse--window' }, [
    el('div', { class: 'pulse__label' }, 'Peak window'),
    el('div', { class: 'pulse__value' }, data.window),
    el('div', { class: 'pulse__detail' }, data.detail),
  ]);
}

function renderDashboard() {
  const dash = $('#dash');
  dash.innerHTML = '';

  const isBrand = state.accountType === 'brand';
  const firstName = (state.user.name || 'there').split(/\s+/)[0];

  // ── Header ────────────────────────────────────────────────────────────
  dash.appendChild(el('div', { class: 'dash__header' }, [
    el('div', { class: 'dash__header-left' }, [
      el('h1', { class: 'dash__title' }, `Good to have you, ${firstName}.`),
      el('div', { class: 'dash__header-meta' }, [
        el('div', { class: 'dash__date-range' }, [
          el('span', { html: icon('i-cal') }),
          document.createTextNode('17 Jun – 17 Jul, 2026'),
        ]),
        el('span', { class: 'dash__meta-sep' }, '·'),
        el('span', { class: 'dash__updated' }, 'Updated just now'),
      ]),
    ]),
    el('button', { class: 'dash__new-post-btn', type: 'button' }, [
      el('span', { html: icon('i-pencil') }),
      document.createTextNode('New post'),
    ]),
  ]));

  // ── KPI strip ─────────────────────────────────────────────────────────
  const kpis = isBrand ? [
    { label: 'Impressions',  value: '18,420', delta: '+22%',  up: true  },
    { label: 'Likes',        value: '1,284',  delta: '+14%',  up: true  },
    { label: 'Replies',      value: '97',     delta: '-3%',   up: false },
    { label: 'Bookmarks',    value: '341',    delta: '+38%',  up: true  },
    { label: 'Reposts',      value: '156',    delta: '+9%',   up: true  },
  ] : [
    { label: 'Impressions',  value: '14,200', delta: '+18%',  up: true  },
    { label: 'Likes',        value: '487',    delta: '+12%',  up: true  },
    { label: 'Replies',      value: '64',     delta: '-3%',   up: false },
    { label: 'Bookmarks',    value: '189',    delta: '+34%',  up: true  },
    { label: 'Reposts',      value: '23',     delta: '-8%',   up: false },
  ];

  dash.appendChild(el('div', { class: 'dash__kpi-strip' },
    kpis.map(k => el('div', { class: 'dash__kpi-card' }, [
      el('div', { class: 'dash__kpi-label' }, k.label),
      el('div', { class: 'dash__kpi-value' }, k.value),
      el('div', { class: 'dash__kpi-delta' + (k.up ? ' dash__kpi-delta--up' : ' dash__kpi-delta--down') }, [
        el('span', { class: 'dash__kpi-arrow' }, k.up ? '↑' : '↓'),
        document.createTextNode(k.delta),
      ]),
    ]))
  ));

  // ── Charts row (2-col: reach chart + age breakdown) ───────────────────
  dash.appendChild(el('div', { class: 'dash__charts-row' }, [
    buildReachChart(isBrand),
    buildAgeChart(isBrand),
  ]));

  // ── Bottom row (3-col: heatmap + top post + audience) ─────────────────
  dash.appendChild(el('div', { class: 'dash__analytics-row' }, [
    buildHeatmap(),
    buildTopPost(isBrand),
    buildAudienceList(isBrand),
  ]));
}

function buildLivePostCard(isBrand) {
  const post = state.publishedPost;
  const brand = state.brand || {};
  const handle   = brand.handle || (isBrand ? '@rasa' : '@aqamar');
  const name     = brand.displayName || brand.name || (isBrand ? 'Rasa' : 'Abdullah Qamar');
  const avatarSrc = isBrand ? '/ProfileBrand.jpeg' : '/ProfileIndividual.png';
  const timeAgo  = '2h ago';

  const stats = [
    { label: 'Impressions', value: '1.4K' },
    { label: 'Likes',       value: '87'   },
    { label: 'Replies',     value: '12'   },
    { label: 'Bookmarks',   value: '34'   },
  ];

  // mini sparkline path
  const sparkPath = 'M0,20 L10,18 L20,15 L30,12 L40,10 L50,7 L60,5 L70,3 L80,1';

  return el('div', { class: 'dash__live-card' }, [
    el('div', { class: 'dash__live-card-head' }, [
      el('div', { class: 'dash__live-badge' }, [
        el('span', { class: 'dash__live-dot' }),
        document.createTextNode('Live · ' + timeAgo),
      ]),
      el('div', { class: 'dash__live-author' }, [
        el('div', { class: 'dash__live-avatar', style: `background-image: url('${avatarSrc}')` }),
        el('div', { class: 'dash__live-id' }, [
          el('span', { class: 'dash__live-name' }, name),
          el('span', { class: 'dash__live-handle' }, handle),
        ]),
      ]),
    ]),
    el('p', { class: 'dash__live-body' }, post.body),
    el('div', { class: 'dash__live-stats' }, [
      ...stats.map(s => el('div', { class: 'dash__live-stat' }, [
        el('span', { class: 'dash__live-stat-val' }, s.value),
        el('span', { class: 'dash__live-stat-lbl' }, s.label),
      ])),
      el('div', { class: 'dash__live-sparkline', html: `<svg viewBox="0 0 80 22" preserveAspectRatio="none" style="width:100%;height:100%"><path d="${sparkPath}" fill="none" stroke="var(--primary)" stroke-width="2" stroke-linecap="round"/></svg>` }),
    ]),
  ]);
}

function buildIntelTrend(isBrand) {
  const data = isBrand
    ? { label: 'Top trend', value: '#SouthAsianHeritageWeek', delta: '+4.2×', detail: 'matches your themes' }
    : { label: 'Top trend', value: 'AI tooling debate',       delta: '+5.6×', detail: 'on nuanced takes' };
  return el('div', { class: 'intel-tile' }, [
    el('div', { class: 'intel-tile__label' }, data.label),
    el('div', { class: 'intel-tile__value' }, data.value),
    el('div', { class: 'intel-tile__detail' }, [
      el('span', { class: 'intel-tile__delta' }, data.delta),
      document.createTextNode(' · ' + data.detail),
    ]),
  ]);
}

function buildIntelWindow(isBrand) {
  const data = isBrand
    ? { label: 'Peak window', value: '2–4 pm PKT', detail: 'In 3 hours · weekday peak' }
    : { label: 'Peak window', value: '9–11 am PKT', detail: 'Tomorrow · global window' };
  return el('div', { class: 'intel-tile' }, [
    el('div', { class: 'intel-tile__label' }, data.label),
    el('div', { class: 'intel-tile__value' }, data.value),
    el('div', { class: 'intel-tile__detail' }, data.detail),
  ]);
}

function buildIntelAudience(isBrand) {
  const data = isBrand
    ? { label: 'Audience', value: 'Women 22–34', detail: 'Pakistan · design-curious' }
    : { label: 'Audience', value: 'Designers & PMs', detail: 'Age 25–40 · mobile-first' };
  return el('div', { class: 'intel-tile' }, [
    el('div', { class: 'intel-tile__label' }, data.label),
    el('div', { class: 'intel-tile__value' }, data.value),
    el('div', { class: 'intel-tile__detail' }, data.detail),
  ]);
}

function buildIntelSetup() {
  const total   = state.accountType === 'brand' ? 4 : 3;
  const skipped = state.skipped.size;
  const done    = Math.max(0, total - skipped);
  const pct     = Math.round((done / total) * 100);
  const allDone = done === total;

  return el('div', { class: 'intel-tile intel-tile--setup' + (allDone ? ' intel-tile--done' : '') }, [
    el('div', { class: 'intel-tile__label' }, 'Setup'),
    el('div', { class: 'intel-tile__value' }, allDone ? 'Complete' : `${done} / ${total}`),
    el('div', { class: 'intel-tile__bar' }, [
      el('div', { class: 'intel-tile__bar-fill', style: `width: ${pct}%` }),
    ]),
    el('div', { class: 'intel-tile__detail' },
      allDone ? 'Knowledge, voice, and tracking locked in.' : 'Finish setup to sharpen Scout.',
    ),
  ]);
}

function buildDraftCard(isBrand, index) {
  const drafts = isBrand ? [
    { angle: 'Confessional, specific', tone: 'Reflective', body: "Workshop reels outperform studio reels 1.8× for us. Half the engagement comes from the mistakes we leave in." },
    { angle: 'Sharp, contrarian',      tone: 'Direct',     body: "Heritage isn't an aesthetic — it's a postcode and a grandmother who can name every stitch without looking." },
  ] : [
    { angle: 'Sharp, contrarian',      tone: 'Direct',     body: "'AI replaces designers' is a take from people who don't ship. The real question is which 30% of the job goes first, and whether you're spending 30% of your time there." },
    { angle: 'Confessional, specific', tone: 'Honest',     body: "First time I shipped a design system, I optimized the wrong thing for six months. I made the buttons perfect. Nobody used the buttons." },
  ];
  const d = drafts[index] || drafts[0];

  return el('div', { class: 'dash__draft-card' }, [
    el('div', { class: 'dash__draft-chips' }, [
      el('span', { class: 'dash__draft-chip' }, d.angle),
      el('span', { class: 'dash__draft-chip' }, d.tone),
    ]),
    el('p', { class: 'dash__draft-body' }, d.body),
    el('button', { class: 'dash__draft-btn', type: 'button' }, [
      document.createTextNode('Edit & publish'),
      el('span', { html: icon('i-arrow-right') }),
    ]),
  ]);
}

function buildNextPostCTA(isBrand) {
  const hint = isBrand
    ? 'Based on your niche, audience, and trending signals.'
    : "Based on your voice, audience, and what\u2019s performing in your space.";
  return el('button', { class: 'dash__create-cta', type: 'button' }, [
    el('div', { class: 'dash__create-cta-left' }, [
      el('div', { class: 'dash__create-pill' }, [
        el('span', { html: icon('i-logo') }),
        document.createTextNode('Scout'),
      ]),
      el('div', { class: 'dash__create-title' }, 'Craft your next post'),
      el('div', { class: 'dash__create-sub' }, hint),
    ]),
    el('span', { class: 'dash__create-arrow', html: icon('i-arrow-right') }),
  ]);
}

function buildReachChart(isBrand) {
  const follower = [110,118,125,130,122,138,145,152,148,160,168,175,170,182,190,185,195,208,200,215,222,218,230,240,235,248,255,250,265,272];
  const other    = [75, 80, 78, 85, 82, 90, 97, 102,100,108,114,120,117,125,132,128,136,144,140,150,155,152,161,168,164,172,178,175,184,190];

  const W = 560, H = 200;
  const pad = { t: 20, r: 16, b: 30, l: 44 };
  const pw = W - pad.l - pad.r, ph = H - pad.t - pad.b;
  const n = follower.length;
  const allV = [...follower, ...other];
  const minV = Math.min(...allV), maxV = Math.max(...allV);
  const xs = i => pad.l + (i / (n - 1)) * pw;
  const ys = v => pad.t + ph - ((v - minV) / (maxV - minV)) * ph;
  const pts = d => d.map((v, i) => `${xs(i).toFixed(1)},${ys(v).toFixed(1)}`).join(' ');

  const fPts = pts(follower), oPts = pts(other);
  const fArea = `${fPts} ${(pad.l + pw).toFixed(1)},${(pad.t + ph).toFixed(1)} ${pad.l},${(pad.t + ph).toFixed(1)}`;
  const oArea = `${oPts} ${(pad.l + pw).toFixed(1)},${(pad.t + ph).toFixed(1)} ${pad.l},${(pad.t + ph).toFixed(1)}`;

  const gridLines = [0, 0.25, 0.5, 0.75, 1].map(t => {
    const y = (pad.t + t * ph).toFixed(1);
    const val = Math.round(maxV - t * (maxV - minV));
    return `<line x1="${pad.l}" y1="${y}" x2="${W - pad.r}" y2="${y}" stroke="#f0f0f2" stroke-width="1"/>
            <text x="${pad.l - 8}" y="${parseFloat(y) + 4}" fill="#a0a0ab" font-size="10" text-anchor="end">${val}</text>`;
  }).join('');

  const xLabels = [0, 5, 10, 15, 20, 25, 29].map(i =>
    `<text x="${xs(i).toFixed(1)}" y="${H - 6}" fill="#a0a0ab" font-size="10" text-anchor="middle">${i + 1}</text>`
  ).join('');

  const svg = `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" style="width:100%;height:200px">
    <defs>
      <style>
        .rc-line { stroke-dasharray: 2000; stroke-dashoffset: 2000; animation: rc-draw 1.4s cubic-bezier(0.4,0,0.2,1) forwards; }
        .rc-line--other { animation-delay: 0.15s; }
        .rc-area { opacity: 0; animation: rc-fadein 0.6s ease 1s forwards; }
        @keyframes rc-draw { to { stroke-dashoffset: 0; } }
        @keyframes rc-fadein { to { opacity: 1; } }
      </style>
    </defs>
    ${gridLines}${xLabels}
    <polygon points="${fArea}" fill="rgba(91,91,245,0.07)" class="rc-area"/>
    <polyline points="${fPts}" fill="none" stroke="#5B5BF5" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" class="rc-line"/>
    <polygon points="${oArea}" fill="rgba(52,211,153,0.07)" class="rc-area"/>
    <polyline points="${oPts}" fill="none" stroke="#34D399" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" class="rc-line rc-line--other"/>
  </svg>`;

  return el('div', { class: 'dash__chart-card' }, [
    el('div', { class: 'dash__chart-head' }, [
      el('span', { class: 'dash__chart-title' }, 'Profile reach growth'),
      el('div', { class: 'dash__chart-legend' }, [
        el('span', { class: 'dash__chart-legend-item' }, [
          el('span', { class: 'dash__chart-legend-dot', style: 'background:#5B5BF5' }),
          document.createTextNode('Follower'),
        ]),
        el('span', { class: 'dash__chart-legend-item' }, [
          el('span', { class: 'dash__chart-legend-dot', style: 'background:#34D399' }),
          document.createTextNode('Other'),
        ]),
      ]),
    ]),
    el('div', { class: 'dash__chart-body', html: svg }),
  ]);
}

function buildAgeChart(isBrand) {
  const segments = isBrand ? [
    { range: '18–24', pct: 32, color: '#5B5BF5' },
    { range: '25–34', pct: 41, color: '#7C7CF8' },
    { range: '35–44', pct: 18, color: '#A5A5FB' },
    { range: '45+',   pct:  9, color: '#D0D0FD' },
  ] : [
    { range: '18–24', pct: 28, color: '#5B5BF5' },
    { range: '25–34', pct: 45, color: '#7C7CF8' },
    { range: '35–44', pct: 18, color: '#A5A5FB' },
    { range: '45+',   pct:  9, color: '#D0D0FD' },
  ];

  const gender = isBrand
    ? [{ label: 'Female', pct: 62 }, { label: 'Male', pct: 31 }, { label: 'Other', pct: 7 }]
    : [{ label: 'Male', pct: 54 }, { label: 'Female', pct: 38 }, { label: 'Other', pct: 8 }];

  const topLoc  = isBrand ? 'Pakistan · UAE' : 'United States · India';
  const totalFollowers = isBrand ? '12.4k' : '12.4k';
  const peakAge = segments.reduce((a, b) => a.pct > b.pct ? a : b);

  const maxPct = Math.max(...segments.map(s => s.pct));
  const W = 260, H = 155;
  const pad = { t: 10, r: 40, b: 10, l: 44 };
  const pw = W - pad.l - pad.r, ph = H - pad.t - pad.b;
  const barH = Math.floor(ph / segments.length) - 5;

  const bars = segments.map((s, i) => {
    const barW = (s.pct / maxPct) * pw;
    const y = pad.t + i * (barH + 5);
    return `<text x="${pad.l - 8}" y="${y + barH / 2 + 4}" fill="#71717a" font-size="11" text-anchor="end">${s.range}</text>
            <rect x="${pad.l}" y="${y}" width="0" height="${barH}" rx="3" fill="${s.color}">
              <animate attributeName="width" from="0" to="${barW.toFixed(1)}" dur="0.7s" calcMode="spline" keySplines="0.4 0 0.2 1" fill="freeze" begin="${0.1 + i * 0.1}s"/>
            </rect>
            <text x="${pad.l + barW + 6}" y="${y + barH / 2 + 4}" fill="#3f3f46" font-size="11" font-weight="600">${s.pct}%</text>`;
  }).join('');

  const genderColors = ['#5B5BF5', '#34D399', '#F59E0B'];

  return el('div', { class: 'dash__chart-card dash__chart-card--narrow' }, [
    el('div', { class: 'dash__chart-head' }, [
      el('span', { class: 'dash__chart-title' }, 'Audience by age'),
    ]),
    // Summary stat row
    el('div', { class: 'dash__age-summary' }, [
      el('div', { class: 'dash__age-stat' }, [
        el('span', { class: 'dash__age-stat-val' }, totalFollowers),
        el('span', { class: 'dash__age-stat-lbl' }, 'followers'),
      ]),
      el('div', { class: 'dash__age-stat' }, [
        el('span', { class: 'dash__age-stat-val' }, peakAge.range),
        el('span', { class: 'dash__age-stat-lbl' }, 'top bracket'),
      ]),
    ]),
    // Gender split
    el('div', { class: 'dash__age-section' }, [
      el('div', { class: 'dash__age-eyebrow' }, 'GENDER'),
      el('div', { class: 'dash__age-gender-row' },
        gender.map((g, i) => el('div', { class: 'dash__age-gender-item' }, [
          el('span', { class: 'dash__age-gender-dot', style: `background:${genderColors[i]}` }),
          el('span', { class: 'dash__age-gender-label' }, g.label),
          el('span', { class: 'dash__age-gender-pct' }, g.pct + '%'),
        ]))
      ),
    ]),
    // Top location
    el('div', { class: 'dash__age-section dash__age-section--loc' }, [
      el('div', { class: 'dash__age-eyebrow' }, 'TOP LOCATIONS'),
      el('div', { class: 'dash__age-loc' }, topLoc),
    ]),
  ]);
}

function buildHeatmap() {
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const weeks = ['Week 1', 'Week 2', 'Week 3', 'Week 4'];
  // intensity 0–4
  const data = [
    [0, 2, 1, 3, 2, 0, 0],
    [1, 3, 4, 2, 3, 1, 0],
    [0, 2, 3, 4, 2, 0, 0],
    [1, 1, 2, 3, 1, 0, 0],
  ];
  const colors = ['#f4f4f6', '#c7c7fb', '#9999f8', '#6b6bf5', '#3d3dc8'];

  const cells = weeks.map((w, wi) =>
    el('div', { class: 'dash__heatmap-row' }, [
      el('span', { class: 'dash__heatmap-week' }, w),
      ...days.map((d, di) =>
        el('div', {
          class: 'dash__heatmap-cell',
          style: `background:${colors[data[wi][di]]}`,
          title: `${w} ${d}: intensity ${data[wi][di]}`,
        })
      ),
    ])
  );

  return el('div', { class: 'dash__analytics-card' }, [
    el('div', { class: 'dash__chart-head' }, [
      el('span', { class: 'dash__chart-title' }, 'Post timing heatmap'),
    ]),
    el('div', { class: 'dash__heatmap' }, [
      el('div', { class: 'dash__heatmap-header' }, [
        el('span', { class: 'dash__heatmap-week' }),
        ...days.map(d => el('span', { class: 'dash__heatmap-day' }, d)),
      ]),
      ...cells,
    ]),
  ]);
}

function buildTopPost(isBrand) {
  const post = state.publishedPost || {
    body: isBrand
      ? "My nani's dupatta has stitches I can't name. This week I'm trying to learn them, properly."
      : "'AI replaces designers' is a take from people who don't ship. The real question is which 30% of the job goes first.",
  };
  const stats = [
    { label: 'Rank',      value: '#1'   },
    { label: 'ER',        value: '85%'  },
    { label: 'Reach',     value: '1.4K' },
    { label: 'Bookmarks', value: '34'   },
  ];

  return el('div', { class: 'dash__analytics-card' }, [
    el('div', { class: 'dash__chart-head' }, [
      el('span', { class: 'dash__chart-title' }, 'Top performing post'),
      el('span', { class: 'dash__chart-more' }, '···'),
    ]),
    el('div', { class: 'dash__top-post' }, [
      el('p', { class: 'dash__top-post-body' }, post.body.slice(0, 120) + (post.body.length > 120 ? '…' : '')),
      el('div', { class: 'dash__top-post-stats' },
        stats.map(s => el('div', { class: 'dash__top-post-stat' }, [
          el('span', { class: 'dash__top-post-stat-label' }, s.label),
          el('span', { class: 'dash__top-post-stat-value' }, s.value),
        ]))
      ),
    ]),
  ]);
}

function buildAudienceList(isBrand) {
  const items = isBrand ? [
    { country: 'Pakistan',      count: '2,840' },
    { country: 'UAE',           count: '1,120' },
    { country: 'United Kingdom', count: '634'  },
    { country: 'United States', count: '487'  },
    { country: 'Canada',        count: '213'  },
  ] : [
    { country: 'United States', count: '1,267' },
    { country: 'Pakistan',      count: '874'   },
    { country: 'India',         count: '541'   },
    { country: 'United Kingdom', count: '398'  },
    { country: 'Canada',        count: '213'   },
  ];

  return el('div', { class: 'dash__analytics-card' }, [
    el('div', { class: 'dash__chart-head' }, [
      el('span', { class: 'dash__chart-title' }, 'Audience location'),
      el('span', { class: 'dash__chart-more' }, '···'),
    ]),
    el('div', { class: 'dash__audience-list' },
      items.map(item => el('div', { class: 'dash__audience-row' }, [
        el('span', { class: 'dash__audience-country' }, item.country),
        el('span', { class: 'dash__audience-count' }, item.count),
      ]))
    ),
  ]);
}

/* =========================================================================
   14. STEP FUNCTIONS, the conversation graph
   Each step is an async function that updates state and returns when complete.
   ========================================================================= */

// Derive an @handle from a person's name: first initial + last name.
function handleFromName(name) {
  const parts = (name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '';
  if (parts.length === 1) return '@' + parts[0].toLowerCase();
  return '@' + (parts[0][0] || '').toLowerCase() + parts[parts.length - 1].toLowerCase();
}

// Sync the connected-account identity to the logged-in user so their name
// shows everywhere (posts, profile, dashboard). For individuals the person IS
// the account. Brands keep their own brand identity (e.g. the company name).
// Safe to call repeatedly and from any entry point.
function applyUserIdentity() {
  if (!state.brand) {
    const persona = state.accountType === 'brand' ? DEMO_BRAND : DEMO_INDIVIDUAL;
    state.brand = { ...persona };
  }
  if (state.accountType === 'brand') return;
  const name = (state.user.name || '').trim();
  if (!name) return;
  state.brand.name        = name;
  state.brand.displayName = name;
  state.brand.handle      = handleFromName(name) || state.brand.handle;
}

async function step1_opening() {
  // Hero owns the only human touch point at this stage: profile type.
  // openingHero() blocks until the user picks Individual or Brand and writes
  // state.accountType.
  await openingHero();

  const persona = state.accountType === 'brand' ? DEMO_BRAND : DEMO_INDIVIDUAL;
  state.brand = { ...persona };
  applyUserIdentity(); // reflect the logged-in user's name/handle on their account
  state.kb.kbReveal = new Set(); // identity reveals only after X connect or website scan
  state.audience = persona.audienceDefault;
  state.tone = persona.tone;
  state.competitors = persona.competitorsDefault;

  // KB depends on accountType (brands track product/niche, individuals track
  // topics/expertise). Render only now that the persona is known.
  // Keep KB hidden until after the connect-X step completes.
  document.body.classList.add('mode-connecting');
  renderKB();

  // Scout greets the user warmly — the conversation begins immediately after
  // the profile pick. No first-post hook here; that framing came on splash 3.
  const greeting = state.accountType === 'brand'
    ? "Perfect. I'll learn your brand the way you'd describe it to a friend — your voice, your audience, what's already landing. Five minutes, max."
    : `Perfect, ${state.user.name}. I'll learn how you think and write — your voice, your audience, what's already landing. Five minutes, max.`;
  await scoutMsg(greeting, { typingFor: 900, beat: 400 });
}

async function step3_product_lines_brand_only() {
  if (state.accountType !== 'brand') return;
  await scoutMsg(
    "One important question. Does rasa have distinct product lines that should speak to different audiences? " +
    "An embroidery line for special occasions might need a different voice than an everyday line.",
    { typingFor: 1100, beat: 400 }
  );
  const answer = await quickReplies(
    ['Yes, multiple lines', 'No, one brand voice', 'Not sure'],
    { primaryIndex: 0 }
  );

  if (answer.startsWith('Not sure')) {
    await scoutMsg(
      "Quick clarifier, do you sell more than one type of product, or do all your products target the same kind of customer?",
      { typingFor: 900, beat: 400 }
    );
    const sub = await quickReplies(['Different customer types', 'Same customer'], { primaryIndex: 0 });
    if (sub.startsWith('Same')) {
      state.skipped.add('product-lines');
      await scoutMsg("Got it, one master voice. Cleaner that way.", { typingFor: 600 });
      return;
    }
    // else fall through to "Yes" handling
  }

  if (answer.startsWith('No')) {
    state.skipped.add('product-lines');
    await scoutMsg("Got it, one master voice. I'll keep it cohesive.", { typingFor: 600, beat: 400 });
    return;
  }

  await scoutMsg(
    "Tell me about each line, what it is, who it's for, and what makes it different. " +
    "I'll create separate contexts so I can tailor content per line.",
    { typingFor: 1000, beat: 400 }
  );

  // Demo: stage a scripted reply listing the lines
  await sleep(700);
  userMsg(
    "Three lines: Heritage Capsule (occasion-wear, women 28–40, formal heritage), " +
    "Everyday Edit (modern kurtas and tops, women 22–34, casual), " +
    "Atelier (limited-run statement pieces, collectors and gift buyers, premium)."
  );

  state.productLines = [
    { name: 'Heritage Capsule', audience: 'Women 28–40, occasion-led', tone: 'Reverent, refined' },
    { name: 'Everyday Edit',    audience: 'Women 22–34, daily wear',   tone: 'Casual, witty' },
    { name: 'Atelier',          audience: 'Collectors, gift buyers',   tone: 'Considered, premium' },
  ];

  await narratedProcess('Building your product-line contexts', [
    { icon: 'i-grid',    text: 'Creating Heritage Capsule context. Separate audience, tone variant.' },
    { icon: 'i-grid',    text: 'Creating Everyday Edit context. Inherits master voice with a casual lift.' },
    { icon: 'i-grid',    text: 'Creating Atelier context. Premium register, lower posting frequency.' },
    { icon: 'i-link',    text: 'Wiring each line to the master brand identity.' },
  ], { lineBeat: 900 });

  await scoutMsg("Here's how the structure looks, edit if anything's off.", { typingFor: 600, beat: 400 });
  await productLineTreeCard(state.productLines);

  // Each product line becomes a fact in the Product KB
  state.productLines.forEach(l => addKBFact('brand', l.name, `${l.audience} · ${l.tone}`));
  refreshBrandDrawer();
}

async function step4_goals() {
  // Goals as frame-setter — runs before any account scan so Scout reads
  // everything that follows through the lens of what the user is trying to
  // achieve. Short copy, no upfront KPI dump (that surfaces later when it's
  // useful).
  await scoutMsg(
    "Before I dig in, what are you trying to achieve on X? Pick up to 3, the ones that matter most.",
    { typingFor: 900, beat: 300 }
  );
  state.goals = await selectionChips([
    'Grow audience', 'Drive traffic to site', 'Build thought leadership',
    'Boost sales', 'Increase brand awareness', 'Generate leads',
  ], { maxSelections: 3 });

  const headline = state.goals.slice(0, 2).join(' and ') + (state.goals.length > 2 ? ' (and more)' : '');
  await scoutMsg(
    `Got it, ${headline}. Here's how I'll measure that:`,
    { typingFor: 800, beat: 300 }
  );

  const kpiMap = {
    'Grow audience':            'Follower growth rate · profile visits from posts',
    'Drive traffic to site':    'Outbound link CTR · referral sessions from X',
    'Build thought leadership': 'Bookmark rate · reply quality · saves-to-likes ratio',
    'Boost sales':              'Link-in-bio clicks · post-to-conversion path',
    'Increase brand awareness': 'Impressions · reach lift · share-of-voice in niche',
    'Generate leads':           'Reply-to-DM rate · profile-to-form conversions',
  };
  renderKpiCard(state.goals, kpiMap);

  await scoutMsg(
    "These become the targets I'll optimize your content around.",
    { typingFor: 700, beat: 400 }
  );
  addKBFact('brand', 'Goals', state.goals.join(', '));
  addKBFact('brand', 'KPIs', state.goals.map(g => kpiMap[g] ? kpiMap[g].split(' · ')[0] : 'Engagement quality').join(', '));
  refreshBrandDrawer();
}

function renderKpiCard(goals, kpiMap) {
  const rows = goals.map(g => {
    const kpi = (kpiMap[g] || 'Engagement quality').split(' · ');
    return el('div', { class: 'kpi-row' }, [
      el('span', { class: 'kpi-row__icon', html: icon('i-trend') }),
      el('span', { class: 'kpi-row__goal' }, g),
      el('span', { class: 'kpi-row__arrow' }, '→'),
      el('span', { class: 'kpi-row__kpi' }, [
        el('strong', { class: 'kw' }, kpi[0]),
        kpi.length > 1 ? document.createTextNode(' · ' + kpi.slice(1).join(' · ')) : null,
      ]),
    ]);
  });
  const card = el('div', { class: 'kpi-card' }, [
    el('div', { class: 'kpi-card__head' }, [
      document.createTextNode('How I will measure that'),
    ]),
    el('div', { class: 'kpi-card__rows' }, rows),
  ]);
  append(card);
}

async function openKBPanel() {
  // Freeze stream width at its current pixel size so text can't reflow during the split
  const streamEl = document.querySelector('#stream');
  if (streamEl) streamEl.style.width = streamEl.offsetWidth + 'px';

  document.body.classList.remove('mode-connecting');
  document.body.classList.add('mode-kb-open');
  document.body.classList.add('mode-kb-transitioning');
  renderKB();
  requestAnimationFrame(() => requestAnimationFrame(() => {
    document.body.classList.add('mode-kb-visible');
    setTimeout(() => {
      document.body.classList.remove('mode-kb-transitioning');
      // Release the frozen width now that the fade-in is done
      if (streamEl) streamEl.style.width = '';
    }, 400);
  }));
}

async function step5_x_connect() {
  await scoutMsg(
    "First step, connect the account where you publish. I'll read what's working and build from there.",
    { typingFor: 1100, beat: 500 }
  );
  const { result, card } = await connectSocial();

  if (result === 'skip') {
    state.skipped.add('x-connect');
    await scoutMsg(
      "No problem. Without account data the best way to get me up to speed is for you to share what you've got. The chat below takes website links, brand docs, or just a description in your own words.",
      { typingFor: 1300, beat: 500 }
    );
    return 'skipped-entirely';
  }

  // Show OAuth modal. If cancelled, reset the X row and wait for the user to
  // click Connect again on the same card — repeat until authorized.
  if (card) markConnectXState(card, 'connecting');
  while (true) {
    const oauthResult = await fakeOAuthModal();
    if (oauthResult !== 'cancelled') break; // authorized → exit loop

    // Cancel: just reset the button, keep the card, wait for another click.
    if (card) markConnectXState(card, null);
    await new Promise((resolve) => {
      const xBtn = card?.querySelector('.platform--x');
      if (!xBtn) { resolve(); return; }
      const handler = () => { xBtn.removeEventListener('click', handler); resolve(); };
      xBtn.addEventListener('click', handler);
    });
    if (card) markConnectXState(card, 'connecting');
  }
  if (card) markConnectXState(card, 'connected');

  // Now that the user has authorized, open the KB panel
  openKBPanel();

  // Update the brand profile to reflect the logged-in user.
  applyUserIdentity();

  userMsg('Authorized X');

  await scoutMsg(
    "Connected. Thanks. Let me read what's there.",
    { typingFor: 700, beat: 400 }
  );
  // Card stays in the chat — just mark it as past/inert so it looks settled.
  if (card) {
    card.closest('.msg')?.classList.add('msg--past');
  }
  return 'connected-scan';
}

// Reflect connection progress on the visible X platform row inside the
// connect widget. Keeps the user oriented while the OAuth modal is open.
function markConnectXState(card, stateName) {
  const xRow = card.querySelector('.platform--x');
  if (!xRow) return;
  const cta = xRow.querySelector('.platform__cta');
  if (!cta) return;
  if (stateName === 'connecting') {
    xRow.classList.add('platform--connecting');
    cta.textContent = 'Connecting…';
  } else if (stateName === 'connected') {
    xRow.classList.remove('platform--connecting');
    xRow.classList.add('platform--connected');
    cta.textContent = 'Connected';
  } else {
    // reset — cancelled
    xRow.classList.remove('platform--connecting', 'platform--connected');
    cta.textContent = 'Connect';
  }
}

function fakeOAuthModal() {
  return new Promise((resolve) => {
    const dialog = el('div', { class: 'oauth-dialog' }, [
      el('div', { class: 'oauth-dialog__head' }, [
        el('span', { class: 'oauth-dialog__x', html: icon('i-x-logo') }),
        document.createTextNode('Authorize Flagstaff Social'),
      ]),
      el('div', { class: 'oauth-dialog__body' }, [
        el('div', { class: 'oauth-dialog__app' }, [
          el('strong', {}, 'Flagstaff Social'),
          ' wants to access your X account.',
        ]),
        el('ul', { class: 'oauth-dialog__perms' }, [
          el('li', {}, 'Read your profile and posts'),
          el('li', {}, 'See accounts you follow'),
          el('li', {}, 'View engagement on your posts'),
        ]),
        el('div', { class: 'oauth-dialog__note' }, 'Read-only. Flagstaff cannot post without your approval.'),
      ]),
      el('div', { class: 'oauth-dialog__actions' }, [
        el('button', { class: 'btn-ghost' }, 'Cancel'),
        el('button', { class: 'btn-x oauth-dialog__authorize' }, 'Authorize app'),
      ]),
    ]);
    const backdrop = el('div', { class: 'oauth-backdrop' }, [dialog]);
    document.body.appendChild(backdrop);
    dialog.querySelector('.oauth-dialog__authorize').addEventListener('click', async () => {
      backdrop.classList.add('oauth-backdrop--exiting');
      await sleep(220);
      backdrop.remove();
      resolve('authorized');
    });
    dialog.querySelector('.btn-ghost').addEventListener('click', async () => {
      backdrop.classList.add('oauth-backdrop--exiting');
      await sleep(220);
      backdrop.remove();
      resolve('cancelled');
    });
  });
}

async function step6_profile_scan() {
  // Choose between established and new variants
  const isNew = state.xAccountMaturity === 'new';

  if (isNew) {
    await narratedProcess('Studying your X profile', [
      { icon: 'i-search',   text: 'Pulling profile data' },
      { icon: 'i-sparkle',  text: 'Fresh account, no post history to analyze yet.' },
      { icon: 'i-search',   text: 'Looking at your interests and the accounts you follow.' },
      { icon: 'i-people',   text: "You're following accounts in heritage fashion and the South Asian creator space, that confirms your positioning." },
      { icon: 'i-tag',      text: 'X interest tags: Fashion · Heritage · Sustainability.' },
      { icon: 'i-bookmark', text: "Bookmark patterns on others' posts hint that your audience values context, not just product." },
    ]);
    await scoutMsg(
      "Your account is fresh, so I don't have engagement data yet. I'll lean on your brand context, niche trends, and the signals around your account until we build your own performance history. Honestly, that means we get to set the strategy from scratch. No bad habits to unlearn.",
      { typingFor: 1300, beat: 400 }
    );
    xProfilePreviewEmpty(state.brand);
  } else {
    await narratedProcess('Studying your X profile', [
      { icon: 'i-search',   text: 'Pulling profile data and the last 50 posts.' },
      { icon: 'i-people',   text: `${state.brand.followers} followers. Solid foundation, room to compound.` },
      { icon: 'i-quote',    text: `Bio reads "${state.accountType === 'brand' ? 'heritage, restitched' : 'designer · systems · craft'}". Clean positioning.` },
      { icon: 'i-trend',    text: state.accountType === 'brand'
        ? 'Posts about heritage origin stories outperform product posts by 3.1×.'
        : 'Posts with concrete examples outperform abstract takes by 2.4×.' },
      { icon: 'i-clock',    text: state.accountType === 'brand'
        ? 'Your audience is most active 2 to 4pm Pakistan time.'
        : 'Your audience is most active 9 to 11am PKT and 8 to 10pm PKT.' },
      { icon: 'i-bookmark', text: 'Bookmarks are your strongest signal. People are saving, not just liking.' },
      { icon: 'i-people',   text: state.accountType === 'brand'
        ? 'Following list confirms positioning in the South Asian fashion creator ecosystem.'
        : 'Following list confirms positioning in the design-craft community.' },
    ]);
    await scoutMsg("Got a clear picture. I've got a good read from your X profile. Here's what stands out:", { typingFor: 600, beat: 400 });
    xProfilePreview(buildProfileSummary());
  }
  // Seed Main KB with what we just learned from the scan
  addKBFact('brand', 'Handle',     state.brand.handle);
  addKBFact('brand', 'Followers',  state.brand.followers);
  if (!isNew) {
    addKBFact('brand', 'Best format', state.accountType === 'brand' ? 'Image threads' : 'Threads with screenshots');
    addKBFact('brand', 'Peak activity', state.accountType === 'brand' ? '2–4pm PKT' : '9–11am PKT');
  }
  scrollDown();
  await sleep(800);
  // Reveal KB sections sequentially so the user sees them fill in one by one
  state.kb.kbReveal.add('identity'); renderKB();
  await sleep(500);
  state.kb.kbReveal.add('themes'); renderKB();
  await sleep(400);
  state.kb.kbReveal.add('topics'); renderKB();
  await sleep(400);
  state.kb.kbReveal.add('audience'); renderKB();
  await sleep(300);
  state.kb.kbReveal.add('peak'); renderKB();
}

function buildProfileSummary() {
  // Forward the full demo persona to the preview card. The card knows how to
  // render every field; we simply pass through the data Scout extracted.
  const p = state.brand;
  return {
    displayName: p.displayName || p.name,
    name:        p.name,
    handle:      p.handle,
    bio:         p.bio,
    location:    p.location,
    verified:    p.verified,
    followers:   p.followers,
    following:   p.following,
    postCount:   p.postCount,
    joinDate:    p.joinDate,
    industry:    p.industry || p.niche,
    topTopics:   p.topTopics || [],
    primaryAudience:   p.primaryAudience,
    secondaryAudience: p.secondaryAudience,
    peakActivity:      p.peakActivity,
  };
}

// First drawer open: review what Scout learned from the profile scan + materials.
// Drawer opens, fills sections with writing animation, reveals Accept, waits for
// the user, then closes. Identity/Themes/Products/Top topics/Audience(primary)/
// Peak activity are visible. Tone, goals, refined audience appear in the second
// open later.
async function step_brand_review_first() {
  const isBrand = state.accountType === 'brand';
  await scoutMsg(
    isBrand
      ? "Here's what I've pulled together about your brand. Take a look on the right and accept when it reads right."
      : "Here's what I've pulled together about you. Take a look on the right and accept when it reads right.",
    { typingFor: 1300, beat: 400 }
  );

  addKBFact('brand', 'Niche', state.brand.niche);
  addKBFact('brand', 'Themes', state.brand.themes.join(', '));
  if (isBrand) addKBFact('brand', 'Products', state.brand.products.join(', '));

  // Show action buttons inside the KB card. Loop until user confirms.
  while (true) {
    const action = await new Promise((resolve) => {
      state.kb.actionCallback = (a) => {
        state.kb.actionCallback = null;
        renderKB();
        resolve(a);
      };
      renderKB();
    });

    if (action === 'confirm') {
      userMsg('Looks right');
      break;
    }

    // "Not quite" — ask what's off, enable the composer, wait for their correction.
    userMsg('Not quite');
    await scoutMsg(
      "What needs adjusting? Tell me what's off and I'll update it.",
      { typingFor: 700, beat: 400 }
    );
    await awaitComposer({ placeholder: 'What should I change?' });
    await scoutMsg(
      "Got it, updated. Take another look and let me know if that reads right.",
      { typingFor: 800, beat: 400 }
    );
    // Loop back to show the action buttons again
  }

  // About You is accepted — activate Trending KB
  state.kb.activeId = 'trending';
  renderKB();
}

// ------------------------ Brand / About-you drawer ------------------------
// A right-side panel that lives from the moment Scout starts learning until
// the user explicitly accepts it. Every state mutation (audience, tone,
// goals, product lines) refreshes the drawer; the user can pencil any field.
const drawerState = {
  node: null,
  tab: null,
  acceptResolver: null,
  rendered: new Set(),
  writeQueue: Promise.resolve(),
  minimized: false,
};

function openBrandDrawer() {
  if (drawerState.node) return;
  // Each open is a fresh render — clear which sections have been written.
  drawerState.rendered = new Set();
  const isBrand = state.accountType === 'brand';
  const drawer = el('aside', { class: 'brand-drawer', 'aria-label': isBrand ? 'About your brand' : 'About you' }, [
    el('button', {
      class: 'brand-drawer__minimize',
      'aria-label': 'Minimize',
      onclick: () => setBrandDrawerMinimized(true),
      html: icon('i-collapse'),
    }),
    el('div', { class: 'brand-drawer__head' }, [
      el('h2', { class: 'brand-drawer__title' }, isBrand ? 'About your brand' : 'About you'),
      el('p', { class: 'brand-drawer__sub' }, 'Scout is filling this as she learns.'),
    ]),
    el('div', { class: 'brand-drawer__body' }),
    el('div', { class: 'brand-drawer__foot' }, [
      el('div', { class: 'brand-drawer__foot-actions' }, [
        el('button', {
          class: 'btn-ghost brand-drawer__not-quite',
          type: 'button',
          onclick: () => enterNotQuiteMode(),
        }, 'Not quite'),
        el('button', {
          class: 'btn-primary brand-drawer__accept',
          type: 'button',
          onclick: () => {
            if (drawerState.acceptResolver) {
              const r = drawerState.acceptResolver;
              drawerState.acceptResolver = null;
              closeBrandDrawer();
              r('accept');
            }
          },
        }, 'Accept'),
      ]),
    ]),
  ]);
  // Re-open pill, shown while minimized.
  const tab = el('button', {
    class: 'brand-drawer-tab',
    'aria-label': 'Open ' + (isBrand ? 'brand profile' : 'profile'),
    onclick: () => setBrandDrawerMinimized(false),
  }, [
    el('span', { class: 'brand-drawer-tab__icon', html: icon('i-arrow-right') }),
    el('span', { class: 'brand-drawer-tab__label' }, isBrand ? 'About your brand' : 'About you'),
  ]);
  const backdrop = el('div', { class: 'brand-drawer-backdrop' });
  document.body.appendChild(backdrop);
  document.body.appendChild(drawer);
  document.body.appendChild(tab);
  drawerState.node = drawer;
  drawerState.tab = tab;
  drawerState.backdrop = backdrop;
  drawerState.rendered = new Set();
  drawerState.writeQueue = Promise.resolve();
  drawerState.minimized = false;
  requestAnimationFrame(() => {
    drawer.classList.add('brand-drawer--open');
    backdrop.classList.add('brand-drawer-backdrop--open');
  });
}

function setBrandDrawerMinimized(min) {
  if (!drawerState.node) return;
  drawerState.minimized = min;
  drawerState.node.classList.toggle('brand-drawer--minimized', min);
  drawerState.tab?.classList.toggle('brand-drawer-tab--visible', min);
}

function closeBrandDrawer() {
  if (!drawerState.node) return;
  drawerState.node.classList.remove('brand-drawer--open');
  drawerState.tab?.classList.remove('brand-drawer-tab--visible');
  drawerState.backdrop?.classList.remove('brand-drawer-backdrop--open');
  setTimeout(() => {
    drawerState.node?.remove();
    drawerState.tab?.remove();
    drawerState.backdrop?.remove();
    drawerState.node = null;
    drawerState.tab = null;
    drawerState.backdrop = null;
    drawerState.rendered.clear();
  }, 480);
}

// Compute the ordered list of sections that should exist based on current state.
// Each section emits a unique id, an eyebrow label, and the DOM body (sans eyebrow).
function computeBrandDrawerSections() {
  const isBrand = state.accountType === 'brand';
  const out = [];

  if (state.brand && state.brand.name) {
    out.push({
      id: 'identity',
      eyebrow: 'Identity',
      writeText: state.brand.name,
      build: () => el('div', {}, [
        el('div', { class: 'brand-drawer__name', 'data-write': '1' }),
        el('div', { class: 'brand-drawer__sub-line' }, [
          state.brand.niche || '',
          state.brand.location ? ' · ' + state.brand.location : '',
        ].join('')),
        state.brand.positioning ? el('p', { class: 'brand-drawer__positioning' }, state.brand.positioning) : null,
      ].filter(Boolean)),
    });
  }
  if (state.brand && state.brand.themes && state.brand.themes.length) {
    out.push({
      id: 'themes',
      eyebrow: 'Themes',
      build: () => el('div', { class: 'brand-drawer__pills' },
        state.brand.themes.map(t => el('span', { class: 'brand-drawer__pill' }, t))
      ),
    });
  }
  if (isBrand && state.brand && state.brand.products && state.brand.products.length) {
    out.push({
      id: 'products',
      eyebrow: 'Products',
      build: () => el('ul', { class: 'brand-drawer__list' },
        state.brand.products.map(p => el('li', {}, p))
      ),
    });
  }
  if (!isBrand && state.topics && state.topics.length) {
    out.push({
      id: 'topics',
      eyebrow: 'Topics',
      build: () => el('div', { class: 'brand-drawer__pills' },
        state.topics.map(t => el('span', { class: 'brand-drawer__pill' }, t))
      ),
    });
  }
  if (isBrand && state.productLines && state.productLines.length) {
    out.push({
      id: 'product-lines',
      eyebrow: 'Product lines',
      build: () => el('div', { class: 'brand-drawer__lines' },
        state.productLines.map(line => el('div', { class: 'brand-drawer__line' }, [
          el('div', { class: 'brand-drawer__line-name' }, line.name),
          el('div', { class: 'brand-drawer__line-meta' }, `${line.audience} · ${line.tone}`),
        ]))
      ),
    });
  }
  // Top performing topics — moved here from xProfileStats so the drawer is
  // the single surface for Scout's profile read.
  if (state.brand && state.brand.topTopics && state.brand.topTopics.length) {
    out.push({
      id: 'top-topics',
      eyebrow: 'Top performing topics',
      build: () => el('div', { class: 'brand-drawer__topic-bars' },
        state.brand.topTopics.map(t => el('div', { class: 'brand-drawer__topic-bar' }, [
          el('div', { class: 'brand-drawer__topic-row' }, [
            el('span', { class: 'brand-drawer__topic-name' }, t.name),
            el('span', { class: 'brand-drawer__topic-pct' }, `+${t.engagement}%`),
          ]),
          el('div', { class: 'brand-drawer__topic-track' }, [
            el('div', {
              class: 'brand-drawer__topic-fill',
              style: `width: ${Math.min(100, t.engagement)}%;`,
            }),
          ]),
        ]))
      ),
    });
  }
  // Audience: primary block uses avatar cluster + persona-default. Once the
  // user validates a custom audience via audience_infer, surface that string
  // as a narrated overwrite.
  if (state.brand && (state.brand.primaryAudience || state.audience)) {
    out.push({
      id: 'audience',
      eyebrow: 'Audience',
      writeText: state.audience || state.brand.primaryAudience,
      build: () => el('div', {}, [
        el('div', { class: 'brand-drawer__audience-row' }, [
          el('div', { class: 'brand-drawer__avatar-cluster' }, [
            el('span', { class: 'brand-drawer__avatar' }),
            el('span', { class: 'brand-drawer__avatar' }),
            el('span', { class: 'brand-drawer__avatar' }),
          ]),
          el('p', { class: 'brand-drawer__audience', 'data-write': '1' }),
        ]),
        state.brand?.secondaryAudience ? el('div', { class: 'brand-drawer__secondary' }, state.brand.secondaryAudience) : null,
      ].filter(Boolean)),
    });
  }
  // Tone only surfaces after the user has explicitly picked one (toneSample set).
  if (state.toneSample) {
    out.push({
      id: 'tone',
      eyebrow: 'Tone',
      writeText: state.tone,
      build: () => el('div', {}, [
        el('div', { class: 'brand-drawer__primary', 'data-write': '1' }),
        el('p', { class: 'brand-drawer__sample' }, state.toneSample),
      ]),
    });
  }
  // Peak activity — moved here from xProfileStats.
  if (state.brand && state.brand.peakActivity) {
    out.push({
      id: 'peak-activity',
      eyebrow: 'Peak activity',
      build: () => el('div', {}, [
        el('div', { class: 'brand-drawer__peak-strip' }, [
          el('div', { class: 'brand-drawer__peak-track' }, [
            el('div', { class: 'brand-drawer__peak-highlight' }),
          ]),
          el('div', { class: 'brand-drawer__peak-labels' }, [
            el('span', {}, '12a'), el('span', {}, '6a'), el('span', {}, '12p'), el('span', {}, '6p'), el('span', {}, '12a'),
          ]),
        ]),
        el('div', { class: 'brand-drawer__peak-text' }, state.brand.peakActivity),
      ]),
    });
  }
  if (state.goals && state.goals.length) {
    out.push({
      id: 'goals',
      eyebrow: 'Goals',
      build: () => el('div', { class: 'brand-drawer__goals' },
        state.goals.map(g => el('div', { class: 'brand-drawer__goal' }, g))
      ),
    });
  }
  return out;
}

// Idempotent: only animates new sections. Each new section appends with a
// fade + write animation. Queued so concurrent calls don't interleave.
function refreshBrandDrawer() {
  if (!drawerState.node) return;
  const body = drawerState.node.querySelector('.brand-drawer__body');
  if (!body) return;
  drawerState.writeQueue = drawerState.writeQueue.then(async () => {
    const sections = computeBrandDrawerSections();
    for (const sec of sections) {
      if (drawerState.rendered.has(sec.id)) continue;
      drawerState.rendered.add(sec.id);
      await writeDrawerSection(body, sec);
    }
  }).catch((e) => console.error('brand drawer write error', e));
  return drawerState.writeQueue;
}

async function writeDrawerSection(body, sec) {
  // Build the section shell with an empty value container.
  const valueWrap = sec.build();
  const sectionEl = el('section', { class: 'brand-drawer__section', 'data-drawer-section': sec.id }, [
    el('div', { class: 'brand-drawer__eyebrow' }, sec.eyebrow),
    valueWrap,
  ]);
  body.appendChild(sectionEl);
  // Force a paint, then run the entry animation.
  requestAnimationFrame(() => sectionEl.classList.add('brand-drawer__section--in'));
  await sleep(260);

  // Find write targets (elements marked data-write) and stream the text into them.
  const writeTargets = sectionEl.querySelectorAll('[data-write="1"]');
  if (writeTargets.length && sec.writeText) {
    for (const target of writeTargets) {
      target.classList.add('brand-drawer__writing');
      await typewriterInto(target, sec.writeText, 18);
      target.classList.remove('brand-drawer__writing');
    }
  }
  // Brief settle pause before the next section starts.
  await sleep(220);
}

function revealBrandDrawerAccept() {
  if (!drawerState.node) return;
  drawerState.node.classList.add('brand-drawer--awaiting');
  drawerState.node.classList.remove('brand-drawer--prompting');
}

// "Not quite" path: keep the drawer open and backdrop visible, swap the
// foot's Accept/Not quite buttons for a single-line prompt input. The user
// types feedback; on submit, Scout narrates a brief adjustment and the
// Accept/Not quite buttons return so the user can re-confirm.
function enterNotQuiteMode() {
  if (!drawerState.node) return;
  const foot = drawerState.node.querySelector('.brand-drawer__foot');
  if (!foot) return;
  // Mark state so other parts of the UI know we're in feedback mode.
  drawerState.node.classList.add('brand-drawer--prompting');

  // Replace foot contents with a prompt input.
  foot.innerHTML = '';
  const input = el('input', {
    type: 'text',
    class: 'brand-drawer__prompt-input',
    placeholder: 'Tell Scout what to change…',
    'aria-label': 'Tell Scout what to change',
  });
  const submit = el('button', {
    class: 'btn-primary brand-drawer__prompt-submit',
    type: 'button',
    'aria-label': 'Send',
    html: icon('i-arrow-right'),
  });
  const prompt = el('form', {
    class: 'brand-drawer__prompt',
    onsubmit: (e) => {
      e.preventDefault();
      const text = input.value.trim();
      if (!text) return;
      handleNotQuiteSubmit(text);
    },
  }, [input, submit]);
  foot.appendChild(prompt);
  // Focus the input shortly after mount so the cursor is ready.
  requestAnimationFrame(() => input.focus());
}

async function handleNotQuiteSubmit(promptText) {
  if (!drawerState.node) return;
  const foot = drawerState.node.querySelector('.brand-drawer__foot');
  if (!foot) return;
  // Trade the prompt input for a short "Adjusting…" status while Scout
  // simulates a refresh.
  foot.innerHTML = '';
  foot.appendChild(
    el('div', { class: 'brand-drawer__prompt-status', 'aria-live': 'polite' }, [
      el('span', { class: 'brand-drawer__prompt-status-dot' }),
      document.createTextNode('Adjusting based on your note…'),
    ])
  );
  // Brief pause so the message reads.
  await sleep(1400);
  // Re-render the original Accept/Not quite foot row in place.
  foot.innerHTML = '';
  foot.appendChild(
    el('div', { class: 'brand-drawer__foot-actions' }, [
      el('button', {
        class: 'btn-ghost brand-drawer__not-quite',
        type: 'button',
        onclick: () => enterNotQuiteMode(),
      }, 'Not quite'),
      el('button', {
        class: 'btn-primary brand-drawer__accept',
        type: 'button',
        onclick: () => {
          if (drawerState.acceptResolver) {
            const r = drawerState.acceptResolver;
            drawerState.acceptResolver = null;
            closeBrandDrawer();
            r('accept');
          }
        },
      }, 'Accept'),
    ])
  );
  drawerState.node.classList.remove('brand-drawer--prompting');
}

// Audience is inferred, not asked. Scout proposes a specific audience based on
// brand + X profile + niche scan, with the reasoning that grounds it. User
// validates with a quick-reply.
async function step_audience_infer() {
  const xConnected = !state.skipped.has('x-connect');
  const isBrand = state.accountType === 'brand';

  const lead = xConnected
    ? "Based on everything, your brand, your X data, and what's working in your niche, here's who I'd target:"
    : "Based on your brand and what's working in your niche right now, here's who I'd target:";
  await scoutMsg(lead, { typingFor: 1100, beat: 300 });

  const proposal = state.brand.audienceDefault || state.audience;
  // Insight framing depends on whether we actually have the user's data. When X
  // is connected we can speak to measured numbers; when skipped, present the
  // same patterns honestly as niche-level signals, not as "your" metrics.
  const insight = xConnected
    ? (isBrand
        ? 'They respond best to heritage-explained posts paired with modern visuals. Saves run 3× the niche average on context-rich posts versus pure product shots.'
        : 'They respond best to specific examples over abstract principles. Bookmark rate is 2.4× higher when posts name the tool, the task, and the tradeoff.')
    : (isBrand
        ? "In this niche, heritage-explained posts paired with modern visuals tend to outperform pure product shots. Connect your account later and I'll tune this to your actual numbers."
        : "In this niche, specific examples tend to beat abstract principles. Connect your account later and I'll tune this to your actual numbers.");
  await scoutMsg(proposal, { typingFor: 1000, beat: 300 });
  await scoutMsg(insight, { typingFor: 1300, beat: 400 });

  const verdict = await quickReplies(
    ["That's right", 'Adjust audience', 'Different audience in mind'],
    { primaryIndex: 0 }
  );

  if (verdict.startsWith('Adjust') || verdict.startsWith('Different')) {
    // Loop until the user gives a real audience description, nudging if off-topic.
    let next = '';
    while (true) {
      next = await inlineTextInput({
        placeholder: 'Who are you actually targeting?',
        submitLabel: 'Use this',
        initial: verdict.startsWith('Adjust') ? proposal : '',
      });
      // Off-topic guard: audience description should be specific enough (> 15 chars)
      // and shouldn't look like a non-answer.
      const trimmed = (next || '').trim();
      const looksLikeAudience = trimmed.length >= 15;
      if (looksLikeAudience) break;
      await scoutMsg(
        "Let's keep this focused — who specifically are you writing for? Think about their role, what they care about, and why they'd follow you.",
        { typingFor: 900, beat: 400 }
      );
    }
    state.audience = next || proposal;
    await scoutMsg("Updated. I'll work with that.", { typingFor: 600, beat: 300 });
  } else {
    state.audience = proposal;
    await scoutMsg("Good. That's the lens I'll write into.", { typingFor: 700, beat: 300 });
  }
  addKBFact('brand', 'Audience', state.audience);
  state.kb.kbReveal.add('audience');
  renderKB();
  refreshBrandDrawer();
}

// Tone/voice as its own beat: 3 editable cards, each a sample post in a
// different voice. User can rewrite the sample, then picks the one that
// sounds like them. Selected card sets state.tone (label) and state.toneSample
// (the chosen text).
async function step_tone_voice() {
  const directions = state.brand.toneDirections || [];
  if (!directions.length) return;

  const recommended = directions.find(d => d.recommended);
  const lead = state.accountType === 'brand'
    ? "Based on your brand and the trends I'm tracking, here are three tones that stood out — which one would you prefer?"
    : "Based on you and the trends I'm tracking, here are three tones that stood out — which one would you prefer?";
  await scoutMsg(lead, { typingFor: 1100, beat: 400 });
  if (recommended) {
    await scoutMsg(
      `I'd go with **${recommended.label}** — ${recommended.recommendedReason} The other two are solid if you want a different feel.`,
      { typingFor: 1000, beat: 300 }
    );
  }

  await new Promise((resolve) => {
    const list = el('div', { class: 'tone-list' });
    let activeCard = null;
    let bubble = null;
    let commitTimer = null;

    const commit = (d) => {
      state.tone = d.label;
      state.brand.tone = d.label;
      state.toneSample = d.sample;
      addKBFact('brand', 'Tone', d.label);
      refreshBrandDrawer();
      Array.from(list.children).forEach(c => { c.style.pointerEvents = 'none'; });
      (async () => {
        await scoutMsg("Got it. Calibrating to that voice.", { typingFor: 700, beat: 400 });
        resolve();
      })();
    };

    directions.forEach((d) => {
      const card = el('button', { class: 'tone-card' + (d.recommended ? ' tone-card--recommended' : ''), type: 'button' }, [
        d.recommended ? el('div', { class: 'tone-card__rec-banner' }, 'Recommended') : null,
        el('div', { class: 'tone-card__head' }, [
          el('span', { class: 'tone-card__pill' }, [
            el('span', { class: 'tone-card__pill-icon', html: icon(d.icon || 'i-sparkle') }),
            el('span', { class: 'tone-card__pill-label' }, d.label),
          ]),
        ]),
        el('p', { class: 'tone-card__text' }, d.sample),
        el('span', { class: 'tone-card__pick' }, [
          document.createTextNode('Pick this voice'),
          el('span', { class: 'tone-card__pick-arrow' }, '→'),
        ]),
      ]);

      card.addEventListener('click', () => {
        if (activeCard === card) return;
        activeCard = card;
        Array.from(list.children).forEach((c) => {
          c.classList.toggle('tone-card--active', c === card);
          c.classList.toggle('tone-card--dim', c !== card);
        });
        const label = `Picked: ${d.label}`;
        if (!bubble) bubble = userMsg(label);
        else {
          const t = bubble.querySelector('.msg__bubble');
          if (t) t.textContent = label;
        }
        if (commitTimer) clearTimeout(commitTimer);
        commitTimer = setTimeout(() => commit(d), 1500);
      });
      list.appendChild(card);
    });

    append(list);
  });
}

// Individual-only: capture topics/expertise as the parallel to a brand's
// product lines. Multi-select with custom add — same shape as goals.
async function step_topics_individual() {
  await scoutMsg(
    "Which topics do you actually want to talk about? Pick 3 — keep them tight and related so your content has a clear through-line.",
    { typingFor: 900, beat: 300 }
  );
  const pool = (state.brand.topics && state.brand.topics.length)
    ? state.brand.topics
    : (DEMO_INDIVIDUAL.topics || []);
  state.topics = await selectionChips(pool, { allowCustom: true, customLabel: 'Add your own', maxSelections: 3 });
  refreshBrandDrawer();
  await scoutMsg("Got it. I'll keep an eye on those.", { typingFor: 600, beat: 300 });
  addKBFact('brand', 'Topics', state.topics.join(', '));
}

// stepMaterials — asks for optional extra context after X connect, or required
// context when X was skipped. No auto-submission; the user decides what to share.
async function stepMaterials() {
  const xConnected = !state.skipped.has('x-connect');

  // Returns a promise that resolves with either the typed text or 'skip'
  // whichever happens first — composer input or the skip quick-reply button.
  function awaitInputOrSkip(skipLabel) {
    return new Promise((resolve) => {
      let settled = false;
      const settle = (value) => {
        if (settled) return;
        settled = true;
        // Clean up composer state
        pendingComposerResolver = null;
        setComposerEnabled(false);
        $('#composer-input').placeholder = 'Message Scout…';
        resolve(value);
      };

      // Enable the composer input
      const input = $('#composer-input');
      input.placeholder = 'Paste a link or describe yourself…';
      pendingComposerResolver = (v) => settle(v);
      setComposerEnabled(true);
      requestAnimationFrame(() => input.focus());

      // Also show a skip button
      const wrap = el('div', { class: 'qreplies' });
      const btn = el('button', { class: 'qreply' }, skipLabel);
      btn.addEventListener('click', () => {
        wrap.classList.add('qreplies--chosen');
        btn.disabled = true;
        userMsg(skipLabel);
        settle('skip');
      });
      wrap.appendChild(btn);
      append(wrap);
      scrollDown();
    });
  }

  if (xConnected) {
    // X gave us a solid foundation — extra context is optional.
    await scoutMsg(
      "If you have a website, a portfolio link, or anything else you'd like me to factor in, drop it here — I'll pull from it. Or tap Skip to move on.",
      { typingFor: 1300, beat: 500 }
    );
    const reply = await awaitInputOrSkip('Skip');
    if (reply === 'skip') {
      return;
    }
  } else {
    // X was skipped — we have almost nothing. Make the ask clear but not pressuring.
    await scoutMsg(
      "Without your account data, I'm starting from scratch — which means the content I generate will be generic until I know more about you.",
      { typingFor: 1100, beat: 600 }
    );
    await scoutMsg(
      "Share anything that helps: a website, a portfolio, a short description of what you do and who you write for. Even a few sentences goes a long way. Or if you'd rather skip this too, tap below and we'll keep things general for now.",
      { typingFor: 1500, beat: 500 }
    );
    const reply = await awaitInputOrSkip('Skip for now');
    if (reply === 'skip') {
      await scoutMsg(
        "Got it. You can always drop more context in the chat later — the more I know, the better the output gets.",
        { typingFor: 900, beat: 400 }
      );
      return;
    }
  }

  // User provided something — simulate a website scan with the demo URL.
  userMsg(state.brand.websiteUrl);

  const lines = state.accountType === 'brand' ? [
    { icon: 'i-globe',   text: `Loading ${state.brand.websiteUrl}` },
    { icon: 'i-grid',    text: 'Three product categories live on the site. Sindhi embroidery, Kashmiri shawls, contemporary kurtas.' },
    { icon: 'i-quote',   text: 'Your About page tells a strong founder story. That is reusable content material.' },
    { icon: 'i-sparkle', text: 'Brand messaging emphasizes craftsmanship and ethical sourcing. Both differentiators in this niche.' },
    { icon: 'i-palette', text: 'Pulling color palette and tone of voice from the copy.' },
  ] : [
    { icon: 'i-globe',   text: `Loading ${state.brand.websiteUrl}` },
    { icon: 'i-quote',   text: 'Short bio plus an essays index. Most essays are about design systems and product craft.' },
    { icon: 'i-sparkle', text: 'Voice in the writing reads as direct, specific, non-academic.' },
    { icon: 'i-link',    text: "I see an 'office hours' page. That's a strong CTA you could surface more." },
    { icon: 'i-palette', text: 'Pulling tone of voice signals from the essay openings.' },
  ];

  await narratedProcess('Scanning your site', lines);

  // Reveal KB sections not already unlocked by X scan
  if (!state.kb.kbReveal.has('identity'))  { state.kb.kbReveal.add('identity');  renderKB(); await sleep(500); }
  if (!state.kb.kbReveal.has('themes'))    { state.kb.kbReveal.add('themes');    renderKB(); await sleep(400); }
  if (!state.kb.kbReveal.has('topics'))    { state.kb.kbReveal.add('topics');    renderKB(); await sleep(400); }
  if (!state.kb.kbReveal.has('audience'))  { state.kb.kbReveal.add('audience');  renderKB(); await sleep(300); }
  if (!state.kb.kbReveal.has('peak'))      { state.kb.kbReveal.add('peak');      renderKB(); }

  await scoutMsg("Anything else, or are we good?", { typingFor: 700, beat: 400 });
  await quickReplies(["That's everything", 'Add more later'], { primaryIndex: 0 });

  addKBFact('brand', 'Brand',       state.brand.name);
  addKBFact('brand', 'Positioning', state.brand.positioning);
  addKBFact('brand', 'Themes',      state.brand.themes.join(', '));
  if (state.accountType === 'brand') {
    addKBFact('brand', 'Products',  state.brand.products.join(', '));
  }
}

async function step7_intel_scan() {
  await scoutMsg(
    "Now let me scan what's happening in your niche right now, trends, competitor activity, audience patterns.",
    { typingFor: 1000, beat: 400 }
  );
  const lines = state.accountType === 'brand' ? [
    { icon: 'i-search', text: 'Searching South Asian heritage-fashion conversations on X.' },
    { icon: 'i-fire',   text: '#SouthAsianHeritageWeek is up 4.2× week-on-week.' },
    { icon: 'i-trend',  text: 'Competitor @generation.pk posted a craft-origin reel yesterday. 22k views in 18 hours.' },
    { icon: 'i-people', text: 'Detected 5 active competitors and 12 niche creators worth tracking.' },
    { icon: 'i-clock',  text: 'Peak engagement window for your niche: weekdays 1 to 4pm PKT.' },
    { icon: 'i-sparkle',text: 'Strong rising signal: heritage explainers paired with modern visuals.' },
  ] : [
    { icon: 'i-search', text: 'Searching design-craft and product-design conversations on X.' },
    { icon: 'i-fire',   text: 'AI-tooling debate is the dominant topic this week. High bookmark rate on nuanced takes.' },
    { icon: 'i-trend',  text: 'Competitor @brian_lovin shipped a craft essay. 9k engagements in 24 hours.' },
    { icon: 'i-people', text: 'Detected 4 competitors and 18 niche creators worth tracking.' },
    { icon: 'i-clock',  text: 'Peak engagement window for your niche: weekday mornings PKT (your audience is global).' },
    { icon: 'i-sparkle',text: 'Strong rising signal: specific examples beat abstract principles.' },
  ];
  await narratedProcess('Scanning the niche', lines);
  trendsPreview();

  // Populate Trend KB
  if (state.accountType === 'brand') {
    addKBFact('trending', 'Top trend',     '#SouthAsianHeritageWeek (4.2× w/w)');
    addKBFact('trending', 'Competitors',   '@generation.pk · @khaadiofficial · @sapphirepakistan');
    addKBFact('trending', 'Peak window',   'Weekdays 1–4pm PKT');
  } else {
    addKBFact('trending', 'Top trend',     'AI design tooling debate');
    addKBFact('trending', 'Competitors',   '@brian_lovin · @mds · @rauchg');
    addKBFact('trending', 'Peak window',   'Weekday mornings PKT');
  }
  await sleep(1400);
}

// Merged direction-picker: three full drafts, each grounded in a different
// trend angle and rendered with theme + tone + format chips + drafted body +
// a generated image. User picks one to edit and publish.
async function step_post_directions() {
  const groups = (state.brand.trendGroups || []).slice(0, 3);
  const iterMap = state.brand.postIterations || {};
  if (!groups.length) return;

  // Visual eyebrow that frames the entire first-post moment.
  append(el('div', { class: 'first-post-banner' }, [
    el('span', { class: 'first-post-banner__dot' }),
    document.createTextNode('Your first post'),
  ]));

  await scoutMsg(
    "I've drafted three directions for your first post. Each rides a different angle and bundles a tone, a format, and a visual. Pick the one that sounds like you.",
    { typingFor: 1300, beat: 400 }
  );
  await scoutMsg(
    "I'd lead with Direction 1 — it matches the trend window and fits your voice best. The other two are solid alternatives.",
    { typingFor: 900, beat: 300 }
  );

  // Cinematic narration — Scout drafts the post in the open.
  await narratedProcess('Drafting your first post', [
    { icon: 'i-quote',   text: 'Pulling from your voice and audience signals.' },
    { icon: 'i-trend',   text: 'Cross-checking the live trend window.' },
    { icon: 'i-image',   text: 'Generating a visual for each angle.' },
    { icon: 'i-sparkle', text: 'Stitching everything together.' },
  ], { lineBeat: 800 });

  // Build one direction per trend group, defaulting to its "Personal story"
  // iteration as the leading draft body.
  const directions = groups.map((g) => {
    const its = iterMap[g.id] || [];
    const lead = its[0] || { angle: 'Direction', body: g.summary || '' };
    return { group: g, body: lead.body, angle: lead.angle, iterationId: lead.id };
  });

  return new Promise((resolve) => {
    let currentIndex = 0;
    let bubble = null;
    let commitTimer = null;
    let settled = false;

    const displayName = state.brand.displayName || state.brand.name || 'You';
    const handle      = state.brand.handle      || '@you';
    const isBrand     = state.accountType === 'brand';
    const avatarSrc   = isBrand ? '/ProfileBrand.jpeg' : '/ProfileIndividual.png';

    const commit = (d) => {
      if (settled) return;
      settled = true;
      state.selectedTrendGroupId = d.group.id;
      state.selectedIterationId = d.iterationId;
      state.draftPost = d.body;
      addKBFact('trending', 'Selected angle', d.group.theme);
      carousel.style.pointerEvents = 'none';
      wrapper.classList.add('directions-list--chosen');
      laterRow.remove();
      resolve(d.iterationId);
    };

    // Build cards
    const cards = directions.map((d, i) => {
      const isRec = i === 1;
      const card = el('div', { class: 'direction-card' + (isRec ? ' direction-card--rec' : '') }, [
        isRec ? el('div', { class: 'direction-card__rec-banner' }, 'Recommended') : null,
        el('div', { class: 'direction-card__author' }, [
          el('span', { class: 'direction-card__avatar', style: `background-image: url('${avatarSrc}');` }),
          el('div', { class: 'direction-card__id' }, [
            el('div', { class: 'direction-card__name-row' }, [
              document.createTextNode(displayName),
              el('span', { class: 'direction-card__name-verified', html: icon('i-check') }),
              el('span', { class: 'direction-card__handle' }, handle),
              el('span', { class: 'direction-card__sep' }, '·'),
              el('span', { class: 'direction-card__time' }, 'now'),
            ]),
          ]),
        ]),
        el('div', { class: 'direction-card__body' }, d.body),
        directionImage(d, i),
        el('div', { class: 'direction-card__chips' }, [
          el('span', { class: 'direction-card__chip' }, d.group.tone),
          el('span', { class: 'direction-card__chip' }, d.group.format),
        ]),
        el('div', { class: 'direction-card__actions' }, [
          el('span', { class: 'direction-card__action' }, [el('span', { html: icon('i-reply') }), el('span', { class: 'direction-card__action-n' }, '12')]),
          el('span', { class: 'direction-card__action' }, [el('span', { html: icon('i-repost') }), el('span', { class: 'direction-card__action-n' }, '4')]),
          el('span', { class: 'direction-card__action' }, [el('span', { html: icon('i-heart') }), el('span', { class: 'direction-card__action-n' }, '87')]),
          el('span', { class: 'direction-card__action' }, [el('span', { html: icon('i-trend') }), el('span', { class: 'direction-card__action-n' }, '1.2K')]),
          el('span', { class: 'direction-card__action' }, [el('span', { html: icon('i-bookmark') })]),
          el('span', { class: 'direction-card__action' }, [el('span', { html: icon('i-share') })]),
        ]),
        el('button', { class: 'direction-card__pick', type: 'button', onclick: () => {
          const label = `Picked: ${d.group.theme}`;
          if (!bubble) bubble = userMsg(label);
          else { const t = bubble.querySelector('.msg__bubble'); if (t) t.textContent = label; }
          if (commitTimer) clearTimeout(commitTimer);
          commitTimer = setTimeout(() => commit(d), 800);
        }}, [
          document.createTextNode('Use this direction'),
          el('span', {}, ' →'),
        ]),
      ]);
      return card;
    });

    // Coverflow carousel track
    const track = el('div', { class: 'directions-track' });
    cards.forEach(c => track.appendChild(c));

    // Dots
    const dots = directions.map((_, i) => {
      const dot = el('button', { class: 'dir-dot' + (i === 1 ? ' dir-dot--active' : ''), type: 'button', 'aria-label': `Direction ${i+1}` });
      dot.addEventListener('click', () => goTo(i));
      return dot;
    });
    const dotsRow = el('div', { class: 'dir-dots' }, dots);

    // Nav arrows
    const prevBtn = el('button', { class: 'dir-nav dir-nav--prev', type: 'button', 'aria-label': 'Previous' }, '←');
    const nextBtn = el('button', { class: 'dir-nav dir-nav--next', type: 'button', 'aria-label': 'Next' }, '→');

    const goTo = (idx) => {
      currentIndex = Math.max(0, Math.min(directions.length - 1, idx));
      cards.forEach((card, i) => {
        const offset = i - currentIndex;
        card.classList.remove('dir-card--center', 'dir-card--left', 'dir-card--right', 'dir-card--hidden');
        if (offset === 0) card.classList.add('dir-card--center');
        else if (offset === -1) card.classList.add('dir-card--left');
        else if (offset === 1) card.classList.add('dir-card--right');
        else card.classList.add('dir-card--hidden');
      });
      dots.forEach((d, i) => d.classList.toggle('dir-dot--active', i === currentIndex));
      prevBtn.disabled = currentIndex === 0;
      nextBtn.disabled = currentIndex === directions.length - 1;
      // Sync track height to center card so nothing gets clipped top/bottom
      requestAnimationFrame(() => {
        const centerCard = track.querySelector('.dir-card--center');
        if (centerCard) track.style.minHeight = centerCard.offsetHeight + 'px';
      });
    };

    prevBtn.addEventListener('click', () => goTo(currentIndex - 1));
    nextBtn.addEventListener('click', () => goTo(currentIndex + 1));
    prevBtn.disabled = true;

    const carousel = el('div', { class: 'directions-carousel' }, [prevBtn, track, nextBtn]);
    const wrapper = el('div', { class: 'directions-list' }, [carousel, dotsRow]);

    goTo(1);

    const laterRow = el('div', { class: 'qreplies iteration-list__later' }, [
      el('button', {
        class: 'qreply',
        onclick: () => {
          if (commitTimer) clearTimeout(commitTimer);
          state.skipped.add('first-post');
          userMsg('Save these for later');
          wrapper.style.pointerEvents = 'none';
          laterRow.remove();
          resolve('later');
        },
      }, 'Save these for later'),
    ]);

    append(wrapper);
    append(laterRow);
  });
}

// Mock image generation — uses real post imagery for the demo. Each
// direction maps to a different post visual; the loading shimmer plays
// briefly so the card reads as "Scout just generated this." The image
// set differs by accountType (brand vs individual).
function directionImage(d, i) {
  const isBrand = state.accountType === 'brand';
  const visuals = isBrand
    ? [
        { src: '/PostA.jpeg', tint: 'linear-gradient(135deg, #fde68a 0%, #f59e0b 60%, #b45309 100%)' },
        { src: '/PostB.jpeg', tint: 'linear-gradient(135deg, #c7d2fe 0%, #818cf8 60%, #4f46e5 100%)' },
        { src: '/PostC.jpeg', tint: 'linear-gradient(135deg, #bbf7d0 0%, #34d399 60%, #047857 100%)' },
      ]
    : [
        { src: '/IndividualPostA.jpeg', tint: 'linear-gradient(135deg, #fde68a 0%, #f59e0b 60%, #b45309 100%)' },
        { src: '/IndividualPostB.jpeg', tint: 'linear-gradient(135deg, #c7d2fe 0%, #818cf8 60%, #4f46e5 100%)' },
        { src: '/IndividualPostC.jpeg', tint: 'linear-gradient(135deg, #bbf7d0 0%, #34d399 60%, #047857 100%)' },
      ];
  const v = visuals[i % visuals.length];
  const wrap = el('div', {
    class: 'direction-card__image direction-card__image--loading',
    style: `background-image: url('${v.src}'), ${v.tint}; background-size: cover; background-position: center;`,
  }, [
    el('div', { class: 'direction-card__image-shimmer' }),
  ]);
  // After a short delay, drop the loading shimmer.
  setTimeout(() => wrap.classList.remove('direction-card__image--loading'), 900 + i * 300);
  return wrap;
}

// Edit the chosen draft, then publish (simulated). The draft is loaded straight
// into the chat bar — the user edits in place and publishes from there, rather
// than a separate editor card in the stream.
async function step_edit_publish() {
  await scoutMsg(
    "Edit anything you want right in the bar below. When it's right, hit Publish.",
    { typingFor: 800, beat: 400 }
  );

  await new Promise((resolve) => {
    const pill      = $('.conv__composer .composer-pill');
    const input     = $('#composer-input');
    const sendBtn   = $('#composer-send');
    const attachBtn = pill.querySelector('.composer-pill__attach');

    // Enter publish mode: hide the normal single-line input + send/attach, drop
    // in a growing textarea pre-filled with the draft, a counter, and a labeled
    // Publish button.
    setComposerEnabled(true);
    pill.classList.add('composer-pill--publish');
    input.style.display = 'none';
    sendBtn.style.display = 'none';
    if (attachBtn) attachBtn.style.display = 'none';

    const ta = el('textarea', { class: 'composer-pill__textarea', rows: '1' });
    ta.value = state.draftPost;

    const counter = el('span', { class: 'composer-pill__counter', role: 'status', 'aria-live': 'polite' }, String(state.draftPost.length) + ' / 280');

    const publishBtn = el('button', { class: 'btn-primary composer-pill__publish', 'aria-label': 'Publish post' }, [
      el('span', { class: 'composer-pill__publish-label' }, 'Publish'),
      el('span', { html: icon('i-arrow-right') }),
    ]);

    pill.insertBefore(ta, sendBtn);
    pill.insertBefore(counter, sendBtn);
    pill.insertBefore(publishBtn, sendBtn);

    const autoGrow = () => {
      ta.style.height = 'auto';
      ta.style.height = Math.min(ta.scrollHeight, 200) + 'px';
    };
    // A post is publishable only when it has content and is within the X limit.
    // Reflect that in the counter colour AND the Publish button's enabled state,
    // so the limit isn't merely decorative and empty drafts can't be sent.
    const isValid = () => {
      const len = ta.value.trim().length;
      return len > 0 && ta.value.length <= 280;
    };
    const updateState = () => {
      const len = ta.value.length;
      counter.textContent = `${len} / 280`;
      counter.classList.toggle('composer-pill__counter--warn', len > 260 && len <= 280);
      counter.classList.toggle('composer-pill__counter--over', len > 280);
      const ok = isValid();
      publishBtn.disabled = !ok;
      publishBtn.setAttribute('aria-disabled', String(!ok));
    };

    const restoreComposer = () => {
      ta.remove();
      counter.remove();
      publishBtn.remove();
      pill.classList.remove('composer-pill--publish');
      input.style.display = '';
      sendBtn.style.display = '';
      if (attachBtn) attachBtn.style.display = '';
      setComposerEnabled(false);
    };

    const doPublish = async () => {
      if (!isValid()) return;
      const body = ta.value.trim();
      state.draftPost = body;
      state.publishedPost = { body, postedAt: Date.now() };
      restoreComposer();
      userMsg('Publish');
      await narratedProcess('Publishing to X', [
        { icon: 'i-sparkle', text: 'Formatting your post for X.' },
        { icon: 'i-clock',   text: 'Posting to your account now.' },
        { icon: 'i-check',   text: 'Posted. Tracking starts from here.' },
      ], { lineBeat: 800 });
      renderPublishedPost(body);
      addKBFact('brand', 'First post', body.length > 80 ? body.slice(0, 77) + '…' : body);
      resolve();
    };

    publishBtn.addEventListener('click', doPublish);
    ta.addEventListener('input', () => { autoGrow(); updateState(); });
    // Cmd/Ctrl+Enter publishes; plain Enter inserts a newline (it's a textarea).
    ta.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); doPublish(); }
    });

    updateState();
    requestAnimationFrame(() => {
      autoGrow();
      ta.focus();
      ta.setSelectionRange(ta.value.length, ta.value.length);
    });
  });
}

function renderPublishedPost(body) {
  const isBrand = state.accountType === 'brand';
  const avatarSrc = isBrand ? '/ProfileBrand.jpeg' : '/ProfileIndividual.png';
  const card = el('div', { class: 'success-post success-post--published' }, [
    el('div', { class: 'success-post__head' }, [
      el('div', { class: 'success-post__avatar', style: `background-image: url('${avatarSrc}');` }),
      el('div', { class: 'success-post__id' }, [
        el('div', { class: 'success-post__name-row' }, [
          el('span', { class: 'success-post__name' }, state.brand.displayName || state.brand.name),
          state.brand.verified ? el('span', { class: 'success-post__verified', html: icon('i-check') }) : null,
        ]),
        el('div', { class: 'success-post__handle' }, (state.brand.handle || '') + ' · Just now'),
      ]),
      el('span', { class: 'success-post__badge success-post__badge--live' }, [
        el('span', { class: 'success-post__badge-icon', html: icon('i-check') }),
        document.createTextNode('Live'),
      ]),
    ]),
    el('div', { class: 'success-post__body' }, body),
    el('div', { class: 'success-post__metrics' }, [
      successMetric('i-reply',    '0', 'replies'),
      successMetric('i-repost',   '0', 'reposts'),
      successMetric('i-heart',    '0', 'likes'),
      successMetric('i-bookmark', '0', 'bookmarks'),
    ]),
    el('div', { class: 'success-post__footer' }, "Tracking from here. I'll surface results on the dashboard."),
  ]);
  append(card);
}

// Profile score — return-loop hook. When someone sees the post and considers
// following, they visit the profile. 2-3 seconds to convert them. Specific,
// actionable items the user can fix later.
async function step_profile_score() {
  // Skip the scan if X wasn't connected — nothing to score.
  if (state.skipped.has('x-connect')) return;

  await scoutMsg(
    "One more thing. When someone sees your post and considers following, they visit your profile. It has about three seconds to convert them. Let me score it.",
    { typingFor: 1400, beat: 400 }
  );

  await narratedProcess('Scoring your profile', [
    { icon: 'i-search', text: 'Checking your bio.' },
    { icon: 'i-image',  text: 'Evaluating profile photo and banner.' },
    { icon: 'i-quote',  text: 'Looking at your pinned post.' },
    { icon: 'i-link',   text: 'Checking for a website link and CTA.' },
  ], { lineBeat: 700 });

  const isBrand = state.accountType === 'brand';
  const items = isBrand ? [
    { state: 'ok',   text: 'Profile photo reads clear and on-brand.' },
    { state: 'ok',   text: 'Bio communicates niche in one line.' },
    { state: 'warn', text: 'No CTA in bio. Add a link to shop or newsletter.' },
    { state: 'bad',  text: 'No pinned post. Your strongest piece should sit at the top.' },
    { state: 'ok',   text: 'Website link present.' },
    { state: 'warn', text: 'Banner is generic. A heritage visual would carry your positioning.' },
  ] : [
    { state: 'ok',   text: 'Profile photo reads clear.' },
    { state: 'ok',   text: 'Bio names the role and the audience.' },
    { state: 'warn', text: 'No CTA in bio. Your office-hours page deserves a line.' },
    { state: 'bad',  text: 'Pinned post is from four months ago. Swap in a recent essay.' },
    { state: 'ok',   text: 'Website link present.' },
    { state: 'warn', text: 'Banner is generic. A craft visual would carry your positioning.' },
  ];

  const pct = Math.round(items.filter(i => i.state === 'ok').length / items.length * 100);
  state.profileScore = pct;

  await new Promise((resolve) => {
    const card = el('div', { class: 'profile-score' }, [
      el('div', { class: 'profile-score__head' }, [
        el('div', { class: 'profile-score__head-left' }, [
          document.createTextNode('Profile score'),
        ]),
        el('span', { class: 'profile-score__pct' }, pct + '%'),
      ]),
      el('div', { class: 'profile-score__bar' }, [
        el('div', { class: 'profile-score__bar-fill', style: `width: ${pct}%;` }),
      ]),
      el('ul', { class: 'profile-score__list' },
        items.map(i => {
          const iconId = i.state === 'ok' ? 'i-check' : i.state === 'warn' ? 'i-warn' : 'i-x-mark';
          return el('li', { class: 'profile-score__item profile-score__item--' + i.state }, [
            el('span', { class: 'profile-score__item-icon', html: icon(iconId) }),
            el('span', { class: 'profile-score__item-text' }, i.text),
          ]);
        }),
      ),
      el('div', { class: 'conf__actions' }, [
        el('button', {
          class: 'btn-ghost',
          onclick: () => { card.remove(); userMsg("Fix these later"); resolve('later'); },
        }, "Fix these later"),
        el('button', {
          class: 'btn-primary',
          onclick: () => { card.remove(); userMsg('Show me how'); resolve('how'); },
        }, 'Show me how'),
      ]),
    ]);
    append(card);
  });

  await scoutMsg(
    "I'll keep these in your dashboard. Each one becomes a quick win when you have a few minutes.",
    { typingFor: 1000, beat: 400 }
  );
}

// "Building your infrastructure" — the theatrical payoff. Five lines, each
// representing real setup work, narrated with checkmarks. The KB widget is
// already populated; this is the moment Scout names what was built.
async function step_infrastructure_build() {
  await scoutMsg(
    "You've given me everything I need. Let me set up your marketing infrastructure.",
    { typingFor: 1100, beat: 400 }
  );

  await narratedProcess('Building your marketing infrastructure', [
    { icon: 'i-check', text: 'Brand knowledge base. Locked.' },
    { icon: 'i-check', text: "X algorithm rules and content guardrails. Loaded." },
    { icon: 'i-check', text: 'Trend monitoring for your niche. Active.' },
    { icon: 'i-check', text: 'Optimal posting windows for your audience. Calibrated.' },
    { icon: 'i-check', text: 'Content strategy. Configured.' },
  ], { lineBeat: 900 });
}

async function step13_handoff() {
  if (state.publishedPost) {
    await scoutMsg(`Your post is live, ${state.user.name.split(' ')[0]}. I'll track performance and surface what's working.`, { typingFor: 1000, beat: 500 });
  } else {
    await scoutMsg(`Everything's set up, ${state.user.name.split(' ')[0]}. Your drafts and trends are waiting whenever you're ready.`, { typingFor: 1000, beat: 500 });
  }

  await sleep(400);

  // In-chat dashboard CTA
  await new Promise((resolve) => {
    const btn = el('button', {
      class: 'qreply qreply--primary',
      onclick: () => {
        userMsg('Go to Dashboard');
        btn.parentElement && btn.parentElement.remove();
        resolve();
      },
    }, 'Go to Dashboard →');
    const row = el('div', { class: 'qreplies' }, [btn]);
    append(row);
  });

  enterApp();
}

function enterApp() {
  document.body.classList.remove('mode-onboarding');
  document.body.classList.add('mode-app');
  setCrumbs(['Home']);

  // Reflect the captured name in the profile chip, no name = no chip name
  const chipName = $('.profile-chip__name');
  if (chipName) chipName.textContent = state.user.name || 'Guest';

  // Update session to record the user reached the dashboard
  try { sessionStorage.setItem('fs_session', JSON.stringify({ name: state.user.name || 'Guest', accountType: state.accountType || 'individual', view: 'dash' })); } catch (e) {}

  renderHome();
  showView('view-home');
}

/* =========================================================================
   15. CONVERSATION ROUTER
   ========================================================================= */
async function runConversation() {
  if (stream.dataset.started === '1') return;
  stream.dataset.started = '1';

  const skip = (n) => _resumeFrom >= n; // true = this step is already done

  // Act 1 — Greet and connect.
  _currentStep = 0;
  if (!skip(0)) { await step1_opening(); saveCheckpoint(0); }

  _currentStep = 1;
  if (!skip(1)) {
    const xPath = await step5_x_connect();
    if (xPath === 'connected-scan') await step6_profile_scan();
    saveCheckpoint(1);
  }

  // Act 2 — Materials, then the first drawer review (Scout's read of the brand).
  _currentStep = 2;
  if (!skip(2)) { await stepMaterials(); saveCheckpoint(2); }
  _currentStep = 3;
  if (!skip(3)) { await step_brand_review_first(); saveCheckpoint(3); }

  // Act 3 — Topics/products + goals.
  _currentStep = 4;
  if (!skip(4)) {
    if (state.accountType === 'brand') await step3_product_lines_brand_only();
    else                               await step_topics_individual();
    saveCheckpoint(4);
  }
  _currentStep = 5;
  if (!skip(5)) { await step4_goals(); saveCheckpoint(5); }

  // Act 4 — Market scan, audience inference.
  _currentStep = 6;
  if (!skip(6)) { await step7_intel_scan(); saveCheckpoint(6); }
  _currentStep = 7;
  if (!skip(7)) { await step_audience_infer(); saveCheckpoint(7); }

  // Tone
  _currentStep = 8;
  if (!skip(8)) { await step_tone_voice(); saveCheckpoint(8); }

  // Act 5 — Merged directions → drafts → publish (or save for later).
  _currentStep = 9;
  const iterChoice = await step_post_directions();
  if (iterChoice === 'later') {
    await scoutMsg(
      "Saved. The drafts will be waiting on your dashboard when you're ready.",
      { typingFor: 800, beat: 400 }
    );
  } else {
    await step_edit_publish();
  }

  // Act 6 — Infrastructure build → handoff.
  await step_infrastructure_build();
  await step13_handoff();
}

/* =========================================================================
   17. DEMO CONTROLS
   ========================================================================= */
function bindDemoControls() {
  $('#ctl-restart').addEventListener('click', () => {
    const active = document.querySelector('.view--active');
    const id = active ? active.id : '';
    if (id === 'view-dash') {
      showView('view-conv');
    } else if (id === 'view-conv') {
      showView('view-auth');
    } else if (id === 'view-auth') {
      showView('view-splash');
    }
  });

  // Restart conversation — clears checkpoint but keeps user logged in
  const btnRestart = $('#btn-restart-conv');
  if (btnRestart) {
    btnRestart.addEventListener('click', () => {
      try { sessionStorage.removeItem(CHECKPOINT_KEY); } catch (e) {}
      try {
        const s = JSON.parse(sessionStorage.getItem('fs_session') || '{}');
        delete s.accountType;
        sessionStorage.setItem('fs_session', JSON.stringify(s));
      } catch (e) {}
      location.reload();
    });
  }

  // Logout — clears all session data and goes back to auth
  const btnLogout = $('#btn-logout');
  if (btnLogout) {
    btnLogout.addEventListener('click', () => {
      try { sessionStorage.removeItem('fs_session'); } catch (e) {}
      try { sessionStorage.removeItem(CHECKPOINT_KEY); } catch (e) {}
      location.reload();
    });
  }
  $('#ctl-skip').addEventListener('click', () => {
    stream.dataset.started = '1';
    enterApp();
  });

  $('#composer-send').addEventListener('click', () => {
    const v = $('#composer-input').value.trim();
    if (!v) return;
    $('#composer-input').value = '';
    if (pendingComposerResolver) {
      const resolve = pendingComposerResolver;
      pendingComposerResolver = null;
      $('#composer-input').placeholder = 'Message Scout…';
      setComposerEnabled(false);
      resolve(v);
    } else {
      userMsg(v);
    }
  });
  $('#composer-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); $('#composer-send').click(); }
  });

  // Toggle X account maturity for demo (hidden control via keyboard)
  document.addEventListener('keydown', (e) => {
    if (e.key === 'n' && e.shiftKey && e.metaKey) {
      state.xAccountMaturity = state.xAccountMaturity === 'new' ? 'established' : 'new';
      console.log('X account maturity →', state.xAccountMaturity);
    }
  });

  // Analytics sidebar button
  const analyticsBtn = document.querySelector('.sidebar__btn[data-nav="analytics"]');
  if (analyticsBtn) {
    analyticsBtn.addEventListener('click', () => {
      renderDashboard();
      initDashScout();
      showView('view-dash');
      setCrumbs(['Dashboard']);
    });
  }
  // Home sidebar button
  const homeNavBtn = document.querySelector('.sidebar__btn[data-nav="home"]');
  if (homeNavBtn) {
    homeNavBtn.addEventListener('click', () => {
      renderHome();
      showView('view-home');
      setCrumbs(['Home']);
    });
  }
}

/* =========================================================================
   17b. PRE-CONVERSATION SPLASH (3 screens)
   Names the pain → shows the knowledge → shows the outcome.
   ========================================================================= */
const SPLASH_FLAG_KEY = 'flagstaff_seen_splash';
const CHECKPOINT_KEY  = 'fs_checkpoint';
const splashState = { index: 0, dismissed: false };

// Index of the last completed step; -1 means fresh start.
// Set by boot() when restoring a checkpoint.
let _resumeFrom = -1;

// Tracks which runConversation step block is currently executing (updated before each step).
let _currentStep = -1;

// Pre-answer queue: when non-empty, quickReplies auto-picks the first item.
const _preAnswers = [];

function saveCheckpoint(step) {
  try {
    const streamEl = document.querySelector('#stream');
    const body = streamEl?.closest('.conv') || streamEl?.parentElement;
    sessionStorage.setItem(CHECKPOINT_KEY, JSON.stringify({
      step,
      html: streamEl ? streamEl.innerHTML : '',
      scrollTop: body ? body.scrollTop : 0,
      bodyClasses: [...document.body.classList],
      state: {
        accountType: state.accountType,
        user: { name: state.user?.name },
        topics: state.topics,
        goals: state.goals,
        audience: state.audience,
        tone: state.tone,
        kb: {
          activeId: state.kb?.activeId,
          kbReveal: state.kb?.kbReveal ? [...state.kb.kbReveal] : [],
        },
      },
    }));
  } catch (e) {}
}

async function runSplash() {
  const leftStage  = $('#splash-left-stage');
  const rightStage = $('#splash-right-stage');
  const dots = $$('.splash__dot');
  const skipBtn = $('#splash-skip');
  const ctaBtn  = $('#splash-cta');
  const ctaLabel = $('#splash-cta-label');
  const backBtn = $('#splash-back');
  if (!leftStage || !rightStage) return endSplash();

  const CTA_LABELS = ['Next', 'Next', "Let's craft your first post"];

  let activeLeft = null;
  let activeRight = null;
  let inflight = false;

  const mount = async (idx) => {
    if (inflight) return;
    inflight = true;

    // Crossfade — fade out current content in place, swap, fade in new content.
    if (activeLeft)  activeLeft.classList.add('splash__pane--out');
    if (activeRight) activeRight.classList.add('splash__pane--out');
    await sleep(activeLeft || activeRight ? 220 : 0);
    if (activeLeft)  activeLeft.remove();
    if (activeRight) activeRight.remove();

    const nextLeft  = buildSplashLeft(idx);
    const nextRight = buildSplashRight(idx);
    leftStage.appendChild(nextLeft);
    rightStage.appendChild(nextRight);
    activeLeft = nextLeft;
    activeRight = nextRight;

    // Force a reflow so the "in" transition plays from the initial state.
    void nextLeft.offsetHeight;
    nextLeft.classList.add('splash__pane--in');
    nextRight.classList.add('splash__pane--in');

    dots.forEach((d, i) => d.classList.toggle('splash__dot--active', i === idx));
    if (ctaLabel) ctaLabel.textContent = CTA_LABELS[idx];
    if (ctaBtn) ctaBtn.classList.toggle('splash__cta--final', idx === 2);
    if (backBtn) backBtn.classList.toggle('splash__back--visible', idx > 0);
    splashState.index = idx;

    requestAnimationFrame(() => playSplashScreen(idx, nextRight));
    inflight = false;
  };

  const advance = () => {
    if (splashState.index < 2) mount(splashState.index + 1);
    else endSplash();
  };
  const back = () => {
    if (splashState.index > 0) mount(splashState.index - 1);
  };

  if (skipBtn) skipBtn.addEventListener('click', showAuth);
  if (ctaBtn)  ctaBtn.addEventListener('click', advance);
  if (backBtn) backBtn.addEventListener('click', back);

  mount(0);
}

function showAuth() {
  splashState.dismissed = true;
  try { localStorage.setItem(SPLASH_FLAG_KEY, '1'); } catch (e) {}
  // Hide profile chip in header until auth completes
  const profileChip = document.querySelector('.profile-chip');
  if (profileChip) profileChip.style.visibility = 'hidden';
  const view = $('#view-splash');
  if (view) {
    view.classList.add('view--exiting');
    setTimeout(() => {
      showView('view-auth');
      const authView = $('#view-auth');
      if (authView) {
        authView.classList.add('view--entering');
        requestAnimationFrame(() => authView.classList.add('view--entered'));
      }
      initAuth();
    }, 460);
  } else {
    showView('view-auth');
    initAuth();
  }
}

function endSplash() {
  showAuth();
}

function initAuth() {
  let isLogin = true;

  const titleEl       = $('#auth-title');
  const subEl         = $('#auth-sub');
  const submitLbl     = $('#auth-submit-label');
  const toggleBtn     = $('#auth-toggle');
  const toggleTxt     = $('#auth-toggle-text');
  const submitBtn     = $('#auth-submit');
  const emailInput    = $('#auth-email');
  const passInput     = $('#auth-password');
  const emailWrap     = $('#auth-email-wrap');
  const passWrap      = $('#auth-password-wrap');
  const emailErr      = $('#auth-email-error');
  const passErr       = $('#auth-password-error');
  const eyeBtn        = $('#auth-eye');
  const eyeIcon       = $('#auth-eye-icon');
  const forgotBtn     = $('#auth-forgot');
  const termsEl       = $('#auth-terms');
  const nameRow       = $('#auth-name-row');
  const firstInput    = $('#auth-firstname');
  const lastInput     = $('#auth-lastname');
  const firstWrap     = $('#auth-firstname-wrap');
  const lastWrap      = $('#auth-lastname-wrap');
  const firstErr      = $('#auth-firstname-error');
  const lastErr       = $('#auth-lastname-error');

  function updateMode() {
    const hintEl = $('#auth-password-hint');
    if (isLogin) {
      titleEl.textContent        = 'Welcome back';
      if (subEl) subEl.textContent = 'Log in to continue with Scout.';
      submitLbl.textContent      = 'Log in';
      toggleTxt.textContent      = "Don't have an account?";
      toggleBtn.textContent      = 'Sign up';
      passInput.placeholder      = '••••••••';
      if (forgotBtn) forgotBtn.style.display = 'inline';
      if (termsEl)   termsEl.style.display   = 'none';
      if (nameRow)   nameRow.style.display   = 'none';
      if (hintEl)    hintEl.style.display    = 'none';
    } else {
      titleEl.textContent        = 'Create your account';
      if (subEl) subEl.textContent = 'Start building content that sounds like you.';
      submitLbl.textContent      = 'Continue';
      toggleTxt.textContent      = 'Already have an account?';
      toggleBtn.textContent      = 'Log in';
      passInput.placeholder      = '••••••••';
      if (forgotBtn) forgotBtn.style.display = 'none';
      if (termsEl)   termsEl.style.display   = '';
      if (nameRow)   nameRow.style.display   = '';
      if (hintEl)    hintEl.style.display    = 'none';
    }
    clearErrors();
  }

  function clearErrors() {
    [emailWrap, passWrap, firstWrap, lastWrap].forEach(w => w?.classList.remove('auth-field__wrap--error'));
    [emailErr, passErr, firstErr, lastErr].forEach(e => { if (e) e.textContent = ''; });
  }

  function showError(wrap, errEl, msg) {
    wrap?.classList.add('auth-field__wrap--error');
    wrap?.classList.add('auth-field__wrap--shake');
    setTimeout(() => wrap?.classList.remove('auth-field__wrap--shake'), 400);
    if (errEl) errEl.textContent = msg;
  }

  function validate() {
    let valid = true;
    clearErrors();
    if (!isLogin) {
      if (!firstInput?.value.trim()) { showError(firstWrap, firstErr, 'First name is required.'); valid = false; }
      if (!lastInput?.value.trim())  { showError(lastWrap,  lastErr,  'Last name is required.');  valid = false; }
    }
    const email = emailInput?.value.trim();
    const pass  = passInput?.value;
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      showError(emailWrap, emailErr, 'Enter a valid email address.');
      valid = false;
    }
    if (!pass || pass.length < 1) {
      showError(passWrap, passErr, 'Password is required.');
      valid = false;
    }
    return valid;
  }

  // Forgot password
  if (forgotBtn) forgotBtn.addEventListener('click', () => {
    const email = emailInput?.value.trim();
    const msg = email
      ? `A reset link will be sent to ${email}.`
      : 'Enter your email above, then click Forgot password.';
    if (passErr) { passErr.style.color = 'var(--primary)'; passErr.textContent = msg; }
    setTimeout(() => { if (passErr) { passErr.style.color = ''; passErr.textContent = ''; } }, 3500);
  });

  // Show/hide password toggle
  if (eyeBtn) eyeBtn.addEventListener('click', () => {
    const isHidden = passInput.type === 'password';
    passInput.type = isHidden ? 'text' : 'password';
    eyeIcon.innerHTML = isHidden
      ? '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/>'
      : '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>';
  });

  if (toggleBtn) toggleBtn.addEventListener('click', () => {
    const card = document.querySelector('.auth-card');
    if (!card) { isLogin = !isLogin; submitBtn.disabled = false; updateMode(); return; }

    // Exit
    card.classList.remove('auth-card--entering');
    card.classList.add('auth-card--exiting');

    setTimeout(() => {
      // Swap content
      isLogin = !isLogin;
      submitBtn.disabled = false;
      updateMode();

      // Enter
      card.classList.remove('auth-card--exiting');
      card.classList.add('auth-card--entering');

      // Clean up after animation completes
      setTimeout(() => card.classList.remove('auth-card--entering'), 500);
    }, 220);
  });

  // Google auth — UI only, not yet implemented

  function proceedToConversation() {
    submitBtn.disabled = true;
    submitLbl.textContent = isLogin ? 'Logging in…' : 'Creating account…';
    // Restore and update profile chip with real name
    const profileChip = document.querySelector('.profile-chip');
    const profileName = document.querySelector('.profile-chip__name');
    if (profileName) profileName.textContent = state.user.name.split(' ')[0];
    if (profileChip) profileChip.style.visibility = '';
    // Persist session so reload skips splash + auth
    try { sessionStorage.setItem('fs_session', JSON.stringify({ name: state.user.name, view: 'conv', accountType: state.accountType || null })); } catch (e) {}
    const authView = $('#view-auth');
    setTimeout(() => {
      if (authView) {
        authView.classList.add('view--exiting');
        setTimeout(() => {
          showView('view-conv');
          const convView = $('#view-conv');
          if (convView) {
            convView.classList.add('view--entering');
            requestAnimationFrame(() => convView.classList.add('view--entered'));
          }
          runConversation();
        }, 460);
      } else {
        showView('view-conv');
        runConversation();
      }
    }, 600);
  }

  function submit() {
    if (!validate()) return;
    if (isLogin) {
      // Login: derive name from email
      const email = emailInput.value.trim();
      const localPart = email.split('@')[0].replace(/[._\-+]/g, ' ');
      state.user.name = localPart.split(' ')
        .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
        .join(' ');
    } else {
      // Sign up: use actual first + last name
      const first = firstInput.value.trim();
      const last  = lastInput.value.trim();
      state.user.name = `${first} ${last}`.trim();
    }
    proceedToConversation();
  }

  if (submitBtn) submitBtn.addEventListener('click', submit);

  // Enter key submits
  [emailInput, passInput].forEach(inp => {
    if (inp) inp.addEventListener('keydown', e => { if (e.key === 'Enter') submit(); });
  });

  // Clear error on input
  if (emailInput) emailInput.addEventListener('input', () => {
    emailWrap?.classList.remove('auth-field__wrap--error');
    if (emailErr) emailErr.textContent = '';
  });
  if (passInput) passInput.addEventListener('input', () => {
    passWrap?.classList.remove('auth-field__wrap--error');
    if (passErr) passErr.textContent = '';
  });

  updateMode();
}

function buildSplashLeft(idx) {
  // UX-copy direction for the splash:
  // 1. Open with a sharper promise that names the alternative (templated AI).
  // 2. Show the work: a knowledge base built from the user, not stock data.
  // 3. End on outcome: the metrics that actually matter for creators.
  const titles = [
    'Posts that sound like you. Not like everyone else on the internet.',
    'A knowledge base, built from you.',
    'Numbers that matter. Not just impressions.',
  ];
  const bodies = [
    "Scout is your AI marketing partner. It learns your voice, your audience, and the trends moving your niche right now, then drafts the posts only you could write.",
    "Your brand. Your audience. Your voice. Your numbers. Scout assembles all of it into one living knowledge base, refreshed every time you sit down to post.",
    "Scout finds what's working for your niche and doubles down. Growth, saves, share of voice, replies that turn into customers, all tracked from day one.",
  ];
  return el('div', { class: 'splash__pane splash__copy' }, [
    el('h1', { class: 'splash__copy-title' }, titles[idx]),
    el('p', { class: 'splash__copy-body' }, bodies[idx]),
  ]);
}

function buildSplashRight(idx) {
  const pane = el('div', { class: 'splash__pane splash__pane--right' });
  if (idx === 0)      pane.appendChild(buildSplashScreen1Right());
  else if (idx === 1) pane.appendChild(buildSplashScreen2Right());
  else                pane.appendChild(buildSplashScreen3Right());
  return pane;
}


/* ---- Screen 1: Noise vs polished post ---- */

function buildSplashScreen1Right() {
  // Rotating post wheel: nine substantial post cards arranged in a circle
  // whose centre sits below the visible mask. Each card carries a real
  // post caption + image so the wheel reads as a feed of work, not just
  // skeleton placeholders. Hearts drift up occasionally from random posts.
  const POSTS = [
    { ext: 'jpeg', caption: "Feeling indecisive? Pick the everything bagel." },
    { ext: 'png',  caption: 'You deserve a treat. Iced oat lattes are back.' },
    { ext: 'png',  caption: 'Coucou. The lemon macaron is back this week.' },
    { ext: 'png',  caption: "If your design doesn't tell a story, who will listen?" },
    { ext: 'png',  caption: 'Warm breakfast is one bite away.' },
    { ext: 'png',  caption: 'Baith jaao. The chair we all grew up around.' },
    { ext: 'png',  caption: 'New Molts. Classic malt, roasted hops.' },
    { ext: 'png',  caption: 'Trail logged. Inbox can wait.' },
    { ext: 'jpeg', caption: "Warning: so good you can't see straight." },
  ];
  const N = POSTS.length;
  const tiles = POSTS.map((p, i) => {
    const angle = (i / N) * 360;
    const imgSrc = `/Posts/${i + 1}.${p.ext}`;
    return el('div', {
      class: 'splash-wheel__tile',
      'data-tile-idx': String(i),
      style: `--angle: ${angle}deg;`,
    }, [
      el('div', {
        class: 'splash-wheel__tile-inner',
        style: `--init-r: ${-angle}deg;`,
      }, [
        buildPostSkeleton(imgSrc, p.caption),
      ]),
    ]);
  });

  const heartLayer = el('div', { class: 'splash-wheel-hearts', id: 'splash-wheel-hearts', 'aria-hidden': 'true' });

  return el('div', { class: 'splash__block splash-wheel-block' }, [
    el('div', { class: 'splash-wheel-mask' }, [
      el('div', { class: 'splash-wheel' }, tiles),
      heartLayer,
    ]),
  ]);
}

// Skeleton-style post card with a real caption + image. Mirrors the visual
// vocabulary of /Skeleton.svg: avatar dot + name bar + caption text + media
// + metric bars.
function buildPostSkeleton(imgSrc, caption) {
  return el('div', { class: 'post-skeleton' }, [
    el('div', { class: 'post-skeleton__head' }, [
      el('div', { class: 'post-skeleton__avatar' }),
      el('div', { class: 'post-skeleton__id' }, [
        el('div', { class: 'post-skeleton__bar post-skeleton__bar--name' }),
        el('div', { class: 'post-skeleton__bar post-skeleton__bar--handle' }),
      ]),
    ]),
    caption
      ? el('div', { class: 'post-skeleton__caption' }, caption)
      : el('div', { class: 'post-skeleton__text' }, [
          el('div', { class: 'post-skeleton__bar post-skeleton__bar--line' }),
          el('div', { class: 'post-skeleton__bar post-skeleton__bar--line post-skeleton__bar--line-short' }),
        ]),
    el('div', { class: 'post-skeleton__media', style: `background-image: url('${imgSrc}');` }),
    el('div', { class: 'post-skeleton__metrics' }, [
      el('div', { class: 'post-skeleton__metric' }),
      el('div', { class: 'post-skeleton__metric' }),
      el('div', { class: 'post-skeleton__metric' }),
      el('div', { class: 'post-skeleton__metric' }),
    ]),
  ]);
}

/* ---- Screen 2: Knowledge drawer ----
   The same side-drawer the user opens during the conversation (brand-drawer).
   Scout's mark sits at the top-left of the section; the drawer takes the
   rest. Content alternates between Brand and Trending — same look as the
   in-conversation drawer, with sections filling in sequentially. */
function buildSplashScreen2Right() {
  const scoutAvatarSvg = `
    <svg viewBox="0 0 32 32" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
      <circle cx="8"  cy="8"  r="6" class="scout-loader__c scout-loader__c--1"/>
      <circle cx="8"  cy="24" r="6" class="scout-loader__c scout-loader__c--2"/>
      <circle cx="24" cy="24" r="6" class="scout-loader__c scout-loader__c--3"/>
      <circle cx="24" cy="8"  r="6" class="scout-loader__c scout-loader__c--4"/>
    </svg>
  `;
  const scoutAvatar = parseSvg(scoutAvatarSvg);

  return el('div', { class: 'splash__block splash2-block' }, [
    el('div', { class: 'splash2-canvas', 'aria-hidden': 'true' }, [
      el('div', { class: 'splash2-canvas__halo' }),
    ]),

    el('div', {
      class: 'splash2-mark msg__avatar--scout msg__avatar--loading',
      id: 'splash2-scout-avatar',
    }, [scoutAvatar]),

    // Drawer container — same vocabulary as the in-conversation brand-drawer.
    el('div', { class: 'splash2-drawer', id: 'splash2-drawer' }),
  ]);
}

// Splash 2 drawer content — exact same shape as the in-conversation
// brand-drawer. Each section is a {eyebrow, build()} pair so we can reveal
// them sequentially. Brand and Trending are two variants of the same panel.
function splash2BrandSections() {
  return [
    {
      eyebrow: 'Identity',
      build: () => el('div', {}, [
        el('div', { class: 'brand-drawer__name' }, 'rasa'),
        el('div', { class: 'brand-drawer__sub-line' }, 'Heritage Fashion · Karachi, Pakistan'),
        el('p', { class: 'brand-drawer__positioning' }, 'Modern Gen Z take on traditional Pakistani crafts.'),
      ]),
    },
    {
      eyebrow: 'Themes',
      build: () => el('div', { class: 'brand-drawer__pills' }, [
        el('span', { class: 'brand-drawer__pill' }, 'Heritage'),
        el('span', { class: 'brand-drawer__pill' }, 'Sustainability'),
        el('span', { class: 'brand-drawer__pill' }, 'Local artisanship'),
      ]),
    },
    {
      eyebrow: 'Top performing topics',
      build: () => el('div', { class: 'brand-drawer__topic-bars' }, [
        topicBarEl('Heritage origin stories', 92),
        topicBarEl('Behind-the-scenes artisan', 67),
        topicBarEl('Styling guides', 45),
      ]),
    },
    {
      eyebrow: 'Audience',
      build: () => el('div', {}, [
        el('div', { class: 'brand-drawer__audience-row' }, [
          el('div', { class: 'brand-drawer__avatar-cluster' }, [
            el('span', { class: 'brand-drawer__avatar' }),
            el('span', { class: 'brand-drawer__avatar' }),
            el('span', { class: 'brand-drawer__avatar' }),
          ]),
          el('p', { class: 'brand-drawer__audience' }, 'Women 22–34 in Pakistan, the UAE, and the Pakistani diaspora, culturally curious, mobile-first, value heritage with a modern eye.'),
        ]),
        el('div', { class: 'brand-drawer__secondary' }, 'Mothers and gift buyers · 35–50'),
      ]),
    },
    {
      eyebrow: 'Peak activity',
      build: () => el('div', {}, [
        el('div', { class: 'brand-drawer__peak-strip' }, [
          el('div', { class: 'brand-drawer__peak-track' }, [
            el('div', { class: 'brand-drawer__peak-highlight' }),
          ]),
          el('div', { class: 'brand-drawer__peak-labels' }, [
            el('span', {}, '12a'), el('span', {}, '6a'), el('span', {}, '12p'), el('span', {}, '6p'), el('span', {}, '12a'),
          ]),
        ]),
        el('div', { class: 'brand-drawer__peak-text' }, 'Weekdays 2–4pm PKT'),
      ]),
    },
  ];
}

function splash2TrendingSections() {
  return [
    {
      eyebrow: 'Top topic',
      build: () => el('div', {}, [
        el('div', { class: 'brand-drawer__name' }, 'Heritage origin stories'),
        el('div', { class: 'brand-drawer__sub-line' }, '+92% engagement vs. niche average'),
      ]),
    },
    {
      eyebrow: 'Top trend',
      build: () => el('div', {}, [
        el('div', { class: 'brand-drawer__name' }, '#SouthAsianHeritageWeek'),
        el('div', { class: 'brand-drawer__sub-line' }, '+4.2× week-on-week · spiking now'),
      ]),
    },
    {
      eyebrow: 'What audiences save',
      build: () => el('div', { class: 'brand-drawer__topic-bars' }, [
        topicBarEl('Founder transparency', 88),
        topicBarEl('Workshop reels', 73),
        topicBarEl('Process breakdowns', 54),
      ]),
    },
    {
      eyebrow: 'Best format',
      build: () => el('div', { class: 'brand-drawer__pills' }, [
        el('span', { class: 'brand-drawer__pill' }, 'Image + caption'),
        el('span', { class: 'brand-drawer__pill' }, 'Names the artisan'),
        el('span', { class: 'brand-drawer__pill' }, '< 240 chars'),
      ]),
    },
    {
      eyebrow: 'Peak window',
      build: () => el('div', {}, [
        el('div', { class: 'brand-drawer__peak-strip' }, [
          el('div', { class: 'brand-drawer__peak-track' }, [
            el('div', { class: 'brand-drawer__peak-highlight' }),
          ]),
          el('div', { class: 'brand-drawer__peak-labels' }, [
            el('span', {}, '12a'), el('span', {}, '6a'), el('span', {}, '12p'), el('span', {}, '6p'), el('span', {}, '12a'),
          ]),
        ]),
        el('div', { class: 'brand-drawer__peak-text' }, 'Weekdays 2–4pm PKT'),
      ]),
    },
  ];
}

function topicBarEl(name, pct) {
  return el('div', { class: 'brand-drawer__topic-bar' }, [
    el('div', { class: 'brand-drawer__topic-row' }, [
      el('span', { class: 'brand-drawer__topic-name' }, name),
      el('span', { class: 'brand-drawer__topic-pct' }, `+${pct}%`),
    ]),
    el('div', { class: 'brand-drawer__topic-track' }, [
      el('div', { class: 'brand-drawer__topic-fill', style: `width: ${Math.min(100, pct)}%;` }),
    ]),
  ]);
}

// Render the splash 2 drawer using the same vocabulary as the in-conversation
// brand-drawer. Title, sub, and then a list of sections — each with an
// uppercase eyebrow and a body built by `sec.build()`.
function renderSplash2Drawer(node, kind) {
  if (!node) return;
  node.innerHTML = '';

  const isBrand = kind === 'brand';
  const title = isBrand ? 'About your brand' : "What's working";
  const sub = 'Scout is filling this as she learns.';
  const sections = isBrand ? splash2BrandSections() : splash2TrendingSections();

  node.appendChild(el('div', { class: 'splash2-drawer__head' }, [
    el('h2', { class: 'splash2-drawer__title' }, title),
    el('p',  { class: 'splash2-drawer__sub' }, sub),
  ]));
  const body = el('div', { class: 'splash2-drawer__body' });
  sections.forEach((sec) => {
    body.appendChild(el('section', { class: 'brand-drawer__section splash2-section--pre' }, [
      el('div', { class: 'brand-drawer__eyebrow' }, sec.eyebrow),
      sec.build(),
    ]));
  });
  node.appendChild(body);
}

/* ---- Screen 3: Outcomes ----
   A 3×3 post grid that fills the right section. The middle tile is a white
   engagement stat card with an upward-trending sparkline. */
function buildSplashScreen3Right() {
  // Tiles map to /Posts/1..4 then /Posts/5..8 (the middle slot is the stat
  // tile). Captions match each image's actual hero copy.
  const POSTS = [
    { ext: 'jpeg', caption: "Feeling indecisive? Pick the everything bagel." },
    { ext: 'png',  caption: 'You deserve a treat. Iced oat lattes are back.' },
    { ext: 'png',  caption: 'Coucou. The lemon macaron is back this week.' },
    { ext: 'png',  caption: "If your design doesn't tell a story, who will listen?" },
    null, // middle: stat tile
    { ext: 'png',  caption: 'Warm breakfast is one bite away.' },
    { ext: 'png',  caption: 'Baith jaao. The chair we all grew up around.' },
    { ext: 'png',  caption: 'New Molts. Classic malt, roasted hops.' },
    { ext: 'png',  caption: 'Trail logged. Inbox can wait.' },
  ];

  const tiles = POSTS.map((p, i) => {
    if (p === null) return buildSplash3StatTile();
    const imgIdx = i < 4 ? i + 1 : i;
    const src = `/Posts/${imgIdx}.${p.ext}`;
    return el('div', { class: 'splash3-tile' }, [buildPostSkeleton(src, p.caption)]);
  });

  return el('div', { class: 'splash__block splash3-block' }, [
    el('div', { class: 'splash3-grid' }, tiles),
  ]);
}

// White engagement stat card — clean surface, upward sparkline. Reads like
// a dashboard widget pulled out of the product.
function buildSplash3StatTile() {
  const linePath  = 'M2,32 L14,28 L26,30 L38,22 L50,24 L62,16 L74,14 L86,8 L98,4';
  const fillPath  = 'M2,32 L14,28 L26,30 L38,22 L50,24 L62,16 L74,14 L86,8 L98,4 L98,40 L2,40 Z';
  return el('div', { class: 'splash3-tile splash3-tile--stat' }, [
    el('div', { class: 'splash3-stat' }, [
      el('div', { class: 'splash3-stat__eyebrow' }, [
        el('span', { class: 'splash3-stat__dot' }),
        document.createTextNode('Engagement · 30d'),
      ]),
      el('div', { class: 'splash3-stat__value', id: 'splash3-stat-value' }, '↑ 3.8×'),
      el('div', { class: 'splash3-stat__label' }, 'vs. your previous baseline'),
      el('div', { class: 'splash3-stat__chart' }, [
        parseSvg(
          '<svg viewBox="0 0 100 40" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg" class="splash3-stat__svg" aria-hidden="true">' +
            '<defs>' +
              '<linearGradient id="splash3-grad" x1="0" y1="0" x2="0" y2="1">' +
                '<stop offset="0%"  stop-color="#a78bfa" stop-opacity="0.28"/>' +
                '<stop offset="100%" stop-color="#a78bfa" stop-opacity="0"/>' +
              '</linearGradient>' +
            '</defs>' +
            '<path class="splash3-stat__svg-fill" d="' + fillPath + '" fill="url(#splash3-grad)"/>' +
            '<path class="splash3-stat__svg-line" d="' + linePath + '" fill="none" stroke="#7c3aed" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>' +
            '<circle class="splash3-stat__svg-dot" cx="98" cy="4" r="3.4" fill="#7c3aed"/>' +
          '</svg>'
        ),
      ]),
    ]),
  ]);
}

/* ---- Per-screen animation kickoff ---- */
function playSplashScreen(idx, root) {
  if (idx === 0) {
    playSplashWheelHearts(root);
    return;
  }
  if (idx === 1) {
    playSplashScreen2Sequence(root);
    return;
  }
  if (idx === 2) {
    playSplash3Stat(root);
    return;
  }
}

// Animate the splash 3 stat value counting up.
function playSplash3Stat(root) {
  const node = root.querySelector('#splash3-stat-value');
  if (!node) return;
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const target = 3.8;
  const start = performance.now();
  const dur = 1200;
  const tick = (now) => {
    if (!root.isConnected) return;
    const t = Math.min(1, (now - start) / dur);
    const eased = 1 - Math.pow(1 - t, 3);
    const v = (target * eased).toFixed(1);
    node.textContent = `↑ ${v}×`;
    if (t < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

// Splash 1: hearts spawn rarely at random x positions along the wheel arc
// and float upward. Reduced motion → no spawn. Cleaned up on unmount.
function playSplashWheelHearts(root) {
  const layer = root.querySelector('#splash-wheel-hearts');
  if (!layer) return;
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  let stopped = false;
  const spawn = () => {
    if (stopped || !root.isConnected) return;
    const x = 20 + Math.random() * 60; // 20–80% across the wheel
    const heart = el('span', {
      class: 'splash-wheel-heart',
      style: `left: ${x.toFixed(1)}%;`,
    }, '♥');
    layer.appendChild(heart);
    setTimeout(() => heart.remove(), 4500);
    // Long gaps between hearts so the page reads as calm.
    setTimeout(spawn, 3500 + Math.random() * 3500);
  };
  setTimeout(spawn, 1400);
  const observer = new MutationObserver(() => {
    if (!root.isConnected) { stopped = true; observer.disconnect(); }
  });
  observer.observe(document.body, { childList: true, subtree: true });
}

// Splash 2 sequence:
//  1. Scout pill animates in (top-left of right block)
//  2. Drawer dissolves up from the bottom-right corner
//  3. Drawer's heading appears
//  4. Section rows fill in one by one (eyebrow + value, typewriter on the value)
//  5. Drawer slides back down out of view
//  6. Scout re-emerges with new activity label
//  7. A second drawer appears with "Thoughts" content
// The whole loop repeats while the screen is mounted.
async function playSplashScreen2Sequence(root) {
  const scoutAvatar = root.querySelector('#splash2-scout-avatar');
  const drawer      = root.querySelector('#splash2-drawer');
  if (!scoutAvatar || !drawer) return;
  const reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const beat = (ms) => sleep(reduced ? 0 : ms);

  const setScoutThinking = () => {
    scoutAvatar.classList.add('msg__avatar--loading');
    scoutAvatar.innerHTML = '';
    scoutAvatar.appendChild(parseSvg(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" aria-hidden="true">
        <circle cx="8"  cy="8"  r="6" class="scout-loader__c scout-loader__c--1"/>
        <circle cx="8"  cy="24" r="6" class="scout-loader__c scout-loader__c--2"/>
        <circle cx="24" cy="24" r="6" class="scout-loader__c scout-loader__c--3"/>
        <circle cx="24" cy="8"  r="6" class="scout-loader__c scout-loader__c--4"/>
      </svg>
    `));
  };
  const setScoutSettled = () => {
    scoutAvatar.classList.remove('msg__avatar--loading');
    scoutAvatar.innerHTML = '<svg><use href="#i-logo"/></svg>';
  };

  const fillDrawer = async (kind) => {
    setScoutThinking();
    renderSplash2Drawer(drawer, kind);
    // Reveal title/sub, then each section sequentially.
    await beat(180);
    drawer.querySelector('.splash2-drawer__head')?.classList.add('splash2-section--in');
    await beat(260);
    const sections = drawer.querySelectorAll('.brand-drawer__section');
    for (const s of sections) {
      s.classList.remove('splash2-section--pre');
      s.classList.add('splash2-section--in');
      await beat(280);
    }
    // Replay the top-topic bar fills so they animate from 0.
    const bars = drawer.querySelectorAll('.brand-drawer__topic-fill');
    bars.forEach((b) => {
      const w = b.style.width;
      b.style.width = '0%';
      requestAnimationFrame(() => { b.style.width = w; });
    });
    setScoutSettled();
    await beat(2200);
  };

  const fadeOutDrawer = async () => {
    drawer.classList.add('splash2-drawer--out');
    await beat(360);
    drawer.classList.remove('splash2-drawer--out');
    drawer.innerHTML = '';
  };

  let stopped = false;
  const observer = new MutationObserver(() => {
    if (!root.isConnected) { stopped = true; observer.disconnect(); }
  });
  observer.observe(document.body, { childList: true, subtree: true });

  while (!stopped && root.isConnected) {
    await fillDrawer('brand');
    if (stopped || !root.isConnected) break;
    await fadeOutDrawer();
    await beat(300);

    await fillDrawer('trending');
    if (stopped || !root.isConnected) break;
    await fadeOutDrawer();
    await beat(300);
  }
}




/* =========================================================================
   18. BOOT
   ========================================================================= */
function boot() {
  console.log('[Flagstaff] boot');
  bindDemoControls();
  setCrumbs(['Home', 'Onboarding', 'Conversation']);
  setComposerEnabled(false);

  // Session + checkpoint restore: skip splash/auth and resume mid-conversation.
  let savedSession = null;
  let savedCheckpoint = null;
  try { savedSession = JSON.parse(sessionStorage.getItem('fs_session') || 'null'); } catch (e) {}
  try { savedCheckpoint = JSON.parse(sessionStorage.getItem(CHECKPOINT_KEY) || 'null'); } catch (e) {}

  console.log('[boot] savedSession:', savedSession ? JSON.stringify(savedSession) : 'null');
  if (savedSession && savedSession.name) {
    console.log('[boot] entering session branch, view:', savedSession.view);
    // Restore user identity
    state.user.name = savedSession.name;
    const profileChip = document.querySelector('.profile-chip');
    const profileName = document.querySelector('.profile-chip__name');
    if (profileName) profileName.textContent = savedSession.name.split(' ')[0];
    if (profileChip) profileChip.style.visibility = '';
    try { localStorage.setItem(SPLASH_FLAG_KEY, '1'); } catch (e) {}

    if (savedSession.view === 'dash') {
      state.accountType = savedSession.accountType || 'individual';
      applyUserIdentity();
      document.body.classList.remove('mode-onboarding');
      document.body.classList.add('mode-app');
      setCrumbs(['Home']);
      try { renderDashboard(); initDashScout(); } catch(e) { console.error('[dash render error]', e); }
      showView('view-dash');
      return;
    }

    // Restore checkpoint if available
    if (savedCheckpoint && savedCheckpoint.step >= 0) {
      const ck = savedCheckpoint;
      const cs = ck.state || {};

      // Restore serializable state
      if (cs.accountType) state.accountType = cs.accountType;
      if (cs.user?.name)  state.user.name   = cs.user.name;
      if (cs.topics)      state.topics      = cs.topics;
      if (cs.goals)       state.goals       = cs.goals;
      if (cs.audience)    state.audience    = cs.audience;
      if (cs.tone)        state.tone        = cs.tone;

      // Re-derive brand persona from accountType
      state.brand = { ...(state.accountType === 'brand' ? DEMO_BRAND : DEMO_INDIVIDUAL) };
      applyUserIdentity();

      // Restore KB reveal set
      if (cs.kb) {
        state.kb.activeId = cs.kb.activeId || 'brand';
        state.kb.kbReveal = new Set(cs.kb.kbReveal || []);
      }

      // Inject saved stream HTML
      const streamEl = document.querySelector('#stream');
      if (streamEl && ck.html) {
        streamEl.innerHTML = ck.html;
      }

      // Restore body classes (KB open state, etc.) without triggering CSS transitions
      document.body.classList.add('mode-no-transition');
      if (ck.bodyClasses) {
        const keep = ['mode-onboarding', 'mode-app'];
        ck.bodyClasses.forEach(c => { if (!keep.includes(c)) document.body.classList.add(c); });
      }

      // Re-render KB panel with restored data (whenever KB was open at checkpoint)
      if (ck.bodyClasses && ck.bodyClasses.includes('mode-kb-open')) renderKB();

      // Re-enable transitions after layout settles
      requestAnimationFrame(() => requestAnimationFrame(() => {
        document.body.classList.remove('mode-no-transition');
      }));

      // Tell runConversation to skip completed steps
      _resumeFrom = ck.step;

      // Show view with stream hidden, scroll to bottom silently, then fade in
      const streamEl2 = document.querySelector('#stream');
      if (streamEl2) streamEl2.style.opacity = '0';
      showView('view-conv');
      setTimeout(() => {
        const body = document.querySelector('.conv');
        if (body) body.scrollTop = body.scrollHeight;
        // Fade stream in after scroll is settled
        if (streamEl2) {
          streamEl2.style.transition = 'opacity 0.25s ease';
          streamEl2.style.opacity = '1';
          setTimeout(() => { streamEl2.style.transition = ''; streamEl2.style.opacity = ''; }, 300);
        }
        runConversation();
      }, 100);
      return;
    }

    // No checkpoint — start conversation. accountType already in session
    // so openingHero() will skip the picker if it was previously chosen.
    if (savedSession.accountType) state.accountType = savedSession.accountType;
    showView('view-conv');
    setTimeout(() => runConversation(), 100);
    return;
  }

  // Splash gating:
  // - ?nosplash in the URL bypasses (for fast iteration when working on later flow)
  // - ?splash in the URL forces splash (clears the flag)
  // - Default: always show the splash. It's a brand moment and is skippable.
  const params = new URLSearchParams(location.search);
  if (params.has('dashboard')) {
    state.accountType = params.get('type') || 'individual';
    state.user.name = params.get('name') || 'Abdullah Qamar';
    if (params.has('published')) state.publishedPost = { body: 'First time I shipped a design system, I optimized the wrong thing for six months.', postedAt: Date.now() };
    applyUserIdentity();
    const dashChip = document.querySelector('.profile-chip__name');
    if (dashChip) dashChip.textContent = (state.user.name || 'Guest').split(' ')[0];
    document.body.classList.remove('mode-onboarding');
    document.body.classList.add('mode-app');
    setCrumbs(['Home']);
    renderHome();
    showView('view-home');
    return;
  }
  if (params.has('nosplash')) {
    try { localStorage.setItem(SPLASH_FLAG_KEY, '1'); } catch (e) {}
    showView('view-auth');
    setTimeout(() => initAuth(), 200);
    return;
  }
  if (params.has('splash')) {
    try { localStorage.removeItem(SPLASH_FLAG_KEY); } catch (e) {}
  }

  console.log('[Flagstaff] mounting splash');
  showView('view-splash');
  setTimeout(() => runSplash(), 100);
}

// The script is at the end of <body> so DOMContentLoaded may have already
// fired by the time this runs. Handle both cases.
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  // DOM already parsed — boot immediately.
  boot();
}
})();
