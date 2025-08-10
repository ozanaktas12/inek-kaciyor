// ---- Responsive canvas boyutu
function getCanvasSize() {
  const isMobile = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent) || window.innerWidth < 600;
  const targetAspect = 9 / 16; // portrait
  const screenH = Math.floor(window.innerHeight * 0.98);
  const baseH = isMobile ? Math.min(screenH, 960) : Math.min(screenH, 1000);
  const H = Math.max(720, baseH);
  const W = Math.round(H * targetAspect);
  return { W, H };
}
const { W: K_WIDTH, H: K_HEIGHT } = getCanvasSize();

kaboom({
  width: K_WIDTH,   // eski: 400
  height: K_HEIGHT, // eski: 720
  background: [34, 139, 34],
});

let playerName = "";
let leaderboard = JSON.parse(localStorage.getItem("leaderboard") || "[]");

// ---- Ayarlar
const LANES = 4;
const laneW = width() / LANES;

// Boyut ve hız ayarları
const COW_SCALE = 0.04;
const OBSTACLE_SCALE = 0.32;
const HAY_SCALE = 0.45;
// Hız ayarları
const BASE_FALL_SPEED = 500;
let fallSpeed = BASE_FALL_SPEED;
const DIFFICULTY_RATE = 8; // saniye başına düşüş hızına eklenecek piksel (px/s)

// Mermi (bullet) ayarları
const BULLET_SPEED = 500;
const BULLET_SIZE = vec2(4, 12);
const SHOOT_COOLDOWN = 0.9; // saniye

// Kalkan (shield) ayarları
const SHIELD_DURATION = 3.0; // saniye
const SHIELD_CHANCE = 0.05; // her spawn döngüsünde kalkan çıkma olasılığı
const SHIELD_SIZE = vec2(22, 22);

// Puan çarpanı (multiplier) ayarları
const MULTIPLIER_DURATION = 7.5; // saniye
const MULTIPLIER_VALUE = 2;      // 2x puan
const MULT_SIZE = vec2(22, 22);

function laneX(lane) {
  return lane * laneW + laneW / 2;
}

// ---- Assetler
loadSprite("cow", "assets/inek_oyun_gpt.png");
loadSprite("fence", "assets/cit_oyun_gpt.png");
loadSprite("hay", "assets/saman_oyun_gpt.png");

// ---- Sayfa yerleşimi ve görünüm (canvas'ı ortala, arka planı şekillendir, mobil boyutlandırma)
function applyLayout() {
  const c = document.querySelector("canvas");
  if (!c) return;
  document.documentElement.style.height = "100%";
  Object.assign(document.body.style, {
    margin: "0",
    minHeight: "100vh",
    display: "grid",
    placeItems: "center",
    background:
      "radial-gradient(circle at 20% 20%, rgba(255,255,255,0.15), transparent 40%)," +
      "radial-gradient(circle at 80% 30%, rgba(255,255,255,0.12), transparent 45%)," +
      "radial-gradient(circle at 30% 80%, rgba(255,255,255,0.1), transparent 35%)," +
      "linear-gradient(135deg, #1e7a1e 0%, #2ea62e 50%, #1e7a1e 100%)",
  });
  Object.assign(c.style, {
    imageRendering: "pixelated",
    borderRadius: "12px",
    boxShadow: "0 10px 30px rgba(0,0,0,0.35)",
    width: (/Mobi|Android|iPhone|iPad/i.test(navigator.userAgent) || window.innerWidth < 600) ? "100vw" : "min(100vw, 720px)",
    height: "auto",
    maxHeight: "100vh",
  });
}
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", applyLayout);
} else {
  applyLayout();
}
window.addEventListener("resize", applyLayout);

