function updateCountdown() {
    // 1. SET YOUR TARGET DATE HERE (Year, Month (0-11), Day, Hour, Minute, Second)
    const targetDate = new Date("December 31, 2025 00:00:00").getTime();

    const now = new Date().getTime();
    const distance = targetDate - now;

    // Elements
    const daysEl = document.getElementById('days');
    const hoursEl = document.getElementById('hours');
    const minutesEl = document.getElementById('minutes');
    const secondsEl = document.getElementById('seconds');
    const messageEl = document.getElementById('countdown-message');

    // Time calculations for days, hours, minutes and seconds
    const days = Math.floor(distance / (1000 * 60 * 60 * 24));
    const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((distance % (1000 * 60)) / 1000);

    if (distance > 0) {
        // Display the result
        daysEl.innerHTML = String(days).padStart(2, '0');
        hoursEl.innerHTML = String(hours).padStart(2, '0');
        minutesEl.innerHTML = String(minutes).padStart(2, '0');
        secondsEl.innerHTML = String(seconds).padStart(2, '0');
        messageEl.textContent = "Time is running! Keep studying!";
    } else {
        // When the countdown is finished
        clearInterval(countdownInterval);
        daysEl.innerHTML = "00";
        hoursEl.innerHTML = "00";
        minutesEl.innerHTML = "00";
        secondsEl.innerHTML = "00";
        messageEl.textContent = "The exam has arrived! Good luck!";
    }
}

// Update the countdown every 1 second
const countdownInterval = setInterval(updateCountdown, 1000);

// Initial call to display immediately
updateCountdown();
