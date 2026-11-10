document.addEventListener("DOMContentLoaded", () => {
    const header = document.querySelector("[data-scroll-header]");

    if (!header) return;

    let lastScrollY = window.scrollY;
    let ticking = false;

    function handleHeaderScroll() {
        const currentScrollY = window.scrollY;
        const difference = currentScrollY - lastScrollY;

        // Page ke top par header hamesha visible
        if (currentScrollY <= 50) {
            header.classList.remove("gm-header-hidden");
            header.classList.add("gm-header-visible");
        }
        // Scroll down: header hide
        else if (difference > 8) {
            header.classList.add("gm-header-hidden");
            header.classList.remove("gm-header-visible");
        }
        // Scroll up: header show
        else if (difference < -8) {
            header.classList.remove("gm-header-hidden");
            header.classList.add("gm-header-visible");
        }

        lastScrollY = currentScrollY;
        ticking = false;
    }

    window.addEventListener("scroll", () => {
        if (!ticking) {
            window.requestAnimationFrame(handleHeaderScroll);
            ticking = true;
        }
    }, { passive: true });
});