/**
 * PANDAVAS SQARD - CALENDAR CORE ENGINE
 * Dynamic multi-year, leap-year, and weekday calculation.
 * Renders Theatre-Ticket Booking Grid (Large Month) and 12-Month Full Year Grid.
 */

const MONTH_NAMES = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
];

const WEEKDAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// Global calendar state
const CalendarState = {
    role: "driver", // 'owner' or 'driver'
    currentYear: new Date().getFullYear(),
    currentMonth: new Date().getMonth(), // 0 to 11
    activeView: "month", // 'month' or 'year' or 'list'
    yearBookingsMap: {}, // 'YYYY-MM-DD' -> [trip, ...]
    todayDateStr: "",
    selectedBus: "ALL", // 'ALL' or 'Pavitha_BM2999', 'Pavitha_BB2999', 'Bheeman_AK4777', 'Dharman_AZ2383', 'Jadamuni_B9939'
    syncInterval: null
};

// 5 Official Fleet Buses
const FLEET_BUSES = [
    { number: "Pavitha_BM2999", label: "Pavitha (BM 2999)", type: "AC Sleeper (2+1)" },
    { number: "Pavitha_BB2999", label: "Pavitha (BB 2999)", type: "AC Sleeper (2+1)" },
    { number: "Bheeman_AK4777", label: "Bheeman (AK 4777)", type: "AC Semi-Sleeper (2+2)" },
    { number: "Dharman_AZ2383", label: "Dharman (AZ 2383)", type: "AC Sleeper (2+1)" },
    { number: "Jadamuni_B9939", label: "Jadamuni (B 9939)", type: "Volvo Multi-Axle AC" }
];

/**
 * Switch Fleet Bus Filter
 */
function selectFleetBus(busNumber) {
    CalendarState.selectedBus = busNumber;

    // Update active button state in UI
    const buttons = document.querySelectorAll(".fleet-btn");
    buttons.forEach(btn => {
        if (btn.dataset.bus === busNumber) {
            btn.classList.add("active", "btn-brand");
            btn.classList.remove("btn-outline-secondary");
        } else {
            btn.classList.remove("active", "btn-brand");
            btn.classList.add("btn-outline-secondary");
        }
    });

    // Update status badge
    const badge = document.getElementById("fleetFilterStatusBadge");
    if (badge) {
        if (busNumber === "ALL") {
            badge.innerHTML = `<i class="bi bi-grid-fill me-1"></i> Showing: All 5 Buses`;
            badge.className = "badge bg-white text-brand fw-bold px-3 py-2 rounded-pill shadow-sm fs-6 mt-2 mt-sm-0";
        } else {
            const busObj = FLEET_BUSES.find(b => b.number === busNumber);
            const label = busObj ? busObj.label : busNumber;
            badge.innerHTML = `<i class="bi bi-bus-front-fill me-1"></i> Single Bus: ${label}`;
            badge.className = "badge bg-warning text-dark fw-bold px-3 py-2 rounded-pill shadow-sm fs-6 mt-2 mt-sm-0";
        }
    }

    // Reload calendar data for this specific bus
    loadCalendarData(CalendarState.currentYear, false);

    // If list view is active, update booking table filters too
    const busFilterSelect = document.getElementById("bookingBusFilter");
    if (busFilterSelect) {
        busFilterSelect.value = (busNumber === "ALL" ? "" : busNumber);
        if (typeof loadBookingsList === "function") {
            loadBookingsList();
        }
    }
}

// Formats a Date object to YYYY-MM-DD
function formatDateISO(year, monthIndex, day) {
    const y = year;
    const m = String(monthIndex + 1).padStart(2, '0');
    const d = String(day).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

// Pretty prints date for human display (e.g. 15 November 2026)
function formatPrettyDate(dateStr) {
    if (!dateStr) return "";
    const parts = dateStr.split("-");
    if (parts.length !== 3) return dateStr;
    const y = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10) - 1;
    const d = parseInt(parts[2], 10);
    return `${d} ${MONTH_NAMES[m]} ${y}`;
}

