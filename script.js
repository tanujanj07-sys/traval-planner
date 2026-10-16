// ---------- Utilities ----------
const $ = (sel) => document.querySelector(sel);
const generateId = () => Math.random().toString(36).slice(2, 10);

function saveTrips(trips) {
  localStorage.setItem("travelPlannerTrips", JSON.stringify(trips));
}

function loadTrips() {
  const raw = localStorage.getItem("travelPlannerTrips");
  return raw ? JSON.parse(raw) : [];
}

function formatDate(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function daysBetween(start, end) {
  const s = new Date(start);
  const e = new Date(end);
  const diff = Math.ceil((e - s) / (1000 * 60 * 60 * 24)) + 1;
  return Math.max(1, diff);
}

function generateDayLabels(start, end) {
  const count = daysBetween(start, end);
  const labels = [];
  for (let i = 0; i < count; i++) {
    labels.push(`Day ${i + 1}`);
  }
  return labels;
}

// ---------- State ----------
let trips = loadTrips();
let currentTripId = null;

// ---------- Render Trips List ----------
function renderTripsList() {
  const container = $("#tripsList");
  container.innerHTML = "";

  if (trips.length === 0) {
    container.innerHTML = `<p style="color:#6b7280;">No trips yet. Create your first trip above.</p>`;
    return;
  }

  trips.forEach((trip) => {
    const totalBudget =
      Number(trip.budget.food) +
      Number(trip.budget.hotel) +
      Number(trip.budget.travel) +
      Number(trip.budget.other);

    const card = document.createElement("div");
    card.className = "trip-card";
    card.innerHTML = `
      <h3>${trip.destination}</h3>
      <p>${formatDate(trip.startDate)} – ${formatDate(trip.endDate)}</p>
      <span class="budget-tag">₹${totalBudget.toLocaleString("en-IN")}</span>
    `;
    card.addEventListener("click", () => openTripModal(trip.id));
    container.appendChild(card);
  });
}

// ---------- Add Trip ----------
$("#tripForm").addEventListener("submit", (e) => {
  e.preventDefault();

  const destination = $("#destination").value.trim();
  const startDate = $("#startDate").value;
  const endDate = $("#endDate").value;

  if (!destination || !startDate || !endDate) return;

  const trip = {
    id: generateId(),
    destination,
    startDate,
    endDate,
    budget: {
      food: Number($("#foodBudget").value) || 0,
      hotel: Number($("#hotelBudget").value) || 0,
      travel: Number($("#travelBudget").value) || 0,
      other: Number($("#otherBudget").value) || 0,
    },
    days: [], // each day: { label, activities: [{time, name, cost}] }
  };

  const dayLabels = generateDayLabels(startDate, endDate);
  trip.days = dayLabels.map((label) => ({ label, activities: [] }));

  trips.push(trip);
  saveTrips(trips);

  $("#tripForm").reset();
  renderTripsList();
});

// ---------- Modal Logic ----------
const modal = $("#tripModal");
const closeModalBtn = $("#closeModal");

closeModalBtn.addEventListener("click", () => {
  modal.classList.add("hidden");
  currentTripId = null;
});

modal.addEventListener("click", (e) => {
  if (e.target === modal) {
    modal.classList.add("hidden");
    currentTripId = null;
  }
});

function findTrip(id) {
  return trips.find((t) => t.id === id);
}

function openTripModal(id) {
  currentTripId = id;
  const trip = findTrip(id);
  if (!trip) return;

  $("#modalTitle").textContent = trip.destination;
  $("#modalDestination").textContent = trip.destination;
  $("#modalDates").textContent =
    `${formatDate(trip.startDate)} – ${formatDate(trip.endDate)}`;

  const totalBudget =
    trip.budget.food + trip.budget.hotel + trip.budget.travel + trip.budget.other;
  $("#modalTotalBudget").textContent = totalBudget.toLocaleString("en-IN");

  // Day select options
  const daySelect = $("#daySelect");
  daySelect.innerHTML = "";
  trip.days.forEach((day, idx) => {
    const opt = document.createElement("option");
    opt.value = idx;
    opt.textContent = day.label;
    daySelect.appendChild(opt);
  });

  $("#currentTripId").value = trip.id;

  renderItinerary(trip);
  renderBudgetSummary(trip);

  modal.classList.remove("hidden");
}

// ---------- Itinerary Rendering ----------
function renderItinerary(trip) {
  const container = $("#itineraryContainer");
  container.innerHTML = "";

  trip.days.forEach((day, dayIdx) => {
    const block = document.createElement("div");
    block.className = "day-block";

    const title = document.createElement("h4");
    title.textContent = day.label;
    block.appendChild(title);

    const list = document.createElement("ul");
    list.className = "activity-list";

    if (day.activities.length === 0) {
      const empty = document.createElement("li");
      empty.textContent = "No activities yet.";
      empty.style.color = "#6b7280";
      empty.style.fontSize = "0.9rem";
      list.appendChild(empty);
    } else {
      day.activities
        .slice()
        .sort((a, b) => a.time.localeCompare(b.time))
        .forEach((act, actIdx) => {
          const li = document.createElement("li");
          li.className = "activity-item";
          li.innerHTML = `
            <div class="act-left">
              <strong>${act.name}</strong>
              <span class="act-time">⏰ ${act.time}</span>
            </div>
            <div class="act-right">
              <span class="act-cost">₹${Number(act.cost || 0).toLocaleString("en-IN")}</span>
              <button class="delete-act-btn" data-day="${dayIdx}" data-idx="${actIdx}" style="margin-left:8px;background:#ef4444;">×</button>
            </div>
          `;
          list.appendChild(li);
        });
    }

    block.appendChild(list);
    container.appendChild(block);
  });

  // Attach delete handlers
  container.querySelectorAll(".delete-act-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const dayIdx = Number(e.target.dataset.day);
      const actIdx = Number(e.target.dataset.idx);
      deleteActivity(currentTripId, dayIdx, actIdx);
    });
  });
}

