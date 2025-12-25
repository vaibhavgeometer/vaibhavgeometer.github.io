document.addEventListener("DOMContentLoaded", () => {
  const mobileMenuBtn = document.querySelector(".menu-toggle");
  const navMenu = document.querySelector(".nav-menu");
  const navLinks = document.querySelectorAll(".nav-link");

  // Toggle Mobile Menu
  mobileMenuBtn.addEventListener("click", () => {
    navMenu.classList.toggle("active");
    const isExpanded = navMenu.classList.contains("active");
    mobileMenuBtn.setAttribute("aria-expanded", isExpanded);
  });

  // Close mobile menu when a link is clicked
  navLinks.forEach((link) => {
    link.addEventListener("click", () => {
      if (navMenu.classList.contains("active")) {
        navMenu.classList.remove("active");
        mobileMenuBtn.setAttribute("aria-expanded", "false");
      }
    });
  });

  // Close menu when clicking outside
  document.addEventListener("click", (e) => {
    if (
      !navMenu.contains(e.target) &&
      !mobileMenuBtn.contains(e.target) &&
      navMenu.classList.contains("active")
    ) {
      navMenu.classList.remove("active");
      mobileMenuBtn.setAttribute("aria-expanded", "false");
    }
  });

  // Add scroll effect to navbar
  const navbar = document.querySelector(".navbar");
  window.addEventListener("scroll", () => {
    if (window.scrollY > 50) {
      navbar.style.background = "rgba(15, 23, 42, 0.95)";
      navbar.style.boxShadow = "0 10px 30px -10px rgba(0,0,0,0.3)";
    } else {
      navbar.style.background = "rgba(15, 23, 42, 0.8)";
      navbar.style.boxShadow = "none";
    }
  });
});
