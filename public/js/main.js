/* WanderLust — front-end behaviour (search, filters, booking card) */

document.addEventListener("DOMContentLoaded", () => {
  initThemeSwitcher();
  initHeroSlideshow();
  initCancelTripModal();
  initMobileNav();
  initUserMenu();
  initNavSearch();
  initHeroSearch();
  initCategoryPills();
  initFilterPresets();
  initBookingCard();
  initShareButtons();
});

/* Share button copies the current page URL to the clipboard */
function initShareButtons() {
  const btn = document.getElementById("share-btn");
  if (!btn) return;
  btn.addEventListener("click", async () => {
    const url = window.location.href;
    try {
      await navigator.clipboard.writeText(url);
      const label = btn.textContent.trim();
      btn.innerHTML = '<i class="fa-solid fa-check"></i> Link copied';
      setTimeout(() => {
        btn.innerHTML = '<i class="fa-solid fa-share-nodes"></i> ' + label;
      }, 2000);
    } catch (e) {
      window.prompt("Copy this link:", url);
    }
  });
}

/* Quick price range presets in Filter modal */
function initFilterPresets() {
  const presets = document.querySelectorAll(".price-preset");
  const minInput = document.getElementById("modal-filter-min");
  const maxInput = document.getElementById("modal-filter-max");
  if (!presets.length || !minInput || !maxInput) return;

  presets.forEach((btn) => {
    btn.addEventListener("click", () => {
      const min = btn.getAttribute("data-min") || "";
      const max = btn.getAttribute("data-max") || "";
      minInput.value = min;
      maxInput.value = max;

      presets.forEach((p) => p.classList.remove("active", "btn-dark", "text-white"));
      btn.classList.add("active");
    });
  });
}

/* Account menu dropdown (desktop) */
function initUserMenu() {
  const toggle = document.getElementById("nav-user-toggle");
  const menu = document.getElementById("nav-user-menu");
  if (!toggle || !menu) return;

  toggle.addEventListener("click", (e) => {
    e.stopPropagation();
    const open = menu.classList.toggle("open");
    toggle.setAttribute("aria-expanded", String(open));
  });

  document.addEventListener("click", (e) => {
    if (!menu.contains(e.target)) {
      menu.classList.remove("open");
      toggle.setAttribute("aria-expanded", "false");
    }
  });
}

/* Mobile hamburger menu */
function initMobileNav() {
  const toggle = document.getElementById("nav-menu-toggle");
  const menu = document.getElementById("nav-mobile-menu");
  if (!toggle || !menu) return;

  toggle.addEventListener("click", () => {
    const open = menu.classList.toggle("open");
    toggle.setAttribute("aria-expanded", String(open));
  });

  menu.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => {
      menu.classList.remove("open");
      toggle.setAttribute("aria-expanded", "false");
    });
  });
}

/* Navbar search → jumps to /listings?search=… */
function initNavSearch() {
  const input = document.getElementById("nav-search-input");
  const btn = document.getElementById("nav-search-btn");
  if (!input) return;

  const go = () => {
    const q = input.value.trim();
    window.location.href = q ? "/listings?search=" + encodeURIComponent(q) : "/listings";
  };

  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      go();
    }
  });
  if (btn) btn.addEventListener("click", go);
}

/* Hero search: guest clamp & interactive Airbnb visual calendar popover */
function initHeroSearch() {
  const guests = document.getElementById("hero-guests");
  const form = document.querySelector(".hero-search");
  if (!form) return;

  if (guests) {
    guests.addEventListener("change", () => {
      let v = parseInt(guests.value, 10);
      if (isNaN(v)) v = 1;
      guests.value = Math.max(1, Math.min(16, v));
    });
  }

  initHeroCalendarSearch();
}

