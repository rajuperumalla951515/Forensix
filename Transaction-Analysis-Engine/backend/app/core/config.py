import os
from pydantic import BaseModel
from dotenv import load_dotenv

load_dotenv()


class Settings(BaseModel):
    database_url: str = os.getenv(
        "DATABASE_URL",
        "sqlite:///./fraud_db.sqlite",
    )
    neo4j_uri: str = os.getenv("NEO4J_URI", "bolt://localhost:7687")
    neo4j_user: str = os.getenv("NEO4J_USER", "neo4j")
    neo4j_password: str = os.getenv("NEO4J_PASSWORD", "password")
    jwt_secret: str = os.getenv("JWT_SECRET", "change-me-in-production-use-long-random-string-123456789")
    cors_origin: str = os.getenv("CORS_ORIGIN", "http://localhost:5173")


settings = Settings()
