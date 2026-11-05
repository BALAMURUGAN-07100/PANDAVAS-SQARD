/**
 * PANDAVAS SQARD - DASHBOARD MODULE
 * Handles Driver Management (Owner), Driver Trips List (Driver View),
 * and Interactive Fleet Photo Editing & Dynamic Banner Loading.
 */

document.addEventListener("DOMContentLoaded", function() {
    // 1. Dynamic Fleet Banner loading (All roles)
    loadFleetBanner();

    // 2. If Owner: load driver list and init photo editor
    if (window.CURRENT_USER && window.CURRENT_USER.role === "owner") {
        loadDriversList();

        const newDriverForm = document.getElementById("newDriverForm");
        if (newDriverForm) {
            newDriverForm.addEventListener("submit", handleAddDriver);
        }

        initFleetPhotoEditor();
    }

    // 3. If Driver: load trips list
    if (window.CURRENT_USER && window.CURRENT_USER.role === "driver") {
        loadDriverTripsList();
    }
});

/**
 * Load Active Fleet Banner from MongoDB / Server
 */
function loadFleetBanner() {
    fetch("/api/fleet-banner")
        .then(res => res.json())
        .then(data => {
            if (data && data.success && data.image_url) {
                const bannerImgs = document.querySelectorAll("#fleetBannerImg, .fleet-banner-img");
                bannerImgs.forEach(img => {
                    img.src = data.image_url;
                });
            }
        })
        .catch(err => {
            console.log("[BANNER] Using default banner:", err);
        });
}

/**
 * Interactive Fleet Photo Editor (Owner Only)
 * Allows choosing any image, rotating 90/180/270 degrees, flipping,
 * previewing live, and saving directly to MongoDB Atlas.
 */
