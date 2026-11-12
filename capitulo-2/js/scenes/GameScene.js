(() => {
  const SPEED = 140;

  class GameScene extends Phaser.Scene {
    constructor() {
      super("game");
      /** @type {Phaser.Types.Physics.Arcade.SpriteWithDynamicBody | null} */
      this.player = null;
      /** @type {Phaser.Types.Input.Keyboard.CursorKeys | null} */
      this.cursors = null;
      /** @type {Record<string, Phaser.Input.Keyboard.Key>} */
      this.wasd = {};
      /** @type {"down"|"up"|"left"|"right"} */
      this.facing = "down";
      /** @type {boolean} */
      this.debugBodies = false;
    }

    create() {
      const map = window.TrifulcaChapter2.maps.bellasArtes;
      const { width: WORLD_W, height: WORLD_H, spawn, blockers } = map;

      this.physics.world.setBounds(0, 0, WORLD_W, WORLD_H);

      this.add.image(0, 0, "bellas-artes").setOrigin(0, 0).setDepth(0);

      this.createAnims();

      this.player = this.physics.add.sprite(spawn.x, spawn.y, "ima", 0);
      this.player.setCollideWorldBounds(true);
      this.player.setScale(0.85);
      this.player.setDepth(10);
      this.player.body.setSize(28, 16);
      this.player.body.setOffset(18, 72);

      const solids = this.physics.add.staticGroup();
      for (const box of blockers) {
        const wall = this.add
          .rectangle(box.x + box.w / 2, box.y + box.h / 2, box.w, box.h, 0xff3355, 0)
          .setDepth(5);
        this.physics.add.existing(wall, true);
        solids.add(wall);
      }
      this.physics.add.collider(this.player, solids);
      this.solids = solids;

      this.cameras.main.setBounds(0, 0, WORLD_W, WORLD_H);
      this.cameras.main.startFollow(this.player, true, 0.14, 0.14);
      // Vista más alta: casi todo el lugar en pantalla.
      this.cameras.main.setZoom(0.42);

      this.cursors = this.input.keyboard.createCursorKeys();
      this.wasd = this.input.keyboard.addKeys({
        up: Phaser.Input.Keyboard.KeyCodes.W,
        down: Phaser.Input.Keyboard.KeyCodes.S,
        left: Phaser.Input.Keyboard.KeyCodes.A,
        right: Phaser.Input.Keyboard.KeyCodes.D,
      });

      this.input.keyboard.on("keydown-C", () => {
        this.debugBodies = !this.debugBodies;
        this.physics.world.drawDebug = this.debugBodies;
        if (this.debugBodies) {
          if (!this.physics.world.debugGraphic) {
            this.physics.world.createDebugGraphic();
          }
          this.physics.world.debugGraphic.setVisible(true).setDepth(200);
        } else if (this.physics.world.debugGraphic) {
          this.physics.world.debugGraphic.setVisible(false);
          this.physics.world.debugGraphic.clear();
        }
        this.hint.setText(
          this.debugBodies
            ? "Debug ON — click para copiar punto · C apaga"
            : "WASD / flechas · C = ver paredes"
        );
      });

      this.pointXy = document.getElementById("point-xy");
      this.pointCode = document.getElementById("point-code");

      this.input.on("pointerdown", (pointer) => {
        const world = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
        const x = Math.round(world.x);
        const y = Math.round(world.y);
        const line = `{ x: ${x}, y: ${y}, w: 40, h: 40 },`;
        // eslint-disable-next-line no-console
        console.log("punto mapa:", x, y, "→", line);
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(line).catch(() => {});
        }
        if (this.pointXy) {
          this.pointXy.textContent = `${x} , ${y}`;
        }
        if (this.pointCode) {
          this.pointCode.textContent = `${line}  (copiado)`;
        }
        this.hint.setText(`Punto ${x},${y} · C = paredes`);
      });

      this.hint = this.add
        .text(10, 44, "WASD · C paredes · click = punto", {
          fontFamily: '"Press Start 2P", monospace',
          fontSize: "12px",
          color: "#f4efe6",
          backgroundColor: "#000000aa",
          padding: { x: 8, y: 6 },
        })
        .setScrollFactor(0)
        .setDepth(100);

      this.add
        .text(10, 10, "Bellas Artes", {
          fontFamily: '"Press Start 2P", monospace',
          fontSize: "14px",
          color: "#f4efe6",
          backgroundColor: "#000000aa",
          padding: { x: 8, y: 6 },
        })
        .setScrollFactor(0)
        .setDepth(100);
    }

    createAnims() {
      const mk = (key, start) => {
        if (this.anims.exists(key)) {
          return;
        }
        this.anims.create({
          key,
          frames: this.anims.generateFrameNumbers("ima", { start, end: start + 4 }),
          frameRate: 8,
          repeat: -1,
        });
      };
      mk("walk-down", 0);
      mk("walk-right", 5);
      mk("walk-up", 10);
      mk("walk-left", 15);
    }

    update() {
      if (!this.player || !this.cursors) {
        return;
      }

      let vx = 0;
      let vy = 0;
      if (this.cursors.left.isDown || this.wasd.left.isDown) {
        vx -= 1;
      }
      if (this.cursors.right.isDown || this.wasd.right.isDown) {
        vx += 1;
      }
      if (this.cursors.up.isDown || this.wasd.up.isDown) {
        vy -= 1;
      }
      if (this.cursors.down.isDown || this.wasd.down.isDown) {
        vy += 1;
      }

      if (vx !== 0 && vy !== 0) {
        const inv = Math.SQRT1_2;
        vx *= inv;
        vy *= inv;
      }

      this.player.setVelocity(vx * SPEED, vy * SPEED);

      if (vx === 0 && vy === 0) {
        this.player.anims.stop();
        const idle = { down: 0, right: 5, up: 10, left: 15 }[this.facing];
        this.player.setFrame(idle);
        return;
      }

      if (Math.abs(vx) > Math.abs(vy)) {
        this.facing = vx > 0 ? "right" : "left";
      } else {
        this.facing = vy > 0 ? "down" : "up";
      }
      this.player.anims.play(`walk-${this.facing}`, true);
    }
  }

  window.TrifulcaChapter2 = window.TrifulcaChapter2 || {};
  window.TrifulcaChapter2.GameScene = GameScene;
})();
