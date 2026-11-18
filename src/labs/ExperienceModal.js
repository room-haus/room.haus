import React, {Component, lazy, Suspense, useLayoutEffect, useRef, useState} from 'react';
import {createPortal} from 'react-dom';

class ExperienceBoundary extends Component {
  state = {failed: false};
  static getDerivedStateFromError() { return {failed: true}; }
  render() {
    return this.state.failed
      ? <div className="labs-experience-loading"><p role="alert">The experience could not load. Close it and try again.</p><button onClick={this.props.onClose}>Back to Labs</button></div>
      : this.props.children;
  }
}

export function ExperienceModal({experience, onClose, returnFocusRef}) {
  const dialog = useRef(null);
  // React.lazy caches rejection; a fresh wrapper lets reopening retry the chunk.
  const [Experience] = useState(() => lazy(experience.load));
  useLayoutEffect(() => {
    const opener = returnFocusRef.current || document.activeElement;
    const previousOverflow = document.body.style.overflow;
    const previousRootOverflow = document.documentElement.style.overflow;
    const previousScroll = {left: window.scrollX, top: window.scrollY};
    const element = dialog.current;
    document.body.style.overflow = 'hidden';
    // Inert content must not enlarge the mobile layout viewport at text zoom.
    document.documentElement.style.overflow = 'hidden';
    element.showModal();
    return () => {
      element.close();
      document.body.style.overflow = previousOverflow;
      document.documentElement.style.overflow = previousRootOverflow;
      window.scrollTo({...previousScroll, behavior: 'instant'});
      if (opener?.isConnected) opener.focus({preventScroll: true});
    };
  }, []);
  return createPortal(<dialog ref={dialog} className="labs-experience-modal" aria-label={experience.title} onCancel={event => {event.preventDefault(); onClose();}}>
    <ExperienceBoundary key={experience.id} onClose={onClose}>
      <Suspense fallback={<div className="labs-experience-loading"><p role="status">Opening {experience.title}…</p><button onClick={onClose}>Back to Labs</button></div>}>
        <Experience onClose={onClose} />
      </Suspense>
    </ExperienceBoundary>
  </dialog>, document.body);
}