function initHeroCalendarSearch() {
  const wrapper = document.getElementById("hero-search-wrapper");
  const checkinField = document.getElementById("hero-checkin-field");
  const checkoutField = document.getElementById("hero-checkout-field");
  const popover = document.getElementById("hero-calendar-popover");
  const checkinVal = document.getElementById("hero-checkin-val");
  const checkoutVal = document.getElementById("hero-checkout-val");
  const checkinLabel = document.getElementById("hero-checkin-label");
  const checkoutLabel = document.getElementById("hero-checkout-label");
  const gridContainer = document.getElementById("hero-cal-grid");
  const clearBtn = document.getElementById("hero-cal-clear");
  const prevBtn = document.getElementById("hero-cal-prev");
  const nextBtn = document.getElementById("hero-cal-next");
  const calTitle = document.getElementById("hero-cal-title");
  const calSub = document.getElementById("hero-cal-sub");

  if (!wrapper || !popover || !gridContainer) return;

  const togglePopover = (show) => {
    popover.style.display = show ? "block" : "none";
  };

  if (checkinField) {
    checkinField.addEventListener("click", (e) => {
      e.stopPropagation();
      togglePopover(true);
    });
  }

  if (checkoutField) {
    checkoutField.addEventListener("click", (e) => {
      e.stopPropagation();
      togglePopover(true);
    });
  }

  document.addEventListener("click", (e) => {
    if (!wrapper.contains(e.target)) {
      togglePopover(false);
    }
  });

  let currentDate = new Date();
  let currentMonth1 = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
  let startDate = checkinVal && checkinVal.value ? new Date(checkinVal.value + "T00:00:00") : null;
  let endDate = checkoutVal && checkoutVal.value ? new Date(checkoutVal.value + "T00:00:00") : null;
  let hoverDate = null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  function formatDateLabel(d) {
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }

  function render() {
    const month2 = new Date(currentMonth1.getFullYear(), currentMonth1.getMonth() + 1, 1);
    const months = [currentMonth1, month2];

    gridContainer.innerHTML = months.map((m) => renderMonthHTML(m)).join("");

    updateHeader();
    attachListeners();
  }

  function renderMonthHTML(monthDate) {
    const year = monthDate.getFullYear();
    const month = monthDate.getMonth();
    const monthName = monthDate.toLocaleDateString("en-US", { month: "long", year: "numeric" });
    const firstDayIndex = new Date(year, month, 1).getDay();
    const totalDays = new Date(year, month + 1, 0).getDate();

    let daysHTML = "";
    for (let i = 0; i < firstDayIndex; i++) {
      daysHTML += "<div></div>";
    }

    for (let day = 1; day <= totalDays; day++) {
      const d = new Date(year, month, day);
      d.setHours(0, 0, 0, 0);
      const isoStr = d.toISOString().split("T")[0];
      const disabled = d < today;

      let classes = ["cal-day"];
      if (disabled) classes.push("day-disabled");

      const timeVal = d.getTime();
      const startTime = startDate ? startDate.getTime() : null;
      const endTime = endDate ? endDate.getTime() : null;
      const hoverTime = hoverDate ? hoverDate.getTime() : null;

      if (startTime && timeVal === startTime) {
        classes.push("day-start");
      } else if (endTime && timeVal === endTime) {
        classes.push("day-end");
      } else if (startTime && endTime && timeVal > startTime && timeVal < endTime) {
        classes.push("day-in-range");
      } else if (startTime && !endTime && hoverTime && timeVal > startTime && timeVal <= hoverTime) {
        classes.push("day-in-range-hover");
      }

      daysHTML += `<button type="button" class="${classes.join(" ")}" data-date="${isoStr}" ${disabled ? "disabled" : ""}>${day}</button>`;
    }

    return `
      <div class="airbnb-month">
        <div class="airbnb-cal-month-title">${monthName}</div>
        <div class="airbnb-cal-weekdays">
          <span>Su</span><span>Mo</span><span>Tu</span><span>We</span><span>Th</span><span>Fr</span><span>Sa</span>
        </div>
        <div class="airbnb-cal-days">${daysHTML}</div>
      </div>
    `;
  }

  function updateHeader() {
    if (startDate && endDate) {
      const nights = Math.round((endDate - startDate) / (1000 * 60 * 60 * 24));
      if (calTitle) calTitle.textContent = `${nights} night${nights > 1 ? "s" : ""}`;
      if (calSub) calSub.textContent = `${formatDateLabel(startDate)} – ${formatDateLabel(endDate)}`;
      if (checkinLabel) {
        checkinLabel.textContent = formatDateLabel(startDate);
        checkinLabel.classList.remove("text-muted");
      }
      if (checkoutLabel) {
        checkoutLabel.textContent = formatDateLabel(endDate);
        checkoutLabel.classList.remove("text-muted");
      }
    } else if (startDate) {
      if (calTitle) calTitle.textContent = "Select check-out date";
      if (calSub) calSub.textContent = `Check-in: ${formatDateLabel(startDate)}`;
      if (checkinLabel) {
        checkinLabel.textContent = formatDateLabel(startDate);
        checkinLabel.classList.remove("text-muted");
      }
      if (checkoutLabel) {
        checkoutLabel.textContent = "Add dates";
        checkoutLabel.classList.add("text-muted");
      }
    } else {
      if (calTitle) calTitle.textContent = "Select dates";
      if (calSub) calSub.textContent = "Minimum stay 1 night";
      if (checkinLabel) {
        checkinLabel.textContent = "Add dates";
        checkinLabel.classList.add("text-muted");
      }
      if (checkoutLabel) {
        checkoutLabel.textContent = "Add dates";
        checkoutLabel.classList.add("text-muted");
      }
    }
  }

  function attachListeners() {
    gridContainer.querySelectorAll(".cal-day:not(.day-disabled)").forEach((btn) => {
      btn.addEventListener("click", () => {
        const iso = btn.getAttribute("data-date");
        const clicked = new Date(iso + "T00:00:00");

        if (!startDate || (startDate && endDate)) {
          startDate = clicked;
          endDate = null;
          if (checkinVal) checkinVal.value = iso;
          if (checkoutVal) checkoutVal.value = "";
        } else if (startDate && !endDate) {
          if (clicked <= startDate) {
            startDate = clicked;
            if (checkinVal) checkinVal.value = iso;
          } else {
            endDate = clicked;
            if (checkoutVal) checkoutVal.value = iso;
            // Auto close popover on range completion
            setTimeout(() => togglePopover(false), 250);
          }
        }

        render();
      });

      btn.addEventListener("mouseenter", () => {
        if (startDate && !endDate) {
          const iso = btn.getAttribute("data-date");
          hoverDate = new Date(iso + "T00:00:00");
          renderHover();
        }
      });
    });
  }

  function renderHover() {
    gridContainer.querySelectorAll(".cal-day").forEach((btn) => {
      const iso = btn.getAttribute("data-date");
      if (!iso) return;
      const d = new Date(iso + "T00:00:00").getTime();
      const st = startDate ? startDate.getTime() : null;
      const ht = hoverDate ? hoverDate.getTime() : null;

      if (st && ht && d > st && d <= ht) {
        btn.classList.add("day-in-range-hover");
      } else {
        btn.classList.remove("day-in-range-hover");
      }
    });
  }

  if (prevBtn) {
    prevBtn.addEventListener("click", () => {
      currentMonth1.setMonth(currentMonth1.getMonth() - 1);
      render();
    });
  }

  if (nextBtn) {
    nextBtn.addEventListener("click", () => {
      currentMonth1.setMonth(currentMonth1.getMonth() + 1);
      render();
    });
  }

  if (clearBtn) {
    clearBtn.addEventListener("click", () => {
      startDate = null;
      endDate = null;
      if (checkinVal) checkinVal.value = "";
      if (checkoutVal) checkoutVal.value = "";
      render();
    });
  }

  render();
}

