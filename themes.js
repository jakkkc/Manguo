const THEMES = {
  champagne: {
    name: "Champagne",
    vars: {
      "--bg":       "#1a1008",
      "--bg2":      "#2c1f0e",
      "--bg3":      "#3d2b14",
      "--accent":   "#c9973a",
      "--accent2":  "#e4bf7a",
      "--text":     "#f5e6c8",
      "--muted":    "rgba(245,230,200,0.45)",
      "--border":   "rgba(201,151,58,0.18)",
      "--border2":  "rgba(201,151,58,0.32)",
    }
  },
  midnight: {
    name: "Midnight",
    vars: {
      "--bg":       "#080c18",
      "--bg2":      "#0f1628",
      "--bg3":      "#1a2340",
      "--accent":   "#5b8dee",
      "--accent2":  "#93b4f5",
      "--text":     "#dce8ff",
      "--muted":    "rgba(220,232,255,0.45)",
      "--border":   "rgba(91,141,238,0.18)",
      "--border2":  "rgba(91,141,238,0.32)",
    }
  },
  sage: {
    name: "Sage",
    vars: {
      "--bg":       "#080f0a",
      "--bg2":      "#101c12",
      "--bg3":      "#1a2e1d",
      "--accent":   "#5aab6e",
      "--accent2":  "#8ecf9e",
      "--text":     "#dff2e4",
      "--muted":    "rgba(223,242,228,0.45)",
      "--border":   "rgba(90,171,110,0.18)",
      "--border2":  "rgba(90,171,110,0.32)",
    }
  },
  blush: {
    name: "Blush",
    vars: {
      "--bg":       "#140810",
      "--bg2":      "#241020",
      "--bg3":      "#38182e",
      "--accent":   "#d4729a",
      "--accent2":  "#e9a8c2",
      "--text":     "#fce8f2",
      "--muted":    "rgba(252,232,242,0.45)",
      "--border":   "rgba(212,114,154,0.18)",
      "--border2":  "rgba(212,114,154,0.32)",
    }
  },
  slate: {
    name: "Slate",
    vars: {
      "--bg":       "#0a0c10",
      "--bg2":      "#14181f",
      "--bg3":      "#1e242e",
      "--accent":   "#8899bb",
      "--accent2":  "#b0c0d8",
      "--text":     "#e4eaf5",
      "--muted":    "rgba(228,234,245,0.45)",
      "--border":   "rgba(136,153,187,0.18)",
      "--border2":  "rgba(136,153,187,0.32)",
    }
  }
};

function applyTheme(themeKey) {
  const theme = THEMES[themeKey] || THEMES.champagne;
  const root  = document.documentElement;
  Object.entries(theme.vars).forEach(([k, v]) => root.style.setProperty(k, v));
  localStorage.setItem("manguo-theme", themeKey);
  document.querySelectorAll(".theme-btn").forEach(b => {
    b.classList.toggle("active", b.dataset.theme === themeKey);
  });
}

function initTheme() {
  const saved = localStorage.getItem("manguo-theme") || "champagne";
  applyTheme(saved);
}

export { THEMES, applyTheme, initTheme };