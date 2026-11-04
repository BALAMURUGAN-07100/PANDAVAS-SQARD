/**
 * WANDERGO TRAVELS - BOOKING MANAGEMENT MODULE
 * Handles Create, Edit, Cancel, and Delete of bus bookings.
 * Enforces validation, handles duplicate bus checks, and updates calendar state.
 */

let activeDriversCache = [];

document.addEventListener("DOMContentLoaded", function() {
    loadActiveDrivers();

    const newBookingBtn = document.getElementById("btnNewBooking");
    if (newBookingBtn) {
        newBookingBtn.addEventListener("click", () => openBookingModal(null));
    }

    const bookingForm = document.getElementById("bookingForm");
    if (bookingForm) {
        bookingForm.addEventListener("submit", handleBookingFormSubmit);
    }

    const driverSelect = document.getElementById("formDriverSelect");
    if (driverSelect) {
        driverSelect.addEventListener("change", function() {
            const selectedOpt = driverSelect.options[driverSelect.selectedIndex];
            if (selectedOpt && selectedOpt.value) {
                document.getElementById("formDriverName").value = selectedOpt.dataset.name || selectedOpt.value;
                document.getElementById("formDriverPhone").value = selectedOpt.dataset.phone || "";
            }
        });
    }

    // Bookings table search & filter listeners
    const searchInput = document.getElementById("bookingSearchInput");
    const statusFilter = document.getElementById("bookingStatusFilter");
    const resetBtn = document.getElementById("filterResetBtn");

    if (searchInput) {
        let debounceTimer;
        searchInput.addEventListener("input", () => {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(loadBookingsList, 300);
        });
    }

    if (statusFilter) {
        statusFilter.addEventListener("change", loadBookingsList);
    }

    if (resetBtn) {
        resetBtn.addEventListener("click", () => {
            if (searchInput) searchInput.value = "";
            if (statusFilter) statusFilter.value = "";
            loadBookingsList();
        });
    }
});

/**
 * Fetch active drivers for booking form dropdown
 */
function loadActiveDrivers() {
    fetch("/api/active-drivers")
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                activeDriversCache = data.drivers || [];
                populateDriverSelect();
            }
        })
        .catch(err => console.error("Error loading drivers:", err));
}

function populateDriverSelect() {
    const select = document.getElementById("formDriverSelect");
    if (!select) return;

    select.innerHTML = `<option value="">-- Choose Registered Driver --</option>`;
    activeDriversCache.forEach(d => {
        const opt = document.createElement("option");
        opt.value = d.driver_name;
        opt.dataset.name = d.driver_name;
        opt.dataset.phone = d.phone || "";
        opt.textContent = `${d.driver_name} (${d.phone || 'No phone'})`;
        select.appendChild(opt);
    });
}

/**
 * Open Booking Modal for Create or Edit
 */
function openBookingModal(bookingId = null, prefillDate = null) {
    const modalEl = document.getElementById("bookingFormModal");
    if (!modalEl) return;

    const modalTitle = document.getElementById("bookingModalTitle");
    const errorAlert = document.getElementById("bookingFormError");
    errorAlert.classList.add("d-none");
    errorAlert.textContent = "";

    document.getElementById("bookingForm").reset();
    document.getElementById("bookingId").value = bookingId || "";

    if (bookingId) {
        modalTitle.innerHTML = `<i class="bi bi-pencil-square"></i> <span>Edit Bus Booking</span>`;
        // Fetch existing booking
        fetch(`/api/bookings/${bookingId}`)
            .then(res => res.json())
            .then(res => {
                if (!res.success) throw new Error(res.error || "Failed to load booking");
                const b = res.booking;
                document.getElementById("formTravelDate").value = b.travel_date || "";
                document.getElementById("formBusNumber").value = b.bus_number || "";
                document.getElementById("formBusType").value = b.bus_type || "AC Sleeper (2+1)";
                document.getElementById("formSource").value = b.source || "";
                document.getElementById("formDestination").value = b.destination || "";
                document.getElementById("formDepartureTime").value = b.departure_time || "";
                document.getElementById("formArrivalTime").value = b.arrival_time || "";
                document.getElementById("formDriverName").value = b.driver_name || "";
                document.getElementById("formDriverPhone").value = b.driver_phone || "";
                document.getElementById("formCustomerName").value = b.customer_name || "";
                document.getElementById("formCustomerPhone").value = b.customer_phone || "";
                document.getElementById("formPassengerCount").value = b.passenger_count || 1;
                document.getElementById("formNotes").value = b.notes || "";
                document.getElementById("formStatus").value = b.status || "BOOKED";
            })
            .catch(err => {
                errorAlert.textContent = err.message;
                errorAlert.classList.remove("d-none");
            });
    } else {
        modalTitle.innerHTML = `<i class="bi bi-ticket-perforated-fill"></i> <span>New Bus Booking</span>`;
        if (prefillDate) {
            document.getElementById("formTravelDate").value = prefillDate;
        } else {
            document.getElementById("formTravelDate").value = new Date().toISOString().split("T")[0];
        }
        document.getElementById("formStatus").value = "BOOKED";
        document.getElementById("formPassengerCount").value = "1";
    }

    const modal = new bootstrap.Modal(modalEl);
    modal.show();
}

