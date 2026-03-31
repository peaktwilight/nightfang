import { Navigate, Route, Routes } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ShellLayout } from "@/components/shell-layout";
import { ErrorState, LoadingState } from "@/components/state-panel";
import { OverviewPage } from "@/pages/overview-page";
import { FindingsPage } from "@/pages/findings-page";
import { ScansPage } from "@/pages/scans-page";
import { getDashboard, getScans } from "@/api";

export function App() {
  const dashboardQuery = useQuery({
    queryKey: ["dashboard"],
    queryFn: getDashboard,
  });

  const scansQuery = useQuery({
    queryKey: ["scans"],
    queryFn: getScans,
  });

  if (dashboardQuery.isLoading || scansQuery.isLoading) {
    return <LoadingState label="Mission control" />;
  }

  if (dashboardQuery.error) {
    return <ErrorState error={dashboardQuery.error} />;
  }

  if (scansQuery.error) {
    return <ErrorState error={scansQuery.error} />;
  }

  if (!dashboardQuery.data || !scansQuery.data) {
    return null;
  }

  return (
    <Routes>
      <Route
        element={<ShellLayout dashboard={dashboardQuery.data} scans={scansQuery.data} />}
      >
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route
          path="/dashboard"
          element={<OverviewPage dashboard={dashboardQuery.data} scans={scansQuery.data} />}
        />
        <Route path="/findings" element={<FindingsPage dashboard={dashboardQuery.data} />} />
        <Route path="/findings/:fingerprint" element={<FindingsPage dashboard={dashboardQuery.data} />} />
        <Route path="/scans" element={<ScansPage scans={scansQuery.data} />} />
        <Route path="/scans/:scanId" element={<ScansPage scans={scansQuery.data} />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Route>
    </Routes>
  );
}
