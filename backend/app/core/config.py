from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """
    Centralized application configuration.
    Values are loaded from environment variables / .env file.
    """

    app_name: str = "AI Tutor API"
    environment: str = "development"
    debug: bool = True

    secret_key: str = "change-this-to-a-random-secret-in-production"
    access_token_expire_minutes: int = 60

    database_url: str = "sqlite:///./ai_tutor.db"

    frontend_origin: str = "http://localhost:5173"

    # Gemini API configuration
    gemini_api_key: str | None = None
    gemini_model: str = "gemini-3.5-flash"
    gemini_max_tokens: int = 1024
    quiz_max_tokens: int = 3000
    study_plan_max_tokens: int = 4000
    notes_max_tokens: int = 2500
    tutor_system_prompt: str = (
        "You are a patient, encouraging AI tutor. Explain concepts clearly, "
        "check for understanding, and guide the learner toward the answer "
        "rather than simply stating it outright. Keep explanations concise "
        "unless the learner asks for more depth."
    )

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")


# Import this singleton wherever settings are needed:
# from app.core.config import settings
settings = Settings()
