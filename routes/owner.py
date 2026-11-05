import os
import io
import re
import base64
try:
    from PIL import Image
except ImportError:
    Image = None
from flask import Blueprint, render_template, request, jsonify, session
from models.user import UserModel
from models.settings import SettingsModel
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

# -------------------------------------------------------------
# FLEET BANNER MANAGEMENT APIs (Custom Photo & Rotation Persistence)
# -------------------------------------------------------------

@owner_bp.route("/api/fleet-banner", methods=["GET"])
@login_required
def get_fleet_banner():
    """
    Returns the active fleet banner image URL.
    Checks MongoDB settings first; if 'none', reports hidden;
    if not set, checks disk fallback.
    """
    try:
        custom_banner = SettingsModel.get_setting("fleet_banner")
        if custom_banner:
            if custom_banner in ("none", "hidden"):
                return jsonify({
                    "success": True,
                    "is_custom": True,
                    "hidden": True,
                    "image_url": None
                })
            return jsonify({
                "success": True,
                "is_custom": True,
                "hidden": False,
                "image_url": custom_banner
            })

        # Check if default static file exists on disk
        static_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "static", "images")
        static_fleet_path = os.path.join(static_dir, "fleet.jpg")
        if os.path.exists(static_fleet_path) and os.path.getsize(static_fleet_path) > 100:
            return jsonify({
                "success": True,
                "is_custom": False,
                "hidden": False,
                "image_url": "/static/images/fleet.jpg"
            })
        else:
            return jsonify({
                "success": True,
                "is_custom": False,
                "hidden": True,
                "image_url": None
            })
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e),
            "hidden": True,
            "image_url": None
        }), 500

@owner_bp.route("/api/fleet-banner", methods=["POST"])
@role_required("owner")
def update_fleet_banner():
    """
    Updates the fleet banner. Accepts base64 data URI in JSON body,
    compresses & standardizes it with Pillow, writes to static/images/fleet.jpg,
    and saves permanently to MongoDB Atlas settings collection.
    """
    try:
        data = request.get_json() or {}
        image_data = data.get("image_data", "")

        if not image_data:
            return jsonify({"success": False, "error": "No image data provided."}), 400

        # Extract base64 payload
        match = re.search(r"base64,(.+)$", image_data)
        if match:
            raw_b64 = match.group(1)
        else:
            raw_b64 = image_data

        data_uri = image_data
        if Image is not None:
            try:
                img_bytes = base64.b64decode(raw_b64)
                img = Image.open(io.BytesIO(img_bytes))
                if img.mode != "RGB":
                    img = img.convert("RGB")
                max_dim = 1600
                if max(img.width, img.height) > max_dim:
                    img.thumbnail((max_dim, max_dim), Image.Resampling.LANCZOS)
                out_buf = io.BytesIO()
                img.save(out_buf, format="JPEG", quality=85, optimize=True)
                final_b64 = base64.b64encode(out_buf.getvalue()).decode("utf-8")
                data_uri = f"data:image/jpeg;base64,{final_b64}"

                # Also save to local static/images/fleet.jpg
                try:
                    static_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "static", "images")
                    os.makedirs(static_dir, exist_ok=True)
                    static_fleet_path = os.path.join(static_dir, "fleet.jpg")
                    with open(static_fleet_path, "wb") as f:
                        f.write(out_buf.getvalue())
                except Exception as file_err:
                    print(f"[BANNER WARNING] Could not write to static disk: {file_err}")
            except Exception as img_err:
                print(f"[BANNER WARNING] Image optimization skipped: {img_err}")
                data_uri = image_data

        # 1. Save permanently to MongoDB Atlas
        SettingsModel.set_setting("fleet_banner", data_uri)

        return jsonify({
            "success": True,
            "message": "Fleet banner updated successfully!",
            "hidden": False,
            "image_url": data_uri
        })

    except Exception as e:
        return jsonify({"success": False, "error": f"Failed to save banner: {str(e)}"}), 500

@owner_bp.route("/api/fleet-banner/remove", methods=["POST"])
@role_required("owner")
def remove_fleet_banner():
    """
    Hides / removes the banner image completely, switching to sleek gradient banner.
    """
    try:
        SettingsModel.set_setting("fleet_banner", "none")
        return jsonify({
            "success": True,
            "message": "Banner image removed. Displaying sleek gradient banner.",
            "hidden": True,
            "image_url": None
        })
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@owner_bp.route("/api/fleet-banner/reset", methods=["POST"])
@role_required("owner")
def reset_fleet_banner():
    """
    Resets the fleet banner back to default.
    """
    try:
        SettingsModel.delete_setting("fleet_banner")
        return jsonify({
            "success": True,
            "message": "Fleet banner reset to original photo.",
            "hidden": False,
            "image_url": "/static/images/fleet.jpg"
        })
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500