/* Category pills filter the grid by keyword (client-side, instant) */
const CATEGORY_KEYWORDS = {
  "amazing-views": ["view", "views", "panoramic", "scenic", "cliff", "sea view", "mountain view", "ocean view", "valley", "sunset"],
  beach: ["beach", "beachfront", "seaside", "ocean", "sea", "coast", "coastal", "bali", "cancun", "maldives", "phuket", "mykonos", "fiji", "greece", "goa"],
  cabin: ["cabin", "cabins", "log cabin", "chalet", "wood cabin"],
  countryside: ["countryside", "rural", "village", "farmland", "ranch", "meadow"],
  farm: ["farm", "farmstay", "ranch", "farmhouse", "agriculture", "barn"],
  lake: ["lake", "lakefront", "lakeside", "waterfront", "pond", "reservoir"],
  treehouse: ["treehouse", "tree house", "tree-top", "canopy"],
  camping: ["camp", "campsite", "glamping", "yurt", "tent", "bonfire"],
  tiny: ["tiny", "micro", "compact", "studios", "studio"],
  island: ["island", "private island", "atoll", "islet", "beach house"],
  mansion: ["mansion", "estate", "manor", "palatial"],
  castle: ["castle", "fort", "palace", "chateau", "citadel"],
  luxury: ["luxury", "luxurious", "penthouse", "castle", "private island", "overwater", "opulent", "private pool", "villa", "indulge", "5-star", "five-star"],
  ski: ["ski", "skiing", "snow", "alps", "winter", "snowboard", "chalet"],
  tropical: ["tropical", "palm", "rainforest", "resort", "phuket", "bali", "maldives", "goa", "kerala", "cancun", "fiji"],
  city: ["city", "downtown", "apartment", "loft", "penthouse", "tokyo", "new york", "miami", "los angeles", "dubai", "amsterdam", "bangkok", "delhi", "mumbai"],
  mountain: ["mountain", "mountains", "alps", "banff", "aspen", "rockies", "ski", "chalet", "swiss", "vermont", "highlands", "himalayas", "manali", "shimla"],
  nature: ["treehouse", "nature", "eco", "forest", "lake", "cabin", "rustic", "garden", "kayak", "wilderness", "jungle"],
};