// Check leap year
function isLeapYear(year) {
    return (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
}

// Days in month
function getDaysInMonth(year, monthIndex) {
    const days = [31, (isLeapYear(year) ? 29 : 28), 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    return days[monthIndex];
}

// First day of month (0 = Sun, 1 = Mon, ..., 6 = Sat)
function getFirstDayOfMonth(year, monthIndex) {
    return new Date(year, monthIndex, 1).getDay();
}

/**
 * Initialize Calendar Application
 */
function initCalendarApp(options) {
    CalendarState.role = options.role || "driver";
    
    const now = new Date();
    CalendarState.todayDateStr = formatDateISO(now.getFullYear(), now.getMonth(), now.getDate());

    // Hook up view tabs
    const monthTab = document.getElementById("month-tab");
    const yearTab = document.getElementById("year-tab");
    const listTab = document.getElementById("list-tab") || document.getElementById("trips-tab");

    if (monthTab) {
        monthTab.addEventListener("shown.bs.tab", () => {
            CalendarState.activeView = "month";
            updatePeriodTitle();
            renderLargeMonthView();
        });
    }

    if (yearTab) {
        yearTab.addEventListener("shown.bs.tab", () => {
            CalendarState.activeView = "year";
            updatePeriodTitle();
            renderFullYearView();
        });
    }

    if (listTab) {
        listTab.addEventListener("shown.bs.tab", () => {
            CalendarState.activeView = "list";
            updatePeriodTitle();
            if (typeof loadBookingsList === "function") {
                loadBookingsList();
            } else if (typeof loadDriverTripsList === "function") {
                loadDriverTripsList();
            }
        });
    }

    // Hook up Previous, Next, and Today buttons
    const prevBtn = document.getElementById("prevPeriodBtn");
    const nextBtn = document.getElementById("nextPeriodBtn");
    const todayBtn = document.getElementById("todayBtn");
    const refreshBtn = document.getElementById("refreshBtn");

    if (prevBtn) {
        prevBtn.addEventListener("click", () => navigatePeriod(-1));
    }
    if (nextBtn) {
        nextBtn.addEventListener("click", () => navigatePeriod(1));
    }
    if (todayBtn) {
        todayBtn.addEventListener("click", jumpToToday);
    }
    if (refreshBtn) {
        refreshBtn.addEventListener("click", () => {
            triggerSyncAnimation(true);
            loadCalendarData(CalendarState.currentYear, true);
        });
    }

    // Initial load
    updatePeriodTitle();
    loadCalendarData(CalendarState.currentYear);

    // Auto-sync polling every 15 seconds
    if (CalendarState.syncInterval) clearInterval(CalendarState.syncInterval);
    CalendarState.syncInterval = setInterval(() => {
        loadCalendarData(CalendarState.currentYear, false);
    }, 15000);
}

/**
 * Period navigation: Prev / Next
 */
function navigatePeriod(direction) {
    if (CalendarState.activeView === "month") {
        let newMonth = CalendarState.currentMonth + direction;
        let newYear = CalendarState.currentYear;
        if (newMonth < 0) {
            newMonth = 11;
            newYear--;
        } else if (newMonth > 11) {
            newMonth = 0;
            newYear++;
        }
        CalendarState.currentMonth = newMonth;
        
        if (newYear !== CalendarState.currentYear) {
            CalendarState.currentYear = newYear;
            updatePeriodTitle();
            loadCalendarData(CalendarState.currentYear);
        } else {
            updatePeriodTitle();
            renderCurrentActiveViews();
        }
    } else {
        // Year or List view: navigate by 1 full year
        CalendarState.currentYear += direction;
        updatePeriodTitle();
        loadCalendarData(CalendarState.currentYear);
    }
}

/**
 * Jump to Today
 */
function jumpToToday() {
    const now = new Date();
    const prevYear = CalendarState.currentYear;
    CalendarState.currentYear = now.getFullYear();
    CalendarState.currentMonth = now.getMonth();
    updatePeriodTitle();

    if (CalendarState.currentYear !== prevYear) {
        loadCalendarData(CalendarState.currentYear);
    } else {
        renderCurrentActiveViews();
    }
}

/**
 * Updates period title text in header
 */
function updatePeriodTitle() {
    const titleEl = document.getElementById("periodTitle");
    if (!titleEl) return;

    if (CalendarState.activeView === "month") {
        titleEl.textContent = `${MONTH_NAMES[CalendarState.currentMonth]} ${CalendarState.currentYear}`;
    } else {
        titleEl.textContent = `Year ${CalendarState.currentYear}`;
    }
}

/**
 * Spin sync icon feedback
 */
function triggerSyncAnimation(showToast = false) {
    const icon = document.getElementById("refreshIcon");
    if (icon) {
        icon.classList.add("spin-sync");
        setTimeout(() => icon.classList.remove("spin-sync"), 800);
    }
}

/**
 * Fetch calendar bookings from server for specified year
 */
function loadCalendarData(year, showToast = false) {
    const busParam = (CalendarState.selectedBus && CalendarState.selectedBus !== "ALL")
        ? `?bus_number=${encodeURIComponent(CalendarState.selectedBus)}`
        : "";

    fetch(`/api/calendar/${year}${busParam}`)
        .then(response => {
            if (!response.ok) throw new Error("Failed to fetch calendar bookings");
            return response.json();
        })
        .then(data => {
            if (data.success) {
                CalendarState.yearBookingsMap = data.bookings || {};
                renderCurrentActiveViews();
                if (showToast && typeof showNotification === "function") {
                    showNotification("Calendar synchronized with server.", "success");
                }
            }
        })
        .catch(err => {
            console.error("Calendar fetch error:", err);
        });
}

function renderCurrentActiveViews() {
    renderLargeMonthView();
    renderFullYearView();
}

/**
 * Renders Large Current Month Calendar
 */
function renderLargeMonthView() {
    const container = document.getElementById("largeMonthCalendar");
    if (!container) return;

    const year = CalendarState.currentYear;
    const month = CalendarState.currentMonth;
    const totalDays = getDaysInMonth(year, month);
    const startWeekday = getFirstDayOfMonth(year, month);
    const today = CalendarState.todayDateStr;

    let html = `
        <div class="calendar-header-weekdays">
            <span class="text-danger">Sun</span>
            <span>Mon</span>
            <span>Tue</span>
            <span>Wed</span>
            <span>Thu</span>
            <span>Fri</span>
            <span>Sat</span>
        </div>
        <div class="calendar-days-grid">
    `;

    // Empty cells before day 1
    for (let i = 0; i < startWeekday; i++) {
        html += `<div class="cal-day-cell cal-day-empty"></div>`;
    }

    // Day cells 1 to totalDays
    for (let day = 1; day <= totalDays; day++) {
        const dateStr = formatDateISO(year, month, day);
        const trips = CalendarState.yearBookingsMap[dateStr] || [];
        const isBooked = trips.length > 0;
        const isToday = (dateStr === today);

        let cellClasses = ["cal-day-cell"];
        if (isToday) cellClasses.push("cal-day-today");
        if (isBooked) {
            cellClasses.push("cal-day-booked");
        } else {
            cellClasses.push("cal-day-available");
        }

        html += `
            <div class="${cellClasses.join(' ')}" onclick="handleDateClick('${dateStr}')" title="${isBooked ? trips.length + ' Bus(es) Booked' : 'Available Date'}">
                <div class="d-flex justify-content-between align-items-start">
                    <span class="cal-day-number">${day}</span>
                    <span class="cal-day-badge">
                        ${isBooked ? (trips.length > 1 ? `${trips.length} Buses` : 'Booked') : 'Available'}
                    </span>
                </div>
                ${isBooked ? `
                    <div class="cal-day-trips-preview">
                        ${trips.slice(0, 2).map(t => `
                            <div class="cal-mini-bus-tag" title="${t.bus_number} (${t.source} &rarr; ${t.destination})">
                                🚍 ${t.bus_number}
                            </div>
                        `).join('')}
                        ${trips.length > 2 ? `<span class="smaller text-danger fw-bold">+${trips.length - 2} more</span>` : ''}
                    </div>
                ` : `
                    <div class="mt-auto smaller text-success fw-semibold opacity-75 d-none d-sm-block">
                        Ready to book
                    </div>
                `}
            </div>
        `;
    }

    html += `</div>`;
    container.innerHTML = html;
}

/**
 * Renders Full Year 12-Month Calendar Grid
 */
function renderFullYearView() {
    const container = document.getElementById("fullYearGrid");
    if (!container) return;

    const year = CalendarState.currentYear;
    const today = CalendarState.todayDateStr;
    let html = "";

    for (let m = 0; m < 12; m++) {
        const monthName = MONTH_NAMES[m];
        const totalDays = getDaysInMonth(year, m);
        const startWeekday = getFirstDayOfMonth(year, m);

        html += `
            <div class="col-12 col-sm-6 col-lg-4 col-xl-3">
                <div class="mini-month-card">
                    <div class="mini-month-header">
                        <span>${monthName}</span>
                        <span class="smaller text-muted fw-normal">${year}</span>
                    </div>
                    <div class="mini-calendar-weekdays">
                        <span class="text-danger">S</span>
                        <span>M</span>
                        <span>T</span>
                        <span>W</span>
                        <span>T</span>
                        <span>F</span>
                        <span>S</span>
                    </div>
                    <div class="mini-calendar-days">
        `;

        // Empty cells before day 1
        for (let i = 0; i < startWeekday; i++) {
            html += `<div class="mini-cal-cell mini-cal-empty"></div>`;
        }

        // Days
        for (let day = 1; day <= totalDays; day++) {
            const dateStr = formatDateISO(year, m, day);
            const trips = CalendarState.yearBookingsMap[dateStr] || [];
            const isBooked = trips.length > 0;
            const isToday = (dateStr === today);

            let cellClasses = ["mini-cal-cell"];
            if (isToday) cellClasses.push("mini-cal-today");
            if (isBooked) {
                cellClasses.push("mini-cal-booked");
            } else {
                cellClasses.push("mini-cal-available");
            }

            html += `
                <div class="${cellClasses.join(' ')}" onclick="handleDateClick('${dateStr}')" title="${formatPrettyDate(dateStr)}: ${isBooked ? trips.length + ' Trip(s)' : 'Available'}">
                    ${day}
                </div>
            `;
        }

        html += `
                    </div>
                </div>
            </div>
        `;
    }

    container.innerHTML = html;
}

/**
 * Handles Date Click Event
 * Dispatches to Driver popup or Owner popup
 */
function handleDateClick(dateStr) {
    if (CalendarState.role === "driver") {
        showDriverDatePopup(dateStr);
    } else {
        showOwnerDatePopup(dateStr);
    }
}

/**
 * Driver Popup: Strictly Read-Only
 * Shows Trip Details for RED dates, or Date Available message for GREEN dates.
 */
function showDriverDatePopup(dateStr) {
    const modalEl = document.getElementById("driverTripModal");
    if (!modalEl) return;

    const modalBody = document.getElementById("driverTripModalBody");
    const modalTitle = document.getElementById("driverTripModalTitle");
    const prettyDate = formatPrettyDate(dateStr);

    const trips = CalendarState.yearBookingsMap[dateStr] || [];

    if (trips.length > 0) {
        modalTitle.textContent = "TRIP DETAILS";
        let tripsHtml = `
            <div class="mb-3 pb-2 border-bottom d-flex justify-content-between align-items-center">
                <div>
                    <h5 class="fw-bold text-dark mb-0">${prettyDate}</h5>
                    <span class="badge bg-danger rounded-pill px-3 py-1">BOOKED (${trips.length} Bus${trips.length > 1 ? 'es' : ''})</span>
                </div>
            </div>
            <div class="d-flex flex-column gap-3">
        `;

        trips.forEach((trip, idx) => {
            tripsHtml += `
                <div class="card border rounded-3 p-3 shadow-sm bg-light">
                    <div class="d-flex justify-content-between align-items-center mb-2">
                        <span class="badge bg-dark rounded-pill">Bus #${idx + 1}</span>
                        <span class="badge bg-danger-subtle text-danger fw-bold px-2 py-1">${trip.status || 'BOOKED'}</span>
                    </div>

                    <div class="row g-2 mb-2">
                        <div class="col-6">
                            <div class="trip-label">Bus Number</div>
                            <div class="trip-value text-brand">${escapeHtml(trip.bus_number)}</div>
                        </div>
                        <div class="col-6">
                            <div class="trip-label">Bus Type</div>
                            <div class="trip-value">${escapeHtml(trip.bus_type || 'AC Sleeper')}</div>
                        </div>
                    </div>

                    <div class="row g-2 mb-2">
                        <div class="col-6">
                            <div class="trip-label">Source</div>
                            <div class="trip-value text-primary">${escapeHtml(trip.source)}</div>
                        </div>
                        <div class="col-6">
                            <div class="trip-label">Destination</div>
                            <div class="trip-value text-primary">${escapeHtml(trip.destination)}</div>
                        </div>
                    </div>

                    <div class="row g-2 mb-2">
                        <div class="col-6">
                            <div class="trip-label">Departure</div>
                            <div class="trip-value">${escapeHtml(trip.departure_time || 'N/A')}</div>
                        </div>
                        <div class="col-6">
                            <div class="trip-label">Arrival</div>
                            <div class="trip-value">${escapeHtml(trip.arrival_time || 'N/A')}</div>
                        </div>
                    </div>

                    <div class="row g-2 pt-2 border-top">
                        <div class="col-12">
                            <div class="trip-label">Assigned Driver</div>
                            <div class="trip-value fw-bold text-dark">
                                <i class="bi bi-person-badge me-1"></i> ${escapeHtml(trip.driver_name || 'Unassigned')}
                                ${trip.driver_phone ? ` &bull; <i class="bi bi-telephone ms-1"></i> ${escapeHtml(trip.driver_phone)}` : ''}
                            </div>
                        </div>
                    </div>
                </div>
            `;
        });

        tripsHtml += `</div>`;
        modalBody.innerHTML = tripsHtml;
    } else {
        // Available Date
        const busNotice = (CalendarState.selectedBus && CalendarState.selectedBus !== "ALL")
            ? `<div class="badge bg-success-subtle text-success fs-6 mb-2">Bus: <strong>${escapeHtml(CalendarState.selectedBus)}</strong></div>`
            : "";
        modalTitle.textContent = "DATE AVAILABLE";
        modalBody.innerHTML = `
            <div class="text-center py-4">
                <div class="display-4 text-success mb-2">
                    <i class="bi bi-check-circle-fill"></i>
                </div>
                ${busNotice}
                <h4 class="fw-bold text-success mb-2">DATE AVAILABLE</h4>
                <p class="fs-5 fw-semibold text-dark mb-1">Date: ${prettyDate}</p>
                <p class="text-muted">Status: No booking available.</p>
                <div class="alert alert-success-subtle text-success small rounded-3 mx-auto mt-3" style="max-width: 380px;">
                    This date has no scheduled trips. Drivers are on standby or off duty.
                </div>
            </div>
        `;
    }

    const modal = new bootstrap.Modal(modalEl);
    modal.show();
}

/**
 * Owner Popup: Full Control
 * View trips on that date, edit/cancel/delete them, or create a new booking for that date.
 */
function showOwnerDatePopup(dateStr) {
    const modalEl = document.getElementById("dateDetailsModal");
    if (!modalEl) return;

    const titleEl = document.getElementById("dateDetailsTitle");
    const contentEl = document.getElementById("dateDetailsContent");
    const btnBookThisDate = document.getElementById("btnBookThisDate");
    const prettyDate = formatPrettyDate(dateStr);

    const busLabel = (CalendarState.selectedBus && CalendarState.selectedBus !== "ALL")
        ? ` (${CalendarState.selectedBus})`
        : "";
    titleEl.textContent = `Date Details: ${prettyDate}${busLabel}`;

    if (btnBookThisDate) {
        btnBookThisDate.onclick = () => {
            const modalInstance = bootstrap.Modal.getInstance(modalEl);
            if (modalInstance) modalInstance.hide();
            if (typeof openBookingModal === "function") {
                const prefillBus = (CalendarState.selectedBus !== "ALL") ? CalendarState.selectedBus : null;
                openBookingModal(null, dateStr, prefillBus);
            }
        };
    }

    // Fetch latest bookings for this date including cancelled if any
    const busParam = (CalendarState.selectedBus && CalendarState.selectedBus !== "ALL")
        ? `&bus_number=${encodeURIComponent(CalendarState.selectedBus)}`
        : "";

    fetch(`/api/bookings/date/${dateStr}?include_cancelled=true${busParam}`)
        .then(res => res.json())
        .then(res => {
            if (!res.success) throw new Error(res.error || "Failed to load date details");

            const trips = res.trips || [];
            if (trips.length === 0) {
                contentEl.innerHTML = `
                    <div class="text-center py-4">
                        <div class="display-5 text-success mb-2"><i class="bi bi-calendar-check"></i></div>
                        <h5 class="fw-bold text-success mb-1">Date Available</h5>
                        <p class="text-muted mb-3">No active or pending bus bookings for ${prettyDate}.</p>
                        <p class="small text-secondary">You can click "Book Bus on this Date" below to schedule a new bus trip.</p>
                    </div>
                `;
            } else {
                let html = `
                    <div class="d-flex justify-content-between align-items-center mb-3">
                        <span class="fw-bold text-dark">${trips.length} Booking(s) on ${prettyDate}</span>
                        <span class="badge bg-secondary-subtle text-secondary">Multiple buses allowed</span>
                    </div>
                    <div class="d-flex flex-column gap-3">
                `;

                trips.forEach((trip, idx) => {
                    const isCancelled = (trip.status === "CANCELLED");
                    html += `
                        <div class="card border rounded-3 p-3 shadow-sm ${isCancelled ? 'bg-secondary-subtle opacity-75' : 'bg-white'}">
                            <div class="d-flex justify-content-between align-items-center mb-2">
                                <span class="fw-bold fs-6 text-brand">
                                    <i class="bi bi-bus-front me-1"></i> ${escapeHtml(trip.bus_number)}
                                    <span class="badge bg-light text-dark border ms-2">${escapeHtml(trip.bus_type || 'AC')}</span>
                                </span>
                                <span class="badge ${isCancelled ? 'bg-secondary' : 'bg-danger'} rounded-pill">
                                    ${trip.status}
                                </span>
                            </div>

                            <div class="row g-2 mb-2 small">
                                <div class="col-12 col-sm-6">
                                    <span class="text-muted">Route:</span>
                                    <strong class="text-primary">${escapeHtml(trip.source)} &rarr; ${escapeHtml(trip.destination)}</strong>
                                </div>
                                <div class="col-12 col-sm-6">
                                    <span class="text-muted">Timing:</span>
                                    <span>${escapeHtml(trip.departure_time || 'N/A')} - ${escapeHtml(trip.arrival_time || 'N/A')}</span>
                                </div>
                                <div class="col-12 col-sm-6">
                                    <span class="text-muted">Driver:</span>
                                    <strong>${escapeHtml(trip.driver_name || 'None')}</strong> ${trip.driver_phone ? `(${escapeHtml(trip.driver_phone)})` : ''}
                                </div>
                                <div class="col-12 col-sm-6">
                                    <span class="text-muted">Customer:</span>
                                    <span>${escapeHtml(trip.customer_name || 'N/A')}</span> (${trip.passenger_count || 1} pass.)
                                </div>
                            </div>

                            <div class="d-flex justify-content-end gap-2 pt-2 border-top">
                                <button type="button" class="btn btn-outline-primary btn-sm rounded-pill px-3" onclick="handleEditBooking('${trip._id}')">
                                    <i class="bi bi-pencil-square me-1"></i> Edit
                                </button>
                                ${!isCancelled ? `
                                    <button type="button" class="btn btn-outline-warning btn-sm rounded-pill px-3" onclick="handleCancelBooking('${trip._id}')">
                                        <i class="bi bi-slash-circle me-1"></i> Cancel
                                    </button>
                                ` : ''}
                                <button type="button" class="btn btn-outline-danger btn-sm rounded-pill px-3" onclick="handleDeleteBooking('${trip._id}')">
                                    <i class="bi bi-trash3 me-1"></i> Delete
                                </button>
                            </div>
                        </div>
                    `;
                });

                html += `</div>`;
                contentEl.innerHTML = html;
            }

            const modal = new bootstrap.Modal(modalEl);
            modal.show();
        })
        .catch(err => {
            contentEl.innerHTML = `<div class="alert alert-danger">${err.message}</div>`;
            const modal = new bootstrap.Modal(modalEl);
            modal.show();
        });
}

// Utility HTML escape
function escapeHtml(str) {
    if (!str) return "";
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}
