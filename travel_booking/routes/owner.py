from flask import Blueprint, render_template, request, jsonify, session
from models.user import UserModel
from routes.auth import role_required, login_required

owner_bp = Blueprint("owner", __name__)

@owner_bp.route("/owner/dashboard")
@role_required("owner")
def dashboard():
    return render_template(
        "owner_dashboard.html",
        username=session.get("username"),
        role="owner"
    )

# -------------------------------------------------------------
# DRIVER MANAGEMENT APIs (Owner-Only)
# -------------------------------------------------------------

@owner_bp.route("/api/drivers", methods=["GET"])
@role_required("owner")
def get_drivers():
    try:
        drivers = UserModel.get_all_drivers(only_active=False)
        return jsonify({"success": True, "drivers": drivers})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@owner_bp.route("/api/active-drivers", methods=["GET"])
@login_required
def get_active_drivers():
    """
    Returns list of active drivers for booking assignment dropdown.
    """
    try:
        drivers = UserModel.get_all_drivers(only_active=True)
        return jsonify({"success": True, "drivers": drivers})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@owner_bp.route("/api/drivers", methods=["POST"])
@role_required("owner")
def create_driver():
    data = request.get_json() or {}
    username = data.get("username", "").strip()
    password = data.get("password", "").strip()
    driver_name = data.get("driver_name", "").strip()
    phone = data.get("phone", "").strip()

    if not username:
        return jsonify({"success": False, "error": "Username is required."}), 400
    if not password:
        return jsonify({"success": False, "error": "Password is required."}), 400
    if not driver_name:
        return jsonify({"success": False, "error": "Driver full name is required."}), 400

    try:
        new_driver = UserModel.create_user(
            username=username,
            password=password,
            role="driver",
            driver_name=driver_name,
            phone=phone,
            active=True
        )
        new_driver.pop("password_hash", None)
        return jsonify({
            "success": True,
            "message": f"Driver account '{username}' created successfully.",
            "driver": new_driver
        }), 201
    except ValueError as ve:
        return jsonify({"success": False, "error": str(ve)}), 400
    except Exception as e:
        return jsonify({"success": False, "error": f"Failed to create driver: {str(e)}"}), 500

@owner_bp.route("/api/drivers/<driver_id>", methods=["PUT"])
@role_required("owner")
def update_driver(driver_id):
    data = request.get_json() or {}
    try:
        success = UserModel.update_driver(driver_id, data)
        if not success:
            return jsonify({"success": False, "error": "Driver not found or no changes made."}), 404
        return jsonify({"success": True, "message": "Driver updated successfully."})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@owner_bp.route("/api/drivers/<driver_id>", methods=["DELETE"])
@role_required("owner")
def delete_driver(driver_id):
    try:
        success = UserModel.delete_driver(driver_id)
        if not success:
            return jsonify({"success": False, "error": "Driver not found."}), 404
        return jsonify({"success": True, "message": "Driver deleted successfully."})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500
