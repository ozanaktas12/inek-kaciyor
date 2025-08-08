kaboom({
  width: 400,
  height: 720,
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
    width: "min(100vw, 440px)",
    height: "auto",
    maxHeight: "95vh",
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
  add([
    text("İnek Kaçıyor", { size: 32 }),
    pos(center().x, center().y - 100),
    anchor("center")
  ]);

  // --- Name input as clickable box
  let typingEnabled = false;
  let caretVisible = true;
  loop(0.5, () => (caretVisible = !caretVisible));

  const nameBox = add([
    rect(240, 40),
    pos(center().x, center().y - 20),
    anchor("center"),
    area(),
    color(255, 255, 255),
    outline(3, rgb(30, 122, 30)),
    z(5),
    "nameBox",
  ]);

  const namePlaceholder = add([
    text("İsminizi yazın...", { size: 16 }),
    pos(center().x, center().y - 20),
    anchor("center"),
    color(120, 120, 120),
    z(6),
    "namePlaceholder",
  ]);

  const nameText = add([
    text("", { size: 16 }),
    pos(center().x, center().y - 20),
    anchor("center"),
    color(0, 0, 0),
    area(),
    z(7),
    { value: "" },
    "nameText",
  ]);

  onClick("nameBox", () => {
    typingEnabled = true;
    namePlaceholder.hidden = true;
  });

  onClick("nameText", () => {
    typingEnabled = true;
    namePlaceholder.hidden = true;
  });

  onUpdate("nameBox", (b) => {
    // Hover feedback for name input box (kaboom v3000: isHovering())
    const hovered = (typeof b.isHovering === "function") ? b.isHovering() : false;
    if (b.outline) {
      b.outline.color = hovered ? rgb(46, 166, 46) : rgb(30, 122, 30);
    }
  });

  onKeyPress((ch) => {
    if (!typingEnabled) return;
    if (ch === "backspace") {
      nameText.value = nameText.value.slice(0, -1);
    } else if (ch === "enter") {
      // ignore enter here
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

  // --- Start button as a real button with proper hitbox
  const startButton = add([
    rect(180, 46),
    pos(center().x, center().y + 50),
    anchor("center"),
    area(),
    color(255, 255, 0),
    outline(3, rgb(20, 20, 20)),
    z(5),
    "startBtn",
    { hover: false },
  ]);

  const startLabel = add([
    text("Başla", { size: 20 }),
    pos(center().x, center().y + 50),
    anchor("center"),
    color(0, 0, 0),
    z(6),
  ]);

  onUpdate("startBtn", (b) => {
    const hovered = (typeof b.isHovering === "function") ? b.isHovering() : false;
    b.color = hovered ? rgb(255, 230, 0) : rgb(255, 255, 0);
    startLabel.scale = hovered ? vec2(1.05) : vec2(1);
  });

  onClick("startBtn", () => {
    playerName = (nameText.value && nameText.value.trim()) ? nameText.value.trim() : "Misafir";
    go("main");
  });

  onKeyPress("enter", () => {
    // Allow Enter to start the game as well
    if (!isScene("menu")) return;
    playerName = (nameText.value && nameText.value.trim()) ? nameText.value.trim() : "Misafir";
    go("main");
  });

  // Leaderboard göster
  add([
    text("En Yüksek Skorlar", { size: 18 }),
    pos(center().x, center().y + 100),
    anchor("center")
  ]);

  leaderboard.slice(0, 5).forEach((entry, i) => {
    add([
      text(`${i+1}. ${entry.name}: ${entry.score}`, { size: 14 }),
      pos(center().x, center().y + 130 + i * 20),
      anchor("center")
    ]);
  });
});

// ---- Main sahnesi
scene("main", () => {
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
    let lastTap = 0;
    c.addEventListener("touchstart", (e) => {
      const t = e.touches[0];
      if (!t) return;
      const r = c.getBoundingClientRect();
      const x = t.clientX - r.left;
      const y = t.clientY - r.top;

      // Üst bölgeye dokunma => ateş
      if (y < r.height * 0.35) {
        shoot();
      } else {
        // Alt bölgede sol/sağ yarı => şerit değiştir
        if (x < r.width / 2) {
          if (player.lane > 0) {
            player.lane--;
            player.pos.x = laneX(player.lane);
          }
        } else {
          if (player.lane < LANES - 1) {
            player.lane++;
            player.pos.x = laneX(player.lane);
          }
        }
      }

      // Çift dokunma da ateş etsin
      const now = Date.now();
      if (now - lastTap < 300) {
        shoot();
      }
      lastTap = now;
    });
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