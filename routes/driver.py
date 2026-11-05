from flask import Blueprint, render_template, session
from routes.auth import role_required

driver_bp = Blueprint("driver", __name__)

@driver_bp.route("/driver/dashboard")
@role_required("driver", "owner")
def dashboard():
    return render_template(
        "driver_dashboard.html",
        username=session.get("username"),
        driver_name=session.get("driver_name", session.get("username")),
        role=session.get("role")
    )