// ---------- Add Activity ----------
$("#activityForm").addEventListener("submit", (e) => {
  e.preventDefault();
  if (!currentTripId) return;

  const trip = findTrip(currentTripId);
  if (!trip) return;

  const dayIdx = Number($("#daySelect").value);
  const time = $("#activityTime").value;
  const name = $("#activityName").value.trim();
  const cost = Number($("#activityCost").value) || 0;

  if (!time || !name) return;

  trip.days[dayIdx].activities.push({ time, name, cost });
  saveTrips(trips);

  $("#activityTime").value = "";
  $("#activityName").value = "";
  $("#activityCost").value = "0";

  renderItinerary(trip);
  renderBudgetSummary(trip);
});

function deleteActivity(tripId, dayIdx, actIdx) {
  const trip = findTrip(tripId);
  if (!trip) return;

  trip.days[dayIdx].activities.splice(actIdx, 1);
  saveTrips(trips);
  renderItinerary(trip);
  renderBudgetSummary(trip);
}

// ---------- Budget Summary ----------
function renderBudgetSummary(trip) {
  const planned =
    trip.budget.food +
    trip.budget.hotel +
    trip.budget.travel +
    trip.budget.other;

  let activitiesCost = 0;
  trip.days.forEach((day) => {
    day.activities.forEach((act) => {
      activitiesCost += Number(act.cost || 0);
    });
  });

  const remaining = planned - activitiesCost;

  $("#sumFood").textContent = trip.budget.food.toLocaleString("en-IN");
  $("#sumHotel").textContent = trip.budget.hotel.toLocaleString("en-IN");
  $("#sumTravel").textContent = trip.budget.travel.toLocaleString("en-IN");
  $("#sumOther").textContent = trip.budget.other.toLocaleString("en-IN");
  $("#sumTotal").textContent = planned.toLocaleString("en-IN");
  $("#sumActivities").textContent = activitiesCost.toLocaleString("en-IN");
  $("#sumRemaining").textContent = remaining.toLocaleString("en-IN");
}

// ---------- Delete Trip ----------
$("#deleteTripBtn").addEventListener("click", () => {
  if (!currentTripId) return;
  const ok = confirm("Are you sure you want to delete this trip?");
  if (!ok) return;

  trips = trips.filter((t) => t.id !== currentTripId);
  saveTrips(trips);
  modal.classList.add("hidden");
  currentTripId = null;
  renderTripsList();
});

// ---------- Init ----------
renderTripsList();