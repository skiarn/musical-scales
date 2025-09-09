import { useState } from "react";

import "./GuitarMenu.css";

type GuitarMenuProps = {
    analytical?: React.ReactNode;
    practice?: React.ReactNode;
};

export default function GuitarMenu({ analytical: GuitarAnalysis, practice: GuitarPractice }: GuitarMenuProps) {
  const [activeTab, setActiveTab] = useState<"analysis" | "practice">("analysis");

  return (
    <div className="guitar-menu">
      {/* Tab buttons */}
      <div className="menu-tabs">
        <button
          className={activeTab === "analysis" ? "active" : ""}
          onClick={() => setActiveTab("analysis")}
        >
          Analytical
        </button>
        <button
          className={activeTab === "practice" ? "active" : ""}
          onClick={() => setActiveTab("practice")}
        >
          Practice
        </button>
      </div>

      {/* Tab content */}
      <div className="menu-content">
        {activeTab === "analysis" && GuitarAnalysis}
        {activeTab === "practice" && GuitarPractice}
      </div>
    </div>
  );
}
