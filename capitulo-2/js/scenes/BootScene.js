(() => {
  class BootScene extends Phaser.Scene {
    constructor() {
      super("boot");
    }

    preload() {
      this.load.image("bellas-artes", "assets/bellas-artes.jpg");
      this.load.spritesheet("ima", "../assets/ima-walk.png", {
        frameWidth: 65,
        frameHeight: 94,
      });
    }

    create() {
      this.scene.start("game");
    }
  }

  window.TrifulcaChapter2 = window.TrifulcaChapter2 || {};
  window.TrifulcaChapter2.BootScene = BootScene;
})();
