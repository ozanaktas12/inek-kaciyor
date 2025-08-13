// ---- Responsive canvas boyutu
function getCanvasSize() {
  const isMobile = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent) || window.innerWidth < 600;
  const targetAspect = 9 / 16; // portrait (width / height)

  if (isMobile) {
    // 1) Start from viewport width (~96% of screen width)
    let W = Math.floor(window.innerWidth * 0.96);
    // 2) Compute height from aspect ratio: height = width / (width/height)
    let H = Math.floor(W / targetAspect);
    // 3) Cap height to ~96% of viewport height; re-compute width if needed
    const maxH = Math.floor(window.innerHeight * 0.96);
    if (H > maxH) {
      H = maxH;
      W = Math.floor(H * targetAspect);
    }
    return { W, H };
  }

  // Desktop behavior (unchanged): base on viewport height
  const screenH = Math.floor(window.innerHeight * 0.98);
  const baseH = Math.min(screenH, 1000);
  const H = Math.max(720, baseH);
  const W = Math.round(H * targetAspect);
  return { W, H };
}
const { W: K_WIDTH, H: K_HEIGHT } = getCanvasSize();

kaboom({
  width: K_WIDTH,   // eski: 400
  height: K_HEIGHT, // eski: 720
  background: [13, 13, 26], // koyu gece mavisi
});

let playerName = "";
let leaderboard = JSON.parse(localStorage.getItem("leaderboard") || "[]");

// ---- Music state
let bgmHandle = null;
let isMuted = false;
try {
  const saved = localStorage.getItem("muted");
  if (saved !== null) isMuted = JSON.parse(saved);
} catch {}

function setMuted(m) {
  isMuted = m;
  try { localStorage.setItem("muted", JSON.stringify(isMuted)); } catch {}
  if (bgmHandle && !bgmHandle.stopped) {
    bgmHandle.volume = isMuted ? 0 : 0.45;
  }
}

function ensureBGMStarted() {
  // Başla’ya basılınca bir kere başlat; mute ise sessiz başla.
  if (!bgmHandle || bgmHandle.stopped) {
    bgmHandle = play("bgm", { loop: true, volume: isMuted ? 0 : 0.45 });
  } else {
    bgmHandle.volume = isMuted ? 0 : 0.45;
  }
}

// ---- Ayarlar
const LANES = 4;
const laneW = width() / LANES;

// Boyut ve hız ayarları
const COW_SCALE = 0.06;
const OBSTACLE_SCALE = 0.29;
const HAY_SCALE = 0.33;
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
const SHIELD_SPRITE_SCALE = 0.12;   // mavi logo biraz büyüt

// Puan çarpanı (multiplier) ayarları
const MULTIPLIER_DURATION = 7.5; // saniye
const MULTIPLIER_VALUE = 2;      // 2x puan
const MULT_SIZE = vec2(22, 22);
const MULT_SPRITE_SCALE   = 0.06;   // mor kristali küçült

function laneX(lane) {
  return lane * laneW + laneW / 2;
}

// ---- Assetler
loadSprite("cow", "assets/inek_oyun_gpt.png");
loadSprite("fence", "assets/cit_oyun_gpt.png");
loadSprite("hay", "assets/saman_oyun_gpt.png");
// Yeni bonus sprite'ları
loadSprite("imm_logo", "assets/logo_transparent_gpt.png");                 // ölümsüzlük (mavi logo)
loadSprite("bonus_crystal", "assets/purple_bonus_crystal_transparent_gpt.png"); // 2x (mor kristal)
// Background music
loadSound("bgm", "assets/audio/bgm.mp3");

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
      "radial-gradient(circle at 30% 30%, rgba(0,0,50,0.32), transparent 40%)," +
      "radial-gradient(circle at 70% 20%, rgba(50,0,80,0.22), transparent 50%)," +
      "radial-gradient(circle at 50% 80%, rgba(0,50,80,0.18), transparent 40%)," +
      "radial-gradient(circle at 80% 80%, rgba(50,50,80,0.11), transparent 35%)," +
      "linear-gradient(135deg, #0d0d1a 0%, #1a1a2e 40%, #23233a 80%, #181828 100%)",
  });
  const isMobile = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent) || window.innerWidth < 600;

  if (isMobile) {
    // MOBILE: match CSS size to Kaboom internal pixels to fix touch hitbox offset
    Object.assign(c.style, {
      imageRendering: "pixelated",
      borderRadius: "12px",
      boxShadow: "0 10px 30px rgba(0,0,0,0.35)",
      width: `${K_WIDTH}px`,
      height: `${K_HEIGHT}px`,
    });
  } else {
    // DESKTOP: keep responsive layout
    Object.assign(c.style, {
      imageRendering: "pixelated",
      borderRadius: "12px",
      boxShadow: "0 10px 30px rgba(0,0,0,0.35)",
      width: "min(100vw, 720px)",
      height: "auto",
      maxHeight: "100vh",
    });
  }
}
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", applyLayout);
} else {
  applyLayout();
}
window.addEventListener("resize", applyLayout);