// ---- Menü sahnesi
scene("menu", () => {
  // Professional, clean spacing (proportional)
  const Y_TITLE = height() * 0.24;
  const Y_INPUT = height() * 0.44;
  const Y_BUTTON = height() * 0.62;
  const Y_HISCORES_TITLE = height() * 0.74;
  const Y_HISCORES_LIST = height() * 0.78;

  add([
    text("İnek Kaçıyor", { size: 34 }),
    pos(width() / 2, Y_TITLE),
    anchor("center"),
    z(10),
  ]);

  // --- Name input as clickable box
  let typingEnabled = false;
  let caretVisible = true;
  loop(0.5, () => (caretVisible = !caretVisible));

  const nameBox = add([
    rect(260, 48),
    pos(width() / 2, Y_INPUT),
    anchor("center"),
    area(),
    color(255, 255, 255),
    outline(4, rgb(255, 255, 255)),
    z(5),
    "nameBox",
  ]);

  const namePlaceholder = add([
    text("İsminizi yazın...", { size: 18 }),
    pos(width() / 2, Y_INPUT),
    anchor("center"),
    color(120, 120, 120),
    z(6),
    "namePlaceholder",
  ]);

  const nameText = add([
    text("", { size: 18 }),
    pos(width() / 2, Y_INPUT),
    anchor("center"),
    color(0, 0, 0),
    z(7),
    { value: "" },
    "nameText",
  ]);

  onClick("nameBox", () => {
    typingEnabled = true;
    namePlaceholder.hidden = true;
  });

  onUpdate("nameBox", (b) => {
    if (b.outline) {
      b.outline.color = rgb(255, 255, 255);
    }
  });

  onKeyPress((ch) => {
    if (!typingEnabled) return;
    if (ch === "backspace") {
      nameText.value = nameText.value.slice(0, -1);
    } else if (ch === "enter") {
      startGame();
      return;
    } else if (ch.length === 1 && nameText.value.length < 12) {
      nameText.value += ch;
    }
    nameText.text = caretVisible ? nameText.value + "|" : nameText.value;
    playerName = nameText.value || "Misafir";
  });

  onKeyPress("escape", () => {
    typingEnabled = false;
    if (!nameText.value) namePlaceholder.hidden = false;
    nameText.text = nameText.value;
  });

  function startGame() {
    playerName = (nameText.value && nameText.value.trim()) ? nameText.value.trim() : "Misafir";
    go("main");
  }

  // --- Start button as a real button with proper hitbox
  const startButton = add([
    rect(320, 56),
    pos(width() / 2, Y_BUTTON),
    anchor("center"),
    area(),
    color(245, 208, 66),
    outline(3, rgb(20, 20, 20)),
    z(5),
    "startBtn",
    { hover: false },
  ]);

  const startLabel = add([
    text("Başla", { size: 22 }),
    pos(width() / 2, Y_BUTTON),
    anchor("center"),
    color(0, 0, 0),
    z(6),
  ]);

  onUpdate(() => {
    startLabel.pos = startButton.pos.clone();
  });

  add([
    text("Enter ile de başlayabilirsin", { size: 12 }),
    pos(width() / 2, Y_BUTTON + 38),
    anchor("center"),
    color(220, 220, 220),
    z(6),
  ]);

  onUpdate("startBtn", (b) => {
    const hovered = (typeof b.isHovering === "function") ? b.isHovering() : false;
    b.color = hovered ? rgb(250, 215, 70) : rgb(245, 208, 66); // soft yellow
  });

  onClick("startBtn", startGame);

  onKeyPress("enter", () => {
    startGame();
  });

  // Leaderboard göster
  add([
    text("En Yüksek Skorlar", { size: 18 }),
    pos(width() / 2, Y_HISCORES_TITLE),
    anchor("center"),
    z(10),
  ]);

  leaderboard.slice(0, 5).forEach((entry, i) => {
    add([
      text(`${i + 1}. ${entry.name}: ${entry.score}`, { size: 14 }),
      pos(width() / 2, Y_HISCORES_LIST + i * 20),
      anchor("center"),
      z(10),
    ]);
  });
});

