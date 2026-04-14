import Phaser from 'phaser';

// ── Constants ──────────────────────────────────────────────────────────────────
const WIDTH = 800;
const HEIGHT = 500;
const PADDLE_W = 14;
const PADDLE_H = 90;
const BALL_SIZE = 14;
const PLAYER_X = 30;
const AI_X = WIDTH - 30 - PADDLE_W;
const PADDLE_SPEED = 420;
const BALL_BASE_SPEED = 340;
const WIN_SCORE = 7;
const AI_REACTION = 0.82; // 0–1: fraction of perfect tracking per frame

// ── Scenes ──────────────────────────────────────────────────────────────────

class PongScene extends Phaser.Scene {
  constructor() {
    super({ key: 'PongScene' });
  }

  preload() {
    // All graphics drawn procedurally – nothing to load
  }

  create() {
    this.playerScore = 0;
    this.aiScore = 0;
    this.paused = false;

    // ── Background ──
    this.add.rectangle(WIDTH / 2, HEIGHT / 2, WIDTH, HEIGHT, 0x0a0a18);

    // Centre dashed line
    for (let y = 10; y < HEIGHT; y += 30) {
      this.add.rectangle(WIDTH / 2, y + 5, 3, 16, 0x2a2a50);
    }

    // ── Paddles ──
    this.playerPaddle = this.add.rectangle(
      PLAYER_X + PADDLE_W / 2,
      HEIGHT / 2,
      PADDLE_W,
      PADDLE_H,
      0x6366f1
    );
    this.aiPaddle = this.add.rectangle(
      AI_X + PADDLE_W / 2,
      HEIGHT / 2,
      PADDLE_W,
      PADDLE_H,
      0xa855f7
    );

    // ── Ball ──
    this.ball = this.add.rectangle(
      WIDTH / 2,
      HEIGHT / 2,
      BALL_SIZE,
      BALL_SIZE,
      0xffffff
    );

    // Physics bodies
    this.physics.add.existing(this.playerPaddle, false);
    this.physics.add.existing(this.aiPaddle, false);
    this.physics.add.existing(this.ball, false);

    /** @type {Phaser.Physics.Arcade.Body} */
    const playerBody = this.playerPaddle.body;
    playerBody.setCollideWorldBounds(true);
    playerBody.setImmovable(true);

    /** @type {Phaser.Physics.Arcade.Body} */
    const aiBody = this.aiPaddle.body;
    aiBody.setCollideWorldBounds(true);
    aiBody.setImmovable(true);

    /** @type {Phaser.Physics.Arcade.Body} */
    const ballBody = this.ball.body;
    ballBody.setCollideWorldBounds(false); // we handle top/bottom manually
    ballBody.setBounce(1, 1);

    // Only bounce ball off world top/bottom
    this.physics.world.setBoundsCollision(false, false, true, true);
    this.physics.world.setBounds(0, 0, WIDTH, HEIGHT);
    ballBody.setCollideWorldBounds(true);

    // Colliders
    this.physics.add.collider(this.ball, this.playerPaddle, this.onBallHitPaddle, null, this);
    this.physics.add.collider(this.ball, this.aiPaddle, this.onBallHitPaddle, null, this);

    // ── Score text ──
    const textStyle = {
      fontSize: '48px',
      fontFamily: 'monospace',
      fill: '#ffffff',
      alpha: 0.6,
    };
    this.playerScoreText = this.add.text(WIDTH / 4, 30, '0', textStyle).setOrigin(0.5, 0);
    this.aiScoreText = this.add.text((3 * WIDTH) / 4, 30, '0', textStyle).setOrigin(0.5, 0);

    // ── Instructions ──
    this.hintText = this.add
      .text(WIDTH / 2, HEIGHT - 18, 'W / S  or  ↑ / ↓  to move', {
        fontSize: '13px',
        fontFamily: 'sans-serif',
        fill: '#44446a',
      })
      .setOrigin(0.5, 1);

    // ── Keys ──
    this.keys = this.input.keyboard.addKeys({
      up: Phaser.Input.Keyboard.KeyCodes.UP,
      down: Phaser.Input.Keyboard.KeyCodes.DOWN,
      w: Phaser.Input.Keyboard.KeyCodes.W,
      s: Phaser.Input.Keyboard.KeyCodes.S,
    });
    this.input.keyboard.addCapture([
      Phaser.Input.Keyboard.KeyCodes.UP,
      Phaser.Input.Keyboard.KeyCodes.DOWN,
      Phaser.Input.Keyboard.KeyCodes.W,
      Phaser.Input.Keyboard.KeyCodes.S,
      Phaser.Input.Keyboard.KeyCodes.SPACE,
    ]);

    // ── Overlay group (for message screens) ──
    this.overlayGroup = this.add.group();

    // Launch ball
    this.launchBall();
  }

  // ── Launch / reset ball ────────────────────────────────────────────────────
  launchBall(delay = 800) {
    this.ball.setPosition(WIDTH / 2, HEIGHT / 2);
    /** @type {Phaser.Physics.Arcade.Body} */
    const body = this.ball.body;
    body.setVelocity(0, 0);

    this.time.delayedCall(delay, () => {
      const angle = Phaser.Math.Between(-30, 30);
      const dir = Math.random() < 0.5 ? 1 : -1;
      const rad = Phaser.Math.DegToRad(angle);
      body.setVelocity(
        Math.cos(rad) * BALL_BASE_SPEED * dir,
        Math.sin(rad) * BALL_BASE_SPEED
      );
    });
  }

