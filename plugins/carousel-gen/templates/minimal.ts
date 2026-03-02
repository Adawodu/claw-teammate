import type { Brand, SlideContent } from "./professional";

const FONT_IMPORT = `<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800&display=swap" rel="stylesheet">`;

function baseStyles() {
  return `
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      width: 1080px; height: 1080px;
      font-family: 'Poppins', sans-serif;
      overflow: hidden;
    }
  `;
}

export function renderSlide(
  slide: { headline?: string; subtitle?: string; body?: string; cta?: string },
  index: number,
  total: number,
  brand: Brand,
): string {
  if (index === 0) return renderCover(slide.headline || "", brand);
  if (index === total - 1) return renderCTA(slide.cta || "Thank You", brand);
  return renderContent(slide, index, total, brand);
}

function renderCover(headline: string, brand: Brand): string {
  return `<!DOCTYPE html><html><head>${FONT_IMPORT}<style>
    ${baseStyles()}
    .container {
      width: 100%; height: 100%;
      background: ${brand.primaryColor};
      display: flex; flex-direction: column;
    }
    .header {
      padding: 48px 60px;
      display: flex; justify-content: space-between; align-items: center;
    }
    .brand-handle { font-size: 24px; font-weight: 600; color: rgba(255,255,255,0.7); }
    .brand-url { font-size: 20px; color: rgba(255,255,255,0.5); }
    .content {
      flex: 1;
      display: flex; flex-direction: column; justify-content: center;
      padding: 0 60px 60px;
    }
    .accent-bar {
      width: 120px; height: 6px;
      background: ${brand.accentColor};
      margin-bottom: 36px;
    }
    .headline {
      font-size: 60px; font-weight: 800; color: #fff;
      line-height: 1.15; max-width: 900px;
    }
    .footer {
      padding: 36px 60px;
      border-top: 1px solid rgba(255,255,255,0.1);
      display: flex; justify-content: space-between; align-items: center;
    }
    .brand-name { font-size: 22px; font-weight: 700; color: rgba(255,255,255,0.6); }
    .swipe { font-size: 20px; color: ${brand.accentColor}; font-weight: 600; }
  </style></head><body>
    <div class="container">
      <div class="header">
        <span class="brand-handle">${escapeHtml(brand.handle)}</span>
        <span class="brand-url">${escapeHtml(brand.url)}</span>
      </div>
      <div class="content">
        <div class="accent-bar"></div>
        <div class="headline">${escapeHtml(headline)}</div>
      </div>
      <div class="footer">
        <span class="brand-name">${escapeHtml(brand.name)}</span>
        <span class="swipe">Swipe &rarr;</span>
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
    ${baseStyles()}
    .container {
      width: 100%; height: 100%;
      background: ${brand.primaryColor};
      display: flex; flex-direction: column;
    }
    .header {
      padding: 48px 60px;
      display: flex; justify-content: space-between; align-items: center;
    }
    .brand-handle { font-size: 22px; font-weight: 600; color: rgba(255,255,255,0.5); }
    .page { font-size: 20px; color: rgba(255,255,255,0.4); font-weight: 500; }
    .content {
      flex: 1;
      padding: 20px 60px 60px;
      display: flex; flex-direction: column; justify-content: center;
    }
    .number {
      font-size: 80px; font-weight: 800; color: ${brand.accentColor};
      line-height: 1; margin-bottom: 20px;
    }
    .subtitle {
      font-size: 42px; font-weight: 700; color: #fff;
      line-height: 1.2; margin-bottom: 24px;
      max-width: 900px;
    }
    .body {
      font-size: 26px; color: rgba(255,255,255,0.75);
      line-height: 1.65; max-width: 850px;
    }
    .footer {
      padding: 36px 60px;
      border-top: 1px solid rgba(255,255,255,0.1);
    }
    .brand-url { font-size: 20px; color: rgba(255,255,255,0.4); }
  </style></head><body>
    <div class="container">
      <div class="header">
        <span class="brand-handle">${escapeHtml(brand.handle)}</span>
        <span class="page">${num} / ${String(total - 2).padStart(2, "0")}</span>
      </div>
      <div class="content">
        <div class="number">${num}</div>
        <div class="subtitle">${escapeHtml(slide.subtitle || "")}</div>
        <div class="body">${escapeHtml(slide.body || "")}</div>
      </div>
      <div class="footer">
        <span class="brand-url">${escapeHtml(brand.url)}</span>
      </div>
    </div>
  </body></html>`;
}

function renderCTA(cta: string, brand: Brand): string {
  return `<!DOCTYPE html><html><head>${FONT_IMPORT}<style>
    ${baseStyles()}
    .container {
      width: 100%; height: 100%;
      background: ${brand.primaryColor};
      display: flex; flex-direction: column;
      justify-content: center; align-items: center;
      text-align: center; padding: 60px;
    }
    .accent-bar {
      width: 80px; height: 6px;
      background: ${brand.accentColor};
      margin-bottom: 48px;
    }
    .cta {
      font-size: 52px; font-weight: 800; color: #fff;
      line-height: 1.2; margin-bottom: 48px;
      max-width: 800px;
    }
    .brand-name {
      font-size: 28px; font-weight: 700; color: rgba(255,255,255,0.8);
      margin-bottom: 12px;
    }
    .brand-handle {
      font-size: 22px; color: ${brand.accentColor};
      font-weight: 600; margin-bottom: 8px;
    }
    .brand-url {
      font-size: 20px; color: rgba(255,255,255,0.4);
    }
  </style></head><body>
    <div class="container">
      <div class="accent-bar"></div>
      <div class="cta">${escapeHtml(cta)}</div>
      <div class="brand-name">${escapeHtml(brand.name)}</div>
      <div class="brand-handle">${escapeHtml(brand.handle)}</div>
      <div class="brand-url">${escapeHtml(brand.url)}</div>
    </div>
  </body></html>`;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
