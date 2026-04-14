import Phaser from 'phaser';

// ── Constants ──────────────────────────────────────────────────────────────────
const CELL = 24;           // grid cell size in px
const COLS = 28;           // grid columns
const ROWS = 22;           // grid rows
const WIDTH = COLS * CELL; // 672
const HEIGHT = ROWS * CELL; // 528
const TICK_START = 140;    // ms per step (initial speed)
const TICK_MIN = 65;       // fastest possible tick
const SPEED_UP_EVERY = 5;  // speed up every N food eaten

// ── Colours ───────────────────────────────────────────────────────────────────
const C_BG = 0x0a0a18;
const C_GRID = 0x13132a;
const C_SNAKE_HEAD = 0x6366f1;
const C_SNAKE_BODY = 0x4b4ed4;
const C_FOOD = 0xf472b6;
const C_TEXT = 0xd0d4ff;

// ── Scene ──────────────────────────────────────────────────────────────────────
class SnakeScene extends Phaser.Scene {
  constructor() {
    super({ key: 'SnakeScene' });
  }

  create() {
    this._drawGrid();
    this._initState();
    this._createUI();
    this._bindKeys();
    this._startTicker();
  }

  // ── Grid background ──────────────────────────────────────────────────────
  _drawGrid() {
    const gfx = this.add.graphics();
    gfx.fillStyle(C_BG);
    gfx.fillRect(0, 0, WIDTH, HEIGHT);
    gfx.lineStyle(1, C_GRID, 0.5);
    for (let c = 0; c <= COLS; c++) {
      gfx.lineBetween(c * CELL, 0, c * CELL, HEIGHT);
    }
    for (let r = 0; r <= ROWS; r++) {
      gfx.lineBetween(0, r * CELL, WIDTH, r * CELL);
    }
  }

  // ── Game state ────────────────────────────────────────────────────────────
  _initState() {
    // Snake starts in middle, length 3, moving right
    const startCol = Math.floor(COLS / 2);
    const startRow = Math.floor(ROWS / 2);
    this.snake = [
      { col: startCol, row: startRow },
      { col: startCol - 1, row: startRow },
      { col: startCol - 2, row: startRow },
    ];
    this.direction = { col: 1, row: 0 };
    this.nextDirection = { col: 1, row: 0 };
    this.score = 0;
    this.foodEaten = 0;
    this.alive = true;
    this.tickMs = TICK_START;

    // Graphics pool for snake segments & food
    this.segmentPool = [];
    this.snakeGfx = [];
    for (const seg of this.snake) {
      this.snakeGfx.push(this._makeSegRect(seg.col, seg.row, C_SNAKE_BODY));
    }
    // Colour head differently
    this.snakeGfx[0].setFillStyle(C_SNAKE_HEAD);

    this.foodGfx = null;
    this._placeFood();
  }

  _makeSegRect(col, row, color) {
    const margin = 2;
    const rect = this.add.rectangle(
      col * CELL + CELL / 2,
      row * CELL + CELL / 2,
      CELL - margin * 2,
      CELL - margin * 2,
      color
    );
    rect.setOrigin(0.5);
    return rect;
  }

  // ── Food placement ────────────────────────────────────────────────────────
  _placeFood() {
    // Find a cell not occupied by snake
    let col, row;
    do {
      col = Phaser.Math.Between(0, COLS - 1);
      row = Phaser.Math.Between(0, ROWS - 1);
    } while (this.snake.some(s => s.col === col && s.row === row));

    if (this.foodGfx) this.foodGfx.destroy();
    this.foodGfx = this.add.circle(
      col * CELL + CELL / 2,
      row * CELL + CELL / 2,
      CELL / 2 - 3,
      C_FOOD
    );
    this.food = { col, row };
  }

  // ── UI ────────────────────────────────────────────────────────────────────
  _createUI() {
    // Score text displayed as an overlay at the top
    this.scoreBg = this.add.rectangle(WIDTH / 2, 14, 200, 24, 0x11112a, 0.85);
    this.scoreText = this.add
      .text(WIDTH / 2, 14, 'Score: 0', {
        fontSize: '15px',
        fontFamily: 'monospace',
        fill: '#' + C_TEXT.toString(16).padStart(6, '0'),
      })
      .setOrigin(0.5);
  }

