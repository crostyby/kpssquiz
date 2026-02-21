(function setupUiEffects() {
  const rippleTargets = document.querySelectorAll('.btn, .choice-btn, .nav-item');

  rippleTargets.forEach((btn) => {
    btn.addEventListener('click', (event) => {
      const circle = document.createElement('span');
      const diameter = Math.max(btn.clientWidth, btn.clientHeight);
      const radius = diameter / 2;

      circle.style.width = `${diameter}px`;
      circle.style.height = `${diameter}px`;
      circle.style.left = `${event.clientX - btn.getBoundingClientRect().left - radius}px`;
      circle.style.top = `${event.clientY - btn.getBoundingClientRect().top - radius}px`;
      circle.className = 'ripple';

      const previousRipple = btn.getElementsByClassName('ripple')[0];
      if (previousRipple) previousRipple.remove();
      btn.appendChild(circle);
    });
  });

  const tabs = document.querySelectorAll('.nav-tab');
  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      tabs.forEach((item) => item.classList.remove('active'));
      tab.classList.add('active');
    });
  });
})();
