"""
Automated Comprehensive Test Suite for WANDERGO TRAVELS
Covers all 10 test scenarios specified in the project requirements.
"""

import unittest
import json
import os
import sys

# Ensure travel_booking directory is in python path
current_dir = os.path.dirname(os.path.abspath(__file__))
if current_dir not in sys.path:
    sys.path.insert(0, current_dir)

from app import create_app
from config import Config, get_db
from models.user import UserModel
from models.booking import BookingModel

class WanderGoTravelsTestCase(unittest.TestCase):
    def setUp(self):
        self.app = create_app()
        self.app.config["TESTING"] = True
        self.app.config["WTF_CSRF_ENABLED"] = False
        self.client = self.app.test_client()

        # Clean / setup test users
        with self.app.app_context():
            db = get_db()
            db["users"].delete_many({})
            db["bookings"].delete_many({})

            # Create owner
            self.owner = UserModel.create_user(
                username="owner",
                password="OwnerPassword123!",
                role="owner",
                driver_name="Admin Boss",
                phone="+91 99999 00000"
            )

            # Create driver
            self.driver = UserModel.create_user(
                username="driver_kumar",
                password="DriverPassword123!",
                role="driver",
                driver_name="Kumar",
                phone="+91 98765 43210"
            )

    def login(self, username, password):
        return self.client.post("/login", data={
            "username": username,
            "password": password
        }, follow_redirects=True)

    def logout(self):
        return self.client.get("/logout", follow_redirects=True)

    def test_01_owner_login(self):
        """Scenario 1: Owner login succeeds and accesses owner dashboard."""
        res = self.login("owner", "OwnerPassword123!")
        self.assertEqual(res.status_code, 200)
        self.assertIn(b"Owner Booking Control", res.data)
        self.assertIn(b"New Booking", res.data)

    def test_02_driver_login(self):
        """Scenario 2: Driver login succeeds and accesses driver read-only dashboard."""
        res = self.login("driver_kumar", "DriverPassword123!")
        self.assertEqual(res.status_code, 200)
        self.assertIn(b"Driver Trip Calendar", res.data)
        self.assertIn(b"Read-Only", res.data)
        # Ensure owner-only controls are NOT present in driver view
        self.assertNotIn(b"id=\"btnNewBooking\"", res.data)
        self.assertNotIn(b"id=\"driverModal\"", res.data)

    def test_03_04_owner_creates_booking_and_date_turns_red(self):
        """Scenario 3 & 4: Owner creates a booking, and calendar date turns RED (shows in active calendar)."""
        self.login("owner", "OwnerPassword123!")

        booking_payload = {
            "travel_date": "2026-11-15",
            "bus_number": "TN 38 AB 1234",
            "bus_type": "AC Sleeper",
            "source": "Coimbatore",
            "destination": "Chennai",
            "departure_time": "8:00 PM",
            "arrival_time": "5:00 AM",
            "driver_name": "Kumar",
            "driver_phone": "+91 98765 43210",
            "customer_name": "Ramesh",
            "customer_phone": "+91 98765 11223",
            "passenger_count": 30,
            "notes": "Express highway route",
            "status": "BOOKED"
        }

        # Create booking via API
        res = self.client.post("/api/bookings",
            data=json.dumps(booking_payload),
            content_type="application/json"
        )
        self.assertEqual(res.status_code, 201)
        data = res.get_json()
        self.assertTrue(data["success"])
        booking_id = data["booking"]["_id"]

        # Check calendar endpoint for year 2026: 2026-11-15 must have active booking (RED)
        cal_res = self.client.get("/api/calendar/2026")
        cal_data = cal_res.get_json()
        self.assertTrue(cal_data["success"])
        self.assertIn("2026-11-15", cal_data["bookings"])
        self.assertEqual(len(cal_data["bookings"]["2026-11-15"]), 1)
        self.assertEqual(cal_data["bookings"]["2026-11-15"][0]["bus_number"], "TN 38 AB 1234")

    def test_05_06_driver_sees_booked_date_and_details(self):
        """Scenario 5 & 6: Driver logs in, sees RED booked date, and fetches trip details."""
        # Seed booking
        with self.app.app_context():
            BookingModel.create_booking({
                "travel_date": "2026-11-15",
                "bus_number": "TN 38 AB 1234",
                "bus_type": "AC Sleeper",
                "source": "Coimbatore",
                "destination": "Chennai",
                "departure_time": "8:00 PM",
                "arrival_time": "5:00 AM",
                "driver_name": "Kumar",
                "driver_phone": "+91 98765 43210",
                "status": "BOOKED"
            })

        # Login as driver
        self.login("driver_kumar", "DriverPassword123!")

        # 1. Driver sees date in calendar
        cal_res = self.client.get("/api/calendar/2026")
        self.assertEqual(cal_res.status_code, 200)
        cal_data = cal_res.get_json()
        self.assertIn("2026-11-15", cal_data["bookings"])

        # 2. Driver fetches date details (simulate tapping date)
        trip_res = self.client.get("/api/bookings/date/2026-11-15")
        self.assertEqual(trip_res.status_code, 200)
        trip_data = trip_res.get_json()
        self.assertTrue(trip_data["success"])
        self.assertEqual(len(trip_data["trips"]), 1)
        trip = trip_data["trips"][0]
        self.assertEqual(trip["bus_number"], "TN 38 AB 1234")
        self.assertEqual(trip["source"], "Coimbatore")
        self.assertEqual(trip["destination"], "Chennai")
        self.assertEqual(trip["departure_time"], "8:00 PM")
        self.assertEqual(trip["driver_name"], "Kumar")
        self.assertEqual(trip["status"], "BOOKED")

    def test_07_driver_cannot_modify_or_delete_bookings(self):
        """Scenario 7: Driver cannot create, edit, or delete bookings via API (strictly 403 Forbidden)."""
        # Create a booking as owner first
        with self.app.app_context():
            b = BookingModel.create_booking({
                "travel_date": "2026-11-20",
                "bus_number": "TN 38 XY 9999",
                "source": "Madurai",
                "destination": "Bangalore",
                "driver_name": "Kumar",
                "status": "BOOKED"
            })
            booking_id = b["_id"]

        # Log in as driver
        self.login("driver_kumar", "DriverPassword123!")

        # Attempt to create booking -> 403 Forbidden
        res_create = self.client.post("/api/bookings",
            data=json.dumps({"travel_date": "2026-11-21", "bus_number": "TN 38 HACK"}),
            content_type="application/json"
        )
        self.assertEqual(res_create.status_code, 403)

        # Attempt to update booking -> 403 Forbidden
        res_update = self.client.put(f"/api/bookings/{booking_id}",
            data=json.dumps({"destination": "Hacked"}),
            content_type="application/json"
        )
        self.assertEqual(res_update.status_code, 403)

        # Attempt to cancel booking -> 403 Forbidden
        res_cancel = self.client.post(f"/api/bookings/{booking_id}/cancel")
        self.assertEqual(res_cancel.status_code, 403)

        # Attempt to delete booking -> 403 Forbidden
        res_delete = self.client.delete(f"/api/bookings/{booking_id}")
        self.assertEqual(res_delete.status_code, 403)

    def test_08_owner_edits_booking_and_driver_sees_changes(self):
        """Scenario 8: Owner edits booking and the updated details reflect for drivers."""
        with self.app.app_context():
            b = BookingModel.create_booking({
                "travel_date": "2026-11-15",
                "bus_number": "TN 38 AB 1234",
                "source": "Coimbatore",
                "destination": "Salem",
                "departure_time": "7:00 AM",
                "driver_name": "Kumar",
                "status": "BOOKED"
            })
            booking_id = b["_id"]

        # Owner edits
        self.login("owner", "OwnerPassword123!")
        edit_res = self.client.put(f"/api/bookings/{booking_id}",
            data=json.dumps({
                "destination": "Chennai Central",
                "departure_time": "9:30 PM",
                "bus_type": "Volvo Multi-Axle AC"
            }),
            content_type="application/json"
        )
        self.assertEqual(edit_res.status_code, 200)

        # Driver checks
        self.logout()
        self.login("driver_kumar", "DriverPassword123!")
        view_res = self.client.get(f"/api/bookings/{booking_id}")
        self.assertEqual(view_res.status_code, 200)
        updated_data = view_res.get_json()["booking"]
        self.assertEqual(updated_data["destination"], "Chennai Central")
        self.assertEqual(updated_data["departure_time"], "9:30 PM")
        self.assertEqual(updated_data["bus_type"], "Volvo Multi-Axle AC")

    def test_09_owner_cancels_booking_and_date_becomes_available(self):
        """Scenario 9: Owner cancels a booking; date reverts to available if no other active booking exists."""
        with self.app.app_context():
            b = BookingModel.create_booking({
                "travel_date": "2026-12-25",
                "bus_number": "TN 38 XMAS 01",
                "source": "Coimbatore",
                "destination": "Ooty",
                "status": "BOOKED"
            })
            booking_id = b["_id"]

        self.login("owner", "OwnerPassword123!")

        # Verify date is booked initially
        cal_res1 = self.client.get("/api/calendar/2026").get_json()
        self.assertIn("2026-12-25", cal_res1["bookings"])

        # Cancel the booking
        cancel_res = self.client.post(f"/api/bookings/{booking_id}/cancel")
        self.assertEqual(cancel_res.status_code, 200)

        # Verify date is NO LONGER booked (reverts to available GREEN)
        cal_res2 = self.client.get("/api/calendar/2026").get_json()
        self.assertNotIn("2026-12-25", cal_res2["bookings"])

    def test_10_multiple_buses_allowed_but_duplicate_same_bus_prevented(self):
        """Scenario 10: Multiple buses can book same date, but duplicate booking for same bus is rejected."""
        self.login("owner", "OwnerPassword123!")

        # Bus 1 booked on 2026-11-30
        res1 = self.client.post("/api/bookings",
            data=json.dumps({
                "travel_date": "2026-11-30",
                "bus_number": "TN 38 A 1111",
                "source": "Coimbatore",
                "destination": "Bangalore",
                "status": "BOOKED"
            }),
            content_type="application/json"
        )
        self.assertEqual(res1.status_code, 201)

        # Attempt to book SAME bus on SAME date -> Must Fail (400 Bad Request)
        res_dup = self.client.post("/api/bookings",
            data=json.dumps({
                "travel_date": "2026-11-30",
                "bus_number": "TN 38 A 1111",
                "source": "Coimbatore",
                "destination": "Madurai",
                "status": "BOOKED"
            }),
            content_type="application/json"
        )
        self.assertEqual(res_dup.status_code, 400)
        self.assertIn("already booked", res_dup.get_json()["error"])

        # Book DIFFERENT bus on SAME date -> Must Succeed (201 Created)
        res2 = self.client.post("/api/bookings",
            data=json.dumps({
                "travel_date": "2026-11-30",
                "bus_number": "TN 38 B 2222",
                "source": "Coimbatore",
                "destination": "Trichy",
                "status": "BOOKED"
            }),
            content_type="application/json"
        )
        self.assertEqual(res2.status_code, 201)

        # Both buses now appear on that date
        date_res = self.client.get("/api/bookings/date/2026-11-30").get_json()
        self.assertEqual(date_res["count"], 2)

    def test_11_driver_date_available_message(self):
        """Driver checks an available date and gets 0 trips (DATE AVAILABLE message)."""
        self.login("driver_kumar", "DriverPassword123!")
        res = self.client.get("/api/bookings/date/2026-01-01").get_json()
        self.assertTrue(res["success"])
        self.assertEqual(len(res["trips"]), 0)

if __name__ == "__main__":
    unittest.main()
