import AlertFeed from "./components/AlertFeed";
import CaseManagement from "./components/CaseManagement";
import CommunityExplorer from "./components/CommunityExplorer";
import GraphCanvas from "./components/GraphCanvas";
import InvestigationWorkspace from "./components/InvestigationWorkspace";
import RiskLeaderboard from "./components/RiskLeaderboard";
import SystemOverview from "./components/SystemOverview";

export default function App() {

    return (

        <div>

            <SystemOverview />

            <AlertFeed />

            <RiskLeaderboard />

            <CommunityExplorer />

            <GraphCanvas />

            <InvestigationWorkspace />

            <CaseManagement />

        </div>

    );
}