// ---- Main sahnesi
scene("main", () => {
  // Subtle procedural grass background (drawn behind lanes)
  function addGrassTuft(x, y, scale = 1) {
    const baseColor = [40 + rand(0, 20), 140 + rand(0, 30), 40 + rand(0, 20)];
    const group = [];
    for (let i = -2; i <= 2; i++) {
      group.push(add([
        rect(3, 12 * scale),
        pos(x + i * 3, y + rand(-2, 2)),
        color(baseColor[0], baseColor[1], baseColor[2]),
        z(-20),
        { sway: rand(0.8, 1.3) },
      ]));
    }
    group.forEach((blade, idx) => {
      blade.onUpdate(() => {
        blade.pos.x += Math.sin(time() * blade.sway + idx) * 0.05;
      });
    });
  }

  function createGrassBackground() {
    for (let y = 30; y < height(); y += 70) {
      for (let x = 20; x < width(); x += 80) {
        addGrassTuft(x + rand(-10, 10), y + rand(-8, 8), rand(0.9, 1.3));
      }
    }
  }

  createGrassBackground();
  let score = 0;
  const startTime = time();
  onUpdate(() => {
    const elapsed = time() - startTime;
    fallSpeed = BASE_FALL_SPEED + elapsed * DIFFICULTY_RATE;
  });

  // Kalkan durum yönetimi
  let invUntil = 0; // time() ile kıyaslanacak
  function isInvincible() {
    return time() < invUntil;
  }

  // Puan çarpanı durum yönetimi
  let multUntil = 0; // time() ile karşılaştırılacak
  function isMultiplierOn() {
    return time() < multUntil;
  }
  function addScore(n) {
    const m = isMultiplierOn() ? MULTIPLIER_VALUE : 1;
    score += Math.floor(n * m);
    scoreLabel.text = String(score);
  }

  // Şerit zeminleri ve ayırıcı çizgiler
  for (let i = 0; i < LANES; i++) {
    add([
      rect(laneW - 6, height()),
      pos(i * laneW + 3, 0),
      color(46, 160, 46),
      z(-10),
    ]);
  }
  for (let i = 1; i < LANES; i++) {
    add([
      rect(4, height()),
      pos(i * laneW - 2, 0),
      color(255, 255, 255),
      z(-5),
    ]);
  }

  const scoreLabel = add([
    text("0"),
    pos(10, 10),
  ]);

  const multLabel = add([
    text("2x"),
    pos(width() - 12, 10),
    anchor("topright"),
    color(255, 255, 0),
    z(1001),
  ]);
  multLabel.hidden = true;

  const player = add([
    sprite("cow"),
    pos(laneX(1), height() - 80),
    area(),
    anchor("center"),
    scale(COW_SCALE),
    z(1000),
    opacity(1),
    "player",
    { lane: 1 },
  ]);

  // Multiplier UI göstergesi
  onUpdate(() => {
    multLabel.hidden = !isMultiplierOn();
  });

  // Kalkan aktifken görsel geri bildirim (yanıp sönme)
  onUpdate(() => {
    if (isInvincible()) {
      player.opacity = 0.5 + 0.5 * Math.sin(time() * 20);
    } else {
      player.opacity = 1;
    }
  });

  // ---- Ateş etme (yukarı doğru)
  let canShoot = true;

  function spawnBullet() {
  // Flash efekti
  add([
    rect(6, 6),
    pos(player.pos.x, player.pos.y - 30),
    anchor("center"),
    color(255, 255, 150),
    lifespan(0.06, { fade: 0.06 }), // 0.06 sn sonra kaybolur
    z(1200),
  ]);

  // Mermi
  add([
    rect(BULLET_SIZE.x, BULLET_SIZE.y),
    pos(player.pos.x, player.pos.y - 20),
    anchor("center"),
    area(),
    move(UP, BULLET_SPEED),
    offscreen({ destroy: true }),
    color(255, 255, 0),
    "bullet",
  ]);
}

  function shoot() {
    if (!canShoot) return;
    spawnBullet();
    canShoot = false;
    wait(SHOOT_COOLDOWN, () => (canShoot = true));
  }

  onKeyPress("space", shoot);
  onKeyPress("up", shoot);

  onKeyPress("left", () => {
    if (player.lane > 0) {
      player.lane--;
      if (player.lane < 0) player.lane = 0;
      player.pos.x = laneX(player.lane);
    }
  });

  onKeyPress("right", () => {
    if (player.lane < LANES - 1) {
      player.lane++;
      if (player.lane > LANES - 1) player.lane = LANES - 1;
      player.pos.x = laneX(player.lane);
    }
  });

  // ---- Mobil dokunmatik kontroller
  function setupMobileControls() {
  const c = document.querySelector("canvas");
  if (!("ontouchstart" in window) || !c) return;

  const r = () => c.getBoundingClientRect();
  let touchStartX = 0;
  let touchStartY = 0;
  let autofireTimer = null;

  function startAutofire() {
    if (autofireTimer) return;
    // SHOOT_COOLDOWN'dan biraz daha hızlı hissettirmek için ufak çarpan
    autofireTimer = setInterval(() => shoot(), Math.max(150, SHOOT_COOLDOWN * 800));
  }
  function stopAutofire() {
    if (autofireTimer) {
      clearInterval(autofireTimer);
      autofireTimer = null;
    }
  }

  c.addEventListener("touchstart", (e) => {
    const t = e.touches[0];
    if (!t) return;
    const box = r();
    const x = t.clientX - box.left;
    const y = t.clientY - box.top;

    touchStartX = x;
    touchStartY = y;

    // Ekranı 3'e böl: sol = sola geç, orta = ateş, sağ = sağa geç
    const third = box.width / 3;

    if (y < box.height * 0.3) {
      // üst %30: direkt ateş + basılı tutarsan yarı otomatik ateş
      shoot();
      startAutofire();
    } else if (x < third) {
      if (player.lane > 0) { player.lane--; player.pos.x = laneX(player.lane); }
    } else if (x > 2 * third) {
      if (player.lane < LANES - 1) { player.lane++; player.pos.x = laneX(player.lane); }
    } else {
      // orta şerit: tek dokunuş = ateş
      shoot();
      startAutofire();
    }
  }, { passive: true });

  c.addEventListener("touchmove", (e) => {
    if (!e.touches[0]) return;
    const box = r();
    const x = e.touches[0].clientX - box.left;
    const dx = x - touchStartX;

    // Swipe ile hızlı şerit değiştirme
    const SWIPE_THRESHOLD = 40;
    if (dx > SWIPE_THRESHOLD) {
      touchStartX = x; // art arda swipe'lara izin
      if (player.lane < LANES - 1) { player.lane++; player.pos.x = laneX(player.lane); }
    } else if (dx < -SWIPE_THRESHOLD) {
      touchStartX = x;
      if (player.lane > 0) { player.lane--; player.pos.x = laneX(player.lane); }
    }
  }, { passive: true });

  ["touchend", "touchcancel"].forEach(evt =>
    c.addEventListener(evt, () => stopAutofire(), { passive: true })
  );
}
  setupMobileControls();

  // Engel/ödül/kalkan/çarpan üret
  loop(0.6, () => {
    const lane = Math.floor(rand(0, LANES));

    // Tür seçimi ağırlıkları: çit > saman > (kalkan ~%5) > (çarpan ~%5)
    const r = Math.random();
    let type;
    if (r < 0.65) {
      type = "fence";           // ~%65
    } else if (r < 0.90) {
      type = "hay";             // ~%25
    } else if (r < 0.95) {
      type = "shield";          // ~%5
    } else {
      type = "multiplier";      // ~%5 (2x puan)
    }

    const sc = (type === "fence") ? OBSTACLE_SCALE : (type === "hay" ? HAY_SCALE : 1);

    let comps = [
      anchor("center"),
      pos(laneX(lane), -40),
      move(DOWN, fallSpeed),
      offscreen({ destroy: true }),
      z(0),
      type,
    ];

    if (type === "fence") {
      comps.unshift(sprite("fence"));
      comps.push(scale(OBSTACLE_SCALE));
      comps.push(area());
    } else if (type === "hay") {
      comps.unshift(sprite("hay"));
      comps.push(scale(sc));
      comps.push(area({ scale: 0.75 }));
    } else if (type === "shield") {
      // Basit görsel: turkuaz kare power-up
      comps.unshift(rect(SHIELD_SIZE.x, SHIELD_SIZE.y));
      comps.push(color(0, 200, 255));
      comps.push(area());
    } else if (type === "multiplier") {
      // Mor bir kare olarak 2x puan güçlendirici
      comps.unshift(rect(MULT_SIZE.x, MULT_SIZE.y));
      comps.push(color(180, 0, 200));
      comps.push(area());
    }

    const obj = add(comps);

    if (type === "hay") {
      obj.onCollide("player", () => {
        obj.destroy();
        addScore(10);
      });
    }

    if (type === "shield") {
      obj.onCollide("player", () => {
        obj.destroy();
        invUntil = time() + SHIELD_DURATION;
      });
    }

    if (type === "multiplier") {
      obj.onCollide("player", () => {
        obj.destroy();
        multUntil = time() + MULTIPLIER_DURATION;
      });
    }

    if (type === "fence") {
      // Bazı çitler geliş sırasında sağa-sola hareket etsin
      if (Math.random() < 0.35) {
        let dir = Math.random() < 0.5 ? -1 : 1; // başlangıç yönü
        const H_MOVE_SPEED = 80;                // px/sn
        const MARGIN = 20;                      // kenarlara çarpınca yön değiştir
        obj.onUpdate(() => {
          obj.pos.x += dir * H_MOVE_SPEED * dt();
          if (obj.pos.x < MARGIN || obj.pos.x > width() - MARGIN) {
            dir *= -1; // sekme
          }
        });
      }

      // Mermi çite çarparsa çit yıkılsın ve mermi yok olsun
      obj.onCollide("bullet", (b) => {
        obj.destroy();
        b.destroy();
        addScore(5);
      });

      // Oyuncu çite çarparsa: kalkan varsa hayatta kal, yoksa oyun biter
      obj.onCollide("player", () => {
        if (isInvincible()) {
          obj.destroy();
          addScore(2); // kalkanla çit kırma bonusu
        } else {
          go("gameover", score);
        }
      });
    }
  });

  onUpdate(() => {
    player.pos.x = laneX(player.lane);
  });
});

// ---- Game over sahnesi
scene("gameover", (finalScore) => {
  leaderboard.push({ name: playerName, score: finalScore });
  leaderboard.sort((a,b) => b.score - a.score);
  localStorage.setItem("leaderboard", JSON.stringify(leaderboard));
  add([
    text(`Skor: ${finalScore}\nR - Yeniden Oyna`),
    pos(center()),
    anchor("center")
  ]);
  onKeyPress("r", () => go("main"));
  wait(2, () => {
    go("menu");
  });
});

// Başlat
go("menu");

// Mobil cihazlarda dokunmatik kontroller kullanılabilir.