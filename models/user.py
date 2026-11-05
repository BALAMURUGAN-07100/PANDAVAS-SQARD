from datetime import datetime, timezone
from bson.objectid import ObjectId
from werkzeug.security import generate_password_hash, check_password_hash
from config import get_db

class UserModel:
    @staticmethod
    def get_collection():
        return get_db()["users"]

    @staticmethod
    def init_indexes():
        col = UserModel.get_collection()
        try:
            col.create_index("username", unique=True)
            col.create_index("role")
        except Exception as e:
            print(f"[INDEX WARNING] {e}")

    @staticmethod
    def get_by_id(user_id):
        if not user_id:
            return None
        try:
            if isinstance(user_id, str):
                user_id = ObjectId(user_id)
            user = UserModel.get_collection().find_one({"_id": user_id})
            if user:
                user["_id"] = str(user["_id"])
            return user
        except Exception:
            return None

    @staticmethod
    def get_by_username(username):
        if not username:
            return None
        user = UserModel.get_collection().find_one({"username": username.strip().lower()})
        if user:
            user["_id"] = str(user["_id"])
        return user

    @staticmethod
    def create_user(username, password, role="driver", driver_name="", phone="", active=True):
        if not username or not password:
            raise ValueError("Username and password are required.")
        if role not in ("owner", "driver"):
            raise ValueError("Role must be 'owner' or 'driver'.")

        username = username.strip().lower()
        if UserModel.get_by_username(username):
            raise ValueError(f"Username '{username}' already exists.")

        user_doc = {
            "username": username,
            "password_hash": generate_password_hash(password),
            "role": role,
            "driver_name": driver_name.strip() if driver_name else username,
            "phone": phone.strip(),
            "active": bool(active),
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc)
        }

        result = UserModel.get_collection().insert_one(user_doc)
        user_doc["_id"] = str(result.inserted_id)
        return user_doc

    @staticmethod
    def verify_password(password_hash, password):
        if not password_hash or not password:
            return False
        return check_password_hash(password_hash, password)

    @staticmethod
    def get_all_drivers(only_active=False):
        query = {"role": "driver"}
        if only_active:
            query["active"] = True
        cursor = UserModel.get_collection().find(query).sort("driver_name", 1)
        drivers = []
        for d in cursor:
            d["_id"] = str(d["_id"])
            d.pop("password_hash", None)
            drivers.append(d)
        return drivers

    @staticmethod
    def update_driver(driver_id, update_data):
        try:
            oid = ObjectId(driver_id)
        except Exception:
            return False

        allowed = ["driver_name", "phone", "active"]
        doc = {k: v for k, v in update_data.items() if k in allowed}
        if "password" in update_data and update_data["password"]:
            doc["password_hash"] = generate_password_hash(update_data["password"])
        doc["updated_at"] = datetime.now(timezone.utc)

        result = UserModel.get_collection().update_one({"_id": oid, "role": "driver"}, {"$set": doc})
        return result.modified_count > 0 or result.matched_count > 0

    @staticmethod
    def delete_driver(driver_id):
        try:
            oid = ObjectId(driver_id)
            result = UserModel.get_collection().delete_one({"_id": oid, "role": "driver"})
            return result.deleted_count > 0
        except Exception:
            return False
