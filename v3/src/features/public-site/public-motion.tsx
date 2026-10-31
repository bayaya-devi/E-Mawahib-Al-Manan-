"use client";

import { useEffect } from "react";

const revealSelector = ".public-page__intro, .public-feature-band, .public-home-grid, .public-story, .public-program-list, .public-schedule-list, .public-check-list, .public-registration, .public-content-grid, .public-faq, .public-contact";

export function PublicMotion() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const elements = Array.from(document.querySelectorAll<HTMLElement>(revealSelector));
    elements.forEach((element, index) => {
      element.dataset.publicReveal = index % 3 === 1 ? "side" : index % 3 === 2 ? "scale" : "up";
    });
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => entry.target.classList.toggle("is-public-revealed", entry.isIntersecting));
    }, { threshold: 0.12, rootMargin: "0px 0px -6%" });
    elements.forEach((element) => observer.observe(element));

    const hero = document.querySelector<HTMLElement>(".public-home-hero");
    let frame = 0;
    const updateHero = () => {
      frame = 0;
      if (hero) hero.style.setProperty("--public-hero-scroll", `${Math.min(window.scrollY * 0.08, 34)}px`);
    };
    const onScroll = () => {
      if (!frame) frame = window.requestAnimationFrame(updateHero);
    };
    updateHero();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);
  return null;
}
