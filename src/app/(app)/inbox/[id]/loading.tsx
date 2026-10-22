// Shown the instant you open an email, while the conversation is fetched from Gmail.
export default function ThreadLoading() {
  return (
    <div aria-busy="true" aria-label="Opening email">
      <div className="thread-top"><span className="skel" style={{ width: 70, height: 20 }} /></div>
      <div className="thread">
        <div className="skel" style={{ height: 30, width: "70%", margin: "14px 0 18px" }} />
        {Array.from({ length: 2 }, (_, i) => <div key={i} className="skel" style={{ height: 68, borderRadius: 16, marginBottom: 10 }} />)}
        <div className="skel" style={{ height: 220, borderRadius: 16 }} />
      </div>
    </div>
  );
}
