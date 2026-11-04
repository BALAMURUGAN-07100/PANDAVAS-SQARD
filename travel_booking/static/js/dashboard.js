/**
 * WANDERGO TRAVELS - DASHBOARD MODULE
 * Handles Driver Management (Owner) and Driver Trips List (Driver View).
 */

document.addEventListener("DOMContentLoaded", function() {
    // If Owner: load driver list
    if (window.CURRENT_USER && window.CURRENT_USER.role === "owner") {
        loadDriversList();

        const newDriverForm = document.getElementById("newDriverForm");
        if (newDriverForm) {
            newDriverForm.addEventListener("submit", handleAddDriver);
        }
    }

    // If Driver: load trips list
    if (window.CURRENT_USER && window.CURRENT_USER.role === "driver") {
        loadDriverTripsList();
    }
});

/**
 * Load Drivers List (Owner)
 */
function loadDriversList() {
    const tbody = document.getElementById("driverTableBody");
    const badge = document.getElementById("driverCountBadge");
    if (!tbody) return;

    fetch("/api/drivers")
        .then(res => res.json())
        .then(data => {
            if (!data.success) throw new Error(data.error || "Failed to load drivers");
            const drivers = data.drivers || [];
            if (badge) badge.textContent = drivers.length;

            if (drivers.length === 0) {
                tbody.innerHTML = `<tr><td colspan="5" class="text-center py-3 text-muted">No drivers registered yet.</td></tr>`;
                return;
            }

            let html = "";
            drivers.forEach(d => {
                html += `
                    <tr>
                        <td class="fw-bold">${escapeHtml(d.driver_name)}</td>
                        <td><code>${escapeHtml(d.username)}</code></td>
                        <td>${escapeHtml(d.phone || 'N/A')}</td>
                        <td>
                            <span class="badge ${d.active ? 'bg-success-subtle text-success' : 'bg-secondary'} rounded-pill">
                                ${d.active ? 'Active' : 'Inactive'}
                            </span>
                        </td>
                        <td class="text-end">
                            <button class="btn btn-outline-danger btn-sm rounded-pill" onclick="handleDeleteDriver('${d._id}', '${escapeHtml(d.driver_name)}')">
                                <i class="bi bi-trash"></i>
                            </button>
                        </td>
                    </tr>
                `;
            });

            tbody.innerHTML = html;
        })
        .catch(err => {
            if (tbody) tbody.innerHTML = `<tr><td colspan="5" class="text-center py-3 text-danger">${err.message}</td></tr>`;
        });
}

/**
 * Add New Driver
 */
function handleAddDriver(e) {
    e.preventDefault();
    const alertBox = document.getElementById("driverFormAlert");
    alertBox.classList.add("d-none");

    const payload = {
        username: document.getElementById("newDriverUsername").value,
        password: document.getElementById("newDriverPassword").value,
        driver_name: document.getElementById("newDriverFullName").value,
        phone: document.getElementById("newDriverPhone").value
    };

    fetch("/api/drivers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
    })
    .then(res => res.json())
    .then(data => {
        if (!data.success) {
            alertBox.textContent = data.error || "Failed to add driver.";
            alertBox.classList.remove("d-none");
            return;
        }

        document.getElementById("newDriverForm").reset();
        showNotification(data.message, "success");
        loadDriversList();
        if (typeof loadActiveDrivers === "function") {
            loadActiveDrivers();
        }
    })
    .catch(err => {
        alertBox.textContent = "Error: " + err.message;
        alertBox.classList.remove("d-none");
    });
}

/**
 * Delete Driver
 */
function handleDeleteDriver(driverId, driverName) {
    if (!confirm(`Are you sure you want to remove driver '${driverName}'?`)) return;

    fetch(`/api/drivers/${driverId}`, { method: "DELETE" })
        .then(res => res.json())
        .then(data => {
            if (!data.success) throw new Error(data.error || "Failed to delete driver");
            showNotification("Driver account removed.", "info");
            loadDriversList();
            if (typeof loadActiveDrivers === "function") {
                loadActiveDrivers();
            }
        })
        .catch(err => alert("Error: " + err.message));
}

/**
 * Load Upcoming Trips List for Driver View
 */
function loadDriverTripsList() {
    const tbody = document.getElementById("driverTripsTableBody");
    if (!tbody) return;

    fetch("/api/bookings?status=BOOKED")
        .then(res => res.json())
        .then(data => {
            if (!data.success) throw new Error(data.error || "Failed to load upcoming trips");
            const trips = data.bookings || [];

            if (trips.length === 0) {
                tbody.innerHTML = `<tr><td colspan="8" class="text-center py-4 text-muted">No upcoming trips scheduled currently.</td></tr>`;
                return;
            }

            let html = "";
            trips.forEach(t => {
                html += `
                    <tr>
                        <td class="fw-bold">${escapeHtml(t.travel_date)}</td>
                        <td class="fw-bold text-brand">${escapeHtml(t.bus_number)}</td>
                        <td>${escapeHtml(t.bus_type || 'AC Sleeper')}</td>
                        <td><span class="text-primary fw-semibold">${escapeHtml(t.source)} &rarr; ${escapeHtml(t.destination)}</span></td>
                        <td>${escapeHtml(t.departure_time || 'N/A')}</td>
                        <td>${escapeHtml(t.arrival_time || 'N/A')}</td>
                        <td><i class="bi bi-person-badge text-muted me-1"></i> ${escapeHtml(t.driver_name || 'Unassigned')}</td>
                        <td><span class="badge bg-danger rounded-pill">${t.status}</span></td>
                    </tr>
                `;
            });

            tbody.innerHTML = html;
        })
        .catch(err => {
            tbody.innerHTML = `<tr><td colspan="8" class="text-center py-4 text-danger">${err.message}</td></tr>`;
        });
}
