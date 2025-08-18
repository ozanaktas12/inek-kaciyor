# app.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import sqlite3, os

DB_PATH = os.getenv("DB_PATH") or os.path.join(os.path.dirname(__file__), "scores.db")

def get_db():
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.execute("""
    CREATE TABLE IF NOT EXISTS scores (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      score INTEGER NOT NULL,
      ts DATETIME DEFAULT CURRENT_TIMESTAMP
    )
    """)
    return conn

db = get_db()
app = FastAPI()

# Geliştirirken her yerden istek gelsin; deploy'da domainine kısıtlayabilirsin
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], allow_credentials=True,
    allow_methods=["*"], allow_headers=["*"],
)

class ScoreIn(BaseModel):
    name: str
    score: int

@app.post("/score")
def post_score(s: ScoreIn):
    name = (s.name or "Player").strip()[:20]
    score = int(s.score)
    with db:
        db.execute("INSERT INTO scores(name, score) VALUES(?, ?)", (name, score))
    return {"ok": True}

@app.get("/top")
def top(limit: int = 5):
    cur = db.cursor()
    cur.execute("SELECT name, score, ts FROM scores ORDER BY score DESC, ts ASC LIMIT ?", (limit,))
    rows = [{"name": r[0], "score": r[1], "ts": r[2]} for r in cur.fetchall()]
    return {"rows": rows}

from fastapi.responses import PlainTextResponse

@app.get("/", response_class=PlainTextResponse)
def root():
    return "Score API up. Try /docs or /top"

# --- DEV/ADMIN DELETE ENDPOINTS ---
from typing import Optional
from fastapi import Query

@app.delete("/reset")
def reset_all():
    # DEV-ONLY: Tüm skorları siler
    with db:
        db.execute("DELETE FROM scores")
    return {"ok": True, "deleted": "all"}

@app.delete("/score/by-name")
def delete_by_name(name: str = Query(..., min_length=1, max_length=20)):
    # DEV-ONLY: İsme göre skorları siler
    with db:
        db.execute("DELETE FROM scores WHERE name = ?", (name.strip()[:20],))
    return {"ok": True, "deleted_name": name.strip()[:20]}