from datetime import datetime, timezone
from config import get_db

class SettingsModel:
    @staticmethod
    def get_collection():
        return get_db()["settings"]

    @staticmethod
    def get_setting(key, default=None):
        try:
            doc = SettingsModel.get_collection().find_one({"key": key})
            if doc and "value" in doc:
                return doc["value"]
            return default
        except Exception:
            return default

    @staticmethod
    def set_setting(key, value):
        try:
            SettingsModel.get_collection().update_one(
                {"key": key},
                {"$set": {
                    "key": key,
                    "value": value,
                    "updated_at": datetime.now(timezone.utc)
                }},
                upsert=True
            )
            return True
        except Exception as e:
            print(f"[SETTINGS ERROR] {e}")
            return False

    @staticmethod
    def delete_setting(key):
        try:
            SettingsModel.get_collection().delete_one({"key": key})
            return True
        except Exception:
            return False
