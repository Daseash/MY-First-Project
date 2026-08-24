document.addEventListener("DOMContentLoaded", () => {
  const toggleBtn = document.getElementById("rag-toggle-btn");
  const drawer = document.getElementById("rag-drawer");
  const closeBtn = document.getElementById("rag-close-btn");
  const form = document.getElementById("rag-form");
  const input = document.getElementById("rag-input");
  const messagesContainer = document.getElementById("rag-messages");
  const chips = document.querySelectorAll(".rag-chip");

  if (!toggleBtn || !drawer) return;

  toggleBtn.addEventListener("click", () => {
    drawer.classList.toggle("active");
    drawer.setAttribute("aria-hidden", String(!drawer.classList.contains("active")));
  });

  closeBtn.addEventListener("click", () => {
    drawer.classList.remove("active");
    drawer.setAttribute("aria-hidden", "true");
  });

  chips.forEach((chip) => {
    chip.addEventListener("click", () => {
      const prompt = chip.getAttribute("data-prompt");
      if (prompt) {
        input.value = prompt;
        sendMessage(prompt);
      }
    });
  });

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const query = input.value.trim();
    if (query) {
      sendMessage(query);
      input.value = "";
    }
  });

  let ragSessionId =
    sessionStorage.getItem("ragSessionId") ||
    "session_" + Math.random().toString(36).substring(2, 9);
  sessionStorage.setItem("ragSessionId", ragSessionId);

  async function sendMessage(query) {
    appendUserMessage(query);
    appendLoading();

    try {
      const response = await fetch("/rag/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: query, sessionId: ragSessionId }),
      });

      const data = await response.json();
      removeLoading();

      if (data.error) {
        appendBotMessage(data.error);
        return;
      }

      appendBotMessage(data.answer);

      if (data.relaxedFilters) {
        appendBotNote(
          "No exact matches for those filters — these are the closest available stays. Try asking for a different destination or budget.",
        );
      }

      if (data.listings && data.listings.length > 0) {
        appendListingCards(data.listings);
      }
    } catch (err) {
      console.error("Chat error:", err);
      removeLoading();
      appendBotMessage("Sorry, EDITH hit an issue. Please try again!");
    }
  }

  function appendListingCards(listings) {
    const container = document.createElement("div");
    container.className = "rag-message rag-bot";
    container.style.cssText = "display: block; max-width: 100%;";

    listings.forEach((l) => {
      const card = document.createElement("a");
      card.href = `/listings/${l._id}`;
      card.className = "rag-listing-card";
      card.style.cssText =
        "display: flex; align-items: center; gap: 12px; background: #fafafa; border: 1px solid #ebebeb; border-radius: 12px; padding: 8px 12px; text-decoration: none; color: #222222; margin-bottom: 8px; transition: border-color .2s ease, box-shadow .2s ease;";

      const imgUrl = l.image && l.image.url
        ? l.image.url
        : "https://images.unsplash.com/photo-1566073771259-6a8506099945?w=500";
      const price =
        typeof l.price === "number" && Number.isFinite(l.price)
          ? "₹" + l.price.toLocaleString("en-IN")
          : "Price on request";
      const locationText = escapeHtml(l.location || "");
      const countryText = escapeHtml(l.country || "");

      const locationLine = [locationText, countryText].filter(Boolean).join(", ") || "Featured stay";
      card.innerHTML =
        '<img src="' + imgUrl + '" alt="" />' +
        '<div style="flex: 1; min-width: 0;">' +
        '<div style="font-weight: 600; font-size: .9rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">' +
        escapeHtml(l.title) +
        "</div>" +
        '<div style="font-size: .78rem; color: #6a6a6a;">' +
        locationLine +
        "</div></div>" +
        '<div style="font-weight: 700; color: #ff385c; font-size: .85rem; white-space: nowrap;">' +
        price +
        '<span style="font-size: .7rem; font-weight: 400; color: #6a6a6a;">/night</span></div>';

      container.appendChild(card);
    });

    messagesContainer.appendChild(container);
    scrollToBottom();
  }

  function appendBotNote(text) {
    const div = document.createElement("div");
    div.className = "rag-message rag-bot";
    div.style.cssText = "display: block; margin: 2px 0 10px 38px;";
    div.innerHTML =
      '<div class="rag-bubble rag-note" style="background:#fff4de;color:#7a4d00;font-size:.82rem;padding:.5rem .8rem;border-radius:12px;">' +
      escapeHtml(text) +
      "</div>";
    messagesContainer.appendChild(div);
    scrollToBottom();
  }

  function appendUserMessage(text) {
    const msgDiv = document.createElement("div");
    msgDiv.className = "rag-message rag-user";
    msgDiv.innerHTML = '<div class="rag-bubble">' + escapeHtml(text) + "</div>";
    messagesContainer.appendChild(msgDiv);
    scrollToBottom();
  }

  function appendBotMessage(text) {
    const msgDiv = document.createElement("div");
    msgDiv.className = "rag-message rag-bot";
    msgDiv.innerHTML =
      '<div class="rag-avatar"><i class="fa-solid fa-robot"></i></div>';
    const bubble = document.createElement("div");
    bubble.className = "rag-bubble";
    bubble.innerHTML = formatMarkdown(text);
    msgDiv.appendChild(bubble);
    messagesContainer.appendChild(msgDiv);
    scrollToBottom();
  }

  function appendLoading() {
    const msgDiv = document.createElement("div");
    msgDiv.className = "rag-message rag-bot";
    msgDiv.id = "rag-loading";
    msgDiv.innerHTML =
      '<div class="rag-avatar"><i class="fa-solid fa-robot"></i></div>' +
      '<div class="rag-bubble"><span class="rag-loader"><span></span><span></span><span></span></span></div>';
    messagesContainer.appendChild(msgDiv);
    scrollToBottom();
  }

  function removeLoading() {
    const loading = document.getElementById("rag-loading");
    if (loading) loading.remove();
  }

  function formatMarkdown(text) {
    if (!text) return "";
    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
      .replace(/\*(.*?)\*/g, "<em>$1</em>")
      .replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" target="_blank">$1</a>')
      .replace(/\n/g, "<br>");
  }

  function scrollToBottom() {
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }

  function escapeHtml(text) {
    return String(text).replace(/[&<>"']/g, function (m) {
      return {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;",
      }[m];
    });
  }
});