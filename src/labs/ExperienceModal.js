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

export function ExperienceModal({onClose, returnFocusRef}) {
  // A fresh lazy instance lets reopening retry a failed chunk download.
  const [Underlevel] = useState(() => lazy(() => import(/* webpackChunkName: "underlevel" */ '../experiences/underlevel')));
  const dialog = useRef(null);
  useLayoutEffect(() => {
    const opener = returnFocusRef.current || document.activeElement;
    const previousOverflow = document.body.style.overflow;
    const element = dialog.current;
    document.body.style.overflow = 'hidden';
    element.showModal();
    return () => {
      element.close();
      document.body.style.overflow = previousOverflow;
      if (opener?.isConnected) opener.focus({preventScroll: true});
    };
  }, []);
  return createPortal(<dialog ref={dialog} className="labs-experience-modal" aria-label="The Underlevel" onCancel={event => {event.preventDefault(); onClose();}}>
    <ExperienceBoundary onClose={onClose}>
      <Suspense fallback={<div className="labs-experience-loading"><p role="status">Opening The Underlevel…</p><button onClick={onClose}>Back to Labs</button></div>}>
        <Underlevel onClose={onClose} />
      </Suspense>
    </ExperienceBoundary>
  </dialog>, document.body);
}