// ---- Menü sahnesi
scene("menu", () => {
  const IS_MOBILE = ("ontouchstart" in window) || window.innerWidth < 600;
  // Professional, clean spacing (proportional)
  const Y_TITLE = IS_MOBILE ? height() * 0.35 : height() * 0.24;
  const Y_INPUT = IS_MOBILE ? height() * 0.44 : height() * 0.44; // unchanged for desktop
  const Y_BUTTON = IS_MOBILE ? height() * 0.52 : height() * 0.62;
  const Y_HISCORES_TITLE = IS_MOBILE ? height() * 0.68 : height() * 0.74;
  const Y_HISCORES_LIST = IS_MOBILE ? height() * 0.73 : height() * 0.78;
  const Y_MUTE = IS_MOBILE ? height() * 0.58 : height() * 0.56;

  function muteLabelText() {
    return isMuted ? "🔇 Mute off" : "🔊 mute on";
  }
  function muteLabelColor() {
    return isMuted ? rgb(180, 180, 180) : rgb(0, 0, 0);
  }

  add([
    text("Mission Cowpossible", { size: 34 }),
    pos(width() / 2, Y_TITLE),
    anchor("center"),
    z(10),
  ]);

  // --- Name input as clickable box (desktop only)
  if (!IS_MOBILE) {
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
      text("Add your name :", { size: 18 }),
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
  } // end desktop-only name input


  // --- Mute toggle (oyuna başlamadan önce aç/kapat)
  const muteBtnW = IS_MOBILE ? Math.floor(width() * 0.5) : 220;
  const muteBtnH = IS_MOBILE ? 56 : 44;
  const muteBtn = add([
    rect(muteBtnW, muteBtnH),
    pos(width() / 2, Y_MUTE),
    anchor("center"),
    area(),
    color(230, 230, 230),
    outline(3, rgb(20, 20, 20)),
    z(5),
    "muteBtn",
  ]);

  const muteText = add([
    text(muteLabelText(), { size: 18 }),
    pos(width() / 2, Y_MUTE),
    anchor("center"),
    color(muteLabelColor()),
    z(6),
    "muteText",
  ]);

  onUpdate("muteBtn", (b) => {
    // Hover efekti (desktop)
    const hovered = (typeof b.isHovering === "function") ? b.isHovering() : false;
    b.color = hovered ? rgb(245, 245, 245) : rgb(230, 230, 230);
    // Label pozisyonunu senkron tut
    muteText.pos = b.pos.clone();
  });

  function toggleMute() {
    setMuted(!isMuted);
    muteText.text = muteLabelText();
    muteText.color = muteLabelColor();
  }

  onClick("muteBtn", toggleMute);
  onKeyPress("m", toggleMute);

  function startGame() {
    const nm = (!IS_MOBILE && typeof nameText !== "undefined" && nameText.value && nameText.value.trim()) ? nameText.value.trim() : "";
    playerName = nm || "Misafir";
    go("main");
  }

  // --- Start button as a real button with proper hitbox
  const startButtonWidth = IS_MOBILE ? Math.floor(width() * 0.8) : 320;
  const startButtonHeight = IS_MOBILE ? 80 : 56;
  const startButton = add([
    rect(startButtonWidth, startButtonHeight),
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
    text("start", { size: 22 }),
    pos(width() / 2, Y_BUTTON),
    anchor("center"),
    color(0, 0, 0),
    z(6),
  ]);

  onUpdate(() => {
    startLabel.pos = startButton.pos.clone();
  });

  if (!IS_MOBILE) {
    add([
      text("You can also start with Enter", { size: 12 }),
      pos(width() / 2, Y_BUTTON + 38),
      anchor("center"),
      color(220, 220, 220),
      z(6),
    ]);
  }

  onUpdate("startBtn", (b) => {
    const hovered = (typeof b.isHovering === "function") ? b.isHovering() : false;
    b.color = hovered ? rgb(250, 215, 70) : rgb(245, 208, 66); // soft yellow
  });

  onClick("startBtn", () => {
    ensureBGMStarted();
    startGame();
  });

  onKeyPress("enter", () => {
    ensureBGMStarted();
    startGame();
  });

  // Leaderboard göster
  add([
    text("The Highest Scores :", { size: 18 }),
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
  // Oyun yeniden başladığında (R ile) BGM'yi tekrar başlat (mute durumuna saygılı)
  ensureBGMStarted();
  // --- Mobile-aware sizing & performance knobs (desktop unaffected)
  const IS_MOBILE_MAIN = ("ontouchstart" in window) || window.innerWidth < 600;
  const COW_SCALE_M = IS_MOBILE_MAIN ? 0.08 : COW_SCALE;          // cow bigger on mobile
  const OBSTACLE_SCALE_M = IS_MOBILE_MAIN ? 0.40 : OBSTACLE_SCALE; // fences bigger
  const HAY_SCALE_M = IS_MOBILE_MAIN ? 0.56 : HAY_SCALE;           // hay bigger

  // ==== Gece şehir arka planı (neon, soğuk tonlar)
function addBuilding(x, w, h, baseY = height()) {
  const b = add([
    rect(w, h),
    pos(x, baseY - h),
    color(22 + rand(0, 10), 24 + rand(0, 12), 40 + rand(0, 16)), // koyu mavi-gri
    z(-30),
    opacity(0.9),
  ]);
  // pencere dokusu (hafif neon)
  const cols = Math.max(2, Math.floor(w / 18));
  const rows = Math.max(3, Math.floor(h / 28));
  for (let i = 0; i < cols; i++) {
    for (let j = 0; j < rows; j++) {
      if (Math.random() < 0.35) continue; // bazı pencereler kapalı
      add([
        rect(10, 6),
        pos(x + 5 + i * (w / cols), baseY - h + 6 + j * (h / rows)),
        color(120, 200 + rand(0, 55), 255),
        opacity(0.10 + rand(0, 0.05)), // daha silik
        z(-36), // katmanları şeritlerin çok arkasına al
      ]);
    }
  }
  return b;
}

function createCityBackground() {
  // ufuk çizgisi parıltısı
  add([rect(width(), 2), pos(0, height() * 0.72), color(80, 200, 255), opacity(0.08), z(-35)]);
  // uzak katman
  for (let i = 0; i < 7; i++) {
    const w = rand(60, 140), h = rand(height() * 0.25, height() * 0.55);
    addBuilding(rand(-30, width() - 30), w, h);
  }
  // yakın katman
  for (let i = 0; i < 5; i++) {
    const w = rand(80, 180), h = rand(height() * 0.35, height() * 0.7);
    const b = addBuilding(rand(-20, width() - 20), w, h);
    b.opacity = 0.95;
  }
  // hafif gece sisi
  add([rect(width(), height()), pos(0, 0), color(20, 20, 40), opacity(0.05), z(-31)]);
}
createCityBackground();
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

  // Şerit zeminleri (koyu asfalt) ve neon ayırıcı çizgiler
for (let i = 0; i < LANES; i++) {
  add([rect(laneW - 6, height()), pos(i * laneW + 3, 0), color(28, 28, 40), opacity(1), z(-10)]);
}
for (let i = 1; i < LANES; i++) {
  add([rect(3, height()), pos(i * laneW - 1.5, 0), color(80, 200, 255), opacity(0.35), z(-5)]);
}

  const scoreLabel = add([
  text("0", { size: 18 }),
  pos(12, 10),
  color(180, 230, 255), // soft neon mavi
  z(1002),
]);

  const multLabel = add([
    text("2x"),
    pos(width() - 12, 10),
    anchor("topright"),
    color(255, 60, 200), // neon magenta
    z(1001),
  ]);
  multLabel.hidden = true;

  const player = add([
    sprite("cow"),
    pos(laneX(1), IS_MOBILE_MAIN ? height() - 120 : height() - 80),
    area(),
    anchor("center"),
    scale(COW_SCALE_M),
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
    color(255, 60, 200), // neon magenta
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

    const sc = (type === "fence") ? OBSTACLE_SCALE_M : (type === "hay" ? HAY_SCALE_M : 1);

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
      comps.push(scale(OBSTACLE_SCALE_M));
      comps.push(area());
    } else if (type === "hay") {
      comps.unshift(sprite("hay"));
      comps.push(scale(HAY_SCALE_M));
      comps.push(area({ scale: 0.75 }));
    } else if (type === "shield") {
      // Ölümsüzlük: mavi logo sprite
      comps.unshift(sprite("imm_logo"));
      comps.push(scale(SHIELD_SPRITE_SCALE));
      comps.push(opacity(1));
      comps.push(outline(2, rgb(120, 240, 255)));
      comps.push(area({ scale: 0.85 }));
    } else if (type === "multiplier") {
      // 2x Puan: mor kristal sprite
      comps.unshift(sprite("bonus_crystal"));
      comps.push(scale(MULT_SPRITE_SCALE));
      comps.push(opacity(1));
      comps.push(area({ scale: 0.85 }));
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
    text(`Score: ${finalScore}\nR - Play again`),
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