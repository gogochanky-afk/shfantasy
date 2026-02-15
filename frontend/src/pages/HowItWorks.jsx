import { Link } from "react-router-dom";

export default function HowItWorks() {
  return (
    <div className="page">
      <header className="header">
        <h1 className="title">📖 How It Works</h1>
        <nav className="nav">
          <Link to="/" className="nav-link">Home</Link>
          <Link to="/arena" className="nav-link">Arena</Link>
          <Link to="/my-entries" className="nav-link">My Entries</Link>
        </nav>
      </header>

      <main className="content">
        <div className="how-it-works-content">
          <h2>Welcome to SHFantasy</h2>
          <p>
            SHFantasy is a daily fantasy sports platform focused on NBA games.
            Pick your players, compete in pools, and win prizes!
          </p>

          <h3>🏀 Getting Started</h3>
          <ol>
            <li>Browse available pools in the Arena</li>
            <li>Select a pool and choose your lineup</li>
            <li>Submit your entry before the deadline</li>
            <li>Track your performance in My Entries</li>
          </ol>

          <h3>🎯 MVP Demo Features</h3>
          <ul>
            <li>Daily NBA pools with real-time scoring</li>
            <li>Simple lineup selection interface</li>
            <li>Entry tracking and results</li>
            <li>Demo mode for testing</li>
          </ul>

          <p className="note">
            This is an MVP demo. More features coming soon!
          </p>
        </div>
      </main>
    </div>
  );
}