/**
 * Handle Booking Form Submit (Create or Update)
 */
function handleBookingFormSubmit(e) {
    e.preventDefault();

    const bookingId = document.getElementById("bookingId").value;
    const isEdit = Boolean(bookingId);
    const errorAlert = document.getElementById("bookingFormError");
    const saveBtn = document.getElementById("btnSaveBooking");

    errorAlert.classList.add("d-none");
    saveBtn.disabled = true;
    saveBtn.innerHTML = `<span class="spinner-border spinner-border-sm me-1"></span> Saving...`;

    const payload = {
        travel_date: document.getElementById("formTravelDate").value,
        bus_number: document.getElementById("formBusNumber").value,
        bus_type: document.getElementById("formBusType").value,
        source: document.getElementById("formSource").value,
        destination: document.getElementById("formDestination").value,
        departure_time: document.getElementById("formDepartureTime").value,
        arrival_time: document.getElementById("formArrivalTime").value,
        driver_name: document.getElementById("formDriverName").value,
        driver_phone: document.getElementById("formDriverPhone").value,
        customer_name: document.getElementById("formCustomerName").value,
        customer_phone: document.getElementById("formCustomerPhone").value,
        passenger_count: parseInt(document.getElementById("formPassengerCount").value, 10) || 1,
        notes: document.getElementById("formNotes").value,
        status: document.getElementById("formStatus").value
    };

    const url = isEdit ? `/api/bookings/${bookingId}` : "/api/bookings";
    const method = isEdit ? "PUT" : "POST";

    fetch(url, {
        method: method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
    })
    .then(res => res.json().then(data => ({ status: res.status, data: data })))
    .then(({ status, data }) => {
        saveBtn.disabled = false;
        saveBtn.innerHTML = `<i class="bi bi-check2-circle me-1"></i> Save Booking`;

        if (status >= 400 || !data.success) {
            errorAlert.textContent = data.error || "Failed to save booking.";
            errorAlert.classList.remove("d-none");
            return;
        }

        // Success: hide modal
        const modalEl = document.getElementById("bookingFormModal");
        const modalInstance = bootstrap.Modal.getInstance(modalEl);
        if (modalInstance) modalInstance.hide();

        showNotification(isEdit ? "Booking updated successfully!" : "Booking created successfully!", "success");

        // Refresh calendar data immediately
        if (typeof loadCalendarData === "function") {
            loadCalendarData(CalendarState.currentYear);
        }

        // If list view active, reload bookings
        if (typeof loadBookingsList === "function") {
            loadBookingsList();
        }

        // Close date details modal if open
        const dateDetailsModal = bootstrap.Modal.getInstance(document.getElementById("dateDetailsModal"));
        if (dateDetailsModal) dateDetailsModal.hide();
    })
    .catch(err => {
        saveBtn.disabled = false;
        saveBtn.innerHTML = `<i class="bi bi-check2-circle me-1"></i> Save Booking`;
        errorAlert.textContent = "Network error: " + err.message;
        errorAlert.classList.remove("d-none");
    });
}

/**
 * Edit Booking handler from popup or table
 */
function handleEditBooking(bookingId) {
    const dateDetailsModal = bootstrap.Modal.getInstance(document.getElementById("dateDetailsModal"));
    if (dateDetailsModal) dateDetailsModal.hide();
    openBookingModal(bookingId);
}

/**
 * Cancel Booking Handler
 */