function initCategoryPills() {
  const pills = document.querySelectorAll(".category-pill");
  if (!pills.length) return;

  const urlParams = new URLSearchParams(window.location.search);
  const currentCategory = urlParams.get("category") || "all";

  pills.forEach((pill) => {
    const cat = pill.dataset.category || "all";
    if (cat === currentCategory) {
      pill.classList.add("active");
    } else {
      pill.classList.remove("active");
    }

    pill.addEventListener("click", (e) => {
      e.preventDefault();
      const targetUrl = cat === "all" ? "/listings" : `/listings?category=${encodeURIComponent(cat)}`;
      window.location.href = targetUrl;
    });
  });
}

/* Booking card: real date picker + live price breakdown + reserve */
function initBookingCard() {
  const minus = document.getElementById("guest-minus");
  const plus = document.getElementById("guest-plus");
  const count = document.getElementById("guest-count");
  const checkin = document.getElementById("booking-checkin");
  const checkout = document.getElementById("booking-checkout");
  const guestsHidden = document.getElementById("booking-guests");
  const form = document.getElementById("booking-form");
  const reserve = document.getElementById("reserve-btn");
  const priceEl = document.querySelector(".booking-price");
  if (!priceEl && !checkin) return;

  const price = priceEl ? Number(priceEl.getAttribute("data-price")) || 0 : 0;
  let guests = 1;

  const fmt = (n) => Math.round(n).toLocaleString("en-IN");

  const updateSummary = () => {
    const nights = calcNights();
    const subtotal = price * nights;
    const cleaning = subtotal * 0.08;
    const service = subtotal * 0.12;
    const total = subtotal + cleaning + service;

    const set = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.textContent = val;
    };
    set("sum-nights", nights);
    set("sum-rate", fmt(price));
    set("sum-subtotal", fmt(subtotal));
    set("sum-cleaning", fmt(cleaning));
    set("sum-service", fmt(service));
    set("sum-total", fmt(total));
    set("sum-guests", guests);

    const suffix = document.getElementById("sum-guests-suffix");
    if (suffix) suffix.textContent = guests > 1 ? "s" : "";

    if (reserve) {
      reserve.textContent = nights > 0
        ? "Reserve — \u20B9" + fmt(total)
        : "Reserve";
    }
  };

  const calcNights = () => {
    if (!checkin || !checkout || !checkin.value || !checkout.value) {
      const summary = document.getElementById("stay-summary");
      if (summary) summary.classList.remove("show");
      return 0;
    }
    const start = new Date(checkin.value + "T00:00:00");
    const end = new Date(checkout.value + "T00:00:00");
    const diff = Math.round((end - start) / 86400000);
    if (diff <= 0) {
      const summary = document.getElementById("stay-summary");
      if (summary) summary.classList.remove("show");
      return 0;
    }
    const summary = document.getElementById("stay-summary");
    if (summary) summary.classList.add("show");
    return diff;
  };

  const today = new Date().toISOString().split("T")[0];
  if (checkin) checkin.min = today;
  if (checkout) checkout.min = today;

  if (checkin) {
    checkin.addEventListener("change", () => {
      if (checkin.value) checkout.min = checkin.value;
      if (checkout.value && checkin.value > checkout.value) checkout.value = "";
      updateSummary();
    });
  }
  if (checkout) {
    checkout.addEventListener("change", () => {
      if (checkin.value && checkin.value > checkout.value) {
        checkout.setCustomValidity("Check-out must be after check-in.");
      } else {
        checkout.setCustomValidity("");
      }
      updateSummary();
    });
  }

  if (minus && plus && count) {
    const updateGuests = () => {
      count.textContent = guests;
      minus.disabled = guests <= 1;
      if (guestsHidden) guestsHidden.value = guests;
      updateSummary();
    };

    minus.addEventListener("click", () => {
      if (guests > 1) {
        guests--;
        updateGuests();
      }
    });

    plus.addEventListener("click", () => {
      if (guests < 16) {
        guests++;
        updateGuests();
      }
    });

    updateGuests();
  } else {
    updateSummary();
  }

  if (form) {
    form.addEventListener("submit", (e) => {
      const nights = calcNights();
      if (!checkin || !checkout || !checkin.value || !checkout.value || nights <= 0) {
        e.preventDefault();
        alert("Please select your check-in and check-out dates first.");
        return;
      }
      if (guessUnavailable(checkin.value, checkout.value)) {
        e.preventDefault();
        alert("Ouch — one of those nights overlaps an existing booking. Please choose different dates.");
        return;
      }
    });
  }
}

