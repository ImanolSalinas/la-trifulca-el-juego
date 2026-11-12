(() => {
  /**
   * Bellas Artes — blockers (image 1600×1063).
   * Coords are top-left of each box in map pixels.
   * C = debug bodies · click = copy point.
   *
   * @type {{
   *   key: string,
   *   width: number,
   *   height: number,
   *   spawn: { x: number, y: number },
   *   blockers: readonly { x: number, y: number, w: number, h: number, label?: string }[]
   * }}
   */
  const BELLAS_ARTES = {
    key: "bellas-artes",
    width: 1600,
    height: 1063,
    spawn: { x: 760, y: 880 },
    blockers: [
      // —— Edificio / mural (no entrar) ——
      { x: 380, y: 0, w: 820, h: 470, label: "edificio" },
      { x: 520, y: 470, w: 560, h: 90, label: "base-muro" },
      { x: 900, y: 470, w: 320, h: 140, label: "muro-derecha" },

      // —— Reja / pasillo derecho ——
      { x: 1180, y: 250, w: 300, h: 380, label: "reja" },

      // —— Árboles / faroles / autos ——
      { x: 250, y: 250, w: 180, h: 220, label: "arbol-izq" },
      { x: 430, y: 470, w: 40, h: 50, label: "farol-izq" },
      { x: 100, y: 500, w: 240, h: 150, label: "auto-plata" },
      { x: 40, y: 660, w: 230, h: 140, label: "auto-rojo" },
      { x: 1280, y: 740, w: 260, h: 260, label: "arbol-der" },
      { x: 1240, y: 640, w: 44, h: 50, label: "farol-der" },

      // —— Bolardos ——
      { x: 540, y: 690, w: 26, h: 26, label: "bolardo" },
      { x: 600, y: 720, w: 26, h: 26, label: "bolardo" },
      { x: 660, y: 750, w: 26, h: 26, label: "bolardo" },
      { x: 730, y: 780, w: 26, h: 26, label: "bolardo" },

      // —— NPCs / puntos marcados por vos ——
      { x: 310, y: 400, w: 44, h: 36, label: "npc" },
      { x: 350, y: 420, w: 44, h: 36, label: "npc" },
      { x: 390, y: 410, w: 44, h: 36, label: "npc" },
      { x: 360, y: 450, w: 44, h: 36, label: "npc" },
      { x: 480, y: 500, w: 40, h: 34, label: "npc" },
      { x: 520, y: 515, w: 40, h: 34, label: "npc" },
      { x: 600, y: 560, w: 40, h: 34, label: "npc" },
      { x: 640, y: 575, w: 40, h: 34, label: "npc" },
      { x: 700, y: 640, w: 40, h: 34, label: "npc" },
      { x: 900, y: 500, w: 40, h: 34, label: "npc" },
      { x: 940, y: 520, w: 40, h: 34, label: "npc" },
      { x: 1040, y: 560, w: 40, h: 34, label: "npc" },
      { x: 1080, y: 575, w: 40, h: 34, label: "npc" },
      { x: 1120, y: 555, w: 40, h: 34, label: "npc" },
      { x: 1180, y: 600, w: 40, h: 34, label: "npc" },
      { x: 1220, y: 620, w: 40, h: 34, label: "npc" },
      { x: 1260, y: 740, w: 40, h: 34, label: "npc" },
      { x: 623, y: 713, w: 48, h: 44, label: "npc-user" },
      { x: 793, y: 811, w: 48, h: 44, label: "npc-user" },
      { x: 1106, y: 647, w: 48, h: 44, label: "npc-user" },
      { x: 893, y: 607, w: 48, h: 44, label: "npc-user" },
      { x: 1316, y: 705, w: 48, h: 44, label: "npc-user" },
      { x: 1384, y: 825, w: 48, h: 44, label: "npc-user" },
      { x: 903, y: 873, w: 48, h: 44, label: "npc-user" },
      { x: 1027, y: 799, w: 48, h: 44, label: "npc-user" },
      { x: 717, y: 619, w: 48, h: 44, label: "npc-user" },
      { x: 637, y: 571, w: 48, h: 44, label: "npc-user" },
      { x: 461, y: 641, w: 48, h: 44, label: "npc-user" },

      // —— Calle (borde suave; vereda libre) ——
      { x: 0, y: 880, w: 520, h: 183, label: "calle-abajo" },
    ],
  };

  window.TrifulcaChapter2 = window.TrifulcaChapter2 || {};
  window.TrifulcaChapter2.maps = window.TrifulcaChapter2.maps || {};
  window.TrifulcaChapter2.maps.bellasArtes = BELLAS_ARTES;
})();
