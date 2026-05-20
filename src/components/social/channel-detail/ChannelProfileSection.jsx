/**
 * Shared section card for channel profile tab panels.
 */
export default function ChannelProfileSection({ title, description, children, className = "" }) {
  return (
    <article className={`channel-inner-card ${className}`.trim()}>
      <header className="channel-profile-section-header">
        <h2 className="channel-profile-section-title">{title}</h2>
        {description ? <p className="channel-profile-section-desc">{description}</p> : null}
      </header>
      <div className="channel-profile-section-body">{children}</div>
    </article>
  );
}
