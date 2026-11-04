import os
import sys
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

class Config:
    SECRET_KEY = os.getenv("SECRET_KEY", "wandergo-secret-key-change-in-production-2026")
    MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017/wandergo_travels")
    DB_NAME = os.getenv("DB_NAME", "wandergo_travels")
    USE_MOCK_IF_UNAVAILABLE = os.getenv("USE_MOCK_IF_UNAVAILABLE", "true").lower() in ("true", "1", "yes")
    SESSION_COOKIE_HTTPONLY = True
    SESSION_COOKIE_SAMESITE = "Lax"
    SESSION_COOKIE_SECURE = os.getenv("FLASK_ENV") == "production"

# Database connection manager
_db = None
_client = None

def get_db():
    """
    Returns the MongoDB database instance.
    Connects to MongoDB Atlas / local MongoDB or falls back to mongomock if configured and offline.
    """
    global _db, _client
    if _db is not None:
        return _db

    mongo_uri = Config.MONGO_URI
    db_name = Config.DB_NAME

    try:
        from pymongo import MongoClient
        # Set a 3-second timeout for server selection so local testing doesn't hang if no server is running
        client = MongoClient(mongo_uri, serverSelectionTimeoutMS=3000)
        # Verify connection
        client.admin.command('ping')
        _client = client
        _db = client[db_name]
        print(f"[DATABASE] Successfully connected to live MongoDB: {db_name}")
        return _db
    except Exception as e:
        print(f"[DATABASE WARNING] Could not connect to MongoDB at {mongo_uri}: {e}")
        if Config.USE_MOCK_IF_UNAVAILABLE:
            try:
                import mongomock
                print("[DATABASE] Falling back to in-memory mongomock for development/testing.")
                client = mongomock.MongoClient()
                _client = client
                _db = client[db_name]
                return _db
            except Exception as mock_err:
                print(f"[DATABASE ERROR] Could not initialize mongomock: {mock_err}")
                raise
        else:
            raise ConnectionError(f"Failed to connect to MongoDB Atlas at {mongo_uri}. Details: {e}")
