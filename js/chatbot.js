/* ==========================================================================
   Talking-Thread — AI Concierge Chatbot
   - Free, fully client-side, rule-based (no paid API calls).
   - Self-contained: unique "tt-bot" namespace, touches nothing else on
     the page, and does not modify any existing site functionality.
   - Double-click (or double-tap on touch) the robot bubble to unlock
     drag mode, then move it anywhere — its new spot is remembered on
     this device for next time.
   ========================================================================== */
(function () {
  "use strict";
  if (window.__ttBotInit) return; // guard against double-inclusion
  window.__ttBotInit = true;

  var WHATSAPP_URL =
    "https://wa.me/917021312553?text=" +
    encodeURIComponent("Hi, I'm looking for some help on the Talking-Thread website.");

  /* ---------------------------------------------------------------------
     Knowledge base — plain rule-based matching (English + Hinglish).
     Add more entries any time by pushing to INTENTS.
  --------------------------------------------------------------------- */
  var INTENTS = [
    {
      id: "greeting",
      keywords: ["hi", "hello", "hey", "namaste", "namaskar", "hii", "helo"],
      reply:
        "Namaste! \uD83D\uDC4B Welcome to Talking-Thread — hand embroidered pieces from Jaipur. How can I help you today?"
    },
    {
      id: "categories",
      keywords: ["categories", "category", "products", "range", "kya milta", "kya hai", "collection", "shop"],
      reply:
        "We create hand-embroidered pieces across <b>Wall Art</b>, <b>Accessories</b>, <b>Clothing</b> and <b>Kidswear</b>. You can browse everything on our <a href=\"shop.html\">Shop</a> page."
    },
    {
      id: "customization",
      keywords: ["custom", "customi", "personalise", "personalize", "naam", "text likhwa", "embroider my name", "monogram"],
      reply:
        "Yes! Most pieces are customizable — you can add your own embroidered text (up to 20 characters) right from the product page before adding it to your bag."
    },
    {
      id: "pricing",
      keywords: ["price", "cost", "kitna", "rate", "kimat", "kitne ka", "budget"],
      reply:
        "Our pieces are priced across a few ranges — under \u20B92,000, \u20B92,000\u2013\u20B93,500, and above \u20B93,500 — so there's something for every budget. You can filter by price on the <a href=\"shop.html\">Shop</a> page."
    },
    {
      id: "shipping",
      keywords: ["shipping", "delivery", "deliver", "kab tak", "kitne din", "dispatch", "arrive"],
      reply:
        "Each piece is lovingly hand-embroidered — items marked <b>In Stock</b> ship sooner, while <b>Made to Order</b> pieces take a little longer since they're stitched just for you. Exact timelines are shown on each product page."
    },
    {
      id: "returns",
      keywords: ["return", "exchange", "refund", "cancel", "wapas"],
      reply:
        "For returns, exchanges or order cancellations, the fastest way is via your <a href=\"my-orders.html\">My Orders</a> page, or you can reach our team directly and we'll take care of it."
    },
    {
      id: "track",
      keywords: ["track", "order status", "where is my order", "mera order", "order kaha"],
      reply:
        "You can check the live status of any order from your <a href=\"my-orders.html\">My Orders</a> page — just sign in with the account you ordered from."
    },
    {
      id: "materials",
      keywords: ["material", "fabric", "thread", "quality", "handmade", "hand made", "kaise banta"],
      reply:
        "Every piece is hand embroidered by skilled artisans in Jaipur using fine cotton and quality embroidery thread — care instructions are noted on each product page."
    },
    {
      id: "payment",
      keywords: ["payment", "pay", "cod", "cash on delivery", "razorpay", "upi"],
      reply:
        "We accept online payments as well as Cash on Delivery on eligible orders — you'll see all available options at checkout."
    },
    {
      id: "contact",
      keywords: ["contact", "human", "agent", "support", "help me", "baat karni", "call", "phone number"],
      reply:
        "Of course — you can reach our studio team directly on <a href=\"" +
        WHATSAPP_URL +
        "\" target=\"_blank\" rel=\"noopener noreferrer\">WhatsApp</a>, or use the <a href=\"contact.html\">Contact page</a>."
    },
    {
      id: "thanks",
      keywords: ["thanks", "thank you", "thnx", "shukriya", "dhanyavad"],
      reply: "You're most welcome! Happy to help anytime. \uD83D\uDC9B"
    }
  ];

  var FALLBACK =
    "I'm still learning, so I couldn't quite catch that. You can try asking about shipping, returns, customization or pricing — or chat with our team directly on <a href=\"" +
    WHATSAPP_URL +
    "\" target=\"_blank\" rel=\"noopener noreferrer\">WhatsApp</a>.";

  var QUICK_REPLIES = [
    { label: "Shipping & Delivery", text: "Tell me about shipping" },
    { label: "Returns & Exchange", text: "What is your return policy" },
    { label: "Customization", text: "Can I customize a piece" },
    { label: "Track my Order", text: "Track my order" },
    { label: "Talk to a Human", text: "I want to talk to a human" }
  ];

  function findReply(raw) {
    var text = (raw || "").toLowerCase();
    var best = null;
    var bestScore = 0;
    for (var i = 0; i < INTENTS.length; i++) {
      var intent = INTENTS[i];
      var score = 0;
      for (var k = 0; k < intent.keywords.length; k++) {
        if (text.indexOf(intent.keywords[k]) !== -1) score++;
      }
      if (score > bestScore) {
        bestScore = score;
        best = intent;
      }
    }
    return best ? best.reply : FALLBACK;
  }

  /* ---------------------------------------------------------------------
     DOM build
  --------------------------------------------------------------------- */
  function el(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html !== undefined) e.innerHTML = html;
    return e;
  }

  var ROBOT_SVG =
    '<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
    '<circle class="tb-line" cx="24" cy="10" r="2.4" stroke-width="2"/>' +
    '<line class="tb-line" x1="24" y1="12.4" x2="24" y2="17" stroke-width="2"/>' +
    '<rect x="10" y="17" width="28" height="22" rx="7" fill="#fff" fill-opacity=".08" stroke="#DCC793" stroke-width="2"/>' +
    '<circle class="tb-eye" cx="19.5" cy="27.5" r="3"/>' +
    '<circle class="tb-eye" cx="28.5" cy="27.5" r="3"/>' +
    '<path class="tb-line" d="M19 34.5c1.6 1.3 8.4 1.3 10 0" stroke-width="2" stroke-linecap="round"/>' +
    "</svg>";

  var CLOSE_SVG =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M5 5l14 14M19 5L5 19"/></svg>';

  var SEND_SVG =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4 20-7z"/></svg>';

  function build() {
    var root = el("div", "tt-bot-root");

    // trigger bubble
    var bubble = el(
      "button",
      "tt-bot-bubble",
      ROBOT_SVG + '<span class="tt-bot-dot" aria-hidden="true"></span><span class="tt-bot-badge tt-hidden" data-tt-badge>1</span>'
    );
    bubble.type = "button";
    bubble.setAttribute("aria-label", "Open Talking-Thread chat assistant");
    bubble.setAttribute("aria-expanded", "false");

    // teaser
    var teaser = el(
      "div",
      "tt-bot-teaser",
      'Namaste! Need help finding the perfect hand-embroidered piece? <button type="button" aria-label="Dismiss">&times;</button>'
    );

    // drag hint
    var dragHint = el("div", "tt-drag-hint", "Drag me anywhere \u2726 double-click again to lock");

    // panel
    var panel = el("div", "tt-bot-panel");
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-modal", "false");
    panel.setAttribute("aria-label", "Talking-Thread chat assistant");

    var head = el(
      "div",
      "tt-bot-head",
      '<div class="tt-bot-avatar">' +
        ROBOT_SVG +
        '</div><div class="tt-bot-head-text"><h3>Talking-Thread Assistant</h3><p>Hand-embroidered with care, Jaipur</p></div>'
    );
    var closeBtn = el("button", "tt-bot-close", CLOSE_SVG);
    closeBtn.type = "button";
    closeBtn.setAttribute("aria-label", "Close chat");
    head.appendChild(closeBtn);

    var body = el("div", "tt-bot-body");
    body.setAttribute("aria-live", "polite");

    var quick = el("div", "tt-bot-quick");
    QUICK_REPLIES.forEach(function (q) {
      var chip = el("button", "tt-chip", q.label);
      chip.type = "button";
      chip.addEventListener("click", function () {
        sendUserMessage(q.text);
      });
      quick.appendChild(chip);
    });

    var form = el("form", "tt-bot-form");
    var textarea = el("textarea", "tt-bot-input");
    textarea.rows = 1;
    textarea.placeholder = "Type your message\u2026";
    textarea.setAttribute("aria-label", "Type your message");
    var sendBtn = el("button", "tt-bot-send", SEND_SVG);
    sendBtn.type = "submit";
    sendBtn.setAttribute("aria-label", "Send message");
    form.appendChild(textarea);
    form.appendChild(sendBtn);

    var foot = el("div", "tt-bot-foot", "Instant answers \u00B7 available 24/7");

    panel.appendChild(head);
    panel.appendChild(body);
    panel.appendChild(quick);
    panel.appendChild(form);
    panel.appendChild(foot);

    root.appendChild(bubble);
    root.appendChild(teaser);
    root.appendChild(dragHint);
    root.appendChild(panel);
    document.body.appendChild(root);

    return {
      root: root,
      bubble: bubble,
      teaser: teaser,
      dragHint: dragHint,
      panel: panel,
      body: body,
      form: form,
      textarea: textarea,
      sendBtn: sendBtn,
      closeBtn: closeBtn,
      badge: bubble.querySelector("[data-tt-badge]")
    };
  }

  var ui = build();
  var isOpen = false;
  var hasGreeted = false;

  /* ---------------------------------------------------------------------
     Messages
  --------------------------------------------------------------------- */
  function addMessage(text, who) {
    var msg = el("div", "tt-msg " + (who === "user" ? "tt-msg-user" : "tt-msg-bot"), text);
    ui.body.appendChild(msg);
    ui.body.scrollTop = ui.body.scrollHeight;
  }

  function showTyping() {
    var t = el(
      "div",
      "tt-typing",
      "<span></span><span></span><span></span>"
    );
    t.setAttribute("data-tt-typing", "1");
    ui.body.appendChild(t);
    ui.body.scrollTop = ui.body.scrollHeight;
    return t;
  }

  function sendUserMessage(text) {
    text = (text || "").trim();
    if (!text) return;
    addMessage(escapeHtml(text), "user");
    ui.textarea.value = "";
    autoGrow();
    var typing = showTyping();
    var delay = 450 + Math.random() * 450;
    window.setTimeout(function () {
      typing.remove();
      addMessage(findReply(text), "bot");
      if (!isOpen && ui.badge) {
        ui.badge.classList.remove("tt-hidden");
      }
    }, delay);
  }

  function escapeHtml(s) {
    return s.replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function autoGrow() {
    ui.textarea.style.height = "auto";
    ui.textarea.style.height = Math.min(ui.textarea.scrollHeight, 78) + "px";
  }

  ui.form.addEventListener("submit", function (e) {
    e.preventDefault();
    sendUserMessage(ui.textarea.value);
  });
  ui.textarea.addEventListener("input", autoGrow);
  ui.textarea.addEventListener("keydown", function (e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendUserMessage(ui.textarea.value);
    }
  });

  /* ---------------------------------------------------------------------
     Open / close + smart panel placement (keeps it fully on-screen no
     matter where the bubble has been dragged to)
  --------------------------------------------------------------------- */
  function positionPanel() {
    var r = ui.bubble.getBoundingClientRect();
    var vw = window.innerWidth;
    var vh = window.innerHeight;
    var panelW = Math.min(380, vw - 24);
    var panelH = Math.min(vh * 0.72, 560);
    var openLeft = r.left < vw / 2;
    var openUp = r.top > vh / 2;

    var left, top;
    if (vw <= 480) {
      left = (vw - panelW) / 2;
      top = openUp ? Math.max(12, r.top - panelH - 12) : Math.min(vh - panelH - 12, r.bottom + 12);
    } else {
      left = openLeft ? r.left : r.right - panelW;
      left = Math.max(12, Math.min(left, vw - panelW - 12));
      top = openUp ? r.top - panelH - 14 : r.bottom + 14;
      top = Math.max(12, Math.min(top, vh - panelH - 12));
    }
    ui.panel.style.left = left + "px";
    ui.panel.style.top = top + "px";
  }

  function openPanel() {
    isOpen = true;
    positionPanel();
    ui.panel.classList.add("tt-open");
    ui.bubble.setAttribute("aria-expanded", "true");
    hideTeaser(true);
    if (ui.badge) ui.badge.classList.add("tt-hidden");
    if (!hasGreeted) {
      hasGreeted = true;
      window.setTimeout(function () {
        addMessage(
          "Namaste! \uD83D\uDC4B I'm your Talking-Thread assistant. Ask me about shipping, returns, customization or anything else \u2014 or tap a quick option below.",
          "bot"
        );
      }, 200);
    }
    window.setTimeout(function () {
      ui.textarea.focus();
    }, 260);
  }

  function closePanel() {
    isOpen = false;
    ui.panel.classList.remove("tt-open");
    ui.bubble.setAttribute("aria-expanded", "false");
  }

  ui.closeBtn.addEventListener("click", closePanel);
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && isOpen) closePanel();
  });
  window.addEventListener("resize", function () {
    if (isOpen) positionPanel();
    clampToViewport();
  });

  /* ---------------------------------------------------------------------
     Teaser (shown once per session, dismissible)
  --------------------------------------------------------------------- */
  function positionTeaser() {
    var r = ui.bubble.getBoundingClientRect();
    var openLeft = r.left < window.innerWidth / 2;
    ui.teaser.style.bottom = window.innerHeight - r.top + 12 + "px";
    if (openLeft) {
      ui.teaser.style.left = r.left + "px";
      ui.teaser.style.right = "auto";
    } else {
      ui.teaser.style.right = window.innerWidth - r.right + "px";
      ui.teaser.style.left = "auto";
    }
  }

  function hideTeaser(skipFlag) {
    ui.teaser.classList.remove("tt-show");
  }

  (function maybeShowTeaser() {
    try {
      if (sessionStorage.getItem("tt_bot_teaser_shown")) return;
    } catch (e) {}
    window.setTimeout(function () {
      if (isOpen || dragState.moved) return;
      positionTeaser();
      ui.teaser.classList.add("tt-show");
      try {
        sessionStorage.setItem("tt_bot_teaser_shown", "1");
      } catch (e) {}
      window.setTimeout(hideTeaser, 7000);
    }, 3500);
  })();

  ui.teaser.querySelector("button").addEventListener("click", function () {
    hideTeaser();
  });
  ui.teaser.addEventListener("click", function (e) {
    if (e.target.tagName === "BUTTON") return;
    hideTeaser();
    openPanel();
  });

  /* ---------------------------------------------------------------------
     Bubble click opens/closes (suppressed right after a drag)
  --------------------------------------------------------------------- */
  ui.bubble.addEventListener("click", function () {
    if (dragState.suppressClick) {
      dragState.suppressClick = false;
      return;
    }
    if (isOpen) closePanel();
    else openPanel();
  });

  /* ---------------------------------------------------------------------
     Draggable: double-click / double-tap the bubble to unlock dragging,
     then press-and-move it anywhere. Position is remembered per device
     via localStorage. Double-click again (or click elsewhere) re-locks.
  --------------------------------------------------------------------- */
  var dragState = {
    unlocked: false,
    dragging: false,
    moved: false,
    startX: 0,
    startY: 0,
    origLeft: 0,
    origTop: 0,
    suppressClick: false,
    lastTap: 0
  };

  function bubbleSize() {
    var r = ui.bubble.getBoundingClientRect();
    return { w: r.width, h: r.height };
  }

  function pxPosition() {
    var r = ui.bubble.getBoundingClientRect();
    return { left: r.left, top: r.top };
  }

  function lockToPixelPosition() {
    // Convert current computed position into explicit left/top so it can
    // be dragged smoothly, replacing the default left/bottom anchoring.
    var pos = pxPosition();
    ui.bubble.style.left = pos.left + "px";
    ui.bubble.style.top = pos.top + "px";
    ui.bubble.style.bottom = "auto";
    ui.bubble.style.right = "auto";
  }

  function clampToViewport() {
    var size = bubbleSize();
    var vw = window.innerWidth,
      vh = window.innerHeight;
    var left = parseFloat(ui.bubble.style.left);
    var top = parseFloat(ui.bubble.style.top);
    if (isNaN(left) || isNaN(top)) return;
    left = Math.max(6, Math.min(left, vw - size.w - 6));
    top = Math.max(6, Math.min(top, vh - size.h - 6));
    ui.bubble.style.left = left + "px";
    ui.bubble.style.top = top + "px";
  }

  function savePosition() {
    try {
      var r = ui.bubble.getBoundingClientRect();
      localStorage.setItem(
        "tt_bot_pos",
        JSON.stringify({ left: r.left, top: r.top, vw: window.innerWidth, vh: window.innerHeight })
      );
    } catch (e) {}
  }

  function restorePosition() {
    try {
      var raw = localStorage.getItem("tt_bot_pos");
      if (!raw) return;
      var pos = JSON.parse(raw);
      if (!pos || typeof pos.left !== "number") return;
      // Re-scale proportionally if the viewport size has changed since saving
      // (e.g. switching between devices/orientations) so it stays reachable.
      var scaleX = pos.vw ? window.innerWidth / pos.vw : 1;
      var scaleY = pos.vh ? window.innerHeight / pos.vh : 1;
      var left = pos.left * scaleX;
      var top = pos.top * scaleY;
      ui.bubble.style.left = left + "px";
      ui.bubble.style.top = top + "px";
      ui.bubble.style.bottom = "auto";
      ui.bubble.style.right = "auto";
      clampToViewport();
    } catch (e) {}
  }

  function showDragHint(show) {
    if (!show) {
      ui.dragHint.classList.remove("tt-show");
      return;
    }
    var r = ui.bubble.getBoundingClientRect();
    ui.dragHint.style.left = Math.max(6, r.left) + "px";
    ui.dragHint.style.top = r.top - 34 + "px";
    ui.dragHint.classList.add("tt-show");
  }

  function enableDragMode() {
    dragState.unlocked = true;
    lockToPixelPosition();
    ui.bubble.classList.add("tt-dragging");
    showDragHint(true);
    window.setTimeout(showDragHint.bind(null, false), 2600);
  }

  function disableDragMode() {
    dragState.unlocked = false;
    ui.bubble.classList.remove("tt-dragging");
    showDragHint(false);
    savePosition();
  }

  function onPointerDown(e) {
    if (!dragState.unlocked) return;
    dragState.dragging = true;
    dragState.moved = false;
    var point = e.touches ? e.touches[0] : e;
    var pos = pxPosition();
    dragState.startX = point.clientX;
    dragState.startY = point.clientY;
    dragState.origLeft = pos.left;
    dragState.origTop = pos.top;
    e.preventDefault();
  }

  function onPointerMove(e) {
    if (!dragState.dragging) return;
    var point = e.touches ? e.touches[0] : e;
    var dx = point.clientX - dragState.startX;
    var dy = point.clientY - dragState.startY;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) dragState.moved = true;
    var size = bubbleSize();
    var vw = window.innerWidth,
      vh = window.innerHeight;
    var left = Math.max(6, Math.min(dragState.origLeft + dx, vw - size.w - 6));
    var top = Math.max(6, Math.min(dragState.origTop + dy, vh - size.h - 6));
    ui.bubble.style.left = left + "px";
    ui.bubble.style.top = top + "px";
  }

  function onPointerUp() {
    if (!dragState.dragging) return;
    dragState.dragging = false;
    if (dragState.moved) {
      dragState.suppressClick = true;
      savePosition();
    }
  }

  ui.bubble.addEventListener("mousedown", onPointerDown);
  document.addEventListener("mousemove", onPointerMove);
  document.addEventListener("mouseup", onPointerUp);
  ui.bubble.addEventListener("touchstart", onPointerDown, { passive: false });
  document.addEventListener("touchmove", onPointerMove, { passive: true });
  document.addEventListener("touchend", onPointerUp);

  ui.bubble.addEventListener("dblclick", function (e) {
    e.preventDefault();
    dragState.suppressClick = true;
    if (dragState.unlocked) disableDragMode();
    else enableDragMode();
  });

  // Manual double-tap detection for touch devices (some mobile browsers
  // don't fire a reliable "dblclick" for touch interactions).
  ui.bubble.addEventListener("touchend", function () {
    var now = Date.now();
    if (now - dragState.lastTap < 320) {
      dragState.suppressClick = true;
      if (dragState.unlocked) disableDragMode();
      else enableDragMode();
    }
    dragState.lastTap = now;
  });

  // Re-lock if the user taps/clicks anywhere else while in drag mode.
  document.addEventListener("click", function (e) {
    if (dragState.unlocked && !ui.bubble.contains(e.target)) {
      disableDragMode();
    }
  });

  restorePosition();
})();