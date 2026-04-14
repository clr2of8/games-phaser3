import Phaser from 'phaser';

// ── Constants ──────────────────────────────────────────────────────────────────
const WIDTH  = 700;
const HEIGHT = 580;
const MAX_WRONG = 6;

// ── Colour palette (matches portal theme) ─────────────────────────────────────
const C_BG      = 0x0a0a18;
const C_GALLOWS = 0xa0a4d0;
const C_BODY    = 0xd0d4ff;
const C_CORRECT = 0x6366f1;
const C_WRONG   = 0xef4444;
const C_TEXT    = 0xd0d4ff;
const C_HINT    = 0x44446a;
const C_KEY_DEF = 0x1e1e3a;
const C_KEY_STR = 0x6366f1;
const C_KEY_BRD = 0x44446a;

// ── Word bank ─────────────────────────────────────────────────────────────────
const WORDS = [
  'ARCADE', 'PHASER', 'JAVASCRIPT', 'BROWSER', 'CANVAS',
  'KEYBOARD', 'PIXEL', 'SPRITE', 'RENDER', 'ENGINE',
  'GRAVITY', 'PHYSICS', 'TEXTURE', 'CAMERA', 'VECTOR',
  'DUNGEON', 'CASTLE', 'DRAGON', 'WIZARD', 'KNIGHT',
  'GALAXY', 'ROCKET', 'PLANET', 'NEBULA', 'COMET',
  'PYTHON', 'GITHUB', 'MATRIX', 'CIPHER', 'BINARY',
  'BRIDGE', 'FOREST', 'THUNDER', 'SHADOW', 'CRYSTAL',
  'PENGUIN', 'DOLPHIN', 'FALCON', 'JAGUAR', 'BADGER',
];

// ── Scene ─────────────────────────────────────────────────────────────────────
class HangmanScene extends Phaser.Scene {
  constructor() {
    super({ key: 'HangmanScene' });
  }

  create() {
    this._initState();
    this._drawBackground();
    this._createGallows();
    this._createWordDisplay();
    this._createKeyboard();
    this._createStatusText();
    this._bindKeys();
  }

  // ── State ──────────────────────────────────────────────────────────────────
  _initState() {
    this.word        = Phaser.Utils.Array.GetRandom(WORDS);
    this.guessed     = new Set();
    this.wrongCount  = 0;
    this.gameOver    = false;
    this.won         = false;
  }

  // ── Background ────────────────────────────────────────────────────────────
  _drawBackground() {
    this.add.rectangle(WIDTH / 2, HEIGHT / 2, WIDTH, HEIGHT, C_BG);
  }

  // ── Gallows ───────────────────────────────────────────────────────────────
  _createGallows() {
    // Static structure drawn once
    const gfx = this.add.graphics();
    gfx.lineStyle(4, C_GALLOWS, 1);

    // Base
    gfx.lineBetween(40, 460, 220, 460);
    // Pole
    gfx.lineBetween(130, 460, 130, 80);
    // Top beam
    gfx.lineBetween(130, 80, 270, 80);
    // Rope
    gfx.lineBetween(270, 80, 270, 120);

    // Body parts drawn progressively
    this.bodyGfx = this.add.graphics();
  }

  _drawBodyParts() {
    const g  = this.bodyGfx;
    const cx = 270;     // centre x of body
    const headY = 140;  // top of head circle
    const r  = 22;      // head radius

    g.clear();
    g.lineStyle(4, C_BODY, 1);

    // 1 – head
    if (this.wrongCount >= 1) g.strokeCircle(cx, headY + r, r);
    // 2 – torso
    if (this.wrongCount >= 2) g.lineBetween(cx, headY + r * 2, cx, headY + r * 2 + 90);
    // 3 – left arm
    if (this.wrongCount >= 3) g.lineBetween(cx, headY + r * 2 + 20, cx - 50, headY + r * 2 + 70);
    // 4 – right arm
    if (this.wrongCount >= 4) g.lineBetween(cx, headY + r * 2 + 20, cx + 50, headY + r * 2 + 70);
    // 5 – left leg
    if (this.wrongCount >= 5) g.lineBetween(cx, headY + r * 2 + 90, cx - 50, headY + r * 2 + 150);
    // 6 – right leg
    if (this.wrongCount >= 6) g.lineBetween(cx, headY + r * 2 + 90, cx + 50, headY + r * 2 + 150);
  }

  // ── Word display ──────────────────────────────────────────────────────────
  _createWordDisplay() {
    this.letterTexts = [];
    const letters = this.word.length;
    const tileW   = 36;
    const gap     = 6;
    const totalW  = letters * tileW + (letters - 1) * gap;
    const startX  = WIDTH / 2 - totalW / 2 + tileW / 2;
    const y       = 390;

    for (let i = 0; i < letters; i++) {
      const x = startX + i * (tileW + gap);

      // Underline
      const line = this.add.rectangle(x, y + 22, tileW - 4, 3, C_GALLOWS);
      line.setOrigin(0.5, 0.5);

      // Letter text (hidden until guessed)
      const t = this.add
        .text(x, y, '_', {
          fontSize: '26px',
          fontFamily: 'monospace',
          fill: '#' + C_TEXT.toString(16).padStart(6, '0'),
          fontStyle: 'bold',
        })
        .setOrigin(0.5, 0.5)
        .setAlpha(0); // hidden; we replace underscore with letter on correct guess

      this.letterTexts.push(t);
    }
  }

