from datetime import datetime, timezone
import re
from bson.objectid import ObjectId
from config import get_db

class BookingModel:
    @staticmethod
    def get_collection():
        return get_db()["bookings"]

    @staticmethod
    def init_indexes():
        col = BookingModel.get_collection()
        try:
            col.create_index("travel_date")
            col.create_index([("travel_date", 1), ("bus_number", 1)])
            col.create_index("status")
            col.create_index("driver_name")
        except Exception as e:
            print(f"[INDEX WARNING] {e}")

    @staticmethod
    def normalize_bus_number(bus_number):
        if not bus_number:
            return ""
        # Remove extra whitespace and uppercase
        return re.sub(r'\s+', ' ', bus_number.strip().upper())

    @staticmethod
    def normalize_date(date_str):
        if not date_str:
            return ""
        date_str = str(date_str).strip()
        # Validate YYYY-MM-DD
        if not re.match(r'^\d{4}-\d{2}-\d{2}$', date_str):
            try:
                dt = datetime.strptime(date_str, "%Y-%m-%d")
                return dt.strftime("%Y-%m-%d")
            except Exception:
                raise ValueError("Invalid date format. Expected YYYY-MM-DD.")
        return date_str

    @staticmethod
    def check_bus_conflict(travel_date, bus_number, exclude_booking_id=None):
        """
        Checks if the same bus already has an active (non-cancelled) booking on the given date.
        Returns the conflicting booking if found, else None.
        """
        travel_date = BookingModel.normalize_date(travel_date)
        bus_norm = BookingModel.normalize_bus_number(bus_number)

        query = {
            "travel_date": travel_date,
            "bus_number": bus_norm,
            "status": {"$ne": "CANCELLED"}
        }

        if exclude_booking_id:
            try:
                query["_id"] = {"$ne": ObjectId(exclude_booking_id)}
            except Exception:
                pass

        return BookingModel.get_collection().find_one(query)

    @staticmethod
    def get_by_id(booking_id):
        if not booking_id:
            return None
        try:
            if isinstance(booking_id, str):
                booking_id = ObjectId(booking_id)
            doc = BookingModel.get_collection().find_one({"_id": booking_id})
            if doc:
                doc["_id"] = str(doc["_id"])
            return doc
        except Exception:
            return None

    @staticmethod
    def create_booking(data):
        travel_date = BookingModel.normalize_date(data.get("travel_date"))
        bus_number = BookingModel.normalize_bus_number(data.get("bus_number"))

        if not travel_date:
            raise ValueError("Travel date is required.")
        if not bus_number:
            raise ValueError("Bus registration number is required.")
        if not data.get("source"):
            raise ValueError("Source location is required.")
        if not data.get("destination"):
            raise ValueError("Destination location is required.")

        # Duplicate bus check on same date
        conflict = BookingModel.check_bus_conflict(travel_date, bus_number)
        if conflict:
            raise ValueError(
                f"Bus '{bus_number}' is already booked on {travel_date} (Trip #{str(conflict['_id'])[-6:]}). "
                "Different buses can be booked on this date, but the same bus cannot be booked twice."
            )

        try:
            passenger_count = int(data.get("passenger_count", 1))
            if passenger_count < 1:
                passenger_count = 1
        except (ValueError, TypeError):
            passenger_count = 1

        booking_doc = {
            "travel_date": travel_date,
            "bus_number": bus_number,
            "bus_type": data.get("bus_type", "AC Sleeper").strip(),
            "source": data.get("source", "").strip(),
            "destination": data.get("destination", "").strip(),
            "departure_time": data.get("departure_time", "").strip(),
            "arrival_time": data.get("arrival_time", "").strip(),
            "driver_name": data.get("driver_name", "").strip(),
            "driver_phone": data.get("driver_phone", "").strip(),
            "customer_name": data.get("customer_name", "").strip(),
            "customer_phone": data.get("customer_phone", "").strip(),
            "passenger_count": passenger_count,
            "notes": data.get("notes", "").strip(),
            "status": data.get("status", "BOOKED").strip().upper(),
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc)
        }

        result = BookingModel.get_collection().insert_one(booking_doc)
        booking_doc["_id"] = str(result.inserted_id)
        return booking_doc

    @staticmethod
    def update_booking(booking_id, data):
        existing = BookingModel.get_by_id(booking_id)
        if not existing:
            raise ValueError("Booking not found.")

        travel_date = BookingModel.normalize_date(data.get("travel_date", existing["travel_date"]))
        bus_number = BookingModel.normalize_bus_number(data.get("bus_number", existing["bus_number"]))
        new_status = data.get("status", existing.get("status", "BOOKED")).strip().upper()

        # If not cancelled, check for conflict with other bookings
        if new_status != "CANCELLED":
            conflict = BookingModel.check_bus_conflict(travel_date, bus_number, exclude_booking_id=booking_id)
            if conflict:
                raise ValueError(
                    f"Bus '{bus_number}' is already booked on {travel_date}. "
                    "Cannot assign the same bus to overlapping bookings."
                )

        try:
            passenger_count = int(data.get("passenger_count", existing.get("passenger_count", 1)))
            if passenger_count < 1:
                passenger_count = 1
        except (ValueError, TypeError):
            passenger_count = existing.get("passenger_count", 1)

        update_doc = {
            "travel_date": travel_date,
            "bus_number": bus_number,
            "bus_type": data.get("bus_type", existing.get("bus_type", "AC Sleeper")).strip(),
            "source": data.get("source", existing.get("source", "")).strip(),
            "destination": data.get("destination", existing.get("destination", "")).strip(),
            "departure_time": data.get("departure_time", existing.get("departure_time", "")).strip(),
            "arrival_time": data.get("arrival_time", existing.get("arrival_time", "")).strip(),
            "driver_name": data.get("driver_name", existing.get("driver_name", "")).strip(),
            "driver_phone": data.get("driver_phone", existing.get("driver_phone", "")).strip(),
            "customer_name": data.get("customer_name", existing.get("customer_name", "")).strip(),
            "customer_phone": data.get("customer_phone", existing.get("customer_phone", "")).strip(),
            "passenger_count": passenger_count,
            "notes": data.get("notes", existing.get("notes", "")).strip(),
            "status": new_status,
            "updated_at": datetime.now(timezone.utc)
        }

        oid = ObjectId(booking_id)
        BookingModel.get_collection().update_one({"_id": oid}, {"$set": update_doc})
        return BookingModel.get_by_id(booking_id)

    @staticmethod
    def cancel_booking(booking_id):
        return BookingModel.update_booking(booking_id, {"status": "CANCELLED"})

    @staticmethod
    def delete_booking(booking_id):
        try:
            oid = ObjectId(booking_id)
            result = BookingModel.get_collection().delete_one({"_id": oid})
            return result.deleted_count > 0
        except Exception:
            return False

    @staticmethod
    def get_bookings_by_date(travel_date, include_cancelled=False):
        travel_date = BookingModel.normalize_date(travel_date)
        query = {"travel_date": travel_date}
        if not include_cancelled:
            query["status"] = {"$ne": "CANCELLED"}

        cursor = BookingModel.get_collection().find(query).sort("departure_time", 1)
        bookings = []
        for doc in cursor:
            doc["_id"] = str(doc["_id"])
            bookings.append(doc)
        return bookings

    @staticmethod
    def get_calendar_year_data(year):
        """
        Returns active bookings summary for a given 4-digit year.
        Dictionary where keys are 'YYYY-MM-DD' and values are arrays of active trip summaries.
        """
        regex = f"^{year}-"
        query = {
            "travel_date": {"$regex": regex},
            "status": {"$ne": "CANCELLED"}
        }

        cursor = BookingModel.get_collection().find(query).sort("departure_time", 1)
        calendar_map = {}
        for doc in cursor:
            d = doc["travel_date"]
            if d not in calendar_map:
                calendar_map[d] = []
            calendar_map[d].append({
                "_id": str(doc["_id"]),
                "bus_number": doc.get("bus_number", ""),
                "bus_type": doc.get("bus_type", ""),
                "source": doc.get("source", ""),
                "destination": doc.get("destination", ""),
                "departure_time": doc.get("departure_time", ""),
                "arrival_time": doc.get("arrival_time", ""),
                "driver_name": doc.get("driver_name", ""),
                "driver_phone": doc.get("driver_phone", ""),
                "customer_name": doc.get("customer_name", ""),
                "customer_phone": doc.get("customer_phone", ""),
                "passenger_count": doc.get("passenger_count", 1),
                "status": doc.get("status", "BOOKED")
            })
        return calendar_map

    @staticmethod
    def get_all_bookings(status=None, date_from=None, date_to=None, search=None, limit=200):
        query = {}
        if status and status != "ALL":
            query["status"] = status
        elif not status:
            # By default exclude cancelled unless specified
            pass

        if date_from or date_to:
            date_filter = {}
            if date_from:
                date_filter["$gte"] = date_from
            if date_to:
                date_filter["$lte"] = date_to
            query["travel_date"] = date_filter

        if search:
            s_regex = {"$regex": search, "$options": "i"}
            query["$or"] = [
                {"bus_number": s_regex},
                {"customer_name": s_regex},
                {"customer_phone": s_regex},
                {"driver_name": s_regex},
                {"source": s_regex},
                {"destination": s_regex}
            ]

        cursor = BookingModel.get_collection().find(query).sort([("travel_date", -1), ("departure_time", 1)]).limit(limit)
        bookings = []
        for doc in cursor:
            doc["_id"] = str(doc["_id"])
            bookings.append(doc)
        return bookings
