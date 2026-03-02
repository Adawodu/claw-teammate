import type { Brand, SlideContent } from "./professional";

const FONT_IMPORT = `<link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;600;700;900&display=swap" rel="stylesheet">`;

function baseStyles() {
  return `
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      width: 1080px; height: 1080px;
      font-family: 'Montserrat', sans-serif;
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
      position: relative; padding: 60px;
      display: flex; flex-direction: column; justify-content: center;
    }
    .blob1 {
      position: absolute; top: -80px; right: -80px;
      width: 400px; height: 400px;
      background: ${brand.accentColor}; border-radius: 50%;
      opacity: 0.3;
    }
    .blob2 {
      position: absolute; bottom: -60px; left: -60px;
      width: 300px; height: 300px;
      background: ${brand.accentColor}; border-radius: 50%;
      opacity: 0.2;
    }
    .logo {
      position: absolute; top: 48px; left: 60px;
      font-size: 28px; font-weight: 900; color: #fff;
    }
    .headline {
      font-size: 72px; font-weight: 900; color: #fff;
      line-height: 1.1; max-width: 850px;
      position: relative; z-index: 1;
    }
    .headline .accent { color: ${brand.accentColor}; }
    .handle {
      position: absolute; bottom: 48px; left: 60px;
      font-size: 22px; color: rgba(255,255,255,0.7);
      font-weight: 600;
    }
  </style></head><body>
    <div class="container">
      <div class="blob1"></div>
      <div class="blob2"></div>
      <div class="logo">${escapeHtml(brand.name)}</div>
      <div class="headline">${escapeHtml(headline)}</div>
      <div class="handle">${escapeHtml(brand.handle)}</div>
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
      position: relative; padding: 60px;
      display: flex; flex-direction: column; justify-content: center;
    }
    .blob {
      position: absolute; top: 50%; right: -100px;
      width: 350px; height: 350px;
      background: ${brand.accentColor}; border-radius: 50%;
      opacity: 0.15; transform: translateY(-50%);
    }
    .logo {
      position: absolute; top: 48px; left: 60px;
      font-size: 24px; font-weight: 900; color: rgba(255,255,255,0.5);
    }
    .number {
      font-size: 160px; font-weight: 900; color: ${brand.accentColor};
      line-height: 1; margin-bottom: 8px;
      position: relative; z-index: 1;
    }
    .subtitle {
      font-size: 48px; font-weight: 900; color: #fff;
      line-height: 1.15; margin-bottom: 28px;
      max-width: 850px; position: relative; z-index: 1;
    }
    .body {
      font-size: 26px; color: rgba(255,255,255,0.8);
      line-height: 1.65; max-width: 800px;
      position: relative; z-index: 1;
    }
    .page-indicator {
      position: absolute; bottom: 48px; right: 60px;
      font-size: 20px; color: rgba(255,255,255,0.4); font-weight: 700;
    }
  </style></head><body>
    <div class="container">
      <div class="blob"></div>
      <div class="logo">${escapeHtml(brand.name)}</div>
      <div class="number">${num}</div>
      <div class="subtitle">${escapeHtml(slide.subtitle || "")}</div>
      <div class="body">${escapeHtml(slide.body || "")}</div>
      <div class="page-indicator">${index} / ${total - 2}</div>
    </div>
  </body></html>`;
}

function renderCTA(cta: string, brand: Brand): string {
  return `<!DOCTYPE html><html><head>${FONT_IMPORT}<style>
    ${baseStyles()}
    .container {
      width: 100%; height: 100%;
      background: ${brand.accentColor};
      position: relative;
      display: flex; flex-direction: column;
      justify-content: center; align-items: center;
      text-align: center; padding: 60px;
    }
    .blob1 {
      position: absolute; top: -100px; left: -100px;
      width: 400px; height: 400px;
      background: ${brand.primaryColor}; border-radius: 50%;
      opacity: 0.2;
    }
    .blob2 {
      position: absolute; bottom: -80px; right: -80px;
      width: 350px; height: 350px;
      background: ${brand.primaryColor}; border-radius: 50%;
      opacity: 0.15;
    }
    .cta {
      font-size: 64px; font-weight: 900; color: #fff;
      line-height: 1.15; margin-bottom: 40px;
      position: relative; z-index: 1;
    }
    .brand-name {
      font-size: 36px; font-weight: 900; color: #fff;
      margin-bottom: 12px; position: relative; z-index: 1;
    }
    .brand-handle {
      font-size: 24px; color: rgba(255,255,255,0.7);
      font-weight: 600; margin-bottom: 8px;
      position: relative; z-index: 1;
    }
    .brand-url {
      font-size: 22px; color: rgba(255,255,255,0.5);
      position: relative; z-index: 1;
    }
  </style></head><body>
    <div class="container">
      <div class="blob1"></div>
      <div class="blob2"></div>
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
