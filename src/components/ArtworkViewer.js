import React, {useRef, useState} from 'react';

export default function ArtworkViewer({record}) {
  const dialog = useRef(null);
  const trigger = useRef(null);
  const [side, setSide] = useState(null);
  const disc = side === 'Disc';
  const image = disc ? record.label : record.art;

  function open() {
    setSide('Sleeve');
    dialog.current.showModal();
  }

  return (
    <>
      <button className="artwork-trigger" ref={trigger} aria-haspopup="dialog" onClick={open}>
        View artwork
      </button>
      <dialog
        className="artwork-viewer"
        ref={dialog}
        aria-labelledby="artwork-heading"
        onClose={() => {
          setSide(null);
          trigger.current?.focus({preventScroll: true});
        }}>
        <header className="artwork-header">
          <div>
            <span className="catalogue-code">{record.id}</span>
            <h2 id="artwork-heading">{record.artist} artwork</h2>
          </div>
          <button onClick={() => dialog.current.close()} autoFocus>
            Close
          </button>
        </header>
        {side && (
          <>
            <div className={disc ? 'artwork-image disc-label' : 'artwork-image'}>
              <img src={image} alt={record.artist + ' · ' + record.id + (disc ? ' disc label' : ' sleeve')} />
            </div>
            <div className="artwork-controls">
              <div role="group" aria-label="Artwork">
                {['Sleeve', 'Disc'].map((name) => (
                  <button key={name} aria-pressed={side === name} onClick={() => setSide(name)}>
                    {name}
                  </button>
                ))}
              </div>
              <a
                href={image}
                target="_blank"
                rel="noreferrer"
                aria-label={'Open full-size ' + side.toLowerCase() + ' in a new tab'}>
                Full size <span aria-hidden="true">↗</span>
              </a>
            </div>
          </>
        )}
      </dialog>
    </>
  );
}
