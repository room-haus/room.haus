import LoadingLabel from './LoadingLabel';

export default function StillArt({record, pending}) {
  return (
    <div className="still-stage" aria-label={`Artwork for ${record.artist}, ${record.id}`}>
      <div className="still-object">
        <div className="compact-disc" aria-hidden="true">
          {record.label && <img src={record.label} alt="" />}
        </div>
        <img className="still-cover" src={record.art} width="500" height="500" alt={`${record.id} cover`} />
      </div>
      {pending && (
        <p className="stage-notice" role="status">
          <LoadingLabel>{pending}</LoadingLabel>
        </p>
      )}
    </div>
  );
}
