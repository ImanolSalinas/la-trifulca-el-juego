(() => {
  const { BootScene, GameScene } = window.TrifulcaChapter2;

  const config = {
    type: Phaser.AUTO,
    parent: "game",
    backgroundColor: "#0a0c10",
    pixelArt: true,
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      width: 640,
      height: 420,
    },
    physics: {
      default: "arcade",
      arcade: {
        gravity: { y: 0 },
        debug: false,
      },
    },
    scene: [BootScene, GameScene],
  };

  // eslint-disable-next-line no-new
  new Phaser.Game(config);
})();
