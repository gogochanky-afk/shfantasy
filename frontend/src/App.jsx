import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Home from "./pages/Home";
import Arena from "./pages/Arena";
import Leaderboard from "./pages/Leaderboard";
import MyEntries from "./pages/MyEntries";
import HowItWorks from "./pages/HowItWorks";

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/arena/:id" element={<Arena />} />
        <Route path="/leaderboard" element={<Leaderboard />} />
        <Route path="/my-entries" element={<MyEntries />} />
        <Route path="/how-it-works" element={<HowItWorks />} />
      </Routes>
    </Router>
  );
}

export default App;
