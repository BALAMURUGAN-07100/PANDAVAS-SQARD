from functools import wraps
from flask import Blueprint, render_template, request, redirect, url_for, session, flash, jsonify
from models.user import UserModel

auth_bp = Blueprint("auth", __name__)

def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if not session.get("user_id"):
            if request.is_json or request.path.startswith("/api/"):
                return jsonify({"error": "Unauthorized. Please log in."}), 401
            flash("Please sign in to access this page.", "warning")
            return redirect(url_for("auth.login"))
        return f(*args, **kwargs)
    return decorated_function

def role_required(*allowed_roles):
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            if not session.get("user_id"):
                if request.is_json or request.path.startswith("/api/"):
                    return jsonify({"error": "Unauthorized. Please log in."}), 401
                flash("Please sign in to continue.", "warning")
                return redirect(url_for("auth.login"))

            user_role = session.get("role")
            if user_role not in allowed_roles:
                if request.is_json or request.path.startswith("/api/"):
                    return jsonify({"error": "Forbidden: You do not have permission to perform this action."}), 403
                flash("Access denied. You do not have permission to view that page.", "danger")
                if user_role == "driver":
                    return redirect(url_for("driver.dashboard"))
                return redirect(url_for("auth.login"))
            return f(*args, **kwargs)
        return decorated_function
    return decorator

@auth_bp.route("/login", methods=["GET", "POST"])
def login():
    # If already logged in, redirect to respective dashboard
    if session.get("user_id"):
        if session.get("role") == "owner":
            return redirect(url_for("owner.dashboard"))
        return redirect(url_for("driver.dashboard"))

    if request.method == "POST":
        username = request.form.get("username", "").strip()
        password = request.form.get("password", "")

        if not username or not password:
            flash("Please enter both username and password.", "danger")
            return render_template("login.html", username=username)

        user = UserModel.get_by_username(username)
        if not user or not UserModel.verify_password(user["password_hash"], password):
            flash("Invalid username or password. Please try again.", "danger")
            return render_template("login.html", username=username)

        if not user.get("active", True):
            flash("Your account has been deactivated. Please contact the administrator.", "danger")
            return render_template("login.html", username=username)

        # Establish session
        session.clear()
        session["user_id"] = user["_id"]
        session["username"] = user["username"]
        session["role"] = user["role"]
        session["driver_name"] = user.get("driver_name", user["username"])
        session.permanent = True

        flash(f"Welcome back, {session['driver_name']}!", "success")
        if user["role"] == "owner":
            return redirect(url_for("owner.dashboard"))
        return redirect(url_for("driver.dashboard"))

    return render_template("login.html")

@auth_bp.route("/logout")
def logout():
    session.clear()
    flash("You have been successfully logged out.", "info")
    return redirect(url_for("auth.login"))
