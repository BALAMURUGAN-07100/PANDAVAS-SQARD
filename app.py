import os
from flask import Flask, redirect, url_for, session, render_template, jsonify
from config import Config, get_db
from models.user import UserModel
from models.booking import BookingModel
from routes import auth_bp, owner_bp, driver_bp, bookings_bp

def create_app(config_class=Config):
    app = Flask(__name__)
    app.config.from_object(config_class)

    # Initialize DB connection and indexes
    with app.app_context():
        try:
            get_db()
            UserModel.init_indexes()
            BookingModel.init_indexes()
        except Exception as e:
            print(f"[STARTUP WARNING] Database initialization: {e}")

    # Register blueprints
    app.register_blueprint(auth_bp)
    app.register_blueprint(owner_bp)
    app.register_blueprint(driver_bp)
    app.register_blueprint(bookings_bp)

    @app.route("/")
    def index():
        if not session.get("user_id"):
            return redirect(url_for("auth.login"))
        if session.get("role") == "owner":
            return redirect(url_for("owner.dashboard"))
        return redirect(url_for("driver.dashboard"))

    @app.errorhandler(404)
    def page_not_found(e):
        return render_template("404.html"), 404

    @app.errorhandler(403)
    def access_forbidden(e):
        return jsonify({"error": "Forbidden: You do not have permission to access this resource."}), 403

    @app.errorhandler(500)
    def internal_server_error(e):
        return jsonify({"error": "Internal server error. Please try again later."}), 500

    return app

app = create_app()

if __name__ == "__main__":
    port = int(os.getenv("PORT", 5000))
    debug = os.getenv("FLASK_ENV") != "production"
    print(f"=== PANDAVAS SQARD BOOKING SYSTEM RUNNING ON http://127.0.0.1:{port} ===")
    app.run(host="0.0.0.0", port=port, debug=debug)