  _refreshWordDisplay() {
    for (let i = 0; i < this.word.length; i++) {
      const ch = this.word[i];
      if (this.guessed.has(ch)) {
        this.letterTexts[i].setText(ch).setAlpha(1);
      }
    }
  }

  // ── On-screen keyboard ────────────────────────────────────────────────────
  _createKeyboard() {
    this.keyButtons = {};
    const rows = ['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM'];
    const btnW = 40;
    const btnH = 36;
    const gap  = 4;
    const startY = 435;

    rows.forEach((row, ri) => {
      const totalW = row.length * (btnW + gap) - gap;
      const startX = WIDTH / 2 - totalW / 2 + btnW / 2;

      for (let ci = 0; ci < row.length; ci++) {
        const ch = row[ci];
        const x  = startX + ci * (btnW + gap);
        const y  = startY + ri * (btnH + gap);

        const bg = this.add.rectangle(x, y, btnW, btnH, C_KEY_DEF);
        bg.setStrokeStyle(1, C_KEY_BRD);

        const label = this.add
          .text(x, y, ch, {
            fontSize: '14px',
            fontFamily: 'monospace',
            fill: '#' + C_TEXT.toString(16).padStart(6, '0'),
          })
          .setOrigin(0.5);

        this.keyButtons[ch] = { bg, label };
      }
    });
  }

  _markKey(ch, correct) {
    const btn = this.keyButtons[ch];
    if (!btn) return;
    const color = correct ? C_KEY_STR : C_WRONG;
    btn.bg.setFillStyle(color);
    btn.label.setStyle({ fill: '#ffffff' });
  }

  // ── Status / hint text ────────────────────────────────────────────────────
  _createStatusText() {
    this.statusText = this.add
      .text(WIDTH / 2, 300, '', {
        fontSize: '13px',
        fontFamily: 'sans-serif',
        fill: '#' + C_HINT.toString(16).padStart(6, '0'),
      })
      .setOrigin(0.5);

    this.wrongText = this.add
      .text(WIDTH / 2, 330, '', {
        fontSize: '15px',
        fontFamily: 'monospace',
        fill: '#' + C_WRONG.toString(16).padStart(6, '0'),
      })
      .setOrigin(0.5);

    this._refreshStatus();
  }

  _refreshStatus() {
    const wrong = [...this.guessed].filter(c => !this.word.includes(c));
    this.wrongText.setText(
      wrong.length ? `Wrong: ${wrong.join('  ')}  (${wrong.length}/${MAX_WRONG})` : ''
    );
  }

  // ── Input ─────────────────────────────────────────────────────────────────
  _bindKeys() {
    this.input.keyboard.on('keydown', (event) => {
      if (this.gameOver) return;
      const ch = event.key.toUpperCase();
      if (ch.length === 1 && ch >= 'A' && ch <= 'Z') {
        this._guess(ch);
      }
    });
  }

  // ── Core guess logic ──────────────────────────────────────────────────────
  _guess(ch) {
    if (this.guessed.has(ch)) return;
    this.guessed.add(ch);

    const correct = this.word.includes(ch);
    this._markKey(ch, correct);

    if (!correct) {
      this.wrongCount++;
      this._drawBodyParts();
    }

    this._refreshWordDisplay();
    this._refreshStatus();
    this._checkEndCondition();
  }

  _checkEndCondition() {
    const allRevealed = [...this.word].every(c => this.guessed.has(c));

    if (allRevealed) {
      this.won      = true;
      this.gameOver = true;
      this._showEndScreen(true);
    } else if (this.wrongCount >= MAX_WRONG) {
      this.gameOver = true;
      this._revealWord();
      this._showEndScreen(false);
    }
  }

  _revealWord() {
    for (let i = 0; i < this.word.length; i++) {
      const ch = this.word[i];
      if (!this.guessed.has(ch)) {
        this.letterTexts[i]
          .setText(ch)
          .setAlpha(1)
          .setStyle({ fill: '#' + C_WRONG.toString(16).padStart(6, '0') });
      }
    }
  }

  // ── End screen ────────────────────────────────────────────────────────────
  _showEndScreen(won) {
    const boxColor = won ? 0x1a2a1a : 0x2a0f0f;
    const box = this.add.rectangle(WIDTH / 2, HEIGHT / 2 - 40, 420, 200, boxColor, 0.95);
    box.setStrokeStyle(2, won ? C_CORRECT : C_WRONG);

    this.add
      .text(WIDTH / 2, HEIGHT / 2 - 100, won ? '🎉 You Win!' : '💀 Game Over', {
        fontSize: '38px',
        fontFamily: 'monospace',
        fill: won ? '#6ee7b7' : '#ef4444',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);

    if (!won) {
      this.add
        .text(WIDTH / 2, HEIGHT / 2 - 52, `The word was: ${this.word}`, {
          fontSize: '20px',
          fontFamily: 'monospace',
          fill: '#d0d4ff',
        })
        .setOrigin(0.5);
    }

    this.add
      .text(WIDTH / 2, HEIGHT / 2 - 10, 'Press SPACE or click to play again', {
        fontSize: '15px',
        fontFamily: 'sans-serif',
        fill: '#7a7ea8',
      })
      .setOrigin(0.5);

    this.input.keyboard.once('keydown-SPACE', () => this.scene.restart());
    this.input.once('pointerdown', () => this.scene.restart());
  }
}

// ── Phaser Game Config ─────────────────────────────────────────────────────
new Phaser.Game({
  type: Phaser.AUTO,
  width: WIDTH,
  height: HEIGHT,
  parent: 'game-container',
  backgroundColor: '#0a0a18',
  scene: [HangmanScene],
});
