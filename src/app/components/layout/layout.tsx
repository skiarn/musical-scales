import { useState } from "react";
import { motion } from "framer-motion";
import "./AudioAppLayout.css";

export default function AudioAppLayout() {
  const [activeTab, setActiveTab] = useState("analyze");
  const [isRecording, setIsRecording] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [segments, setSegments] = useState<string[]>([]);

  const handleUpload = () => {
    console.log("Upload Audio");
  };

  const handleRecord = () => {
    setIsRecording(!isRecording);
    console.log(isRecording ? "Stopped Recording" : "Started Recording");
  };

  const handlePlay = () => {
    setIsPlaying(!isPlaying);
    console.log(isPlaying ? "Stopped Playback" : "Started Playback");
  };

  const handleCut = () => {
    setSegments(["Segment 1", "Segment 2"]);
    console.log("Audio cut into segments");
  };

  return (
    <div className="layout">
      {/* Sidebar navigation */}
      <div className="sidebar">
        <div className="card">
          <h2 className="card-title">Sections</h2>
          <div className="nav-buttons">
            <button onClick={() => setActiveTab("analyze")} className="nav-btn">
              Analyze Signal
            </button>
            <button onClick={() => setActiveTab("record")} className="nav-btn">
              Record Guitar
            </button>
            <button onClick={() => setActiveTab("playback")} className="nav-btn">
              Playback & Highlight
            </button>
            <button onClick={() => setActiveTab("cut")} className="nav-btn">
              Cut & Segment
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="main">
        {activeTab === "analyze" && (
          <div className="card">
            <div className="card-header">
              <h2 className="section-title">
                <span className="icon">📈</span> Audio Signal Analysis
              </h2>
              <button onClick={handleUpload} className="btn btn-primary">
                Upload Audio
              </button>
            </div>
            <motion.div
              className="waveform"
              animate={{ opacity: [0.7, 1, 0.7] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              [Waveform Visualization]
            </motion.div>
          </div>
        )}

        {activeTab === "record" && (
          <div className="card">
            <div className="card-header">
              <h2 className="section-title">
                <span className="icon">🎤</span> Record & Identify Guitar Strings
              </h2>
              <button onClick={handleRecord} className="btn btn-success">
                {isRecording ? "Stop Recording" : "Start Recording"}
              </button>
            </div>
            <div className="placeholder">[String Detection Visualization]</div>
          </div>
        )}

        {activeTab === "playback" && (
          <div className="card">
            <div className="card-header">
              <h2 className="section-title">
                <span className="icon">▶️</span> Playback & Highlight
              </h2>
              <button onClick={handlePlay} className="btn btn-purple">
                {isPlaying ? "Stop Song" : "Play Song"}
              </button>
            </div>
            <div className="string-grid">
              {"EADGBE".split("").map((s, i) => (
                <motion.div
                  key={i}
                  className="string-cell"
                  whileTap={{ scale: 0.95 }}
                  whileHover={{ backgroundColor: "#d1d5db" }}
                >
                  String {s}
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {activeTab === "cut" && (
          <div className="card">
            <div className="card-header">
              <h2 className="section-title">
                <span className="icon">✂️</span> Cut & Segment Audio
              </h2>
              <button onClick={handleUpload} className="btn btn-primary">
                Load Audio
              </button>
            </div>
            <div className="cut-section">
              <div className="placeholder">[Waveform for Cutting]</div>
              <input type="range" min="0" max="100" step="1" defaultValue="30" className="slider" />
              <button onClick={handleCut} className="btn btn-danger">
                Cut into Segments
              </button>
              {segments.length > 0 && (
                <ul className="segments-list">
                  {segments.map((seg, i) => (
                    <li key={i}>{seg}</li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
