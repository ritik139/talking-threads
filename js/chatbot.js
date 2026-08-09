/* ==========================================================================
   Talking-Thread — Support Chat Widget
   AI-powered: sends the customer's message + recent conversation history to
   POST /api/chat (Express + Google Gemini, backend/controllers/chatController.js),
   which grounds every reply in live product/order data from MongoDB.
   Falls back to the original local keyword-matcher if the network/API call
   fails for any reason, so the widget never goes silent.
   DOM structure, classes and CSS are unchanged from the original widget.
   ========================================================================== */
(function () {
  "use strict";

  /* ---------------- Config ---------------- */
  var TT_CONFIG = {
    apiEndpoint: "/api/chat",   // same-origin: server.js serves the API and the static site on one port
    requestTimeoutMs: 20000,
    maxHistoryTurns: 8,         // user+assistant pairs kept and sent for context
    historyStorageKey: "tt_chat_history_v1"
  };

  /* ---------------- Offline fallback knowledge base ---------------- */
  /* Used only if the AI backend is unreachable, times out, or errors — keeps the
     widget useful even if the server/API key/DB is briefly down. */
  var TT_CHAT_KB = [
    {
      id: "greeting",
      patterns: ["hi", "hello", "hey", "namaste", "good morning", "good afternoon", "good evening"],
      reply: "Hello! Welcome to Talking-Thread. I can help with products, orders, shipping, returns or getting in touch with our team. What would you like to know?"
    },
    {
      id: "products",
      patterns: ["product", "collection", "item", "design", "embroidery", "custom", "personalis", "personaliz", "made to order", "fabric", "material", "size"],
      reply: "All our pieces are hand-embroidered and made to order in Mumbai. You can browse everything in our <a href=\"shop.html\">Shop</a> or see curated sets in <a href=\"collections.html\">Collections</a>. Want custom embroidery? Mention it on the product page or message us via Contact."
    },
    {
      id: "order_status",
      patterns: ["order status", "track", "tracking", "where is my order", "my order", "order number"],
      reply: "You can check the live status of any order from your account under <a href=\"my-orders.html\">My Orders</a>. If you checked out as a guest, use the order confirmation email or reach out on our <a href=\"contact.html\">Contact page</a> with your order number."
    },
    {
      id: "orders",
      patterns: ["order", "cancel order", "change order", "edit order", "checkout", "cart", "payment"],
      reply: "Orders can be placed directly through your <a href=\"cart.html\">cart</a> at checkout. Since each piece is made to order, changes or cancellations are only possible within 24 hours of placing the order — contact us right away and we'll do our best to help."
    },
    {
      id: "shipping",
      patterns: ["shipping", "ship", "delivery", "deliver", "how long", "when will i get", "dispatch", "courier", "international"],
      reply: "As each item is hand-stitched to order, please allow some extra time before dispatch — exact timelines are shown on each product page. We ship across India and internationally; shipping cost and delivery estimates are calculated at checkout based on your address."
    },
    {
      id: "returns",
      patterns: ["return", "refund", "exchange", "damaged", "wrong item", "cancel"],
      reply: "Because pieces are made to order, we accept returns only for damaged or defective items — please write to us within 48 hours of delivery with photos, via the <a href=\"contact.html\">Contact page</a>, and we'll sort out a replacement or refund."
    },
    {
      id: "contact",
      patterns: ["contact", "reach", "email", "phone", "call", "talk to someone", "human", "support", "help me", "customer service", "representative", "agent"],
      reply: "You can reach our team anytime through the <a href=\"contact.html\">Contact page</a> — we typically reply within 1–2 business days. For account or order-specific queries, please include your order number."
    },
    {
      id: "account",
      patterns: ["account", "login", "log in", "sign in", "register", "sign up", "password", "wishlist"],
      reply: "You can <a href=\"login.html\">log in</a> or <a href=\"register.html\">create an account</a> to track orders and save items to your <a href=\"wishlist.html\">wishlist</a>. Forgotten password? Use the reset link on the login page."
    },
    {
      id: "about",
      patterns: ["about", "who are you", "founder", "story", "mumbai", "handmade", "artisan"],
      reply: "Talking-Thread is a hand-embroidery house founded by Ravina Deora, stitching heirloom pieces to order in Mumbai. Read more on our <a href=\"about.html\">About page</a>."
    },
    {
      id: "thanks",
      patterns: ["thank", "thanks", "great", "awesome", "perfect", "cool"],
      reply: "You're very welcome! Is there anything else I can help you with?"
    },
    {
      id: "bye",
      patterns: ["bye", "goodbye", "see you", "that's all", "thats all", "no thanks", "nothing else"],
      reply: "Thanks for stopping by Talking-Thread! Feel free to open this chat again anytime you have a question."
    }
  ];

  var FALLBACK_REPLY = "I'm having trouble reaching our AI assistant right now — but I can still help with products, orders, shipping, returns, or how to reach our team. You can also try the <a href=\"contact.html\">Contact page</a> for anything more specific.";

  var QUICK_REPLIES = [
    { label: "Products", text: "Tell me about your products" },
    { label: "Track my order", text: "Where is my order" },
    { label: "Shipping", text: "How long does shipping take" },
    { label: "Contact us", text: "How can I contact you" }
  ];

  var GREETING = "Hello! Welcome to Talking-Thread. I can help with products, orders, shipping, returns or getting in touch with our team. What would you like to know?";

  /* ---------------- Local keyword-match fallback ---------------- */
  function findLocalReply(input) {
    var text = input.toLowerCase();
    var best = null;
    var bestScore = 0;
    for (var i = 0; i < TT_CHAT_KB.length; i++) {
      var entry = TT_CHAT_KB[i];
      for (var j = 0; j < entry.patterns.length; j++) {
        var p = entry.patterns[j];
        if (text.indexOf(p) !== -1 && p.length > bestScore) {
          bestScore = p.length;
          best = entry;
        }
      }
    }
    return best ? best.reply : FALLBACK_REPLY;
  }

  /* ---------------- Conversation memory (persists for the browser session) ---------------- */
  var conversationHistory = loadHistory();

  function loadHistory() {
    try {
      var raw = sessionStorage.getItem(TT_CONFIG.historyStorageKey);
      var parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      return [];
    }
  }

  function saveHistory() {
    try {
      sessionStorage.setItem(TT_CONFIG.historyStorageKey, JSON.stringify(conversationHistory));
    } catch (e) {
      /* sessionStorage unavailable (e.g. private mode) — conversation just won't persist across reload */
    }
  }

  function pushHistory(role, content) {
    conversationHistory.push({ role: role, content: content });
    var maxEntries = TT_CONFIG.maxHistoryTurns * 2;
    if (conversationHistory.length > maxEntries) {
      conversationHistory = conversationHistory.slice(-maxEntries);
    }
    saveHistory();
  }

  /* ---------------- Minimal allow-list sanitizer for AI-generated HTML ---------------- */
  /* The backend is instructed to only ever emit <a>/<b>/<strong>/<em>/<br>, but this widget
     never trusts network output blindly — anything else is stripped client-side too. */
  var ALLOWED_TAGS = { A: true, B: true, STRONG: true, EM: true, BR: true };

  function sanitizeBotHtml(html) {
    var wrapper = document.createElement("div");
    wrapper.innerHTML = html;
    (function clean(node) {
      var children = Array.prototype.slice.call(node.childNodes);
      children.forEach(function (child) {
        if (child.nodeType === 1) {
          if (!ALLOWED_TAGS[child.tagName]) {
            var text = document.createTextNode(child.textContent);
            node.replaceChild(text, child);
            return;
          }
          if (child.tagName === "A") {
            var href = child.getAttribute("href") || "";
            // Only allow relative links to the site's own pages — never external/javascript: URLs.
            if (/^[a-z0-9_\-]+\.html(\?.*)?$/i.test(href)) {
              var cleanA = document.createElement("a");
              cleanA.setAttribute("href", href);
              cleanA.setAttribute("rel", "noopener");
              cleanA.innerHTML = child.innerHTML;
              node.replaceChild(cleanA, child);
              child = cleanA;
            } else {
              var text2 = document.createTextNode(child.textContent);
              node.replaceChild(text2, child);
              return;
            }
          } else {
            Array.from(child.attributes).forEach(function (attr) {
              child.removeAttribute(attr.name);
            });
          }
          clean(child);
        }
      });
    })(wrapper);
    return wrapper.innerHTML;
  }

  /* ---------------- AI backend call ---------------- */
  function askBackend(message) {
    var controller = typeof AbortController !== "undefined" ? new AbortController() : null;
    var timeoutId = controller ? setTimeout(function () { controller.abort(); }, TT_CONFIG.requestTimeoutMs) : null;

    return fetch(TT_CONFIG.apiEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include", // send the sign-in cookie if present, so order questions can be answered accurately
      body: JSON.stringify({
        message: message,
        history: conversationHistory.slice(-TT_CONFIG.maxHistoryTurns * 2)
      }),
      signal: controller ? controller.signal : undefined
    })
      .then(function (res) {
        if (timeoutId) clearTimeout(timeoutId);
        if (!res.ok) throw new Error("Chat API responded with " + res.status);
        return res.json();
      })
      .then(function (data) {
        if (!data || !data.success || !data.reply) throw new Error("Malformed chat API response");
        return data.reply;
      });
  }

  function getBotReply(userText) {
    return askBackend(userText)
      .then(function (reply) {
        return sanitizeBotHtml(reply);
      })
      .catch(function () {
        // Network/API failure — degrade gracefully to the local rule-based reply.
        return findLocalReply(userText);
      });
  }

  /* ---------------- DOM build ---------------- */
  var ICON_CHAT = '<svg class="tt-icon-chat" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="8.3"/><path stroke-linecap="round" d="M5.1 12c2.9-3.9 10.9-3.9 13.8 0" stroke-dasharray="1.8 2.3"/><g class="tt-eyes"><circle class="tt-eye" cx="9" cy="9.4" r="1.15"/><circle class="tt-eye" cx="15" cy="9.4" r="1.15"/></g></svg>';
  var ICON_CLOSE = '<svg class="tt-icon-close" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path stroke-linecap="round" stroke-linejoin="round" d="M6 6l12 12M18 6L6 18"/></svg>';
  var ICON_SEND = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path stroke-linecap="round" stroke-linejoin="round" d="M22 2 11 13M22 2l-7 20-4-9-9-4 20-7Z"/></svg>';
  var ICON_AVATAR = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="8"/><path d="M6.5 12c2.6-3.4 8.4-3.4 11 0" stroke-dasharray="1.6 2"/></svg>';
  var ICON_X_PLAIN = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path stroke-linecap="round" stroke-linejoin="round" d="M6 6l12 12M18 6L6 18"/></svg>';

  function el(html) {
    var d = document.createElement("div");
    d.innerHTML = html.trim();
    return d.firstChild;
  }

  function init() {
    var launcher = el(
      '<button class="tt-chat-launcher" id="ttChatLauncher" aria-haspopup="dialog" aria-expanded="false" aria-controls="ttChatWindow" aria-label="Open support chat">' +
        '<span class="tt-launcher-inner">' + ICON_CHAT + ICON_CLOSE + '</span>' +
        '<span class="tt-chat-badge"></span>' +
      '</button>'
    );

    var win = el(
      '<div class="tt-chat-window" id="ttChatWindow" role="dialog" aria-modal="false" aria-labelledby="ttChatTitle">' +
        '<div class="tt-chat-header">' +
          '<div class="tt-avatar">' + ICON_AVATAR + '</div>' +
          '<div class="tt-chat-header-text">' +
            '<h3 id="ttChatTitle">Talking-Thread Support</h3>' +
            '<p>Usually replies instantly</p>' +
          '</div>' +
          '<button class="tt-chat-close" id="ttChatCloseBtn" aria-label="Close chat">' + ICON_X_PLAIN + '</button>' +
        '</div>' +
        '<div class="tt-chat-body" id="ttChatBody" role="log" aria-live="polite"></div>' +
        '<div class="tt-quick-replies" id="ttQuickReplies"></div>' +
        '<form class="tt-chat-form" id="ttChatForm">' +
          '<input type="text" id="ttChatInput" placeholder="Type your question…" autocomplete="off" aria-label="Type your message">' +
          '<button type="submit" aria-label="Send message">' + ICON_SEND + '</button>' +
        '</form>' +
        '<div class="tt-chat-footer-note">Automated assistant · for anything else, visit our Contact page</div>' +
      '</div>'
    );

    document.body.appendChild(win);
    document.body.appendChild(launcher);

    /* ---------------- Launcher eye-tracking (UI-only, no functional change) ---------------- */
    (function initLauncherEyes() {
      var eyesGroup = launcher.querySelector(".tt-eyes");
      if (!eyesGroup) return;

      var isTouchDevice = window.matchMedia("(hover: none), (pointer: coarse)").matches;
      if (isTouchDevice) return;

      var EYE_MAX_SHIFT = 1.3; // in the icon's own viewBox units, kept subtle on purpose
      var targetX = 0, targetY = 0, curX = 0, curY = 0, rafId = null;

      function tick() {
        curX += (targetX - curX) * 0.25;
        curY += (targetY - curY) * 0.25;
        eyesGroup.style.transform = "translate(" + curX.toFixed(2) + "px, " + curY.toFixed(2) + "px)";
        if (Math.abs(targetX - curX) > 0.01 || Math.abs(targetY - curY) > 0.01) {
          rafId = requestAnimationFrame(tick);
        } else {
          rafId = null;
        }
      }

      function requestTick() {
        if (!rafId) rafId = requestAnimationFrame(tick);
      }

      function onMouseMove(e) {
        var rect = launcher.getBoundingClientRect();
        var cx = rect.left + rect.width / 2;
        var cy = rect.top + rect.height / 2;
        var dx = e.clientX - cx;
        var dy = e.clientY - cy;
        var dist = Math.hypot(dx, dy) || 1;
        targetX = (dx / dist) * EYE_MAX_SHIFT;
        targetY = (dy / dist) * EYE_MAX_SHIFT;
        requestTick();
      }

      function resetEyes() {
        targetX = 0;
        targetY = 0;
        requestTick();
      }

      launcher.addEventListener("mouseenter", function () {
        document.addEventListener("mousemove", onMouseMove);
      });
      launcher.addEventListener("mouseleave", function () {
        document.removeEventListener("mousemove", onMouseMove);
        resetEyes();
      });
    })();

    var body = win.querySelector("#ttChatBody");
    var form = win.querySelector("#ttChatForm");
    var input = win.querySelector("#ttChatInput");
    var sendBtn = form.querySelector("button[type=submit]");
    var quickWrap = win.querySelector("#ttQuickReplies");
    var closeBtn = win.querySelector("#ttChatCloseBtn");
    var opened = false;
    var awaitingReply = false;

    function addMessage(html, who) {
      var msg = document.createElement("div");
      msg.className = "tt-msg " + who;
      msg.innerHTML = html;
      body.appendChild(msg);
      body.scrollTop = body.scrollHeight;
    }

    function escapeHtml(text) {
      var d = document.createElement("div");
      d.textContent = text;
      return d.innerHTML;
    }

    function showTyping() {
      var t = el('<div class="tt-typing" id="ttTyping"><span></span><span></span><span></span></div>');
      body.appendChild(t);
      body.scrollTop = body.scrollHeight;
      return t;
    }

    function setBusy(busy) {
      awaitingReply = busy;
      input.disabled = busy;
      sendBtn.disabled = busy;
    }

    function stripTags(html) {
      var d = document.createElement("div");
      d.innerHTML = html;
      return d.textContent || "";
    }

    function respondTo(text) {
      if (awaitingReply) return;
      addMessage(escapeHtml(text), "user");
      pushHistory("user", text);
      setBusy(true);
      var typingEl = showTyping();
      var minDelay = new Promise(function (resolve) { setTimeout(resolve, 450); });

      Promise.all([getBotReply(text), minDelay])
        .then(function (results) {
          var replyHtml = results[0];
          typingEl.remove();
          addMessage(replyHtml, "bot");
          pushHistory("assistant", stripTags(replyHtml));
        })
        .catch(function () {
          typingEl.remove();
          addMessage(FALLBACK_REPLY, "bot");
        })
        .finally(function () {
          setBusy(false);
          input.focus();
        });
    }

    function renderQuickReplies() {
      quickWrap.innerHTML = "";
      QUICK_REPLIES.forEach(function (q) {
        var chip = el('<button type="button" class="tt-chip">' + q.label + "</button>");
        chip.addEventListener("click", function () {
          respondTo(q.text);
        });
        quickWrap.appendChild(chip);
      });
    }

    function restoreConversation() {
      // Re-render any history already in this browser session (context memory across reloads).
      conversationHistory.forEach(function (turn) {
        addMessage(turn.role === "user" ? escapeHtml(turn.content) : turn.content, turn.role === "user" ? "user" : "bot");
      });
    }

    function openChat() {
      opened = true;
      win.classList.add("open");
      launcher.classList.add("open");
      launcher.setAttribute("aria-expanded", "true");
      if (!body.hasChildNodes()) {
        if (conversationHistory.length) {
          restoreConversation();
        } else {
          addMessage(GREETING, "bot");
        }
        renderQuickReplies();
      }
      setTimeout(function () { input.focus(); }, 200);
    }

    function closeChat() {
      opened = false;
      win.classList.remove("open");
      launcher.classList.remove("open");
      launcher.setAttribute("aria-expanded", "false");
    }

    launcher.addEventListener("click", function () {
      opened ? closeChat() : openChat();
    });
    closeBtn.addEventListener("click", closeChat);

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var val = input.value.trim();
      if (!val || awaitingReply) return;
      input.value = "";
      respondTo(val);
    });

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && opened) closeChat();
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();