function initFleetPhotoEditor() {
    const modalEl = document.getElementById("editFleetPhotoModal");
    if (!modalEl) return;

    const fileInput = document.getElementById("fleetFileInput");
    const canvas = document.getElementById("fleetCanvas");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    const btnRotateLeft = document.getElementById("btnRotateLeft");
    const btnRotateRight = document.getElementById("btnRotateRight");
    const btnRotate180 = document.getElementById("btnRotate180");
    const btnFlipH = document.getElementById("btnFlipH");
    const btnSave = document.getElementById("btnSaveFleetPhoto");
    const btnReset = document.getElementById("btnResetFleetDefault");
    const alertBox = document.getElementById("fleetPhotoAlert");
    const spinner = document.getElementById("saveBannerSpinner");
    const checkIcon = document.getElementById("saveBannerCheck");

    let editorImg = new Image();
    editorImg.crossOrigin = "anonymous";
    let currentRotation = 0; // 0, 90, 180, 270
    let flipH = 1; // 1 or -1

    function showAlert(msg, type) {
        if (!alertBox) return;
        alertBox.className = `alert alert-${type} rounded-3 small mb-3`;
        alertBox.textContent = msg;
        alertBox.classList.remove("d-none");
    }

    function hideAlert() {
        if (alertBox) alertBox.classList.add("d-none");
    }

    function renderCanvas() {
        if (!editorImg.complete || !editorImg.width) return;

        const isRotated90or270 = (currentRotation === 90 || currentRotation === 270);
        const naturalW = editorImg.naturalWidth || editorImg.width;
        const naturalH = editorImg.naturalHeight || editorImg.height;

        // Set canvas dimensions based on rotation
        const targetW = isRotated90or270 ? naturalH : naturalW;
        const targetH = isRotated90or270 ? naturalW : naturalH;

        // Keep internal canvas resolution optimal (max 1600px)
        const maxDim = 1600;
        let scale = 1;
        if (Math.max(targetW, targetH) > maxDim) {
            scale = maxDim / Math.max(targetW, targetH);
        }

        canvas.width = Math.round(targetW * scale);
        canvas.height = Math.round(targetH * scale);

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.save();

        // Move to center of canvas
        ctx.translate(canvas.width / 2, canvas.height / 2);
        // Rotate
        ctx.rotate((currentRotation * Math.PI) / 180);
        // Flip
        ctx.scale(flipH, 1);

        // Draw image centered
        const drawW = Math.round(naturalW * scale);
        const drawH = Math.round(naturalH * scale);
        ctx.drawImage(editorImg, -drawW / 2, -drawH / 2, drawW, drawH);

        ctx.restore();
    }

    // When modal opens, load the current banner into the canvas
    modalEl.addEventListener("show.bs.modal", function() {
        hideAlert();
        currentRotation = 0;
        flipH = 1;
        if (fileInput) fileInput.value = "";

        const currentBanner = document.getElementById("fleetBannerImg");
        const currentSrc = currentBanner ? currentBanner.src : "/static/images/fleet.jpg";

        editorImg = new Image();
        editorImg.crossOrigin = "anonymous";
        editorImg.onload = function() {
            renderCanvas();
        };
        editorImg.onerror = function() {
            showAlert("Could not load current image for editing.", "warning");
        };
        editorImg.src = currentSrc;
    });

    // Handle File Input Selection
    if (fileInput) {
        fileInput.addEventListener("change", function(e) {
            hideAlert();
            const file = e.target.files && e.target.files[0];
            if (!file) return;

            if (!file.type.startsWith("image/")) {
                showAlert("Please select a valid image file (JPG, PNG, WEBP).", "danger");
                return;
            }

            const reader = new FileReader();
            reader.onload = function(evt) {
                currentRotation = 0;
                flipH = 1;
                editorImg = new Image();
                editorImg.onload = function() {
                    renderCanvas();
                    showAlert("Image loaded! Use rotation buttons if needed, then click Save.", "info");
                };
                editorImg.src = evt.target.result;
            };
            reader.readAsDataURL(file);
        });
    }

    // Rotation and Flip Controls
    if (btnRotateLeft) {
        btnRotateLeft.addEventListener("click", function() {
            currentRotation = (currentRotation - 90 + 360) % 360;
            renderCanvas();
        });
    }

    if (btnRotateRight) {
        btnRotateRight.addEventListener("click", function() {
            currentRotation = (currentRotation + 90) % 360;
            renderCanvas();
        });
    }

    if (btnRotate180) {
        btnRotate180.addEventListener("click", function() {
            currentRotation = (currentRotation + 180) % 360;
            renderCanvas();
        });
    }

    if (btnFlipH) {
        btnFlipH.addEventListener("click", function() {
            flipH = flipH * -1;
            renderCanvas();
        });
    }

    // Save Fleet Banner
    if (btnSave) {
        btnSave.addEventListener("click", function() {
            hideAlert();
            if (!editorImg.width) {
                showAlert("No image loaded to save.", "warning");
                return;
            }

            // Show loading state
            btnSave.disabled = true;
            if (spinner) spinner.classList.remove("d-none");
            if (checkIcon) checkIcon.classList.add("d-none");

            try {
                const b64Data = canvas.toDataURL("image/jpeg", 0.88);

                fetch("/api/fleet-banner", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ image_data: b64Data })
                })
                .then(res => res.json())
                .then(data => {
                    btnSave.disabled = false;
                    if (spinner) spinner.classList.add("d-none");
                    if (checkIcon) checkIcon.classList.remove("d-none");

                    if (!data.success) {
                        throw new Error(data.error || "Failed to save image.");
                    }

                    // Update banner images live on the page
                    const bannerImgs = document.querySelectorAll("#fleetBannerImg, .fleet-banner-img");
                    bannerImgs.forEach(img => {
                        img.src = data.image_url;
                    });

                    // Close modal and show toast
                    const bsModal = bootstrap.Modal.getInstance(modalEl);
                    if (bsModal) bsModal.hide();

                    if (typeof showNotification === "function") {
                        showNotification("Fleet photo updated and saved to MongoDB!", "success");
                    } else {
                        alert("Fleet photo updated and saved!");
                    }
                })
                .catch(err => {
                    btnSave.disabled = false;
                    if (spinner) spinner.classList.add("d-none");
                    if (checkIcon) checkIcon.classList.remove("d-none");
                    showAlert("Error saving photo: " + err.message, "danger");
                });
            } catch (err) {
                btnSave.disabled = false;
                if (spinner) spinner.classList.add("d-none");
                if (checkIcon) checkIcon.classList.remove("d-none");
                showAlert("Processing error: " + err.message, "danger");
            }
        });
    }

    // Reset to Default Banner
    if (btnReset) {
        btnReset.addEventListener("click", function() {
            if (!confirm("Are you sure you want to reset the banner to the original photo?")) return;

            hideAlert();
            fetch("/api/fleet-banner/reset", { method: "POST" })
                .then(res => res.json())
                .then(data => {
                    if (!data.success) throw new Error(data.error || "Reset failed");

                    const bannerImgs = document.querySelectorAll("#fleetBannerImg, .fleet-banner-img");
                    bannerImgs.forEach(img => {
                        img.src = data.image_url + "?v=" + Date.now();
                    });

                    const bsModal = bootstrap.Modal.getInstance(modalEl);
                    if (bsModal) bsModal.hide();

                    if (typeof showNotification === "function") {
                        showNotification("Fleet photo reset to default.", "info");
                    } else {
                        alert("Fleet photo reset to default.");
                    }
                })
                .catch(err => showAlert("Reset error: " + err.message, "danger"));
        });
    }
}

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
 * Add New Driver Form Handler
 */
function handleAddDriver(e) {
    e.preventDefault();
    const alertBox = document.getElementById("driverFormAlert");
    if (alertBox) alertBox.classList.add("d-none");

    const username = document.getElementById("newDriverUsername").value.trim();
    const password = document.getElementById("newDriverPassword").value.trim();
    const driver_name = document.getElementById("newDriverFullName").value.trim();
    const phone = document.getElementById("newDriverPhone").value.trim();

    fetch("/api/drivers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password, driver_name, phone })
    })
    .then(res => res.json())
    .then(data => {
        if (!data.success) throw new Error(data.error || "Failed to create driver");
        document.getElementById("newDriverForm").reset();
        showNotification(data.message, "success");
        loadDriversList();
        if (typeof loadActiveDrivers === "function") {
            loadActiveDrivers();
        }
    })
    .catch(err => {
        if (alertBox) {
            alertBox.textContent = "Error: " + err.message;
            alertBox.classList.remove("d-none");
        }
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
            if (tbody) tbody.innerHTML = `<tr><td colspan="8" class="text-center py-4 text-danger">${err.message}</td></tr>`;
        });
}
