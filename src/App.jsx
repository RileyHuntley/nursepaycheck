import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider } from '@/lib/AuthContext';
import AppShell from '@/components/AppShell';
import ProtectedRoute from '@/components/ProtectedRoute';
import { TooltipProvider } from '@/components/ui/tooltip';
// Add page imports here
import Login from '@/pages/Login';
import Register from '@/pages/Register';
import ForgotPassword from '@/pages/ForgotPassword';
import ResetPassword from '@/pages/ResetPassword';
import Layout from '@/components/payroll/Layout';
import Landing from '@/pages/Landing';
import Dashboard from '@/pages/Dashboard';
import PayPeriodDetail from '@/pages/PayPeriodDetail';
import LastPayPeriod from '@/pages/LastPayPeriod';
import PayConfiguration from '@/pages/PayConfiguration';
import PayPeriodHistory from '@/pages/PayPeriodHistory';
import Settings from '@/pages/Settings';
import Admin from '@/pages/Admin';
import AdminSupport from '@/pages/AdminSupport';
import AdminRoute from '@/components/payroll/AdminRoute';
import ShiftCalendar from '@/pages/ShiftCalendar';
import ShiftLog from '@/pages/ShiftLog';
import ShiftConfiguration from '@/pages/ShiftConfiguration';
import SharedShifts from '@/pages/SharedShifts';
import ShiftAnalytics from '@/pages/ShiftAnalytics';
import TimeBank from '@/pages/TimeBank';

const router = createBrowserRouter([
  {
    element: <AppShell />,
    children: [
      { path: "/login", element: <Login /> },
      { path: "/register", element: <Register /> },
      { path: "/forgot-password", element: <ForgotPassword /> },
      { path: "/reset-password", element: <ResetPassword /> },
      { path: "/", element: <Landing /> },
      { path: "/share", element: <SharedShifts /> },
      {
        element: <ProtectedRoute unauthenticatedElement={<Navigate to="/login" replace />} />,
        children: [
          {
            element: <Layout />,
            children: [
              { path: "/dashboard", element: <Dashboard /> },
              { path: "/pay-period", element: <PayPeriodDetail /> },
              { path: "/pay-period/:id", element: <PayPeriodDetail /> },
              { path: "/last-pay-period", element: <LastPayPeriod /> },
              { path: "/pay-periods", element: <PayPeriodHistory /> },
              { path: "/shift-configuration", element: <ShiftConfiguration /> },
              { path: "/settings", element: <Settings /> },
              { path: "/pay-configuration", element: <PayConfiguration /> },
              { path: "/shift-log", element: <ShiftLog /> },
              { path: "/shift-analytics", element: <ShiftAnalytics /> },
              { path: "/time-bank", element: <TimeBank /> },
              { path: "/calendar", element: <ShiftCalendar /> },
              {
                element: <AdminRoute />,
                children: [
                  { path: "/admin", element: <Admin /> },
                  { path: "/admin/support/:userId", element: <AdminSupport /> },
                ],
              },
            ],
          },
        ],
      },
      { path: "*", element: <PageNotFound /> },
    ],
  },
]);

function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <TooltipProvider>
          <RouterProvider router={router} />
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App