/* Blocked ranges rendered on the page (from confirmed bookings). */
function getBlockedRanges() {
  const el = document.querySelector(".booked-ranges");
  if (!el) return [];
  const raw = el.textContent;
  const ranges = [];
  const re = /(\d{4}-\d{2}-\d{2})\s*–\s*(\d{4}-\d{2}-\d{2})/g;
  let m;
  while ((m = re.exec(raw)) !== null) {
    ranges.push({ from: m[1], to: m[2] });
  }
  return ranges;
}

function guessUnavailable(checkin, checkout) {
  const start = new Date(checkin + "T00:00:00");
  const end = new Date(checkout + "T00:00:00");
  return getBlockedRanges().some((r) => {
    const rf = new Date(r.from + "T00:00:00");
    const rt = new Date(r.to + "T00:00:00");
    return start < rt && rf < end;
  });
}

/* ═══════════════════════════════════════════
   THEME SWITCHER: Lumina Modern vs. Pixel Escapes
   ═══════════════════════════════════════════ */
function initThemeSwitcher() {
  const root = document.documentElement;
  const toggleBtn = document.getElementById("theme-toggle-btn");
  const mobileToggles = document.querySelectorAll(".mobile-theme-toggle");
  const mobileLabels = document.querySelectorAll(".mobile-theme-label");

  function applyTheme(theme) {
    root.setAttribute("data-theme", theme);
    localStorage.setItem("wanderlust_theme", theme);

    if (toggleBtn) {
      toggleBtn.setAttribute("data-theme-active", theme);
    }
    mobileLabels.forEach((lbl) => {
      lbl.textContent = theme === "pixel" ? "Pixel Escapes 👾" : "Lumina Modern ✨";
    });
  }

  const currentTheme = localStorage.getItem("wanderlust_theme") || "lumina";
  applyTheme(currentTheme);

  if (toggleBtn) {
    toggleBtn.addEventListener("click", () => {
      const active = root.getAttribute("data-theme") || "lumina";
      const next = active === "pixel" ? "lumina" : "pixel";
      applyTheme(next);
    });
  }

  mobileToggles.forEach((btn) => {
    btn.addEventListener("click", () => {
      const active = root.getAttribute("data-theme") || "lumina";
      const next = active === "pixel" ? "lumina" : "pixel";
      applyTheme(next);
    });
  });
}

