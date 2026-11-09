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
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-public-revealed");
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -6%" });
    elements.forEach((element) => observer.observe(element));
    return () => {
      observer.disconnect();
    };
  }, []);
  return null;
}
