/**
 * SLOI AI — SEO + GEO Plugin v1.0
 * 
 * Inject in every page: <script src="/seo-geo.js"></script>
 * Or add to Vercel middleware for automatic injection.
 * 
 * Covers:
 * - SEO: meta tags, Open Graph, Twitter Cards, canonical, JSON-LD
 * - GEO: structured data for AI models (Claude, GPT, Perplexity, Gemini)
 * - Dynamic: updates per page based on URL/content
 */

(function() {
  'use strict';

  // ── PAGE CONFIG ──────────────────────────────────────────────────────────────
  const SITE = {
    name:        'SLOI AI',
    tagline:     'Smart negotiation · LOI generation',
    description: 'AI-powered commodity procurement. Your agent negotiates the best price with verified suppliers. You approve. LOI generated instantly.',
    url:         'https://sloiai.com',
    api:         'https://api.sloiai.com/v1',
    logo:        'https://sloiai.com/og-image.png',
    twitter:     '@sloiai',
    locale:      'en_US',
    geo: {
      region:   'AE',      // UAE
      placename:'Dubai, UAE',
      position: '25.2048;55.2708',
    },
    keywords: [
      'commodity procurement AI',
      'AI negotiation agent',
      'LOI generation',
      'steel procurement',
      'commodity trading platform',
      'MENA procurement',
      'IMEC corridor trade',
      'AI agent economy',
      'autonomous procurement',
      'commodity LOI',
      'steel rebar procurement',
      'wheat procurement AI',
      'trade finance AI',
    ],
  };

  // ── PAGE DEFINITIONS ─────────────────────────────────────────────────────────
  const PAGES = {
    '/':                      { title: 'SLOI AI — AI Commodity Negotiation & LOI Generation', desc: 'Your AI agent negotiates commodity prices with verified suppliers. You approve. LOI generated in minutes. Steel, wheat, aluminum, energy — MENA corridor.' },
    '/sloiai-home':           { title: 'SLOI AI — AI Commodity Negotiation & LOI Generation', desc: 'Your AI agent negotiates commodity prices with verified suppliers. You approve. LOI generated in minutes. Steel, wheat, aluminum, energy — MENA corridor.' },
    '/exchange':              { title: 'SLOI AI Exchange — Live Commodity Prices & Order Book', desc: 'Live commodity price board with order book. Steel, wheat, aluminum, diesel, chemicals. Negotiate directly from price board.' },
    '/pricing':               { title: 'Pricing — SLOI AI Credits & Plans', desc: 'Buy credits from $99. Pay per negotiation. Never expires. Card or USDC on Base. AI agents pay autonomously.' },
    '/about':                 { title: 'About SLOI AI — The Procurement Layer for the AI Economy', desc: 'SLOI AI is the settlement layer for physical commodity procurement in the AI agent economy. Built in UAE, serving the IMEC corridor.' },
    '/investor':              { title: 'Investors — SLOI AI Pitch Deck', desc: 'Pre-seed commodity procurement AI. $1.84M LOI volume. 98% gross margin. Break-even at 1 LOI/month.' },
    '/imec':                  { title: 'IMEC Corridor — SLOI AI Procurement Infrastructure', desc: '$300B+ infrastructure investment. 3.2B people connected. SLOI AI is the procurement layer of the India-Middle East-Europe Economic Corridor.' },
    '/docs':                  { title: 'API Documentation — SLOI AI', desc: 'Full API reference. Negotiate commodities, generate LOIs, manage credits. REST + SSE (AG-UI). Supports autonomous mode for AI agents.' },
    '/open-network':          { title: 'Open Network — AI Agent Commodity API', desc: 'External AI agents earn 1% commission per LOI. Read tier free. Transact tier earns. USDC payments on Base.' },
    '/autonomous-mode':       { title: 'Autonomous Mode — SLOI AI Agent Economy', desc: 'Set mandate once. AI agent closes commodity deals automatically. Auto-approve within parameters. 24/7, no human bottleneck.' },
    '/agui':                  { title: 'AG-UI Integration — SLOI AI Real-time Events', desc: 'AG-UI SSE protocol for real-time negotiation events across all portals. TEXT_CHUNK, AWAIT_HUMAN, AUTO_APPROVED, LOI_GENERATED.' },
    '/agentkit':              { title: 'AgentKit — AI Agents Pay with USDC on Base', desc: 'AI agents buy SLOI AI credits autonomously using USDC on Base via Coinbase AgentKit. Credits confirm in ~2 seconds. No human needed.' },
    '/login':                 { title: 'Sign In — SLOI AI', desc: 'Sign in to your SLOI AI account. Buyer, trader, supplier, or admin.' },
    '/smb-order':             { title: 'Get a Price — SLOI AI', desc: '3 questions. Our agent finds you the best price. No account needed to start.' },
    '/building-materials':    { title: 'Building Materials Procurement — SLOI AI', desc: 'AI-powered sourcing for steel rebar, OPC cement, clinker, hollow blocks, PVC pipes, and structural steel. MENA corridor, verified suppliers.' },
    '/critical-minerals':     { title: 'Critical Minerals Procurement — SLOI AI', desc: 'Source lithium, cobalt, copper, rare earths, and graphite from verified mines. AI negotiation, LOI in minutes.' },
    '/cement-clinker':        { title: 'Cement & Clinker Procurement — SLOI AI', desc: 'Bulk OPC cement and clinker sourcing at scale. White cement, slag, pozzolanic — factory-direct pricing, MENA & global.' },
    '/petrochemicals':        { title: 'Petrochemicals & Industrial Chemicals — SLOI AI', desc: 'Procure sulfuric acid, caustic soda, HDPE, polypropylene, and other base chemicals. REACH-compliant verified suppliers.' },
    '/faq':                   { title: 'FAQ — SLOI AI Commodity Procurement', desc: 'Frequently asked questions about AI commodity negotiation, LOI generation, credits, compliance, and the SLOI AI platform.' },
    '/broker-onboarding':     { title: 'Become a Trader — Join SLOI AI Network', desc: 'Join the SLOI AI trader network. Receive verified RFQs. AI negotiates within your floor price. $500 LOI fee per signed deal.' },
    '/contact':               { title: 'Contact — SLOI AI', desc: 'Contact the SLOI AI team. Procurement, partnerships, API access, investor relations.' },
    '/compliance':            { title: 'Compliance — SLOI AI Sanctions Screening', desc: 'OFAC, EU, and UN sanctions screening built into every SLOI AI transaction. Every counterparty checked before LOI generation.' },
    '/support':               { title: 'Support — SLOI AI Help Center', desc: 'Get help with SLOI AI. Credits, negotiations, LOIs, API, and account issues.' },
    '/terms':                 { title: 'Terms of Service — SLOI AI', desc: 'Terms of service, privacy policy, and trader agreement for SLOI AI Ltd.' },
  };

  // ── DETECT CURRENT PAGE ───────────────────────────────────────────────────────
  function getPageKey() {
    const path = window.location.pathname.replace('.html', '').replace(/\/$/, '') || '/';
    // Match exact or by filename
    if (PAGES[path]) return path;
    const filename = '/' + path.split('/').pop();
    return PAGES[filename] ? filename : '/';
  }

  const pageKey = getPageKey();
  const page = PAGES[pageKey] || PAGES['/'];
  const fullUrl = SITE.url + window.location.pathname;

  // ── HELPERS ───────────────────────────────────────────────────────────────────
  function setMeta(name, content, attr = 'name') {
    if (!content) return;
    let el = document.querySelector(`meta[${attr}="${name}"]`);
    if (!el) { el = document.createElement('meta'); el.setAttribute(attr, name); document.head.appendChild(el); }
    el.setAttribute('content', content);
  }

  function setLink(rel, href) {
    let el = document.querySelector(`link[rel="${rel}"]`);
    if (!el) { el = document.createElement('link'); el.setAttribute('rel', rel); document.head.appendChild(el); }
    el.setAttribute('href', href);
  }

  function injectJSON_LD(data) {
    const existing = document.querySelector('script[data-sloi-ld]');
    if (existing) existing.remove();
    const s = document.createElement('script');
    s.type = 'application/ld+json';
    s.setAttribute('data-sloi-ld', '');
    s.textContent = JSON.stringify(data, null, 2);
    document.head.appendChild(s);
  }

  // ── 1. BASIC SEO ─────────────────────────────────────────────────────────────
  function injectBasicSEO() {
    // Title
    if (!document.title || document.title === 'SLOI AI') {
      document.title = page.title;
    }

    // Description
    setMeta('description', page.desc);
    setMeta('keywords', SITE.keywords.join(', '));
    setMeta('author', 'SLOI AI Ltd.');
    setMeta('robots', 'index, follow');
    setMeta('theme-color', '#5b5fef');

    // Canonical
    setLink('canonical', fullUrl);

    // Geo
    setMeta('geo.region', SITE.geo.region);
    setMeta('geo.placename', SITE.geo.placename);
    setMeta('geo.position', SITE.geo.position);
    setMeta('ICBM', SITE.geo.position.replace(';', ', '));

    // Language
    document.documentElement.lang = 'en';
  }

  // ── 2. OPEN GRAPH ─────────────────────────────────────────────────────────────
  function injectOpenGraph() {
    setMeta('og:type',        'website',      'property');
    setMeta('og:url',         fullUrl,        'property');
    setMeta('og:title',       page.title,     'property');
    setMeta('og:description', page.desc,      'property');
    setMeta('og:image',       SITE.logo,      'property');
    setMeta('og:site_name',   SITE.name,      'property');
    setMeta('og:locale',      SITE.locale,    'property');
  }

  // ── 3. TWITTER CARD ───────────────────────────────────────────────────────────
  function injectTwitterCard() {
    setMeta('twitter:card',        'summary_large_image');
    setMeta('twitter:site',        SITE.twitter);
    setMeta('twitter:title',       page.title);
    setMeta('twitter:description', page.desc);
    setMeta('twitter:image',       SITE.logo);
  }

  // ── 4. JSON-LD STRUCTURED DATA ────────────────────────────────────────────────
  function injectStructuredData() {
    const graph = [];

    // Organization
    graph.push({
      '@type': 'Organization',
      '@id': SITE.url + '/#organization',
      name: 'SLOI AI',
      url: SITE.url,
      logo: SITE.logo,
      description: SITE.description,
      foundingDate: '2026',
      areaServed: ['AE','SA','EG','DE','IQ','JO'],
      contactPoint: { '@type': 'ContactPoint', email: 'api@sloiai.com', contactType: 'technical support' },
      sameAs: ['https://sloiai.com'],
    });

    // Website
    graph.push({
      '@type': 'WebSite',
      '@id': SITE.url + '/#website',
      url: SITE.url,
      name: 'SLOI AI',
      publisher: { '@id': SITE.url + '/#organization' },
      potentialAction: {
        '@type': 'SearchAction',
        target: SITE.url + '/exchange?q={search_term_string}',
        'query-input': 'required name=search_term_string',
      },
    });

    // SoftwareApplication
    graph.push({
      '@type': 'SoftwareApplication',
      name: 'SLOI AI',
      applicationCategory: 'BusinessApplication',
      operatingSystem: 'Web',
      url: SITE.url,
      description: SITE.description,
      offers: {
        '@type': 'AggregateOffer',
        priceCurrency: 'USD',
        lowPrice: '99',
        highPrice: '999',
        offerCount: 4,
      },
      featureList: [
        'AI commodity negotiation',
        'Automated LOI generation',
        'Real-time price monitoring',
        'OFAC/EU/UN compliance screening',
        'Autonomous agent mode',
        'USDC payments on Base',
        'WhatsApp deal notifications',
      ],
    });

    // WebPage
    graph.push({
      '@type': 'WebPage',
      '@id': fullUrl,
      url: fullUrl,
      name: page.title,
      description: page.desc,
      isPartOf: { '@id': SITE.url + '/#website' },
      inLanguage: 'en',
    });

    // FAQ for key pages
    if (pageKey === '/' || pageKey === '/sloiai-home') {
      graph.push({
        '@type': 'FAQPage',
        mainEntity: [
          { '@type': 'Question', name: 'What is SLOI AI?', acceptedAnswer: { '@type': 'Answer', text: 'SLOI AI is an AI-powered commodity procurement platform. A Claude-powered agent negotiates the best price with verified suppliers on behalf of the buyer. The Boss approves the deal, and a signed Letter of Intent (LOI) is generated instantly.' } },
          { '@type': 'Question', name: 'What commodities does SLOI AI support?', acceptedAnswer: { '@type': 'Answer', text: 'SLOI AI supports steel (rebar, coil, aluminum), building materials (cement, concrete, tiles, pipes), energy (diesel, fuel), agricultural commodities (wheat, corn), and industrial chemicals. Primary focus: MENA corridor and IMEC trade route.' } },
          { '@type': 'Question', name: 'How much does SLOI AI cost?', acceptedAnswer: { '@type': 'Answer', text: 'Credits from $99 (100 credits). A standard negotiation costs 10 credits. LOI generation costs 5 credits. Credits never expire. Pay by card (Stripe) or USDC on Base. LOI fee: $500 per signed deal.' } },
          { '@type': 'Question', name: 'Can AI agents use SLOI AI autonomously?', acceptedAnswer: { '@type': 'Answer', text: 'Yes. Agents set a mandate (product, quantity, price ceiling) and SLOI AI closes deals automatically within those parameters. Payments via USDC on Base. Commission: 1% per LOI for Transact tier agents.' } },
          { '@type': 'Question', name: 'What is a Letter of Intent (LOI)?', acceptedAnswer: { '@type': 'Answer', text: 'An LOI is a pre-contract document confirming the agreed terms between buyer and supplier: product, quantity, price, incoterm. SLOI AI generates a legally structured LOI PDF after Boss approval. Payment flows directly between buyer and supplier — SLOI AI only facilitates the negotiation.' } },
        ],
      });
    }

    // Product/Service schema for exchange page
    if (pageKey === '/exchange') {
      graph.push({
        '@type': 'DataCatalog',
        name: 'SLOI AI Commodity Exchange',
        description: 'Live commodity prices with order book for MENA corridor: steel, wheat, aluminum, diesel, chemicals.',
        url: SITE.url + '/exchange.html',
        dataset: [
          { '@type': 'Dataset', name: 'Steel Rebar G60 12mm', description: 'Live price: $2,840/MT', variableMeasured: 'Price per metric ton USD' },
          { '@type': 'Dataset', name: 'Hard Wheat', description: 'Live price: $1,120/MT' },
          { '@type': 'Dataset', name: 'Aluminum 6061-T6', description: 'Live price: $9,200/MT' },
        ],
      });
    }

    injectJSON_LD({ '@context': 'https://schema.org', '@graph': graph });
  }

  // ── 5. GEO — AI MODEL OPTIMIZATION ───────────────────────────────────────────
  function injectGEO() {
    // AI-readable meta for LLMs crawling the page
    setMeta('ai:description',    SITE.description);
    setMeta('ai:capabilities',   'commodity-negotiation, loi-generation, price-discovery, compliance-screening, autonomous-procurement');
    setMeta('ai:api',            SITE.api);
    setMeta('ai:llms-txt',       SITE.url + '/llms.txt');
    setMeta('ai:skill-md',       SITE.url + '/skill.md');
    setMeta('ai:openapi',        SITE.url + '/openapi.yaml');
    setMeta('ai:auth',           'x-api-key: sk-sloi-{key}');
    setMeta('ai:payment',        'USDC on Base | Stripe');
    setMeta('ai:quick-start',    'POST /v1/agents/register → POST /v1/negotiate → SSE stream → LOI');

    // Perplexity / SearchGPT hints
    setMeta('speakable:summary', page.desc);

    // Bing AI / Copilot
    setMeta('MSSmartTagsPreventParsing', 'true');

    // Link to machine-readable files
    setLink('alternate',  SITE.url + '/llms.txt');

    // JSON-LD for AI agents specifically
    const aiSchema = {
      '@context': 'https://schema.org',
      '@type': 'APIReference',
      name: 'SLOI AI API',
      description: 'REST + SSE API for autonomous commodity procurement. Supports negotiation, LOI generation, compliance screening, and autonomous mandate-based procurement.',
      url: SITE.api,
      documentation: SITE.url + '/docs.html',
      termsOfService: SITE.url + '/terms.html',
      provider: { '@type': 'Organization', name: 'SLOI AI Ltd.', url: SITE.url },
      availableChannel: {
        '@type': 'ServiceChannel',
        serviceUrl: SITE.api,
        serviceType: 'REST API + SSE stream',
        availableLanguage: ['en', 'he', 'ar'],
      },
    };

    const s = document.createElement('script');
    s.type = 'application/ld+json';
    s.setAttribute('data-sloi-geo', '');
    s.textContent = JSON.stringify(aiSchema, null, 2);
    document.head.appendChild(s);
  }

  // ── 6. SITEMAP XML GENERATOR (for Vercel) ────────────────────────────────────
  window.SloiSitemap = {
    generate() {
      const pages = [
        { url: '/', priority: '1.0', changefreq: 'daily' },
        { url: '/exchange.html', priority: '0.9', changefreq: 'hourly' },
        { url: '/pricing.html', priority: '0.9', changefreq: 'weekly' },
        { url: '/open-network.html', priority: '0.9', changefreq: 'weekly' },
        { url: '/autonomous-mode.html', priority: '0.9', changefreq: 'weekly' },
        { url: '/about.html', priority: '0.8', changefreq: 'monthly' },
        { url: '/investor.html', priority: '0.8', changefreq: 'monthly' },
        { url: '/imec.html', priority: '0.8', changefreq: 'weekly' },
        { url: '/docs.html', priority: '0.8', changefreq: 'weekly' },
        { url: '/agui.html', priority: '0.7', changefreq: 'monthly' },
        { url: '/agentkit.html', priority: '0.7', changefreq: 'monthly' },
        { url: '/contact.html', priority: '0.6', changefreq: 'monthly' },
        { url: '/terms.html', priority: '0.5', changefreq: 'yearly' },
      ];

      const today = new Date().toISOString().slice(0, 10);
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${pages.map(p => `  <url>
    <loc>${SITE.url}${p.url}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${p.changefreq}</changefreq>
    <priority>${p.priority}</priority>
  </url>`).join('\n')}
</urlset>`;
      return xml;
    },
  };

  // ── 7. PERFORMANCE HINTS ──────────────────────────────────────────────────────
  function injectPerformanceHints() {
    // Preconnect to API
    const preconnects = ['https://api.sloiai.com', 'https://fonts.googleapis.com'];
    preconnects.forEach(href => {
      if (!document.querySelector(`link[rel="preconnect"][href="${href}"]`)) {
        const l = document.createElement('link');
        l.rel = 'preconnect'; l.href = href; l.crossOrigin = 'anonymous';
        document.head.appendChild(l);
      }
    });

    // Viewport
    if (!document.querySelector('meta[name="viewport"]')) {
      setMeta('viewport', 'width=device-width, initial-scale=1.0');
    }
  }

  // ── INIT ──────────────────────────────────────────────────────────────────────
  function init() {
    injectBasicSEO();
    injectOpenGraph();
    injectTwitterCard();
    injectStructuredData();
    injectGEO();
    injectPerformanceHints();
    console.log('[SLOI SEO/GEO] Injected for:', pageKey);
  }

  // Run after DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