/* ═══════════════════════════════════════════
   5-SECOND HERO SLIDESHOW (STAYS FROM DATA.JS)
   ═══════════════════════════════════════════ */
function initHeroSlideshow() {
  const container = document.getElementById("hero-slideshow");
  if (!container) return;

  const slides = container.querySelectorAll(".hero-slide");
  if (slides.length <= 1) return;

  const dotsContainer = document.getElementById("hero-dots");
  let currentIndex = 0;
  let timer = null;

  // Build clickable dot indicators
  if (dotsContainer) {
    dotsContainer.innerHTML = "";
    slides.forEach((_, idx) => {
      const dot = document.createElement("button");
      dot.className = "hero-dot" + (idx === 0 ? " active" : "");
      dot.type = "button";
      dot.setAttribute("aria-label", "Go to stay slide " + (idx + 1));
      dot.addEventListener("click", (e) => {
        e.preventDefault();
        goToSlide(idx);
        restartTimer();
      });
      dotsContainer.appendChild(dot);
    });
  }

  function goToSlide(idx) {
    slides[currentIndex].classList.remove("active");
    const dots = dotsContainer ? dotsContainer.querySelectorAll(".hero-dot") : [];
    if (dots[currentIndex]) dots[currentIndex].classList.remove("active");

    currentIndex = (idx + slides.length) % slides.length;

    slides[currentIndex].classList.add("active");
    if (dots[currentIndex]) dots[currentIndex].classList.add("active");
  }

  function nextSlide() {
    goToSlide(currentIndex + 1);
  }

  function startTimer() {
    if (!timer) {
      timer = setInterval(nextSlide, 5000);
    }
  }

  function stopTimer() {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  }

  function restartTimer() {
    stopTimer();
    startTimer();
  }

  startTimer();

  // Pause when user is focusing or typing in the search bar
  const heroSearch = document.querySelector(".glass-search-form, .hero-search");
  if (heroSearch) {
    heroSearch.addEventListener("focusin", stopTimer);
    heroSearch.addEventListener("focusout", startTimer);
  }
}

/* ═══════════════════════════════════════════
   CONFIRM CANCEL TRIP MODAL CONTROLLER
   ═══════════════════════════════════════════ */
function initCancelTripModal() {
  const btns = document.querySelectorAll(".open-cancel-modal-btn");
  const modalEl = document.getElementById("cancelTripModal");
  if (!btns.length || !modalEl) return;

  const form = document.getElementById("cancel-trip-form");
  const titleSpan = document.getElementById("cancel-modal-stay-title");

  btns.forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      const tripId = btn.getAttribute("data-trip-id");
      const tripTitle = btn.getAttribute("data-trip-title");

      if (form && tripId) form.action = `/bookings/${tripId}/cancel`;
      if (titleSpan && tripTitle) titleSpan.textContent = tripTitle;

      if (window.bootstrap && bootstrap.Modal) {
        const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
        modal.show();
      }
    });
  });
}