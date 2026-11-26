/* Quantum Network and Sensing Lab — site script
   1. Mobile menu
   2. Header background on scroll
   3. Two-source interference pattern (canvas)
   4. Small helpers (publication count, footer year) */

(function () {
	"use strict";

	var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

	/* ---------- 1. Mobile menu ---------- */
	var header = document.querySelector("[data-header]");
	var toggle = document.querySelector(".nav-toggle");
	var nav = document.getElementById("site-nav");
	if (toggle && nav) {
		toggle.addEventListener("click", function () {
			var open = toggle.getAttribute("aria-expanded") === "true";
			toggle.setAttribute("aria-expanded", String(!open));
			nav.classList.toggle("is-open", !open);
			header.classList.toggle("menu-open", !open);
		});
		document.addEventListener("keydown", function (e) {
			if (e.key === "Escape" && nav.classList.contains("is-open")) {
				toggle.click();
				toggle.focus();
			}
		});
	}

	/* ---------- 2. Header background on scroll ---------- */
	if (header) {
		var onScroll = function () {
			header.classList.toggle("is-stuck", window.scrollY > 24);
		};
		onScroll();
		window.addEventListener("scroll", onScroll, { passive: true });
	}

	/* ---------- 3. Interference pattern ----------
	   Intensity of two coherent point sources:
	   I = a1^2 + a2^2 + 2 a1 a2 cos(k (r1 - r2) + phi)
	   Computed on a coarse grid and scaled up for speed. */

	// Colour ramp from the logo: night → indigo → violet → lavender-cyan → near white
	var STOPS = [
		[0.00, [16, 20, 46]],
		[0.30, [34, 36, 92]],
		[0.55, [88, 74, 200]],
		[0.78, [150, 190, 245]],
		[1.00, [236, 250, 255]]
	];
	var LUT = (function () {
		var lut = new Uint8ClampedArray(256 * 3);
		for (var i = 0; i < 256; i++) {
			var t = i / 255, j = 0;
			while (j < STOPS.length - 2 && t > STOPS[j + 1][0]) j++;
			var a = STOPS[j], b = STOPS[j + 1];
			var u = (t - a[0]) / (b[0] - a[0]);
			for (var c = 0; c < 3; c++) lut[i * 3 + c] = a[1][c] + (b[1][c] - a[1][c]) * u;
		}
		return lut;
	})();

	function Fringes(canvas) {
		var live = canvas.getAttribute("data-fringes") === "live" && !reduceMotion;
		var interactive = canvas.getAttribute("data-fringes") === "live";
		var brightness = parseFloat(canvas.getAttribute("data-brightness") || "1");
		var ctx = canvas.getContext("2d");
		var off = document.createElement("canvas");
		var octx = off.getContext("2d");
		var SCALE = 3;          // CSS pixels per computed sample
		var LAMBDA = 24;        // fringe wavelength in CSS pixels
		var k = (2 * Math.PI * SCALE) / LAMBDA;
		var w = 0, h = 0, img = null;
		var s1 = { x: 0, y: 0 }, s2 = { x: 0, y: 0 }, target = null;
		var phi = 0, last = 0, running = false, visible = true, t0 = performance.now();

		function place() {
			var rect = canvas.getBoundingClientRect();
			var dpr = Math.min(window.devicePixelRatio || 1, 2);
			canvas.width = Math.round(rect.width * dpr);
			canvas.height = Math.round(rect.height * dpr);
			w = Math.max(1, Math.ceil(rect.width / SCALE));
			h = Math.max(1, Math.ceil(rect.height / SCALE));
			off.width = w; off.height = h;
			img = octx.createImageData(w, h);
			s1.x = w * 0.80; s1.y = h * 0.30;
			if (!target) { s2.x = w * 0.64; s2.y = h * 0.58; }
		}

		function draw() {
			var data = img.data;
			var L = 0.45 * Math.sqrt(w * w + h * h);
			var p = 0;
			for (var y = 0; y < h; y++) {
				var dy1 = y - s1.y, dy2 = y - s2.y;
				for (var x = 0; x < w; x++) {
					var dx1 = x - s1.x, dx2 = x - s2.x;
					var r1 = Math.sqrt(dx1 * dx1 + dy1 * dy1);
					var r2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);
					var a1 = 1 / (1 + r1 / L), a2 = 1 / (1 + r2 / L);
					var I = a1 * a1 + a2 * a2 + 2 * a1 * a2 * Math.cos(k * (r1 - r2) + phi);
					var v = Math.pow(I / 4, 0.62) * 1.12 * brightness;
					var idx = (v > 1 ? 255 : (v * 255) | 0) * 3;
					data[p] = LUT[idx]; data[p + 1] = LUT[idx + 1]; data[p + 2] = LUT[idx + 2]; data[p + 3] = 255;
					p += 4;
				}
			}
			octx.putImageData(img, 0, 0);
			ctx.imageSmoothingEnabled = true;
			ctx.imageSmoothingQuality = "high";
			ctx.drawImage(off, 0, 0, canvas.width, canvas.height);
		}

		function frame(now) {
			if (!running) return;
			var dt = Math.min(0.05, (now - last) / 1000);
			last = now;
			phi -= dt * 1.1;                       // fringes drift slowly outward
			var t = (now - t0) / 1000;
			var gx = target ? target.x : w * (0.64 + 0.06 * Math.sin(t * 0.21));
			var gy = target ? target.y : h * (0.58 + 0.10 * Math.cos(t * 0.17));
			s2.x += (gx - s2.x) * 0.06;
			s2.y += (gy - s2.y) * 0.06;
			draw();
			requestAnimationFrame(frame);
		}

		function start() {
			if (running || !live || !visible || document.hidden) return;
			running = true; last = performance.now();
			requestAnimationFrame(frame);
		}
		function stop() { running = false; }

		place(); draw();

		var resizeTimer;
		window.addEventListener("resize", function () {
			clearTimeout(resizeTimer);
			resizeTimer = setTimeout(function () { place(); draw(); }, 120);
		});

		if (interactive) {
			var host = canvas.parentElement;
			host.addEventListener("pointermove", function (e) {
				if (e.pointerType === "touch") return;
				var r = canvas.getBoundingClientRect();
				target = { x: (e.clientX - r.left) / SCALE, y: (e.clientY - r.top) / SCALE };
				if (!live) { s2.x = target.x; s2.y = target.y; draw(); }
			});
			host.addEventListener("pointerleave", function () { target = null; });
		}

		if (live) {
			if ("IntersectionObserver" in window) {
				new IntersectionObserver(function (entries) {
					visible = entries[0].isIntersecting;
					visible ? start() : stop();
				}).observe(canvas);
			}
			document.addEventListener("visibilitychange", function () {
				document.hidden ? stop() : start();
			});
			start();
		}
	}

	var canvases = document.querySelectorAll("canvas[data-fringes]");
	for (var i = 0; i < canvases.length; i++) {
		if (canvases[i].getContext) Fringes(canvases[i]);
	}

	/* ---------- 4. Helpers ---------- */
	var count = document.querySelector("[data-pub-count]");
	if (count) {
		var n = document.querySelectorAll(".pubs > li").length;
		count.textContent = n + " journal articles";
	}
	var year = document.querySelector("[data-year]");
	if (year) year.textContent = new Date().getFullYear();
})();
