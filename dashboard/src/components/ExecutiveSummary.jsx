import "./ExecutiveSummary.css";

export default function ExecutiveSummary() {
    return (
        <div className="executive-summary">

            <div className="summary-header">
                <span className="ai-dot"></span>
                <h2>AI Executive Summary</h2>
                <span className="confidence">
                    Confidence 94.2%
                </span>
            </div>

            <div className="summary-grid">

                <div className="summary-card">
                    <h4>Business Overview</h4>

                    <p>
                        Fraud activity increased
                        <span className="red"> 11.4%</span>
                        across western regions.
                    </p>

                    <p>
                        Estimated financial exposure
                        <span className="yellow">
                            ₹2.31 Cr
                        </span>
                    </p>

                    <p>
                        Recovery efficiency improved
                        <span className="green">
                            +7.8%
                        </span>
                    </p>

                </div>

                <div className="summary-card">

                    <h4>AI Findings</h4>

                    <ul>

                        <li>
                            Two new layering clusters detected
                        </li>

                        <li>
                            High transaction velocity from
                            Maharashtra.
                        </li>

                        <li>
                            14 accounts require manual review.
                        </li>

                    </ul>

                </div>

                <div className="summary-card">

                    <h4>Recommended Actions</h4>

                    <ul>

                        <li>
                            Freeze 12 high-risk accounts
                        </li>

                        <li>
                            Increase monitoring in Karnataka
                        </li>

                        <li>
                            Escalate Cluster-17 investigation
                        </li>

                    </ul>

                </div>

            </div>

        </div>
    );
}
