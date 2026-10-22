// Shown the instant you tap Inbox, while Gmail is fetched: the page's shape, with soft placeholder rows.
export default function InboxLoading() {
  return (
    <div aria-busy="true" aria-label="Loading your inbox">
      <div className="page-head"><h1>Inbox</h1></div>
      <div className="inbox">
        <aside className="mail-nav">
          <div className="skel" style={{ height: 40, borderRadius: 999, marginBottom: 14 }} />
          {Array.from({ length: 6 }, (_, i) => <div key={i} className="skel" style={{ height: 22, margin: "8px 10px", width: `${70 - i * 6}%` }} />)}
        </aside>
        <section className="inbox-main">
          <div className="skel hide-sm" style={{ height: 40, borderRadius: 12, marginBottom: 14 }} />
          <div className="mail-day"><span className="skel" style={{ display: "inline-block", width: 60, height: 12 }} /></div>
          {Array.from({ length: 9 }, (_, i) => (
            <div key={i} className="skel-row">
              <span className="skel skel-av" />
              <span className="skel" style={{ width: "22%" }} />
              <span className="skel" style={{ flex: 1 }} />
              <span className="skel" style={{ width: 48 }} />
            </div>
          ))}
        </section>
      </div>
    </div>
  );
}