function handleCancelBooking(bookingId) {
    if (!confirm("Are you sure you want to cancel this booking? The bus reservation will be marked CANCELLED, and the calendar date will become available if no other buses are booked.")) {
        return;
    }

    fetch(`/api/bookings/${bookingId}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" }
    })
    .then(res => res.json())
    .then(data => {
        if (!data.success) throw new Error(data.error || "Failed to cancel booking");

        showNotification("Booking has been cancelled.", "warning");

        const dateDetailsModal = bootstrap.Modal.getInstance(document.getElementById("dateDetailsModal"));
        if (dateDetailsModal) dateDetailsModal.hide();

        if (typeof loadCalendarData === "function") {
            loadCalendarData(CalendarState.currentYear);
        }
        if (typeof loadBookingsList === "function") {
            loadBookingsList();
        }
    })
    .catch(err => {
        alert("Error: " + err.message);
    });
}

/**
 * Delete Booking Handler
 */
function handleDeleteBooking(bookingId) {
    if (!confirm("Are you sure you want to PERMANENTLY DELETE this booking? This action cannot be undone.")) {
        return;
    }

    fetch(`/api/bookings/${bookingId}`, {
        method: "DELETE"
    })
    .then(res => res.json())
    .then(data => {
        if (!data.success) throw new Error(data.error || "Failed to delete booking");

        showNotification("Booking deleted successfully.", "info");

        const dateDetailsModal = bootstrap.Modal.getInstance(document.getElementById("dateDetailsModal"));
        if (dateDetailsModal) dateDetailsModal.hide();

        if (typeof loadCalendarData === "function") {
            loadCalendarData(CalendarState.currentYear);
        }
        if (typeof loadBookingsList === "function") {
            loadBookingsList();
        }
    })
    .catch(err => {
        alert("Error: " + err.message);
    });
}

/**
 * Load Bookings Table List (Owner View)
 */
function loadBookingsList() {
    const tbody = document.getElementById("bookingsTableBody");
    if (!tbody) return;

    const search = document.getElementById("bookingSearchInput")?.value || "";
    const status = document.getElementById("bookingStatusFilter")?.value || "";

    const params = new URLSearchParams();
    if (search) params.append("search", search);
    if (status) params.append("status", status);

    fetch(`/api/bookings?${params.toString()}`)
        .then(res => res.json())
        .then(data => {
            if (!data.success) throw new Error(data.error || "Failed to load bookings");
            const bookings = data.bookings || [];
            
            if (bookings.length === 0) {
                tbody.innerHTML = `<tr><td colspan="8" class="text-center py-4 text-muted">No bookings found matching filters.</td></tr>`;
                return;
            }

            let html = "";
            bookings.forEach(b => {
                const isCancelled = (b.status === "CANCELLED");
                html += `
                    <tr class="${isCancelled ? 'table-secondary opacity-75' : ''}">
                        <td class="fw-bold">${escapeHtml(b.travel_date)}</td>
                        <td>
                            <strong class="text-brand">${escapeHtml(b.bus_number)}</strong>
                            <div class="smaller text-muted">${escapeHtml(b.bus_type)}</div>
                        </td>
                        <td>
                            <div class="fw-semibold">${escapeHtml(b.source)} &rarr; ${escapeHtml(b.destination)}</div>
                        </td>
                        <td>
                            <div class="small">${escapeHtml(b.departure_time || 'N/A')}</div>
                            <div class="smaller text-muted">${escapeHtml(b.arrival_time || 'N/A')}</div>
                        </td>
                        <td>
                            <div class="small fw-semibold">${escapeHtml(b.driver_name || 'Unassigned')}</div>
                            <div class="smaller text-muted">${escapeHtml(b.driver_phone || '')}</div>
                        </td>
                        <td>
                            <div class="small">${escapeHtml(b.customer_name || 'N/A')}</div>
                            <div class="smaller text-muted">${escapeHtml(b.customer_phone || '')} (${b.passenger_count || 1}p)</div>
                        </td>
                        <td>
                            <span class="badge ${isCancelled ? 'bg-secondary' : 'bg-danger'} rounded-pill">
                                ${b.status}
                            </span>
                        </td>
                        <td class="text-end">
                            <div class="btn-group btn-group-sm">
                                <button class="btn btn-outline-primary" title="Edit" onclick="handleEditBooking('${b._id}')">
                                    <i class="bi bi-pencil"></i>
                                </button>
                                ${!isCancelled ? `
                                    <button class="btn btn-outline-warning" title="Cancel Booking" onclick="handleCancelBooking('${b._id}')">
                                        <i class="bi bi-slash-circle"></i>
                                    </button>
                                ` : ''}
                                <button class="btn btn-outline-danger" title="Delete" onclick="handleDeleteBooking('${b._id}')">
                                    <i class="bi bi-trash"></i>
                                </button>
                            </div>
                        </td>
                    </tr>
                `;
            });

            tbody.innerHTML = html;
        })
        .catch(err => {
            tbody.innerHTML = `<tr><td colspan="8" class="text-center py-4 text-danger">${err.message}</td></tr>`;
        });
}

/**
 * Toast / Alert Notification Helper
 */
function showNotification(message, type = "success") {
    let container = document.getElementById("toastContainer");
    if (!container) {
        container = document.createElement("div");
        container.id = "toastContainer";
        container.style.position = "fixed";
        container.style.bottom = "20px";
        container.style.right = "20px";
        container.style.zIndex = "9999";
        document.body.appendChild(container);
    }

    const toast = document.createElement("div");
    toast.className = `alert alert-${type} shadow rounded-3 py-2 px-3 mb-2 d-flex align-items-center gap-2`;
    toast.innerHTML = `<i class="bi bi-check-circle-fill"></i> <div>${escapeHtml(message)}</div>`;
    container.appendChild(toast);

    setTimeout(() => {
        toast.style.transition = "opacity 0.5s ease";
        toast.style.opacity = "0";
        setTimeout(() => toast.remove(), 500);
    }, 3500);
}