  // ── Input ─────────────────────────────────────────────────────────────────
  _bindKeys() {
    const kb = this.input.keyboard;
    kb.on('keydown-LEFT',  () => this._setDir(-1, 0));
    kb.on('keydown-RIGHT', () => this._setDir(1, 0));
    kb.on('keydown-UP',    () => this._setDir(0, -1));
    kb.on('keydown-DOWN',  () => this._setDir(0, 1));
    kb.on('keydown-A',     () => this._setDir(-1, 0));
    kb.on('keydown-D',     () => this._setDir(1, 0));
    kb.on('keydown-W',     () => this._setDir(0, -1));
    kb.on('keydown-S',     () => this._setDir(0, 1));
  }

  _setDir(col, row) {
    // Prevent reversing into self
    if (col === -this.direction.col && row === -this.direction.row) return;
    this.nextDirection = { col, row };
  }

  // ── Ticker ────────────────────────────────────────────────────────────────
  _startTicker() {
    this.ticker = this.time.addEvent({
      delay: this.tickMs,
      loop: true,
      callback: this._step,
      callbackScope: this,
    });
  }

  _step() {
    if (!this.alive) return;

    this.direction = this.nextDirection;

    const head = this.snake[0];
    const newHead = {
      col: (head.col + this.direction.col + COLS) % COLS, // wrap
      row: (head.row + this.direction.row + ROWS) % ROWS,
    };

    // Self-collision
    if (this.snake.some(s => s.col === newHead.col && s.row === newHead.row)) {
      this._gameOver();
      return;
    }

    const ate = newHead.col === this.food.col && newHead.row === this.food.row;

    // Move snake: add new head
    this.snake.unshift(newHead);
    const headGfx = this._makeSegRect(newHead.col, newHead.row, C_SNAKE_HEAD);
    // Recolour old head to body colour
    if (this.snakeGfx[0]) this.snakeGfx[0].setFillStyle(C_SNAKE_BODY);
    this.snakeGfx.unshift(headGfx);

    if (ate) {
      this.foodEaten++;
      this.score += 10;
      this.scoreText.setText(`Score: ${this.score}`);
      this._placeFood();
      // Speed up
      if (this.foodEaten % SPEED_UP_EVERY === 0) {
        this.tickMs = Math.max(TICK_MIN, this.tickMs - 10);
        this.ticker.reset({
          delay: this.tickMs,
          loop: true,
          callback: this._step,
          callbackScope: this,
        });
      }
    } else {
      // Remove tail
      const tailGfx = this.snakeGfx.pop();
      tailGfx.destroy();
      this.snake.pop();
    }
  }

  // ── Game over ─────────────────────────────────────────────────────────────
  _gameOver() {
    this.alive = false;
    this.ticker.remove();

    // Flash the snake red
    for (const g of this.snakeGfx) g.setFillStyle(0xef4444);

    this.time.delayedCall(500, () => this._showGameOverScreen());
  }

  _showGameOverScreen() {
    const bg = this.add.rectangle(WIDTH / 2, HEIGHT / 2, 400, 220, 0x11112a, 0.93);
    bg.setStrokeStyle(2, 0x6366f1);

    this.add
      .text(WIDTH / 2, HEIGHT / 2 - 60, 'Game Over', {
        fontSize: '40px',
        fontFamily: 'monospace',
        fill: '#ef4444',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);

    this.add
      .text(WIDTH / 2, HEIGHT / 2 - 10, `Score: ${this.score}`, {
        fontSize: '26px',
        fontFamily: 'monospace',
        fill: '#d0d4ff',
      })
      .setOrigin(0.5);

    this.add
      .text(WIDTH / 2, HEIGHT / 2 + 45, 'Press SPACE or click to play again', {
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
  scene: [SnakeScene],
});
