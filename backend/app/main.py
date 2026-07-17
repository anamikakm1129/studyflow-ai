from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import auth, chat, dashboard, planner, quiz, tools, users
from app.core.config import settings
from app.db.init_db import init_db


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Creates tables if they don't exist. Replace with Alembic migrations
    # for production schema management.
    init_db()
    yield


app = FastAPI(title=settings.app_name, debug=settings.debug, lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_origin],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# All routes are mounted under /api to match the frontend's Vite proxy
# and the VITE_API_BASE_URL convention.
app.include_router(auth.router, prefix="/api")
app.include_router(users.router, prefix="/api")
app.include_router(chat.router, prefix="/api")
app.include_router(quiz.router, prefix="/api")
app.include_router(planner.router, prefix="/api")
app.include_router(dashboard.router, prefix="/api")
app.include_router(tools.router, prefix="/api")


@app.get("/health")
def health_check():
    return {"status": "ok"}
