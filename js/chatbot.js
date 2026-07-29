/* ==========================================================================
   Talking-Thread — Support Chat Widget
   100% free, client-side, rule-based assistant. No paid API / no external
   AI service — keyword matching against a small knowledge base below.
   Edit TT_CHAT_KB to change what the bot knows about your shop.
   ========================================================================== */
(function () {
  "use strict";

  /* ---------------- Knowledge base — edit freely ---------------- */
  var TT_CHAT_KB = [
    {
      id: "greeting",
      patterns: ["hi", "hello", "hey", "namaste", "good morning", "good afternoon", "good evening"],
      reply: "Hello! Welcome to Talking-Thread. I can help with products, orders, shipping, returns or getting in touch with our team. What would you like to know?"
    },
    {
      id: "products",
      patterns: ["product", "collection", "item", "design", "embroidery", "custom", "personalis", "personaliz", "made to order", "fabric", "material", "size"],
      reply: "All our pieces are hand-embroidered and made to order in Jaipur. You can browse everything in our <a href=\"shop.html\">Shop</a> or see curated sets in <a href=\"collections.html\">Collections</a>. Want custom embroidery? Mention it on the product page or message us via Contact."
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
      patterns: ["about", "who are you", "founder", "story", "jaipur", "handmade", "artisan"],
      reply: "Talking-Thread is a hand-embroidery house founded by Ritik Parihar, stitching heirloom pieces to order in Jaipur. Read more on our <a href=\"about.html\">About page</a>."
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

  var FALLBACK_REPLY = "I'm not quite sure about that one — I can help with products, orders, shipping, returns, or how to reach our team. You can also try the <a href=\"contact.html\">Contact page</a> for anything more specific.";

  var QUICK_REPLIES = [
    { label: "Products", text: "Tell me about your products" },
    { label: "Track my order", text: "Where is my order" },
    { label: "Shipping", text: "How long does shipping take" },
    { label: "Contact us", text: "How can I contact you" }
  ];

  /* ---------------- Matching ---------------- */
  function findReply(input) {
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

  /* ---------------- DOM build ---------------- */
  var ICON_CHAT = '<svg class="tt-icon-chat" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="8.3"/><path stroke-linecap="round" d="M5.1 12c2.9-3.9 10.9-3.9 13.8 0" stroke-dasharray="1.8 2.3"/></svg>';
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
        ICON_CHAT + ICON_CLOSE + '<span class="tt-chat-badge"></span>' +
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

    var body = win.querySelector("#ttChatBody");
    var form = win.querySelector("#ttChatForm");
    var input = win.querySelector("#ttChatInput");
    var quickWrap = win.querySelector("#ttQuickReplies");
    var closeBtn = win.querySelector("#ttChatCloseBtn");
    var opened = false;

    function addMessage(text, who) {
      var msg = document.createElement("div");
      msg.className = "tt-msg " + who;
      msg.innerHTML = text;
      body.appendChild(msg);
      body.scrollTop = body.scrollHeight;
    }

    function showTyping(cb) {
      var t = el('<div class="tt-typing" id="ttTyping"><span></span><span></span><span></span></div>');
      body.appendChild(t);
      body.scrollTop = body.scrollHeight;
      setTimeout(function () {
        t.remove();
        cb();
      }, 500 + Math.random() * 400);
    }

    function respondTo(text) {
      addMessage(text, "user");
      showTyping(function () {
        addMessage(findReply(text), "bot");
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

    function openChat() {
      opened = true;
      win.classList.add("open");
      launcher.classList.add("open");
      launcher.setAttribute("aria-expanded", "true");
      if (!body.hasChildNodes()) {
        addMessage("Hello! Welcome to Talking-Thread. I can help with products, orders, shipping, returns or getting in touch with our team. What would you like to know?", "bot");
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
      if (!val) return;
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