  // ── Ball-paddle collision: add angle based on hit offset ──────────────────
  onBallHitPaddle(ball, paddle) {
    /** @type {Phaser.Physics.Arcade.Body} */
    const ballBody = ball.body;
    const hitOffset = (ball.y - paddle.y) / (PADDLE_H / 2); // -1 … 1
    const bounceAngle = hitOffset * 60; // max 60°
    const rad = Phaser.Math.DegToRad(bounceAngle);
    const speed = Math.min(
      Math.sqrt(ballBody.velocity.x ** 2 + ballBody.velocity.y ** 2) + 10,
      650
    );
    // Direction: if paddle is on left side of screen, ball goes right; else left
    const dir = paddle.x < WIDTH / 2 ? 1 : -1;
    ballBody.setVelocity(
      Math.cos(rad) * speed * dir,
      Math.sin(rad) * speed
    );
  }

  // ── Score a point ──────────────────────────────────────────────────────────
  scorePoint(scorer) {
    if (this.paused) return;
    this.paused = true;
    /** @type {Phaser.Physics.Arcade.Body} */
    const body = this.ball.body;
    body.setVelocity(0, 0);

    if (scorer === 'player') {
      this.playerScore++;
      this.playerScoreText.setText(String(this.playerScore));
    } else {
      this.aiScore++;
      this.aiScoreText.setText(String(this.aiScore));
    }

    if (this.playerScore >= WIN_SCORE || this.aiScore >= WIN_SCORE) {
      this.showEndScreen(this.playerScore >= WIN_SCORE ? 'Player' : 'AI');
    } else {
      this.time.delayedCall(600, () => {
        this.paused = false;
        this.launchBall(500);
      });
    }
  }

  // ── End screen ────────────────────────────────────────────────────────────
  showEndScreen(winner) {
    this.overlayGroup.clear(true, true);

    const bg = this.add.rectangle(WIDTH / 2, HEIGHT / 2, 420, 210, 0x11112a, 0.92);
    bg.setStrokeStyle(2, 0x6366f1);
    this.overlayGroup.add(bg);

    const winText = this.add
      .text(WIDTH / 2, HEIGHT / 2 - 50, `${winner} Wins! 🎉`, {
        fontSize: '36px',
        fontFamily: 'monospace',
        fill: winner === 'Player' ? '#a3e635' : '#f87171',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);
    this.overlayGroup.add(winText);

    const scoreText = this.add
      .text(WIDTH / 2, HEIGHT / 2, `${this.playerScore} – ${this.aiScore}`, {
        fontSize: '28px',
        fontFamily: 'monospace',
        fill: '#d0d4ff',
      })
      .setOrigin(0.5);
    this.overlayGroup.add(scoreText);

    const replayText = this.add
      .text(WIDTH / 2, HEIGHT / 2 + 55, 'Press SPACE or click to play again', {
        fontSize: '16px',
        fontFamily: 'sans-serif',
        fill: '#7a7ea8',
      })
      .setOrigin(0.5);
    this.overlayGroup.add(replayText);

    // Restart on space or click
    this.input.keyboard.once('keydown-SPACE', () => this.restartGame());
    this.input.once('pointerdown', () => this.restartGame());
  }

  restartGame() {
    this.playerScore = 0;
    this.aiScore = 0;
    this.playerScoreText.setText('0');
    this.aiScoreText.setText('0');
    this.overlayGroup.clear(true, true);
    this.paused = false;
    // Reset paddles
    this.playerPaddle.setY(HEIGHT / 2);
    this.aiPaddle.setY(HEIGHT / 2);
    this.launchBall(600);
  }

  // ── Update ─────────────────────────────────────────────────────────────────
  update(_time, delta) {
    if (this.paused) return;
    const dt = delta / 1000;

    // ── Player paddle ──
    /** @type {Phaser.Physics.Arcade.Body} */
    const playerBody = this.playerPaddle.body;
    const up = this.keys.up.isDown || this.keys.w.isDown;
    const down = this.keys.down.isDown || this.keys.s.isDown;
    let playerDir = 0;
    if (up) {
      playerDir = -1;
    } else if (down) {
      playerDir = 1;
    }

    this.playerPaddle.y += playerDir * PADDLE_SPEED * dt;
    this.playerPaddle.y = Phaser.Math.Clamp(
      this.playerPaddle.y,
      PADDLE_H / 2,
      HEIGHT - PADDLE_H / 2
    );
    playerBody.updateFromGameObject();

    // ── AI paddle ──
    /** @type {Phaser.Physics.Arcade.Body} */
    const aiBody = this.aiPaddle.body;
    const diff = this.ball.y - this.aiPaddle.y;
    const aiMove = diff * AI_REACTION;
    const aiDelta = Phaser.Math.Clamp(aiMove, -PADDLE_SPEED * dt, PADDLE_SPEED * dt);
    this.aiPaddle.y = Phaser.Math.Clamp(
      this.aiPaddle.y + aiDelta,
      PADDLE_H / 2,
      HEIGHT - PADDLE_H / 2
    );
    aiBody.updateFromGameObject();

    // ── Score detection (ball leaves left/right) ──
    const ballX = this.ball.x;
    if (ballX < -BALL_SIZE) {
      this.scorePoint('ai');
    } else if (ballX > WIDTH + BALL_SIZE) {
      this.scorePoint('player');
    }
  }
}

// ── Phaser Game Config ─────────────────────────────────────────────────────
new Phaser.Game({
  type: Phaser.AUTO,
  width: WIDTH,
  height: HEIGHT,
  parent: 'game-container',
  backgroundColor: '#0a0a18',
  physics: {
    default: 'arcade',
    arcade: { gravity: { y: 0 }, debug: false },
  },
  scene: [PongScene],
});
