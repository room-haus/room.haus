import {useLayoutEffect} from 'react';

export function useRoomPanels(route) {
  useLayoutEffect(() => {
    const shell = document.querySelector('.room-shell');
    const home = shell.querySelector('.entrance');
    const archive = shell.querySelector('#root');
    const mark = shell.querySelector('.room-mark');
    const onHome = route.page === 'splash';
    const active = onHome ? home : archive;
    const previousScroll = window.scrollY;
    const crossing = active.inert;
    home.inert = !onHome;
    archive.inert = onHome;
    if (crossing) {
      window.scrollTo(0, 0);
      (onHome ? archive : home).scrollTop = previousScroll;
      active.scrollTop = 0;
    }

    const logo = active.querySelector(onHome ? '.entrance-home img' : '.archive-page .wordmark img');
    mark.hidden = !logo;
    if (!logo) return;
    function alignMark() {
      const bounds = logo.getBoundingClientRect();
      const panel = active.getBoundingClientRect();
      mark.style.left = bounds.left - panel.left + 'px';
      mark.style.top = bounds.top - panel.top + 'px';
      mark.style.width = bounds.width + 'px';
    }
    alignMark();
    // Establish the initial pose before enabling interpolation.
    mark.getBoundingClientRect();
    shell.dataset.ready = '';
    const observer = new ResizeObserver(alignMark);
    observer.observe(logo);
    observer.observe(active.querySelector('header'));
    return () => observer.disconnect();
  }, [route]);
}
