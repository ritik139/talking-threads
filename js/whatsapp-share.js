!function () {
  "use strict";
  // Set your WhatsApp number here — with country code, digits only
  // (no "+", no spaces, no dashes). Example for India: "919876543210"
  var WA_NUMBER_RAW = "917021312553";
  var WA_NUMBER = WA_NUMBER_RAW.replace(/\D/g, ""); // strips any +, spaces or dashes if accidentally left in

  function openWhatsApp(message) {
    var url = "https://wa.me/" + WA_NUMBER + "?text=" + encodeURIComponent(message);
    window.open(url, "_blank", "noopener,noreferrer");
  }

  function textOf(el) {
    return el ? el.textContent.replace(/\s+/g, " ").trim() : "";
  }

  // Your live site's domain — used so shared links always point to the real,
  // public website even while you're testing on http://localhost. Update
  // this if the domain ever changes (it matches the one already used for
  // SEO/meta tags in main.js).
  var SITE_ORIGIN = "https://talkingthread.in";

  // Turns any relative or local path (e.g. "images/foo.jpg?v=20260810" or
  // "http://localhost:5000/product.html?slug=foo") into a clean, public
  // URL on the live domain (e.g. "https://talkingthread.in/images/foo.jpg").
  // Cache-busting "?v=..." params are stripped since they're meaningless to
  // whoever receives the link on WhatsApp.
  function toLiveUrl(src) {
    if (!src) return "";
    try {
      var u = new URL(src, window.location.href);
      return SITE_ORIGIN + u.pathname + (u.searchParams.get("slug") ? "?slug=" + u.searchParams.get("slug") : "");
    } catch (e) {
      return src.split("?")[0];
    }
  }

  // Turns a relative image path (e.g. "images/foo.jpg?v=20260810") into a
  // full, CLEAN, public shareable URL (e.g.
  // "https://talkingthread.in/images/foo.jpg") so WhatsApp can show a link
  // preview and the recipient can open / verify it's the correct product
  // photo — this works the same whether you're testing on localhost or on
  // the live site.
  function absoluteImageUrl(src) {
    return toLiveUrl(src);
  }

  // Builds one neatly formatted, WhatsApp-ready block for a single product:
  //   1. *Product Name*
  //      Size: Medium — 12in
  //      Thread Colour: Antique Gold
  //      Custom Text: Aanya
  //      Qty: 2  |  Price: ₹1,499
  //      Image:
  //      https://talkingthread.in/images/foo.jpg
  // The image URL is always on its own line (nothing else on that line) so
  // it's a single, clean, directly-clickable/openable link everywhere —
  // WhatsApp, address bar copy-paste, etc.
  // Passing `index` as 0 (or omitting it) leaves off the numbering, for a
  // single-product enquiry; pass 1, 2, 3… for a numbered list (bag / order).
  function formatProductBlock(opts, index) {
    var lines = [];
    var prefix = index ? index + ". " : "";
    lines.push(prefix + "*" + (opts.name || "Talking-Thread Piece") + "*");
    if (opts.size) lines.push("   Size: " + opts.size);
    if (opts.color) lines.push("   Thread Colour: " + opts.color);
    if (opts.text && opts.text !== "—" && opts.text !== "-") lines.push("   Custom Text: " + opts.text);
    var qtyPrice = [];
    if (opts.qty) qtyPrice.push("Qty: " + opts.qty);
    if (opts.price) qtyPrice.push("Price: " + opts.price);
    if (qtyPrice.length) lines.push("   " + qtyPrice.join("  |  "));
    var img = absoluteImageUrl(opts.img);
    if (img) {
      lines.push("   Image:");
      lines.push(img); // on its own line, nothing else, so it's always a clean, directly-clickable link
    }
    return lines.join("\n");
  }

  document.addEventListener("DOMContentLoaded", function () {
    // --- Share current bag (before checkout) ---
    var shareCartBtn = document.getElementById("shareCartWhatsAppBtn");
    if (shareCartBtn) {
      shareCartBtn.addEventListener("click", function () {
        var items = document.querySelectorAll("#cartList .cart-item");
        if (!items.length) {
          if (window.showToast) window.showToast("Your bag is empty.");
          return;
        }
        var lines = ["Hi! Here's my Talking-Thread bag \uD83D\uDECD\uFE0F", ""];
        items.forEach(function (item, idx) {
          var name = textOf(item.querySelector(".ci-title"));
          var qtyInput = item.querySelector(".qty-stepper input");
          var qty = qtyInput ? qtyInput.value : "1";
          var price = textOf(item.querySelector(".ci-price"));

          var size = "", color = "", text = "";
          item.querySelectorAll(".ci-meta > div").forEach(function (row) {
            var label = textOf(row.querySelector("b"));
            var value = textOf(row).replace(label, "").trim();
            if (/size/i.test(label)) size = value;
            else if (/thread/i.test(label)) color = value;
            else if (/text/i.test(label)) text = value;
          });

          var img = item.querySelector(".img-placeholder img");
          lines.push(formatProductBlock({
            name: name,
            size: size,
            color: color,
            text: text,
            qty: qty,
            price: price,
            img: img ? img.getAttribute("src") : ""
          }, idx + 1));
          lines.push("");
        });
        var total = textOf(document.getElementById("cartTotal"));
        if (total) {
          lines.push("*Estimated Total:* " + total);
          lines.push("");
        }
        lines.push("Could you help me with this order? \uD83D\uDE4F");
        openWhatsApp(lines.join("\n"));
      });
    }

    // --- Share a just-placed order confirmation ---
    var shareOrderBtn = document.getElementById("shareOrderWhatsAppBtn");
    if (shareOrderBtn) {
      shareOrderBtn.addEventListener("click", function () {
        // main.js stores the items that were in the bag right before it was
        // cleared (window.__ttLastOrderItems), so we can still include each
        // product's name, options and image even after checkout.
        var orderItems = Array.isArray(window.__ttLastOrderItems) ? window.__ttLastOrderItems : [];
        var lines = ["Hi! I just placed an order on Talking-Thread \u2705", ""];

        if (orderItems.length) {
          orderItems.forEach(function (it, idx) {
            lines.push(formatProductBlock({
              name: it.name,
              size: it.size,
              color: it.color,
              text: it.text,
              qty: it.qty,
              price: it.price,
              img: it.img
            }, idx + 1));
            lines.push("");
          });
        }

        var detailRows = document.querySelectorAll("#ocDetails .summary-row, #ocDetails .oc-row");
        detailRows.forEach(function (row) {
          var spans = row.querySelectorAll("span");
          if (spans.length >= 2) {
            lines.push("*" + textOf(spans[0]) + ":* " + textOf(spans[1]));
          }
        });

        var summary = textOf(document.getElementById("ocSummary"));
        if (summary) {
          lines.push("");
          lines.push(summary);
        }

        openWhatsApp(lines.join("\n"));
      });
    }

    // --- Enquire about a single product straight from its detail page ---
    var shareProductBtn = document.getElementById("shareProductWhatsAppBtn");
    if (shareProductBtn) {
      shareProductBtn.addEventListener("click", function () {
        var name = textOf(document.querySelector(".pd-info h1"));
        var price = textOf(document.querySelector(".pd-price-row span:first-child"));
        var size = textOf(document.querySelector("[data-size-value]"));
        var color = textOf(document.querySelector("[data-color-value]"));
        var customInput = document.getElementById("customText");
        var text = customInput ? customInput.value.trim() : "";
        var qtyInput = document.querySelector(".qty-stepper input");
        var qty = qtyInput ? qtyInput.value : "1";
        var mainImg = document.querySelector(".pd-main img");
        var img = mainImg ? mainImg.getAttribute("src") : "";

        var lines = ["Hi! I'm interested in this Talking-Thread piece \uD83D\uDC47", ""];
        lines.push(formatProductBlock({
          name: name,
          size: size,
          color: color,
          text: text,
          qty: qty,
          price: price,
          img: img
        }, 0));
        lines.push("");
        lines.push("Product Link:");
        lines.push(toLiveUrl(window.location.pathname + window.location.search)); // clean, standalone URL — no label on the same line
        lines.push("");
        lines.push("Could you please confirm availability and help me with this?");
        openWhatsApp(lines.join("\n"));
      });
    }
  });
}();