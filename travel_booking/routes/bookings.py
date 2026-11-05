from flask import Blueprint, request, jsonify, session
from models.booking import BookingModel
from routes.auth import login_required, role_required

bookings_bp = Blueprint("bookings", __name__, url_prefix="/api")

# -------------------------------------------------------------
# READ ENDPOINTS (Shared: Accessible by both Owner and Driver)
# -------------------------------------------------------------

OFFICIAL_BUSES = [
    {"number": "Pavitha_BM2999", "name": "Pavitha (BM2999)", "type": "AC Sleeper (2+1)"},
    {"number": "Pavitha_BB2999", "name": "Pavitha (BB2999)", "type": "AC Sleeper (2+1)"},
    {"number": "Bheeman_AK4777", "name": "Bheeman (AK4777)", "type": "AC Semi-Sleeper (2+2)"},
    {"number": "Dharman_AZ2383", "name": "Dharman (AZ2383)", "type": "AC Sleeper (2+1)"},
    {"number": "Jadamuni_B9939", "name": "Jadamuni (B9939)", "type": "Volvo Multi-Axle AC"}
]

@bookings_bp.route("/official-buses", methods=["GET"])
@login_required
def get_official_buses():
    """
    Returns the 5 official fleet buses.
    """
    return jsonify({
        "success": True,
        "buses": OFFICIAL_BUSES
    })

@bookings_bp.route("/calendar/<int:year>", methods=["GET"])
@login_required
def get_calendar_year(year):
    """
    Returns all active bookings for the specified year, grouped by travel_date.
    Optionally filters by bus_number for single-bus month-wise views.
    Used by frontend calendar to render GREEN (available) vs RED (booked) days.
    """
    if year < 1900 or year > 2100:
        return jsonify({"error": "Invalid year."}), 400

    bus_number = request.args.get("bus_number")
    try:
        data = BookingModel.get_calendar_year_data(year, bus_number=bus_number)
        return jsonify({
            "success": True,
            "year": year,
            "bus_number": bus_number or "ALL",
            "bookings": data
        })
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@bookings_bp.route("/bookings/date/<date_str>", methods=["GET"])
@login_required
def get_bookings_by_date(date_str):
    """
    Returns trip details for a specific date.
    Drivers only see active trips. Owner can see all including cancelled if requested.
    Optionally filters by bus_number.
    """
    try:
        include_cancelled = (session.get("role") == "owner" and request.args.get("include_cancelled") == "true")
        bus_number = request.args.get("bus_number")
        trips = BookingModel.get_bookings_by_date(
            date_str,
            include_cancelled=include_cancelled,
            bus_number=bus_number
        )
        return jsonify({
            "success": True,
            "date": date_str,
            "bus_number": bus_number or "ALL",
            "trips": trips,
            "count": len(trips)
        })
    except ValueError as ve:
        return jsonify({"success": False, "error": str(ve)}), 400
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@bookings_bp.route("/bookings/<booking_id>", methods=["GET"])
@login_required
def get_single_booking(booking_id):
    """
    Returns a single booking's full details.
    """
    try:
        booking = BookingModel.get_by_id(booking_id)
        if not booking:
            return jsonify({"success": False, "error": "Booking not found."}), 404
        return jsonify({"success": True, "booking": booking})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@bookings_bp.route("/bookings", methods=["GET"])
@login_required
def list_bookings():
    """
    List bookings with search, bus & status filters.
    """
    status = request.args.get("status")
    bus_number = request.args.get("bus_number")
    date_from = request.args.get("date_from")
    date_to = request.args.get("date_to")
    search = request.args.get("search")

    try:
        bookings = BookingModel.get_all_bookings(
            status=status,
            bus_number=bus_number,
            date_from=date_from,
            date_to=date_to,
            search=search
        )
        return jsonify({"success": True, "bookings": bookings, "count": len(bookings)})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


# -------------------------------------------------------------
# WRITE ENDPOINTS (Owner-Only: Forbidden for Drivers!)
# -------------------------------------------------------------

@bookings_bp.route("/bookings", methods=["POST"])
@role_required("owner")
def create_booking():
    """
    Owner creates a new booking.
    Enforces required fields and duplicate bus check for the same date.
    """
    data = request.get_json() or {}
    try:
        booking = BookingModel.create_booking(data)
        return jsonify({
            "success": True,
            "message": "Booking created successfully.",
            "booking": booking
        }), 201
    except ValueError as ve:
        return jsonify({"success": False, "error": str(ve)}), 400
    except Exception as e:
        return jsonify({"success": False, "error": f"Failed to create booking: {str(e)}"}), 500


@bookings_bp.route("/bookings/<booking_id>", methods=["PUT"])
@role_required("owner")
def update_booking(booking_id):
    """
    Owner updates an existing booking.
    """
    data = request.get_json() or {}
    try:
        updated = BookingModel.update_booking(booking_id, data)
        return jsonify({
            "success": True,
            "message": "Booking updated successfully.",
            "booking": updated
        })
    except ValueError as ve:
        return jsonify({"success": False, "error": str(ve)}), 400
    except Exception as e:
        return jsonify({"success": False, "error": f"Failed to update booking: {str(e)}"}), 500


@bookings_bp.route("/bookings/<booking_id>/cancel", methods=["POST"])
@role_required("owner")
def cancel_booking(booking_id):
    """
    Owner cancels an existing booking.
    Changes status to CANCELLED so date reverts to available (if no other buses booked).
    """
    try:
        cancelled = BookingModel.cancel_booking(booking_id)
        if not cancelled:
            return jsonify({"success": False, "error": "Booking not found."}), 404
        return jsonify({
            "success": True,
            "message": "Booking cancelled successfully. Calendar status updated.",
            "booking": cancelled
        })
    except ValueError as ve:
        return jsonify({"success": False, "error": str(ve)}), 400
    except Exception as e:
        return jsonify({"success": False, "error": f"Failed to cancel booking: {str(e)}"}), 500


@bookings_bp.route("/bookings/<booking_id>", methods=["DELETE"])
@role_required("owner")
def delete_booking(booking_id):
    """
    Owner permanently deletes a booking.
    """
    try:
        success = BookingModel.delete_booking(booking_id)
        if not success:
            return jsonify({"success": False, "error": "Booking not found or could not be deleted."}), 404
        return jsonify({
            "success": True,
            "message": "Booking deleted successfully."
        })
    except Exception as e:
        return jsonify({"success": False, "error": f"Failed to delete booking: {str(e)}"}), 500
