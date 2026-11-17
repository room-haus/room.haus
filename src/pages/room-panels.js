import {useLayoutEffect} from 'react';
import {panelForRoute} from './navigation';

export function useRoomPanels(route) {
  useLayoutEffect(() => {
    const shell = document.querySelector('.room-shell');
    const panels = [
      shell.querySelector('[data-room-panel=splash]'),
      shell.querySelector('#root'),
      shell.querySelector('[data-room-panel=season]'),
      shell.querySelector('[data-room-panel=collective]'),
    ];
    const index = ['splash', 'archive', 'season', 'collective'].indexOf(panelForRoute(route));
    const active = panels[index];
    const previousScroll = window.scrollY;
    const outgoing = panels.find(panel => !panel.inert);
    const crossing = active.inert;
    panels.forEach((panel, position) => {
      panel.style.setProperty('--panel-shift', position < index ? '-100%' : '100%');
      panel.inert = panel !== active;
      if (panel === active) panel.removeAttribute('aria-hidden');
      else panel.setAttribute('aria-hidden', 'true');
    });
    if (crossing) {
      window.scrollTo(0, 0);
      if (outgoing) outgoing.scrollTop = previousScroll;
      active.scrollTop = 0;
    }

    const season = panels[2];
    season.querySelector('.season-empty').setAttribute('aria-label', route.collection || 'Mixes');
    for (const link of season.querySelectorAll('.season-collections a')) {
      if (link.textContent.trim() === (route.collection || 'Mixes')) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    }
    if (index !== 2) season.querySelector('audio').pause();

    const logo = active.querySelector('.entrance-home img, .archive-page .wordmark img');
    const mark = shell.querySelector('.room-mark');
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
    mark.getBoundingClientRect();
    shell.dataset.ready = '';
    const observer = new ResizeObserver(alignMark);
    observer.observe(logo);
    observer.observe(active.querySelector('header'));
    return () => observer.disconnect();
  }, [route]);
}
