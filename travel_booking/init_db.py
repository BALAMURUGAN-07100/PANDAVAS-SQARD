"""
Database Initialization & First User Setup Script for PANDAVAS SQARD
Run this script to initialize collections, create indexes, create the first Owner account securely,
and seed initial sample bus trips.

Usage:
    python init_db.py
"""

import sys
import os

# Ensure travel_booking directory is in python path
current_dir = os.path.dirname(os.path.abspath(__file__))
if current_dir not in sys.path:
    sys.path.insert(0, current_dir)

from config import get_db
from models.user import UserModel
from models.booking import BookingModel

def initialize_database():
    print("==========================================================")
    print("  PANDAVAS SQARD - DATABASE INITIALIZATION & SETUP")
    print("==========================================================")
    
    # 1. Connect to DB
    db = get_db()
    print("[1/5] Connecting to database collections...")

    # 2. Initialize Indexes
    print("[2/5] Initializing unique & performance indexes...")
    UserModel.init_indexes()
    BookingModel.init_indexes()

    # 3. Create Default Owner Account if not exists
    print("[3/5] Checking administrator / owner account...")
    owner_username = os.getenv("DEFAULT_OWNER_USER", "owner")
    owner_password = os.getenv("DEFAULT_OWNER_PASS", "OwnerPassword123!")

    existing_owner = UserModel.get_by_username(owner_username)
    if not existing_owner:
        owner = UserModel.create_user(
            username=owner_username,
            password=owner_password,
            role="owner",
            driver_name="Admin Manager",
            phone="+91 98765 00000",
            active=True
        )
        print(f" -> Created Owner Account: '{owner_username}' (Password: '{owner_password}')")
    else:
        print(f" -> Owner account '{owner_username}' already exists.")

    # 4. Create Sample Driver Accounts if not exists
    print("[4/5] Checking sample driver accounts...")
    driver_username = "driver_kumar"
    driver_password = "DriverPassword123!"

    existing_driver = UserModel.get_by_username(driver_username)
    if not existing_driver:
        UserModel.create_user(
            username=driver_username,
            password=driver_password,
            role="driver",
            driver_name="Kumar",
            phone="+91 98765 43210",
            active=True
        )
        print(f" -> Created Driver Account: '{driver_username}' (Password: '{driver_password}')")
    else:
        print(f" -> Driver account '{driver_username}' already exists.")

    driver_selvam = "driver_selvam"
    if not UserModel.get_by_username(driver_selvam):
        UserModel.create_user(
            username=driver_selvam,
            password="DriverPassword123!",
            role="driver",
            driver_name="Selvam",
            phone="+91 98765 88990",
            active=True
        )
        print(f" -> Created Driver Account: '{driver_selvam}' (Password: 'DriverPassword123!')")

    # 5. Seed Initial Sample Bookings if collection is empty
    print("[5/5] Checking initial bus bookings...")
    if db["bookings"].count_documents({}) == 0:
        sample_bookings = [
            {
                "travel_date": "2026-11-15",
                "bus_number": "Pavitha_BM2999",
                "bus_type": "AC Sleeper (2+1)",
                "source": "Coimbatore",
                "destination": "Chennai",
                "departure_time": "8:00 PM",
                "arrival_time": "5:00 AM",
                "driver_name": "Kumar",
                "driver_phone": "+91 98765 43210",
                "customer_name": "Senthil Nathan",
                "customer_phone": "+91 98400 12345",
                "passenger_count": 32,
                "notes": "Night express trip via Salem/Ulundurpet",
                "status": "BOOKED"
            },
            {
                "travel_date": "2026-11-15",
                "bus_number": "Bheeman_AK4777",
                "bus_type": "AC Semi-Sleeper (2+2)",
                "source": "Coimbatore",
                "destination": "Bangalore",
                "departure_time": "10:30 PM",
                "arrival_time": "6:00 AM",
                "driver_name": "Selvam",
                "driver_phone": "+91 98765 88990",
                "customer_name": "Kavitha Raj",
                "customer_phone": "+91 97890 54321",
                "passenger_count": 40,
                "notes": "Highway express trip",
                "status": "BOOKED"
            },
            {
                "travel_date": "2026-11-18",
                "bus_number": "Pavitha_BB2999",
                "bus_type": "AC Sleeper (2+1)",
                "source": "Chennai",
                "destination": "Madurai",
                "departure_time": "9:00 PM",
                "arrival_time": "6:00 AM",
                "driver_name": "Kumar",
                "driver_phone": "+91 98765 43210",
                "customer_name": "Murugan Vel",
                "customer_phone": "+91 98411 99887",
                "passenger_count": 36,
                "notes": "Direct Madurai bypass",
                "status": "BOOKED"
            },
            {
                "travel_date": "2026-11-20",
                "bus_number": "Dharman_AZ2383",
                "bus_type": "AC Sleeper (2+1)",
                "source": "Chennai",
                "destination": "Coimbatore",
                "departure_time": "8:30 PM",
                "arrival_time": "5:30 AM",
                "driver_name": "Kumar",
                "driver_phone": "+91 98765 43210",
                "customer_name": "Anand Mohan",
                "customer_phone": "+91 94433 22110",
                "passenger_count": 28,
                "notes": "Return journey",
                "status": "BOOKED"
            },
            {
                "travel_date": "2026-11-25",
                "bus_number": "Jadamuni_B9939",
                "bus_type": "Volvo Multi-Axle AC",
                "source": "Coimbatore",
                "destination": "Hyderabad",
                "departure_time": "6:00 PM",
                "arrival_time": "8:00 AM",
                "driver_name": "Selvam",
                "driver_phone": "+91 98765 88990",
                "customer_name": "Venkatesh Rao",
                "customer_phone": "+91 99887 76655",
                "passenger_count": 45,
                "notes": "Interstate long distance route",
                "status": "BOOKED"
            }
        ]

        for b in sample_bookings:
            BookingModel.create_booking(b)
        print(f" -> Inserted {len(sample_bookings)} initial sample bookings (e.g. 15 Nov 2026).")
    else:
        print(" -> Bookings collection already has records.")

    print("\n==========================================================")
    print("Database initialization completed successfully!")
    print("Default Credentials:")
    print(f"  [OWNER]  : {owner_username} / {owner_password}")
    print(f"  [DRIVER] : {driver_username} / {driver_password}")
    print(f"  [DRIVER] : driver_selvam / DriverPassword123!")
    print("==========================================================")

if __name__ == "__main__":
    initialize_database()
