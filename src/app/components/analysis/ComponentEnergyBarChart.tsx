import React from "react";

interface ComponentEnergyBarChartProps {
    energies: number[];
    totalEnergy: number;
    labels?: string[];
}

const COLORS = [
    "#4FD1C5", "#66d9ff", "#f6c177", "#e06c75", "#a9a1e1", "#98c379", "#ffb86c", "#ff79c6", "#bd93f9", "#50fa7b", "#ff5555", "#f1fa8c"
];

export const ComponentEnergyBarChart: React.FC<ComponentEnergyBarChartProps> = ({ energies, totalEnergy, labels }) => {
    const maxEnergy = Math.max(...energies, totalEnergy, 1e-9);
    return (
        <div style={{ width: "100%", maxWidth: 520, margin: "0.5rem 0 1.2rem", padding: "0.7rem 1.2rem", background: "rgba(20,30,40,0.18)", borderRadius: 8 }}>
            <div style={{ fontWeight: 600, marginBottom: 8 }}>Component Energy Comparison</div>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 10, height: 120 }}>
                {energies.map((energy, i) => (
                    <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center" }}>
                        <div
                            style={{
                                width: 28,
                                height: `${Math.max(6, 100 * energy / maxEnergy)}%`,
                                background: COLORS[i % COLORS.length],
                                borderRadius: 4,
                                marginBottom: 4,
                                boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
                                transition: "height 0.3s"
                            }}
                            title={`Energy: ${energy.toExponential(2)} (${((energy / totalEnergy) * 100).toFixed(1)}%)`}
                        />
                        <div style={{ fontSize: 12, color: "#bfc9d4", textAlign: "center", maxWidth: 40, wordBreak: "break-all" }}>
                            {labels?.[i] ?? `C${i + 1}`}
                        </div>
                        <div style={{ fontSize: 11, color: "#8fa1b3" }}>{((energy / totalEnergy) * 100).toFixed(1)}%</div>
                    </div>
                ))}
                <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center" }}>
                    <div
                        style={{
                            width: 28,
                            height: `100%`,
                            background: "#222e3c",
                            borderRadius: 4,
                            marginBottom: 4,
                            border: "2px solid #bfc9d4",
                            boxShadow: "0 2px 8px rgba(0,0,0,0.08)"
                        }}
                        title={`Total Energy: ${totalEnergy.toExponential(2)} (100%)`}
                    />
                    <div style={{ fontSize: 12, color: "#bfc9d4", textAlign: "center", maxWidth: 40, wordBreak: "break-all" }}>Total</div>
                    <div style={{ fontSize: 11, color: "#8fa1b3" }}>100%</div>
                </div>
            </div>
        </div>
    );
};
