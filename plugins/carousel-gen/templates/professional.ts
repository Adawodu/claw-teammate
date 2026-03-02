export interface Brand {
  name: string;
  handle: string;
  url: string;
  primaryColor: string;
  accentColor: string;
}

export interface SlideContent {
  subtitle?: string;
  body?: string;
}

const FONT_IMPORT = `<style>/* System font stack — no external requests */</style>`;

function baseStyles(brand: Brand) {
  return `
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      width: 1080px; height: 1080px;
      font-family: 'Inter', -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      overflow: hidden;
      background: #ffffff;
    }
  `;
}

export function renderSlide(
  slide: { headline?: string; subtitle?: string; body?: string; cta?: string },
  index: number,
  total: number,
  brand: Brand,
): string {
  if (index === 0) return renderCover(slide.headline || "", brand, total);
  if (index === total - 1) return renderCTA(slide.cta || "Thank You", brand);
  return renderContent(slide, index, total, brand);
}

function renderCover(headline: string, brand: Brand, total: number): string {
  return `<!DOCTYPE html><html><head>${FONT_IMPORT}<style>
    ${baseStyles(brand)}
    .container { width: 100%; height: 100%; display: flex; flex-direction: column; }
    .header {
      padding: 48px 60px;
      display: flex; justify-content: space-between; align-items: center;
    }
    .brand-name { font-size: 28px; font-weight: 700; color: #333; }
    .brand-url { font-size: 20px; color: #888; }
    .content {
      flex: 1;
      background: ${brand.primaryColor};
      padding: 80px 60px;
      display: flex; flex-direction: column; justify-content: center;
    }
    .headline {
      font-size: 64px; font-weight: 800; color: #1a1a1a;
      line-height: 1.15; max-width: 900px;
    }
    .footer {
      background: ${brand.accentColor};
      padding: 36px 60px;
      display: flex; justify-content: space-between; align-items: center;
    }
    .swipe { font-size: 22px; color: #fff; font-weight: 600; }
    .dots { display: flex; gap: 8px; }
    .dot { width: 12px; height: 12px; border-radius: 50%; background: rgba(255,255,255,0.4); }
    .dot.active { background: #fff; }
    .arrows { font-size: 28px; color: #fff; }
  </style></head><body>
    <div class="container">
      <div class="header">
        <span class="brand-name">${escapeHtml(brand.name)}</span>
        <span class="brand-url">${escapeHtml(brand.url)}</span>
      </div>
      <div class="content">
        <div class="headline">${escapeHtml(headline)}</div>
      </div>
      <div class="footer">
        <span class="swipe">SWIPE &rarr;</span>
        <div class="dots">${dotIndicators(0, total)}</div>
        <span class="arrows">&larr; &rarr;</span>
      </div>
    </div>
  </body></html>`;
}

function renderContent(
  slide: { subtitle?: string; body?: string },
  index: number,
  total: number,
  brand: Brand,
): string {
  const num = String(index).padStart(2, "0");
  return `<!DOCTYPE html><html><head>${FONT_IMPORT}<style>
    ${baseStyles(brand)}
    .container { width: 100%; height: 100%; display: flex; flex-direction: column; }
    .header {
      padding: 48px 60px;
      display: flex; justify-content: space-between; align-items: center;
    }
    .brand-name { font-size: 28px; font-weight: 700; color: #333; }
    .slide-num { font-size: 24px; color: #888; font-weight: 600; }
    .content {
      flex: 1;
      padding: 40px 60px 40px;
      display: flex; flex-direction: column; justify-content: center;
    }
    .number {
      font-size: 120px; font-weight: 800; color: ${brand.primaryColor};
      opacity: 0.3; line-height: 1; margin-bottom: 16px;
    }
    .subtitle {
      font-size: 44px; font-weight: 800; color: #1a1a1a;
      line-height: 1.2; margin-bottom: 28px;
    }
    .body {
      font-size: 28px; color: #555; line-height: 1.6;
      max-width: 900px;
    }
    .footer {
      background: ${brand.accentColor};
      padding: 36px 60px;
      display: flex; justify-content: space-between; align-items: center;
    }
    .brand-handle { font-size: 22px; color: #fff; font-weight: 600; }
    .dots { display: flex; gap: 8px; }
    .dot { width: 12px; height: 12px; border-radius: 50%; background: rgba(255,255,255,0.4); }
    .dot.active { background: #fff; }
    .arrows { font-size: 28px; color: #fff; }
  </style></head><body>
    <div class="container">
      <div class="header">
        <span class="brand-name">${escapeHtml(brand.name)}</span>
        <span class="slide-num">${num} / ${String(total - 2).padStart(2, "0")}</span>
      </div>
      <div class="content">
        <div class="number">${num}</div>
        <div class="subtitle">${escapeHtml(slide.subtitle || "")}</div>
        <div class="body">${escapeHtml(slide.body || "")}</div>
      </div>
      <div class="footer">
        <span class="brand-handle">${escapeHtml(brand.handle)}</span>
        <div class="dots">${dotIndicators(index, total)}</div>
        <span class="arrows">&larr; &rarr;</span>
      </div>
    </div>
  </body></html>`;
}

function renderCTA(cta: string, brand: Brand): string {
  return `<!DOCTYPE html><html><head>${FONT_IMPORT}<style>
    ${baseStyles(brand)}
    .container {
      width: 100%; height: 100%;
      background: ${brand.accentColor};
      display: flex; flex-direction: column;
      justify-content: center; align-items: center;
      text-align: center; padding: 60px;
    }
    .cta {
      font-size: 56px; font-weight: 800; color: #fff;
      line-height: 1.2; margin-bottom: 40px;
    }
    .brand-name { font-size: 32px; font-weight: 700; color: rgba(255,255,255,0.9); margin-bottom: 12px; }
    .brand-handle { font-size: 24px; color: rgba(255,255,255,0.7); margin-bottom: 8px; }
    .brand-url { font-size: 22px; color: rgba(255,255,255,0.6); }
    .divider {
      width: 80px; height: 4px; background: ${brand.primaryColor};
      margin: 40px auto;
    }
  </style></head><body>
    <div class="container">
      <div class="cta">${escapeHtml(cta)}</div>
      <div class="divider"></div>
      <div class="brand-name">${escapeHtml(brand.name)}</div>
      <div class="brand-handle">${escapeHtml(brand.handle)}</div>
      <div class="brand-url">${escapeHtml(brand.url)}</div>
    </div>
  </body></html>`;
}

function dotIndicators(active: number, total: number): string {
  const maxDots = Math.min(total, 8);
  return Array.from({ length: maxDots }, (_, i) =>
    `<span class="dot${i === active ? " active" : ""}"></span>`
  ).join("");
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
